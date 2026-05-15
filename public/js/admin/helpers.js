const { useState, useRef, useEffect, useCallback, useMemo } = React;

// ── Icons ────────────────────────────────────────────────────
const Icon = {
  Dashboard: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
    </svg>
  ),
  Inbox: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  Flow: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="5"/><rect x="14" y="16" width="7" height="5"/><rect x="3" y="16" width="7" height="5"/><path d="M10 5.5h6a2 2 0 0 1 2 2V16"/><path d="M6.5 8v8"/>
    </svg>
  ),
  Msg: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Search: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Bell: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Help: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4"/><line x1="12" y1="17" x2="12" y2="17.01"/>
    </svg>
  ),
  Settings: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.03V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.03-.33H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.03V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15.4 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.37.36.7.64.97.28.28.66.44 1.05.44H21a2 2 0 0 1 0 4h-.09c-.39 0-.77.16-1.05.44-.28.27-.5.6-.64.97z"/>
    </svg>
  ),
  Plus: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Share: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Upload: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Send: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Paperclip: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  Sparkles: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l1.9 4.7L18.5 9.5l-4.6 1.8L12 16l-1.9-4.7L5.5 9.5l4.6-1.8z"/><path d="M19 14l.7 1.7 1.8.7-1.8.7-.7 1.7-.7-1.7-1.8-.7 1.8-.7z"/>
    </svg>
  ),
  Dots: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
    </svg>
  ),
  X: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevRight: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  Check: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/>
    </svg>
  ),
  Trash: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  LogOut: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Copy: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Link: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  Lock: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  ZoomIn: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  ZoomOut: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  Fit: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7V4a1 1 0 0 1 1-1h3"/><path d="M17 3h3a1 1 0 0 1 1 1v3"/><path d="M21 17v3a1 1 0 0 1-1 1h-3"/><path d="M7 21H4a1 1 0 0 1-1-1v-3"/>
    </svg>
  ),
  Undo: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  ),
  Redo: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  File: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Bot: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="8.5" cy="14" r="1"/><circle cx="15.5" cy="14" r="1"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/>
    </svg>
  ),
  Globe: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/>
    </svg>
  ),
  People: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Play: (p) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" {...p}>
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  Eye: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
};

const AVATAR_COLORS = [
  'linear-gradient(135deg, oklch(0.60 0.18 300), oklch(0.45 0.17 300))',
  'linear-gradient(135deg, oklch(0.65 0.16 200), oklch(0.50 0.16 210))',
  'linear-gradient(135deg, oklch(0.70 0.14 145), oklch(0.55 0.14 155))',
  'linear-gradient(135deg, oklch(0.72 0.14 55), oklch(0.58 0.14 45))',
  'linear-gradient(135deg, oklch(0.65 0.18 20), oklch(0.52 0.18 15))',
  'linear-gradient(135deg, oklch(0.66 0.15 260), oklch(0.50 0.16 265))',
];

const colorFor = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

// ── Canvas ───────────────────────────────────────────────────
const SEED_NODES = [];
const SEED_EDGES = [];

const DEFAULT_DEFINITION_NODE = {
  id: 'def-default',
  type: 'definition',
  x: -310, y: 80,
  title: 'Definition',
  body: '',
  locked: true,
};

function ensureDefinitionNode(nodes) {
  if (!nodes) return [DEFAULT_DEFINITION_NODE];
  if (nodes.some(n => n.type === 'definition')) return nodes;
  return [{ ...DEFAULT_DEFINITION_NODE, id: 'def-' + Date.now() }, ...nodes];
}

// Returns the pan offset (at zoom=1) that places the definition node at the top-left
// with MARGIN px of breathing room.
function panForDefinition(nodes) {
  const MARGIN = 32;
  const def = (nodes || []).find(n => n.type === 'definition');
  if (!def) return { x: MARGIN, y: MARGIN };
  return { x: -def.x + MARGIN, y: -def.y + MARGIN };
}

const NODE_W = 240;
const API_BASE = '/api';

/**
 * Plain text from an uploaded file for AI / POST /api/flows.
 * .docx is a ZIP of XML — never use File.text() on it (that sends binary garbage to the model).
 */
async function extractUploadTextForAi(file) {
  if (!file) return '';
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.txt')) return file.text();
  if (name.endsWith('.docx')) {
    if (typeof mammoth === 'undefined') {
      throw new Error('DOCX reader failed to load (mammoth). Check network, refresh the page, or paste text in Description.');
    }
    const ab = await file.arrayBuffer();
    const { value, messages } = await mammoth.extractRawText({ arrayBuffer: ab });
    if (messages && messages.length) console.warn('mammoth:', messages);
    const text = String(value || '').trim();
    if (!text) {
      throw new Error('No readable text in this DOCX (empty, scanned images only, or unsupported). Paste text in Description or use .txt.');
    }
    return text;
  }
  if (name.endsWith('.doc')) {
    throw new Error('Legacy .doc is not supported. Save as .docx or paste text in Description.');
  }
  if (name.endsWith('.pdf')) {
    throw new Error('PDF is not extracted in the browser yet. Use .docx / .txt or paste the document text in Description.');
  }
  return file.text();
}

/** Backend / AI may store `materials` as a single object or string; builder always uses an array. */
function ensureMaterialsArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return [raw];
  if (typeof raw === 'string' && String(raw).trim()) {
    return [{ id: `mat-${Math.random().toString(36).slice(2)}`, label: String(raw).trim(), attachKind: null, attachValue: '' }];
  }
  return [];
}

function backendFlowToBuilderGraph(flow) {
  if (!flow) return { nodes: SEED_NODES, edges: SEED_EDGES };
  const nodes = (flow.nodes || []).map((node) => {
    const base = {
      id: node.id,
      x: typeof node.posX === 'number' ? node.posX : 0,
      y: typeof node.posY === 'number' ? node.posY : 0,
    };
    if (node.type === 'DEFINITION') {
      return {
        ...base,
        type: 'definition',
        title: node.label || flow.name || 'Definition',
        body: node.content?.description || flow.description || '',
        relatedOffices: node.content?.relatedOffices || [],
        templates: node.content?.templates || [],
        resources: node.content?.resources || [],
        isDeletable: false,
      };
    }
    if (node.type === 'DECISION') {
      return {
        ...base,
        type: 'decision',
        title: node.content?.question || node.label || 'Decision',
        answers: (node.answers || []).map((answer) => ({
          id: answer.id,
          label: answer.text,
          rationale: answer.rationale != null ? String(answer.rationale) : '',
        })),
      };
    }
    if (node.type === 'ACTION') {
      return {
        ...base,
        type: 'action',
        title: node.content?.title || node.label || 'Action',
        description: node.content?.description || '',
        assignee: node.content?.assignee || '',
        materials: ensureMaterialsArray(node.content?.materials).map((material) => ({
          id: material.id || `mat-${Math.random()}`,
          label: material.label || 'Material',
          attachKind: material.attachKind || null,
          attachValue: material.attachValue || '',
        })),
      };
    }
    if (node.type === 'PEOPLE') {
      return {
        ...base,
        type: 'people',
        name: node.content?.name || node.label || 'Contact',
        role: node.content?.department || '',
        email: node.content?.email || '',
        hiddenFromResearchers: Boolean(node.content?.hiddenFromResearchers),
      };
    }
    return { ...base, type: 'action', title: node.label || 'Action', description: '' };
  });
  const edges = (flow.edges || []).map((edge) => ({
    id: edge.id,
    from: edge.sourceNodeId,
    fromPort: edge.sourceAnswerId || 'out',
    to: edge.targetNodeId,
    toPort: 'in',
    locked: edge.isDeletable === false,
  }));
  return autoLayoutBuilderGraph({ nodes, edges });
}

function autoLayoutBuilderGraph(graph) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const definition = nodes.find((node) => node.type === 'definition');
  if (!definition) return graph;

  const levels = new Map([[definition.id, 0]]);
  const queue = [definition.id];
  while (queue.length) {
    const current = queue.shift();
    const level = levels.get(current) || 0;
    edges.filter((edge) => edge.from === current).forEach((edge) => {
      if (!byId.has(edge.to) || levels.has(edge.to)) return;
      levels.set(edge.to, level + 1);
      queue.push(edge.to);
    });
  }

  nodes.forEach((node) => {
    if (!levels.has(node.id) && node.type !== 'people') levels.set(node.id, Math.max(1, levels.size));
  });

  const buckets = new Map();
  nodes.filter((node) => node.type !== 'people').forEach((node) => {
    const level = levels.get(node.id) || 0;
    if (!buckets.has(level)) buckets.set(level, []);
    buckets.get(level).push(node);
  });

  const laidOut = nodes.map((node) => {
    if (node.type === 'definition') return { ...node, x: -310, y: 80 };
    if (node.type === 'people') return { ...node, x: node.x || 80, y: node.y || 576 };
    const level = levels.get(node.id) || 1;
    const bucket = buckets.get(level) || [];
    const index = bucket.findIndex((item) => item.id === node.id);
    const x = -310 + level * 330;
    const y = 80 + Math.max(0, index) * 250;
    return { ...node, x, y };
  });

  return { nodes: laidOut, edges };
}

function builderGraphToBackendFlow(currentFlow, nodes, edges) {
  if (!currentFlow) return null;
  return {
    ...currentFlow,
    nodes: nodes.map((node) => {
      if (node.type === 'definition') {
        return {
          id: node.id,
          type: 'DEFINITION',
          label: node.title || currentFlow.name,
          content: {
            description: node.body || '',
            relatedOffices: node.relatedOffices || [],
            templates: node.templates || [],
            resources: node.resources || [],
          },
          posX: node.x,
          posY: node.y,
          isDeletable: false,
          answers: [],
        };
      }
      if (node.type === 'decision') {
        return {
          id: node.id,
          type: 'DECISION',
          label: node.title || 'Decision',
          content: { question: node.title || 'Decision' },
          posX: node.x,
          posY: node.y,
          isDeletable: true,
          answers: (node.answers || []).map((answer, order) => {
            const row = { id: answer.id, text: answer.label, order };
            const rat = String(answer.rationale || '').trim();
            if (rat) row.rationale = rat;
            return row;
          }),
        };
      }
      if (node.type === 'people') {
        return {
          id: node.id,
          type: 'PEOPLE',
          label: node.name || 'Contact',
          content: {
            name: node.name || '',
            department: node.role || '',
            email: node.email || '',
            hiddenFromResearchers: Boolean(node.hiddenFromResearchers),
          },
          posX: node.x,
          posY: node.y,
          isDeletable: true,
          answers: [],
        };
      }
      return {
        id: node.id,
        type: 'ACTION',
        label: node.title || 'Action',
        content: {
          title: node.title || 'Action',
          description: node.description || '',
          assigneeKind: String(node.assignee || '').includes('@') ? 'email' : 'office',
          assignee: node.assignee || '',
          materials: ensureMaterialsArray(node.materials).map((material) => ({
            id: material.id || `mat-${Math.random()}`,
            label: material.label || 'Material',
            attachKind: material.attachKind || null,
            attachValue: material.attachValue || '',
          })),
        },
        posX: node.x,
        posY: node.y,
        isDeletable: true,
        answers: [],
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.from,
      sourceAnswerId: edge.fromPort === 'out' ? null : edge.fromPort,
      targetNodeId: edge.to,
      isDeletable: edge.locked !== true,
    })),
  };
}

/** One DECISION branch row: label (44px) + one-line rationale preview (18px), optional expanded rationale editor (+72px). */
function decisionSegmentHeight(answer) {
  const base = 62;
  const extra = answer && answer.rationaleExpanded ? 72 : 0;
  return base + extra;
}

/** Vertical center of the label row’s output port (matches NodeView `.node-answer-main`). */
function decisionPortLocalCenterY(node, idx) {
  const answers = node.answers || [];
  let y = 71;
  for (let k = 0; k < idx; k += 1) y += decisionSegmentHeight(answers[k]);
  return y + 22;
}

const nodeHeight = (node) => {
  if (node.type === 'start') return 72;
  if (node.type === 'definition') return 300;
  if (node.type === 'action') { const m = ensureMaterialsArray(node.materials).length; return 104 + (node.assignee ? 32 : 0) + 28 + m * 28 + 26; }
  if (node.type === 'publish') return 80;
  if (node.type === 'people') return node.email ? 104 : 86;
  if (node.type === 'decision') {
    const sum = (node.answers || []).reduce((s, a) => s + decisionSegmentHeight(a), 0);
    return 71 + sum + 30;
  }
  return 72 + (node.answers?.length || 0) * 44 + 30;
};

// Compute zoom+pan to fit all nodes centered in the viewport.
function computeFitViewport(nodes, wrapEl, padding) {
  padding = padding == null ? 60 : padding;
  if (!nodes || !nodes.length || !wrapEl) return null;
  const wrapW = wrapEl.clientWidth;
  const wrapH = wrapEl.clientHeight;
  const xs = nodes.map(function(n) { return n.x; });
  const ys = nodes.map(function(n) { return n.y; });
  const xe = nodes.map(function(n) { return n.x + NODE_W; });
  const ye = nodes.map(function(n) { return n.y + nodeHeight(n); });
  const minX = Math.min.apply(null, xs);
  const minY = Math.min.apply(null, ys);
  const maxX = Math.max.apply(null, xe);
  const maxY = Math.max.apply(null, ye);
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  if (contentW <= 0 || contentH <= 0) return null;
  const nextZoom = Math.min(1.5, Math.max(0.35, Math.min((wrapW - padding * 2) / contentW, (wrapH - padding * 2) / contentH)));
  return {
    zoom: nextZoom,
    pan: {
      x: wrapW / 2 - (minX + contentW / 2) * nextZoom,
      y: wrapH / 2 - (minY + contentH / 2) * nextZoom,
    },
  };
}

const portPos = (node, portId) => {
  const h = nodeHeight(node);
  if (portId === 'in') {
    if (node.type === 'definition') return { x: node.x, y: node.y + 150 };
    if (node.type === 'people') return { x: node.x, y: node.y + h / 2 };
    return { x: node.x, y: node.y + h / 2 };
  }
  if (portId === 'out') {
    if (node.type === 'definition') return { x: node.x + NODE_W, y: node.y + 150 };
    if (node.type === 'people') return { x: node.x + NODE_W, y: node.y + h / 2 };
    return { x: node.x + NODE_W, y: node.y + h / 2 };
  }
  const idx = node.answers?.findIndex(a => a.id === portId);
  if (idx < 0) return { x: node.x + NODE_W, y: node.y + h / 2 };
  return { x: node.x + NODE_W, y: node.y + decisionPortLocalCenterY(node, idx) };
};

const bezier = (a, b) => {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
};

