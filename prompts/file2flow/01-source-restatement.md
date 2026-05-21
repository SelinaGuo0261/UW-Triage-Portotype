Extract the information in this text and describe — in detailed natural language that preserves the original content and phrasing as closely as possible (minimize information loss) — what document-signing process(es) it covers and what steps or decision points each process contains.

Output format (strict — nothing else allowed):

1. Document Definition: Which document(s) does this process concern, and how is each defined?

2. Signing Process: What is the step-by-step procedure to get this document signed?

If the process begins with (or contains) a complex classification, triage, or multi-path decision — for example, routing by document subtype, by sponsor involvement, by data sensitivity, or by requester role — you MUST spell out that decision step in full before listing the paths: name every condition being evaluated, every possible outcome, and which path each outcome leads to. Do not collapse or abbreviate this triage step even if it feels redundant.

Format the process as numbered steps (1. 2. 3. ...). When the process branches by scenario, first state the decision step, then enumerate each path as its own numbered sub-sequence. Example shape:

  Step 1: Determine which scenario applies.

    - If the NDA relates to an active or pending sponsored project → follow Path 1.

    - If the NDA relates to technology transfer / IP disclosure of an innovation → follow Path 2.

    - If it is a data agreement (DUA/DTUA) not involving a sponsored project → follow Path 3.

  Path 1: 1. ...  2. ...  3. ...  4. ...

  Path 2: 1. ...  2. ...

  Path 3: 1. ...  2. ...

Output ONLY the two sections above. No preamble, no summary, no closing remarks, no extra commentary.

Self-checks before finalizing:

- Notes, cautions, exceptions, or special conditions found in the source must be folded into the relevant step or decision point — never list them as a standalone section or trailing note.

- Every decision/branching point must have explicit action guidance for each option. If the source leaves an option's next action implicit, infer the most reasonable next action from the surrounding context and write it in so no branch is left dangling.

- Preserve original terminology (e.g., exact form names, office names, system names) verbatim; do not paraphrase proper nouns.