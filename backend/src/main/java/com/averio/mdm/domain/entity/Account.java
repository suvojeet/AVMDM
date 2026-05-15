package com.averio.mdm.domain.entity;

import lombok.*;
import org.springframework.data.neo4j.core.schema.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Node("Account")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Account {

    @Id
    @GeneratedValue
    private Long id;

    @Property("globalAccountId")
    private String globalAccountId;

    @Property("accountNumber")
    private String accountNumber;

    @Property("accountType")
    private String accountType;         // CHECKING, SAVINGS, CREDIT, INVESTMENT, LOAN, etc.

    @Property("accountSubType")
    private String accountSubType;

    @Property("accountName")
    private String accountName;

    @Property("accountStatus")
    private String accountStatus;       // OPEN, CLOSED, DORMANT, FROZEN, PENDING

    @Property("currency")
    private String currency;

    @Property("balance")
    private BigDecimal balance;

    @Property("creditLimit")
    private BigDecimal creditLimit;

    @Property("availableCredit")
    private BigDecimal availableCredit;

    @Property("interestRate")
    private Double interestRate;

    @Property("openDate")
    private LocalDate openDate;

    @Property("closeDate")
    private LocalDate closeDate;

    @Property("maturityDate")
    private LocalDate maturityDate;

    @Property("lastTransactionDate")
    private LocalDate lastTransactionDate;

    @Property("routingNumber")
    private String routingNumber;

    @Property("iban")
    private String iban;

    @Property("swift")
    private String swift;

    // ---- Institution Info ----
    @Property("institutionName")
    private String institutionName;

    @Property("institutionId")
    private String institutionId;

    @Property("branchCode")
    private String branchCode;

    @Property("branchName")
    private String branchName;

    // ---- Risk & Compliance ----
    @Property("riskRating")
    private String riskRating;

    @Property("kycStatus")
    private String kycStatus;

    @Property("amlStatus")
    private String amlStatus;

    @Property("regulatoryCategory")
    private String regulatoryCategory;

    // ---- Golden Record Metadata ----
    @Property("isGolden")
    private Boolean isGolden;

    @Property("goldenRecordId")
    private String goldenRecordId;

    @Property("sourceSystem")
    private String sourceSystem;

    @Property("sourceSystemId")
    private String sourceSystemId;

    // ---- Audit ----
    @Property("createdAt")
    private LocalDateTime createdAt;

    @Property("updatedAt")
    private LocalDateTime updatedAt;

    @Property("createdBy")
    private String createdBy;

    @Property("updatedBy")
    private String updatedBy;

    @Property("version")
    private Long version;

    // ---- Relationships ----
    @Relationship(type = "ACCOUNT_HOLDER", direction = Relationship.Direction.OUTGOING)
    private List<Party> holders = new ArrayList<>();

    @Relationship(type = "HAS_PRODUCT", direction = Relationship.Direction.OUTGOING)
    private List<Product> products = new ArrayList<>();
}
