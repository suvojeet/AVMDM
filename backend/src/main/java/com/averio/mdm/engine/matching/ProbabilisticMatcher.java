package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.governance.MatchingRule;
import info.debatty.java.stringsimilarity.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.language.Soundex;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Component
public class ProbabilisticMatcher {

    private final JaroWinkler jaroWinkler = new JaroWinkler();
    private final Levenshtein levenshtein = new Levenshtein();
    private final Soundex soundex = new Soundex();

    private static final Map<String, Double> DEFAULT_WEIGHTS = Map.of(
            "firstName", 0.15,
            "lastName", 0.20,
            "dateOfBirth", 0.20,
            "postalCode", 0.10,
            "organizationName", 0.25,
            "taxId", 0.30,
            "email", 0.15,
            "phone", 0.10
    );

    public MatchingEngine.MatchScore score(Party incoming, Party candidate, MatchingRule rule) {
        Map<String, Double> breakdown = new HashMap<>();
        double totalWeight = 0.0;
        double weightedScore = 0.0;

        // First name
        double fnScore = scoreString(incoming.getFirstName(), candidate.getFirstName(), "JARO_WINKLER");
        double fnWeight = getWeight("firstName", rule);
        breakdown.put("firstName", fnScore);
        weightedScore += fnScore * fnWeight;
        totalWeight += fnWeight;

        // Last name
        double lnScore = scoreString(incoming.getLastName(), candidate.getLastName(), "JARO_WINKLER");
        double lnWeight = getWeight("lastName", rule);
        breakdown.put("lastName", lnScore);
        weightedScore += lnScore * lnWeight;
        totalWeight += lnWeight;

        // Organization name
        if (StringUtils.isNotBlank(incoming.getOrganizationName())) {
            double orgScore = scoreString(incoming.getOrganizationName(), candidate.getOrganizationName(), "JARO_WINKLER");
            double orgWeight = getWeight("organizationName", rule);
            breakdown.put("organizationName", orgScore);
            weightedScore += orgScore * orgWeight;
            totalWeight += orgWeight;
        }

        // Date of birth — exact match worth high score
        if (incoming.getDateOfBirth() != null && candidate.getDateOfBirth() != null) {
            double dobScore = incoming.getDateOfBirth().equals(candidate.getDateOfBirth()) ? 1.0 : 0.0;
            if (dobScore == 0.0) {
                dobScore = partialDobScore(incoming.getDateOfBirth(), candidate.getDateOfBirth());
            }
            double dobWeight = getWeight("dateOfBirth", rule);
            breakdown.put("dateOfBirth", dobScore);
            weightedScore += dobScore * dobWeight;
            totalWeight += dobWeight;
        }

        // Email matching
        double emailScore = scoreEmailMap(incoming.getEmails(), candidate.getEmails());
        if (emailScore >= 0) {
            breakdown.put("email", emailScore);
            double emailWeight = getWeight("email", rule);
            weightedScore += emailScore * emailWeight;
            totalWeight += emailWeight;
        }

        // Phone matching
        double phoneScore = scorePhoneMap(incoming.getPhones(), candidate.getPhones());
        if (phoneScore >= 0) {
            breakdown.put("phone", phoneScore);
            double phoneWeight = getWeight("phone", rule);
            weightedScore += phoneScore * phoneWeight;
            totalWeight += phoneWeight;
        }

        // Phonetic match on name for additional boost
        double phoneticBoost = phoneticNameBoost(incoming, candidate);
        weightedScore += phoneticBoost * 0.05;

        double finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0.0;
        finalScore = Math.min(1.0, finalScore + phoneticBoost * 0.05);

        return MatchingEngine.MatchScore.builder()
                .score(finalScore)
                .definiteMatch(false)
                .attributeBreakdown(breakdown)
                .build();
    }

    private double scoreString(String a, String b, String algorithm) {
        if (StringUtils.isBlank(a) || StringUtils.isBlank(b)) return 0.0;
        String normA = normalize(a);
        String normB = normalize(b);
        if (normA.equals(normB)) return 1.0;
        return switch (algorithm) {
            case "JARO_WINKLER" -> jaroWinkler.similarity(normA, normB);
            case "LEVENSHTEIN" -> {
                int maxLen = Math.max(normA.length(), normB.length());
                if (maxLen == 0) yield 1.0;
                yield 1.0 - (levenshtein.distance(normA, normB) / (double) maxLen);
            }
            default -> normA.equals(normB) ? 1.0 : 0.0;
        };
    }

    private double partialDobScore(LocalDate a, LocalDate b) {
        int matches = 0;
        if (a.getYear() == b.getYear()) matches++;
        if (a.getMonthValue() == b.getMonthValue()) matches++;
        if (a.getDayOfMonth() == b.getDayOfMonth()) matches++;
        return matches / 3.0 * 0.7;
    }

    private double scoreEmailMap(Map<String, String> emailsA, Map<String, String> emailsB) {
        if (emailsA == null || emailsB == null || emailsA.isEmpty() || emailsB.isEmpty()) return -1;
        for (String ea : emailsA.values()) {
            for (String eb : emailsB.values()) {
                if (StringUtils.equalsIgnoreCase(ea, eb)) return 1.0;
                String domainA = getDomain(ea);
                String domainB = getDomain(eb);
                if (StringUtils.equalsIgnoreCase(domainA, domainB)) return 0.4;
            }
        }
        return 0.0;
    }

    private double scorePhoneMap(Map<String, String> phonesA, Map<String, String> phonesB) {
        if (phonesA == null || phonesB == null || phonesA.isEmpty() || phonesB.isEmpty()) return -1;
        for (String pa : phonesA.values()) {
            for (String pb : phonesB.values()) {
                String normA = pa.replaceAll("[^0-9]", "");
                String normB = pb.replaceAll("[^0-9]", "");
                if (normA.length() >= 10 && normB.length() >= 10) {
                    String last10A = normA.substring(normA.length() - 10);
                    String last10B = normB.substring(normB.length() - 10);
                    if (last10A.equals(last10B)) return 1.0;
                }
            }
        }
        return 0.0;
    }

    private double phoneticNameBoost(Party a, Party b) {
        try {
            if (StringUtils.isBlank(a.getLastName()) || StringUtils.isBlank(b.getLastName())) return 0.0;
            String codeA = soundex.encode(a.getLastName());
            String codeB = soundex.encode(b.getLastName());
            return codeA != null && codeA.equals(codeB) ? 0.5 : 0.0;
        } catch (Exception e) {
            return 0.0;
        }
    }

    private double getWeight(String attribute, MatchingRule rule) {
        if (rule != null && rule.getWeights() != null) {
            return rule.getWeights().stream()
                    .filter(w -> w.getAttributeName().equals(attribute))
                    .findFirst()
                    .map(MatchingRule.MatchWeight::getWeight)
                    .orElse(DEFAULT_WEIGHTS.getOrDefault(attribute, 0.05));
        }
        return DEFAULT_WEIGHTS.getOrDefault(attribute, 0.05);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase().replaceAll("[\\s\\-\\.]+", "");
    }

    private String getDomain(String email) {
        if (email == null || !email.contains("@")) return "";
        return email.substring(email.indexOf("@") + 1).toLowerCase();
    }
}
