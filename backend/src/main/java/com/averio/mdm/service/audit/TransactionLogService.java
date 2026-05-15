package com.averio.mdm.service.audit;

import com.averio.mdm.domain.audit.TransactionLog;
import com.averio.mdm.repository.cosmos.TransactionLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionLogService {

    private final TransactionLogRepository repository;
    private final ObjectMapper objectMapper;

    public TransactionLog logSuccess(String entityType, String entityId, String operation,
                                     String performedBy, long durationMs,
                                     Object beforeState, Object afterState) {
        return save(entityType, entityId, operation, performedBy, durationMs,
                "SUCCESS", null, beforeState, afterState, null);
    }

    public TransactionLog logFailure(String entityType, String entityId, String operation,
                                     String performedBy, long durationMs,
                                     String errorMessage, Object requestPayload) {
        return save(entityType, entityId, operation, performedBy, durationMs,
                "FAILURE", errorMessage, null, null, requestPayload);
    }

    private TransactionLog save(String entityType, String entityId, String operation,
                                 String performedBy, long durationMs, String status,
                                 String errorMessage, Object before, Object after, Object payload) {
        TransactionLog entry = TransactionLog.builder()
                .logId(UUID.randomUUID().toString())
                .entityType(entityType)
                .entityId(entityId)
                .operation(operation)
                .performedBy(performedBy)
                .performedAt(LocalDateTime.now())
                .durationMs(durationMs)
                .status(status)
                .errorMessage(errorMessage)
                .beforeState(toJson(before))
                .afterState(toJson(after))
                .requestPayload(toJson(payload))
                .build();
        try {
            repository.save(entry);
        } catch (Exception ex) {
            log.warn("Could not persist transaction log (non-fatal): {}", ex.getMessage());
        }
        return entry;
    }

    public List<TransactionLog> getAll() {
        List<TransactionLog> all = new java.util.ArrayList<>();
        repository.findAll().forEach(all::add);
        all.sort((a, b) -> {
            if (a.getPerformedAt() == null) return 1;
            if (b.getPerformedAt() == null) return -1;
            return b.getPerformedAt().compareTo(a.getPerformedAt());
        });
        return all;
    }

    public List<TransactionLog> getByEntityType(String entityType) {
        return repository.findByEntityTypeOrderByPerformedAtDesc(entityType);
    }

    public List<TransactionLog> getByEntityId(String entityId) {
        return repository.findByEntityIdOrderByPerformedAtDesc(entityId);
    }

    public List<TransactionLog> getByUser(String user) {
        return repository.findByPerformedByOrderByPerformedAtDesc(user);
    }

    public List<TransactionLog> getFailures() {
        return repository.findByStatusOrderByPerformedAtDesc("FAILURE");
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception ex) {
            return obj.toString();
        }
    }
}
