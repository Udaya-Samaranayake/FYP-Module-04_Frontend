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
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import {
  Box,
  Tabs,
  Tab,
  Chip,
  Typography,
} from '@mui/material';
import RouteIcon from '@mui/icons-material/Route';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────
const NODE_W = 210;
const NODE_H = 64;

// ─────────────────────────────────────────────────────────────────────────────
// Colour tokens  (shared across both views)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  entry:       { bg: '#022c22', border: '#10b981', text: '#10b981', glow: 'rgba(16,185,129,0.4)'  },
  intermediate:{ bg: '#2d1a00', border: '#f59e0b', text: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  target:      { bg: '#3b0a0a', border: '#ef4444', text: '#ef4444', glow: 'rgba(239,68,68,0.4)'   },
  blast:       { bg: '#1a0a2e', border: '#a855f7', text: '#a855f7', glow: 'rgba(168,85,247,0.35)' },
  unaffected:  { bg: '#0d1424', border: '#1e3a5f', text: '#334155', glow: 'none'                   },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dagre auto-layout
// ─────────────────────────────────────────────────────────────────────────────
function applyDagre(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 70, ranksep: 90 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared custom node renderer
// ─────────────────────────────────────────────────────────────────────────────
const CortexNode = ({ data }) => {
  const s = C[data.role] ?? C.unaffected;
  return (
    <div
      style={{
        background:   s.bg,
        border:       `1.5px solid ${s.border}`,
        borderRadius: 10,
        padding:      '10px 16px',
        minWidth:     NODE_W,
        boxShadow:    s.glow !== 'none' ? `0 0 18px ${s.glow}` : 'none',
        fontFamily:   "'JetBrains Mono', monospace",
        opacity:      data.role === 'unaffected' ? 0.45 : 1,
        position:     'relative',
        transition:   'box-shadow 0.2s',
      }}
    >
      {/* Badge */}
      {data.badge && (
        <div style={{ fontSize: 8, color: s.text, fontWeight: 700, letterSpacing: 1.2, marginBottom: 5, textTransform: 'uppercase' }}>
          {data.badge}
        </div>
      )}

      {/* Label */}
      <div style={{ fontSize: 12, fontWeight: 600, color: s.text, wordBreak: 'break-all', lineHeight: 1.35 }}>
        {data.label}
      </div>

      {/* Step badge (attack-path view) */}
      {data.stepIndex !== undefined && (
        <div style={{
          position:       'absolute',
          top:            -11,
          right:          -11,
          background:     s.border,
          color:          '#030712',
          borderRadius:   '50%',
          width:          22,
          height:         22,
          fontSize:       10,
          fontWeight:     800,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          boxShadow:      `0 0 8px ${s.glow}`,
        }}>
          {data.stepIndex}
        </div>
      )}

      {/* Depth tag (blast-radius view) */}
      {data.depth !== undefined && (
        <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>
          depth: {data.depth}
        </div>
      )}
    </div>
  );
};

const nodeTypes = { cortexNode: CortexNode };

// ─────────────────────────────────────────────────────────────────────────────
// View 1 — Active Attack Path  (only nodes in attack_path)
// ─────────────────────────────────────────────────────────────────────────────
function buildAttackPathView(phase4Data) {
  const { attack_path = [], full_graph } = phase4Data;
  if (!attack_path.length) return { nodes: [], edges: [] };

  // Build attack-edge set for quick lookup
  const attackEdgeSet = new Set(
    attack_path.slice(0, -1).map((src, i) => `${src}||${attack_path[i + 1]}`)
  );

  // ── Nodes: only those present in attack_path ──
  const attackSet = new Set(attack_path);
  const sourceNodes = full_graph?.nodes?.filter((n) => attackSet.has(n.id)) ?? [];

  const rfNodes = sourceNodes.length
    ? sourceNodes.map((n) => {
        const idx = attack_path.indexOf(n.id);
        const role =
          idx === 0                           ? 'entry'
          : idx === attack_path.length - 1   ? 'target'
          : 'intermediate';
        return {
          id:   n.id,
          type: 'cortexNode',
          position: { x: 0, y: 0 },
          data: {
            label:     n.id,
            role,
            badge:
              role === 'entry'        ? '⚡ Entry Point'
              : role === 'target'     ? '🎯 Vulnerable Target'
              : null,
            stepIndex: idx + 1,
          },
        };
      })
    : attack_path.map((id, i) => ({
        id,
        type: 'cortexNode',
        position: { x: 0, y: 0 },
        data: {
          label:     id,
          role:      i === 0 ? 'entry' : i === attack_path.length - 1 ? 'target' : 'intermediate',
          badge:
            i === 0                       ? '⚡ Entry Point'
            : i === attack_path.length - 1 ? '🎯 Vulnerable Target'
            : null,
          stepIndex: i + 1,
        },
      }));

  // ── Edges: only attack-path edges ──
  const rfEdges = attack_path.slice(0, -1).map((src, i) => ({
    id:       `ap-${i}`,
    source:   src,
    target:   attack_path[i + 1],
    animated: true,
    style:    { stroke: '#ef4444', strokeWidth: 3 },
    markerEnd:{ type: MarkerType.ArrowClosed, color: '#ef4444' },
  }));

  return { nodes: applyDagre(rfNodes, rfEdges, 'TB'), edges: rfEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// View 2 — Full System + Blast Radius  (entire full_graph coloured by role)
// ─────────────────────────────────────────────────────────────────────────────
function buildFullSystemView(phase4Data, phase5Data) {
  const { attack_path = [], full_graph } = phase4Data ?? {};
  const blastNodes = new Set(
    (phase5Data?.blast_propagation ?? []).map((b) => b.node)
  );

  const attackSet = new Set(attack_path);

  function resolveRole(nodeId) {
    if (nodeId === attack_path[0])                    return 'entry';
    if (nodeId === attack_path.at(-1))                return 'target';
    if (attackSet.has(nodeId))                        return 'intermediate';
    if (blastNodes.has(nodeId))                       return 'blast';
    return 'unaffected';
  }

  // ── Nodes ──
  const sourceNodes = full_graph?.nodes ?? [];
  const rfNodes = sourceNodes.map((n) => {
    const role = resolveRole(n.id);
    const idx  = attack_path.indexOf(n.id);
    const bItem = phase5Data?.blast_propagation?.find((b) => b.node === n.id);
    return {
      id:   n.id,
      type: 'cortexNode',
      position: { x: 0, y: 0 },
      data: {
        label:     n.id,
        role,
        badge:
          role === 'entry'        ? '⚡ Entry Point'
          : role === 'target'     ? '🎯 Vulnerable Target'
          : role === 'blast'      ? '💥 Blast Impact'
          : null,
        stepIndex: role === 'entry' || role === 'target' || role === 'intermediate'
          ? idx >= 0 ? idx + 1 : undefined
          : undefined,
        depth:     bItem?.depth,
      },
    };
  });

  // ── Edges ──
  const attackEdgeSet = new Set(
    attack_path.slice(0, -1).map((src, i) => `${src}||${attack_path[i + 1]}`)
  );

  const rfEdges = (full_graph?.edges ?? []).map((e, idx) => {
    const key          = `${e.source}||${e.target}`;
    const isAttack     = attackEdgeSet.has(key);
    const isBlastEdge  = blastNodes.has(e.target);
    return {
      id:       e.id ?? `fe-${idx}`,
      source:   e.source,
      target:   e.target,
      animated: isAttack,
      style: isAttack
        ? { stroke: '#ef4444', strokeWidth: 3 }
        : isBlastEdge
        ? { stroke: '#a855f7', strokeWidth: 2, opacity: 0.7 }
        : { stroke: '#1e3a5f', strokeWidth: 1, opacity: 0.35 },
      markerEnd: {
        type:  MarkerType.ArrowClosed,
        color: isAttack ? '#ef4444' : isBlastEdge ? '#a855f7' : '#1e3a5f',
      },
    };
  });

  return { nodes: applyDagre(rfNodes, rfEdges, 'TB'), edges: rfEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blast-radius only (Phase 5 standalone, no full_graph available)
// ─────────────────────────────────────────────────────────────────────────────
function buildBlastView(phase5Data) {
  const { root_cause_function: root, blast_propagation = [] } = phase5Data;

  const rfNodes = [
    {
      id:   root,
      type: 'cortexNode',
      position: { x: 0, y: 0 },
      data: { label: root, role: 'target', badge: '💥 Root Cause' },
    },
    ...blast_propagation.map((item) => ({
      id:   item.node,
      type: 'cortexNode',
      position: { x: 0, y: 0 },
      data: {
        label: item.node,
        role:  'blast',
        badge: item.is_critical ? '⚠ Critical' : null,
        depth: item.depth,
      },
    })),
  ];

  const byDepth = {};
  blast_propagation.forEach((item) => {
    (byDepth[item.depth] ??= []).push(item.node);
  });

  const rfEdges = blast_propagation.map((item, idx) => {
    const parentDepth = item.depth - 1;
    const parents     = parentDepth === 0 ? [root] : byDepth[parentDepth] ?? [root];
    const parent      = parents[idx % parents.length];
    return {
      id:       `blast-${idx}`,
      source:   parent,
      target:   item.node,
      animated: item.is_critical,
      style: { stroke: item.is_critical ? '#a855f7' : '#1e3a5f', strokeWidth: item.is_critical ? 2.5 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: item.is_critical ? '#a855f7' : '#1e3a5f' },
    };
  });

  return { nodes: applyDagre(rfNodes, rfEdges, 'TB'), edges: rfEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend dot helper
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MUI Tab styling helpers
// ─────────────────────────────────────────────────────────────────────────────
const tabSx = {
  fontFamily:    "'JetBrains Mono', monospace",
  fontSize:      11,
  fontWeight:    600,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color:         '#475569',
  minHeight:     36,
  py:            0,
  '&.Mui-selected': { color: '#00d4ff' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main GraphCanvas component
// ─────────────────────────────────────────────────────────────────────────────
export default function GraphCanvas({ mode, phase4Data, phase5Data }) {
  const [graphTab, setGraphTab] = useState(0); // 0 = attack path, 1 = full system
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const hasPhase4 = !!phase4Data?.attack_path?.length;
  const hasPhase5 = !!phase5Data;

  // Rebuild graph whenever data or selected tab changes
  useEffect(() => {
    if (mode === 'phase4' && hasPhase4) {
      if (graphTab === 0) {
        // View 1: Attack path only
        const { nodes: n, edges: e } = buildAttackPathView(phase4Data);
        setNodes(n); setEdges(e);
      } else {
        // View 2: Full system (phase5 may be null — that's fine)
        const { nodes: n, edges: e } = buildFullSystemView(phase4Data, phase5Data);
        setNodes(n); setEdges(e);
      }
    } else if (mode === 'phase5' && hasPhase5) {
      // Phase 5 standalone (phase4Data cleared): show blast view on both tabs
      const { nodes: n, edges: e } = buildBlastView(phase5Data);
      setNodes(n); setEdges(e);
    } else {
      setNodes([]); setEdges([]);
    }
  }, [mode, phase4Data, phase5Data, graphTab]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const isEmpty = nodes.length === 0;

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* ── Tab bar + legend strip ── */}
      <Box sx={{
        display:         'flex',
        alignItems:      'center',
        px:              1.5,
        borderBottom:    '1px solid #1a2744',
        background:      'linear-gradient(90deg, rgba(13,20,36,0.98) 0%, rgba(10,15,30,0.95) 100%)',
        backdropFilter:  'blur(6px)',
        flexShrink:      0,
        minHeight:       40,
        gap:             2,
      }}>
        {/* Tabs — only shown when phase4 data is available */}
        {hasPhase4 && mode === 'phase4' ? (
          <Tabs
            value={graphTab}
            onChange={(_, v) => setGraphTab(v)}
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': { backgroundColor: '#00d4ff', height: 2 },
            }}
          >
            <Tab
              icon={<RouteIcon sx={{ fontSize: 13, mr: 0.5 }} />}
              iconPosition="start"
              label="Active Attack Path"
              sx={tabSx}
            />
            <Tab
              icon={<BubbleChartIcon sx={{ fontSize: 13, mr: 0.5 }} />}
              iconPosition="start"
              label="Full System & Blast Radius"
              sx={tabSx}
            />
          </Tabs>
        ) : (
          <Typography sx={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
            color: '#334155', letterSpacing: 1.5, textTransform: 'uppercase', py: 1,
          }}>
            {mode === 'phase5'
              ? `Blast Radius — ${phase5Data?.total_impacted_nodes ?? 0} impacted nodes`
              : 'Graph Visualization Canvas'}
          </Typography>
        )}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Legend chips */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
          {(mode === 'phase4' || mode === 'phase5') && (
            <>
              <Dot color="#10b981" label="Entry Point" />
              <Dot color="#f59e0b" label="Intermediate" />
              <Dot color="#ef4444" label="Vulnerable Target" />
              {(graphTab === 1 || mode === 'phase5') && (
                <Dot color="#a855f7" label="Blast Impact" />
              )}
              {graphTab === 1 && (
                <Dot color="#1e3a5f" label="Unaffected" />
              )}
            </>
          )}

          {/* Node / Edge count chips */}
          {nodes.length > 0 && (
            <>
              <Chip
                label={`${nodes.length} nodes`}
                size="small"
                sx={{ height: 18, fontSize: 9, fontFamily: 'monospace', bgcolor: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', '& .MuiChip-label': { px: 1 } }}
              />
              <Chip
                label={`${edges.length} edges`}
                size="small"
                sx={{ height: 18, fontSize: 9, fontFamily: 'monospace', bgcolor: 'rgba(255,45,85,0.08)', color: '#ff2d55', border: '1px solid rgba(255,45,85,0.2)', '& .MuiChip-label': { px: 1 } }}
              />
            </>
          )}
        </Box>
      </Box>

      {/* ── Graph canvas ── */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
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
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.12}
            maxZoom={3}
            attributionPosition="bottom-right"
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1a2744" />
            <Controls
              style={{
                background:   '#0d1424',
                border:       '1px solid #1a2744',
                borderRadius: 8,
              }}
            />
            <MiniMap
              nodeColor={(n) => {
                const role = n.data?.role;
                if (role === 'entry')        return '#10b981';
                if (role === 'target')       return '#ef4444';
                if (role === 'intermediate') return '#f59e0b';
                if (role === 'blast')        return '#a855f7';
                return '#1e293b';
              }}
              style={{
                background:   '#0a0f1e',
                border:       '1px solid #1a2744',
                borderRadius: 8,
              }}
              maskColor="rgba(3,7,18,0.85)"
            />
          </ReactFlow>
        )}
      </Box>
    </Box>
  );
}
