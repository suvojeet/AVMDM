package com.averio.mdm.domain.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Canonical domain event published via Spring ApplicationEventPublisher.
 * Consumed by WebhookDispatchService to fan out to tenant-registered webhooks.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AverioMdmEvent {

    // ── Event identity ───────────────────────────────────────────────────────

    private String eventId;
    private String eventType;       // PARTY_CREATED | PARTY_UPDATED | ACCOUNT_CREATED | …

    // ── Entity context ───────────────────────────────────────────────────────

    private String domain;          // PARTY | ACCOUNT | AGREEMENT | RELATIONSHIP | PRODUCT
    private String entityId;        // globalId / globalAccountId / etc.
    private String tenantId;        // "default" until multi-tenancy is wired

    // ── Payload ──────────────────────────────────────────────────────────────

    private Object entity;                   // full serialised entity snapshot
    private List<String> changedFields;      // field names that changed (UPDATE events)
    private Map<String, Object> metadata;    // arbitrary extra context

    private Instant timestamp;

    // ── Event type constants ─────────────────────────────────────────────────

    public static final String PARTY_CREATED              = "PARTY_CREATED";
    public static final String PARTY_UPDATED              = "PARTY_UPDATED";
    public static final String PARTY_DELETED              = "PARTY_DELETED";

    public static final String ACCOUNT_CREATED            = "ACCOUNT_CREATED";
    public static final String ACCOUNT_UPDATED            = "ACCOUNT_UPDATED";
    public static final String ACCOUNT_DELETED            = "ACCOUNT_DELETED";

    public static final String AGREEMENT_CREATED          = "AGREEMENT_CREATED";
    public static final String AGREEMENT_UPDATED          = "AGREEMENT_UPDATED";
    public static final String AGREEMENT_DELETED          = "AGREEMENT_DELETED";

    public static final String RELATIONSHIP_CREATED       = "RELATIONSHIP_CREATED";
    public static final String RELATIONSHIP_UPDATED       = "RELATIONSHIP_UPDATED";
    public static final String RELATIONSHIP_DELETED       = "RELATIONSHIP_DELETED";

    public static final String PRODUCT_CREATED            = "PRODUCT_CREATED";
    public static final String PRODUCT_UPDATED            = "PRODUCT_UPDATED";
    public static final String PRODUCT_DELETED            = "PRODUCT_DELETED";

    public static final String DYNAMIC_ATTRIBUTE_UPDATED  = "DYNAMIC_ATTRIBUTE_UPDATED";
    public static final String TEST_PING                  = "TEST_PING";
}
