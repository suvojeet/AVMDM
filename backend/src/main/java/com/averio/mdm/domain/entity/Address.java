package com.averio.mdm.domain.entity;

import lombok.*;
import org.springframework.data.neo4j.core.schema.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Node("Address")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Address {
    @Id @GeneratedValue private Long id;
    @Property("addressId") private String addressId;
    @Property("addressType") private String addressType;
    @Property("isPrimary") private Boolean isPrimary;
    @Property("isVerified") private Boolean isVerified;
    @Property("verificationSource") private String verificationSource;
    @Property("line1") private String line1;
    @Property("line2") private String line2;
    @Property("line3") private String line3;
    @Property("city") private String city;
    @Property("stateProvince") private String stateProvince;
    @Property("postalCode") private String postalCode;
    @Property("county") private String county;
    @Property("country") private String country;
    @Property("countryCode") private String countryCode;
    @Property("latitude") private Double latitude;
    @Property("longitude") private Double longitude;
    @Property("geoAccuracy") private String geoAccuracy;
    @Property("uspsBarcode") private String uspsBarcode;
    @Property("dpvConfirmation") private String dpvConfirmation;
    @Property("effectiveStartDate") private LocalDate effectiveStartDate;
    @Property("effectiveEndDate") private LocalDate effectiveEndDate;
    @Property("sourceSystem") private String sourceSystem;
    @Property("createdAt") private LocalDateTime createdAt;
    @Property("updatedAt") private LocalDateTime updatedAt;
}
