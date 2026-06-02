package com.averio.mdm.controller;

import com.averio.mdm.domain.webhook.*;
import com.averio.mdm.service.webhook.WebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/extensions")
@RequiredArgsConstructor
public class WebhookController {

    private final WebhookService webhookService;

    // ── Webhook registrations ────────────────────────────────────────────────

    @GetMapping("/webhooks")
    public List<WebhookRegistration> list() {
        return webhookService.listRegistrations();
    }

    @PostMapping("/webhooks")
    public WebhookRegistration create(@RequestBody WebhookRegistration reg) {
        return webhookService.createRegistration(reg, "admin");
    }

    @PutMapping("/webhooks/{id}")
    public WebhookRegistration update(@PathVariable String id, @RequestBody WebhookRegistration reg) {
        return webhookService.updateRegistration(id, reg, "admin");
    }

    @DeleteMapping("/webhooks/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        webhookService.deleteRegistration(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/webhooks/{id}/toggle")
    public WebhookRegistration toggle(@PathVariable String id) {
        return webhookService.toggleRegistration(id);
    }

    @PostMapping("/webhooks/{id}/test")
    public ResponseEntity<Void> test(@PathVariable String id) {
        webhookService.testWebhook(id);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/webhooks/{id}/logs")
    public List<WebhookDeliveryLog> logs(@PathVariable String id) {
        return webhookService.getDeliveryLogs(id);
    }

    // ── API keys ─────────────────────────────────────────────────────────────

    @GetMapping("/api-keys")
    public List<TenantApiKey> listKeys() {
        return webhookService.listApiKeys();
    }

    @PostMapping("/api-keys")
    public Map<String, Object> generateKey(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "Unnamed Key");
        return webhookService.generateApiKey(name, "admin");
    }

    @DeleteMapping("/api-keys/{id}")
    public ResponseEntity<Void> revokeKey(@PathVariable String id) {
        webhookService.revokeApiKey(id);
        return ResponseEntity.noContent().build();
    }

    // ── Writeback (called by the client's extension service) ─────────────────

    /**
     * Clients POST derived attribute values back to this endpoint after processing a webhook event.
     * Authentication: X-Averio-API-Key header — validated against stored SHA-256 hash.
     *
     * POST /api/v1/extensions/writeback/{domain}/{entityId}
     * X-Averio-API-Key: avr_...
     */
    @PostMapping("/writeback/{domain}/{entityId}")
    public ResponseEntity<?> writeBack(
            @PathVariable String domain,
            @PathVariable String entityId,
            @RequestHeader(value = "X-Averio-API-Key", required = false) String apiKey,
            @RequestBody WebhookService.WriteBackRequest request) {

        if (webhookService.validateApiKey(apiKey).isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or missing API key"));
        }
        webhookService.writeBack(domain.toUpperCase(), entityId, request);
        return ResponseEntity.ok(Map.of("status", "accepted"));
    }

    /** Returns all derived attributes written back for an entity (used by the UI). */
    @GetMapping("/derived/{domain}/{entityId}")
    public List<DerivedAttributeValue> getDerived(
            @PathVariable String domain,
            @PathVariable String entityId) {
        return webhookService.getDerivedAttributes(domain.toUpperCase(), entityId);
    }
}
