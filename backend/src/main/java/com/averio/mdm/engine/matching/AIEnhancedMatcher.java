package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.azure.ai.openai.OpenAIClient;
import com.azure.ai.openai.models.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnBean(com.azure.ai.openai.OpenAIClient.class)
public class AIEnhancedMatcher {

    private final OpenAIClient openAIClient;

    @Value("${averio.ai.deployment-name:gpt-4}")
    private String deploymentName;

    public MatchingEngine.MatchScore score(Party incoming, Party candidate) {
        try {
            String prompt = buildMatchPrompt(incoming, candidate);

            ChatRequestUserMessage userMessage = new ChatRequestUserMessage(prompt);
            ChatCompletionsOptions options = new ChatCompletionsOptions(List.of(userMessage));
            options.setTemperature(0.1);
            options.setMaxTokens(200);

            ChatCompletions completions = openAIClient.getChatCompletions(deploymentName, options);
            String response = completions.getChoices().get(0).getMessage().getContent();

            double score = parseAIScore(response);
            String explanation = extractExplanation(response);

            log.debug("AI match score for {} vs {}: {}", incoming.getSourceSystemId(), candidate.getSourceSystemId(), score);

            return MatchingEngine.MatchScore.builder()
                    .score(score)
                    .definiteMatch(score >= 0.98)
                    .matchedAttribute(explanation)
                    .build();

        } catch (Exception e) {
            log.warn("AI matching failed, returning neutral score: {}", e.getMessage());
            return MatchingEngine.MatchScore.builder().score(0.5).definiteMatch(false).build();
        }
    }

    private String buildMatchPrompt(Party a, Party b) {
        return String.format("""
            You are an expert in entity resolution for Master Data Management.
            Determine if the following two party records represent the same real-world entity.
            
            Record A:
            - Name: %s %s
            - Organization: %s
            - DOB: %s
            - Tax ID: %s
            - Source: %s
            
            Record B:
            - Name: %s %s
            - Organization: %s
            - DOB: %s
            - Tax ID: %s
            - Source: %s
            
            Respond with ONLY: SCORE:<0.00-1.00>|REASON:<brief explanation>
            Example: SCORE:0.92|REASON:Same person, name variation and same DOB
            """,
                nullStr(a.getFirstName()), nullStr(a.getLastName()),
                nullStr(a.getOrganizationName()), nullStr(a.getDateOfBirth()),
                nullStr(a.getTaxId()), nullStr(a.getSourceSystem()),
                nullStr(b.getFirstName()), nullStr(b.getLastName()),
                nullStr(b.getOrganizationName()), nullStr(b.getDateOfBirth()),
                nullStr(b.getTaxId()), nullStr(b.getSourceSystem())
        );
    }

    private double parseAIScore(String response) {
        try {
            if (response == null) return 0.5;
            int scoreIdx = response.indexOf("SCORE:");
            if (scoreIdx < 0) return 0.5;
            String rest = response.substring(scoreIdx + 6);
            int pipeIdx = rest.indexOf("|");
            String scoreStr = pipeIdx > 0 ? rest.substring(0, pipeIdx) : rest.trim();
            return Math.min(1.0, Math.max(0.0, Double.parseDouble(scoreStr.trim())));
        } catch (Exception e) {
            return 0.5;
        }
    }

    private String extractExplanation(String response) {
        if (response == null) return "AI analysis";
        int reasonIdx = response.indexOf("REASON:");
        if (reasonIdx < 0) return "AI analysis";
        return response.substring(reasonIdx + 7).trim();
    }

    private String nullStr(Object val) {
        return val == null ? "N/A" : val.toString();
    }
}
