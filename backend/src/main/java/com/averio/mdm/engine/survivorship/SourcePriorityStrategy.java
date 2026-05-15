package com.averio.mdm.engine.survivorship;

import com.averio.mdm.domain.golden.GoldenRecord.AttributeCandidate;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class SourcePriorityStrategy {
    public AttributeCandidate select(List<AttributeCandidate> candidates, List<String> priorityOrder) {
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
