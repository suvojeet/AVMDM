package com.averio.mdm.controller;

import com.averio.mdm.domain.audit.SystemLog;
import com.averio.mdm.domain.audit.TransactionLog;
import com.averio.mdm.service.audit.SystemLogService;
import com.averio.mdm.service.audit.TransactionLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
@Tag(name = "Audit", description = "System and transaction log endpoints")
public class AuditController {

    private final TransactionLogService transactionLogService;
    private final SystemLogService systemLogService;

    // ── Transaction Logs ──────────────────────────────────────────────────────

    @GetMapping("/transaction-logs")
    @Operation(summary = "List transaction logs with optional filter")
    public ResponseEntity<List<TransactionLog>> getTransactionLogs(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String performedBy,
            @RequestParam(required = false) String status) {

        if (entityId != null)     return ResponseEntity.ok(transactionLogService.getByEntityId(entityId));
        if (performedBy != null)  return ResponseEntity.ok(transactionLogService.getByUser(performedBy));
        if ("FAILURE".equals(status)) return ResponseEntity.ok(transactionLogService.getFailures());
        if (entityType != null)   return ResponseEntity.ok(transactionLogService.getByEntityType(entityType));
        return ResponseEntity.ok(transactionLogService.getAll());
    }

    // ── System Logs ───────────────────────────────────────────────────────────

    @GetMapping("/system-logs")
    @Operation(summary = "List system logs with optional level filter")
    public ResponseEntity<List<SystemLog>> getSystemLogs(
            @RequestParam(required = false) String level) {

        if (level != null && !level.isBlank() && !"ALL".equalsIgnoreCase(level)) {
            return ResponseEntity.ok(systemLogService.getByLevel(level.toUpperCase()));
        }
        return ResponseEntity.ok(systemLogService.getAll());
    }

    @GetMapping("/system-logs/errors")
    @Operation(summary = "List only ERROR-level system logs")
    public ResponseEntity<List<SystemLog>> getErrors() {
        return ResponseEntity.ok(systemLogService.getErrors());
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    @Operation(summary = "High-level counts for the audit dashboard")
    public ResponseEntity<Map<String, Object>> getStats() {
        List<TransactionLog> txLogs = transactionLogService.getAll();
        List<SystemLog>      sysLogs = systemLogService.getAll();

        long failures  = txLogs.stream().filter(t -> "FAILURE".equals(t.getStatus())).count();
        long errors    = sysLogs.stream().filter(s -> "ERROR".equals(s.getLevel())).count();
        long warnings  = sysLogs.stream().filter(s -> "WARN".equals(s.getLevel())).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalTransactions", txLogs.size());
        stats.put("failedTransactions", failures);
        stats.put("totalSystemEvents", sysLogs.size());
        stats.put("errorCount", errors);
        stats.put("warnCount", warnings);
        return ResponseEntity.ok(stats);
    }
}
