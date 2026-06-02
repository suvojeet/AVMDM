package com.averio.mdm.service.webhook;

import com.averio.mdm.domain.event.AverioMdmEvent;
import com.averio.mdm.domain.webhook.*;
import com.averio.mdm.repository.cosmos.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookService {

    private static final String DEFAULT_TENANT = "default";

    private final WebhookRegistrationRepository  registrationRepo;
    private final WebhookDeliveryLogRepository   deliveryLogRepo;
    private final TenantApiKeyRepository         apiKeyRepo;
    private final DerivedAttributeValueRepository derivedAttrRepo;
    private final ApplicationEventPublisher      eventPublisher;
    private final WebhookDispatchService         dispatchService;

    // ── Webhook registration CRUD ────────────────────────────────────────────

    public List<WebhookRegistration> listRegistrations() {
        return registrationRepo.findByTenantId(DEFAULT_TENANT);
    }

    public WebhookRegistration createRegistration(WebhookRegistration reg, String createdBy) {
        reg.setId(UUID.randomUUID().toString());
        reg.setTenantId(DEFAULT_TENANT);
        if (reg.getIsActive() == null)       reg.setIsActive(true);
        if (reg.getTimeoutSeconds() == null) reg.setTimeoutSeconds(30);
        if (reg.getMaxRetries() == null)     reg.setMaxRetries(3);
        reg.setCreatedBy(createdBy);
        reg.setCreatedAt(LocalDateTime.now());
        reg.setUpdatedAt(LocalDateTime.now());
        return registrationRepo.save(reg);
    }

    public WebhookRegistration updateRegistration(String id, WebhookRegistration updates, String updatedBy) {
        WebhookRegistration existing = registrationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + id));
        if (updates.getName()           != null) existing.setName(updates.getName());
        if (updates.getUrl()            != null) existing.setUrl(updates.getUrl());
        if (updates.getSecret()         != null) existing.setSecret(updates.getSecret());
        if (updates.getEvents()         != null) existing.setEvents(updates.getEvents());
        if (updates.getDescription()    != null) existing.setDescription(updates.getDescription());
        if (updates.getTimeoutSeconds() != null) existing.setTimeoutSeconds(updates.getTimeoutSeconds());
        if (updates.getMaxRetries()     != null) existing.setMaxRetries(updates.getMaxRetries());
        if (updates.getIsActive()       != null) existing.setIsActive(updates.getIsActive());
        existing.setUpdatedBy(updatedBy);
        existing.setUpdatedAt(LocalDateTime.now());
        return registrationRepo.save(existing);
    }

    public void deleteRegistration(String id) {
        registrationRepo.deleteById(id);
    }

    public WebhookRegistration toggleRegistration(String id) {
        WebhookRegistration existing = registrationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + id));
        existing.setIsActive(!Boolean.TRUE.equals(existing.getIsActive()));
        existing.setUpdatedAt(LocalDateTime.now());
        return registrationRepo.save(existing);
    }

    /** Fires a TEST_PING event immediately to verify endpoint reachability. */
    public void testWebhook(String id) {
        WebhookRegistration webhook = registrationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + id));
        AverioMdmEvent ping = AverioMdmEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .eventType(AverioMdmEvent.TEST_PING)
                .domain("SYSTEM")
                .entityId("test")
                .tenantId(DEFAULT_TENANT)
                .entity(Map.of("message", "Averio MDM test ping — this is a connectivity check"))
                .metadata(Map.of("webhookId", id))
                .timestamp(Instant.now())
                .build();
        dispatchService.dispatchAsync(webhook, ping);
    }

    public List<WebhookDeliveryLog> getDeliveryLogs(String webhookId) {
        return deliveryLogRepo.findByWebhookId(webhookId);
    }

    // ── API key management ───────────────────────────────────────────────────

    public List<TenantApiKey> listApiKeys() {
        return apiKeyRepo.findByTenantId(DEFAULT_TENANT);
    }

    /**
     * Generates a new API key. Returns a map with the full raw key (shown once only)
     * and the stored entity (which does NOT contain the raw key).
     */
    public Map<String, Object> generateApiKey(String name, String createdBy) {
        byte[] randomBytes = new byte[32];
        new SecureRandom().nextBytes(randomBytes);
        String rawKey = "avr_" + Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        String keyHash   = sha256Hex(rawKey);
        String keyPrefix = rawKey.substring(0, Math.min(12, rawKey.length()));

        TenantApiKey key = TenantApiKey.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(DEFAULT_TENANT)
                .name(name)
                .keyHash(keyHash)
                .keyPrefix(keyPrefix)
                .isActive(true)
                .createdBy(createdBy)
                .createdAt(LocalDateTime.now())
                .build();
        apiKeyRepo.save(key);

        return Map.of("apiKey", rawKey, "meta", toSafeView(key));
    }

    public void revokeApiKey(String id) {
        TenantApiKey key = apiKeyRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("API key not found: " + id));
        key.setIsActive(false);
        apiKeyRepo.save(key);
    }

    /**
     * Validates a raw API key from the X-Averio-API-Key header.
     * Returns the TenantApiKey entity if valid and active.
     */
    public Optional<TenantApiKey> validateApiKey(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) return Optional.empty();
        String hash = sha256Hex(rawKey);
        Optional<TenantApiKey> found = apiKeyRepo.findByKeyHash(hash);
        found.filter(k -> Boolean.TRUE.equals(k.getIsActive())).ifPresent(k -> {
            k.setLastUsedAt(LocalDateTime.now());
            apiKeyRepo.save(k);
        });
        return found.filter(k -> Boolean.TRUE.equals(k.getIsActive()));
    }

    // ── Writeback ────────────────────────────────────────────────────────────

    public void writeBack(String domain, String entityId, WriteBackRequest request) {
        for (WriteBackRequest.AttributePayload attr : request.getAttributes()) {
            String instanceId = attr.getInstanceId() != null ? attr.getInstanceId() : "default";
            String docId = entityId + "_" + attr.getSchemaKey() + "_" + instanceId;

            DerivedAttributeValue doc = derivedAttrRepo
                    .findByEntityIdAndSchemaKeyAndInstanceId(entityId, attr.getSchemaKey(), instanceId)
                    .orElse(DerivedAttributeValue.builder()
                            .id(docId)
                            .entityId(entityId)
                            .domain(domain)
                            .schemaKey(attr.getSchemaKey())
                            .instanceId(instanceId)
                            .source("WEBHOOK")
                            .sourceRef(request.getSourceRef())
                            .createdAt(LocalDateTime.now())
                            .build());

            doc.setValues(attr.getValues());
            doc.setUpdatedAt(LocalDateTime.now());
            derivedAttrRepo.save(doc);
        }
        log.info("Writeback: {} derived attribute(s) saved for {}/{}", request.getAttributes().size(), domain, entityId);
    }

    public List<DerivedAttributeValue> getDerivedAttributes(String domain, String entityId) {
        return derivedAttrRepo.findByEntityIdAndDomain(entityId, domain);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
    }

    private Map<String, Object> toSafeView(TenantApiKey key) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",        key.getId());
        m.put("name",      key.getName());
        m.put("keyPrefix", key.getKeyPrefix());
        m.put("isActive",  key.getIsActive());
        m.put("createdAt", key.getCreatedAt());
        return m;
    }

    // ── Writeback request DTO ────────────────────────────────────────────────

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class WriteBackRequest {
        private String sourceRef;
        private List<AttributePayload> attributes;

        @lombok.Data
        @lombok.NoArgsConstructor
        @lombok.AllArgsConstructor
        public static class AttributePayload {
            private String schemaKey;
            private String instanceId;
            private Map<String, Object> values;
        }
    }
}
