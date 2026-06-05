package com.averio.mdm.service;

import com.averio.mdm.domain.cosmos.PartyDoc;
import com.averio.mdm.domain.steward.StewardTask;
import com.averio.mdm.repository.cosmos.PartyDocRepository;
import com.averio.mdm.repository.cosmos.StewardTaskRepository;
import com.averio.mdm.service.ml.MLMatchingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Service
@RequiredArgsConstructor
public class StewardService {

    private final PartyService partyService;
    private final StewardTaskRepository taskRepository;
    private final MLMatchingService mlMatchingService;

    @Autowired(required = false)
    private PartyDocRepository partyDocRepository;

    public StewardTask createTask(StewardTask task) {
        task.setTaskId(UUID.randomUUID().toString());
        task.setStatus("OPEN");
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        task.setEscalationCount(0);
        StewardTask saved = taskRepository.save(task);
        log.info("Steward task created: {} type={} priority={}", saved.getTaskId(), saved.getTaskType(), saved.getPriority());
        return saved;
    }

    public Optional<StewardTask> getTask(String taskId) {
        return taskRepository.findById(taskId);
    }

    public List<StewardTask> getTasksForAssignee(String assignee) {
        return taskRepository.findByAssignedTo(assignee).stream()
                .filter(t -> !"CLOSED".equals(t.getStatus()))
                .sorted(Comparator.comparing(StewardTask::getPriority)
                        .thenComparing(StewardTask::getCreatedAt))
                .collect(Collectors.toList());
    }

    public List<StewardTask> getOpenTasks(String priority) {
        List<StewardTask> allTasks = StreamSupport
                .stream(taskRepository.findAll().spliterator(), false)
                .collect(Collectors.toList());

        return allTasks.stream()
                .filter(t -> "OPEN".equals(t.getStatus()) || "IN_PROGRESS".equals(t.getStatus()))
                .filter(t -> priority == null || priority.equals(t.getPriority()))
                .sorted(Comparator.comparing(StewardTask::getCreatedAt))
                .collect(Collectors.toList());
    }

    public Map<String, Object> getTasksPaged(
            String priority, String status, String taskType,
            String search, int page, int size, String sortBy, String sortDir) {

        List<StewardTask> all = StreamSupport
                .stream(taskRepository.findAll().spliterator(), false)
                .collect(Collectors.toList());

        // ── Filters ──────────────────────────────────────────────────────────
        String searchLc = (search != null && !search.isBlank()) ? search.toLowerCase() : null;

        List<StewardTask> filtered = all.stream()
                .filter(t -> {
                    // Default: only active tasks; if caller passes explicit status, honour it
                    if (status != null && !status.isBlank()) return status.equalsIgnoreCase(t.getStatus());
                    return "OPEN".equals(t.getStatus()) || "IN_PROGRESS".equals(t.getStatus()) || "ESCALATED".equals(t.getStatus());
                })
                .filter(t -> priority == null || priority.isBlank() || priority.equalsIgnoreCase(t.getPriority()))
                .filter(t -> taskType == null || taskType.isBlank() || taskType.equalsIgnoreCase(t.getTaskType()))
                .filter(t -> {
                    if (searchLc == null) return true;
                    return (t.getTitle()       != null && t.getTitle().toLowerCase().contains(searchLc))
                        || (t.getDescription() != null && t.getDescription().toLowerCase().contains(searchLc))
                        || (t.getEntityId()    != null && t.getEntityId().toLowerCase().contains(searchLc))
                        || (t.getAssignedTo()  != null && t.getAssignedTo().toLowerCase().contains(searchLc));
                })
                .collect(Collectors.toList());

        // ── Sort ──────────────────────────────────────────────────────────────
        Comparator<StewardTask> comparator = switch (sortBy) {
            case "matchScore"  -> Comparator.comparingDouble(t -> t.getMatchScore() != null ? t.getMatchScore() : 0.0);
            case "priority"    -> Comparator.comparingInt(t -> priorityOrder(t.getPriority()));
            case "dueDate"     -> Comparator.comparing(t -> t.getDueDate() != null ? t.getDueDate() : java.time.LocalDateTime.MAX);
            case "updatedAt"   -> Comparator.comparing(t -> t.getUpdatedAt() != null ? t.getUpdatedAt() : java.time.LocalDateTime.MIN);
            default            -> Comparator.comparing(t -> t.getCreatedAt() != null ? t.getCreatedAt() : java.time.LocalDateTime.MIN);
        };
        if ("desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        filtered.sort(comparator);

        // ── Paginate ──────────────────────────────────────────────────────────
        int total     = filtered.size();
        int totalPages = (int) Math.ceil((double) total / Math.max(size, 1));
        int fromIdx   = Math.min(page * size, total);
        int toIdx     = Math.min(fromIdx + size, total);
        List<StewardTask> pageItems = filtered.subList(fromIdx, toIdx);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content",     pageItems);
        result.put("page",        page);
        result.put("size",        size);
        result.put("totalElements", total);
        result.put("totalPages",  totalPages);
        result.put("hasNext",     page < totalPages - 1);
        result.put("hasPrev",     page > 0);
        return result;
    }

    private static int priorityOrder(String p) {
        return switch (p != null ? p : "") {
            case "CRITICAL" -> 0;
            case "HIGH"     -> 1;
            case "MEDIUM"   -> 2;
            case "LOW"      -> 3;
            default         -> 4;
        };
    }

    public StewardTask assignTask(String taskId, String assignee, String assignedBy) {
        StewardTask task = getTask(taskId).orElseThrow(() -> new RuntimeException("Task not found: " + taskId));
        task.setAssignedTo(assignee);
        task.setAssignedBy(assignedBy);
        task.setAssignedAt(LocalDateTime.now());
        task.setStatus("IN_PROGRESS");
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    public StewardTask resolveTask(String taskId, String resolution, String resolvedBy, String notes) {
        StewardTask task = getTask(taskId).orElseThrow(() -> new RuntimeException("Task not found: " + taskId));
        task.setResolution(resolution);
        task.setResolutionNotes(notes);
        task.setResolvedBy(resolvedBy);
        task.setResolvedAt(LocalDateTime.now());
        task.setStatus("RESOLVED");
        task.setUpdatedAt(LocalDateTime.now());
        StewardTask saved = taskRepository.save(task);
        executeResolution(saved, resolution, resolvedBy);
        try {
            mlMatchingService.captureDecision(saved, resolution, resolvedBy);
        } catch (Exception e) {
            log.warn("ML feedback capture failed for task {} — non-fatal: {}", taskId, e.getMessage());
        }
        log.info("Task {} resolved: {} by {}", taskId, resolution, resolvedBy);
        return saved;
    }

    public StewardTask escalateTask(String taskId, String escalatedBy) {
        StewardTask task = getTask(taskId).orElseThrow(() -> new RuntimeException("Task not found: " + taskId));
        task.setStatus("ESCALATED");
        task.setEscalationCount(task.getEscalationCount() + 1);
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }

    public Map<String, Object> getWorkQueueSummary() {
        List<StewardTask> all = StreamSupport
                .stream(taskRepository.findAll().spliterator(), false)
                .collect(Collectors.toList());

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalOpen",   all.stream().filter(t -> "OPEN".equals(t.getStatus())).count());
        summary.put("inProgress",  all.stream().filter(t -> "IN_PROGRESS".equals(t.getStatus())).count());
        summary.put("escalated",   all.stream().filter(t -> "ESCALATED".equals(t.getStatus())).count());
        summary.put("resolved",    all.stream().filter(t -> "RESOLVED".equals(t.getStatus())).count());
        summary.put("critical",    all.stream().filter(t -> "CRITICAL".equals(t.getPriority()) && !"CLOSED".equals(t.getStatus())).count());
        summary.put("overdue",     all.stream()
                .filter(t -> t.getDueDate() != null && t.getDueDate().isBefore(LocalDateTime.now()) && !"CLOSED".equals(t.getStatus()))
                .count());
        return summary;
    }

    public Map<String, Long> getMatchMethodDistribution() {
        return StreamSupport.stream(taskRepository.findAll().spliterator(), false)
                .filter(t -> t.getMatchMethod() != null)
                .collect(Collectors.groupingBy(StewardTask::getMatchMethod, Collectors.counting()));
    }

    private void executeResolution(StewardTask task, String resolution, String resolvedBy) {
        switch (resolution) {
            case "APPROVE_MERGE" -> {
                if (task.getCandidateIds() == null || task.getCandidateIds().size() < 2) {
                    log.warn("APPROVE_MERGE task {} has fewer than 2 candidateIds — skipping", task.getTaskId());
                    break;
                }

                String goldenIdA = task.getCandidateIds().get(0);
                String goldenIdB = task.getCandidateIds().get(1);

                // Determine survivor — lower numeric golden ID wins
                String survivingGoldenId = lowerGoldenId(goldenIdA, goldenIdB);
                log.info("APPROVE_MERGE task {}: {} vs {} → survivor={}", task.getTaskId(), goldenIdA, goldenIdB, survivingGoldenId);

                // Step 1: Neo4j merge (best-effort — skipped when Neo4j is down)
                try {
                    partyService.mergeGoldenRecords(goldenIdA, goldenIdB,
                            "Steward approved merge - task " + task.getTaskId(), resolvedBy);
                } catch (Exception e) {
                    log.warn("APPROVE_MERGE Neo4j step failed for task {} (non-fatal): {}", task.getTaskId(), e.getMessage());
                }

                // Step 2: Direct Cosmos patch — guaranteed to work regardless of Neo4j availability.
                // Uses sourceId1/sourceId2 from taskData (set by forceMatchReview) plus a full
                // scan fallback for tasks created by the auto-ingest pipeline.
                if (partyDocRepository != null) {
                    Map<String, Object> td = task.getTaskData();
                    patchCosmosGoldenId(td != null ? str(td, "sourceId1") : null, survivingGoldenId, resolvedBy);
                    patchCosmosGoldenId(td != null ? str(td, "sourceId2") : null, survivingGoldenId, resolvedBy);

                    // Also patch by globalId stored in taskData (covers ingest-created tasks)
                    patchCosmosGoldenIdByGlobalId(td != null ? str(td, "party1GlobalId") : null, survivingGoldenId, resolvedBy);
                    patchCosmosGoldenIdByGlobalId(td != null ? str(td, "party2GlobalId") : null, survivingGoldenId, resolvedBy);

                    // Final fallback: scan all docs whose goldenRecordId matches either candidateId
                    patchCosmosCluster(goldenIdA, survivingGoldenId, resolvedBy);
                    patchCosmosCluster(goldenIdB, survivingGoldenId, resolvedBy);
                }
            }
            case "REJECT_MERGE" -> log.info("Merge rejected for task {}", task.getTaskId());
            case "CREATE_NEW"   -> log.info("New entity approved for task {}", task.getTaskId());
            default             -> log.info("Custom resolution {} for task {}", resolution, task.getTaskId());
        }
    }

    /** Patch every Cosmos doc whose sourceSystemId matches — uses the working cross-partition query. */
    private void patchCosmosGoldenId(String sourceSystemId, String survivingGoldenId, String performedBy) {
        if (sourceSystemId == null || sourceSystemId.isBlank()) return;
        try {
            List<PartyDoc> docs = partyDocRepository.findBySourceSystemId(sourceSystemId);
            docs.forEach(doc -> {
                if (!survivingGoldenId.equals(doc.getGoldenRecordId())) {
                    log.info("Cosmos patch: sourceSystemId={} {} → {}", sourceSystemId, doc.getGoldenRecordId(), survivingGoldenId);
                    doc.setGoldenRecordId(survivingGoldenId);
                    doc.setUpdatedAt(LocalDateTime.now());
                    doc.setUpdatedBy(performedBy);
                    partyDocRepository.save(doc);
                }
            });
        } catch (Exception e) {
            log.warn("patchCosmosGoldenId sourceSystemId={} failed: {}", sourceSystemId, e.getMessage());
        }
    }

    /** Patch a single Cosmos doc by its globalId (@Id + @PartitionKey — always a point read). */
    private void patchCosmosGoldenIdByGlobalId(String globalId, String survivingGoldenId, String performedBy) {
        if (globalId == null || globalId.isBlank()) return;
        try {
            partyDocRepository.findByGlobalId(globalId).ifPresent(doc -> {
                if (!survivingGoldenId.equals(doc.getGoldenRecordId())) {
                    log.info("Cosmos patch: globalId={} {} → {}", globalId, doc.getGoldenRecordId(), survivingGoldenId);
                    doc.setGoldenRecordId(survivingGoldenId);
                    doc.setUpdatedAt(LocalDateTime.now());
                    doc.setUpdatedBy(performedBy);
                    partyDocRepository.save(doc);
                }
            });
        } catch (Exception e) {
            log.warn("patchCosmosGoldenIdByGlobalId globalId={} failed: {}", globalId, e.getMessage());
        }
    }

    /** Scan all Cosmos docs and patch any whose goldenRecordId matches the losing golden ID. */
    private void patchCosmosCluster(String losingGoldenId, String survivingGoldenId, String performedBy) {
        if (losingGoldenId == null || losingGoldenId.isBlank() || losingGoldenId.equals(survivingGoldenId)) return;
        try {
            List<PartyDoc> all = new ArrayList<>();
            partyDocRepository.findAll().forEach(all::add);
            all.stream()
               .filter(doc -> losingGoldenId.equals(doc.getGoldenRecordId()))
               .forEach(doc -> {
                   log.info("Cosmos cluster patch: globalId={} goldenId {} → {}", doc.getGlobalId(), losingGoldenId, survivingGoldenId);
                   doc.setGoldenRecordId(survivingGoldenId);
                   doc.setStatus("MERGED");
                   doc.setUpdatedAt(LocalDateTime.now());
                   doc.setUpdatedBy(performedBy);
                   partyDocRepository.save(doc);
               });
        } catch (Exception e) {
            log.warn("patchCosmosCluster losingGoldenId={} failed: {}", losingGoldenId, e.getMessage());
        }
    }

    private static String lowerGoldenId(String a, String b) {
        if (a == null) return b != null ? b : "";
        if (b == null) return a;
        try {
            return new java.math.BigDecimal(a).compareTo(new java.math.BigDecimal(b)) <= 0 ? a : b;
        } catch (NumberFormatException e) {
            return a.compareTo(b) <= 0 ? a : b;
        }
    }

    private static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : null;
    }
}
