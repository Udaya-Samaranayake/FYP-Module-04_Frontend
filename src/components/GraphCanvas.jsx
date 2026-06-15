import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { Box, Tabs, Tab, Chip, Typography } from '@mui/material';
import RouteIcon       from '@mui/icons-material/Route';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// Circles need equal W/H; dagre also uses these for spacing calculations.
// ─────────────────────────────────────────────────────────────────────────────
const NODE_D  = 100;   // diameter of the circular node
const DAGRE_W = 100;   // dagre graph-node width  (same as diameter)
const DAGRE_H = 100;   // dagre graph-node height (same as diameter)

// ─────────────────────────────────────────────────────────────────────────────
// Colour palette  (role → visual style)
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_STYLE = {
  entry:        { bg: '#052e16', border: '#10b981', text: '#10b981', glow: 'rgba(16,185,129,0.50)'  },
  intermediate: { bg: '#2d1a00', border: '#f59e0b', text: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
  target:       { bg: '#450a0a', border: '#ef4444', text: '#ef4444', glow: 'rgba(239,68,68,0.55)'   },
  blast:        { bg: '#2e1065', border: '#a855f7', text: '#c084fc', glow: 'rgba(168,85,247,0.50)'  },
  unaffected:   { bg: '#1e293b', border: '#475569', text: '#cbd5e1', glow: 'none'                    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dagre auto-layout helper
// ─────────────────────────────────────────────────────────────────────────────
function applyDagre(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 110 });
  nodes.forEach((n) => g.setNode(n.id, { width: DAGRE_W, height: DAGRE_H }));
  // Only register edges whose source AND target exist as nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  edges.forEach((e) => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  });
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    // Guard: if dagre didn't assign a position (isolated node), place at origin
    return {
      ...n,
      position: {
        x: p ? p.x - DAGRE_W / 2 : 0,
        y: p ? p.y - DAGRE_H / 2 : 0,
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge factory  — ALWAYS produces a guaranteed-unique id
// pattern: e-{source}-{target}  (safe because node IDs are function names)
// ─────────────────────────────────────────────────────────────────────────────
function makeEdge({ source, target, animated = false, stroke = '#64748b', strokeWidth = 1.5, opacity = 1 }) {
  return {
    id:        `e-${source}-${target}`,   // ← unique, human-readable
    source,
    target,
    animated,
    style:     { stroke, strokeWidth, opacity },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Circular custom node  — used for ALL views
// ─────────────────────────────────────────────────────────────────────────────
const CircleNode = ({ data }) => {
  const s = ROLE_STYLE[data.role] ?? ROLE_STYLE.unaffected;
  return (
    <div
      style={{
        width:          NODE_D,
        height:         NODE_D,
        borderRadius:   '50%',
        background:     s.bg,
        border:         `2.5px solid ${s.border}`,
        boxShadow:      s.glow !== 'none' ? `0 0 22px ${s.glow}, inset 0 0 12px ${s.glow}` : 'none',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '6px',
        fontFamily:     "'JetBrains Mono', monospace",
        opacity:        data.role === 'unaffected' ? 0.72 : 1,
        transition:     'box-shadow 0.25s',
        cursor:         'pointer',
        textAlign:      'center',
        overflow:       'hidden',
        position:       'relative',
      }}
    >
      {/* React Flow connection handles — REQUIRED for edges to render (Error #008 fix) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: s.border, border: 'none', width: 8, height: 8, top: -4 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: s.border, border: 'none', width: 8, height: 8, bottom: -4 }}
      />

      {/* Step or role icon at the top */}
      {data.badge && (
        <div style={{ fontSize: 7, color: s.text, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', lineHeight: 1, marginBottom: 3 }}>
          {data.badge}
        </div>
      )}

      {/* Main label */}
      <div style={{
        fontSize:   data.label.length > 14 ? 8 : 10,
        fontWeight: 700,
        color:      s.text,
        wordBreak:  'break-all',
        lineHeight: 1.25,
        maxWidth:   NODE_D - 14,
      }}>
        {data.label}
      </div>

      {/* Depth badge */}
      {data.depth !== undefined && (
        <div style={{ fontSize: 7, color: '#475569', marginTop: 2 }}>d:{data.depth}</div>
      )}

      {/* Step number pill */}
      {data.stepIndex !== undefined && (
        <div style={{
          position:       'absolute',
          top:            -6,
          right:          -6,
          background:     s.border,
          color:          '#030712',
          borderRadius:   '50%',
          width:          20,
          height:         20,
          fontSize:       9,
          fontWeight:     900,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          boxShadow:      `0 0 8px ${s.glow}`,
        }}>
          {data.stepIndex}
        </div>
      )}
    </div>
  );
};

const nodeTypes = { circleNode: CircleNode };

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 1 — Active Attack Path
// Only the nodes that appear in attack_path[], animated red edges.
// ─────────────────────────────────────────────────────────────────────────────
function buildAttackPathView(phase4Data) {
  const { attack_path = [], full_graph } = phase4Data;
  if (!attack_path.length) return { nodes: [], edges: [] };

  const attackSet = new Set(attack_path);

  // Try to pull node metadata from full_graph; fall back to just the id
  const sourceNodes = full_graph?.nodes?.filter((n) => attackSet.has(n.id)) ?? [];

  const rfNodes = sourceNodes.length
    ? sourceNodes.map((n) => {
        const idx  = attack_path.indexOf(n.id);
        const role = idx === 0 ? 'entry' : idx === attack_path.length - 1 ? 'target' : 'intermediate';
        return {
          id:   n.id,
          type: 'circleNode',
          position: { x: 0, y: 0 },
          data: {
            label:     n.id,
            role,
            badge:     role === 'entry' ? '⚡ ENTRY' : role === 'target' ? '🎯 TARGET' : null,
            stepIndex: idx + 1,
          },
        };
      })
    : attack_path.map((id, i) => ({
        id,
        type: 'circleNode',
        position: { x: 0, y: 0 },
        data: {
          label:     id,
          role:      i === 0 ? 'entry' : i === attack_path.length - 1 ? 'target' : 'intermediate',
          badge:     i === 0 ? '⚡ ENTRY' : i === attack_path.length - 1 ? '🎯 TARGET' : null,
          stepIndex: i + 1,
        },
      }));

  const rfEdges = attack_path.slice(0, -1).map((src, i) =>
    makeEdge({ source: src, target: attack_path[i + 1], animated: true, stroke: '#ef4444', strokeWidth: 3 })
  );

  return { nodes: applyDagre(rfNodes, rfEdges, 'TB'), edges: rfEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 2 — Full System graph (Phase 4 full_graph + optional Phase 5 overlay)
// ─────────────────────────────────────────────────────────────────────────────
function buildFullSystemView(phase4Data, phase5Data) {
  const { attack_path = [], full_graph } = phase4Data ?? {};
  const blastSet  = new Set((phase5Data?.blast_propagation ?? []).map((b) => b.node));
  const attackSet = new Set(attack_path);

  function resolveRole(id) {
    if (id === attack_path[0])                return 'entry';
    if (id === attack_path.at?.(-1))          return 'target';
    if (attackSet.has(id))                    return 'intermediate';
    if (blastSet.has(id))                     return 'blast';
    return 'unaffected';
  }

  const rfNodes = (full_graph?.nodes ?? []).map((n) => {
    const role  = resolveRole(n.id);
    const idx   = attack_path.indexOf(n.id);
    const bItem = phase5Data?.blast_propagation?.find((b) => b.node === n.id);
    return {
      id:   n.id,
      type: 'circleNode',
      position: { x: 0, y: 0 },
      data: {
        label:     n.id,
        role,
        badge:     role === 'entry'   ? '⚡ ENTRY'
                 : role === 'target'  ? '🎯 TARGET'
                 : role === 'blast'   ? '💥 BLAST'
                 : null,
        stepIndex: (role === 'entry' || role === 'target' || role === 'intermediate') && idx >= 0
          ? idx + 1 : undefined,
        depth:     bItem?.depth,
      },
    };
  });

  const attackEdgeSet = new Set(
    attack_path.slice(0, -1).map((src, i) => `${src}||${attack_path[i + 1]}`)
  );

  const rfEdges = (full_graph?.edges ?? []).map((e) => {
    const key       = `${e.source}||${e.target}`;
    const isAttack  = attackEdgeSet.has(key);
    const isBlast   = blastSet.has(e.target);
    return makeEdge({
      source:      e.source,
      target:      e.target,
      animated:    isAttack,
      stroke:      isAttack ? '#ef4444' : isBlast ? '#a855f7' : '#64748b',
      strokeWidth: isAttack ? 3 : isBlast ? 2 : 1.5,
      opacity:     1,
    });
  });

  return { nodes: applyDagre(rfNodes, rfEdges, 'TB'), edges: rfEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW 3 — Phase 5 Blast Radius
// Uses phase5Data.full_graph (all nodes) + blast_propagation for colour coding.
// Falls back to propagation-only graph if full_graph is absent.
// ─────────────────────────────────────────────────────────────────────────────
function buildBlastView(phase5Data) {
  const {
    root_cause_function: root,
    blast_propagation   = [],
    full_graph,
  } = phase5Data;

  const blastSet = new Set(blast_propagation.map((b) => b.node));
  const bDepthMap = Object.fromEntries(blast_propagation.map((b) => [b.node, b]));

  // ── Nodes ──
  let rfNodes;

  if (full_graph?.nodes?.length) {
    // Preferred path: render ALL nodes from full_graph, colour by role
    rfNodes = full_graph.nodes.map((n) => {
      const isRoot  = n.id === root;
      const isBlast = blastSet.has(n.id);
      const bItem   = bDepthMap[n.id];
      return {
        id:   n.id,
        type: 'circleNode',
        position: { x: 0, y: 0 },
        data: {
          label:     n.id,
          role:      isRoot ? 'target' : isBlast ? 'blast' : 'unaffected',
          badge:     isRoot  ? '💥 ROOT'
                   : isBlast ? (bItem?.is_critical ? '⚠ CRITICAL' : '📡 IMPACT')
                   : null,
          depth:     bItem?.depth,
        },
      };
    });
  } else {
    // Fallback: only root + impacted nodes
    rfNodes = [
      {
        id:   root,
        type: 'circleNode',
        position: { x: 0, y: 0 },
        data: { label: root, role: 'target', badge: '💥 ROOT' },
      },
      ...blast_propagation.map((item) => ({
        id:   item.node,
        type: 'circleNode',
        position: { x: 0, y: 0 },
        data: {
          label: item.node,
          role:  'blast',
          badge: item.is_critical ? '⚠ CRITICAL' : '📡 IMPACT',
          depth: item.depth,
        },
      })),
    ];
  }

  // ── Edges ──
  let rfEdges;

  if (full_graph?.edges?.length) {
    // Use the real call-graph edges from the backend
    rfEdges = full_graph.edges.map((e) => {
      const isBlastEdge = blastSet.has(e.target) || e.source === root || blastSet.has(e.source);
      const isCritical  = bDepthMap[e.target]?.is_critical;
      return makeEdge({
        source:      e.source,
        target:      e.target,
        animated:    isCritical ?? false,
        stroke:      e.source === root ? '#ef4444'
                   : isCritical        ? '#f97316'
                   : isBlastEdge       ? '#a855f7'
                   : '#64748b',
        strokeWidth: e.source === root ? 2.5 : isCritical ? 2 : 1.5,
        opacity:     1,
      });
    });
  } else {
    // Fallback: synthesise edges via depth grouping
    const byDepth = {};
    blast_propagation.forEach((item) => {
      (byDepth[item.depth] ??= []).push(item.node);
    });
    rfEdges = blast_propagation.map((item, idx) => {
      const parentDepth = item.depth - 1;
      const parents     = parentDepth === 0 ? [root] : byDepth[parentDepth] ?? [root];
      const parent      = parents[idx % parents.length];
      return makeEdge({
        source:      parent,
        target:      item.node,
        animated:    item.is_critical,
        stroke:      item.is_critical ? '#f97316' : '#a855f7',
        strokeWidth: item.is_critical ? 2.5 : 1.5,
      });
    });
  }

  return { nodes: applyDagre(rfNodes, rfEdges, 'TB'), edges: rfEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function Dot({ color, label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 5px ${color}` }} />
      <Typography sx={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: 0.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

function EmptyState() {
  return (
    <Box sx={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2,
      background: '#0a0f1e',
    }}>
      <Box sx={{
        width: 80, height: 80, borderRadius: '50%',
        border: '2px solid #1a2744',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pulse-glow 3s ease-in-out infinite',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#1a2744" strokeWidth="1.5" />
          <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="#1e3a5f" strokeWidth="1.5" />
        </svg>
      </Box>
      <Typography sx={{ color: '#334155', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
        Awaiting Analysis Input
      </Typography>
      <Typography sx={{ color: '#1e3a5f', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: 0.5 }}>
        Enter a target node and run Phase 4 or Phase 5
      </Typography>
    </Box>
  );
}

const tabSx = {
  fontFamily:    "'JetBrains Mono', monospace",
  fontSize:      11, fontWeight: 600,
  letterSpacing: 0.8, textTransform: 'uppercase',
  color:         '#475569', minHeight: 36, py: 0,
  '&.Mui-selected': { color: '#00d4ff' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────────────────
export default function GraphCanvas({ mode, phase4Data, phase5Data }) {
  const [graphTab, setGraphTab] = useState(0);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const hasPhase4 = !!phase4Data?.attack_path?.length;
  const hasPhase5 = !!phase5Data;

  useEffect(() => {
    if (mode === 'phase4' && hasPhase4) {
      const result = graphTab === 0
        ? buildAttackPathView(phase4Data)
        : buildFullSystemView(phase4Data, phase5Data);
      setNodes(result.nodes);
      setEdges(result.edges);
    } else if (mode === 'phase5' && hasPhase5) {
      const result = buildBlastView(phase5Data);
      setNodes(result.nodes);
      setEdges(result.edges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [mode, phase4Data, phase5Data, graphTab]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const showPhase5Tab = mode === 'phase5' && hasPhase5;
  const showPhase4Tabs = mode === 'phase4' && hasPhase4;
  const isEmpty = nodes.length === 0;

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Tab / header bar ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 1.5,
        borderBottom: '1px solid #1a2744',
        background: 'linear-gradient(90deg,rgba(13,20,36,0.98) 0%,rgba(10,15,30,0.95) 100%)',
        backdropFilter: 'blur(6px)',
        flexShrink: 0, minHeight: 40, gap: 2,
      }}>
        {showPhase4Tabs ? (
          <Tabs
            value={graphTab}
            onChange={(_, v) => setGraphTab(v)}
            sx={{ minHeight: 40, '& .MuiTabs-indicator': { backgroundColor: '#00d4ff', height: 2 } }}
          >
            <Tab icon={<RouteIcon sx={{ fontSize: 13, mr: 0.5 }} />} iconPosition="start" label="Active Attack Path" sx={tabSx} />
            <Tab icon={<BubbleChartIcon sx={{ fontSize: 13, mr: 0.5 }} />} iconPosition="start" label="Full System & Blast Radius" sx={tabSx} />
          </Tabs>
        ) : (
          <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#334155', letterSpacing: 1.5, textTransform: 'uppercase', py: 1 }}>
            {showPhase5Tab
              ? `💥 Blast Radius — ${phase5Data?.full_graph?.nodes?.length ?? 0} nodes · ${phase5Data?.total_impacted_nodes ?? 0} impacted`
              : 'Graph Visualization Canvas'}
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
          {(mode === 'phase4' || mode === 'phase5') && (
            <>
              {mode === 'phase4' && <Dot color="#10b981" label="Entry Point" />}
              {mode === 'phase4' && <Dot color="#f59e0b" label="Intermediate" />}
              <Dot color="#ef4444" label={mode === 'phase5' ? 'Root Cause' : 'Vulnerable Target'} />
              <Dot color="#a855f7" label="Blast Impact" />
              <Dot color="#334155" label="Unaffected" />
            </>
          )}

          {/* Counts */}
          {nodes.length > 0 && (
            <>
              <Chip label={`${nodes.length} nodes`} size="small" sx={{ height: 18, fontSize: 9, fontFamily: 'monospace', bgcolor: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', '& .MuiChip-label': { px: 1 } }} />
              <Chip label={`${edges.length} edges`} size="small" sx={{ height: 18, fontSize: 9, fontFamily: 'monospace', bgcolor: 'rgba(255,45,85,0.08)', color: '#ff2d55', border: '1px solid rgba(255,45,85,0.2)', '& .MuiChip-label': { px: 1 } }} />
            </>
          )}
        </Box>
      </Box>

      {/* ── React Flow canvas ── */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {isEmpty ? (
          <EmptyState />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.08}
            maxZoom={3}
            attributionPosition="bottom-right"
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1a2744" />
            <Controls style={{ background: '#0d1424', border: '1px solid #1a2744', borderRadius: 8 }} />
            <MiniMap
              nodeColor={(n) => {
                const r = n.data?.role;
                if (r === 'entry')        return '#10b981';
                if (r === 'target')       return '#ef4444';
                if (r === 'intermediate') return '#f59e0b';
                if (r === 'blast')        return '#a855f7';
                return '#1e293b';
              }}
              style={{ background: '#0a0f1e', border: '1px solid #1a2744', borderRadius: 8 }}
              maskColor="rgba(3,7,18,0.85)"
            />
          </ReactFlow>
        )}
      </Box>
    </Box>
  );
}
