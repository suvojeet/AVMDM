package com.averio.mdm.engine.survivorship;

import com.averio.mdm.domain.golden.GoldenRecord.AttributeCandidate;
import org.springframework.stereotype.Component;
import java.util.Comparator;
import java.util.List;

@Component
public class MostRecentStrategy {
    public AttributeCandidate select(List<AttributeCandidate> candidates) {
        return candidates.stream()
                .filter(c -> c.getValue() != null && c.getSourceTimestamp() != null)
                .max(Comparator.comparing(AttributeCandidate::getSourceTimestamp))
                .orElse(candidates.stream().filter(c -> c.getValue() != null).findFirst()
                        .orElse(candidates.get(0)));
    }
}
