package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.audit.SystemLog;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SystemLogRepository extends CosmosRepository<SystemLog, String> {

    List<SystemLog> findByLevelOrderByTimestampDesc(String level);
    List<SystemLog> findBySourceOrderByTimestampDesc(String source);
}
