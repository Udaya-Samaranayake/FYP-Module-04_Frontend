import React, { useCallback } from 'react';
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
import 'reactflow/dist/style.css';

// ── Custom Node: Attack Path Node ────────────────────────────────────────────
const AttackNode = ({ data }) => {
  const borderColor =
    data.role === 'entry'
      ? '#00d4ff'
      : data.role === 'target'
      ? '#ff2d55'
      : '#1e3a5f';
  const glowColor =
    data.role === 'entry'
      ? 'rgba(0,212,255,0.35)'
      : data.role === 'target'
      ? 'rgba(255,45,85,0.35)'
      : 'rgba(30,58,95,0.3)';
  const labelColor =
    data.role === 'entry'
      ? '#00d4ff'
      : data.role === 'target'
      ? '#ff2d55'
      : '#94a3b8';
  const badgeText =
    data.role === 'entry'
      ? '⚡ ENTRY POINT'
      : data.role === 'target'
      ? '🎯 VULNERABLE TARGET'
      : null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0d1424 0%, #0a0f1e 100%)',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: '12px 18px',
        minWidth: 180,
        boxShadow: `0 0 14px ${glowColor}, inset 0 0 12px rgba(0,0,0,0.5)`,
        fontFamily: "'JetBrains Mono', monospace",
        position: 'relative',
      }}
    >
      {badgeText && (
        <div
          style={{
            fontSize: 9,
            color: labelColor,
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 4,
            textTransform: 'uppercase',
          }}
        >
          {badgeText}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: labelColor,
          wordBreak: 'break-all',
        }}
      >
        {data.label}
      </div>
      {data.stepIndex !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            background: borderColor,
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

// ── Custom Node: Blast Radius Node ────────────────────────────────────────────
const BlastNode = ({ data }) => {
  const isRoot = data.role === 'root';
  const isCritical = data.is_critical;
  const borderColor = isRoot
    ? '#ff2d55'
    : isCritical
    ? '#ffd700'
    : '#1e3a5f';
  const glowColor = isRoot
    ? 'rgba(255,45,85,0.4)'
    : isCritical
    ? 'rgba(255,215,0,0.25)'
    : 'rgba(0,255,136,0.1)';
  const labelColor = isRoot
    ? '#ff2d55'
    : isCritical
    ? '#ffd700'
    : '#94a3b8';

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0d1424 0%, #0a0f1e 100%)',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        padding: '10px 16px',
        minWidth: 160,
        boxShadow: `0 0 12px ${glowColor}, inset 0 0 10px rgba(0,0,0,0.4)`,
        fontFamily: "'JetBrains Mono', monospace",
        position: 'relative',
      }}
    >
      {isRoot && (
        <div
          style={{
            fontSize: 9,
            color: '#ff2d55',
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          💥 ROOT CAUSE
        </div>
      )}
      {isCritical && !isRoot && (
        <div
          style={{
            fontSize: 9,
            color: '#ffd700',
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          ⚠ CRITICAL
        </div>
      )}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: labelColor,
          wordBreak: 'break-all',
        }}
      >
        {data.label}
      </div>
      {data.depth !== undefined && (
        <div
          style={{
            fontSize: 9,
            color: '#475569',
            marginTop: 4,
          }}
        >
          depth: {data.depth}
        </div>
      )}
    </div>
  );
};

const nodeTypes = { attackNode: AttackNode, blastNode: BlastNode };

// ── Layout helpers ────────────────────────────────────────────────────────────
const buildAttackPathGraph = (attackPath, rootCause) => {
  const nodes = attackPath.map((nodeId, i) => ({
    id: nodeId,
    type: 'attackNode',
    position: { x: i * 240 + 40, y: 160 },
    data: {
      label: nodeId,
      role:
        i === 0
          ? 'entry'
          : i === attackPath.length - 1
          ? 'target'
          : 'intermediate',
      stepIndex: i + 1,
    },
  }));

  const edges = attackPath.slice(0, -1).map((src, i) => ({
    id: `e-${i}`,
    source: src,
    target: attackPath[i + 1],
    animated: true,
    style: { stroke: '#00ff88', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#00ff88' },
  }));

  return { nodes, edges };
};

const buildBlastRadiusGraph = (rootCause, blastPropagation) => {
  // Group by depth for layered layout
  const depthGroups = {};
  blastPropagation.forEach((item) => {
    if (!depthGroups[item.depth]) depthGroups[item.depth] = [];
    depthGroups[item.depth].push(item);
  });

  const nodes = [
    {
      id: rootCause,
      type: 'blastNode',
      position: { x: 400, y: 40 },
      data: { label: rootCause, role: 'root', is_critical: false },
    },
  ];

  const edges = [];
  const nodePositions = { [rootCause]: { x: 400, y: 40 } };

  Object.entries(depthGroups).forEach(([depth, items]) => {
    const y = Number(depth) * 160 + 40;
    const totalWidth = items.length * 220;
    const startX = 400 - totalWidth / 2 + 110;

    items.forEach((item, i) => {
      const x = startX + i * 220;
      nodes.push({
        id: item.node,
        type: 'blastNode',
        position: { x, y },
        data: {
          label: item.node,
          role: 'impacted',
          is_critical: item.is_critical,
          depth: item.depth,
        },
      });
      nodePositions[item.node] = { x, y };
    });
  });

  // Build edges: connect each node to its parent by finding which node at
  // depth-1 could be its parent. We approximate by connecting to rootCause
  // for depth 1, and scanning for nearest depth-1 predecessors otherwise.
  // Since the backend doesn't return explicit parent info, we connect to any
  // node at (depth-1) that was discovered before it — default: chain to root.
  const byDepth = {};
  blastPropagation.forEach((item) => {
    if (!byDepth[item.depth]) byDepth[item.depth] = [];
    byDepth[item.depth].push(item.node);
  });

  blastPropagation.forEach((item, idx) => {
    const parentDepth = item.depth - 1;
    const parents =
      parentDepth === 0 ? [rootCause] : byDepth[parentDepth] || [rootCause];
    // Distribute children across parents round-robin
    const parent = parents[idx % parents.length];
    edges.push({
      id: `e-blast-${idx}`,
      source: parent,
      target: item.node,
      animated: true,
      style: {
        stroke: item.is_critical ? '#ffd700' : '#334155',
        strokeWidth: item.is_critical ? 2.5 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: item.is_critical ? '#ffd700' : '#334155',
      },
    });
  });

  return { nodes, edges };
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function GraphCanvas({ mode, phase4Data, phase5Data }) {
  let rfNodes = [];
  let rfEdges = [];

  if (mode === 'phase4' && phase4Data?.attack_path?.length) {
    const g = buildAttackPathGraph(phase4Data.attack_path);
    rfNodes = g.nodes;
    rfEdges = g.edges;
  } else if (mode === 'phase5' && phase5Data?.blast_propagation?.length) {
    const g = buildBlastRadiusGraph(
      phase5Data.root_cause_function,
      phase5Data.blast_propagation
    );
    rfNodes = g.nodes;
    rfEdges = g.edges;
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Update when props change
  React.useEffect(() => {
    if (mode === 'phase4' && phase4Data?.attack_path?.length) {
      const g = buildAttackPathGraph(phase4Data.attack_path);
      setNodes(g.nodes);
      setEdges(g.edges);
    } else if (mode === 'phase5' && phase5Data?.blast_propagation?.length) {
      const g = buildBlastRadiusGraph(
        phase5Data.root_cause_function,
        phase5Data.blast_propagation
      );
      setNodes(g.nodes);
      setEdges(g.edges);
    }
  }, [mode, phase4Data, phase5Data]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const isEmpty = rfNodes.length === 0;

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
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          attributionPosition="bottom-right"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1}
            color="#1a2744"
          />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.data?.role === 'entry') return '#00d4ff';
              if (n.data?.role === 'target' || n.data?.role === 'root') return '#ff2d55';
              if (n.data?.is_critical) return '#ffd700';
              return '#1e3a5f';
            }}
            maskColor="rgba(3,7,18,0.85)"
          />
        </ReactFlow>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
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
      {/* Animated hex grid background hint */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
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
            position: 'relative',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="#1a2744"
              strokeWidth="1.5"
            />
            <path
              d="M2 17L12 22L22 17M2 12L12 17L22 12"
              stroke="#1e3a5f"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <p
          style={{
            color: '#334155',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Awaiting analysis input
        </p>
        <p
          style={{
            color: '#1e3a5f',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            marginTop: 6,
            letterSpacing: 0.5,
          }}
        >
          Enter a target node and run Phase 4 or Phase 5
        </p>
      </div>
    </div>
  );
}
