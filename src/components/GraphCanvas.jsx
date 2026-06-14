import React, { useCallback, useEffect } from 'react';
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

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const NODE_W = 200;
const NODE_H = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Dagre auto-layout helper
// Mutates the passed nodes array in-place by assigning .position from dagre.
// ─────────────────────────────────────────────────────────────────────────────
function applyDagreLayout(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Node role resolver for attack path
// ─────────────────────────────────────────────────────────────────────────────
function getAttackRole(nodeId, attackPath) {
  if (!attackPath?.length) return 'background';
  if (nodeId === attackPath[0]) return 'start';
  if (nodeId === attackPath[attackPath.length - 1]) return 'target';
  if (attackPath.includes(nodeId)) return 'intermediate';
  return 'background';
}

// ─────────────────────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────────────────────
const ATTACK_STYLE = {
  start: {
    background: '#064e3b',
    border: '2px solid #10b981',
    color: '#10b981',
    badge: '⚡ ENTRY POINT',
    glow: 'rgba(16,185,129,0.35)',
  },
  target: {
    background: '#7f1d1d',
    border: '2px solid #ef4444',
    color: '#ef4444',
    badge: '🎯 VULNERABLE TARGET',
    glow: 'rgba(239,68,68,0.35)',
  },
  intermediate: {
    background: '#78350f',
    border: '2px solid #f59e0b',
    color: '#f59e0b',
    badge: null,
    glow: 'rgba(245,158,11,0.25)',
  },
  background: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#475569',
    badge: null,
    glow: 'none',
    opacity: 0.5,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom Nodes
// ─────────────────────────────────────────────────────────────────────────────

/** Attack-path node — used for Phase 4 full_graph rendering */
const AttackPathNode = ({ data }) => {
  const s = ATTACK_STYLE[data.role] || ATTACK_STYLE.background;
  return (
    <div
      style={{
        background: s.background,
        border: s.border,
        borderRadius: 10,
        padding: '10px 16px',
        minWidth: NODE_W,
        boxShadow: s.glow !== 'none' ? `0 0 14px ${s.glow}` : 'none',
        fontFamily: "'JetBrains Mono', monospace",
        opacity: data.role === 'background' ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {s.badge && (
        <div style={{ fontSize: 9, color: s.color, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          {s.badge}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: s.color, wordBreak: 'break-all' }}>
        {data.label}
      </div>
      {data.stepIndex !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            background: s.border.split(' ').pop(), // extract hex from border string
            color: '#030712',
            borderRadius: '50%',
            width: 20,
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {data.stepIndex}
        </div>
      )}
    </div>
  );
};

/** Blast-radius node — used for Phase 5 rendering */
const BlastNode = ({ data }) => {
  const isRoot = data.role === 'root';
  const isCritical = data.is_critical;
  const borderColor = isRoot ? '#ef4444' : isCritical ? '#ffd700' : '#1e3a5f';
  const glowColor = isRoot
    ? 'rgba(239,68,68,0.4)'
    : isCritical
    ? 'rgba(255,215,0,0.25)'
    : 'rgba(0,255,136,0.08)';
  const labelColor = isRoot ? '#ef4444' : isCritical ? '#ffd700' : '#94a3b8';

  return (
    <div
      style={{
        background: isRoot ? '#7f1d1d' : isCritical ? '#422006' : '#0d1424',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 16px',
        minWidth: 160,
        boxShadow: `0 0 12px ${glowColor}`,
        fontFamily: "'JetBrains Mono', monospace",
        position: 'relative',
      }}
    >
      {isRoot && (
        <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          💥 ROOT CAUSE
        </div>
      )}
      {isCritical && !isRoot && (
        <div style={{ fontSize: 9, color: '#ffd700', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          ⚠ CRITICAL
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: labelColor, wordBreak: 'break-all' }}>
        {data.label}
      </div>
      {data.depth !== undefined && (
        <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>depth: {data.depth}</div>
      )}
    </div>
  );
};

const nodeTypes = { attackPathNode: AttackPathNode, blastNode: BlastNode };

// ─────────────────────────────────────────────────────────────────────────────
// Graph builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 4 — builds from full_graph + attack_path.
 * Uses dagre for layout; edges on the attack path are animated red.
 */
function buildAttackPathGraph(phase4Data) {
  const { attack_path = [], full_graph } = phase4Data;

  // Build a Set of adjacent pairs on the attack path for fast lookup
  const attackEdgeSet = new Set();
  for (let i = 0; i < attack_path.length - 1; i++) {
    attackEdgeSet.add(`${attack_path[i]}||${attack_path[i + 1]}`);
  }

  // ── Nodes ──
  let rfNodes;
  if (full_graph?.nodes?.length) {
    rfNodes = full_graph.nodes.map((n) => {
      const role = getAttackRole(n.id, attack_path);
      const stepIndex = attack_path.indexOf(n.id);
      return {
        id: n.id,
        type: 'attackPathNode',
        position: { x: 0, y: 0 }, // dagre will set real positions
        data: {
          label: n.id,
          role,
          stepIndex: stepIndex >= 0 ? stepIndex + 1 : undefined,
        },
      };
    });
  } else {
    // Fallback: only the attack path nodes
    rfNodes = attack_path.map((id, i) => ({
      id,
      type: 'attackPathNode',
      position: { x: 0, y: 0 },
      data: {
        label: id,
        role: getAttackRole(id, attack_path),
        stepIndex: i + 1,
      },
    }));
  }

  // ── Edges ──
  let rfEdges;
  if (full_graph?.edges?.length) {
    rfEdges = full_graph.edges.map((e, idx) => {
      const key = `${e.source}||${e.target}`;
      const isAttackEdge = attackEdgeSet.has(key);
      return {
        id: e.id ?? `e-${idx}`,
        source: e.source,
        target: e.target,
        animated: isAttackEdge,
        style: isAttackEdge
          ? { stroke: '#ef4444', strokeWidth: 3 }
          : { stroke: '#334155', strokeWidth: 1, opacity: 0.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isAttackEdge ? '#ef4444' : '#334155',
        },
      };
    });
  } else {
    // Fallback: only attack-path edges
    rfEdges = attack_path.slice(0, -1).map((src, i) => ({
      id: `e-${i}`,
      source: src,
      target: attack_path[i + 1],
      animated: true,
      style: { stroke: '#ef4444', strokeWidth: 3 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
    }));
  }

  // Apply dagre layout (top→bottom)
  const laidOutNodes = applyDagreLayout(rfNodes, rfEdges, 'TB');
  return { nodes: laidOutNodes, edges: rfEdges };
}

/**
 * Phase 5 — blast radius graph with dagre layout.
 */
function buildBlastRadiusGraph(phase5Data) {
  const { root_cause_function: rootCause, blast_propagation = [] } = phase5Data;

  const rfNodes = [
    {
      id: rootCause,
      type: 'blastNode',
      position: { x: 0, y: 0 },
      data: { label: rootCause, role: 'root', is_critical: false },
    },
    ...blast_propagation.map((item) => ({
      id: item.node,
      type: 'blastNode',
      position: { x: 0, y: 0 },
      data: { label: item.node, role: 'impacted', is_critical: item.is_critical, depth: item.depth },
    })),
  ];

  // Group by depth for parent assignment
  const byDepth = {};
  blast_propagation.forEach((item) => {
    if (!byDepth[item.depth]) byDepth[item.depth] = [];
    byDepth[item.depth].push(item.node);
  });

  const rfEdges = blast_propagation.map((item, idx) => {
    const parentDepth = item.depth - 1;
    const parents = parentDepth === 0 ? [rootCause] : byDepth[parentDepth] || [rootCause];
    const parent = parents[idx % parents.length];
    return {
      id: `e-blast-${idx}`,
      source: parent,
      target: item.node,
      animated: item.is_critical,
      style: {
        stroke: item.is_critical ? '#ffd700' : '#334155',
        strokeWidth: item.is_critical ? 2.5 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: item.is_critical ? '#ffd700' : '#334155',
      },
    };
  });

  const laidOutNodes = applyDagreLayout(rfNodes, rfEdges, 'TB');
  return { nodes: laidOutNodes, edges: rfEdges };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function GraphCanvas({ mode, phase4Data, phase5Data }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (mode === 'phase4' && phase4Data?.attack_path?.length) {
      const { nodes: n, edges: e } = buildAttackPathGraph(phase4Data);
      setNodes(n);
      setEdges(e);
    } else if (mode === 'phase5' && phase5Data?.blast_propagation?.length) {
      const { nodes: n, edges: e } = buildBlastRadiusGraph(phase5Data);
      setNodes(n);
      setEdges(e);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [mode, phase4Data, phase5Data]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const isEmpty = nodes.length === 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
          minZoom={0.2}
          maxZoom={2.5}
          attributionPosition="bottom-right"
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1a2744" />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const role = n.data?.role;
              if (role === 'start') return '#10b981';
              if (role === 'target' || role === 'root') return '#ef4444';
              if (role === 'intermediate') return '#f59e0b';
              if (n.data?.is_critical) return '#ffd700';
              return '#1e293b';
            }}
            maskColor="rgba(3,7,18,0.85)"
          />
        </ReactFlow>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#0a0f1e',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '2px solid #1a2744',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#1a2744" strokeWidth="1.5" />
            <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="#1e3a5f" strokeWidth="1.5" />
          </svg>
        </div>
        <p style={{ color: '#334155', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
          Awaiting Analysis Input
        </p>
        <p style={{ color: '#1e3a5f', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginTop: 6, letterSpacing: 0.5 }}>
          Enter a target node and run Phase 4 or Phase 5
        </p>
      </div>
    </div>
  );
}
