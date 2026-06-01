package com.averio.mdm.testing.repository;

import com.averio.mdm.testing.domain.TestRun;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestRunRepository extends CosmosRepository<TestRun, String> {

    List<TestRun> findBySuiteName(String suiteName);
}
