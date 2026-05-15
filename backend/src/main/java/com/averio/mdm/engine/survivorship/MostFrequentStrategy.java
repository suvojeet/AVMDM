package com.averio.mdm.engine.survivorship;

import com.averio.mdm.domain.golden.GoldenRecord.AttributeCandidate;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class MostFrequentStrategy {
    public AttributeCandidate select(List<AttributeCandidate> candidates) {
        Map<Object, Long> freq = candidates.stream()
                .filter(c -> c.getValue() != null)
                .collect(Collectors.groupingBy(AttributeCandidate::getValue, Collectors.counting()));
        Object mostFreqValue = freq.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey).orElse(null);
        return candidates.stream()
                .filter(c -> Objects.equals(c.getValue(), mostFreqValue))
                .findFirst().orElse(candidates.get(0));
    }
}
