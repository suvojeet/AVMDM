package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.ml.MLMatchModel;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface MLMatchModelRepository extends CosmosRepository<MLMatchModel, String> {
    Optional<MLMatchModel> findByEntityType(String entityType);
    List<MLMatchModel> findAllByOrderByTrainedAtDesc();
}
