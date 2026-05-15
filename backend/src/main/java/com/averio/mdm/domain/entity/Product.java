package com.averio.mdm.domain.entity;

import lombok.*;
import org.springframework.data.neo4j.core.schema.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Node("Product")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Product {
    @Id @GeneratedValue private Long id;
    @Property("globalProductId") private String globalProductId;
    @Property("productCode") private String productCode;
    @Property("productName") private String productName;
    @Property("productType") private String productType;
    @Property("productSubType") private String productSubType;
    @Property("productCategory") private String productCategory;
    @Property("productStatus") private String productStatus;
    @Property("description") private String description;
    @Property("listPrice") private BigDecimal listPrice;
    @Property("currency") private String currency;
    @Property("pricingModel") private String pricingModel;
    @Property("billingFrequency") private String billingFrequency;
    @Property("effectiveStartDate") private LocalDate effectiveStartDate;
    @Property("effectiveEndDate") private LocalDate effectiveEndDate;
    @Property("launchDate") private LocalDate launchDate;
    @Property("lineOfBusiness") private String lineOfBusiness;
    @Property("regulatoryClass") private String regulatoryClass;
    @Property("riskCategory") private String riskCategory;
    @Property("isBundle") private Boolean isBundle;
    @Property("parentProductCode") private String parentProductCode;
    @Property("sourceSystem") private String sourceSystem;
    @Property("sourceSystemId") private String sourceSystemId;
    @Property("isGolden") private Boolean isGolden;
    @Property("goldenRecordId") private String goldenRecordId;
    @Property("createdAt") private LocalDateTime createdAt;
    @Property("updatedAt") private LocalDateTime updatedAt;
    @Property("createdBy") private String createdBy;
    @Property("updatedBy") private String updatedBy;
    @Property("version") private Long version;
    @Property("dataQualityScore") private Double dataQualityScore;
    @Relationship(type = "BUNDLED_WITH", direction = Relationship.Direction.OUTGOING)
    private List<Product> bundledProducts = new ArrayList<>();
}
