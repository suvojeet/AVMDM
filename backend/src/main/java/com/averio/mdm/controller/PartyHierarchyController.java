package com.averio.mdm.controller;

import com.averio.mdm.domain.hierarchy.HierarchyNodeDto;
import com.averio.mdm.service.PartyHierarchyService;
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
@RequestMapping("/api/v1/parties")
@RequiredArgsConstructor
@Tag(name = "Party Hierarchy", description = "Corporate and organizational hierarchy management")
public class PartyHierarchyController {

    private final PartyHierarchyService hierarchyService;

    @GetMapping("/hierarchy/roots")
    @Operation(summary = "List all root organizations (entities with no parent)")
    public ResponseEntity<List<HierarchyNodeDto>> getRootOrganizations() {
        return ResponseEntity.ok(hierarchyService.getRootOrganizations());
    }

    @GetMapping("/{globalId}/hierarchy")
    @Operation(summary = "Get the full hierarchy tree rooted at a given party")
    public ResponseEntity<HierarchyNodeDto> getHierarchyTree(
            @PathVariable String globalId,
            @RequestParam(defaultValue = "8") int maxDepth) {
        return ResponseEntity.ok(hierarchyService.getHierarchyTree(globalId, maxDepth));
    }

    @GetMapping("/{globalId}/hierarchy/summary")
    @Operation(summary = "Get hierarchy summary statistics for a party")
    public ResponseEntity<Map<String, Object>> getHierarchySummary(@PathVariable String globalId) {
        return ResponseEntity.ok(hierarchyService.getHierarchySummary(globalId));
    }

    @GetMapping("/{globalId}/ancestors")
    @Operation(summary = "Get the full ancestor chain for a party (bottom-up)")
    public ResponseEntity<List<HierarchyNodeDto>> getAncestors(@PathVariable String globalId) {
        return ResponseEntity.ok(hierarchyService.getAncestors(globalId));
    }

    @GetMapping("/{globalId}/ultimate-parent")
    @Operation(summary = "Get the ultimate parent (root) of a party")
    public ResponseEntity<HierarchyNodeDto> getUltimateParent(@PathVariable String globalId) {
        return hierarchyService.getUltimateParent(globalId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{parentId}/hierarchy/children/{childId}")
    @Operation(summary = "Link a child party under a parent in the hierarchy")
    public ResponseEntity<Map<String, String>> addChild(
            @PathVariable String parentId,
            @PathVariable String childId,
            @RequestParam(defaultValue = "100.0") Double ownershipPercentage,
            @RequestParam(defaultValue = "CORPORATE") String hierarchyType,
            @RequestParam(defaultValue = "SUBSIDIARY") String levelTag,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        hierarchyService.addParentRelationship(parentId, childId, ownershipPercentage,
                hierarchyType, levelTag, user);
        return ResponseEntity.ok(Map.of(
                "status", "LINKED",
                "parentId", parentId,
                "childId", childId,
                "hierarchyType", hierarchyType,
                "levelTag", levelTag
        ));
    }

    @DeleteMapping("/{parentId}/hierarchy/children/{childId}")
    @Operation(summary = "Remove a child from its parent in the hierarchy")
    public ResponseEntity<Map<String, String>> removeChild(
            @PathVariable String parentId,
            @PathVariable String childId) {
        hierarchyService.removeParentRelationship(parentId, childId);
        return ResponseEntity.ok(Map.of(
                "status", "UNLINKED",
                "parentId", parentId,
                "childId", childId
        ));
    }
}
