import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { hierarchyApi } from "../../services/api";
import {
  Network, ChevronDown, ChevronRight, ExternalLink, Plus,
  Minus, Building2, Users, BarChart3, GitBranch, Search,
  RefreshCw, Star, AlertCircle,
} from "lucide-react";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────

interface HierarchyNode {
  globalId: string;
  goldenRecordId?: string;
  displayName: string;
  partyType: string;
  partySubType?: string;
  status: string;
  depth: number;
  ownershipPercentage?: number;
  hierarchyType?: string;
  levelTag: string;
  dataQualityScore?: number;
  childCount: number;
  totalDescendants: number;
  children: HierarchyNode[];
}

// ── Level tag styling ──────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  ULTIMATE_PARENT: {
    badge: "text-amber-300  bg-amber-500/15  border-amber-500/30",
    dot:   "bg-amber-400",
    label: "Ultimate Parent",
  },
  HOLDING_COMPANY: {
    badge: "text-blue-300   bg-blue-500/15   border-blue-500/30",
    dot:   "bg-blue-400",
    label: "Holding Company",
  },
  SUBSIDIARY: {
    badge: "text-teal-300   bg-teal-500/15   border-teal-500/30",
    dot:   "bg-teal-400",
    label: "Subsidiary",
  },
  DIVISION: {
    badge: "text-purple-300 bg-purple-500/15 border-purple-500/30",
    dot:   "bg-purple-400",
    label: "Division",
  },
  DEPARTMENT: {
    badge: "text-slate-300  bg-slate-500/15  border-slate-500/30",
    dot:   "bg-slate-400",
    label: "Department",
  },
};

const levelStyle = (tag: string) =>
  LEVEL_STYLE[tag] ?? LEVEL_STYLE.SUBSIDIARY;

const statusColor = (s: string) =>
  ({ ACTIVE: "text-emerald-400", INACTIVE: "text-slate-500", DISSOLVED: "text-red-400" }[s] ?? "text-slate-400");

const dqColor = (score?: number) =>
  score == null ? "text-slate-500"
  : score > 0.85 ? "text-emerald-400"
  : score > 0.65 ? "text-amber-400"
  : "text-red-400";

// ── Tree node ──────────────────────────────────────────────────────────────

function TreeNode({
  node, isLast, onSelect, selectedId,
}: {
  node: HierarchyNode;
  isLast: boolean;
  onSelect: (n: HierarchyNode) => void;
  selectedId: string | null;
}) {
  const [expanded, setExpanded] = useState(node.depth < 2);
  const hasChildren = node.children.length > 0;
  const ls = levelStyle(node.levelTag);
  const isSelected = node.globalId === selectedId;

  return (
    <div className="relative">
      {/* Connector line from parent */}
      {node.depth > 0 && (
        <div className="absolute left-0 top-0 flex flex-col items-center" style={{ width: 20 }}>
          <div className="w-px bg-slate-600/60 flex-1 min-h-[22px]" />
          <div className="w-4 h-px bg-slate-600/60" />
        </div>
      )}

      {/* Node card */}
      <div
        className={clsx(
          "group relative flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all duration-150",
          node.depth > 0 && "ml-5",
          isSelected
            ? "bg-blue-600/15 border-blue-500/40 shadow-sm shadow-blue-500/10"
            : "bg-averio-dark-card border-averio-dark-border hover:bg-slate-700/40 hover:border-slate-500/40"
        )}
        onClick={() => onSelect(node)}
      >
        {/* Expand / collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center
                       text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          </div>
        )}

        {/* Level dot */}
        <div className={clsx("mt-1.5 w-2 h-2 rounded-full flex-shrink-0", ls.dot)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{node.displayName}</span>
            <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full border leading-none", ls.badge)}>
              {levelStyle(node.levelTag).label}
            </span>
            {node.ownershipPercentage != null && (
              <span className="text-[10px] text-slate-400 font-mono">
                {node.ownershipPercentage.toFixed(0)}% owned
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[11px] text-slate-400">{node.partySubType ?? node.partyType}</span>
            <span className={clsx("text-[11px] font-medium", statusColor(node.status))}>
              ● {node.status}
            </span>
            {node.dataQualityScore != null && (
              <span className={clsx("text-[11px] font-medium", dqColor(node.dataQualityScore))}>
                DQ {Math.round(node.dataQualityScore * 100)}%
              </span>
            )}
            {hasChildren && (
              <span className="text-[11px] text-slate-500">
                {node.childCount} direct · {node.totalDescendants} total
              </span>
            )}
          </div>
        </div>

        {/* Hierarchy type badge */}
        {node.hierarchyType && node.depth > 0 && (
          <span className="flex-shrink-0 text-[9px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-600/50 self-center">
            {node.hierarchyType}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1 ml-5 pl-0 space-y-1 relative">
          {/* Vertical line alongside children */}
          <div className="absolute left-0 top-0 bottom-4 w-px bg-slate-600/40" />
          {node.children.map((child, i) => (
            <TreeNode
              key={child.globalId}
              node={child}
              isLast={i === node.children.length - 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────

function DetailPanel({
  node, onClose, onRemoveChild, parentId,
}: {
  node: HierarchyNode;
  onClose: () => void;
  onRemoveChild?: () => void;
  parentId?: string;
}) {
  const navigate = useNavigate();
  const ls = levelStyle(node.levelTag);

  return (
    <div className="card w-80 flex-shrink-0 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Node Details</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">✕</button>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className={clsx("w-2.5 h-2.5 rounded-full flex-shrink-0", ls.dot)} />
          <p className="text-sm font-bold text-white">{node.displayName}</p>
        </div>
        <span className={clsx("inline-block text-[10px] px-1.5 py-0.5 rounded-full border", ls.badge)}>
          {ls.label}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Type",        value: node.partySubType ?? node.partyType },
          { label: "Status",      value: node.status,    color: statusColor(node.status) },
          { label: "Ownership",   value: node.ownershipPercentage != null ? `${node.ownershipPercentage}%` : "—" },
          { label: "Hierarchy",   value: node.hierarchyType ?? "CORPORATE" },
          { label: "DQ Score",    value: node.dataQualityScore != null ? `${Math.round(node.dataQualityScore * 100)}%` : "—",
                                  color: dqColor(node.dataQualityScore) },
          { label: "Depth",       value: `Level ${node.depth}` },
          { label: "Children",    value: node.childCount },
          { label: "Descendants", value: node.totalDescendants },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={clsx("text-xs font-semibold mt-0.5 truncate", color ?? "text-white")}>{value}</p>
          </div>
        ))}
      </div>

      {/* IDs */}
      {node.goldenRecordId && (
        <div className="bg-slate-800/50 rounded-lg p-2 space-y-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Golden Record ID</p>
          <code className="text-[11px] text-blue-400 font-mono break-all">{node.goldenRecordId}</code>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-1.5 pt-1 border-t border-averio-dark-border">
        <button
          onClick={() => navigate(`/parties/${node.globalId}`)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                     text-slate-300 bg-slate-700/50 hover:bg-slate-700 transition-colors"
        >
          <ExternalLink size={12} /> View Full Party Record
        </button>
        <button
          onClick={() => navigate(`/parties/${node.globalId}/golden-record`)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                     text-slate-300 bg-slate-700/50 hover:bg-slate-700 transition-colors"
        >
          <Star size={12} /> View Golden Record
        </button>
        {parentId && onRemoveChild && (
          <button
            onClick={onRemoveChild}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                       text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
          >
            <Minus size={12} /> Remove from Hierarchy
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PartyHierarchy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode]     = useState<HierarchyNode | null>(null);
  const [selectedNodeParentId, setSelectedNodeParentId] = useState<string | null>(null);
  const [rootSearch, setRootSearch] = useState("");

  // Load all root organizations for the left panel
  const { data: roots = [], isLoading: rootsLoading } = useQuery<HierarchyNode[]>({
    queryKey: ["hierarchy-roots"],
    queryFn: hierarchyApi.getRoots,
  });

  // Load hierarchy tree for selected root
  const { data: tree, isLoading: treeLoading, error: treeError } = useQuery<HierarchyNode>({
    queryKey: ["hierarchy-tree", selectedRootId],
    queryFn: () => hierarchyApi.getTree(selectedRootId!),
    enabled: !!selectedRootId,
  });

  const removeChildMutation = useMutation({
    mutationFn: ({ parentId, childId }: { parentId: string; childId: string }) =>
      hierarchyApi.removeChild(parentId, childId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hierarchy-tree", selectedRootId] });
      queryClient.invalidateQueries({ queryKey: ["hierarchy-roots"] });
      setSelectedNode(null);
    },
  });

  const filteredRoots = roots.filter((r) =>
    r.displayName.toLowerCase().includes(rootSearch.toLowerCase())
  );

  // When user clicks a node, figure out its parent for the "remove" action
  function handleSelectNode(node: HierarchyNode) {
    setSelectedNode(node);
    if (tree) {
      setSelectedNodeParentId(findParentId(tree, node.globalId));
    }
  }

  function findParentId(current: HierarchyNode, targetId: string): string | null {
    for (const child of current.children) {
      if (child.globalId === targetId) return current.globalId;
      const found = findParentId(child, targetId);
      if (found) return found;
    }
    return null;
  }

  const summaryStats = tree
    ? [
        { label: "Total Entities",   value: tree.totalDescendants + 1, icon: Building2 },
        { label: "Direct Children",  value: tree.childCount,            icon: GitBranch },
        { label: "All Descendants",  value: tree.totalDescendants,      icon: Users },
        { label: "Root DQ Score",    value: tree.dataQualityScore != null ? `${Math.round(tree.dataQualityScore * 100)}%` : "—", icon: BarChart3 },
      ]
    : [];

  return (
    <div className="flex gap-5 h-full animate-fade-in">

      {/* ── Left panel: Root selector ─────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Organizations
          </h2>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-8 text-xs"
              placeholder="Filter organizations…"
              value={rootSearch}
              onChange={(e) => setRootSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1 overflow-y-auto flex-1 pr-1">
          {rootsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-700/40 rounded-lg animate-pulse" />
            ))
          ) : filteredRoots.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No organizations found</div>
          ) : filteredRoots.map((root) => (
            <button
              key={root.globalId}
              onClick={() => { setSelectedRootId(root.globalId); setSelectedNode(null); }}
              className={clsx(
                "w-full text-left p-3 rounded-lg border transition-all duration-150",
                selectedRootId === root.globalId
                  ? "bg-blue-600/15 border-blue-500/40 text-white"
                  : "bg-averio-dark-card border-averio-dark-border text-slate-300 hover:bg-slate-700/40"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", levelStyle("ULTIMATE_PARENT").dot)} />
                <p className="text-xs font-semibold truncate">{root.displayName}</p>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 pl-4">
                {root.childCount} direct subsidiaries
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Network size={22} className="text-blue-400" />
              Party Hierarchy
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Corporate ownership structure and organizational lineage
            </p>
          </div>
          {selectedRootId && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["hierarchy-tree", selectedRootId] });
                  queryClient.invalidateQueries({ queryKey: ["hierarchy-roots"] });
                }}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <RefreshCw size={13} /> Refresh
              </button>
              <button
                onClick={() => navigate(`/parties/${selectedRootId}`)}
                className="btn-primary flex items-center gap-1.5 text-xs"
              >
                <ExternalLink size={13} /> View Party
              </button>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {tree && (
          <div className="grid grid-cols-4 gap-3 flex-shrink-0">
            {summaryStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white leading-none">{value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tree + detail panel */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Tree area */}
          <div className="flex-1 card overflow-y-auto min-h-0">
            {!selectedRootId ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <Network size={48} className="opacity-20 mb-4" />
                <p className="font-medium text-sm">Select an organization</p>
                <p className="text-xs mt-1">Choose a root organization from the left panel</p>
              </div>
            ) : treeLoading ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3"
                       style={{ marginLeft: `${(i % 3) * 24}px` }}>
                    <div className="h-14 bg-slate-700/40 rounded-lg animate-pulse flex-1" />
                  </div>
                ))}
              </div>
            ) : treeError ? (
              <div className="flex flex-col items-center justify-center h-48 text-red-400">
                <AlertCircle size={32} className="mb-3 opacity-60" />
                <p className="text-sm font-medium">Failed to load hierarchy</p>
                <p className="text-xs text-slate-500 mt-1">Check that this party has a connected hierarchy</p>
              </div>
            ) : tree ? (
              <div className="space-y-1 p-1">
                <TreeNode
                  node={tree}
                  isLast
                  onSelect={handleSelectNode}
                  selectedId={selectedNode?.globalId ?? null}
                />
              </div>
            ) : null}
          </div>

          {/* Detail panel */}
          {selectedNode && (
            <DetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              parentId={selectedNodeParentId ?? undefined}
              onRemoveChild={
                selectedNodeParentId
                  ? () => removeChildMutation.mutate({
                      parentId: selectedNodeParentId,
                      childId: selectedNode.globalId,
                    })
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
