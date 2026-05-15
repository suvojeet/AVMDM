package com.averio.mdm.service;

import com.averio.mdm.repository.neo4j.PartyRepository;
import com.azure.ai.openai.OpenAIClient;
import com.azure.ai.openai.models.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AIAssistantService {

    private final OpenAIClient openAIClient;
    private final PartyRepository partyRepository;
    private final SearchService searchService;

    @Value("${averio.ai.deployment-name:gpt-4}")
    private String deploymentName;

    private static final String SYSTEM_PROMPT = """
        You are AverioAI, an intelligent assistant embedded in the Averio MDM Enterprise Master Data Management platform.
        You help data stewards, governance officers, and business users query, understand, and manage master data.
        
        Capabilities:
        - Search for parties, accounts, products by natural language queries
        - Explain data quality scores and golden record confidence
        - Identify potential data issues and suggest remediation
        - Explain relationship graphs and entity hierarchies
        - Provide data governance insights and policy guidance
        - Answer questions about MDM concepts and best practices
        
        When users ask to "find", "show", "search" for data entities, format your response clearly.
        Always be concise, professional, and accurate.
        """;

    public String chat(String userMessage, List<Map<String, String>> conversationHistory) {
        try {
            List<ChatRequestMessage> messages = new ArrayList<>();
            messages.add(new ChatRequestSystemMessage(SYSTEM_PROMPT));

            if (conversationHistory != null) {
                for (Map<String, String> msg : conversationHistory) {
                    if ("user".equals(msg.get("role"))) {
                        messages.add(new ChatRequestUserMessage(msg.get("content")));
                    } else if ("assistant".equals(msg.get("role"))) {
                        messages.add(new ChatRequestAssistantMessage(msg.get("content")));
                    }
                }
            }

            messages.add(new ChatRequestUserMessage(enrichWithContext(userMessage)));

            ChatCompletionsOptions options = new ChatCompletionsOptions(messages);
            options.setTemperature(0.7);
            options.setMaxTokens(1000);

            ChatCompletions completions = openAIClient.getChatCompletions(deploymentName, options);
            return completions.getChoices().get(0).getMessage().getContent();

        } catch (Exception e) {
            log.error("AI chat error: {}", e.getMessage());
            return "I apologize, I am temporarily unavailable. Please try again. (" + e.getMessage() + ")";
        }
    }

    public Map<String, Object> analyzeDataQuality(String entityId) {
        try {
            var party = partyRepository.findByGlobalId(entityId);
            if (party.isEmpty()) return Map.of("error", "Entity not found");

            String prompt = String.format("""
                Analyze the data quality of this party record and provide specific recommendations:
                Party: %s %s
                Organization: %s
                DOB: %s
                Tax ID: %s
                Status: %s
                Source: %s
                Quality Score: %s
                Completeness: %s
                
                Provide: 1) Overall assessment 2) Top 3 issues 3) Recommendations
                Format as JSON: {"assessment": "", "issues": [], "recommendations": [], "qualityScore": 0.0}
                """,
                    party.get().getFirstName(), party.get().getLastName(),
                    party.get().getOrganizationName(), party.get().getDateOfBirth(),
                    party.get().getTaxId(), party.get().getStatus(), party.get().getSourceSystem(),
                    party.get().getDataQualityScore(), party.get().getCompletenessScore()
            );

            List<ChatRequestMessage> msgs = List.of(
                    new ChatRequestSystemMessage("You are a data quality expert. Respond ONLY with valid JSON."),
                    new ChatRequestUserMessage(prompt)
            );
            ChatCompletionsOptions opts = new ChatCompletionsOptions(msgs);
            opts.setTemperature(0.2);
            opts.setMaxTokens(500);
            ChatCompletions resp = openAIClient.getChatCompletions(deploymentName, opts);
            String json = resp.getChoices().get(0).getMessage().getContent();
            return Map.of("analysis", json, "entityId", entityId);

        } catch (Exception e) {
            log.error("Data quality analysis error: {}", e.getMessage());
            return Map.of("error", e.getMessage());
        }
    }

    public List<Map<String, Object>> getMatchRecommendations(String goldenRecordId) {
        List<Map<String, Object>> recommendations = new ArrayList<>();
        var sources = partyRepository.findSourceRecordsByGoldenId(goldenRecordId);
        recommendations.add(Map.of(
                "type", "SOURCE_COUNT",
                "message", "Golden record has " + sources.size() + " contributing source records",
                "priority", sources.size() > 5 ? "HIGH" : "LOW"
        ));
        return recommendations;
    }

    private String enrichWithContext(String userMessage) {
        String lowerMsg = userMessage.toLowerCase();
        if (lowerMsg.contains("find") || lowerMsg.contains("search") || lowerMsg.contains("show")) {
            long partyCount = partyRepository.countActiveGoldenParties();
            return userMessage + "\n\n[Context: Platform has " + partyCount + " active golden party records]";
        }
        return userMessage;
    }
}
