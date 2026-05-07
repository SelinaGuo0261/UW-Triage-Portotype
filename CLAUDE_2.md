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

This prototype folder contains copied UI shells:

```txt
public/admin.html
public/researcher.html
```

These copied files must follow the reference UI strictly. Layout, menu, canvas, modal, cards, and spacing should stay visually matched to the original HTML demos. Backend/data behavior can be wired behind existing controls.

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

File:

```txt
public/admin.html
```

Important adapters:

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
- Static sample cards remain UI-only demos.
- Static default `MTA Triage Flow` was changed from `published` to `draft` so Admin status matches Researcher visibility.
- Only backend-published `PUBLIC` snapshots should appear in Researcher.

Move to Trash:

- Right-click a saved/generated flow card to open a context menu beside cursor:

```txt
Open
Share
Rename
Move to Trash
```

- `Move to Trash` calls `DELETE /api/flows/:id`.
- Backend soft-deletes by setting `trashedAt`, clears `publishScope`, sets status to `DRAFT`, and removes any `PublishedSnapshot`.
- Result: published trashed flow disappears from researcher portal.
- Bottom-left sidebar `Trash` opens `TrashPage`, listing `GET /api/flows?trash=1`.
- Trash currently lists trashed flows only; restore/permanent delete are not implemented yet.

## Researcher Wiring

File:

```txt
public/researcher.html
```

The researcher UI is still the copied reference shell. Do not visually redesign it.

Backend public data:

- `KnowledgeBase` loads `GET /api/knowledge-base`.
- For each item, loads `GET /api/knowledge-base/:id`.
- `snapshotToDoc(snapshot)` adapts published snapshot into the existing `DOC_TYPES`-like shape.
- If no backend public flows exist, it falls back to static `DOC_TYPES`.

Researcher visibility:

- Only `PUBLISHED` flows with `publishScope = PUBLIC` should be exposed through `/api/knowledge-base`.
- `INTERNAL`, `DRAFT`, and trashed flows must not show in Researcher.

Knowledge Base card grid:

- Must always show four equal-size cards per row regardless of sidebar collapsed/expanded.
- Current grid uses:

```js
gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
```

- Cards use `minWidth: 0`; long titles use `overflowWrap: "anywhere"`.

## Known Current Issues / Next Likely Work

- Need to test the full Claude path after latest JSON repair changes with an actual Anthropic key.
- If Claude still returns malformed JSON, capture the persistent modal error and adjust prompt/parser.
- Trash has no restore/permanent delete yet.
- Right-click menu applies mainly to backend/generated flow cards for destructive actions.
- Backend is a local prototype, not the final Next.js/Prisma implementation from the DOCX.
