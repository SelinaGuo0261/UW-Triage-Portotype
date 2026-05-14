import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3100);
/** Max completion tokens (output). No app-side floor; set env to cap. Provider still enforces model max. */
function envOutputTokens(primaryEnv, fallbackDefault) {
  const v = Number(process.env[primaryEnv]) || Number(process.env.AI_MAX_OUTPUT_TOKENS);
  if (Number.isFinite(v) && v >= 1) return Math.floor(v);
  return fallbackDefault;
}
const claude128kBetaOn =
  process.env.CLAUDE_OUTPUT_128K_BETA !== '0' && process.env.CLAUDE_OUTPUT_128K_BETA !== 'false';
// Defaults: large output for file→flow. Claude uses 128k-output beta when enabled (see callClaude).
const AI_MAX_OUTPUT_TOKENS_CLAUDE = envOutputTokens('AI_MAX_OUTPUT_TOKENS_CLAUDE', claude128kBetaOn ? 128000 : 8192);
const AI_MAX_OUTPUT_TOKENS_OPENAI = envOutputTokens('AI_MAX_OUTPUT_TOKENS_OPENAI', 262144);
const SUPPORTED_AI_PROVIDERS = ['openai', 'claude', 'kimi'];
let aiConfig = null;

const FlowStatus = {
  DRAFT: 'DRAFT',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  PUBLISHED: 'PUBLISHED',
};

const PublishScope = {
  INTERNAL: 'INTERNAL',
  PUBLIC: 'PUBLIC',
};

const NodeType = {
  DEFINITION: 'DEFINITION',
  DECISION: 'DECISION',
  ACTION: 'ACTION',
  PEOPLE: 'PEOPLE',
};

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function now() {
  return new Date().toISOString();
}

async function readDb() {
  if (!existsSync(DB_PATH)) return { flows: [], publishedSnapshots: [] };
  return JSON.parse(await readFile(DB_PATH, 'utf8'));
}

async function writeDb(db) {
  await writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    ...headers,
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function summarizeText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Agreement routing flow generated from an uploaded source document.';
  return clean.slice(0, 240) + (clean.length > 240 ? '...' : '');
}

function inferFlowName(name, sourceFile, sourceText) {
  if (name?.trim()) return name.trim();
  if (sourceFile?.trim()) return sourceFile.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const match = String(sourceText || '').match(/\b(MTA|NDA|Data Use Agreement|DUA|Material Transfer Agreement)\b/i);
  return match ? `${match[0].toUpperCase()} Triage Flow` : 'Generated Agreement Flow';
}

function makeMaterial(label) {
  return { id: id('mat'), label, attachKind: null, attachValue: '' };
}

async function ensureAiConfigInteractive() {
  if (process.env.AI_PROVIDER && process.env.AI_API_KEY) {
    const provider = process.env.AI_PROVIDER.toLowerCase();
    aiConfig = {
      provider,
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL || defaultModelForProvider(provider),
    };
    return;
  }

  const rl = readline.createInterface({ input, output });
  const providerAnswer = await rl.question('Choose AI provider (openai/claude/kimi): ');
  const provider = (providerAnswer.trim() || 'claude').toLowerCase();
  const apiKey = (await rl.question('Enter API key (required for AI analysis): ')).trim();
  const modelAnswer = await rl.question(`Model (optional, default ${defaultModelForProvider(provider)}): `);
  rl.close();

  aiConfig = {
    provider,
    apiKey,
    model: modelAnswer.trim() || defaultModelForProvider(provider),
  };
}

function defaultModelForProvider(provider) {
  if (provider === 'openai') return 'gpt-4o-mini';
  if (provider === 'kimi') return 'moonshot-v1-auto';
  return 'claude-3-5-sonnet-latest';
}

function requireAiConfig() {
  if (!aiConfig || !SUPPORTED_AI_PROVIDERS.includes(aiConfig.provider)) {
    throw new Error(`AI provider is required and must be one of: ${SUPPORTED_AI_PROVIDERS.join(', ')}.`);
  }
  if (!aiConfig.apiKey) {
    throw new Error('AI API key is required. Restart the dev server and enter an API key.');
  }
  return aiConfig;
}

/** Circled digits ①…⑳ often mark table rows in UW procedure DOCX; mammoth leaves them on their own line. */
const CIRCLED_STEP_MARKS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

function nextNonEmptyLine(lines, startIndex) {
  for (let j = startIndex; j < lines.length; j += 1) {
    const t = lines[j].trim();
    if (t) return { index: j, text: t };
  }
  return null;
}

/** Pull checklist rows like "①" then next line title — used to stop the model from merging long OSP/SAGE sequences. */
function extractCircledStepInventory(sourceText) {
  const lines = String(sourceText || '').replace(/\r\n/g, '\n').split('\n');
  const skip = new Set(['步骤', '环节名称', '说明', '备注', '适用场景', '主管办公室', '注意事项']);
  const steps = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.length !== 1 || !CIRCLED_STEP_MARKS.includes(line)) continue;
    const next = nextNonEmptyLine(lines, i + 1);
    if (!next || skip.has(next.text)) continue;
    if (CIRCLED_STEP_MARKS.includes(next.text[0])) continue;
    steps.push({ mark: line, title: next.text.slice(0, 240) });
  }
  return steps;
}

/** Optional pass-1: structure dossier for the graph LLM (segmentation, chain hints, branch↔late-section linkage). */
function buildSourceTextAnalysisPrompt(input) {
  const sourceText = String(input.sourceText || '');
  const circledSteps = extractCircledStepInventory(sourceText);
  const checklistHint = circledSteps.length
    ? `\nParser also found circled step rows (for alignment with later graph stages):\n${circledSteps.map((s, idx) => `${idx + 1}. [${s.mark}] ${s.title}`).join('\n')}\n`
    : '';
  return `You are analyzing a long procedural document before another model builds a flowchart JSON.

Perform ALL of the following on the SOURCE TEXT:
1) Segmentation — split the document into segments (candidate "points" / stages). Each segment needs id, short title, summary, and roughLocation: "early"|"mid"|"late"|"whole".
2) Chain completion — list candidatePoints with likelyKind DEFINITION|DECISION|ACTION|PEOPLE|UNKNOWN and predecessorId (another candidate id or null). Brief rationale each.
3) Branch linkage & audit — documents often state "three cases" early, then describe case B's actions much later (not immediately after the fork). For each early fork, map each branch to later segment(s) that actually carry that branch's next steps. Then decisionOutgoingAudit: for every branch answer you infer, list documentSupportForNext: segments anywhere in the text that justify the next DECISION/ACTION (mappingConfidence high|medium|low). Flag gaps if prose for a branch seems missing.

Return ONLY strict JSON (no markdown fence) with this shape:
{
  "segmentation": [{"id":"seg-1","title":"string","summary":"string","roughLocation":"early|mid|late|whole"}],
  "candidatePoints": [{"id":"pt-1","title":"string","likelyKind":"DEFINITION|DECISION|ACTION|PEOPLE|UNKNOWN","predecessorId":null,"rationale":"string"}],
  "earlyForks": [{
    "summary":"string",
    "branches": [{
      "branchKey":"A",
      "answerTextHint":"short label for a wizard answer",
      "earlyEvidence":"string",
      "laterLinkedSections":[{"segmentId":"seg-3","whyThisBelongsToThisBranch":"string"}],
      "expectedNextKind":"ACTION|DECISION|PEOPLE",
      "nextNodeContentHints":["string"]
    }]
  }],
  "decisionOutgoingAudit": [{
    "forkSummary":"string",
    "branchKey":"string",
    "answerTextHint":"string",
    "documentSupportForNext":[{"segmentId":"string","snippet":"string","mappingConfidence":"high|medium|low"}],
    "notes":"string"
  }],
  "graphBuilderBrief":"Concise instructions for the graph model: how to wire DECISION answers to ACTION nodes when supporting prose is non-adjacent; language may match the source document."
}

Flow name (context): ${input.name || ''}
Source URL: ${input.sourceUrl || ''}
Source file: ${input.sourceFile || ''}
${checklistHint}
SOURCE TEXT:
${sourceText}`;
}

function formatPreprocessDossier(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const brief = String(obj.graphBuilderBrief || '').trim();
  const forks = Array.isArray(obj.earlyForks) ? JSON.stringify(obj.earlyForks) : '';
  const audit = Array.isArray(obj.decisionOutgoingAudit) ? JSON.stringify(obj.decisionOutgoingAudit) : '';
  const seg = Array.isArray(obj.segmentation) ? JSON.stringify(obj.segmentation) : '';
  const chain = Array.isArray(obj.candidatePoints) ? JSON.stringify(obj.candidatePoints) : '';
  const parts = [];
  if (brief) parts.push('## graphBuilderBrief\n' + brief);
  if (seg) parts.push('## segmentation (JSON)\n' + seg.slice(0, 4500));
  if (chain) parts.push('## candidatePoints (JSON)\n' + chain.slice(0, 4500));
  if (forks) parts.push('## earlyForks (JSON)\n' + forks.slice(0, 5500));
  if (audit) parts.push('## decisionOutgoingAudit (JSON)\n' + audit.slice(0, 4500));
  return parts.join('\n\n').slice(0, 14000);
}

async function analyzeSourceTextStructure(input, config) {
  const sourceText = String(input.sourceText || '').trim();
  if (sourceText.length < 64) return null;
  const prompt = buildSourceTextAnalysisPrompt(input);
  const text = await callAi(prompt, config);
  let jsonText = extractJsonCandidate(text);
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    try {
      const repaired = await repairJsonWithAi(
        jsonText,
        e.message,
        config,
        'a SOURCE STRUCTURE analysis dossier (segmentation, candidatePoints, earlyForks, decisionOutgoingAudit, graphBuilderBrief)'
      );
      jsonText = extractJsonCandidate(repaired);
      return JSON.parse(jsonText);
    } catch {
      try {
        return JSON.parse(repairCommonJsonIssues(jsonText));
      } catch {
        return null;
      }
    }
  }
}

function buildGraphPrompt(input, preprocessDossier = '') {
  const sourceText = String(input.sourceText || '');
  const circledSteps = extractCircledStepInventory(sourceText);
  const checklistBlock = circledSteps.length
    ? `\n---\nMandatory checklist (parser found these rows in the text — you MUST implement every line as its own graph stage on the branch that matches the document, e.g. the OSP/SAGE sponsored-research path for ①–⑧ below; do not skip or merge rows):\n${circledSteps.map((s, idx) => `${idx + 1}. [${s.mark}] ${s.title}`).join('\n')}\n`
    : '';
  const dossierBlock = preprocessDossier
    ? `\n---\nStructured document analysis (use this when wiring branches; supporting prose for a branch may appear far from where the fork is introduced — attach each DECISION answer edge to the ACTION/DECISION justified anywhere in the text, not only text adjacent to the question):\n${preprocessDossier}\n`
    : '';
  return `Return only strict JSON for a UW agreement triage graph with nodes and edges. Use this schema:
{
  "flowName": string,
  "description": string,
  "nodes": [
    {"tempId": string, "type": "DEFINITION|DECISION|ACTION|PEOPLE", "label": string, "content": object, "answers": [{"tempId": string, "text": string, "order": number, "rationale": string}]}
  ],
  "edges": [{"sourceNodeTempId": string, "sourceAnswerTempId": string|null, "targetNodeTempId": string}]
}
Rules:
- exactly one DEFINITION node
- DEFINITION content must include description, relatedOffices, templates, and resources
- DEFINITION has exactly one outgoing edge to the next node (DECISION, ACTION, or PEOPLE as appropriate). A flow may have zero DECISION nodes if the process is linear or single-outcome.
- If you include DECISION nodes, each DECISION answer must have an outgoing edge
- ACTION nodes may have **0 or 1** outgoing edge only. Use sourceAnswerTempId null on that edge (same convention as from DEFINITION). 0 = terminal outcome for that path; 1 = continue to the next ACTION, DECISION, or PEOPLE. Never attach more than one outgoing edge from the same ACTION.
- DECISION nodes represent branching: use **two or more answers** when the source document has a real fork; a **single-answer** DECISION is allowed only for linear "continue" steps. Each answer must have exactly one outgoing edge. Allowed flows include ACTION→ACTION, ACTION→DECISION, DECISION→ACTION, and DECISION→DECISION.
- For each DECISION answer, include **"rationale"**: a short sentence (判断依据) citing how the document supports choosing that branch; use empty string "" if none.
- ACTION content must include title, description, assigneeKind, assignee, and materials
- ACTION content.materials must be a JSON array (possibly empty) of objects like {"label":"..."}; never a single object or string at the top level
- materials attachKind must be null and attachValue must be empty
- Include at least one ACTION result.
- DECISION nodes must set content.question (string) for the end-user wizard; keep node.label aligned with that question when possible.
- Linear procedures: chain ACTION→ACTION or ACTION→DECISION with at most one edge per ACTION; use multi-answer DECISION only for branches (typically 2+ options). For circled/numbered step lists, prefer explicit stages rather than merging unrelated steps into one node.
- Use double-quoted JSON keys and string values only. No comments. No trailing commas.

Flow name: ${input.name || ''}
Source URL: ${input.sourceUrl || ''}
Source file: ${input.sourceFile || ''}
Text:
${sourceText}${checklistBlock}${dossierBlock}`;
}

function extractJsonCandidate(text) {
  const fenced = String(text || '').match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = String(text || '').indexOf('{');
  const end = String(text || '').lastIndexOf('}');
  if (start !== -1 && end > start) return String(text).slice(start, end + 1).trim();
  return String(text || '').trim();
}

async function callClaude(prompt, config) {
  const maxTokens = AI_MAX_OUTPUT_TOKENS_CLAUDE;
  const headers = {
    'content-type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (claude128kBetaOn && maxTokens > 8192) {
    headers['anthropic-beta'] = 'output-128k-2025-02-19';
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Claude API failed with ${response.status}`);
  return (data.content || []).map((part) => part.text || '').join('\n');
}

async function callOpenAICompatible(prompt, config, baseURL = 'https://api.openai.com/v1') {
  const body = {
    model: config.model,
    temperature: 0,
    max_tokens: AI_MAX_OUTPUT_TOKENS_OPENAI,
    messages: [{ role: 'user', content: prompt }],
  };
  if (config.provider === 'openai') {
    body.response_format = { type: 'json_object' };
  }
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `AI API failed with ${response.status}`);
  return data.choices?.[0]?.message?.content || '{}';
}

async function callAi(prompt, config) {
  if (config.provider === 'claude') return callClaude(prompt, config);
  if (config.provider === 'openai') return callOpenAICompatible(prompt, config);
  if (config.provider === 'kimi') return callOpenAICompatible(prompt, config, 'https://api.moonshot.ai/v1');
  throw new Error(`Unsupported AI provider: ${config.provider}`);
}

function generateFallbackGraph({ name, sourceFile, sourceText }) {
  const flowName = inferFlowName(name, sourceFile, sourceText);
  const defId = id('node');
  const docTypeId = id('node');
  const humanId = id('node');
  const irbId = id('node');
  const legalId = id('node');
  const manualId = id('node');
  const peopleId = id('node');
  const ansMta = id('ans');
  const ansNda = id('ans');
  const ansOther = id('ans');
  const ansHumanYes = id('ans');
  const ansHumanNo = id('ans');

  const description = summarizeText(sourceText);
  const nodes = [
    {
      id: defId,
      type: NodeType.DEFINITION,
      label: flowName,
      content: {
        description,
        relatedOffices: [
          { name: 'UW CoMotion', contact: 'comotion@uw.edu' },
          { name: 'Office of Sponsored Programs', contact: 'osp@uw.edu' },
        ],
        templates: [
          { label: `${flowName} intake template`, url: '' },
          { label: 'Agreement checklist', url: '' },
        ],
        resources: [
          { label: 'UW agreement guidance', url: '' },
        ],
      },
      posX: 0,
      posY: 0,
      isDeletable: false,
      answers: [],
    },
    {
      id: docTypeId,
      type: NodeType.DECISION,
      label: 'What kind of agreement is this?',
      content: { question: 'What kind of agreement is this?' },
      posX: 340,
      posY: 40,
      isDeletable: true,
      answers: [
        { id: ansMta, text: 'Material Transfer Agreement', order: 0 },
        { id: ansNda, text: 'Non-disclosure Agreement', order: 1 },
        { id: ansOther, text: 'Other or unsure', order: 2 },
      ],
    },
    {
      id: humanId,
      type: NodeType.DECISION,
      label: 'Does it involve human subjects?',
      content: { question: 'Does it involve human subjects?' },
      posX: 700,
      posY: 40,
      isDeletable: true,
      answers: [
        { id: ansHumanYes, text: 'Yes', order: 0 },
        { id: ansHumanNo, text: 'No', order: 1 },
      ],
    },
    {
      id: irbId,
      type: NodeType.ACTION,
      label: 'Route to IRB review',
      content: {
        title: 'Route to IRB review',
        description: 'Send the agreement package to the IRB coordinator before legal routing.',
        assigneeKind: 'office',
        assignee: 'IRB Office',
        materials: [makeMaterial('Draft agreement'), makeMaterial('IRB protocol number')],
      },
      posX: 1060,
      posY: -20,
      isDeletable: true,
      answers: [],
    },
    {
      id: legalId,
      type: NodeType.ACTION,
      label: 'Route to CoMotion legal',
      content: {
        title: 'Route to CoMotion legal',
        description: 'Prepare the standard agreement packet for CoMotion legal review.',
        assigneeKind: 'office',
        assignee: 'UW CoMotion Legal',
        materials: [makeMaterial('Draft agreement'), makeMaterial('Statement of work or project summary')],
      },
      posX: 1060,
      posY: 220,
      isDeletable: true,
      answers: [],
    },
    {
      id: manualId,
      type: NodeType.ACTION,
      label: 'Manual triage',
      content: {
        title: 'Manual triage',
        description: 'Ask an agreement specialist to classify the document and confirm next steps.',
        assigneeKind: 'email',
        assignee: 'comotion@uw.edu',
        materials: [makeMaterial('Uploaded agreement'), makeMaterial('Short explanation of request')],
      },
      posX: 700,
      posY: 320,
      isDeletable: true,
      answers: [],
    },
    {
      id: peopleId,
      type: NodeType.PEOPLE,
      label: 'CoMotion contact',
      content: {
        name: 'CoMotion Agreements',
        department: 'UW CoMotion',
        email: 'comotion@uw.edu',
        hiddenFromResearchers: false,
      },
      posX: 0,
      posY: 360,
      isDeletable: true,
      answers: [],
    },
  ];

  const edges = [
    { id: id('edge'), sourceNodeId: defId, sourceAnswerId: null, targetNodeId: docTypeId, isDeletable: false },
    { id: id('edge'), sourceNodeId: docTypeId, sourceAnswerId: ansMta, targetNodeId: humanId, isDeletable: true },
    { id: id('edge'), sourceNodeId: docTypeId, sourceAnswerId: ansNda, targetNodeId: legalId, isDeletable: true },
    { id: id('edge'), sourceNodeId: docTypeId, sourceAnswerId: ansOther, targetNodeId: manualId, isDeletable: true },
    { id: id('edge'), sourceNodeId: humanId, sourceAnswerId: ansHumanYes, targetNodeId: irbId, isDeletable: true },
    { id: id('edge'), sourceNodeId: humanId, sourceAnswerId: ansHumanNo, targetNodeId: legalId, isDeletable: true },
  ];

  return { flowName, description, nodes, edges };
}

async function generateGraph(input) {
  const config = requireAiConfig();
  let preprocessDossier = '';
  if (process.env.AI_SKIP_SOURCE_PREPROCESS !== '1') {
    try {
      const dossierObj = await analyzeSourceTextStructure(input, config);
      preprocessDossier = formatPreprocessDossier(dossierObj);
    } catch (e) {
      console.warn('[source preprocess]', e?.message || e);
    }
  }
  const prompt = buildGraphPrompt(input, preprocessDossier);
  const text = await callAi(prompt, config);
  let jsonText = extractJsonCandidate(text);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    try {
      const repaired = await repairJsonWithAi(jsonText, error.message, config, 'a UW agreement triage graph');
      jsonText = extractJsonCandidate(repaired);
      parsed = JSON.parse(jsonText);
    } catch (repairError) {
      try {
        parsed = JSON.parse(repairCommonJsonIssues(jsonText));
      } catch (localRepairError) {
        throw new Error(`AI returned invalid JSON and repair failed. Original parse error: ${error.message}. Repair error: ${repairError.message}. Local cleanup error: ${localRepairError.message}. Returned text starts with: ${String(text || '').slice(0, 700)}`);
      }
    }
  }
  return normalizeAiGraph(parsed, input);
}

async function repairJsonWithAi(badJson, parseError, config, schemaHint = 'a UW agreement triage graph') {
  const repairPrompt = `Fix this malformed JSON for ${schemaHint}.

Return ONLY valid strict JSON. No markdown, no comments, no explanation.
Keep the same schema and intent. Do not add trailing commas.

Parse error:
${parseError}

Malformed JSON:
${String(badJson || '')}`;

  return callAi(repairPrompt, config);
}

function repairCommonJsonIssues(text) {
  let fixed = String(text || '').trim();
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  fixed = fixed.replace(/}\s*{/g, '},{');
  fixed = fixed.replace(/]\s*"/g, '],"');
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');
  fixed = fixed.replace(/}\s*\n\s*"/g, '},\n"');
  fixed = fixed.replace(/]\s*\n\s*"/g, '],\n"');
  fixed = fixed.replace(/(true|false|null|\d)\s*\n\s*"/g, '$1,\n"');
  return fixed;
}

/** AI may return `materials` as one object, a string, or null — never assume it is an array. */
function normalizeActionMaterialsForNode(materials) {
  let list = [];
  if (materials == null) list = [];
  else if (Array.isArray(materials)) list = materials;
  else if (typeof materials === 'object') list = [materials];
  else if (typeof materials === 'string' && materials.trim()) list = [{ label: materials.trim() }];
  return list.map((mat, i) => ({
    id: mat && mat.id ? String(mat.id) : id('mat'),
    label: String((mat && (mat.label ?? mat.name)) || `Material ${i + 1}`),
    attachKind: mat && mat.attachKind != null ? mat.attachKind : null,
    attachValue: mat && mat.attachValue != null ? String(mat.attachValue) : '',
  }));
}

function normalizeAiGraph(raw, input) {
  if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new Error('AI response did not include valid nodes[] and edges[].');
  }
  const nodeIdByTemp = new Map();
  const answerIdByTemp = new Map();
  const nodes = raw.nodes.map((n, index) => {
    const nodeId = id('node');
    const nodeRef = n.tempId || n.id || n.nodeId || n.label || `n${index}`;
    [nodeRef, n.id, n.tempId, n.nodeId].filter(Boolean).forEach((key) => nodeIdByTemp.set(key, nodeId));
    const rawType = String(n.type || '').toUpperCase();
    const type = Object.values(NodeType).includes(rawType) ? rawType : NodeType.ACTION;
    const answers = (n.answers || []).map((a, order) => {
      const answerId = id('ans');
      const answerRef = a.tempId || a.id || a.answerId || a.text || `${nodeRef}-a${order}`;
      [answerRef, a.id, a.tempId, a.answerId].filter(Boolean).forEach((key) => answerIdByTemp.set(key, answerId));
      const ratRaw = a.rationale ?? a.basis ?? a.criteria ?? '';
      const rat = String(ratRaw || '').trim();
      const row = { id: answerId, text: String(a.text || `Answer ${order + 1}`), order: Number.isFinite(a.order) ? a.order : order };
      if (rat) row.rationale = rat;
      return row;
    });
    const content = n.content && typeof n.content === 'object' ? { ...n.content } : {};
    if (type === NodeType.ACTION) {
      content.materials = normalizeActionMaterialsForNode(content.materials);
    }
    if (type === NodeType.DECISION && !content.question) {
      content.question = String(n.label || n.content?.title || 'Next step');
    }
    return {
      id: nodeId,
      type,
      label: String(n.label || n.content?.title || n.content?.question || type),
      content,
      posX: type === NodeType.DEFINITION ? 0 : 340 + (index % 3) * 360,
      posY: type === NodeType.DEFINITION ? 0 : Math.floor(index / 3) * 220 + 40,
      isDeletable: type !== NodeType.DEFINITION,
      answers,
    };
  });
  const edges = raw.edges.map((e) => {
    const resolvedSourceId = nodeIdByTemp.get(e.sourceNodeTempId || e.sourceNodeId || e.from || e.source);
    const resolvedTargetId = nodeIdByTemp.get(e.targetNodeTempId || e.targetNodeId || e.to || e.target);
    const sourceNode = nodes.find((n) => n.id === resolvedSourceId);
    return {
      id: id('edge'),
      sourceNodeId: resolvedSourceId,
      sourceAnswerId: (e.sourceAnswerTempId || e.sourceAnswerId || e.answer || e.condition)
        ? answerIdByTemp.get(e.sourceAnswerTempId || e.sourceAnswerId || e.answer || e.condition) || null
        : null,
      targetNodeId: resolvedTargetId,
      isDeletable: sourceNode?.type !== NodeType.DEFINITION,
    };
  }).filter((e) => e.sourceNodeId && e.targetNodeId);
  if (!nodes.some((n) => n.type === NodeType.DEFINITION)) {
    throw new Error('AI response did not include a DEFINITION node.');
  }
  if (!nodes.some((n) => n.type === NodeType.ACTION)) {
    throw new Error('AI response did not include an ACTION node.');
  }
  return {
    flowName: raw.flowName || inferFlowName(input.name, input.sourceFile, input.sourceText),
    description: raw.description || summarizeText(input.sourceText),
    nodes,
    edges,
  };
}

function validateFlow(flow) {
  const errors = [];
  const warnings = [];
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const definitionNodes = nodes.filter((n) => n.type === NodeType.DEFINITION);
  const decisionNodes = nodes.filter((n) => n.type === NodeType.DECISION);
  const actionNodes = nodes.filter((n) => n.type === NodeType.ACTION);

  if (definitionNodes.length !== 1) errors.push('Exactly one DEFINITION node is required.');
  const definition = definitionNodes[0];
  if (definition) {
    const defOut = edges.filter((e) => e.sourceNodeId === definition.id);
    const defIn = edges.filter((e) => e.targetNodeId === definition.id);
    if (defIn.length) errors.push('DEFINITION node cannot have incoming edges.');
    if (defOut.length !== 1) errors.push('DEFINITION node must have exactly one outgoing edge.');
    if (defOut[0]) {
      const tgtType = nodeById.get(defOut[0].targetNodeId)?.type;
      if (!tgtType) errors.push('DEFINITION outgoing edge must target a valid node.');
      else if (tgtType === NodeType.DEFINITION) errors.push('DEFINITION cannot point to another DEFINITION.');
    }
  }

  for (const node of nodes) {
    const incoming = edges.filter((e) => e.targetNodeId === node.id);
    const outgoing = edges.filter((e) => e.sourceNodeId === node.id);
    if (![NodeType.DEFINITION, NodeType.PEOPLE].includes(node.type) && incoming.length === 0 && outgoing.length === 0) {
      errors.push(`${node.label} is isolated.`);
    }
    if (node.type === NodeType.ACTION && outgoing.length > 1) {
      errors.push(`${node.label}: ACTION may have at most one outgoing edge (found ${outgoing.length}).`);
    }
    if (node.type === NodeType.ACTION && !node.content?.assignee) {
      warnings.push(`${node.label} has no assignee.`);
    }
    if (node.type === NodeType.DECISION && (node.answers || []).length >= 2 && outgoing.length < 2) {
      warnings.push(`${node.label}: DECISION has multiple answers but fewer than two outgoing edges; check wiring.`);
    }
    if (node.type === NodeType.DECISION) {
      for (const answer of node.answers || []) {
        if (!edges.some((e) => e.sourceNodeId === node.id && e.sourceAnswerId === answer.id)) {
          errors.push(`${node.label} has a dead branch: ${answer.text}.`);
        }
      }
      if (/new decision|placeholder/i.test(node.label || node.content?.question || '')) {
        warnings.push(`${node.label} still looks like placeholder text.`);
      }
    }
  }

  if (!actionNodes.length) errors.push('At least one ACTION node is required.');
  if (!isAnyActionReachable(flow)) errors.push('No ACTION node is reachable from DEFINITION (follow edges from the node DEFINITION points to).');

  return { errors, warnings };
}

function isAnyActionReachable(flow) {
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const definition = nodes.find((n) => n.type === NodeType.DEFINITION);
  if (!definition) return false;
  const first = edges.find((e) => e.sourceNodeId === definition.id);
  if (!first) return false;
  const seen = new Set();
  const stack = [first.targetNodeId];
  while (stack.length) {
    const nodeId = stack.pop();
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);
    const node = byId.get(nodeId);
    if (node?.type === NodeType.ACTION) return true;
    edges.filter((e) => e.sourceNodeId === nodeId).forEach((e) => stack.push(e.targetNodeId));
  }
  return false;
}

function createSnapshot(flow, scope) {
  const hiddenPeople = new Set(flow.nodes.filter((n) => n.type === NodeType.PEOPLE && n.content?.hiddenFromResearchers).map((n) => n.id));
  return {
    id: id('snapshot'),
    flowId: flow.id,
    version: flow.version,
    publishScope: scope,
    snapshotJson: {
      flow: {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        version: flow.version,
      },
      nodes: flow.nodes.filter((n) => !hiddenPeople.has(n.id)),
      edges: flow.edges.filter((e) => !hiddenPeople.has(e.sourceNodeId) && !hiddenPeople.has(e.targetNodeId)),
    },
    publishedAt: now(),
  };
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const db = await readDb();

  if (req.method === 'GET' && url.pathname === '/api/flows') {
    const includeTrash = url.searchParams.get('trash') === '1';
    const flows = (db.flows || []).filter((flow) => includeTrash ? flow.trashedAt : !flow.trashedAt);
    return send(res, 200, { flows });
  }

  if (req.method === 'POST' && url.pathname === '/api/flows') {
    const body = await readJson(req);
    const graph = await generateGraph(body);
    const time = now();
    const flow = {
      id: id('flow'),
      name: graph.flowName,
      description: graph.description,
      status: FlowStatus.DRAFT,
      publishScope: null,
      aiStatus: 'AI_READY',
      aiError: null,
      version: 1,
      sourceUrl: body.sourceUrl || null,
      sourceFile: body.sourceFile || null,
      createdById: 'demo-admin',
      nodes: graph.nodes,
      edges: graph.edges,
      createdAt: time,
      updatedAt: time,
    };
    const issues = validateFlow(flow);
    db.flows.unshift(flow);
    await writeDb(db);
    return send(res, 201, { flow, issues });
  }

  const flowMatch = url.pathname.match(/^\/api\/flows\/([^/]+)$/);
  if (req.method === 'GET' && flowMatch) {
    const flow = db.flows.find((f) => f.id === flowMatch[1]);
    if (!flow) return send(res, 404, { error: 'Flow not found.' });
    return send(res, 200, { flow, issues: validateFlow(flow) });
  }

  if (req.method === 'PUT' && flowMatch) {
    const flow = db.flows.find((f) => f.id === flowMatch[1]);
    if (!flow) return send(res, 404, { error: 'Flow not found.' });
    const body = await readJson(req);
    flow.name = body.name ?? flow.name;
    flow.description = body.description ?? flow.description;
    flow.nodes = Array.isArray(body.nodes) ? body.nodes : flow.nodes;
    flow.edges = Array.isArray(body.edges) ? body.edges : flow.edges;
    flow.version += 1;
    flow.updatedAt = now();
    await writeDb(db);
    return send(res, 200, { flow, issues: validateFlow(flow) });
  }

  if (req.method === 'DELETE' && flowMatch) {
    const flowId = flowMatch[1];
    const flow = db.flows.find((f) => f.id === flowId);
    if (!flow) return send(res, 404, { error: 'Flow not found.' });
    flow.trashedAt = now();
    flow.status = FlowStatus.DRAFT;
    flow.publishScope = null;
    flow.updatedAt = now();
    db.publishedSnapshots = db.publishedSnapshots.filter((s) => s.flowId !== flowId);
    await writeDb(db);
    return send(res, 200, { trashed: true, flowId, flow });
  }

  const validateMatch = url.pathname.match(/^\/api\/flows\/([^/]+)\/validate$/);
  if (req.method === 'GET' && validateMatch) {
    const flow = db.flows.find((f) => f.id === validateMatch[1]);
    if (!flow) return send(res, 404, { error: 'Flow not found.' });
    return send(res, 200, { issues: validateFlow(flow) });
  }

  const publishMatch = url.pathname.match(/^\/api\/flows\/([^/]+)\/publish$/);
  if (req.method === 'POST' && publishMatch) {
    const flow = db.flows.find((f) => f.id === publishMatch[1]);
    if (!flow) return send(res, 404, { error: 'Flow not found.' });
    const body = await readJson(req);
    const scope = body.publishScope === PublishScope.INTERNAL ? PublishScope.INTERNAL : PublishScope.PUBLIC;
    const issues = validateFlow(flow);
    if (issues.errors.length) return send(res, 400, { error: 'Cannot publish until blocking errors are fixed.', issues });
    flow.status = FlowStatus.PUBLISHED;
    flow.publishScope = scope;
    flow.updatedAt = now();
    const snapshot = createSnapshot(flow, scope);
    db.publishedSnapshots = db.publishedSnapshots.filter((s) => s.flowId !== flow.id);
    db.publishedSnapshots.unshift(snapshot);
    await writeDb(db);
    return send(res, 200, { flow, snapshot });
  }

  if (req.method === 'GET' && url.pathname === '/api/knowledge-base') {
    const publicSnapshots = db.publishedSnapshots.filter((s) => s.publishScope === PublishScope.PUBLIC);
    const items = publicSnapshots.map((s) => ({
      id: s.flowId,
      name: s.snapshotJson.flow.name,
      description: s.snapshotJson.flow.description,
      version: s.version,
      publishedAt: s.publishedAt,
    }));
    return send(res, 200, { items });
  }

  const kbMatch = url.pathname.match(/^\/api\/knowledge-base\/([^/]+)$/);
  if (req.method === 'GET' && kbMatch) {
    const snapshot = db.publishedSnapshots.find((s) => s.flowId === kbMatch[1] && s.publishScope === PublishScope.PUBLIC);
    if (!snapshot) return send(res, 404, { error: 'Public flow not found.' });
    return send(res, 200, { snapshot });
  }

  return send(res, 404, { error: 'API route not found.' });
}

async function serveStatic(req, res, url) {
  let filePath = url.pathname;
  if (filePath === '/') filePath = '/admin.html';
  if (filePath === '/admin') filePath = '/admin.html';
  if (filePath === '/researcher') filePath = '/researcher.html';
  const abs = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!abs.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  try {
    const data = await readFile(abs);
    const ext = path.extname(abs);
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(data);
  } catch {
    send(res, 404, 'Not found');
  }
}

async function start() {
  await ensureAiConfigInteractive();

  createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      return await serveStatic(req, res, url);
    } catch (error) {
      send(res, 500, { error: error.message || 'Server error.' });
    }
  }).listen(PORT, () => {
    console.log(`AI provider: ${aiConfig?.provider || 'not configured'}`);
    console.log(`AI model: ${aiConfig?.model || 'not configured'}`);
    console.log(`UW Triage DOCX prototype running at http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
    console.log(`Researcher: http://localhost:${PORT}/researcher`);
  });
}

start().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
