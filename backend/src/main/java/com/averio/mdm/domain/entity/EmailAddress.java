package com.averio.mdm.domain.entity;

import lombok.*;
import org.springframework.data.neo4j.core.schema.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Node("EmailAddress")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EmailAddress {

    @Id @GeneratedValue private Long id;

    @Property("emailId")      private String    emailId;      // UUID
    @Property("emailType")    private String    emailType;    // from EMAIL_TYPE ref data
    @Property("email")        private String    email;        // the actual address
    @Property("isPrimary")    private Boolean   isPrimary;
    @Property("isVerified")   private Boolean   isVerified;

    @Property("startDate")    private LocalDate startDate;
    @Property("endDate")      private LocalDate endDate;      // soft-delete date
    @Property("endReason")    private String    endReason;

    @Property("createdAt")    private LocalDateTime createdAt;
    @Property("updatedAt")    private LocalDateTime updatedAt;
    @Property("createdBy")    private String    createdBy;
    @Property("updatedBy")    private String    updatedBy;
}
