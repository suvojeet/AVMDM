package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.audit.TransactionLog;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransactionLogRepository extends CosmosRepository<TransactionLog, String> {

    List<TransactionLog> findByEntityTypeOrderByPerformedAtDesc(String entityType);
    List<TransactionLog> findByEntityIdOrderByPerformedAtDesc(String entityId);
    List<TransactionLog> findByPerformedByOrderByPerformedAtDesc(String performedBy);
    List<TransactionLog> findByStatusOrderByPerformedAtDesc(String status);
}
