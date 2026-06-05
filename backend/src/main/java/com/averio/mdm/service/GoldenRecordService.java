package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.domain.governance.SurvivorshipRule;
import com.averio.mdm.engine.survivorship.SurvivorshipEngine;
import com.averio.mdm.repository.neo4j.PartyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoldenRecordService {

    private final PartyRepository partyRepository;
    private final SurvivorshipEngine survivorshipEngine;
    private final GovernanceService governanceService;

    public GoldenRecord getGoldenRecordForView(String goldenRecordId, String viewId) {
        List<Party> sources = partyRepository.findByGoldenRecordId(goldenRecordId);
        if (sources.isEmpty()) return null;
        List<SurvivorshipRule> rules = governanceService.getActiveSurvivorshipRules("PARTY", viewId);
        return survivorshipEngine.buildGoldenRecord(sources, rules, goldenRecordId);
    }

    public GoldenRecord getGoldenRecord(String goldenRecordId) {
        List<Party> sources = partyRepository.findByGoldenRecordId(goldenRecordId);
        if (sources.isEmpty()) return null;
        List<SurvivorshipRule> rules = governanceService.getActiveSurvivorshipRules("PARTY");
        return survivorshipEngine.buildGoldenRecord(sources, rules, goldenRecordId);
    }

    public GoldenRecord refreshGoldenRecord(String goldenRecordId, String triggeredBy) {
        log.info("Refreshing golden record {} triggered by {}", goldenRecordId, triggeredBy);
        List<Party> sources = partyRepository.findByGoldenRecordId(goldenRecordId);
        if (sources.isEmpty()) return null;

        List<SurvivorshipRule> rules = governanceService.getActiveSurvivorshipRules("PARTY");
        GoldenRecord golden = survivorshipEngine.buildGoldenRecord(sources, rules, goldenRecordId);

        // Update the golden node in Neo4j (the source record with highest confidence)
        updateGoldenNode(sources, golden);
        return golden;
    }

    public GoldenRecord createNewGoldenRecord(String goldenRecordId, List<Party> sources, String createdBy) {
        List<SurvivorshipRule> rules = governanceService.getActiveSurvivorshipRules("PARTY");
        GoldenRecord golden = survivorshipEngine.buildGoldenRecord(sources, rules, goldenRecordId);
        updateGoldenNode(sources, golden);
        log.info("New golden record {} created with {} sources", goldenRecordId, sources.size());
        return golden;
    }

    public void markMerged(String mergedGoldenId, String survivingGoldenId, String reason, String performedBy) {
        // The caller (PartyService.mergeGoldenRecords) already re-pointed the losing sources
        // to survivingGoldenId and set status=MERGED in the same saveAll — so querying by
        // mergedGoldenId here would return nothing.  We query by survivingGoldenId instead
        // and mark any source that still carries the old mergedGoldenId as a cross-check.
        List<Party> allSurviving = partyRepository.findByGoldenRecordId(survivingGoldenId);
        boolean anyUpdated = false;
        for (Party p : allSurviving) {
            // Sources that came from the losing cluster haven't had status=MERGED yet if
            // they were saved by a different transaction context — set it defensively.
            if ("MERGED".equals(p.getStatus())) continue;
            // Only mark non-golden sources as MERGED (the golden representative stays ACTIVE)
            if (Boolean.TRUE.equals(p.getIsGolden())) continue;
            // If this source was recently migrated (updatedBy == performedBy) mark it MERGED
            if (performedBy.equals(p.getUpdatedBy())) {
                p.setStatus("MERGED");
                anyUpdated = true;
            }
        }
        if (anyUpdated) partyRepository.saveAll(allSurviving);
        log.info("markMerged: golden {} consumed into {} by {}", mergedGoldenId, survivingGoldenId, performedBy);
    }

    private void updateGoldenNode(List<Party> sources, GoldenRecord golden) {
        // Find or designate the golden representative record
        Optional<Party> goldenCandidate = sources.stream()
                .max((a, b) -> {
                    double scoreA = a.getConfidenceScore() != null ? a.getConfidenceScore() : 0;
                    double scoreB = b.getConfidenceScore() != null ? b.getConfidenceScore() : 0;
                    return Double.compare(scoreA, scoreB);
                });

        sources.forEach(p -> p.setIsGolden(false));
        goldenCandidate.ifPresent(p -> {
            p.setIsGolden(true);
            p.setConfidenceScore(golden.getOverallConfidenceScore());
            p.setDataQualityScore(golden.getDataQualityScore());
            p.setCompletenessScore(golden.getCompletenessScore());
        });
        partyRepository.saveAll(sources);
    }
}
