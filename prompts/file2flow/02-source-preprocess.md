You are analyzing a natural-language description of a document signing process before another model builds a flowchart JSON.

The SOURCE TEXT below is the complete material to analyze (typically restated from an original policy or guide). There are **no** pre-cut character segments — read the full text.

Your job:
1) Identify **candidate procedure points** (actions, decisions, definitions, contacts, or mixed). Emit each in **candidatePoints** with clear titles and likelyKind.
2) Emit **segmentation** (coarse thematic sections for branch linkage — narrative ids like `theme-1`, not character offsets).
3) **earlyForks** / **decisionOutgoingAudit** / **graphBuilderBrief** (branch prose may be far from the fork in the text).

Return ONLY strict JSON (no markdown fence) with this shape:
{
  "candidatePoints": [{
    "id":"pt-1",
    "title":"string",
    "likelyKind":"DEFINITION|DECISION|ACTION|PEOPLE|UNKNOWN",
    "predecessorId":null,
    "rationale":"string"
  }],
  "segmentation": [{"id":"theme-1","title":"string","summary":"string","roughLocation":"early|mid|late|whole"}],
  "earlyForks": [{
    "summary":"string",
    "branches": [{
      "branchKey":"A",
      "answerTextHint":"short label for a wizard answer",
      "earlyEvidence":"string",
      "laterLinkedSections":[{"themeId":"theme-2","whyThisBelongsToThisBranch":"string"}],
      "expectedNextKind":"ACTION|DECISION|PEOPLE",
      "nextNodeContentHints":["string"]
    }]
  }],
  "decisionOutgoingAudit": [{
    "forkSummary":"string",
    "branchKey":"string",
    "answerTextHint":"string",
    "documentSupportForNext":[{"snippet":"string","mappingConfidence":"high|medium|low"}],
    "notes":"string"
  }],
  "graphBuilderBrief":"Concise instructions for the graph model: how to wire DECISION answers to ACTION nodes when supporting prose is non-adjacent; language may match the source document."
}

Rules:
- Cover **all** numbered steps and decision paths in the Signing Process section; do not collapse unrelated obligations into one point.
- **candidatePoints** should be ordered roughly as a user would traverse the process.

Flow name (context): {{FLOW_NAME}}
Source URL: {{SOURCE_URL}}
Source file: {{SOURCE_FILE}}

SOURCE TEXT:
{{SOURCE_TEXT}}
