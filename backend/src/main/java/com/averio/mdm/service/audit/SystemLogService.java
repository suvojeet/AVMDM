package com.averio.mdm.service.audit;

import com.averio.mdm.domain.audit.SystemLog;
import com.averio.mdm.repository.cosmos.SystemLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemLogService {

    private final SystemLogRepository repository;

    public void error(String source, String message, Throwable throwable,
                      String requestPath, String httpMethod, Integer httpStatus,
                      String userId, String correlationId) {
        save("ERROR", source, message, throwable, requestPath, httpMethod, httpStatus, userId, correlationId, null);
    }

    public void warn(String source, String message) {
        save("WARN", source, message, null, null, null, null, null, null, null);
    }

    public void info(String source, String message, Map<String, String> metadata) {
        save("INFO", source, message, null, null, null, null, null, null, metadata);
    }

    private void save(String level, String source, String message, Throwable throwable,
                      String requestPath, String httpMethod, Integer httpStatus,
                      String userId, String correlationId, Map<String, String> metadata) {
        SystemLog entry = SystemLog.builder()
                .logId(UUID.randomUUID().toString())
                .level(level)
                .source(source)
                .message(message)
                .stackTrace(throwable != null ? stackTraceOf(throwable) : null)
                .timestamp(LocalDateTime.now())
                .userId(userId)
                .requestPath(requestPath)
                .httpMethod(httpMethod)
                .httpStatus(httpStatus)
                .correlationId(correlationId)
                .metadata(metadata)
                .build();
        try {
            repository.save(entry);
        } catch (Exception ex) {
            log.warn("Could not persist system log (non-fatal): {}", ex.getMessage());
        }
    }

    public List<SystemLog> getAll() {
        List<SystemLog> all = new java.util.ArrayList<>();
        repository.findAll().forEach(all::add);
        all.sort((a, b) -> {
            if (a.getTimestamp() == null) return 1;
            if (b.getTimestamp() == null) return -1;
            return b.getTimestamp().compareTo(a.getTimestamp());
        });
        return all;
    }

    public List<SystemLog> getByLevel(String level) {
        return repository.findByLevelOrderByTimestampDesc(level);
    }

    public List<SystemLog> getErrors() {
        return repository.findByLevelOrderByTimestampDesc("ERROR");
    }

    private static String stackTraceOf(Throwable t) {
        StringWriter sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        String full = sw.toString();
        return full.length() > 4000 ? full.substring(0, 4000) + "…" : full;
    }
}
