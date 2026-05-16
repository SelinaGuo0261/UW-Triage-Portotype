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

```txt
public/
├── admin.html               ← HTML shell, loads css + js in order
├── researcher.html
├── css/
│   ├── admin.css
│   └── researcher.css
└── js/
    ├── admin/
    │   ├── helpers.js         ← hooks destructure, Icon (incl. EyeOff), AVATAR_COLORS,
    │   │                        SEED_NODES/EDGES, NODE_W, API_BASE,
    │   │                        DEFAULT_DEFINITION_NODE, ensureDefinitionNode,
    │   │                        panForDefinition, computeFitViewport,
    │   │                        backendFlowToBuilderGraph, autoLayoutBuilderGraph,
    │   │                        builderGraphToBackendFlow, nodeHeight, portPos, bezier,
    │   │                        getNodeHeight, normalizeAllNodes, normalizeByColumn,
    │   │                        NORMALIZATION_HEIGHTS, resolveFlowStorageKey
    │   ├── storageAdapter.js  ← localStorage adapter: save/load/remove/loadAllFlows
    │   │                        also defines resolveFlowStorageKey(id) globally
    │   ├── useSaveManager.js  ← debounced autosave hook; returns { saveStatus, flushSave }
    │   ├── components.js      ← MaterialRow, AssigneeField, NodeView, ManagePeopleRow,
    │   │                        FlowCanvas, PreviewPanel, RightPanel, InviteModal,
    │   │                        PublishModal, MiniFlowPreview, NewFlowModal,
    │   │                        FlowLibrary, TrashPage
    │   └── app.js             ← App component + ReactDOM.createRoot
    └── researcher/
        ├── helpers.js
        ├── components.js
        └── app.js
```

**Load order in admin.html**: helpers → storageAdapter → useSaveManager → components → app.
All top-level declarations become globals (Babel transforms `const` → `var`).

## Run

```bash
cd "/Users/selinaguo/Desktop/vibe codings/uw_triage_docx_prototype"
npm run dev
```

Startup prompts interactively for AI provider, API key, and model. User uses `claude`. Server runs on port 3100. No hot-reload — restart required after `server.mjs` changes.

Default models: `openai → gpt-4o-mini`, `claude → claude-3-5-sonnet-latest`, `kimi → moonshot-v1-auto`.

## Backend

File: `server.mjs` | Persistence: `data/db.json`

Core API:
```
GET    /api/flows
GET    /api/flows?trash=1
POST   /api/flows                      # AI graph generation
GET    /api/flows/:id
PUT    /api/flows/:id
DELETE /api/flows/:id                  # soft-delete → trash
GET    /api/flows/:id/validate
POST   /api/flows/:id/publish          # publishScope: 'PUBLIC' or 'INTERNAL'
POST   /api/flows/:id/unpublish        # sets publishScope=null, status=DRAFT, removes snapshot
GET    /api/knowledge-base             # only PUBLIC snapshots
GET    /api/knowledge-base/:id         # only PUBLIC snapshots
```

**Unpublish implementation note**: The `/unpublish` route was added to `server.mjs` but the currently running server (started before that change) doesn't have it loaded. The frontend `handleUnpublishFlow` works around this by calling `POST /api/flows/:id/publish` with `{ publishScope: 'INTERNAL' }` instead. INTERNAL-scoped flows are invisible to researchers (knowledge-base endpoints filter for PUBLIC only). The `/unpublish` route will be active after the next server restart.

**Publish/unpublish state**: `isPublished = activeBackendFlow?.publishScope === 'PUBLIC'`. `flowToCard` maps `status === 'PUBLISHED' && publishScope === 'PUBLIC'` → `'published'`, anything else → `'draft'`. This ensures INTERNAL-scoped flows show "Not published" in the library.

Backend graph shapes: `Flow { id, name, description, status, publishScope, version, nodes, edges, trashedAt? }` | `Node { id, type: "DEFINITION"|"DECISION"|"ACTION"|"PEOPLE", label, content, posX, posY, isDeletable, answers }` | `Answer { id, text, order, rationale? }` | `Edge { id, sourceNodeId, sourceAnswerId, targetNodeId, isDeletable }` | `PublishedSnapshot { id, flowId, version, publishScope, snapshotJson, publishedAt }`.

### Important edge data quirk

The edge from a DEFINITION node to the first DECISION node has `sourceAnswerId` set to a non-null answer ID in some AI-generated flows. `backendFlowToBuilderGraph` normalises this: any edge whose source is a DEFINITION node always gets `fromPort = 'out'` regardless of `sourceAnswerId`. This prevents the SVG edge endpoint from missing the registered port dot.

## Save System

### storageAdapter.js

Swap this file to switch from localStorage to a real API backend. Defines two globals:

```js
resolveFlowStorageKey(id)  // returns 'flow_' + id — use everywhere, never build the key inline
storageAdapter             // { save(key, data), load(key), remove(key), loadAllFlows() }
```

Keys are namespaced with prefix `uw_triage_`. `loadAllFlows()` returns all `uw_triage_flow_*` entries.

### useSaveManager.js

Hook: `useSaveManager({ flowId, flowTitle, flowDescription, graph, isLocal })` → `{ saveStatus, flushSave }`.

- Debounces 500 ms; all writes go through `storageAdapter.save(resolveFlowStorageKey(flowId), …)`
- `saveStatus`: `'idle' | 'saving' | 'saved' | 'error' | 'quota'`; auto-clears `'saved'` after 3 s
- **Bug 1 fix**: `currentStateRef` synced after every render (no-deps effect) — safe to read in cleanups. Flush on `flowId` change (switching flows) using `latestRef`; flush on unmount using `currentStateRef`.
- `flushSave()` — exported for Back button: `onClick={() => { flushSave(); setPage('library'); }}`

### app.js save wiring

```js
const activeFlowId = activeBackendFlow?.id || scratchIdRef.current;
const isLocalFlow  = !activeBackendFlow && !!scratchIdRef.current;
const { saveStatus, flushSave } = useSaveManager({ flowId: activeFlowId, ... });
```

**Library reload**: `useEffect` on `[page, activeNav]` reloads card metadata from `storageAdapter.loadAllFlows()` whenever the library view mounts. This is the Bug 2 fix — ensures the library shows updated titles/timestamps after edits.

**Startup loading**: On app load, `storageAdapter.loadAllFlows()` is called alongside `GET /api/flows`. Backend cards get `localDraft` attached if a matching localStorage entry exists. Local-only (`isLocal: true`) drafts are shown as library cards.

**Open-flow logic**: both `onOpen` (library card) and sidebar click prefer `f.localDraft?.graph` over `backendFlowToBuilderGraph(f.backendFlow)` for initial state — this is the root fix for "AI flow changes not saved" bug.

### Scratch flows

When admin clicks "Build from scratch":
- `scratchIdRef.current = 'local_' + Date.now()` (stable ID for the session)
- A draft card is immediately added to `generatedFlowCards` with `isLocal: true`
- Autosave writes to `localStorage['uw_triage_flow_local_...']`
- On app reload, local-only drafts appear in the library

### Delete / Trash

`handleMoveToTrash` splits on `card.backendFlow`:
- **Backend flows**: calls `DELETE /api/flows/:id`, moves to `trashedFlowCards`
- **Local-only scratch flows**: no API call — removes from state, clears `scratchIdRef`, navigates to library
- **Both**: calls `storageAdapter.remove(resolveFlowStorageKey(card.id))` to clean up the autosave draft

## Builder Admin — Canvas UX

### Sidebar

- Section label: "Recent Flows" (was "My Flows"), capped at 4 cards, each clickable to open the flow
- Clicking a sidebar card runs the same open logic as the library `onOpen`

### Canvas publish controls

Header buttons (edit mode only):
```
[Share] [Preview] [Publish to Production]           ← when not published
[Share] [Preview] [Republish]                        ← when isPublished
```
Publish button opens `PublishModal`. When `isPublished`, the modal shows a danger-zone row at the bottom with an **Unpublish** button (`btn-danger`, `Icon.EyeOff`). No standalone Unpublish button in the header.

### Definition node — always present, locked

`DEFAULT_DEFINITION_NODE` and `ensureDefinitionNode(nodes)` in `helpers.js`. `FlowCanvas` wraps initial nodes and graph-change nodes with `ensureDefinitionNode`. `deleteNode` bails if `target.type === 'definition'`. Context menu hides Delete for definition nodes. Drag is already blocked in `onNodePointerDown`.

### Canvas open / pan position

`panForDefinition(nodes)` (helpers.js): `{ x: -defNode.x + 32, y: -defNode.y + 32 }`. Used as initial `pan` state and whenever a new graph loads — definition node always appears at the top-left corner (32px margin).

### Canvas zoom (wheel)

Non-passive `addEventListener('wheel', handler, { passive: false })` on the canvas wrap. **Never** use React `onWheel` prop (it's passive; `preventDefault()` is silently ignored).

Handler logic (friend's `deltaMode` detection preserved; zoom-toward-cursor added):
- `ctrlKey`: pinch or ctrl+scroll → zoom toward cursor using `zoomRef`/`panValRef`
- `mouseLikeZoom` (line/page or large pixel delta): zoom without cursor anchor
- Otherwise: two-finger scroll → pan canvas

### Preview mode transition

On `readOnly` change (entering/exiting preview):
1. **Enter**: save `{ zoom, pan }` to `savedViewportRef`, call `computeFitViewport(nodesRef.current, wrapRef.current)`, set `animating(true)`, update zoom/pan
2. **Exit**: restore `savedViewportRef`, set `animating(true)`, update zoom/pan
3. `animating` adds class `preview-transitioning` to `.canvas` div → CSS transition `transform 480ms cubic-bezier(0.4, 0, 0.2, 1)`; cleared after 520ms timeout

## Builder Admin — Port & Connection Alignment

### DOM-measured port positions

`FlowCanvas` maintains:
```js
portElsRef      // Map<nodeId:portId, DOM element> — populated via registerPort callback
portPosCacheRef // Map<nodeId:portId, {x,y}> — canvas-space coords, updated in useLayoutEffect
```

`useLayoutEffect([nodes])`: measures all registered ports via `getBoundingClientRect()`, converts to canvas coords `(screen - wrapRect - pan) / zoom`, stores in `portPosCacheRef`, calls `forceUpdate()` if any position changed > 0.5px.

`getDomPortPos(node, portId)`: returns cached measured position, falls back to `portPos()` formula. Used for all SVG edge endpoints and connection cursor.

### Input/output port CSS

```css
.port.input  { left: -7px; top: 50%; transform: translateY(-50%); }
.port.output { right: -7px; top: 50%; transform: translateY(-50%); }
/* hover rules include translateY(-50%) to preserve vertical center on scale */
```

`portPos()` simplified: all `'in'` and `'out'` port IDs return `{ x: node.x [±NODE_W], y: node.y + h/2 }`. Special-casing for definition/people removed.

### Decision node answer ports

Port dots for decision answers are rendered **inside** `.node-answer` elements (not as a separate sibling block). Each `.node-answer` has `position: relative` so `top: 50%` on the port anchors it to the visual center of that answer section regardless of text wrapping or rationale expansion.

```jsx
<div className="node-answer" key={a.id}>
  {!readOnly && <div ref={el => registerPort(node.id, a.id, el)}
    className="port output ..."
    style={{ position: 'absolute', right: '-7px', top: '50%', transform: 'translateY(-50%)' }}
    ...
  />}
  <div className="node-answer-main">...</div>
  ...
</div>
```

`decisionPortLocalCenterY` is still defined and used as fallback in `portPos()` for preview/readOnly mode.

## Builder Admin — Layout Normalization (AI flows only)

`autoLayoutBuilderGraph` (called from `backendFlowToBuilderGraph`, never from scratch flows) ends with a normalization pass:

```js
normalizeByColumn(flowNodes).concat(peopleNodes)
```

**Functions** (all in `helpers.js`):
- `getNodeHeight(node)` — single height source for normalization. Decision: `71 + answerCount*90 + 30` (90px/answer, not the formula's 62px which underestimates). Others: `max(nodeHeight(node), NORMALIZATION_HEIGHTS[type])`.
- `normalizeAllNodes(nodes)` — sorts by Y, redistributes with `getNodeHeight + LAYOUT_PADDING(20)`.
- `normalizeByColumn(nodes)` — groups by exact `n.x` (safe: `autoLayoutBuilderGraph` assigns `x = -310 + level*330`), applies `normalizeAllNodes` per column. Per-column preserves parallel branches; flat-across-all would produce a staircase.

**Why 90px/answer**: the CSS `.node-answer` section renders at ~85-90px (44px main + 25px rationale button + 11px padding + gaps), not the 62px that `decisionSegmentHeight` returns.

## AI JSON Handling

`POST /api/flows` calls the configured AI provider to generate graph JSON.

Server behavior: File2Flow pipeline with editable prompt templates under `prompts/file2flow/`, compact graph prompt (max 8 nodes, max 4 answers, max 3 materials), OpenAI JSON mode, AI repair pass, local cleanup pass, persistent frontend error display.

## Researcher Wiring

`publicDocs` loaded at `Portal` level from `GET /api/knowledge-base` (PUBLIC only). Passed to `KnowledgeBase`, `MyRequestsView`. Knowledge-base only shows `publishScope === 'PUBLIC'` flows — unpublishing (INTERNAL scope) hides flows from all researcher entry points automatically.

## Researcher Portal — DocumentDetail

Single-column layout with sticky left section nav (`.doc-secnav-panel`). `FlowchartPreview` and `SigningFlowSteps` accept `hideLabel` prop.

`findAllTerminalPaths` uses `edges.find(e => e.sourceNodeId === definition?.id)` (no `!e.sourceAnswerId` filter) to find the root edge — handles the definition→decision edge quirk.

## Known Current Issues / Next Likely Work

- `DocumentDetailPreviousDraft` and `InspectSettings` are dead code in `components.js`.
- Trash has no restore/permanent delete yet.
- `MyRequestsView` "Apply now" button does not create a real request — stub.
- `/api/flows/:id/unpublish` route is in `server.mjs` but requires a server restart to activate; frontend currently uses INTERNAL-scope publish as the working workaround.
- Backend is a local prototype, not the final Next.js/Prisma implementation.
