package com.averio.mdm.controller;

import com.averio.mdm.domain.governance.EnterpriseView;
import com.averio.mdm.service.EnterpriseViewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/enterprise-views")
@RequiredArgsConstructor
@Tag(name = "Enterprise Views", description = "Department-scoped golden views with per-view governance configuration")
public class EnterpriseViewController {

    private final EnterpriseViewService viewService;

    @GetMapping
    @Operation(summary = "List all enterprise views")
    public ResponseEntity<List<EnterpriseView>> getAllViews() {
        return ResponseEntity.ok(viewService.getAllViews());
    }

    @GetMapping("/{viewId}")
    @Operation(summary = "Get a single enterprise view")
    public ResponseEntity<EnterpriseView> getView(@PathVariable String viewId) {
        return viewService.getView(viewId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(summary = "Create or update an enterprise view")
    public ResponseEntity<EnterpriseView> saveView(@RequestBody EnterpriseView view) {
        return ResponseEntity.ok(viewService.saveView(view));
    }

    @DeleteMapping("/{viewId}")
    @Operation(summary = "Delete an enterprise view (default Enterprise View cannot be deleted)")
    public ResponseEntity<Void> deleteView(@PathVariable String viewId) {
        viewService.deleteView(viewId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{viewId}/stats")
    @Operation(summary = "Rule and policy counts for a single view")
    public ResponseEntity<Map<String, Object>> getViewStats(@PathVariable String viewId) {
        return ResponseEntity.ok(viewService.getViewStats(viewId));
    }

    @GetMapping("/stats/all")
    @Operation(summary = "Rule and policy counts for all views (used to populate view cards)")
    public ResponseEntity<Map<String, Map<String, Object>>> getAllViewStats() {
        return ResponseEntity.ok(viewService.getAllViewStats());
    }
}
