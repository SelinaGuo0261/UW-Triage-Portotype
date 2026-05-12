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
│   ├── admin.css            ← all admin CSS (524 lines)
│   └── researcher.css       ← all researcher CSS (222 lines)
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
        │                      CustomizePanel, DocumentTypesIndex,
        │                      DocumentDetailPreviousDraft, DocumentDetail,
        │                      ContactRow, ContactDirectory, ContactDetail,
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

Answer { id, text, order }

Edge { id, sourceNodeId, sourceAnswerId, targetNodeId, isDeletable }

PublishedSnapshot {
  id, flowId, version, publishScope, snapshotJson, publishedAt
}
```

## AI JSON Handling

`POST /api/flows` calls the configured AI provider to generate graph JSON.

Current server behavior:

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

## Known Current Issues / Next Likely Work

- Need to test the full Claude path with an actual Anthropic key.
- Trash has no restore/permanent delete yet.
- `DocumentDetailPreviousDraft` and `InspectSettings` are dead code — not reachable from UI but still in `components.js`.
- Backend is a local prototype, not the final Next.js/Prisma implementation from the DOCX.
