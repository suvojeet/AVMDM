package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.hierarchy.HierarchyNodeDto;
import com.averio.mdm.repository.neo4j.PartyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.neo4j.driver.Value;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PartyHierarchyService {

    private final PartyRepository partyRepository;
    private final Neo4jClient neo4jClient;

    // ── Tree retrieval ─────────────────────────────────────────────────────

    public HierarchyNodeDto getHierarchyTree(String rootGlobalId, int maxDepth) {
        Party root = partyRepository.findByGlobalId(rootGlobalId)
                .orElseThrow(() -> new RuntimeException("Party not found: " + rootGlobalId));
        return buildNode(root, 0, maxDepth, null, null, null);
    }

    private HierarchyNodeDto buildNode(Party party, int depth, int maxDepth,
                                        Double ownershipPct, String hierarchyType, String levelTag) {
        List<HierarchyNodeDto> children = new ArrayList<>();
        if (depth < maxDepth) {
            for (ChildRelation rel : getChildRelations(party.getGlobalId())) {
                partyRepository.findByGlobalId(rel.childGlobalId()).ifPresent(child ->
                        children.add(buildNode(child, depth + 1, maxDepth,
                                rel.ownershipPercentage(), rel.hierarchyType(), rel.levelTag())));
            }
        }

        int totalDescendants = countDescendants(children);
        String resolvedLevelTag = levelTag != null ? levelTag
                : (depth == 0 ? "ULTIMATE_PARENT" : "SUBSIDIARY");

        return HierarchyNodeDto.builder()
                .globalId(party.getGlobalId())
                .goldenRecordId(party.getGoldenRecordId())
                .displayName(resolveDisplayName(party))
                .partyType(party.getPartyType())
                .partySubType(party.getPartySubType())
                .status(party.getStatus())
                .depth(depth)
                .ownershipPercentage(ownershipPct)
                .hierarchyType(hierarchyType)
                .levelTag(resolvedLevelTag)
                .dataQualityScore(party.getDataQualityScore())
                .childCount(children.size())
                .totalDescendants(totalDescendants)
                .children(children)
                .build();
    }

    // ── Ancestors ─────────────────────────────────────────────────────────

    public List<HierarchyNodeDto> getAncestors(String globalId) {
        return partyRepository.findAncestors(globalId).stream()
                .map(p -> buildNode(p, 0, 0, null, null, null))
                .toList();
    }

    public Optional<HierarchyNodeDto> getUltimateParent(String globalId) {
        return partyRepository.findUltimateParent(globalId)
                .map(p -> buildNode(p, 0, 0, null, null, "ULTIMATE_PARENT"));
    }

    // ── Root organizations ────────────────────────────────────────────────

    public List<HierarchyNodeDto> getRootOrganizations() {
        return partyRepository.findRootOrganizations().stream()
                .map(p -> {
                    long childCount = countDirectChildren(p.getGlobalId());
                    return HierarchyNodeDto.builder()
                            .globalId(p.getGlobalId())
                            .goldenRecordId(p.getGoldenRecordId())
                            .displayName(resolveDisplayName(p))
                            .partyType(p.getPartyType())
                            .partySubType(p.getPartySubType())
                            .status(p.getStatus())
                            .levelTag("ULTIMATE_PARENT")
                            .depth(0)
                            .dataQualityScore(p.getDataQualityScore())
                            .childCount((int) childCount)
                            .children(List.of())
                            .build();
                })
                .toList();
    }

    // ── Relationship management ───────────────────────────────────────────

    public void addParentRelationship(String parentGlobalId, String childGlobalId,
                                       Double ownershipPercentage, String hierarchyType,
                                       String levelTag, String createdBy) {
        neo4jClient.query("""
                MATCH (parent:Party {globalId: $parentId}), (child:Party {globalId: $childId})
                MERGE (parent)-[r:PARENT_OF]->(child)
                SET r.ownershipPercentage = $ownershipPct,
                    r.hierarchyType       = $hierarchyType,
                    r.levelTag            = $levelTag,
                    r.status              = 'ACTIVE',
                    r.createdBy           = $createdBy,
                    r.createdAt           = datetime()
                """)
                .bindAll(Map.of(
                        "parentId",      parentGlobalId,
                        "childId",       childGlobalId,
                        "ownershipPct",  ownershipPercentage != null ? ownershipPercentage : 100.0,
                        "hierarchyType", hierarchyType != null ? hierarchyType : "CORPORATE",
                        "levelTag",      levelTag != null ? levelTag : "SUBSIDIARY",
                        "createdBy",     createdBy
                ))
                .run();
        log.info("PARENT_OF link added: {} → {}", parentGlobalId, childGlobalId);
    }

    public void removeParentRelationship(String parentGlobalId, String childGlobalId) {
        neo4jClient.query("""
                MATCH (parent:Party {globalId: $parentId})-[r:PARENT_OF]->(child:Party {globalId: $childId})
                DELETE r
                """)
                .bindAll(Map.of("parentId", parentGlobalId, "childId", childGlobalId))
                .run();
        log.info("PARENT_OF link removed: {} → {}", parentGlobalId, childGlobalId);
    }

    // ── Summary ───────────────────────────────────────────────────────────

    public Map<String, Object> getHierarchySummary(String rootGlobalId) {
        HierarchyNodeDto tree = getHierarchyTree(rootGlobalId, 10);
        int maxDepth = computeMaxDepth(tree);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("rootGlobalId",    rootGlobalId);
        summary.put("displayName",     tree.getDisplayName());
        summary.put("totalEntities",   tree.getTotalDescendants() + 1);
        summary.put("directChildren",  tree.getChildCount());
        summary.put("totalDescendants", tree.getTotalDescendants());
        summary.put("maxDepth",        maxDepth);
        summary.put("levelTag",        tree.getLevelTag());
        return summary;
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private List<ChildRelation> getChildRelations(String parentGlobalId) {
        return neo4jClient.query("""
                MATCH (parent:Party {globalId: $parentId})-[r:PARENT_OF]->(child:Party)
                RETURN child.globalId          AS childId,
                       r.ownershipPercentage   AS ownershipPct,
                       r.hierarchyType         AS hierarchyType,
                       r.levelTag              AS levelTag
                ORDER BY child.organizationName, child.fullName
                """)
                .bindAll(Map.of("parentId", parentGlobalId))
                .fetchAs(ChildRelation.class)
                .mappedBy((typeSystem, record) -> new ChildRelation(
                        record.get("childId").asString(null),
                        nullableDouble(record.get("ownershipPct")),
                        record.get("hierarchyType").asString(null),
                        record.get("levelTag").asString(null)
                ))
                .all().stream().toList();
    }

    private long countDirectChildren(String globalId) {
        return neo4jClient.query(
                        "MATCH (:Party {globalId: $id})-[:PARENT_OF]->(c:Party) RETURN count(c) AS n")
                .bindAll(Map.of("id", globalId))
                .fetchAs(Long.class)
                .mappedBy((ts, r) -> r.get("n").asLong())
                .one()
                .orElse(0L);
    }

    private int countDescendants(List<HierarchyNodeDto> children) {
        int count = children.size();
        for (HierarchyNodeDto child : children) count += child.getTotalDescendants();
        return count;
    }

    private int computeMaxDepth(HierarchyNodeDto node) {
        if (node.getChildren() == null || node.getChildren().isEmpty()) return node.getDepth();
        return node.getChildren().stream().mapToInt(this::computeMaxDepth).max().orElse(node.getDepth());
    }

    private String resolveDisplayName(Party p) {
        if (p.getOrganizationName() != null && !p.getOrganizationName().isBlank()) return p.getOrganizationName();
        if (p.getFullName() != null && !p.getFullName().isBlank()) return p.getFullName();
        String name = ((p.getFirstName() != null ? p.getFirstName() + " " : "") +
                       (p.getLastName()  != null ? p.getLastName()       : "")).trim();
        return name.isBlank() ? p.getGlobalId() : name;
    }

    private Double nullableDouble(Value v) {
        return (v == null || v.isNull()) ? null : v.asDouble();
    }

    public record ChildRelation(
            String childGlobalId,
            Double ownershipPercentage,
            String hierarchyType,
            String levelTag
    ) {}
}
