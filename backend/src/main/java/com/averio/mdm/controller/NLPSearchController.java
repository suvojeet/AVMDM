package com.averio.mdm.controller;

import com.averio.mdm.service.ClaudeNLPService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "NLP Search", description = "Natural language MDM data search powered by Claude AI")
@RestController
@RequestMapping("/api/v1/nlp")
@RequiredArgsConstructor
public class NLPSearchController {

    private final ClaudeNLPService claudeNLPService;

    @Operation(summary = "NLP search — ask questions about your MDM data in plain English")
    @PostMapping("/search")
    public ResponseEntity<ClaudeNLPService.NLPSearchResponse> search(
            @RequestBody Map<String, String> body) {
        String query = body.getOrDefault("query", "").trim();
        if (query.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(claudeNLPService.search(query));
    }

    @Operation(summary = "NLP search via GET (for simple queries from address bar / testing)")
    @GetMapping("/search")
    public ResponseEntity<ClaudeNLPService.NLPSearchResponse> searchGet(
            @RequestParam String q) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(claudeNLPService.search(q));
    }
}
