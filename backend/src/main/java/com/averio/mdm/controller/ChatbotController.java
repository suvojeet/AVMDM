package com.averio.mdm.controller;

import com.averio.mdm.service.ChatbotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/chatbot")
@RequiredArgsConstructor
@Tag(name = "AverioAI Chatbot", description = "Tool-use-powered AI chatbot with real-time MDM data access")
public class ChatbotController {

    private final ChatbotService chatbotService;

    @PostMapping("/chat")
    @Operation(summary = "Chat with AverioAI — the AI can call MDM tools to retrieve real data")
    public ResponseEntity<ChatbotService.ChatbotResponse> chat(@RequestBody ChatbotRequest request) {
        ChatbotService.ChatbotResponse response = chatbotService.chat(
                request.message(),
                request.history()
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/suggestions")
    @Operation(summary = "Get context-aware suggested questions for the chatbot")
    public ResponseEntity<List<String>> suggestions() {
        return ResponseEntity.ok(List.of(
                "How many active golden records are in the platform?",
                "Show me parties with data quality below 70%",
                "What's in the steward work queue right now?",
                "Find all organizations named JP Morgan",
                "What are the top survivorship rules configured?",
                "Show me critical priority steward tasks",
                "Find duplicate candidates for party GLD-00001",
                "What compliance frameworks are we monitoring?"
        ));
    }

    record ChatbotRequest(String message, List<Map<String, String>> history) {}
}
