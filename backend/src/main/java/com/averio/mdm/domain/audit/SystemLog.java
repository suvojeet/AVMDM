package com.averio.mdm.domain.audit;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "system-logs", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class SystemLog {

    @Id
    private String logId;

    @PartitionKey
    private String level;               // ERROR, WARN, INFO, DEBUG

    private String source;              // Fully qualified class name or service label
    private String message;
    private String stackTrace;

    private LocalDateTime timestamp;
    private String userId;
    private String requestPath;
    private String httpMethod;
    private Integer httpStatus;
    private String correlationId;
    private Map<String, String> metadata;
}
