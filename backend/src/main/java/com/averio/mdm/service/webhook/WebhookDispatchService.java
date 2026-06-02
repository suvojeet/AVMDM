package com.averio.mdm.service.webhook;

import com.averio.mdm.domain.event.AverioMdmEvent;
import com.averio.mdm.domain.webhook.WebhookDeliveryLog;
import com.averio.mdm.domain.webhook.WebhookRegistration;
import com.averio.mdm.repository.cosmos.WebhookDeliveryLogRepository;
import com.averio.mdm.repository.cosmos.WebhookRegistrationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Listens for AverioMdmEvent publications and fans them out asynchronously
 * to all active webhooks subscribed to that event type.
 *
 * Retry policy: up to maxRetries attempts with a short exponential backoff
 * (5 s, 15 s, 30 s) — acceptable for a background thread pool.
 * Permanent failures are logged and surfaced in the Delivery Logs UI.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookDispatchService {

    private static final int[] BACKOFF_SECONDS = {5, 15, 30};
    private static final int MAX_RESPONSE_BODY_CHARS = 2_000;

    private final WebhookRegistrationRepository registrationRepo;
    private final WebhookDeliveryLogRepository   deliveryLogRepo;
    private final ObjectMapper                   objectMapper;

    // ── Spring event listener ────────────────────────────────────────────────

    @EventListener
    public void onDomainEvent(AverioMdmEvent event) {
        String tenantId = event.getTenantId() != null ? event.getTenantId() : "default";
        List<WebhookRegistration> candidates =
                registrationRepo.findByTenantIdAndIsActive(tenantId, Boolean.TRUE);

        for (WebhookRegistration webhook : candidates) {
            List<String> subscribed = webhook.getEvents();
            if (subscribed == null || subscribed.isEmpty() || subscribed.contains(event.getEventType())) {
                dispatchAsync(webhook, event);
            }
        }
    }

    // ── Async dispatch ───────────────────────────────────────────────────────

    @Async("webhookExecutor")
    public void dispatchAsync(WebhookRegistration webhook, AverioMdmEvent event) {
        int maxAttempts = webhook.getMaxRetries() != null ? webhook.getMaxRetries() : 3;
        maxAttempts = Math.min(maxAttempts, 5);

        String payload;
        try {
            payload = objectMapper.writeValueAsString(event);
        } catch (Exception e) {
            log.error("Webhook {}: failed to serialise event {}", webhook.getId(), event.getEventId(), e);
            return;
        }

        String signature = computeHmac(webhook.getSecret(), payload);

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            long start = System.currentTimeMillis();
            WebhookDeliveryLog logEntry = WebhookDeliveryLog.builder()
                    .id(UUID.randomUUID().toString())
                    .webhookId(webhook.getId())
                    .eventId(event.getEventId())
                    .eventType(event.getEventType())
                    .entityId(event.getEntityId())
                    .domain(event.getDomain())
                    .attemptNumber(attempt)
                    .attemptedAt(LocalDateTime.now())
                    .build();

            try {
                RestTemplate rt = buildRestTemplate(webhook);
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-Averio-Event",     event.getEventType());
                headers.set("X-Averio-Event-Id",  event.getEventId());
                headers.set("X-Averio-Signature", "sha256=" + signature);
                headers.set("X-Averio-Timestamp", event.getTimestamp().toString());

                ResponseEntity<String> response = rt.exchange(
                        webhook.getUrl(), HttpMethod.POST,
                        new HttpEntity<>(payload, headers), String.class);

                logEntry.setHttpStatus(response.getStatusCode().value());
                logEntry.setDurationMs(System.currentTimeMillis() - start);
                logEntry.setResponseBody(truncate(response.getBody()));
                logEntry.setStatus(response.getStatusCode().is2xxSuccessful() ? "SUCCESS" : "FAILED");
                deliveryLogRepo.save(logEntry);

                if (response.getStatusCode().is2xxSuccessful()) {
                    log.debug("Webhook {} delivered event {} on attempt {}", webhook.getId(), event.getEventId(), attempt);
                    return;
                }

            } catch (Exception e) {
                logEntry.setStatus("FAILED");
                logEntry.setErrorMessage(truncate(e.getMessage()));
                logEntry.setDurationMs(System.currentTimeMillis() - start);
                deliveryLogRepo.save(logEntry);
                log.warn("Webhook {} attempt {}/{} failed: {}", webhook.getId(), attempt, maxAttempts, e.getMessage());
            }

            if (attempt < maxAttempts) {
                int backoff = BACKOFF_SECONDS[Math.min(attempt - 1, BACKOFF_SECONDS.length - 1)];
                try { Thread.sleep(backoff * 1_000L); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); return; }
            }
        }
        log.error("Webhook {} permanently failed to deliver event {} after {} attempts", webhook.getId(), event.getEventId(), maxAttempts);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private RestTemplate buildRestTemplate(WebhookRegistration webhook) {
        int timeoutMs = (webhook.getTimeoutSeconds() != null ? webhook.getTimeoutSeconds() : 30) * 1_000;
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return new RestTemplate(factory);
    }

    private String computeHmac(String secret, String payload) {
        if (secret == null || secret.isBlank()) return "no-secret";
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            log.warn("HMAC computation failed", e);
            return "hmac-error";
        }
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > MAX_RESPONSE_BODY_CHARS ? s.substring(0, MAX_RESPONSE_BODY_CHARS) + "…" : s;
    }
}
