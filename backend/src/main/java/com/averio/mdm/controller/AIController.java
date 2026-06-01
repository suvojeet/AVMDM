package com.averio.mdm.controller;

import com.averio.mdm.service.AIAssistantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI Assistant", description = "Natural language data queries and AI-powered insights")
public class AIController {

    @Autowired(required = false)
    private AIAssistantService aiAssistantService;

    @PostMapping("/chat")
    @Operation(summary = "Chat with AverioAI assistant")
    public ResponseEntity<Map<String, String>> chat(@RequestBody Map<String, Object> request) {
        if (aiAssistantService == null) return ResponseEntity.status(503).body(Map.of("error", "AI service not configured"));
        String message = (String) request.get("message");
        @SuppressWarnings("unchecked")
        List<Map<String, String>> history = (List<Map<String, String>>) request.get("history");
        return ResponseEntity.ok(Map.of("response", aiAssistantService.chat(message, history)));
    }

    @GetMapping("/quality-analysis/{entityId}")
    @Operation(summary = "AI-powered data quality analysis for an entity")
    public ResponseEntity<Map<String, Object>> analyzeQuality(@PathVariable String entityId) {
        if (aiAssistantService == null) return ResponseEntity.status(503).build();
        return ResponseEntity.ok(aiAssistantService.analyzeDataQuality(entityId));
    }

    @GetMapping("/match-recommendations/{goldenRecordId}")
    @Operation(summary = "Get AI match recommendations for a golden record")
    public ResponseEntity<List<Map<String, Object>>> getRecommendations(@PathVariable String goldenRecordId) {
        if (aiAssistantService == null) return ResponseEntity.status(503).build();
        return ResponseEntity.ok(aiAssistantService.getMatchRecommendations(goldenRecordId));
    }
}
