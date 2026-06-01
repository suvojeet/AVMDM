package com.averio.mdm.controller;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.steward.StewardTask;
import com.averio.mdm.engine.matching.MatchingEngine;
import com.averio.mdm.engine.matching.ProbabilisticMatcher;
import com.averio.mdm.engine.matching.DeterministicMatcher;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.service.StewardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/steward")
@RequiredArgsConstructor
@Tag(name = "Data Steward Console", description = "Work queue and task management for data stewards")
public class StewardController {

    private final StewardService stewardService;

    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Autowired(required = false)
    private ProbabilisticMatcher probabilisticMatcher;

    @Autowired(required = false)
    private DeterministicMatcher deterministicMatcher;

    @GetMapping("/tasks")
    @Operation(summary = "Get open steward tasks")
    public ResponseEntity<List<StewardTask>> getTasks(
            @RequestParam(required = false) String priority,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(stewardService.getOpenTasks(priority));
    }

    @GetMapping("/tasks/my")
    @Operation(summary = "Get tasks assigned to current user")
    public ResponseEntity<List<StewardTask>> getMyTasks(@AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "anonymous";
        return ResponseEntity.ok(stewardService.getTasksForAssignee(user));
    }

    @GetMapping("/tasks/{taskId}")
    @Operation(summary = "Get task by ID")
    public ResponseEntity<StewardTask> getTask(@PathVariable String taskId) {
        return stewardService.getTask(taskId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/tasks/{taskId}/assign")
    @Operation(summary = "Assign task to a steward")
    public ResponseEntity<StewardTask> assignTask(
            @PathVariable String taskId,
            @RequestParam String assignee,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "SYSTEM";
        return ResponseEntity.ok(stewardService.assignTask(taskId, assignee, user));
    }

    @PostMapping("/tasks/{taskId}/resolve")
    @Operation(summary = "Resolve a steward task")
    public ResponseEntity<StewardTask> resolveTask(
            @PathVariable String taskId,
            @RequestParam String resolution,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "STEWARD";
        return ResponseEntity.ok(stewardService.resolveTask(taskId, resolution, user, notes));
    }

    @PostMapping("/tasks/{taskId}/escalate")
    @Operation(summary = "Escalate a task")
    public ResponseEntity<StewardTask> escalateTask(
            @PathVariable String taskId,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "STEWARD";
        return ResponseEntity.ok(stewardService.escalateTask(taskId, user));
    }

    @GetMapping("/queue-summary")
    @Operation(summary = "Get work queue summary metrics")
    public ResponseEntity<Map<String, Object>> getQueueSummary() {
        return ResponseEntity.ok(stewardService.getWorkQueueSummary());
    }

    /**
     * POST /api/v1/steward/tasks
     * Manually create any steward task (used by the UI "Create Task" button).
     */
    @PostMapping("/tasks")
    @Operation(summary = "Manually create a steward task")
    public ResponseEntity<StewardTask> createTask(
            @RequestBody StewardTask task,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "SYSTEM";
        task.setCreatedBy(user);
        return ResponseEntity.ok(stewardService.createTask(task));
    }

    /**
     * POST /api/v1/steward/force-match-review?sourceId1=02121414&sourceId2=NT023512
     *
     * Looks up two parties by sourceSystemId, scores them, and creates a
     * MATCH_REVIEW steward task regardless of score — bypassing the automatic
     * threshold routing. Use this when a match was missed (blocking miss or
     * score below steward threshold) and you want to manually queue a review.
     */
    @PostMapping("/force-match-review")
    @Operation(summary = "Manually queue a match review for two parties",
               description = "Creates a MATCH_REVIEW task regardless of probabilistic score. "
                           + "Use when automatic matching missed two records that should be reviewed.")
    public ResponseEntity<Map<String, Object>> forceMatchReview(
            @RequestParam String sourceId1,
            @RequestParam String sourceId2,
            @RequestParam(required = false) String sourceSystem1,
            @RequestParam(required = false) String sourceSystem2,
            @RequestParam(defaultValue = "MEDIUM") String priority,
            @AuthenticationPrincipal Jwt jwt) {

        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "SYSTEM";
        Map<String, Object> result = new LinkedHashMap<>();

        // Try Neo4j party lookup — gracefully degrade if Neo4j is unavailable
        Party p1 = null, p2 = null;
        if (partyRepository != null) {
            try {
                List<Party> p1List = sourceSystem1 != null
                        ? partyRepository.findBySourceSystemAndSourceSystemId(sourceSystem1, sourceId1)
                        : partyRepository.findBySourceSystemIdOnly(sourceId1);
                List<Party> p2List = sourceSystem2 != null
                        ? partyRepository.findBySourceSystemAndSourceSystemId(sourceSystem2, sourceId2)
                        : partyRepository.findBySourceSystemIdOnly(sourceId2);
                if (!p1List.isEmpty()) p1 = p1List.get(0);
                if (!p2List.isEmpty()) p2 = p2List.get(0);
            } catch (Exception e) {
                // Neo4j connection failure — continue without party data
            }
        }

        // Score if both parties are available; otherwise task is MANUAL with score 0
        double score = 0.0;
        String method = "MANUAL";
        if (p1 != null && p2 != null) {
            if (deterministicMatcher != null) {
                MatchingEngine.MatchScore det = deterministicMatcher.score(p1, p2, null);
                if (det.isDefiniteMatch()) { score = 1.0; method = "DETERMINISTIC"; }
            }
            if (score == 0.0 && probabilisticMatcher != null) {
                MatchingEngine.MatchScore prob = probabilisticMatcher.score(p1, p2, null);
                score = prob.getScore();
                method = "PROBABILISTIC";
            }
        }

        String name1 = p1 != null ? displayName(p1) : sourceId1;
        String name2 = p2 != null ? displayName(p2) : sourceId2;
        String taskPriority = score >= 0.85 ? "HIGH" : priority;
        String entityId      = p1 != null ? p1.getGlobalId()        : sourceId1;
        String goldenId      = p1 != null ? p1.getGoldenRecordId()   : null;
        String candidateId1  = p1 != null ? (p1.getGoldenRecordId() != null ? p1.getGoldenRecordId() : p1.getGlobalId()) : sourceId1;
        String candidateId2  = p2 != null ? (p2.getGoldenRecordId() != null ? p2.getGoldenRecordId() : p2.getGlobalId()) : sourceId2;

        // Use String values in taskData — Cosmos DB serialization of Double in Map<String,Object> is unreliable
        Map<String, Object> taskData = new LinkedHashMap<>();
        taskData.put("sourceId1",   sourceId1);
        taskData.put("sourceId2",   sourceId2);
        if (p1 != null) taskData.put("party1GlobalId", p1.getGlobalId());
        if (p2 != null) taskData.put("party2GlobalId", p2.getGlobalId());
        taskData.put("matchScore",  String.format("%.4f", score));
        taskData.put("matchMethod", method);
        taskData.put("trigger",     "MANUAL_FORCE_REVIEW");
        taskData.put("createdBy",   user);

        // Use mutable ArrayList — Cosmos SDK can have issues serializing immutable List.of()
        List<String> candidateIdList = new ArrayList<>();
        candidateIdList.add(candidateId1);
        candidateIdList.add(candidateId2);

        StewardTask task = StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("MATCH_REVIEW")
                .priority(taskPriority)
                .status("OPEN")
                .entityId(entityId)
                .entityType("PARTY")
                .goldenRecordId(goldenId)
                .title("Manual match review: " + name1 + " vs " + name2)
                .description(String.format(
                        "Manually queued for review. Score: %.0f%% (%s). " +
                        "Party A: %s. Party B: %s. " +
                        "Approve to merge golden records, reject to keep separate.",
                        score * 100, method,
                        p1 != null ? name1 + " (ID: " + sourceId1 + ")" : sourceId1,
                        p2 != null ? name2 + " (ID: " + sourceId2 + ")" : sourceId2))
                .candidateIds(candidateIdList)
                .matchScore(score)
                .matchMethod(method)
                .taskData(taskData)
                .escalationCount(0)
                .createdBy(user)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        try {
            StewardTask saved = stewardService.createTask(task);
            result.put("taskId",     saved.getTaskId());
            result.put("status",     "TASK_CREATED");
            result.put("priority",   saved.getPriority());
            result.put("matchScore", String.format("%.1f%%", score * 100));
            result.put("party1",     Map.of("name", name1, "sourceId", sourceId1, "goldenId", goldenId != null ? goldenId : ""));
            result.put("party2",     Map.of("name", name2, "sourceId", sourceId2, "goldenId", candidateId2));
            result.put("message",    "Task created. Go to the Steward Console to approve or reject the merge.");
        } catch (Exception e) {
            result.put("status",  "SAVE_FAILED");
            result.put("error",   e.getMessage());
            result.put("party1",  Map.of("name", name1, "sourceId", sourceId1));
            result.put("party2",  Map.of("name", name2, "sourceId", sourceId2));
            result.put("message", "Could not save task to Cosmos DB: " + e.getMessage());
        }
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/v1/steward/demo/seed
     * Creates a set of realistic demo steward tasks so the console is never empty.
     * Safe to call repeatedly — each call generates new UUIDs.
     */
    @PostMapping("/demo/seed")
    @Operation(summary = "Seed realistic demo steward tasks (dev / demo use)")
    public ResponseEntity<Map<String, Object>> seedDemoTasks(@AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "SYSTEM";
        LocalDateTime now = LocalDateTime.now();

        List<StewardTask> tasks = List.of(
            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("MATCH_REVIEW").priority("CRITICAL").status("OPEN")
                .entityId("GLD-00412").entityType("PARTY").goldenRecordId("GLD-00412")
                .title("Match review: Apple Inc. vs Apple Incorporated")
                .description("Probabilistic score 92.4% (PROBABILISTIC). Party A: Apple Inc. (sourceId: CORP-00412). "
                        + "Party B: Apple Incorporated (sourceId: CORP-00509). Same DUNS, slightly different legal name. "
                        + "Approve to merge golden records, reject to keep separate.")
                .candidateIds(List.of("GLD-00412", "GLD-00509"))
                .matchScore(0.924).matchMethod("PROBABILISTIC").escalationCount(0)
                .dueDate(now.plusDays(1)).createdBy(user)
                .createdAt(now.minusHours(2)).updatedAt(now.minusHours(2))
                .build(),

            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("MATCH_REVIEW").priority("HIGH").status("OPEN")
                .entityId("GLD-00821").entityType("PARTY").goldenRecordId("GLD-00821")
                .title("Match review: John Smith vs Jonathan Smith")
                .description("Probabilistic score 77.8% (PROBABILISTIC). Party A: John Smith (sourceId: 02121414). "
                        + "Party B: Jonathan Smith (sourceId: NT023512). Same last name and address; first name is a known nickname variant. "
                        + "Approve to merge golden records, reject to keep separate.")
                .candidateIds(List.of("GLD-00821", "GLD-00822"))
                .matchScore(0.778).matchMethod("PROBABILISTIC").escalationCount(0)
                .dueDate(now.plusDays(3)).createdBy(user)
                .createdAt(now.minusHours(1)).updatedAt(now.minusHours(1))
                .build(),

            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("MATCH_REVIEW").priority("CRITICAL").status("ESCALATED")
                .entityId("GLD-01100").entityType("PARTY").goldenRecordId("GLD-01100")
                .title("Match review: Amazon.com Inc. vs Amazon, Inc.")
                .description("Probabilistic score 89.1% (PROBABILISTIC). Escalated — no steward action within SLA. "
                        + "Party A: Amazon.com Inc. (sourceId: AWS-00001). Party B: Amazon, Inc. (sourceId: ERP-00044). "
                        + "Legal name differs by punctuation only. High-value counterparty — requires senior steward review.")
                .candidateIds(List.of("GLD-01100", "GLD-01101"))
                .matchScore(0.891).matchMethod("PROBABILISTIC").escalationCount(2)
                .dueDate(now.minusDays(1)).createdBy(user)
                .createdAt(now.minusDays(3)).updatedAt(now.minusHours(4))
                .build(),

            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("DATA_QUALITY").priority("HIGH").status("OPEN")
                .entityId("GLD-00550").entityType("PARTY").goldenRecordId("GLD-00550")
                .title("Missing Tax ID — Accenture PLC golden record")
                .description("Golden record GLD-00550 (Accenture PLC) has no taxId across all 3 source records. "
                        + "Required for FATCA / CRS compliance reporting. Source systems: CRM, ERP, KYC. "
                        + "Steward should obtain the EIN/VAT number and update the master record.")
                .escalationCount(0).dueDate(now.plusDays(5)).createdBy(user)
                .createdAt(now.minusHours(6)).updatedAt(now.minusHours(6))
                .build(),

            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("MATCH_REVIEW").priority("MEDIUM").status("IN_PROGRESS")
                .entityId("GLD-00310").entityType("PARTY").goldenRecordId("GLD-00310")
                .title("Match review: Sarah Connor vs Sara K. Connor")
                .description("Probabilistic score 81.3% (PROBABILISTIC). Party A: Sarah Connor (sourceId: HR-00310). "
                        + "Party B: Sara K. Connor (sourceId: CRM-00788). Same DOB, different phone numbers. "
                        + "Under investigation — assigned to jane.doe@averio.com.")
                .candidateIds(List.of("GLD-00310", "GLD-00311"))
                .matchScore(0.813).matchMethod("PROBABILISTIC").escalationCount(0)
                .assignedTo("jane.doe@averio.com").dueDate(now.plusDays(2)).createdBy(user)
                .createdAt(now.minusDays(1)).updatedAt(now.minusHours(3))
                .build(),

            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("SURVIVORSHIP_CONFLICT").priority("MEDIUM").status("OPEN")
                .entityId("GLD-00730").entityType("PARTY").goldenRecordId("GLD-00730")
                .title("Survivorship conflict — Goldman Sachs registered address")
                .description("3 source systems report different registered addresses for Goldman Sachs (GLD-00730). "
                        + "CRM: 200 West St, New York. ERP: 200 West Street, NY 10282. KYC: 200 W Street New York USA. "
                        + "Current survivorship rule (MOST_RECENT) selected the KYC record. Steward should verify and lock the canonical address.")
                .escalationCount(0).dueDate(now.plusDays(7)).createdBy(user)
                .createdAt(now.minusHours(10)).updatedAt(now.minusHours(10))
                .build(),

            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("DATA_QUALITY").priority("LOW").status("OPEN")
                .entityId("GLD-00915").entityType("PARTY").goldenRecordId("GLD-00915")
                .title("Incomplete address — Deutsche Bank subsidiary record")
                .description("Source record ERP-00915 (Deutsche Bank AG — London Branch) is missing postalCode and city. "
                        + "Address survivorship defaulted to the CRM record. Verify the ERP address is correct or flag for data owners.")
                .escalationCount(0).dueDate(now.plusDays(14)).createdBy(user)
                .createdAt(now.minusDays(2)).updatedAt(now.minusDays(2))
                .build(),

            StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("DATA_QUALITY").priority("HIGH").status("IN_PROGRESS")
                .entityId("GLD-00200").entityType("PARTY").goldenRecordId("GLD-00200")
                .title("Duplicate contact records — BlackRock Inc.")
                .description("4 source records for BlackRock Inc. (GLD-00200) contain overlapping contact persons. "
                        + "Contacts 'Larry Fink' and 'Lawrence D. Fink' appear as separate persons in CRM and HR respectively. "
                        + "NicknameService confirms Larry/Lawrence are equivalents. Steward should merge the contact records.")
                .escalationCount(1).dueDate(now.plusDays(1)).createdBy(user)
                .assignedTo("bob.smith@averio.com")
                .createdAt(now.minusDays(4)).updatedAt(now.minusHours(8))
                .build()
        );

        int created = 0;
        for (StewardTask t : tasks) {
            stewardService.createTask(t);
            created++;
        }

        return ResponseEntity.ok(Map.of(
                "created", created,
                "message", created + " demo steward tasks created. Refresh the Steward Console to see them."
        ));
    }

    /**
     * GET /api/v1/steward/tasks/{taskId}/match-detail
     *
     * Returns side-by-side party attributes and per-attribute match scores
     * for a MATCH_REVIEW task, enabling the steward to make an informed decision.
     */
    @GetMapping("/tasks/{taskId}/match-detail")
    @Operation(summary = "Get side-by-side attribute comparison for a MATCH_REVIEW task")
    public ResponseEntity<Map<String, Object>> getMatchDetail(@PathVariable String taskId) {
        Optional<com.averio.mdm.domain.steward.StewardTask> taskOpt = stewardService.getTask(taskId);
        if (taskOpt.isEmpty()) return ResponseEntity.notFound().build();

        com.averio.mdm.domain.steward.StewardTask task = taskOpt.get();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId",     taskId);
        result.put("matchScore", task.getMatchScore());
        result.put("matchMethod", task.getMatchMethod() != null ? task.getMatchMethod() : "UNKNOWN");

        if (partyRepository == null || task.getCandidateIds() == null || task.getCandidateIds().size() < 2) {
            result.put("hasPartyData", false);
            return ResponseEntity.ok(result);
        }

        try {
            String id1 = task.getCandidateIds().get(0);
            String id2 = task.getCandidateIds().get(1);

            Party p1 = resolveParty(id1, task.getTaskData(), "party1GlobalId", "sourceId1");
            Party p2 = resolveParty(id2, task.getTaskData(), "party2GlobalId", "sourceId2");

            if (p1 == null || p2 == null) {
                result.put("hasPartyData", false);
                result.put("note", "Party records not found in Neo4j");
                return ResponseEntity.ok(result);
            }

            Map<String, Double> attrScores = new LinkedHashMap<>();
            double finalScore = task.getMatchScore() != null ? task.getMatchScore() : 0.0;

            if (probabilisticMatcher != null) {
                MatchingEngine.MatchScore ms = probabilisticMatcher.score(p1, p2, null);
                attrScores.putAll(ms.getAttributeBreakdown());
                finalScore = ms.getScore();
            }

            result.put("party1",          partyToDisplayMap(p1));
            result.put("party2",          partyToDisplayMap(p2));
            result.put("attributeScores", attrScores);
            result.put("finalScore",      finalScore);
            result.put("hasPartyData",    true);
        } catch (Exception e) {
            result.put("hasPartyData", false);
            result.put("note", "Could not load party data: " + e.getMessage());
        }

        return ResponseEntity.ok(result);
    }

    private Party resolveParty(String candidateId, Map<String, Object> taskData,
                               String globalIdKey, String sourceIdKey) {
        // 1. Try explicit globalId from taskData
        if (taskData != null && taskData.get(globalIdKey) instanceof String gid) {
            var found = partyRepository.findByGlobalId(gid);
            if (found.isPresent()) return found.get();
        }
        // 2. Try candidateId as globalId
        var byGlobal = partyRepository.findByGlobalId(candidateId);
        if (byGlobal.isPresent()) return byGlobal.get();
        // 3. Try candidateId as goldenRecordId
        var byGolden = partyRepository.findByGoldenRecordId(candidateId);
        if (!byGolden.isEmpty()) return byGolden.get(0);
        // 4. Try candidateId as sourceSystemId
        if (taskData != null && taskData.get(sourceIdKey) instanceof String sid) {
            var bySrc = partyRepository.findBySourceSystemIdOnly(sid);
            if (!bySrc.isEmpty()) return bySrc.get(0);
        }
        // 5. Try candidateId itself as sourceSystemId
        var bySourceId = partyRepository.findBySourceSystemIdOnly(candidateId);
        if (!bySourceId.isEmpty()) return bySourceId.get(0);
        return null;
    }

    private Map<String, Object> partyToDisplayMap(Party p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("globalId",       p.getGlobalId());
        m.put("goldenRecordId", p.getGoldenRecordId());
        m.put("sourceSystem",   p.getSourceSystem());
        m.put("sourceSystemId", p.getSourceSystemId());
        m.put("partyType",      p.getPartyType());
        m.put("firstName",      p.getFirstName());
        m.put("lastName",       p.getLastName());
        m.put("fullName",       displayName(p));
        m.put("organizationName", p.getOrganizationName());
        m.put("dateOfBirth",    p.getDateOfBirth() != null ? p.getDateOfBirth().toString() : null);
        m.put("taxId",          p.getTaxId());
        m.put("ein",            p.getEin());
        m.put("ssn",            p.getSsn());
        m.put("dunsNumber",     p.getDunsNumber());
        m.put("lei",            p.getLei());
        m.put("nationality",    p.getNationality());
        m.put("status",         p.getStatus());
        // Primary email
        String email = null;
        if (p.getEmails() != null && !p.getEmails().isEmpty())
            email = p.getEmails().values().stream().findFirst().map(Object::toString).orElse(null);
        m.put("email", email);
        // Primary phone
        String phone = null;
        if (p.getPhones() != null && !p.getPhones().isEmpty())
            phone = p.getPhones().values().stream().findFirst().map(Object::toString).orElse(null);
        m.put("phone", phone);
        // Primary address
        if (p.getAddresses() != null && !p.getAddresses().isEmpty()) {
            var addr = p.getAddresses().get(0);
            m.put("addressLine1",  addr.getLine1());
            m.put("addressCity",   addr.getCity());
            m.put("addressState",  addr.getStateProvince());
            m.put("addressPostal", addr.getPostalCode());
            m.put("addressCountry",addr.getCountry());
        }
        return m;
    }

    private String displayName(Party p) {
        if (p.getFullName() != null && !p.getFullName().isBlank()) return p.getFullName();
        if (p.getFirstName() != null)
            return p.getFirstName() + (p.getLastName() != null ? " " + p.getLastName() : "");
        if (p.getOrganizationName() != null) return p.getOrganizationName();
        return p.getGlobalId();
    }
}
