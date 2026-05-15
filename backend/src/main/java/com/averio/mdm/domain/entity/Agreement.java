package com.averio.mdm.domain.entity;

import lombok.*;
import org.springframework.data.neo4j.core.schema.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Node("Agreement")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Agreement {
    @Id @GeneratedValue private Long id;
    @Property("globalAgreementId") private String globalAgreementId;
    @Property("agreementNumber") private String agreementNumber;
    @Property("agreementType") private String agreementType;
    @Property("agreementSubType") private String agreementSubType;
    @Property("agreementName") private String agreementName;
    @Property("agreementStatus") private String agreementStatus;
    @Property("description") private String description;
    @Property("effectiveStartDate") private LocalDate effectiveStartDate;
    @Property("effectiveEndDate") private LocalDate effectiveEndDate;
    @Property("signedDate") private LocalDate signedDate;
    @Property("terminationDate") private LocalDate terminationDate;
    @Property("renewalDate") private LocalDate renewalDate;
    @Property("contractValue") private BigDecimal contractValue;
    @Property("currency") private String currency;
    @Property("paymentTerms") private String paymentTerms;
    @Property("primaryPartyId") private String primaryPartyId;
    @Property("counterPartyId") private String counterPartyId;
    @Property("governingLaw") private String governingLaw;
    @Property("jurisdiction") private String jurisdiction;
    @Property("complianceRequirements") private String complianceRequirements;
    @Property("documentUrl") private String documentUrl;
    @Property("sourceSystem") private String sourceSystem;
    @Property("sourceSystemId") private String sourceSystemId;
    @Property("isGolden") private Boolean isGolden;
    @Property("goldenRecordId") private String goldenRecordId;
    @Property("createdAt") private LocalDateTime createdAt;
    @Property("updatedAt") private LocalDateTime updatedAt;
    @Property("createdBy") private String createdBy;
    @Property("updatedBy") private String updatedBy;
    @Property("version") private Long version;
    @Relationship(type = "AGREEMENT_PARTY", direction = Relationship.Direction.OUTGOING)
    private List<Party> parties = new ArrayList<>();
    @Relationship(type = "COVERS_PRODUCT", direction = Relationship.Direction.OUTGOING)
    private List<Product> coveredProducts = new ArrayList<>();
    @Relationship(type = "LINKED_ACCOUNT", direction = Relationship.Direction.OUTGOING)
    private List<Account> linkedAccounts = new ArrayList<>();
}
