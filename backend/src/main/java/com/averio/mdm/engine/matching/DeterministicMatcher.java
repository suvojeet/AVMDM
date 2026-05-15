package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.governance.MatchingRule;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Deterministic Matcher — identifies definite matches using exact identifiers.
 * A definite match on any critical identifier (SSN, Tax ID, DUNS, LEI) means
 * the records are the same entity regardless of other field differences.
 */
@Slf4j
@Component
public class DeterministicMatcher {

    public MatchingEngine.MatchScore score(Party incoming, Party candidate, MatchingRule rule) {
        Map<String, Double> breakdown = new HashMap<>();

        // Critical exact identifiers — any single match = definite match
        if (matchesExact(incoming.getSsn(), candidate.getSsn())) {
            log.debug("Definite match on SSN");
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("SSN")
                    .attributeBreakdown(breakdown).build();
        }

        if (matchesExact(incoming.getTaxId(), candidate.getTaxId())) {
            log.debug("Definite match on Tax ID");
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("TAX_ID")
                    .attributeBreakdown(breakdown).build();
        }

        if (matchesExact(incoming.getEin(), candidate.getEin())) {
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("EIN")
                    .attributeBreakdown(breakdown).build();
        }

        if (matchesExact(incoming.getDunsNumber(), candidate.getDunsNumber())) {
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("DUNS")
                    .attributeBreakdown(breakdown).build();
        }

        if (matchesExact(incoming.getLei(), candidate.getLei())) {
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("LEI")
                    .attributeBreakdown(breakdown).build();
        }

        if (matchesExact(incoming.getPassport(), candidate.getPassport())) {
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("PASSPORT")
                    .attributeBreakdown(breakdown).build();
        }

        if (matchesExact(incoming.getNationalId(), candidate.getNationalId())) {
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("NATIONAL_ID")
                    .attributeBreakdown(breakdown).build();
        }

        // If same source system and source ID → same record
        if (matchesExact(incoming.getSourceSystem(), candidate.getSourceSystem())
                && matchesExact(incoming.getSourceSystemId(), candidate.getSourceSystemId())) {
            return MatchingEngine.MatchScore.builder()
                    .score(1.0).definiteMatch(true).matchedAttribute("SOURCE_SYSTEM_ID")
                    .attributeBreakdown(breakdown).build();
        }

        // No definite match — pass to probabilistic
        return MatchingEngine.MatchScore.builder()
                .score(0.0).definiteMatch(false)
                .attributeBreakdown(breakdown).build();
    }

    private boolean matchesExact(String a, String b) {
        if (StringUtils.isBlank(a) || StringUtils.isBlank(b)) return false;
        return StringUtils.equalsIgnoreCase(normalize(a), normalize(b));
    }

    private String normalize(String value) {
        if (value == null) return null;
        return value.trim().replaceAll("[\\s\\-\\.]+", "").toUpperCase();
    }
}
