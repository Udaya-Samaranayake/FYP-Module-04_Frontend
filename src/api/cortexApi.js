import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Base configuration
// Change API_BASE_URL here if the FastAPI server moves to a different host/port.
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Shared axios instance — all Cortex API calls go through this.
 * Timeout is set to 30 s to accommodate heavy graph analyses.
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor — normalise errors into a single shape so callers
// never have to inspect axios internals directly.
// ─────────────────────────────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.code === 'ERR_NETWORK'
        ? `Cannot reach backend at ${API_BASE_URL}. Is FastAPI running?`
        : error.response?.data?.detail || error.message || 'Unknown error';

    return Promise.reject(new Error(message));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /
 * Health-check — confirms the FastAPI server is online.
 * @returns {Promise<{status: string, message: string}>}
 */
export const checkHealth = () => apiClient.get('/').then((r) => r.data);

/**
 * GET /analyze
 * Phase 2 — parse the target_code directory and write ast_graph_output.json.
 * @returns {Promise<{status: string, message: string}>}
 */
export const runAnalysis = () => apiClient.get('/analyze').then((r) => r.data);

/**
 * GET /find-rcf/{cveId}
 * Phase 3 — Fetches the CVE description from the NVD API, then runs the NLP
 * semantic matcher to identify the root-cause function in the AST graph.
 *
 * @param {string} cveId - e.g. "CVE-2021-44228"
 * @returns {Promise<{
 *   vulnerable_signature: string,
 *   similarity_score: number,
 *   matched_node: string
 * }>}
 */
export const findRootCauseFunction = (cveId) =>
  apiClient
    .get(`/find-rcf/${encodeURIComponent(cveId.trim())}`)
    .then((r) => r.data);

/**
 * GET /run-reachability/{targetNode}
 * Phase 4 — backward DFS reachability analysis.
 *
 * @param {string} targetNode  - The function/node ID to trace (e.g. "UserDAO").
 * @returns {Promise<{
 *   target_node: string,
 *   is_reachable: boolean,
 *   attack_path: string[],
 *   status: string
 * }>}
 */
export const runReachability = (targetNode) =>
  apiClient
    .get(`/run-reachability/${encodeURIComponent(targetNode.trim())}`)
    .then((r) => r.data);

/**
 * GET /blast-radius/{targetNode}
 * Phase 5 — forward BFS blast-radius calculation.
 *
 * @param {string} targetNode  - The root-cause function ID to expand.
 * @returns {Promise<{
 *   root_cause_function: string,
 *   total_impacted_nodes: number,
 *   severity_score: number,
 *   severity_level: string,
 *   blast_propagation: Array<{node: string, depth: number, is_critical: boolean}>
 * }>}
 */
export const calculateBlastRadius = (targetNode) =>
  apiClient
    .get(`/blast-radius/${encodeURIComponent(targetNode.trim())}`)
    .then((r) => r.data);
