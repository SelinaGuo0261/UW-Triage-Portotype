# CLAUDE_2.md — UW Triage DOCX Prototype Memory

## Active Prototype Folder

```txt
/Users/selinaguo/Desktop/vibe codings/uw_triage_docx_prototype
```

Important rule: **do not modify the original reference files unless explicitly asked**:

```txt
/Users/selinaguo/Desktop/vibe codings/UW Triage Builder Admin.html
/Users/selinaguo/Desktop/vibe codings/UW Triage Researcher.html
/Users/selinaguo/Desktop/vibe codings/uw_comotion_legal_agreement_triage/
```

## File Structure

The codebase was refactored from two monolithic HTML files into a multi-file structure. HTML shells are ~20 lines each; all logic lives in separate CSS and JS files.

```txt
public/
├── admin.html               ← HTML shell (~20 lines), loads css + js
├── researcher.html          ← HTML shell (~23 lines), loads css + js
├── css/
│   ├── admin.css            ← all admin CSS
│   └── researcher.css       ← all researcher CSS (includes .doc-secnav-panel rules)
└── js/
    ├── admin/
    │   ├── helpers.js       ← hooks destructure, Icon, AVATAR_COLORS, colorFor,
    │   │                      SEED_NODES/EDGES, NODE_W, API_BASE, FLOW_CARDS,
    │   │                      backendFlowToBuilderGraph, autoLayoutBuilderGraph,
    │   │                      builderGraphToBackendFlow, nodeHeight, portPos, bezier
    │   ├── components.js    ← all React components: MaterialRow, AssigneeField,
    │   │                      NodeView, ManagePeopleRow, FlowCanvas, PreviewPanel,
    │   │                      InspectSettings, RightPanel, InviteModal, PublishModal,
    │   │                      MiniFlowPreview, NewFlowModal, FlowLibrary, TrashPage
    │   └── app.js           ← App component + ReactDOM.createRoot
    └── researcher/
        ├── helpers.js       ← hooks destructure, Hairline/Mono/Pill/Avatar, Icon,
        │                      primaryBtn/ghostBtn/linkBtn style consts, CONTACTS,
        │                      OFFICE_GROUPS, DOC_TYPES, DOC_BY_ID, API_BASE,
        │                      snapshotToDoc
        ├── components.js    ← GraphDocWizard, DocWizard, StepCard, StepResults,
        │                      CustomizePanel, FlowchartPreview, FlowchartModal,
        │                      ReadOnlyFlowCanvas, SigningFlowSteps, SigningFlowModal,
        │                      MyRequestsSigningModal, MyRequestsView,
        │                      DocumentTypesIndex, DocumentDetail,
        │                      ContactDirectory, ContactDetail,
        │                      NavIcon, TopBar, LeftSidebar
        └── app.js           ← KnowledgeBase, StubTab, Portal + ReactDOM.createRoot
```

### How the multi-file setup works (no bundler)

Babel standalone (`@babel/standalone@7.29.0`) fetches and executes `<script type="text/babel" src="...">` files via synchronous XHR in DOM order. It also transforms `const` → `var`, so every top-level declaration becomes a global available to later files. Files must be loaded in dependency order (helpers → components → app).

When editing JS: target the specific file in `public/js/`. Do not edit the HTML shells for logic changes.

## Run

```bash
cd "/Users/selinaguo/Desktop/vibe codings/uw_triage_docx_prototype"
npm run dev
```

Startup prompts interactively:

```txt
Choose AI provider (openai/claude/kimi):
Enter API key (required for AI analysis):
Model (optional, default ...):
```

User wants to use `claude`. Claude request no longer sends `temperature` because newer Claude models reject it with "`temperature` is deprecated for this model."

Default models:

```txt
openai -> gpt-4o-mini
claude -> claude-3-5-sonnet-latest
kimi   -> moonshot-v1-auto
```

If no real API key is entered, AI analysis should fail visibly in the app. Do not silently use a fallback graph for user-facing AI analysis.

## Backend

File:

```txt
server.mjs
```

Persistence:

```txt
data/db.json
```

Core API:

```txt
GET    /api/flows
GET    /api/flows?trash=1
POST   /api/flows
GET    /api/flows/:id
PUT    /api/flows/:id
DELETE /api/flows/:id          # soft-delete / move to trash
GET    /api/flows/:id/validate
POST   /api/flows/:id/publish
GET    /api/knowledge-base
GET    /api/knowledge-base/:id
```

Backend graph shape follows `JXYZ_Dev_Guide_v5.docx`:

```js
Flow {
  id, name, description, status, publishScope, version,
  nodes: Node[],
  edges: Edge[],
  trashedAt?
}

Node {
  id, type: "DEFINITION" | "DECISION" | "ACTION" | "PEOPLE",
  label, content, posX, posY, isDeletable, answers: Answer[]
}

Answer { id, text, order, rationale? }

Edge { id, sourceNodeId, sourceAnswerId, targetNodeId, isDeletable }

PublishedSnapshot {
  id, flowId, version, publishScope, snapshotJson, publishedAt
}
```

### Important edge data quirk

The edge from a DEFINITION node to the first DECISION node has `sourceAnswerId` set to a non-null answer ID (not null) in some flows. `findAllTerminalPaths` must use `edges.find(e => e.sourceNodeId === definition?.id)` (no `!e.sourceAnswerId` filter) to find the root edge correctly.

### ACTION vs DECISION out-degree (validateFlow)

- **ACTION**: **0 or 1** outgoing edge (`sourceAnswerId` null when the edge exists). Allowed next types include ACTION, DECISION, PEOPLE.
- **DECISION**: branching uses **2+ answers** when the document forks; **1 answer** is allowed for linear “continue” gates. Each answer must have its own outgoing edge. `validateFlow` warns if a DECISION has 2+ answers but fewer than two outgoing edges from that node (wiring smell).

## AI JSON Handling

`POST /api/flows` calls the configured AI provider to generate graph JSON.

Current server behavior:

- optional **File2Flow debug dump**: JSON body `debugFile2flow: true` on `POST /api/flows` writes `data/file2flow-debug-last.json` (prompts, raw LLM text, extracted JSON, normalized graph) and returns `file2flowDebugPath` in the response; Admin URL `?file2flowDebug=1` adds that flag automatically
- **segment + pass-1 candidate snapshot** (always overwritten on each `POST /api/flows` graph generation): `data/file2flow-segments-candidates-last.json` — restatement, `restatedText`, preprocess LLM bundle when run, dossier injected into graph prompt; gitignored like the debug dump
- **editable LLM prompt templates** for File2Flow under `prompts/file2flow/`: `01-source-restatement.md`, `01b-flow-title-from-restatement.md` (short flow title from restated text), `02-source-preprocess.md`, `03-complete-candidate-points.md` (original text + predecessor repair), `04-graph-from-source.md`, `05-json-repair.md`; read on each request
- compact graph prompt: max 8 nodes, max 4 answers per decision, max 3 materials per action
- OpenAI JSON mode when provider is `openai`
- Claude/OpenAI/Kimi provider paths
- JSON extraction from fenced/prose responses
- AI repair pass if first parse fails
- local cleanup pass for common malformed JSON problems
- persistent frontend modal error display

If Claude returns malformed JSON, the full error stays visible inside the Create New Flow modal. Do not revert to disappearing-only toasts.

## Builder Admin Wiring

Files:

```txt
public/js/admin/helpers.js     ← adapters + constants
public/js/admin/components.js  ← all canvas/node/panel/modal components
public/js/admin/app.js         ← App root + mount
public/css/admin.css           ← all styles
```

Important adapters (in `helpers.js`):

```js
backendFlowToBuilderGraph(flow)
builderGraphToBackendFlow(currentFlow, nodes, edges)
autoLayoutBuilderGraph(graph)
```

Purpose:

- Convert DOCX/backend graph into existing Builder canvas nodes/edges.
- Convert edited Builder canvas back into backend graph before saving/publishing.
- Auto-layout generated flows to match the original seed canvas orientation.

Generated flow behavior:

- Existing `NewFlowModal` is visually unchanged.
- `Start AI Analysis` calls `POST /api/flows`.
- On success:
  - creates a backend flow
  - adds a new card to the existing Flowchart Library
  - switches to `page = "canvas"`
  - injects converted nodes/edges into the existing `FlowCanvas`
- `FlowCanvas` accepts `graph` and `onGraphChange`.
- `FlowCanvas` calls `onGraphChange({ nodes, edges })` so Admin can save current canvas state before publish.

Publish behavior:

- Existing Publish modal is visually unchanged.
- On publish:
  1. Convert current canvas graph to backend shape.
  2. `PUT /api/flows/:id` to save latest Admin edits.
  3. `POST /api/flows/:id/publish`.
  4. Backend replaces existing published snapshot for that flow.
- Researcher portal reads the latest `PUBLIC` snapshot, so republish updates researcher view.

Library persistence:

- On Admin load, `GET /api/flows` populates saved/generated backend flow cards.
- Only backend-published `PUBLIC` snapshots should appear in Researcher.

Move to Trash:

- Right-click a saved/generated flow card → context menu with Open / Share / Rename / Move to Trash.
- `Move to Trash` calls `DELETE /api/flows/:id`.
- Backend soft-deletes: sets `trashedAt`, clears `publishScope`, sets status to `DRAFT`, removes `PublishedSnapshot`.
- Bottom-left sidebar `Trash` opens `TrashPage`, listing `GET /api/flows?trash=1`.
- Trash currently lists trashed flows only; restore/permanent delete are not implemented yet.

## Researcher Wiring

Files:

```txt
public/js/researcher/helpers.js     ← constants, primitives, snapshotToDoc
public/js/researcher/components.js  ← wizard, results, document/contact detail
public/js/researcher/app.js         ← KnowledgeBase, Portal, mount
public/css/researcher.css           ← all styles
```

Backend public data:

- `KnowledgeBase` loads `GET /api/knowledge-base`.
- For each item, loads `GET /api/knowledge-base/:id`.
- `snapshotToDoc(snapshot)` (in `helpers.js`) adapts published snapshot into doc shape.
- If API returns no items, publicDocs stays `[]` (no static fallback).
- `publicDocs` is loaded at `Portal` level (in `app.js`) and passed to both `KnowledgeBase` and `MyRequestsView`.

Researcher visibility:

- Only `PUBLISHED` flows with `publishScope = PUBLIC` are exposed through `/api/knowledge-base`.
- `INTERNAL`, `DRAFT`, and trashed flows must not show in Researcher.

### Stage 3 "Your Choice" branching (fixed 2026-05-11)

`GraphDocWizard` passes `(actionNode, path)` to `onResult`. `DocumentDetail` stores `graphPath` and derives:

- `customizeQuestions` — questions in traversal order (from `graphPath`, not `doc.flow.questions`)
- `customizeAnswers` — `{ [nodeId]: answerId }` from the path

`CustomizePanel` receives `questions` + `answers` props (not `doc`). This ensures Stage 3 shows only the questions the user actually answered, in the correct order, with the correct selected values.

Knowledge Base card grid:

- Must always show four equal-size cards per row regardless of sidebar state.
- Grid: `gridTemplateColumns: "repeat(4, minmax(0, 1fr))"`, cards use `minWidth: 0`.

## Researcher Portal — Redesign (spec: researcher-portal-redesign-spec.md, 2026-05-12)

Implemented all three changes from the spec:

### Change 01 — DocumentDetail: single-column layout

`DocumentDetail` is now a full-width single-column page with a sticky left section nav. Sections in order:

1. Title + abbrev pill
2. Description
3. Related Offices
4. Available Templates
5. Flowchart Preview
6. Signing Flow Steps
7. Processing Time
8. "Still don't know how to apply?" + CTA

The right-column wizard is removed. A "Find a signing flow →" CTA button at the bottom opens a modal (Change 02).

### Change 02 — SigningFlowModal (KB entry point)

`SigningFlowModal` wraps `GraphDocWizard`/`DocWizard` in a centered modal (maxWidth 560, 88vh). Dimmed backdrop. Esc / backdrop-click closes. Shows result + `CustomizePanel` + "Apply now" / "Close" after flow completes.

### Change 03 — MyRequestsView + MyRequestsSigningModal

`MyRequestsView` replaces the stub tab for "My requests". Has a header with "Find a signing flow →" button. Opens `MyRequestsSigningModal` which shows Q1 as a doc-type selector (A/B/C labels + abbrev + summary) before loading the regular signing flow wizard. "Not sure?" escape hatch links back to KB.

## Researcher Portal — Document Detail Section Nav

### Layout

`DocumentDetail` body uses `position: relative` (not flex-row). A `.doc-secnav-panel` div is `position: absolute; left: 0; top: 0; bottom: 0; width: 200px; padding-left: 40px; display: flex; align-items: center`. The scroll container is `width: 100%; height: 100%; overflowY: auto` filling the full body area. This means the content `maxWidth: 760; margin: 0 auto` stays centered in the full main area — the nav does NOT take layout space.

### Scrolling reliability

- Each section has `id="ksec-{sectionId}"` (e.g. `id="ksec-processing"`).
- `scrollTo(id)` uses `document.getElementById("ksec-" + id)` — most reliable lookup.
- Scroll is done via direct `container.scrollTop` assignment (no `scrollTo()` with smooth, which has silent failure at max scroll extent).
- Active section is tracked via a `scroll` event listener on the container (NOT IntersectionObserver, which fails for bottom sections due to rootMargin constraints).
- `setActiveSection(id)` is called immediately on click for instant purple highlight.

### CSS

```css
.doc-secnav-panel {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 200px; padding-left: 40px;
  display: flex; align-items: center;
  z-index: 10; pointer-events: none;
}
.doc-secnav-panel * { pointer-events: auto; }
.doc-secnav { width: 160px; }
@media (max-width: 1100px) { .doc-secnav-panel { display: none; } }
```

### Components with hideLabel prop

`FlowchartPreview` and `SigningFlowSteps` accept `hideLabel` prop. When `hideLabel={true}`, the internal `Mono` section heading is suppressed so `DocumentDetail` can render subheadings externally with consistent styling.

## Researcher Portal — Flowchart Preview Modal

`FlowchartPreview` shows a compact thumbnail card with a decorative SVG and "View full flowchart →" button. Clicking opens `FlowchartModal` (960px wide, 82vh) with `ReadOnlyFlowCanvas`.

### ReadOnlyFlowCanvas

- Renders backend nodes (UPPERCASE types) at `posX`/`posY` from snapshot
- SVG bezier edges with `roBezier`, port positions via `roPortPos`
- DECISION nodes show answers with `1`, `2`, `3`... number badges (matching edge labels)
- Each edge from a DECISION node shows a number circle at the bezier midpoint `((fp.x+tp.x)/2, (fp.y+tp.y)/2)` matching the answer index
- Pan via pointer drag, zoom via non-passive wheel listener (`el.addEventListener("wheel", h, { passive: false })`)
- Auto-fit on mount: computes bounding box of all nodes, sets zoom + pan to fill the modal

### Node heights (backend shapes)

```js
DEFINITION: 112px
PEOPLE: 76px
ACTION: 82 + (assignee ? 20 : 0) + min(materials.length, 4) * 20
DECISION: 78 + answers.length * 28
```

## Researcher Portal — Signing Flow Steps

### Tabs

`findAllTerminalPaths(nodes, edges)` does DFS from the node DEFINITION points to, collecting one result per **terminal** ACTION (ACTION with no outgoing edges). ACTION nodes with outgoing edges are traversed through. Each tab = one terminal path. Tab label is built from path answers (`shortAnswerLabel`): text before first colon, or first 1-2 words per step, joined with " — ".

### Swimlane

Two columns: "UW Researcher (PI)" (purple) + ACTION node's `assignee` (tan/gold). Three derived steps per path:
1. PI: "Submit request" (with full answer path in description)
2. Assignee: ACTION node title + description + materials list
3. PI: "Review & acknowledge"

Transition labels between rows. Legend at bottom. `SigningSwimlane` also fuzzy-matches PEOPLE nodes by name/department to show contact under the office column header.

## Admin Portal — Canvas Changes (2026-05-12)

### Decision node answer numbering

Every answer in a decision node shows a numbered badge (`1`, `2`, `3`…) instead of a bullet dot. The number is rendered as a small mono span (`fontFamily: JetBrains Mono; fontSize: 9; background: purple-100; color: purple-700`). The map uses `(a, i)` to get the index.

Each outgoing branch line (edge) from a decision node also shows the matching number. The SVG edge rendering uses `findIndex` to get the answer's position, and renders a white circle with purple border + mono number at the bezier midpoint `((p1.x+p2.x)/2, (p1.y+p2.y)/2)` — replacing the old variable-width rect label that showed the full answer text.

### Decision node answer line-breaking

Answer inputs changed from `<input>` (single-line) to `<textarea>` (multi-line). Uses `field-sizing: content` CSS (same as the node title input) for CSS-native auto-height with no JavaScript. `resize: none` removes the browser drag handle. `word-wrap: break-word; overflow-wrap: break-word` ensures long words break at the card boundary. Node width stays fixed at `NODE_W = 240px`.

Per-answer row height increased from **28px → 44px** to accommodate wrapped text. Updated in both:
- `nodeHeight()` in `helpers.js`: `72 + answers.length * 44 + 30`
- portPos in `helpers.js`: `answerTop + idx * 44 + 22` (center of 44px row)

`.node-answer` CSS: `align-items: center; min-height: 44px` (no `position: relative` since port is no longer inside it).

### Decision node port alignment

**Problem**: port dots used `top: 50%; transform: translateY(-50%)` inside `.node-answer` (CSS-dynamic position), but `portPos()` used a hardcoded `answerTop = 76` formula — two independent calculations that diverged.

**Fix**: ports are moved OUT of `.node-answer` and rendered as direct children of `.node` using explicit pixel `top`:

```js
// portPos formula (helpers.js):
const answerTop = 71; // node-head (~37px) + node-title (~34px)
return { x: node.x + NODE_W, y: node.y + answerTop + idx * 44 + 22 };

// Port element top (components.js NodeView):
style={{ right: '-7px', top: `${71 + i * 44 + 22}px`, transform: 'translateY(-50%)' }}
```

Since both the SVG edge endpoint (`portPos`) and the DOM port element use the exact same arithmetic, dots and lines are always co-located regardless of answer content length.

`answerTop` changed from 76 → 71: node-head actual height = 10 (pad-top) + 18 (node-menu explicit height) + 8 (pad-bottom) + 1 (border) = 37px; node-title = 10 + 18 + 6 = 34px; total = 71px.

## Known Current Issues / Next Likely Work

- Need to test the full Claude path with an actual Anthropic key.
- Trash has no restore/permanent delete yet.
- `DocumentDetailPreviousDraft` and `InspectSettings` are dead code — not reachable from UI but still in `components.js`.
- Backend is a local prototype, not the final Next.js/Prisma implementation from the DOCX.
- `MyRequestsView` "Apply now" button does not yet create a real request — it is a stub.
