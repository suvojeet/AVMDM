package com.averio.mdm.engine.survivorship;

import com.averio.mdm.domain.entity.Address;
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

    // Completeness denominators split by party type so N/A fields don't penalise a record.
    private static final List<String> INDIVIDUAL_ATTRIBUTES = List.of(
            "firstName", "lastName", "fullName", "dateOfBirth",
            "gender", "nationality", "taxId", "ssn", "status"
    );
    private static final List<String> ORGANIZATION_ATTRIBUTES = List.of(
            "organizationName", "legalName", "taxId",
            "dunsNumber", "lei", "status"
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

        // Also process any rule-defined attributes not in the default scalar list
        // (e.g., identifiers.ssn, addresses.primary.city)
        if (rules != null) {
            rules.stream()
                .filter(r -> Boolean.TRUE.equals(r.getIsActive()) && r.getAttributeName() != null)
                .map(SurvivorshipRule::getAttributeName)
                .filter(attr -> !PARTY_ATTRIBUTES.contains(attr))
                .distinct()
                .forEach(attribute -> {
                    SurvivorshipRule rule = findRuleForAttribute(attribute, rules);
                    GoldenRecord.GoldenAttribute golden = applyRule(attribute, sourceParties, rule);
                    if (golden != null) {
                        goldenAttributes.put(attribute, golden);
                    }
                });
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
                var winner = sourcePriorityStrategy.select(candidates, rule.getSourceSystemPriority(), rule.getSourcePriorities());
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
        if (attribute.startsWith("identifiers.")) {
            return getIdentifierValue(party, attribute.substring("identifiers.".length()));
        }
        if (attribute.startsWith("addresses.")) {
            return getAddressValue(party, attribute.substring("addresses.".length()));
        }
        try {
            Field field = Party.class.getDeclaredField(attribute);
            field.setAccessible(true);
            return field.get(party);
        } catch (Exception e) {
            return null;
        }
    }

    private Object getIdentifierValue(Party party, String subField) {
        return switch (subField.toLowerCase()) {
            case "ssn"            -> party.getSsn();
            case "passport"       -> party.getPassport();
            case "driverslicense" -> party.getDriversLicense();
            case "nationalid"     -> party.getNationalId();
            default -> {
                if (party.getIdentifiers() == null) yield null;
                yield party.getIdentifiers().stream()
                    .filter(id -> subField.equalsIgnoreCase(id.get("type")))
                    .map(id -> id.get("value"))
                    .findFirst().orElse(null);
            }
        };
    }

    private Object getAddressValue(Party party, String subPath) {
        List<Address> addresses = party.getAddresses();
        if (addresses == null || addresses.isEmpty()) return null;
        Address address;
        String fieldName;

        if (subPath.startsWith("primary.")) {
            address = resolvePrimaryAddress(addresses);
            fieldName = subPath.substring("primary.".length());
        } else if (subPath.equals("primary")) {
            address = resolvePrimaryAddress(addresses);
            return address == null ? null : formatAddress(address);
        } else {
            address = addresses.stream().filter(a -> a.getEndDate() == null).findFirst().orElse(null);
            fieldName = subPath;
        }

        if (address == null) return null;
        try {
            Field field = Address.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            return field.get(address);
        } catch (Exception e) {
            return null;
        }
    }

    private Address resolvePrimaryAddress(List<Address> addresses) {
        return addresses.stream()
            .filter(a -> a.getEndDate() == null)
            .filter(a -> Boolean.TRUE.equals(a.getIsPrimary()) || "PRIMARY".equalsIgnoreCase(a.getAddressType()))
            .findFirst()
            .orElseGet(() -> addresses.stream().filter(a -> a.getEndDate() == null).findFirst().orElse(null));
    }

    private String formatAddress(Address addr) {
        return java.util.stream.Stream.of(
                addr.getLine1(), addr.getCity(), addr.getStateProvince(),
                addr.getPostalCode(), addr.getCountry())
            .filter(s -> s != null && !s.isBlank())
            .collect(Collectors.joining(", "));
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
        // Determine which attribute list applies based on the presence of org vs individual fields
        boolean isOrg = attributes.containsKey("organizationName") || attributes.containsKey("legalName")
                     || attributes.containsKey("dunsNumber") || attributes.containsKey("lei");
        boolean isIndividual = attributes.containsKey("firstName") || attributes.containsKey("lastName")
                            || attributes.containsKey("dateOfBirth") || attributes.containsKey("ssn");

        List<String> relevantFields;
        if (isOrg && !isIndividual) {
            relevantFields = ORGANIZATION_ATTRIBUTES;
        } else if (isIndividual && !isOrg) {
            relevantFields = INDIVIDUAL_ATTRIBUTES;
        } else {
            // Mixed or unknown — fall back to full list
            relevantFields = PARTY_ATTRIBUTES;
        }

        long populated = relevantFields.stream()
                .filter(f -> attributes.containsKey(f) && attributes.get(f).getValue() != null)
                .count();
        return (double) populated / relevantFields.size();
    }

    private double calculateAttributeConfidence(List<GoldenRecord.AttributeCandidate> candidates, Object winner) {
        if (candidates.size() == 1) return 0.7;
        long matching = candidates.stream()
                .filter(c -> Objects.equals(c.getValue(), winner)).count();
        return (double) matching / candidates.size();
    }
}
