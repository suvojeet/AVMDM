package com.averio.mdm.engine.survivorship;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.domain.governance.SurvivorshipRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Survivorship Engine — determines the winning attribute value for a golden record
 * from multiple competing source system records, applying configurable rules.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SurvivorshipEngine {

    private final SourcePriorityStrategy sourcePriorityStrategy;
    private final MostRecentStrategy mostRecentStrategy;
    private final MostFrequentStrategy mostFrequentStrategy;

    private static final List<String> PARTY_ATTRIBUTES = List.of(
            "firstName", "lastName", "middleName", "fullName", "dateOfBirth",
            "gender", "nationality", "organizationName", "legalName",
            "taxId", "dunsNumber", "lei", "ssn", "status"
    );

    /**
     * Build a golden record from a set of matching source party records.
     * Applies configured survivorship rules per attribute.
     */
    public GoldenRecord buildGoldenRecord(List<Party> sourceParties,
                                          List<SurvivorshipRule> rules,
                                          String goldenRecordId) {
        log.info("Building golden record {} from {} source records", goldenRecordId, sourceParties.size());

        Map<String, GoldenRecord.GoldenAttribute> goldenAttributes = new HashMap<>();

        for (String attribute : PARTY_ATTRIBUTES) {
            SurvivorshipRule rule = findRuleForAttribute(attribute, rules);
            GoldenRecord.GoldenAttribute golden = applyRule(attribute, sourceParties, rule);
            if (golden != null) {
                goldenAttributes.put(attribute, golden);
            }
        }

        List<GoldenRecord.SourceRecord> sourceRecords = sourceParties.stream()
                .map(p -> GoldenRecord.SourceRecord.builder()
                        .sourceSystem(p.getSourceSystem())
                        .sourceSystemId(p.getSourceSystemId())
                        .sourceEntityType(p.getPartyType())
                        .linkedAt(LocalDateTime.now())
                        .status("LINKED")
                        .build())
                .collect(Collectors.toList());

        double confidence = calculateOverallConfidence(goldenAttributes);
        double completeness = calculateCompleteness(goldenAttributes);

        return GoldenRecord.builder()
                .goldenRecordId(goldenRecordId)
                .entityType("PARTY")
                .status("ACTIVE")
                .goldenAttributes(goldenAttributes)
                .sourceRecords(sourceRecords)
                .overallConfidenceScore(confidence)
                .completenessScore(completeness)
                .sourceCount(sourceParties.size())
                .firstSeenAt(sourceParties.stream()
                        .map(Party::getCreatedAt)
                        .filter(Objects::nonNull)
                        .min(Comparator.naturalOrder())
                        .orElse(LocalDateTime.now()))
                .lastUpdatedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();
    }

    private GoldenRecord.GoldenAttribute applyRule(String attribute, List<Party> parties, SurvivorshipRule rule) {
        List<GoldenRecord.AttributeCandidate> candidates = buildCandidates(attribute, parties);
        if (candidates.isEmpty()) return null;

        String ruleType = rule != null ? rule.getRuleType() : "MOST_RECENT";
        Object winningValue;
        String winningSource;

        switch (ruleType) {
            case "SOURCE_PRIORITY" -> {
                var winner = sourcePriorityStrategy.select(candidates, rule.getSourceSystemPriority());
                winningValue = winner.getValue();
                winningSource = winner.getSourceSystem();
            }
            case "MOST_RECENT" -> {
                var winner = mostRecentStrategy.select(candidates);
                winningValue = winner.getValue();
                winningSource = winner.getSourceSystem();
            }
            case "MOST_FREQUENT" -> {
                var winner = mostFrequentStrategy.select(candidates);
                winningValue = winner.getValue();
                winningSource = winner.getSourceSystem();
            }
            case "SUPREMACY" -> {
                var winner = candidates.stream()
                        .filter(c -> rule.getSupremacySourceSystem().equals(c.getSourceSystem()))
                        .filter(c -> c.getValue() != null)
                        .findFirst()
                        .orElse(mostRecentStrategy.select(candidates));
                winningValue = winner.getValue();
                winningSource = winner.getSourceSystem();
            }
            case "NON_NULL" -> {
                var winner = candidates.stream()
                        .filter(c -> c.getValue() != null)
                        .findFirst()
                        .orElse(candidates.get(0));
                winningValue = winner.getValue();
                winningSource = winner.getSourceSystem();
            }
            case "LONGEST" -> {
                var winner = candidates.stream()
                        .filter(c -> c.getValue() != null)
                        .max(Comparator.comparingInt(c -> c.getValue().toString().length()))
                        .orElse(candidates.get(0));
                winningValue = winner.getValue();
                winningSource = winner.getSourceSystem();
            }
            default -> {
                var winner = mostRecentStrategy.select(candidates);
                winningValue = winner.getValue();
                winningSource = winner.getSourceSystem();
            }
        }

        // Mark selected candidate
        candidates.forEach(c -> c.setWasSelected(
                c.getSourceSystem().equals(winningSource) && Objects.equals(c.getValue(), winningValue)));

        return GoldenRecord.GoldenAttribute.builder()
                .attributeName(attribute)
                .value(winningValue)
                .winningSourceSystem(winningSource)
                .survivorshipRule(ruleType)
                .confidenceScore(calculateAttributeConfidence(candidates, winningValue))
                .lastUpdated(LocalDateTime.now())
                .candidates(candidates)
                .build();
    }

    private List<GoldenRecord.AttributeCandidate> buildCandidates(String attribute, List<Party> parties) {
        List<GoldenRecord.AttributeCandidate> candidates = new ArrayList<>();
        for (Party party : parties) {
            Object value = getAttributeValue(party, attribute);
            candidates.add(GoldenRecord.AttributeCandidate.builder()
                    .sourceSystem(party.getSourceSystem())
                    .value(value)
                    .sourceTimestamp(party.getSourceLastUpdated())
                    .wasSelected(false)
                    .build());
        }
        return candidates;
    }

    private Object getAttributeValue(Party party, String attribute) {
        try {
            Field field = Party.class.getDeclaredField(attribute);
            field.setAccessible(true);
            return field.get(party);
        } catch (Exception e) {
            return null;
        }
    }

    private SurvivorshipRule findRuleForAttribute(String attribute, List<SurvivorshipRule> rules) {
        if (rules == null) return null;
        return rules.stream()
                .filter(r -> r.getAttributeName().equals(attribute) && Boolean.TRUE.equals(r.getIsActive()))
                .min(Comparator.comparingInt(SurvivorshipRule::getPriority))
                .orElse(null);
    }

    private double calculateOverallConfidence(Map<String, GoldenRecord.GoldenAttribute> attributes) {
        return attributes.values().stream()
                .filter(a -> a.getConfidenceScore() != null)
                .mapToDouble(GoldenRecord.GoldenAttribute::getConfidenceScore)
                .average().orElse(0.0);
    }

    private double calculateCompleteness(Map<String, GoldenRecord.GoldenAttribute> attributes) {
        long nonNull = attributes.values().stream()
                .filter(a -> a.getValue() != null).count();
        return (double) nonNull / Math.max(1, PARTY_ATTRIBUTES.size());
    }

    private double calculateAttributeConfidence(List<GoldenRecord.AttributeCandidate> candidates, Object winner) {
        if (candidates.size() == 1) return 0.7;
        long matching = candidates.stream()
                .filter(c -> Objects.equals(c.getValue(), winner)).count();
        return (double) matching / candidates.size();
    }
}
