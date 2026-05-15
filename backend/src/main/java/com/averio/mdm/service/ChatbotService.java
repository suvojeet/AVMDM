package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.domain.steward.StewardTask;
import com.averio.mdm.domain.timeline.TimelineEvent;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AverioAI Chatbot — Claude-powered conversational interface to the MDM system.
 * Uses Anthropic Claude with native tool use so the AI can query real MDM data
 * (parties, golden records, timelines, steward queue, platform stats) on demand.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final PartyRepository partyRepository;
    private final GoldenRecordService goldenRecordService;
    private final TimelineService timelineService;
    private final StewardService stewardService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${averio.claude.api-key:}")
    private String claudeApiKey;

    @Value("${averio.claude.model:claude-sonnet-4-6}")
    private String claudeModel;

    @Value("${averio.claude.enabled:false}")
    private boolean claudeEnabled;

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
    private static final int MAX_TOOL_ROUNDS = 6;

    private static final String SYSTEM_PROMPT = """
            You are AverioAI, the intelligent conversational assistant built into the Averio MDM Enterprise Master Data Management platform.
            You help data stewards, governance officers, data analysts, and business users interact with master data through natural language.

            You have access to real-time MDM system tools. Always use them when users ask about specific data — never make up counts, names, or IDs.
            If a user asks about a specific party, golden record, or timeline, call the appropriate tool to retrieve actual data.

            Available data domains:
            - Party Master: Individuals, Organizations, Employees, Households
            - Golden Records: Survivorship decisions, source attribution, confidence scores
            - Timelines: Full audit history, attribute changes, restores
            - Data Quality: Quality scores, completeness, accuracy metrics
            - Steward Queue: Pending merge approvals, data issue tasks, escalations
            - Platform Stats: Counts, health metrics, compliance status

            Response guidelines:
            - Use clear markdown formatting; use tables for multiple records
            - Always include globalId when referencing a specific party (e.g. `GLD-00001`)
            - Flag data quality issues clearly with percentage scores
            - When results are empty, say so clearly and suggest alternatives
            - Be professional, concise, and accurate
            - If asked to perform a write action (merge, approve, etc.) explain that actions require the Steward Console UI
            """;

    // ── Public API ─────────────────────────────────────────────────────────────

    public ChatbotResponse chat(String userMessage, List<Map<String, String>> history) {
        if (!claudeEnabled || claudeApiKey.isBlank()) {
            return ChatbotResponse.builder()
                    .reply("AverioAI Chatbot requires Claude AI to be configured. " +
                            "Set `CLAUDE_ENABLED=true` and `CLAUDE_API_KEY` in your environment.")
                    .toolCalls(List.of())
                    .model("unconfigured")
                    .build();
        }
        return chatWithClaude(userMessage, history);
    }

    // ── Claude Agentic Tool-Use Loop ───────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private ChatbotResponse chatWithClaude(String userMessage, List<Map<String, String>> history) {
        try {
            List<Object> messages = new ArrayList<>();

            if (history != null) {
                for (Map<String, String> msg : history) {
                    messages.add(Map.of("role", msg.get("role"), "content", msg.get("content")));
                }
            }
            messages.add(Map.of("role", "user", "content", userMessage));

            List<ToolCallRecord> allToolCalls = new ArrayList<>();
            String finalReply = "";
            int rounds = 0;

            while (rounds < MAX_TOOL_ROUNDS) {
                rounds++;
                Map<String, Object> response = callClaudeAPI(messages);

                String stopReason = (String) response.get("stop_reason");
                List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");

                StringBuilder textBuffer = new StringBuilder();
                List<Map<String, Object>> toolUseBlocks = new ArrayList<>();

                for (Map<String, Object> block : content) {
                    String type = (String) block.get("type");
                    if ("text".equals(type)) {
                        String text = (String) block.get("text");
                        if (text != null) textBuffer.append(text);
                    } else if ("tool_use".equals(type)) {
                        toolUseBlocks.add(block);
                    }
                }

                finalReply = textBuffer.toString();

                if (toolUseBlocks.isEmpty() || "end_turn".equals(stopReason)) {
                    break;
                }

                // Preserve the assistant's full content block (tool use + text) in history
                messages.add(Map.of("role", "assistant", "content", content));

                // Execute each tool call and collect results
                List<Map<String, Object>> toolResults = new ArrayList<>();
                for (Map<String, Object> toolUse : toolUseBlocks) {
                    String toolId   = (String) toolUse.get("id");
                    String toolName = (String) toolUse.get("name");
                    Map<String, Object> input = toolUse.containsKey("input")
                            ? (Map<String, Object>) toolUse.get("input")
                            : Map.of();

                    ToolExecutionResult execResult = executeTool(toolName, input);
                    allToolCalls.add(ToolCallRecord.builder()
                            .id(toolId)
                            .tool(toolName)
                            .input(input)
                            .result(execResult.data())
                            .displayType(execResult.displayType())
                            .build());

                    toolResults.add(Map.of(
                            "type", "tool_result",
                            "tool_use_id", toolId,
                            "content", execResult.jsonSummary()
                    ));
                }

                messages.add(Map.of("role", "user", "content", toolResults));
            }

            return ChatbotResponse.builder()
                    .reply(finalReply.isBlank() ? "I processed your request." : finalReply)
                    .toolCalls(allToolCalls)
                    .model(claudeModel)
                    .build();

        } catch (Exception e) {
            log.error("Chatbot error: {}", e.getMessage(), e);
            return ChatbotResponse.builder()
                    .reply("I encountered an error: " + e.getMessage() + ". Please try again.")
                    .toolCalls(List.of())
                    .model(claudeModel)
                    .build();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> callClaudeAPI(List<Object> messages) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", claudeApiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", claudeModel);
        body.put("max_tokens", 4096);
        body.put("system", SYSTEM_PROMPT);
        body.put("messages", messages);
        body.put("tools", buildToolDefinitions());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(CLAUDE_API_URL, entity, Map.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Claude API returned " + response.getStatusCode());
        }
        return response.getBody();
    }

    // ── Tool Execution Dispatcher ──────────────────────────────────────────────

    private ToolExecutionResult executeTool(String toolName, Map<String, Object> input) {
        log.info("Executing tool: {} with input keys: {}", toolName, input.keySet());
        try {
            return switch (toolName) {
                case "search_parties"       -> toolSearchParties(input);
                case "get_party"            -> toolGetParty(input);
                case "get_golden_record"    -> toolGetGoldenRecord(input);
                case "get_timeline"         -> toolGetTimeline(input);
                case "get_low_quality_parties" -> toolGetLowQualityParties(input);
                case "get_steward_queue"    -> toolGetStewardQueue(input);
                case "get_platform_stats"   -> toolGetPlatformStats();
                case "get_source_records"   -> toolGetSourceRecords(input);
                default -> errorResult("Unknown tool: " + toolName);
            };
        } catch (Exception e) {
            log.error("Tool {} failed: {}", toolName, e.getMessage());
            return errorResult(e.getMessage());
        }
    }

    // ── Individual Tool Implementations ───────────────────────────────────────

    private ToolExecutionResult toolSearchParties(Map<String, Object> input) {
        String query     = (String) input.getOrDefault("query", "");
        int limit        = getInt(input, "limit", 10);
        String partyType = (String) input.get("party_type");

        List<Party> parties = partyRepository.fullTextSearch(query, Math.min(limit, 25));
        if (partyType != null) {
            parties = parties.stream()
                    .filter(p -> partyType.equals(p.getPartyType()))
                    .collect(Collectors.toList());
        }

        List<Map<String, Object>> results = parties.stream().map(this::partyToMap).collect(Collectors.toList());
        Map<String, Object> data = Map.of("parties", results, "count", results.size(), "query", query);
        return toResult(data, "PARTY_LIST");
    }

    private ToolExecutionResult toolGetParty(Map<String, Object> input) {
        String partyId = (String) input.get("party_id");
        if (partyId == null || partyId.isBlank()) return errorResult("party_id is required");

        Optional<Party> party = partyRepository.findByGlobalId(partyId);
        if (party.isEmpty()) return toResult(Map.of("error", "Party not found: " + partyId), "ERROR");

        Map<String, Object> data = Map.of("party", partyToMapFull(party.get()));
        return toResult(data, "PARTY_DETAIL");
    }

    private ToolExecutionResult toolGetGoldenRecord(Map<String, Object> input) {
        String partyId = (String) input.get("party_id");
        if (partyId == null || partyId.isBlank()) return errorResult("party_id is required");

        // The ID might be a globalId or goldenRecordId — try both
        GoldenRecord golden = goldenRecordService.getGoldenRecord(partyId);
        if (golden == null) {
            Optional<Party> party = partyRepository.findByGlobalId(partyId);
            if (party.isPresent() && party.get().getGoldenRecordId() != null) {
                golden = goldenRecordService.getGoldenRecord(party.get().getGoldenRecordId());
            }
        }
        if (golden == null) {
            return toResult(Map.of("error", "Golden record not found for: " + partyId), "ERROR");
        }

        Map<String, Object> data = goldenToMap(golden);
        return toResult(Map.of("goldenRecord", data), "GOLDEN_RECORD");
    }

    private ToolExecutionResult toolGetTimeline(Map<String, Object> input) {
        String partyId = (String) input.get("party_id");
        if (partyId == null || partyId.isBlank()) return errorResult("party_id is required");
        int limit = getInt(input, "limit", 10);

        // Resolve globalId → goldenRecordId for timeline lookups
        String entityId = partyId;
        Optional<Party> party = partyRepository.findByGlobalId(partyId);
        if (party.isPresent() && party.get().getGoldenRecordId() != null) {
            entityId = party.get().getGoldenRecordId();
        }

        List<TimelineEvent> events = timelineService.getEntityTimeline(entityId);
        List<Map<String, Object>> eventsData = events.stream()
                .limit(limit)
                .map(this::eventToMap)
                .collect(Collectors.toList());

        Map<String, Object> data = Map.of("events", eventsData, "count", eventsData.size(), "partyId", partyId);
        return toResult(data, "TIMELINE");
    }

    private ToolExecutionResult toolGetLowQualityParties(Map<String, Object> input) {
        double threshold = getDouble(input, "threshold", 0.7);
        int limit        = getInt(input, "limit", 20);

        List<Party> parties = partyRepository.findLowQualityParties(threshold);
        List<Map<String, Object>> results = parties.stream()
                .limit(limit)
                .map(this::partyToMap)
                .collect(Collectors.toList());

        Map<String, Object> data = Map.of(
                "parties", results,
                "count", results.size(),
                "threshold", threshold
        );
        return toResult(data, "PARTY_LIST");
    }

    private ToolExecutionResult toolGetStewardQueue(Map<String, Object> input) {
        String priority = (String) input.get("priority");
        List<StewardTask> tasks = stewardService.getOpenTasks(priority);
        Map<String, Object> summary = stewardService.getWorkQueueSummary();

        List<Map<String, Object>> taskData = tasks.stream()
                .limit(20)
                .map(this::taskToMap)
                .collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("tasks", taskData);
        data.put("count", taskData.size());
        data.put("summary", summary);
        return toResult(data, "STEWARD_QUEUE");
    }

    private ToolExecutionResult toolGetPlatformStats() {
        Map<String, Object> summary = stewardService.getWorkQueueSummary();
        long goldenCount = partyRepository.countActiveGoldenParties();
        List<Party> lowQuality = partyRepository.findLowQualityParties(0.7);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("activeGoldenRecords", goldenCount);
        data.put("lowQualityParties", lowQuality.size());
        data.put("stewardQueue", summary);
        return toResult(data, "PLATFORM_STATS");
    }

    private ToolExecutionResult toolGetSourceRecords(Map<String, Object> input) {
        String goldenId = (String) input.get("golden_id");
        if (goldenId == null || goldenId.isBlank()) return errorResult("golden_id is required");

        List<Party> sources = partyRepository.findSourceRecordsByGoldenId(goldenId);
        List<Map<String, Object>> results = sources.stream().map(this::partyToMap).collect(Collectors.toList());
        Map<String, Object> data = Map.of("sources", results, "count", results.size(), "goldenId", goldenId);
        return toResult(data, "PARTY_LIST");
    }

    // ── Tool Definition Payload ────────────────────────────────────────────────

    private List<Map<String, Object>> buildToolDefinitions() {
        return List.of(
                tool("search_parties",
                        "Search party master records by name, organization name, or keyword. Returns matching parties with quality scores and IDs.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "query", Map.of("type", "string", "description", "Name, organization, or keyword to search"),
                                        "party_type", Map.of("type", "string", "enum", List.of("INDIVIDUAL", "ORGANIZATION"), "description", "Optional: filter by party type"),
                                        "limit", Map.of("type", "integer", "description", "Max results (default 10, max 25)")
                                ),
                                "required", List.of("query")
                        )
                ),
                tool("get_party",
                        "Retrieve complete details for a specific party by globalId (e.g. GLD-00001).",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "party_id", Map.of("type", "string", "description", "The party's globalId")
                                ),
                                "required", List.of("party_id")
                        )
                ),
                tool("get_golden_record",
                        "Get the golden (master) record for a party — shows survivorship decisions, contributing sources, and confidence scores.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "party_id", Map.of("type", "string", "description", "The party globalId or goldenRecordId")
                                ),
                                "required", List.of("party_id")
                        )
                ),
                tool("get_timeline",
                        "Retrieve the audit timeline and event history for a party entity.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "party_id", Map.of("type", "string", "description", "The party globalId"),
                                        "limit", Map.of("type", "integer", "description", "Max events to return (default 10)")
                                ),
                                "required", List.of("party_id")
                        )
                ),
                tool("get_low_quality_parties",
                        "Find golden party records with data quality scores below a given threshold.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "threshold", Map.of("type", "number", "description", "Quality score 0.0–1.0 (default 0.7 = below 70%)"),
                                        "limit", Map.of("type", "integer", "description", "Max results (default 20)")
                                ),
                                "required", List.of()
                        )
                ),
                tool("get_steward_queue",
                        "Retrieve the data steward work queue — pending merge approvals, data quality issues, and escalated tasks.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "priority", Map.of("type", "string", "enum", List.of("CRITICAL", "HIGH", "MEDIUM", "LOW"),
                                                "description", "Optional: filter by priority level")
                                ),
                                "required", List.of()
                        )
                ),
                tool("get_platform_stats",
                        "Get overall MDM platform health metrics: golden record counts, data quality summary, steward queue summary.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(),
                                "required", List.of()
                        )
                ),
                tool("get_source_records",
                        "Get the contributing source records that form a specific golden record.",
                        Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "golden_id", Map.of("type", "string", "description", "The goldenRecordId")
                                ),
                                "required", List.of("golden_id")
                        )
                )
        );
    }

    private Map<String, Object> tool(String name, String description, Map<String, Object> schema) {
        return Map.of("name", name, "description", description, "input_schema", schema);
    }

    // ── Entity → Map Helpers ───────────────────────────────────────────────────

    private Map<String, Object> partyToMap(Party p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("globalId", p.getGlobalId());
        m.put("name", displayName(p));
        m.put("partyType", p.getPartyType());
        m.put("status", p.getStatus());
        m.put("sourceSystem", p.getSourceSystem());
        m.put("dataQualityScore", p.getDataQualityScore());
        m.put("completenessScore", p.getCompletenessScore());
        m.put("goldenRecordId", p.getGoldenRecordId());
        m.put("isGolden", p.getIsGolden());
        return m;
    }

    private Map<String, Object> partyToMapFull(Party p) {
        Map<String, Object> m = partyToMap(p);
        m.put("firstName", p.getFirstName());
        m.put("lastName", p.getLastName());
        m.put("organizationName", p.getOrganizationName());
        m.put("taxId", p.getTaxId());
        m.put("dateOfBirth", p.getDateOfBirth() != null ? p.getDateOfBirth().toString() : null);
        m.put("nationality", p.getNationality());
        m.put("createdAt", p.getCreatedAt() != null ? p.getCreatedAt().toString() : null);
        m.put("updatedAt", p.getUpdatedAt() != null ? p.getUpdatedAt().toString() : null);
        m.put("matchScore", p.getMatchScore());
        m.put("confidenceScore", p.getConfidenceScore());
        return m;
    }

    private Map<String, Object> goldenToMap(GoldenRecord g) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("goldenRecordId", g.getGoldenRecordId());
        m.put("entityType", g.getEntityType());
        m.put("overallConfidenceScore", g.getOverallConfidenceScore());
        m.put("dataQualityScore", g.getDataQualityScore());
        m.put("completenessScore", g.getCompletenessScore());
        m.put("sourceRecordCount", g.getSourceRecords() != null ? g.getSourceRecords().size() : 0);
        m.put("mergeHistory", g.getMergeHistory() != null ? g.getMergeHistory().size() : 0);
        if (g.getAttributes() != null) {
            m.put("attributeCount", g.getAttributes().size());
        }
        return m;
    }

    private Map<String, Object> eventToMap(TimelineEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("eventId", e.getEventId());
        m.put("eventType", e.getEventType());
        m.put("eventCategory", e.getEventCategory());
        m.put("description", e.getDescription());
        m.put("changedBy", e.getChangedBy());
        m.put("eventTimestamp", e.getEventTimestamp() != null ? e.getEventTimestamp().toString() : null);
        m.put("isRestorable", e.getIsRestorable());
        return m;
    }

    private Map<String, Object> taskToMap(StewardTask t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("taskId", t.getTaskId());
        m.put("taskType", t.getTaskType());
        m.put("priority", t.getPriority());
        m.put("status", t.getStatus());
        m.put("description", t.getDescription());
        m.put("assignedTo", t.getAssignedTo());
        m.put("dueDate", t.getDueDate() != null ? t.getDueDate().toString() : null);
        m.put("createdAt", t.getCreatedAt() != null ? t.getCreatedAt().toString() : null);
        return m;
    }

    private String displayName(Party p) {
        if (p.getFullName() != null && !p.getFullName().isBlank()) return p.getFullName();
        if (p.getOrganizationName() != null) return p.getOrganizationName();
        if (p.getFirstName() != null || p.getLastName() != null) {
            return ((p.getFirstName() != null ? p.getFirstName() : "") + " " +
                    (p.getLastName() != null ? p.getLastName() : "")).trim();
        }
        return p.getGlobalId();
    }

    // ── Result Helpers ─────────────────────────────────────────────────────────

    private ToolExecutionResult toResult(Map<String, Object> data, String displayType) {
        try {
            String json = objectMapper.writeValueAsString(data);
            return new ToolExecutionResult(data, json, displayType);
        } catch (Exception e) {
            return new ToolExecutionResult(data, "{}", displayType);
        }
    }

    private ToolExecutionResult errorResult(String message) {
        return new ToolExecutionResult(Map.of("error", message), "{\"error\":\"" + message + "\"}", "ERROR");
    }

    private int getInt(Map<String, Object> m, String key, int def) {
        Object v = m.get(key);
        if (v instanceof Number n) return n.intValue();
        return def;
    }

    private double getDouble(Map<String, Object> m, String key, double def) {
        Object v = m.get(key);
        if (v instanceof Number n) return n.doubleValue();
        return def;
    }

    // ── Inner Types ────────────────────────────────────────────────────────────

    record ToolExecutionResult(Map<String, Object> data, String jsonSummary, String displayType) {}

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ToolCallRecord {
        private String id;
        private String tool;
        private Map<String, Object> input;
        private Map<String, Object> result;
        private String displayType; // PARTY_LIST | PARTY_DETAIL | GOLDEN_RECORD | TIMELINE | STEWARD_QUEUE | PLATFORM_STATS | ERROR
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatbotResponse {
        private String reply;
        private List<ToolCallRecord> toolCalls;
        private String model;
    }
}
