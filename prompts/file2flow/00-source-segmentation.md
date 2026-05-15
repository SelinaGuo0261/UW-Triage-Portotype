You are splitting a procedural/policy document into ordered segments for downstream analysis.

Return ONLY strict JSON (no markdown fence, no comments) with this exact shape:

{"segments":[{"text":"..."},{"text":"..."}]}

=== CORE PRINCIPLE ===

Each segment must carry SUBSTANTIAL semantic weight. A segment is NOT a sentence or a bullet — it is a complete unit of meaning (one full obligation, one full rule with its conditions and exceptions, one full procedural step with its rationale, one full argument). When in doubt, MERGE rather than split. Over-segmentation is a worse failure than under-segmentation.

=== HARD REQUIREMENTS ===

1. **Lossless partition**: Concatenating every `segments[i].text` in array order must equal the SOURCE_TEXT below **exactly** (same characters, same length, same whitespace, same line breaks). No omissions, no paraphrase, no extra characters, no Unicode normalization, no trimming.

2. **Semantic coherence — the merge-on-doubt rule**:

   - A segment should be self-contained: a reader should understand what it is about without needing the previous or next segment.

   - If two adjacent passages share a topic, a subject, a conditional ("if X... then..."), a referent (pronouns, "this", "such cases"), or a cause-effect chain — they belong in the SAME segment.

   - If you cannot articulate a clear semantic reason why a boundary should exist between two passages, do not place a boundary there.

   - Bullet lists under a single heading or lead-in sentence are ONE segment, not N segments — unless each bullet is itself a multi-sentence sub-policy.

   - A heading and the paragraph(s) it introduces belong together.

   - Examples, exceptions, and clarifications attach to the rule they modify; they are not separate segments.

3. **Count guidance**:

   - Use between **2 and 20** segments for typical documents.

   - Only exceed 20 if the document is genuinely long (>5000 characters) AND contains that many distinct, non-overlapping topics.

   - **The right number is usually smaller than your first instinct.** Before finalizing, ask: "Could segment N be merged into segment N-1 or N+1 without losing clarity?" If yes, merge.

   - Very short documents (<500 chars) may use 1–2 segments.

4. **Anti-patterns to avoid**:

   - ❌ Splitting on every sentence boundary

   - ❌ Splitting on every bullet point

   - ❌ Splitting a numbered list into N segments when the list is one cohesive instruction set

   - ❌ Separating a definition from its usage in the same paragraph

   - ❌ Creating segments shorter than ~80 characters unless the source genuinely contains an isolated short statement

5. **JSON escaping**: Escape newlines `\n`), quotes `\"`), backslashes `\\`), and tabs `\t`) inside strings properly so the JSON parses with a standard parser.

=== SELF-CHECK BEFORE OUTPUT ===

For each adjacent pair (segment[i], segment[i+1]), confirm a human reader would agree these discuss meaningfully different things. If unsure for any pair → merge them.

SOURCE_TEXT length (characters): {{SOURCE_LENGTH}}

SOURCE_TEXT: {{SOURCE_TEXT}}