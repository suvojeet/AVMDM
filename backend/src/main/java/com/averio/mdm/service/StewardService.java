package com.averio.mdm.service;

import com.averio.mdm.domain.steward.StewardTask;
import com.averio.mdm.repository.cosmos.StewardTaskRepository;
import com.averio.mdm.service.ml.MLMatchingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
        mlMatchingService.captureDecision(saved, resolution, resolvedBy);
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
                if (task.getCandidateIds() != null && task.getCandidateIds().size() >= 2) {
                    partyService.mergeGoldenRecords(
                            task.getCandidateIds().get(0),
                            task.getCandidateIds().get(1),
                            "Steward approved merge - task " + task.getTaskId(),
                            resolvedBy);
                }
            }
            case "REJECT_MERGE" -> log.info("Merge rejected for task {}", task.getTaskId());
            case "CREATE_NEW"   -> log.info("New entity approved for task {}", task.getTaskId());
            default             -> log.info("Custom resolution {} for task {}", resolution, task.getTaskId());
        }
    }
}
