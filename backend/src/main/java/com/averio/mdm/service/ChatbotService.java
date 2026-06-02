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

    // ── Anthropic Claude ──────────────────────────────────────────────────────
    @Value("${averio.claude.api-key:}")
    private String claudeApiKey;

    @Value("${averio.claude.model:claude-sonnet-4-6}")
    private String claudeModel;

    @Value("${averio.claude.enabled:false}")
    private boolean claudeEnabled;

    // ── AI Agent master toggle + provider routing ─────────────────────────────
    @Value("${averio.ai.agent.enabled:true}")
    private boolean aiAgentEnabled;

    @Value("${averio.ai.agent.provider:ANTHROPIC}")
    private String aiAgentProvider;

    // ── Azure OpenAI ──────────────────────────────────────────────────────────
    @Value("${averio.ai.endpoint:}")
    private String azureOpenAiEndpoint;

    @Value("${averio.ai.api-key:}")
    private String azureOpenAiKey;

    @Value("${averio.ai.deployment-name:gpt-4}")
    private String azureOpenAiDeployment;

    private static final String AZURE_OPENAI_API_VERSION = "2024-02-15-preview";
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

            ---

            ## Entity Modeling — How to extend fields and objects (no developer required)

            Entity Modeling is under **Steward Console → Entity Modeling** in the sidebar.
            It lets data stewards add new fields and object schemas to any domain (Party, Account, Agreement, Product, Relationship) without any code changes.

            ### Key concepts

            | Term | Meaning |
            |---|---|
            | **Schema** | A named group of fields that attaches to a domain entity |
            | **Schema Key** | Machine identifier for the schema (e.g. `kyc_attributes`). Auto-generated from the display name. Cannot be changed after creation. |
            | **Attribute Group** | A single-instance schema — one set of values per entity (e.g. KYC details) |
            | **Object List** | A repeatable schema — multiple rows per entity (e.g. multiple bank accounts) |
            | **Core Object Extension** | Extra fields added to a built-in object like Identifier, Address, Phone, Email |
            | **Party Type Scope** | Restrict a schema to Individual, Organization, Household, or Employee only |
            | **Reference Data Schema** | Schema whose value is driven by an existing Reference Data category (no custom fields needed) |

            ### Field types available
            TEXT, TEXTAREA, NUMBER, DATE (calendar picker), BOOLEAN (yes/no), EMAIL, PHONE, URL, REFERENCE_DATA (dropdown from ref data category)

            Smart detection: if your schema name or key contains words like "date", "dob", "expiry", "deceased" — the system auto-suggests adding a DATE field. If it contains "email", "phone", "url" etc. it suggests the matching type.

            ---

            ### HOW TO: Add a new custom field group to a domain entity

            1. Go to **Steward Console → Entity Modeling**
            2. Select the target domain tab (e.g. **Party**)
            3. Ensure the **Custom Schemas** view is selected
            4. Click **+ New Schema** (top-right or bottom of the list)
            5. Fill in the slide-over form:
               - **Domain** — pre-selected, cannot change after creation
               - **Schema Type** — choose *Attribute Group* (single set of values) or *Object List* (multiple rows)
               - **Applies To Party Type** — (Party domain only) toggle Individual / Organization / Household / Employee. Leave all unchecked to apply to every party type.
               - **Display Name** — human-readable name (e.g. "KYC Attributes")
               - **Schema Key** — auto-fills from display name; override if needed. Lowercase, underscores only.
               - **Description** — optional summary of what this schema captures
               - **Linked to Reference Data** — tick this if the schema's value should be chosen from an existing Reference Data category (no custom fields needed). Otherwise leave unticked.
               - **Color** — visual colour for the section card
            6. In the **Fields** section, click **+ Add Field** for each field:
               - **Label** — display name (e.g. "Risk Level")
               - **Field Key** — auto-fills; machine identifier (e.g. `risk_level`)
               - **Type** — TEXT / NUMBER / DATE / BOOLEAN / EMAIL / PHONE / URL / TEXTAREA / REFERENCE_DATA
               - **Required** — tick if mandatory
               - Expand the row for: Placeholder, Default Value, Help Text, Max Length, Available in Survivorship Rules, Available in Matching Rules
            7. Click **Create Schema**

            The schema appears immediately in the Party (or domain) detail page for the correct party types.

            ---

            ### HOW TO: Add a new field to an EXISTING schema

            1. Go to **Steward Console → Entity Modeling**
            2. Select the domain tab
            3. Find the schema in the **Custom Schemas** list
            4. Click the **pencil (Edit)** icon on the schema card
            5. Scroll to the **Fields** section and click **+ Add Field**
            6. Fill in Label, Field Key, Type, Required as needed
            7. Click **Save Changes**

            ---

            ### HOW TO: Extend a built-in core object (Identifier, Address, Phone, Email, etc.)

            Use this when you want extra fields to appear inside every Identifier record, every Address record, etc.

            1. Go to **Steward Console → Entity Modeling**
            2. Select the domain tab (e.g. **Party**)
            3. Click the **Core Object Extensions** tab (next to Custom Schemas)
            4. You will see a grid of built-in core objects for that domain:
               - Party: Identifier, Address, Phone Number, Email Address, Relationship
               - Account: Account Detail, Address, Contact
               - Agreement: Agreement Terms, Party Role, Payment Schedule
               - Product: Product Attribute, Pricing, Classification
               - Relationship: Relationship Detail, Role
            5. Find the core object you want to extend (e.g. **Identifier**)
            6. Click **+ Add Extension** on that object's card
            7. The slide-over form opens pre-filled with:
               - An orange **"Extends [Object]"** banner
               - Schema Key pre-set (e.g. `party_identifier_ext`)
               - Schema Type pre-set to Object List (since core objects are usually lists)
            8. Add fields as normal (Step 6 above)
            9. Click **Create Schema**

            The extension fields appear in the **Core Object Extensions** section of the domain detail page, visually separated from custom attribute schemas with an orange **PUZZLE + [OBJECT TYPE]** badge.

            ---

            ### HOW TO: Restrict a schema to a specific party type (e.g. only Individuals)

            In the schema form, under **Applies To Party Type**, toggle the relevant types (Individual, Organization, Household, Employee).
            - Toggled ON = schema only appears for those party types
            - All toggled OFF = schema appears for every party type
            - The Party detail page automatically hides schemas that don't match the party's type

            ---

            ### HOW TO: Link a schema to Reference Data

            Use this when the schema's value should be a pick-list from an existing Reference Data category.

            1. In the schema form, tick **Linked to Reference Data**
            2. Select the **Reference Data Category** from the dropdown (e.g. IDENTIFIER_TYPE)
            3. Schema Key is auto-set to the category name (lowercase)
            4. No fields needed — the value is a single dropdown driven by that category
            5. Click **Create Schema**

            In the domain detail page this renders as a dropdown select instead of a form with fields.

            ---

            ### IMPORTANT: Core fields vs. dynamic schema fields

            Some fields are **built into the domain entity** (core fields) and are NOT managed through Entity Modeling.
            For the Party domain, core fields include:
            - Individual: First Name, Middle Name, Last Name, Date of Birth, Date of Death, Gender, Nationality, Country of Residence, Country of Birth, Tax ID, SSN
            - Organization: Organization Name, Legal Name, Tax ID, DUNS Number, LEI
            - Common: Source System ID, Status, Photo

            To change how a **core field** is displayed or edited you must update the domain detail page in the frontend code — Entity Modeling only handles *additional* fields beyond the core model.

            To add a **new field that doesn't exist anywhere yet** → use Entity Modeling.
            To edit how an **existing built-in field** like Date of Birth is shown → that requires a code change to the PartyDetail page.

            ---

            ### Schema activation / deactivation

            - Every schema card has a **toggle** (green = active, grey = inactive)
            - Inactive schemas are hidden from all domain detail pages but their stored data is preserved
            - Schemas can be permanently deleted — this also deletes all stored attribute values for that schema across every entity. This cannot be undone.

            ---

            When users ask "how do I add a field", "how do I extend an object", "how do I add Date of Death", etc. — answer using the steps above and be specific about which path applies (core field vs Entity Modeling).
            """;

    // ── Public API ─────────────────────────────────────────────────────────────

    public ChatbotResponse chat(String userMessage, List<Map<String, String>> history) {
        if (!aiAgentEnabled) {
            return ChatbotResponse.builder()
                    .reply("The AI Agent module is not enabled on this license. " +
                            "Please contact your administrator or upgrade your Averio MDM subscription.")
                    .toolCalls(List.of())
                    .model("disabled")
                    .build();
        }

        if ("AZURE_OPENAI".equalsIgnoreCase(aiAgentProvider)) {
            if (azureOpenAiEndpoint.isBlank() || azureOpenAiKey.isBlank()) {
                return ChatbotResponse.builder()
                        .reply("Azure OpenAI is selected as the AI provider but is not fully configured. " +
                                "Set `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_KEY` environment variables.")
                        .toolCalls(List.of())
                        .model("azure-unconfigured")
                        .build();
            }
            return chatWithAzureOpenAI(userMessage, history);
        }

        // Default: Anthropic Claude
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

    // ── Azure OpenAI chat (GPT-4 function calling) ────────────────────────────

    @SuppressWarnings("unchecked")
    private ChatbotResponse chatWithAzureOpenAI(String userMessage, List<Map<String, String>> history) {
        try {
            List<Map<String, Object>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", SYSTEM_PROMPT));

            if (history != null) {
                for (Map<String, String> msg : history) {
                    messages.add(Map.of("role", msg.getOrDefault("role", "user"), "content", msg.getOrDefault("content", "")));
                }
            }
            messages.add(Map.of("role", "user", "content", userMessage));

            List<ToolCallRecord> allToolCalls = new ArrayList<>();
            String finalReply = "";
            int rounds = 0;

            while (rounds < MAX_TOOL_ROUNDS) {
                rounds++;
                Map<String, Object> response = callAzureOpenAIAPI(messages);

                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                if (choices == null || choices.isEmpty()) break;

                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                String finishReason = (String) choices.get(0).get("finish_reason");
                String content = message.get("content") != null ? (String) message.get("content") : "";
                List<Map<String, Object>> toolCalls = (List<Map<String, Object>>) message.get("tool_calls");

                finalReply = content;

                if (toolCalls == null || toolCalls.isEmpty() || "stop".equals(finishReason)) break;

                // Add assistant message with tool_calls to history
                messages.add(message);

                // Execute tools
                for (Map<String, Object> tc : toolCalls) {
                    String callId   = (String) tc.get("id");
                    Map<String, Object> fn = (Map<String, Object>) tc.get("function");
                    String toolName = (String) fn.get("name");
                    String argsJson = (String) fn.getOrDefault("arguments", "{}");

                    Map<String, Object> input;
                    try { input = objectMapper.readValue(argsJson, Map.class); }
                    catch (Exception ex) { input = Map.of(); }

                    ToolExecutionResult execResult = executeTool(toolName, input);
                    allToolCalls.add(ToolCallRecord.builder()
                            .id(callId).tool(toolName).input(input)
                            .result(execResult.data()).displayType(execResult.displayType()).build());

                    messages.add(Map.of(
                            "role", "tool",
                            "tool_call_id", callId,
                            "content", execResult.jsonSummary()
                    ));
                }
            }

            return ChatbotResponse.builder()
                    .reply(finalReply.isBlank() ? "I processed your request." : finalReply)
                    .toolCalls(allToolCalls)
                    .model("azure-" + azureOpenAiDeployment)
                    .build();

        } catch (Exception e) {
            log.error("Azure OpenAI chatbot error: {}", e.getMessage(), e);
            return ChatbotResponse.builder()
                    .reply("Azure OpenAI encountered an error: " + e.getMessage())
                    .toolCalls(List.of())
                    .model("azure-" + azureOpenAiDeployment)
                    .build();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> callAzureOpenAIAPI(List<Map<String, Object>> messages) {
        String base = azureOpenAiEndpoint.endsWith("/")
                ? azureOpenAiEndpoint.substring(0, azureOpenAiEndpoint.length() - 1)
                : azureOpenAiEndpoint;
        String url = base +
                "/openai/deployments/" + azureOpenAiDeployment +
                "/chat/completions?api-version=" + AZURE_OPENAI_API_VERSION;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("api-key", azureOpenAiKey);

        // Convert Anthropic tool definitions → OpenAI function format
        List<Map<String, Object>> tools = buildToolDefinitions().stream()
                .map(t -> Map.<String, Object>of(
                        "type", "function",
                        "function", Map.of(
                                "name",        t.get("name"),
                                "description", t.get("description"),
                                "parameters",  t.containsKey("input_schema") ? t.get("input_schema") : Map.of()
                        )
                )).toList();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messages", messages);
        body.put("max_tokens", 4096);
        body.put("tools", tools);
        body.put("tool_choice", "auto");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Azure OpenAI API returned " + response.getStatusCode());
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
        if (g.getGoldenAttributes() != null) {
            m.put("attributeCount", g.getGoldenAttributes().size());
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
