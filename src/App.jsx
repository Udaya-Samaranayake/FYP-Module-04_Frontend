import { useState } from 'react';
import {
  ShieldAlert, Target, Network, Zap, AlertTriangle,
  CheckCircle, XCircle, Loader2, Activity, Radio,
  GitBranch, Search, RefreshCw, Cpu, ArrowDownToLine
} from 'lucide-react';
import GraphCanvas from './components/GraphCanvas';
import { runReachability, calculateBlastRadius, findRootCauseFunction, API_BASE_URL } from './api/cortexApi';

// ─────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    green:  { border: '#00ff88', glow: 'rgba(0,255,136,0.15)', text: '#00ff88' },
    red:    { border: '#ff2d55', glow: 'rgba(255,45,85,0.15)',  text: '#ff2d55' },
    blue:   { border: '#00d4ff', glow: 'rgba(0,212,255,0.15)', text: '#00d4ff' },
    yellow: { border: '#ffd700', glow: 'rgba(255,215,0,0.15)', text: '#ffd700' },
    gray:   { border: '#1e3a5f', glow: 'rgba(30,58,95,0.1)',   text: '#64748b' },
  };
  const c = colors[color] || colors.gray;

  return (
    <div style={{
      background: 'linear-gradient(135deg,#0d1424 0%,#0a0f1e 100%)',
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: '16px 20px',
      flex: 1,
      minWidth: 0,
      boxShadow: `0 0 20px ${c.glow}`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      transition: 'box-shadow 0.3s',
    }}>
      <div style={{
        width: 44, height: 44,
        borderRadius: 10,
        background: c.glow,
        border: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={20} color={c.text} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: c.text, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
          {value ?? '—'}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar button
// ─────────────────────────────────────────────
function SideBtn({ label, icon: Icon, color, onClick, loading, disabled }) {
  const c = color === 'green'
    ? { border: '#00ff88', glow: 'rgba(0,255,136,0.2)', bg: 'rgba(0,255,136,0.07)', text: '#00ff88' }
    : color === 'blue'
    ? { border: '#00d4ff', glow: 'rgba(0,212,255,0.2)', bg: 'rgba(0,212,255,0.07)', text: '#00d4ff' }
    : { border: '#ff2d55', glow: 'rgba(255,45,85,0.2)',  bg: 'rgba(255,45,85,0.07)',  text: '#ff2d55' };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        padding: '11px 14px',
        background: disabled ? '#0d1424' : c.bg,
        border: `1px solid ${disabled ? '#1a2744' : c.border}`,
        borderRadius: 8,
        color: disabled ? '#334155' : c.text,
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s',
        boxShadow: disabled ? 'none' : `0 0 12px ${c.glow}`,
        letterSpacing: 0.5,
      }}
    >
      {loading
        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        : <Icon size={14} />}
      <span style={{ flex: 1, textAlign: 'left', lineHeight: 1.3 }}>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// Result log row
// ─────────────────────────────────────────────
function LogRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #0d1424' }}>
      <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: valueColor || '#94a3b8', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, maxWidth: '55%', wordBreak: 'break-all', textAlign: 'right' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────
export default function App() {
  const [targetNode, setTargetNode] = useState('');
  const [cveId, setCveId] = useState('');
  const [phase3Data, setPhase3Data] = useState(null);
  const [phase4Data, setPhase4Data] = useState(null);
  const [phase5Data, setPhase5Data] = useState(null);
  const [phase4ReachableSnapshot, setPhase4ReachableSnapshot] = useState(null); // persists across Phase 5 run
  const [activeMode, setActiveMode] = useState(null); // 'phase3' | 'phase4' | 'phase5'
  const [loading3, setLoading3] = useState(false);
  const [loading4, setLoading4] = useState(false);
  const [loading5, setLoading5] = useState(false);
  const [error, setError] = useState(null);

  const handlePhase3 = async () => {
    if (!cveId.trim()) return;
    setError(null);
    setLoading3(true);
    try {
      const data = await findRootCauseFunction(cveId);

      // Debug: inspect the raw response shape from the backend
      console.log('Phase 3 Success Data:', data);

      setPhase3Data(data);
      setActiveMode('phase3');

      // Backend returns { signature: string, confidence: number }
      // Fall back to other possible keys in case the backend schema changes.
      const extracted =
        data?.signature ||
        data?.vulnerable_signature ||
        data?.matched_node ||
        data?.function_name ||
        null;

      if (extracted) {
        setTargetNode(extracted);
      } else {
        console.warn('Phase 3: No recognisable signature key found in response.', data);
        setError('Phase 3 succeeded but no function signature was returned. Check the console for the raw response.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading3(false);
    }
  };

  const handlePhase4 = async () => {
    if (!targetNode.trim()) return;
    setError(null);
    setLoading4(true);
    try {
      const data = await runReachability(targetNode);

      // ── Normalise the backend response ────────────────────────────────────
      // Backend returns: { attack_path: string[], full_graph: { nodes, edges } }
      // It does NOT include `is_reachable`, `target_node`, or `status`.
      // We derive them client-side so every downstream consumer is correct.
      const attackPath  = data.attack_path ?? [];
      const isReachable = attackPath.length > 0;
      const entryPoint  = attackPath[0]  ?? null;          // e.g. 'publicRouter'
      const targetSink  = attackPath.at(-1) ?? null;       // e.g. 'Log4jJNDIValidator'

      console.log('[Phase 4] is_reachable  :', isReachable);
      console.log('[Phase 4] entry_point   :', entryPoint);
      console.log('[Phase 4] target_sink   :', targetSink);
      console.log('[Phase 4] path_length   :', attackPath.length);
      console.log('[Phase 4] path          :', attackPath);

      const normalised = {
        ...data,
        is_reachable : isReachable,
        target_node  : targetSink,
        entry_point  : entryPoint,
        status: isReachable
          ? `Attack path confirmed — ${attackPath.length} hop${attackPath.length !== 1 ? 's' : ''} via ${entryPoint}`
          : 'No path to a public entry point found',
      };

      // Snapshot reachability immediately so Phase 5's severity formula can
      // read it even after phase4Data is cleared when the blast graph renders.
      setPhase4ReachableSnapshot(isReachable);

      setPhase4Data(normalised);
      setPhase5Data(null);
      setActiveMode('phase4');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading4(false);
    }
  };

  const handlePhase5 = async () => {
    if (!targetNode.trim()) return;
    setError(null);
    setLoading5(true);
    try {
      const data = await calculateBlastRadius(targetNode);
      // Snapshot the Phase 4 reachability BEFORE clearing phase4Data from the graph,
      // so the severity scoring logic can still read it.
      if (phase4Data !== null) {
        setPhase4ReachableSnapshot(phase4Data.is_reachable);
      }
      setPhase5Data(data);
      setPhase4Data(null); // clear graph nodes; reachability context kept in snapshot
      setActiveMode('phase5');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading5(false);
    }
  };

  const handleReset = () => {
    setCveId('');
    setPhase3Data(null);
    setPhase4Data(null);
    setPhase5Data(null);
    setPhase4ReachableSnapshot(null);
    setActiveMode(null);
    setError(null);
    setTargetNode('');
  };

  // ── Derived metric values ──────────────────────────────────────────────
  const isReachable      = phase4Data?.is_reachable;
  const blastRadiusCount = phase5Data?.total_impacted_nodes ?? null;

  // phase4WasReachable: true if the CURRENT phase4 result says reachable, OR
  // if we captured a snapshot from a prior Phase 4 run before Phase 5 cleared it.
  const phase4WasReachable = isReachable === true || phase4ReachableSnapshot === true;

  // Computed Severity Score:
  //   • Base 7.5 if Phase 4 confirmed REACHABLE (critical by definition).
  //   • +0.5 per downstream node found in Phase 5 blast radius.
  //   • Capped at 10.0. Falls back to raw backend score if Phase 4 wasn't run.
  const REACHABLE_BASE   = 7.5;
  const BLAST_MODIFIER   = 0.5;
  const MAX_SCORE        = 10.0;

  const computedSeverityScore = (() => {
    if (phase5Data !== null) {
      if (phase4WasReachable) {
        // Phase 5 ran after a confirmed REACHABLE Phase 4
        const raw = REACHABLE_BASE + (blastRadiusCount ?? 0) * BLAST_MODIFIER;
        return Math.min(raw, MAX_SCORE);
      }
      // Phase 5 ran standalone (no prior Phase 4) — use backend score as-is
      return phase5Data.severity_score ?? null;
    }
    return null; // Phase 5 not run yet
  })();

  // Isolated threat: reachable but 0 downstream propagation
  const isolatedThreat = phase5Data !== null && phase4WasReachable && blastRadiusCount === 0;

  // Status text & color — driven by the COMPUTED score, not the raw backend string
  const statusText = (() => {
    if (phase4Data) return isReachable ? 'REACHABLE' : 'UNREACHABLE';
    if (phase5Data) {
      if (computedSeverityScore >= 9.0) return 'CRITICAL';
      if (computedSeverityScore >= 7.0) return 'HIGH';
      if (computedSeverityScore >= 4.0) return 'MEDIUM';
      return 'LOW';
    }
    return null;
  })();

  const statusColor = (() => {
    if (phase4Data) return isReachable ? 'red' : 'green';
    if (computedSeverityScore !== null) {
      if (computedSeverityScore >= 7.0) return 'red';
      if (computedSeverityScore >= 4.0) return 'yellow';
      return 'green';
    }
    return 'gray';
  })();

  const scoreColor = computedSeverityScore !== null
    ? (computedSeverityScore >= 7.0 ? 'red' : computedSeverityScore >= 4.0 ? 'yellow' : 'green')
    : 'gray';

  const totalImpacted = phase4Data?.attack_path?.length ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#030712', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 24px', height: 56, flexShrink: 0,
        background: 'linear-gradient(90deg,#0a0f1e 0%,#030712 100%)',
        borderBottom: '1px solid #1a2744',
        boxShadow: '0 1px 30px rgba(0,255,136,0.06)',
      }}>
        {/* Logo */}
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'linear-gradient(135deg,#00ff88,#00d4ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ShieldAlert size={18} color="#030712" />
        </div>

        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', margin: 0, letterSpacing: 0.5, fontFamily: "'Inter',sans-serif" }}>
            CORTEX ENGINE
            <span style={{ fontSize: 10, fontWeight: 400, color: '#00ff88', marginLeft: 10, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2 }}>
              PREDICTIVE REACHABILITY FRAMEWORK
            </span>
          </h1>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#00ff88',
              boxShadow: '0 0 8px #00ff88',
              animation: 'pulse-glow 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', letterSpacing: 1.5 }}>SYSTEM ONLINE</span>
          </div>

          <div style={{ height: 20, width: 1, background: '#1a2744' }} />

          {/* Phase badge */}
          {activeMode && (
            <div style={{
              padding: '3px 10px', borderRadius: 4,
              background: activeMode === 'phase4' ? 'rgba(0,212,255,0.1)' : 'rgba(255,45,85,0.1)',
              border: `1px solid ${activeMode === 'phase4' ? '#00d4ff' : '#ff2d55'}`,
              fontSize: 10, color: activeMode === 'phase4' ? '#00d4ff' : '#ff2d55',
              fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1,
            }}>
              {activeMode === 'phase3' ? 'PHASE 3 — NLP EXTRACTION'
                : activeMode === 'phase4' ? 'PHASE 4 — REACHABILITY'
                : 'PHASE 5 — BLAST RADIUS'}
            </div>
          )}
        </div>
      </header>

      {/* ── METRIC CARDS ROW ── */}
      <div style={{
        display: 'flex', gap: 12, padding: '10px 16px 0',
        flexShrink: 0, alignItems: 'stretch',
      }}>
        {/* STATUS CARD — score-driven, never downgrades to LOW if reachable */}
        <MetricCard
          icon={statusText ? (isReachable ? XCircle : CheckCircle) : Activity}
          label="Status"
          value={statusText}
          sub={
            phase4Data?.status ||
            (phase5Data
              ? (computedSeverityScore >= 7.0
                  ? '🔴 High-severity threat confirmed'
                  : `Computed score: ${computedSeverityScore?.toFixed(1)}`)
              : 'Awaiting analysis')
          }
          color={statusColor}
        />

        {/* SEVERITY SCORE — computed with reachable base + blast modifier */}
        <MetricCard
          icon={AlertTriangle}
          label="Severity Score"
          value={computedSeverityScore !== null ? `${computedSeverityScore.toFixed(1)} / 10` : null}
          sub={
            isolatedThreat
              ? '⚠ Isolated Threat — Initial Compromise Only'
              : computedSeverityScore >= 9.0
              ? '🔴 Critical threshold exceeded'
              : computedSeverityScore >= 7.0
              ? '🔴 High severity — immediate action required'
              : computedSeverityScore !== null
              ? '🟡 Within moderate bounds'
              : 'Run Phase 5 for score'
          }
          color={scoreColor}
        />

        {/* DOWNSTREAM IMPACT — Phase 5 blast radius (separate from attack path) */}
        <MetricCard
          icon={Zap}
          label="Downstream Impact"
          value={
            blastRadiusCount !== null
              ? `${blastRadiusCount} Node${blastRadiusCount !== 1 ? 's' : ''}`
              : totalImpacted !== null
              ? `${totalImpacted} Node${totalImpacted !== 1 ? 's' : ''}`
              : null
          }
          sub={
            blastRadiusCount !== null
              ? (blastRadiusCount === 0
                  ? 'No downstream propagation detected'
                  : 'Downstream functions affected')
              : totalImpacted !== null
              ? 'Nodes in attack path'
              : 'Run an analysis'
          }
          color={blastRadiusCount > 0 ? 'red' : blastRadiusCount === 0 ? 'yellow' : totalImpacted > 0 ? 'blue' : 'gray'}
        />

        <MetricCard
          icon={Target}
          label="Target Node"
          value={targetNode || null}
          sub={activeMode ? `Active analysis: ${activeMode.toUpperCase()}` : 'No target set'}
          color={targetNode ? 'yellow' : 'gray'}
        />
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', padding: '10px 16px 12px' }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside style={{
          width: 230, flexShrink: 0, marginRight: 12,
          background: 'linear-gradient(180deg,#0d1424 0%,#0a0f1e 100%)',
          border: '1px solid #1a2744',
          borderRadius: 12, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Sidebar Header */}
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1a2744' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={13} color="#00ff88" />
              <span style={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                Analysis Controls
              </span>
            </div>
          </div>

          <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

            {/* ── PHASE 3 — CVE NLP EXTRACTION ── */}
            <div style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid #1e3a5f',
              borderRadius: 8,
              padding: '10px 10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Cpu size={11} color="#00d4ff" />
                <span style={{ fontSize: 9, color: '#00d4ff', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>
                  Phase 3 — NLP Extraction
                </span>
              </div>

              <label style={{ display: 'block', fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>
                CVE ID
              </label>
              <input
                type="text"
                value={cveId}
                onChange={e => setCveId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePhase3()}
                placeholder="e.g. CVE-2021-44228"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: '#030712',
                  border: '1px solid #1e3a5f',
                  borderRadius: 6,
                  color: '#e2e8f0',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono',monospace",
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                  marginBottom: 8,
                }}
                onFocus={e => e.target.style.borderColor = '#00d4ff'}
                onBlur={e => e.target.style.borderColor = '#1e3a5f'}
              />

              <SideBtn
                label="Run Phase 3 (NLP Extraction)"
                icon={Cpu}
                color="blue"
                onClick={handlePhase3}
                loading={loading3}
                disabled={!cveId.trim()}
              />

              {/* Auto-fill indicator */}
              {(phase3Data?.signature || phase3Data?.vulnerable_signature) && (
                <div style={{
                  marginTop: 8,
                  padding: '6px 8px',
                  background: 'rgba(0,212,255,0.07)',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: 5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                }}>
                  <ArrowDownToLine size={10} color="#00d4ff" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 8, color: '#00d4ff', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 2 }}>
                      AUTO-FILLED ↓ {phase3Data.confidence != null ? `(confidence: ${(phase3Data.confidence * 100).toFixed(1)}%)` : ''}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all' }}>
                      {phase3Data.signature || phase3Data.vulnerable_signature}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── TARGET NODE INPUT ── */}
            <div>
              <label style={{ display: 'block', fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Target Node ID
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={12} color="#334155" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={targetNode}
                  onChange={e => setTargetNode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePhase4()}
                  placeholder="e.g. UserDAO"
                  style={{
                    width: '100%',
                    padding: '9px 10px 9px 28px',
                    background: '#030712',
                    border: `1px solid ${(phase3Data?.signature || phase3Data?.vulnerable_signature) ? 'rgba(0,212,255,0.4)' : '#1e3a5f'}`,
                    borderRadius: 7,
                    color: '#e2e8f0',
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono',monospace",
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#00ff88'}
                  onBlur={e => e.target.style.borderColor = (phase3Data?.signature || phase3Data?.vulnerable_signature) ? 'rgba(0,212,255,0.4)' : '#1e3a5f'}
                />
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #1a2744', margin: '2px 0' }} />

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SideBtn
                label="Run Reachability (Phase 4)"
                icon={GitBranch}
                color="green"
                onClick={handlePhase4}
                loading={loading4}
                disabled={!targetNode.trim()}
              />
              <SideBtn
                label="Calculate Blast Radius (Phase 5)"
                icon={Zap}
                color="red"
                onClick={handlePhase5}
                loading={loading5}
                disabled={!targetNode.trim()}
              />
              {(phase3Data || phase4Data || phase5Data || error) && (
                <button
                  onClick={handleReset}
                  style={{
                    width: '100%', padding: '8px 14px',
                    background: 'transparent',
                    border: '1px solid #1a2744',
                    borderRadius: 7, color: '#334155',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 10, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 7,
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#1e3a5f'; }}
                  onMouseOut={e => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.borderColor = '#1a2744'; }}
                >
                  <RefreshCw size={11} /> Clear / Reset
                </button>
              )}
            </div>

            {/* Result details panel */}
            {(phase4Data || phase5Data) && (
              <>
                <div style={{ borderTop: '1px solid #1a2744', margin: '4px 0' }} />
                <div>
                  <div style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                    Result Details
                  </div>
                  {phase4Data && (
                    <>
                      <LogRow label="Status" value={phase4Data.is_reachable ? 'REACHABLE' : 'UNREACHABLE'} valueColor={phase4Data.is_reachable ? '#ff2d55' : '#00ff88'} />
                      <LogRow label="Path Length" value={phase4Data.attack_path?.length} valueColor="#00d4ff" />
                      <LogRow label="Entry Point" value={phase4Data.attack_path?.[0]} valueColor="#00d4ff" />
                      <LogRow label="Vulnerable Node" value={phase4Data.target_node} valueColor="#ff2d55" />
                    </>
                  )}
                  {phase5Data && (
                    <>
                      <LogRow label="Root Cause" value={phase5Data.root_cause_function} valueColor="#ff2d55" />
                      <LogRow
                        label="Computed Score"
                        value={computedSeverityScore !== null ? `${computedSeverityScore.toFixed(1)} / 10` : '—'}
                        valueColor={computedSeverityScore >= 7.0 ? '#ff2d55' : '#ffd700'}
                      />
                      <LogRow
                        label="Status"
                        value={
                          isolatedThreat
                            ? 'ISOLATED THREAT'
                            : computedSeverityScore >= 9.0
                            ? 'CRITICAL'
                            : computedSeverityScore >= 7.0
                            ? 'HIGH'
                            : 'MEDIUM'
                        }
                        valueColor={computedSeverityScore >= 7.0 ? '#ff2d55' : '#ffd700'}
                      />
                      <LogRow
                        label="Downstream"
                        value={`${blastRadiusCount ?? 0} node${blastRadiusCount !== 1 ? 's' : ''} affected`}
                        valueColor={blastRadiusCount > 0 ? '#ff2d55' : '#64748b'}
                      />
                      {isolatedThreat && (
                        <div style={{
                          marginTop: 6,
                          padding: '6px 8px',
                          background: 'rgba(255,215,0,0.07)',
                          border: '1px solid rgba(255,215,0,0.25)',
                          borderRadius: 5,
                          fontSize: 9,
                          color: '#ffd700',
                          fontFamily: 'monospace',
                          lineHeight: 1.5,
                          letterSpacing: 0.5,
                        }}>
                          ⚠ Initial compromise confirmed. No lateral propagation detected, but the entry point itself is a HIGH-severity vulnerability.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Error box */}
            {error && (
              <div style={{
                padding: '10px 12px',
                background: 'rgba(255,45,85,0.08)',
                border: '1px solid rgba(255,45,85,0.3)',
                borderRadius: 7,
                fontSize: 10,
                color: '#ff2d55',
                fontFamily: 'monospace',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ ERROR</div>
                {error}
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #1a2744' }}>
            <div style={{ fontSize: 9, color: '#1e3a5f', fontFamily: 'monospace', letterSpacing: 1 }}>
              API → {API_BASE_URL}
            </div>
          </div>
        </aside>

        {/* ── GRAPH CANVAS ── */}
        <main style={{
          flex: 1, minWidth: 0,
          background: '#0a0f1e',
          border: '1px solid #1a2744',
          borderRadius: 12, overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Canvas header */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: 'linear-gradient(90deg,rgba(13,20,36,0.95) 0%,rgba(10,15,30,0.0) 100%)',
            borderBottom: '1px solid #1a2744',
            backdropFilter: 'blur(4px)',
          }}>
            <Network size={13} color="#334155" />
            <span style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {activeMode === 'phase4'
                ? `Attack Path — ${phase4Data?.attack_path?.length || 0} nodes`
                : activeMode === 'phase5'
                ? `Blast Radius — ${phase5Data?.total_impacted_nodes || 0} impacted nodes`
                : 'Graph Visualization Canvas'}
            </span>

            {/* Legend */}
            {activeMode === 'phase4' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
                <LegendDot color="#00d4ff" label="Entry Point" />
                <LegendDot color="#94a3b8" label="Intermediate" />
                <LegendDot color="#ff2d55" label="Vulnerable Target" />
              </div>
            )}
            {activeMode === 'phase5' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
                <LegendDot color="#ff2d55" label="Root Cause" />
                <LegendDot color="#ffd700" label="Critical Node" />
                <LegendDot color="#334155" label="Impacted Node" />
              </div>
            )}
          </div>

          {/* Loading overlay */}
          {(loading4 || loading5) && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'rgba(3,7,18,0.75)', backdropFilter: 'blur(3px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '2px solid #1a2744',
                borderTop: '2px solid #00ff88',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ color: '#00ff88', fontFamily: 'monospace', fontSize: 12, letterSpacing: 2 }}>
                {loading4 ? 'TRACING ATTACK PATH...' : 'CALCULATING BLAST RADIUS...'}
              </p>
            </div>
          )}

          <div style={{ width: '100%', height: '100%', paddingTop: 38 }}>
            <GraphCanvas
              mode={activeMode}
              phase4Data={phase4Data}
              phase5Data={phase5Data}
            />
          </div>
        </main>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-glow { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        input::placeholder { color: #1e3a5f; }
      `}</style>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
      <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', letterSpacing: 0.5 }}>{label}</span>
    </div>
  );
}
