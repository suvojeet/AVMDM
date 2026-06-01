package com.averio.mdm.domain.entity;

import lombok.*;
import org.springframework.data.neo4j.core.schema.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Node("Phone")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Phone {

    @Id @GeneratedValue private Long id;

    @Property("phoneId")          private String    phoneId;          // UUID
    @Property("phoneType")        private String    phoneType;        // from PHONE_TYPE ref data
    @Property("countryDialCode")  private String    countryDialCode;  // e.g. +1, +44
    @Property("areaCode")         private String    areaCode;         // e.g. 415
    @Property("exchange")         private String    exchange;         // e.g. 555
    @Property("phoneNumber")      private String    phoneNumber;      // subscriber digits, e.g. 0100
    @Property("extension")        private String    extension;
    @Property("isPrimary")        private Boolean   isPrimary;
    @Property("isVerified")       private Boolean   isVerified;

    @Property("startDate")        private LocalDate startDate;
    @Property("endDate")          private LocalDate endDate;          // soft-delete date
    @Property("endReason")        private String    endReason;

    @Property("createdAt")        private LocalDateTime createdAt;
    @Property("updatedAt")        private LocalDateTime updatedAt;
    @Property("createdBy")        private String    createdBy;
    @Property("updatedBy")        private String    updatedBy;
}
