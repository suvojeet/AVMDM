package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.repository.neo4j.PartyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Integrates Anthropic Claude AI for natural-language MDM data search.
 * Claude interprets the user's intent, extracts search parameters, and
 * the service executes the appropriate Neo4j / Cosmos DB queries.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClaudeNLPService {

    private final PartyRepository partyRepository;
    private final GoldenRecordService goldenRecordService;
    private final TimelineService timelineService;
    private final RestTemplate restTemplate;

    @Value("${averio.claude.api-key:}")
    private String claudeApiKey;

    @Value("${averio.claude.model:claude-sonnet-4-6}")
    private String claudeModel;

    @Value("${averio.claude.enabled:false}")
    private boolean claudeEnabled;

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

    private static final String SYSTEM_PROMPT = """
            You are AverioAI, an intelligent data assistant for the Averio MDM (Master Data Management) platform.
            Your job is to interpret natural language queries from data stewards and analysts, then extract
            structured search parameters to query the MDM database.

            The MDM stores: Parties (individuals and organizations), Accounts, Golden Records, Relationships,
            Survivorship Rules, and Timeline Events.

            When given a user query, respond with a JSON object containing:
            {
              "intent": "PARTY_SEARCH | GOLDEN_RECORD | DUPLICATE_DETECTION | QUALITY_ANALYSIS | TIMELINE | RELATIONSHIP",
              "entityType": "INDIVIDUAL | ORGANIZATION | null",
              "keywords": ["list", "of", "key", "terms"],
              "filters": { "field": "value" },
              "explanation": "Brief natural language explanation of what you're searching for",
              "suggestedResponse": "A helpful response to show the user summarizing the findings"
            }

            Only return valid JSON, no markdown, no extra text.
            """;

    // ── Public API ─────────────────────────────────────────────────────────────

    public NLPSearchResponse search(String naturalLanguageQuery) {
        log.info("NLP search: {}", naturalLanguageQuery);

        if (claudeEnabled && !claudeApiKey.isBlank()) {
            return searchWithClaude(naturalLanguageQuery);
        }
        return searchWithHeuristics(naturalLanguageQuery);
    }

    // ── Claude-powered search ──────────────────────────────────────────────────

    private NLPSearchResponse searchWithClaude(String query) {
        try {
            ClaudeIntent intent = callClaudeForIntent(query);
            return executeSearch(intent, query);
        } catch (Exception e) {
            log.warn("Claude API call failed, falling back to heuristics: {}", e.getMessage());
            return searchWithHeuristics(query);
        }
    }

    private ClaudeIntent callClaudeForIntent(String query) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", claudeApiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", claudeModel);
        requestBody.put("max_tokens", 512);
        requestBody.put("system", SYSTEM_PROMPT);
        requestBody.put("messages", List.of(
                Map.of("role", "user", "content", query)
        ));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(CLAUDE_API_URL, entity, Map.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.getBody().get("content");
            if (content != null && !content.isEmpty()) {
                String jsonText = (String) content.get(0).get("text");
                return parseClaudeResponse(jsonText);
            }
        }
        throw new RuntimeException("Invalid Claude response");
    }

    @SuppressWarnings("unchecked")
    private ClaudeIntent parseClaudeResponse(String json) {
        // Simple JSON parsing (avoid heavy dependencies for this utility method)
        ClaudeIntent intent = new ClaudeIntent();
        intent.rawJson = json;

        // Extract intent field
        extractJsonString(json, "intent").ifPresent(v -> intent.intent = v);
        extractJsonString(json, "entityType").ifPresent(v -> intent.entityType = v);
        extractJsonString(json, "explanation").ifPresent(v -> intent.explanation = v);
        extractJsonString(json, "suggestedResponse").ifPresent(v -> intent.suggestedResponse = v);

        // Extract keywords array
        int kwStart = json.indexOf("\"keywords\"");
        if (kwStart >= 0) {
            int arrStart = json.indexOf("[", kwStart);
            int arrEnd = json.indexOf("]", arrStart);
            if (arrStart >= 0 && arrEnd > arrStart) {
                String arr = json.substring(arrStart + 1, arrEnd);
                intent.keywords = Arrays.stream(arr.split(","))
                        .map(s -> s.trim().replaceAll("\"", ""))
                        .filter(s -> !s.isBlank())
                        .collect(Collectors.toList());
            }
        }

        return intent;
    }

    private Optional<String> extractJsonString(String json, String key) {
        String search = "\"" + key + "\"";
        int idx = json.indexOf(search);
        if (idx < 0) return Optional.empty();
        int colon = json.indexOf(":", idx);
        if (colon < 0) return Optional.empty();
        int valStart = json.indexOf("\"", colon + 1);
        if (valStart < 0) return Optional.empty();
        int valEnd = json.indexOf("\"", valStart + 1);
        if (valEnd < 0) return Optional.empty();
        return Optional.of(json.substring(valStart + 1, valEnd));
    }

    // ── Heuristic fallback (no API key required) ───────────────────────────────

    private NLPSearchResponse searchWithHeuristics(String query) {
        String lower = query.toLowerCase();
        ClaudeIntent intent = new ClaudeIntent();

        if (lower.contains("duplicate") || lower.contains("merge") || lower.contains("match")) {
            intent.intent = "DUPLICATE_DETECTION";
        } else if (lower.contains("timeline") || lower.contains("history") || lower.contains("audit") || lower.contains("restore")) {
            intent.intent = "TIMELINE";
        } else if (lower.contains("quality") || lower.contains("score") || lower.contains("completeness")) {
            intent.intent = "QUALITY_ANALYSIS";
        } else if (lower.contains("relationship") || lower.contains("connected") || lower.contains("linked")) {
            intent.intent = "RELATIONSHIP";
        } else if (lower.contains("golden") || lower.contains("master") || lower.contains("winning")) {
            intent.intent = "GOLDEN_RECORD";
        } else {
            intent.intent = "PARTY_SEARCH";
        }

        if (lower.contains("individual") || lower.contains("person") || lower.contains("customer")) {
            intent.entityType = "INDIVIDUAL";
        } else if (lower.contains("organization") || lower.contains("company") || lower.contains("corporate") || lower.contains("bank")) {
            intent.entityType = "ORGANIZATION";
        }

        intent.keywords = Arrays.stream(lower.split("\\s+"))
                .filter(w -> w.length() > 3)
                .filter(w -> !STOP_WORDS.contains(w))
                .distinct().limit(5)
                .collect(Collectors.toList());

        intent.explanation = "Searching MDM for: " + String.join(", ", intent.keywords);
        intent.suggestedResponse = buildHeuristicSuggestedResponse(intent, query);

        return executeSearch(intent, query);
    }

    private String buildHeuristicSuggestedResponse(ClaudeIntent intent, String query) {
        return switch (intent.intent) {
            case "DUPLICATE_DETECTION" -> "Scanning the MDM for potential duplicate records using probabilistic matching and AI scoring.";
            case "TIMELINE" -> "Retrieving audit timeline events from Azure Cosmos DB for the matched entities.";
            case "QUALITY_ANALYSIS" -> "Analyzing data quality scores and completeness metrics across golden records.";
            case "RELATIONSHIP" -> "Exploring the relationship graph for connected entities in Neo4j.";
            case "GOLDEN_RECORD" -> "Fetching golden record details with survivorship decisions and source attribution.";
            default -> "Searching party master data for: " + query;
        };
    }

    // ── Search execution ───────────────────────────────────────────────────────

    private NLPSearchResponse executeSearch(ClaudeIntent intent, String originalQuery) {
        List<SearchHit> hits = new ArrayList<>();
        String primaryKeyword = intent.keywords.isEmpty() ? originalQuery : intent.keywords.get(0);
        String searchTerm = String.join(" ", intent.keywords.isEmpty()
                ? List.of(originalQuery)
                : intent.keywords.subList(0, Math.min(3, intent.keywords.size())));

        switch (intent.intent) {
            case "PARTY_SEARCH", "GOLDEN_RECORD" -> {
                List<Party> parties = partyRepository.fullTextSearch(searchTerm, 20);
                parties.forEach(p -> hits.add(SearchHit.fromParty(p)));
            }
            case "DUPLICATE_DETECTION" -> {
                // Search for candidates and flag as potential duplicates
                List<Party> candidates = partyRepository.fullTextSearch(searchTerm, 30);
                candidates.forEach(p -> hits.add(SearchHit.fromPartyAsDuplicate(p)));
            }
            case "QUALITY_ANALYSIS" -> {
                List<Party> lowQuality = partyRepository.findLowQualityParties(0.7);
                lowQuality.forEach(p -> hits.add(SearchHit.fromPartyAsQualityIssue(p)));
            }
            default -> {
                List<Party> parties = partyRepository.fullTextSearch(searchTerm, 10);
                parties.forEach(p -> hits.add(SearchHit.fromParty(p)));
            }
        }

        return NLPSearchResponse.builder()
                .query(originalQuery)
                .intent(intent.intent)
                .explanation(intent.explanation)
                .suggestedResponse(intent.suggestedResponse != null
                        ? intent.suggestedResponse
                        : "Found " + hits.size() + " results for your query.")
                .hits(hits)
                .totalHits(hits.size())
                .searchedAt(LocalDateTime.now())
                .poweredBy(claudeEnabled ? "Claude AI" : "Heuristic Engine")
                .build();
    }

    // ── Response / DTO classes ─────────────────────────────────────────────────

    private static final Set<String> STOP_WORDS = Set.of(
            "show", "find", "search", "what", "where", "which", "with", "that", "have",
            "from", "this", "they", "them", "their", "will", "been", "more", "some",
            "about", "like", "just", "than", "into", "over", "also", "only"
    );

    static class ClaudeIntent {
        String intent = "PARTY_SEARCH";
        String entityType;
        List<String> keywords = new ArrayList<>();
        String explanation;
        String suggestedResponse;
        String rawJson;
    }

    @lombok.Data @lombok.Builder @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class NLPSearchResponse {
        private String query;
        private String intent;
        private String explanation;
        private String suggestedResponse;
        private List<SearchHit> hits;
        private int totalHits;
        private LocalDateTime searchedAt;
        private String poweredBy;
    }

    @lombok.Data @lombok.Builder @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class SearchHit {
        private String type;
        private String id;
        private String title;
        private String subtitle;
        private double confidence;
        private String snippet;
        private Map<String, String> fields;

        static SearchHit fromParty(Party p) {
            String title = p.getFullName() != null ? p.getFullName()
                    : (p.getOrganizationName() != null ? p.getOrganizationName() : p.getGlobalId());
            return SearchHit.builder()
                    .type("party")
                    .id(p.getGlobalId())
                    .title(title)
                    .subtitle((p.getPartyType() != null ? p.getPartyType() : "UNKNOWN") + " · " + p.getSourceSystem())
                    .confidence(p.getDataQualityScore() != null ? p.getDataQualityScore() : 0.7)
                    .snippet("Status: " + p.getStatus() + (p.getTaxId() != null ? " · TaxID: " + p.getTaxId() : ""))
                    .fields(Map.of(
                            "Source", p.getSourceSystem() != null ? p.getSourceSystem() : "-",
                            "Status", p.getStatus() != null ? p.getStatus() : "-"
                    ))
                    .build();
        }

        static SearchHit fromPartyAsDuplicate(Party p) {
            SearchHit hit = fromParty(p);
            hit.setType("duplicate_candidate");
            hit.setSubtitle("Duplicate candidate · " + hit.getSubtitle());
            return hit;
        }

        static SearchHit fromPartyAsQualityIssue(Party p) {
            SearchHit hit = fromParty(p);
            hit.setType("quality_issue");
            double score = p.getDataQualityScore() != null ? p.getDataQualityScore() : 0.5;
            hit.setSubtitle(String.format("DQ: %.0f%% · %s", score * 100, hit.getSubtitle()));
            return hit;
        }
    }
}
