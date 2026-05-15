package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.steward.StewardTask;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StewardTaskRepository extends CosmosRepository<StewardTask, String> {
    List<StewardTask> findByTaskType(String taskType);
    List<StewardTask> findByAssignedTo(String assignedTo);
    List<StewardTask> findByStatus(String status);
    List<StewardTask> findByEntityId(String entityId);
    List<StewardTask> findByEntityType(String entityType);
}
