package com.averio.mdm.engine.survivorship;

import com.averio.mdm.domain.golden.GoldenRecord.AttributeCandidate;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.util.*;

@Component
public class SourcePriorityStrategy {

    /**
     * Select winning candidate using numeric source priorities.
     * Lower priority number = higher precedence. Same priority = most recently updated wins.
     * Falls back to ordered-list logic when sourcePriorities is absent.
     */
    public AttributeCandidate select(List<AttributeCandidate> candidates,
                                     List<String> priorityOrder,
                                     List<Map<String, Object>> sourcePriorities) {
        if (sourcePriorities != null && !sourcePriorities.isEmpty()) {
            return selectByNumericPriority(candidates, sourcePriorities);
        }
        return selectByOrderedList(candidates, priorityOrder);
    }

    // Legacy overload — keeps existing callers compiling without changes
    public AttributeCandidate select(List<AttributeCandidate> candidates, List<String> priorityOrder) {
        return selectByOrderedList(candidates, priorityOrder);
    }

    private AttributeCandidate selectByNumericPriority(List<AttributeCandidate> candidates,
                                                        List<Map<String, Object>> sourcePriorities) {
        Map<String, Integer> priorityMap = new HashMap<>();
        for (Map<String, Object> entry : sourcePriorities) {
            Object src = entry.get("source");
            Object pri = entry.get("priority");
            if (src != null) {
                int p = pri instanceof Number ? ((Number) pri).intValue() : Integer.MAX_VALUE;
                priorityMap.put(src.toString(), p);
            }
        }

        // Group non-null candidates by their assigned priority number
        TreeMap<Integer, List<AttributeCandidate>> grouped = new TreeMap<>();
        for (AttributeCandidate c : candidates) {
            if (c.getValue() == null) continue;
            int pri = priorityMap.getOrDefault(c.getSourceSystem(), Integer.MAX_VALUE);
            grouped.computeIfAbsent(pri, k -> new ArrayList<>()).add(c);
        }

        if (grouped.isEmpty()) {
            return candidates.stream()
                    .filter(c -> c.getValue() != null)
                    .findFirst().orElse(candidates.get(0));
        }

        List<AttributeCandidate> topGroup = grouped.firstEntry().getValue();
        if (topGroup.size() == 1) return topGroup.get(0);

        // Tie-break within the same priority level: most recently updated wins
        return topGroup.stream()
                .max(Comparator.comparing(
                        c -> c.getSourceTimestamp() != null ? c.getSourceTimestamp() : LocalDateTime.MIN
                ))
                .orElse(topGroup.get(0));
    }

    private AttributeCandidate selectByOrderedList(List<AttributeCandidate> candidates,
                                                    List<String> priorityOrder) {
        if (priorityOrder == null || priorityOrder.isEmpty()) {
            return candidates.stream().filter(c -> c.getValue() != null).findFirst().orElse(candidates.get(0));
        }
        for (String source : priorityOrder) {
            AttributeCandidate winner = candidates.stream()
                    .filter(c -> source.equals(c.getSourceSystem()) && c.getValue() != null)
                    .findFirst().orElse(null);
            if (winner != null) return winner;
        }
        return candidates.stream().filter(c -> c.getValue() != null).findFirst().orElse(candidates.get(0));
    }
}
