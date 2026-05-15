package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.ml.MatchingFeedback;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MatchingFeedbackRepository extends CosmosRepository<MatchingFeedback, String> {
    List<MatchingFeedback> findByEntityType(String entityType);
    List<MatchingFeedback> findByEntityTypeAndLabel(String entityType, String label);
    List<MatchingFeedback> findByDecidedBy(String decidedBy);
    List<MatchingFeedback> findByPartyId1OrPartyId2(String partyId1, String partyId2);
    long countByEntityType(String entityType);
    long countByEntityTypeAndLabel(String entityType, String label);
}
