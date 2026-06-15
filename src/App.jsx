import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Divider, Chip, CircularProgress, Alert, Stack, Tooltip,
  createTheme, ThemeProvider, CssBaseline,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import BoltIcon from '@mui/icons-material/Bolt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PsychologyIcon from '@mui/icons-material/Psychology';
import RefreshIcon from '@mui/icons-material/Refresh';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import GraphCanvas from './components/GraphCanvas';
import { runReachability, calculateBlastRadius, findRootCauseFunction, API_BASE_URL } from './api/cortexApi';

// ── MUI dark theme ──────────────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#030712', paper: '#0d1424' },
    primary:    { main: '#00d4ff' },
    error:      { main: '#ef4444' },
    warning:    { main: '#f59e0b' },
    success:    { main: '#10b981' },
  },
  typography: {
    fontFamily: "'Inter', 'JetBrains Mono', monospace",
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'linear-gradient(135deg,#0d1424 0%,#0a0f1e 100%)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12 },
      },
    },
  },
});

// ── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, accentColor = '#1e3a5f' }) {
  const glow = accentColor + '26';
  return (
    <Card sx={{ flex: 1, minWidth: 0, border: `1px solid ${accentColor}`, boxShadow: `0 0 20px ${glow}`, borderRadius: 3 }}>
      <CardContent sx={{ p: '14px 18px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 2.5,
          background: glow, border: `1px solid ${accentColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon sx={{ fontSize: 20, color: accentColor }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 9, color: '#475569', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'monospace', mb: 0.4 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: accentColor, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
            {value ?? '—'}
          </Typography>
          {sub && (
            <Typography sx={{ fontSize: 9, color: '#64748b', mt: 0.5, lineHeight: 1.4 }}>{sub}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Sidebar log row ──────────────────────────────────────────────────────────
function LogRow({ label, value, valueColor = '#94a3b8' }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.6, borderBottom: '1px solid #0d1424', gap: 1 }}>
      <Typography sx={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 10, color: valueColor, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, maxWidth: '60%', wordBreak: 'break-all', textAlign: 'right' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

// ── Phase label chip ─────────────────────────────────────────────────────────
function PhaseChip({ activeMode }) {
  if (!activeMode) return null;
  const label = activeMode === 'phase3' ? 'Phase 3 — NLP' : activeMode === 'phase4' ? 'Phase 4 — Reachability' : 'Phase 5 — Blast Radius';
  const color = activeMode === 'phase4' ? '#00d4ff' : '#ef4444';
  return (
    <Chip label={label} size="small" sx={{
      bgcolor: color + '1a', color, border: `1px solid ${color}`,
      fontFamily: 'monospace', fontSize: 9, fontWeight: 700, letterSpacing: 1,
      height: 22,
    }} />
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [targetNode, setTargetNode]   = useState('');
  const [cveId, setCveId]             = useState('');
  const [phase3Data, setPhase3Data]   = useState(null);
  const [phase4Data, setPhase4Data]   = useState(null);
  const [phase5Data, setPhase5Data]   = useState(null);
  const [phase4ReachableSnapshot, setPhase4ReachableSnapshot] = useState(null);
  const [activeMode, setActiveMode]   = useState(null);
  const [loading3, setLoading3]       = useState(false);
  const [loading4, setLoading4]       = useState(false);
  const [loading5, setLoading5]       = useState(false);
  const [error, setError]             = useState(null);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePhase3 = async () => {
    if (!cveId.trim()) return;
    setError(null); setLoading3(true);
    try {
      const data = await findRootCauseFunction(cveId);
      console.log('Phase 3 data:', data);
      setPhase3Data(data); setActiveMode('phase3');
      const extracted = data?.signature || data?.vulnerable_signature || data?.matched_node || data?.function_name || null;
      if (extracted) setTargetNode(extracted);
      else setError('Phase 3 succeeded but no function signature was returned.');
    } catch (e) { setError(e.message); } finally { setLoading3(false); }
  };

  const handlePhase4 = async () => {
    if (!targetNode.trim()) return;
    setError(null); setLoading4(true);
    try {
      const data      = await runReachability(targetNode);
      const attackPath = data.attack_path ?? [];
      const isReachable = attackPath.length > 0;
      const entryPoint  = attackPath[0]    ?? null;
      const targetSink  = attackPath.at(-1) ?? null;
      console.log('[Phase 4]', { isReachable, entryPoint, targetSink, path: attackPath });
      const normalised = {
        ...data,
        is_reachable: isReachable,
        target_node:  targetSink,
        entry_point:  entryPoint,
        status: isReachable
          ? `Attack path confirmed — ${attackPath.length} hops via ${entryPoint}`
          : 'No path to a public entry point found',
      };
      setPhase4ReachableSnapshot(isReachable);
      setPhase4Data(normalised); setPhase5Data(null); setActiveMode('phase4');
    } catch (e) { setError(e.message); } finally { setLoading4(false); }
  };

  const handlePhase5 = async () => {
    if (!targetNode.trim()) return;
    setError(null); setLoading5(true);
    try {
      const data = await calculateBlastRadius(targetNode);
      if (phase4Data !== null) setPhase4ReachableSnapshot(phase4Data.is_reachable);
      setPhase5Data(data);
      setPhase4Data(null);
      setActiveMode('phase5');
    } catch (e) { setError(e.message); } finally { setLoading5(false); }
  };

  const handleReset = () => {
    setCveId(''); setTargetNode('');
    setPhase3Data(null); setPhase4Data(null); setPhase5Data(null);
    setPhase4ReachableSnapshot(null); setActiveMode(null); setError(null);
  };

  // ── Derived metrics ────────────────────────────────────────────────────────
  const isReachable       = phase4Data?.is_reachable;
  const blastRadiusCount  = phase5Data?.total_impacted_nodes ?? null;
  const phase4WasReachable = isReachable === true || phase4ReachableSnapshot === true;

  const REACHABLE_BASE = 7.5;
  const BLAST_MODIFIER = 0.5;
  const MAX_SCORE      = 10.0;

  const computedScore = (() => {
    if (phase5Data !== null) {
      if (phase4WasReachable) return Math.min(REACHABLE_BASE + (blastRadiusCount ?? 0) * BLAST_MODIFIER, MAX_SCORE);
      return phase5Data.severity_score ?? null;
    }
    return null;
  })();

  const isolatedThreat = phase5Data !== null && phase4WasReachable && blastRadiusCount === 0;

  const statusText = (() => {
    if (phase4Data) return isReachable ? 'REACHABLE' : 'UNREACHABLE';
    if (phase5Data) {
      if (computedScore >= 9.0) return 'CRITICAL';
      if (computedScore >= 7.0) return 'HIGH';
      if (computedScore >= 4.0) return 'MEDIUM';
      return 'LOW';
    }
    return null;
  })();

  const accentStatus = (() => {
    if (phase4Data) return isReachable ? '#ef4444' : '#10b981';
    if (computedScore !== null) {
      if (computedScore >= 7.0) return '#ef4444';
      if (computedScore >= 4.0) return '#f59e0b';
      return '#10b981';
    }
    return '#1e3a5f';
  })();

  const accentScore = computedScore !== null
    ? (computedScore >= 7.0 ? '#ef4444' : computedScore >= 4.0 ? '#f59e0b' : '#10b981')
    : '#1e3a5f';

  const totalImpacted = phase4Data?.attack_path?.length ?? null;

  // ── Phase 3 auto-fill hint ─────────────────────────────────────────────────
  const phase3Hint = phase3Data?.signature || phase3Data?.vulnerable_signature || null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', bgcolor: '#030712' }}>

        {/* ── HEADER ── */}
        <Box component="header" sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 3, height: 56, flexShrink: 0,
          background: 'linear-gradient(90deg,#0a0f1e 0%,#030712 100%)',
          borderBottom: '1px solid #1a2744',
          boxShadow: '0 1px 30px rgba(0,255,136,0.05)',
        }}>
          {/* Logo */}
          <Box sx={{
            width: 34, height: 34, borderRadius: 2,
            background: 'linear-gradient(135deg,#00ff88,#00d4ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldIcon sx={{ fontSize: 18, color: '#030712' }} />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.5, lineHeight: 1 }}>
              CORTEX ENGINE
              <Box component="span" sx={{ fontSize: 10, fontWeight: 400, color: '#00ff88', ml: 1.2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2 }}>
                PREDICTIVE REACHABILITY FRAMEWORK
              </Box>
            </Typography>
          </Box>

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Live pulse */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <FiberManualRecordIcon sx={{ fontSize: 10, color: '#00ff88', animation: 'pulse-glow 2s ease-in-out infinite' }} />
              <Typography sx={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', letterSpacing: 1.5 }}>SYSTEM ONLINE</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: '#1a2744' }} />
            <PhaseChip activeMode={activeMode} />
          </Box>
        </Box>

        {/* ── METRIC CARDS ── */}
        <Box sx={{ display: 'flex', gap: 1.5, px: 2, pt: 1.2, flexShrink: 0 }}>
          <MetricCard
            icon={statusText === 'REACHABLE' ? WarningAmberIcon : ShieldIcon}
            label="Status"
            value={statusText}
            sub={phase4Data?.status || (phase5Data ? (computedScore >= 7.0 ? '🔴 High-severity threat confirmed' : `Score: ${computedScore?.toFixed(1)}`) : 'Awaiting analysis')}
            accentColor={accentStatus}
          />
          <MetricCard
            icon={WarningAmberIcon}
            label="Severity Score"
            value={computedScore !== null ? `${computedScore.toFixed(1)} / 10` : null}
            sub={
              isolatedThreat          ? '⚠ Isolated Threat — Initial Compromise Only'
              : computedScore >= 9.0  ? '🔴 Critical threshold exceeded'
              : computedScore >= 7.0  ? '🔴 High severity — immediate action required'
              : computedScore !== null? '🟡 Within moderate bounds'
              : 'Run Phase 5 for score'
            }
            accentColor={accentScore}
          />
          <MetricCard
            icon={BoltIcon}
            label="Downstream Impact"
            value={
              blastRadiusCount !== null ? `${blastRadiusCount} Node${blastRadiusCount !== 1 ? 's' : ''}`
              : totalImpacted !== null  ? `${totalImpacted} Node${totalImpacted !== 1 ? 's' : ''}`
              : null
            }
            sub={
              blastRadiusCount !== null
                ? (blastRadiusCount === 0 ? 'No downstream propagation detected' : 'Downstream functions affected')
                : totalImpacted !== null ? 'Nodes in attack path' : 'Run an analysis'
            }
            accentColor={blastRadiusCount > 0 ? '#ef4444' : blastRadiusCount === 0 ? '#f59e0b' : totalImpacted > 0 ? '#00d4ff' : '#1e3a5f'}
          />
          <MetricCard
            icon={TrackChangesIcon}
            label="Target Node"
            value={targetNode || null}
            sub={activeMode ? `Active: ${activeMode.toUpperCase()}` : 'No target set'}
            accentColor={targetNode ? '#ffd700' : '#1e3a5f'}
          />
        </Box>

        {/* ── MAIN BODY ── */}
        <Box sx={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', p: '10px 16px 14px' }}>

          {/* ── SIDEBAR ── */}
          <Card sx={{
            width: 236, flexShrink: 0, mr: 1.5,
            border: '1px solid #1a2744', borderRadius: 3,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Sidebar header */}
            <Box sx={{ px: 1.8, py: 1.2, borderBottom: '1px solid #1a2744', display: 'flex', alignItems: 'center', gap: 1 }}>
              <FiberManualRecordIcon sx={{ fontSize: 10, color: '#00ff88' }} />
              <Typography sx={{ fontSize: 9, color: '#00ff88', fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                Analysis Controls
              </Typography>
            </Box>

            <Box sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, overflowY: 'auto' }}>

              {/* Phase 3 block */}
              <Box sx={{ background: 'rgba(0,212,255,0.04)', border: '1px solid #1e3a5f', borderRadius: 2, p: 1.2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                  <PsychologyIcon sx={{ fontSize: 12, color: '#00d4ff' }} />
                  <Typography sx={{ fontSize: 9, color: '#00d4ff', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>
                    Phase 3 — NLP Extraction
                  </Typography>
                </Box>
                <TextField
                  fullWidth size="small" variant="outlined"
                  label="CVE ID"
                  value={cveId}
                  onChange={e => setCveId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePhase3()}
                  placeholder="CVE-2021-44228"
                  InputLabelProps={{ sx: { fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 } }}
                  sx={{ mb: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#1e3a5f' }, '&:hover fieldset': { borderColor: '#00d4ff' }, '&.Mui-focused fieldset': { borderColor: '#00d4ff' } } }}
                />
                <Button
                  fullWidth variant="outlined" size="small"
                  startIcon={loading3 ? <CircularProgress size={12} color="inherit" /> : <PsychologyIcon />}
                  onClick={handlePhase3}
                  disabled={!cveId.trim() || loading3}
                  sx={{ borderColor: '#00d4ff', color: '#00d4ff', '&:hover': { borderColor: '#00d4ff', bgcolor: 'rgba(0,212,255,0.07)' }, '&.Mui-disabled': { borderColor: '#1e3a5f', color: '#334155' } }}
                >
                  {loading3 ? 'Extracting...' : 'Run Phase 3'}
                </Button>
                {phase3Hint && (
                  <Box sx={{ mt: 1, p: '6px 8px', bgcolor: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 1.5 }}>
                    <Typography sx={{ fontSize: 8, color: '#00d4ff', fontFamily: 'monospace', letterSpacing: 1, mb: 0.3 }}>
                      AUTO-FILLED ↓ {phase3Data?.confidence != null ? `(${(phase3Data.confidence * 100).toFixed(1)}%)` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all' }}>
                      {phase3Hint}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Target node input */}
              <Box>
                <TextField
                  fullWidth size="small" variant="outlined"
                  label="Target Node ID"
                  value={targetNode}
                  onChange={e => setTargetNode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePhase4()}
                  placeholder="e.g. Log4jJNDIValidator"
                  InputLabelProps={{ sx: { fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: phase3Hint ? 'rgba(0,212,255,0.4)' : '#1e3a5f' }, '&:hover fieldset': { borderColor: '#00ff88' }, '&.Mui-focused fieldset': { borderColor: '#00ff88' } } }}
                />
              </Box>

              <Divider sx={{ borderColor: '#1a2744' }} />

              {/* Action buttons */}
              <Stack spacing={1}>
                <Button
                  fullWidth variant="outlined" size="small"
                  startIcon={loading4 ? <CircularProgress size={12} color="inherit" /> : <AccountTreeIcon />}
                  onClick={handlePhase4}
                  disabled={!targetNode.trim() || loading4}
                  sx={{ borderColor: '#10b981', color: '#10b981', '&:hover': { borderColor: '#10b981', bgcolor: 'rgba(16,185,129,0.07)' }, '&.Mui-disabled': { borderColor: '#1e3a5f', color: '#334155' } }}
                >
                  {loading4 ? 'Tracing Path...' : 'Run Reachability (Phase 4)'}
                </Button>
                <Button
                  fullWidth variant="outlined" size="small"
                  startIcon={loading5 ? <CircularProgress size={12} color="inherit" /> : <BoltIcon />}
                  onClick={handlePhase5}
                  disabled={!targetNode.trim() || loading5}
                  sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.07)' }, '&.Mui-disabled': { borderColor: '#1e3a5f', color: '#334155' } }}
                >
                  {loading5 ? 'Calculating...' : 'Blast Radius (Phase 5)'}
                </Button>
                {(phase3Data || phase4Data || phase5Data || error) && (
                  <Button
                    fullWidth variant="text" size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleReset}
                    sx={{ color: '#334155', '&:hover': { color: '#64748b', bgcolor: 'rgba(255,255,255,0.03)' } }}
                  >
                    Clear / Reset
                  </Button>
                )}
              </Stack>

              {/* Result details */}
              {(phase4Data || phase5Data) && (
                <>
                  <Divider sx={{ borderColor: '#1a2744' }} />
                  <Box>
                    <Typography sx={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', letterSpacing: 1.5, textTransform: 'uppercase', mb: 1 }}>
                      Result Details
                    </Typography>
                    {phase4Data && (
                      <>
                        <LogRow label="Status"    value={phase4Data.is_reachable ? 'REACHABLE' : 'UNREACHABLE'} valueColor={phase4Data.is_reachable ? '#ef4444' : '#10b981'} />
                        <LogRow label="Path Hops" value={phase4Data.attack_path?.length} valueColor="#00d4ff" />
                        <LogRow label="Entry"     value={phase4Data.entry_point} valueColor="#10b981" />
                        <LogRow label="Sink"      value={phase4Data.target_node} valueColor="#ef4444" />
                      </>
                    )}
                    {phase5Data && (
                      <>
                        <LogRow label="Root Cause"  value={phase5Data.root_cause_function} valueColor="#ef4444" />
                        <LogRow label="Score"       value={computedScore !== null ? `${computedScore.toFixed(1)} / 10` : '—'} valueColor={computedScore >= 7.0 ? '#ef4444' : '#f59e0b'} />
                        <LogRow label="Threat"      value={isolatedThreat ? 'ISOLATED THREAT' : computedScore >= 9.0 ? 'CRITICAL' : computedScore >= 7.0 ? 'HIGH' : 'MEDIUM'} valueColor={computedScore >= 7.0 ? '#ef4444' : '#f59e0b'} />
                        <LogRow label="Downstream"  value={`${blastRadiusCount ?? 0} node${blastRadiusCount !== 1 ? 's' : ''}`} valueColor={blastRadiusCount > 0 ? '#ef4444' : '#64748b'} />
                        {isolatedThreat && (
                          <Alert severity="warning" sx={{ mt: 1, fontSize: 9, fontFamily: 'monospace', py: 0.4, '& .MuiAlert-message': { fontSize: 9 } }}>
                            Initial compromise confirmed. No lateral propagation, but entry point is HIGH severity.
                          </Alert>
                        )}
                      </>
                    )}
                  </Box>
                </>
              )}

              {/* Error */}
              {error && (
                <Alert severity="error" sx={{ fontSize: 10, fontFamily: 'monospace', '& .MuiAlert-message': { fontSize: 10 } }}>
                  {error}
                </Alert>
              )}
            </Box>

            {/* Sidebar footer */}
            <Box sx={{ px: 1.8, py: 1, borderTop: '1px solid #1a2744' }}>
              <Typography sx={{ fontSize: 9, color: '#1e3a5f', fontFamily: 'monospace', letterSpacing: 1 }}>
                API → {API_BASE_URL}
              </Typography>
            </Box>
          </Card>

          {/* ── GRAPH CANVAS ── */}
          <Box sx={{
            flex: 1, minWidth: 0,
            bgcolor: '#0a0f1e',
            border: '1px solid #1a2744',
            borderRadius: 3, overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Loading overlay */}
            {(loading4 || loading5) && (
              <Box sx={{
                position: 'absolute', inset: 0, zIndex: 10,
                bgcolor: 'rgba(3,7,18,0.8)', backdropFilter: 'blur(4px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
                <CircularProgress size={48} thickness={2} sx={{ color: '#00ff88' }} />
                <Typography sx={{ color: '#00ff88', fontFamily: 'monospace', fontSize: 12, letterSpacing: 2 }}>
                  {loading4 ? 'TRACING ATTACK PATH...' : 'CALCULATING BLAST RADIUS...'}
                </Typography>
              </Box>
            )}

            <GraphCanvas
              mode={activeMode}
              phase4Data={phase4Data}
              phase5Data={phase5Data}
            />
          </Box>
        </Box>

        <style>{`
          @keyframes pulse-glow { 0%,100%{opacity:1} 50%{opacity:0.5} }
          input::placeholder { color: #1e3a5f; }
          .react-flow__controls button { background: #0d1424 !important; border-color: #1a2744 !important; color: #475569 !important; }
          .react-flow__controls button:hover { background: #1a2744 !important; color: #e2e8f0 !important; }
        `}</style>
      </Box>
    </ThemeProvider>
  );
}
