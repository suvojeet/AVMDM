package com.averio.mdm.controller;

import com.averio.mdm.domain.steward.StewardTask;
import com.averio.mdm.service.StewardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/steward")
@RequiredArgsConstructor
@Tag(name = "Data Steward Console", description = "Work queue and task management for data stewards")
public class StewardController {

    private final StewardService stewardService;

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
}
