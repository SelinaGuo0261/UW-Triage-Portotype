You are completing predecessor links `predecessorId`) for procedure candidate points extracted from a signing-process document. A later step will build a flowchart from these points.

=== CRITICAL DATA PROTECTION RULE (READ FIRST) ===

The input CANDIDATE_POINTS JSON is authoritative and immutable except for one specific field. You may ONLY modify the value of `predecessorId` on existing points. You must NOT:

- Add new points to the array

- Remove any existing point (even apparent duplicates — leave them as-is)

- Change any field other than `predecessorId` — `id`, `title`, `likelyKind`, and `rationale` must be returned byte-for-byte identical to the input, including whitespace, casing, punctuation, and any quirks

- Reorder the array — return points in the same order they appear in the input

- Add new fields to any point

- Drop any field from any point

- Re-normalize, re-format, or "clean up" any string value

The shape and contents of every point are frozen. Only the single `predecessorId` value per point is editable.

=== INPUTS ===

1. **ORIGINAL SOURCE TEXT** — raw material, authoritative for order and dependencies.

2. **RESTATED SOURCE TEXT** — structured restatement, helpful for step order and branches.

3. **CANDIDATE_POINTS** — current list; some points have `"predecessorId": null` ("headless").

=== YOUR TASK ===

For each point in CANDIDATE_POINTS, decide the correct `predecessorId` using one of three outcomes:

**Outcome A — link to an existing point**

Set `predecessorId` to the `id` of the point in the array that must happen immediately before this one in the real process, based primarily on the ORIGINAL SOURCE TEXT.

**Outcome B — keep as the entry point**

Only the true process entry point (usually the DEFINITION / scope node) should retain `predecessorId: null`. There should normally be exactly one such point in the final array.

**Outcome C — genuinely unresolvable**

If the source text does not support any predecessor for a non-entry point, leave `predecessorId: null` and record the reason in the top-level `completionNotes`. Do NOT invent a link, and do NOT add a new intermediate point to bridge the gap — adding points is forbidden by the protection rule above.

=== RULES ===

- `predecessorId` must be `null` or an `id` that exists in the input array.

- The predecessor graph must be acyclic (a DAG toward the entry point).

- When multiple predecessors are plausible, prefer the one explicitly supported by the ORIGINAL SOURCE TEXT over the RESTATED one.

- Never invent an `id` that does not exist in the input.

=== OUTPUT FORMAT ===

Return ONLY strict JSON (no markdown fence, no preamble, no trailing commentary):

{

  "candidatePoints": [

    {

      "id": "...",                  // unchanged from input

      "title": "...",               // unchanged from input

      "likelyKind": "...",          // unchanged from input

      "predecessorId": "..." | null, // ONLY field you may edit

      "rationale": "..."            // unchanged from input

    }

  ],

  "completionNotes": "Short summary: which predecessorIds you set, and which (if any) you left null and why."

}

=== SELF-CHECK BEFORE OUTPUT ===

Run all of these checks; if any fails, fix and re-check:

1. Same number of points as the input array? (Must match exactly.)

2. Same order as the input array? (Must match exactly.)

3. For every point: are `id`, `title`, `likelyKind`, and `rationale` byte-for-byte identical to the input? (Mentally diff each field.)

4. No new fields added, no existing fields dropped on any point.

5. Every non-null `predecessorId` references an `id` that actually exists in the array.

6. No cycles in the predecessor graph.

7. Output is valid JSON with no markdown fence and no extra text.

Flow name (context): {{FLOW_NAME}}

Source file: {{SOURCE_FILE}}

ORIGINAL SOURCE TEXT:

{{ORIGINAL_SOURCE_TEXT}}

RESTATED SOURCE TEXT:

{{RESTATED_SOURCE_TEXT}}

CANDIDATE_POINTS (JSON):

{{CANDIDATE_POINTS_JSON}}