// ─────────────────────────────────────────────
// GraphDocWizard — 基于图遍历的向导（用于 backend 发布的 flow）
// ─────────────────────────────────────────────

function graphOutgoingEdges(edges, sourceNodeId) {
  return edges.filter((e) => e.sourceNodeId === sourceNodeId);
}

function graphActionHasOutgoing(node, edges) {
  return Boolean(node && node.type === "ACTION" && graphOutgoingEdges(edges, node.id).length);
}

function graphFollowActionContinue(node, edges, nodeById) {
  const outs = graphOutgoingEdges(edges, node.id);
  if (!outs.length) return null;
  const preferred = outs.find((e) => e.sourceAnswerId == null || e.sourceAnswerId === "");
  const edge = preferred || outs[0];
  return nodeById[edge.targetNodeId] || null;
}

function GraphDocWizard({ snapshot, onResult, onCancel }) {
  const graph = snapshot?.snapshotJson || {};
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const definition = nodes.find((n) => n.type === "DEFINITION");
  const rootEdge = edges.find((e) => e.sourceNodeId === definition?.id);
  const rootNode = nodeById[rootEdge?.targetNodeId];

  const [currentNode, setCurrentNode] = React.useState(rootNode);
  const [path, setPath] = React.useState([]);  // { node, answerId }[] — DECISION steps only
  const [actionTrail, setActionTrail] = React.useState([]); // ACTION chain for Back within ACTION→ACTION

  React.useEffect(() => {
    if (!rootNode || rootNode.type !== "ACTION") return undefined;
    if (graphActionHasOutgoing(rootNode, edges)) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) onResult(rootNode, []);
    });
    return () => { cancelled = true; };
  }, [rootNode, onResult, edges]);

  if (!rootNode) return (
    <div style={{ padding: 20, color: "var(--ink-500)", fontSize: 13 }}>
      Flow structure invalid: DEFINITION has no outgoing edge, or the target node is missing.
    </div>
  );

  if (rootNode.type === "ACTION" && !graphActionHasOutgoing(rootNode, edges)) {
    return (
      <div style={{ padding: 24, color: "var(--ink-600)", fontSize: 13, textAlign: "center" }}>
        Preparing outcome…
      </div>
    );
  }

  function advanceFromAction() {
    const next = graphFollowActionContinue(currentNode, edges, nodeById);
    if (!next) return;
    if (currentNode.type === "ACTION") {
      setActionTrail((t) => [...t, currentNode]);
    }
    if (next.type === "ACTION" && !graphActionHasOutgoing(next, edges)) {
      onResult(next, path);
      return;
    }
    setCurrentNode(next);
  }

  function pick(answerId) {
    const nextEdge = edges.find(
      (e) => e.sourceNodeId === currentNode.id && e.sourceAnswerId === answerId
    );
    const nextNode = nodeById[nextEdge?.targetNodeId];
    if (!nextNode) return;

    const newPath = [...path, { node: currentNode, answerId }];
    setPath(newPath);
    setActionTrail([]);

    if (nextNode.type === "ACTION") {
      if (graphActionHasOutgoing(nextNode, edges)) {
        setCurrentNode(nextNode);
      } else {
        onResult(nextNode, newPath);
      }
    } else {
      setCurrentNode(nextNode);
    }
  }

  function back() {
    if (currentNode.type === "DECISION" && path.length === 0 && actionTrail.length > 0) {
      const prev = actionTrail[actionTrail.length - 1];
      setActionTrail((t) => t.slice(0, -1));
      setCurrentNode(prev);
      return;
    }
    if (currentNode.type === "ACTION") {
      if (actionTrail.length > 0) {
        const prev = actionTrail[actionTrail.length - 1];
        setActionTrail((t) => t.slice(0, -1));
        setCurrentNode(prev);
        return;
      }
      if (path.length === 0) { onCancel(); return; }
      const prev = path[path.length - 1];
      setPath(path.slice(0, -1));
      setCurrentNode(prev.node);
      return;
    }
    if (path.length === 0) { onCancel(); return; }
    const prev = path[path.length - 1];
    setPath(path.slice(0, -1));
    setCurrentNode(prev.node);
  }

  if (currentNode.type === "ACTION") {
    const title = currentNode.content?.title || currentNode.label || "Step";
    const desc = currentNode.content?.description || "";
    const mats = (currentNode.content?.materials || []).map((m) => m.label).filter(Boolean);
    return (
      <div style={{ background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ padding: "20px 28px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "var(--ink-700)", fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              <Icon.Back /> {path.length === 0 && actionTrail.length === 0 ? "Cancel" : "Back"}
            </button>
            <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.5 }}>
              ACTION STEP
            </Mono>
          </div>
        </div>
        <div style={{ padding: "28px 28px 8px" }}>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 20, lineHeight: 1.3, color: "var(--ink-900)", letterSpacing: -0.3, fontWeight: 700 }}>
            {title}
          </div>
          {desc && (
            <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.5 }}>{desc}</div>
          )}
          {mats.length > 0 && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-600)" }}>
              <Mono style={{ fontSize: 9, color: "var(--ink-500)" }}>MATERIALS</Mono>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                {mats.slice(0, 6).map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={advanceFromAction}
            style={{ marginTop: 22, ...primaryBtn, width: "100%", justifyContent: "center" }}
          >
            继续 <Icon.Arrow />
          </button>
        </div>
        <div style={{ marginTop: 12, padding: "12px 28px", background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
          <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
            Review this action, then continue to the next step in the flow.
          </div>
        </div>
      </div>
    );
  }

  const stepNum = path.length + 1;
  const stepOptions = (currentNode.answers || []).map((a) => {
    const rat = String(a.rationale || "").trim();
    return { value: a.id, label: a.text, sub: rat || undefined };
  });

  return (
    <div style={{ background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ padding: "20px 28px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "var(--ink-700)", fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            <Icon.Back /> {path.length === 0 ? "Cancel" : "Back"}
          </button>
          <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.5 }}>
            QUESTION {String(stepNum).padStart(2, "0")}
          </Mono>
        </div>
      </div>

      <div style={{ padding: "28px 28px 8px" }}>
        <div style={{ fontFamily: "var(--font-headline)", fontSize: 20, lineHeight: 1.3, color: "var(--ink-900)", letterSpacing: -0.3, fontWeight: 700 }}>
          {currentNode.content?.question || currentNode.label}
        </div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {stepOptions.map((opt, i) => (
            <button key={opt.value} onClick={() => pick(opt.value)} style={{
              textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12,
              padding: "11px 14px", background: "white",
              border: "1px solid var(--ink-200)", borderRadius: 6, cursor: "pointer",
              fontFamily: "inherit",
            }}>
              <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: "1px solid var(--ink-300)", color: "var(--ink-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, marginTop: 1 }}>
                {String.fromCharCode(65 + i)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4, color: "var(--ink-900)" }}>{opt.label}</div>
                {opt.sub && (
                  <div style={{ marginTop: 3, fontSize: 11.5, lineHeight: 1.4, color: "var(--ink-500)" }}>{opt.sub}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, padding: "12px 28px", background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
        <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
          Step {stepNum} · select an option above to continue
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// wizard.jsx — per-doc intake wizard
// ─────────────────────────────────────────────

function DocWizard({ doc, initialAnswers, onApply, onCancel }) {
  const questions = doc.flow.questions;
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [stepIdx, setStepIdx] = useState(0);

  const step = questions[stepIdx];
  const total = questions.length;
  const answered = answers[step.id] !== undefined;
  const isLast = stepIdx === total - 1;
  const pct = ((stepIdx + (answered ? 1 : 0)) / total) * 100;

  function pick(v) { setAnswers({ ...answers, [step.id]: v }); }
  function next() { if (isLast) onApply(answers); else setStepIdx(stepIdx + 1); }
  function back() { if (stepIdx === 0) onCancel(); else setStepIdx(stepIdx - 1); }

  return (
    <div style={{ background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ padding: "20px 28px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "var(--ink-700)", fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
            <Icon.Back /> {stepIdx === 0 ? "Cancel" : "Back"}
          </button>
          <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.5 }}>
            QUESTION {String(stepIdx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </Mono>
        </div>
        <div style={{ height: 2, background: "var(--ink-200)", borderRadius: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "var(--purple-700)", transition: "width 240ms ease" }} />
        </div>
      </div>

      <div style={{ padding: "28px 28px 8px" }}>
        <div style={{ fontFamily: "var(--font-headline)", fontSize: 20, lineHeight: 1.3, color: "var(--ink-900)", letterSpacing: -0.3, fontWeight: 700 }}>
          {step.title}
        </div>
        {step.help && (
          <div style={{ marginTop: 6, color: "var(--ink-700)", fontSize: 13, lineHeight: 1.5 }}>{step.help}</div>
        )}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {step.options.map((opt, i) => {
            const sel = answers[step.id] === opt.value;
            return (
              <button key={opt.value} onClick={() => pick(opt.value)} style={{
                textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12,
                padding: "11px 14px",
                background: sel ? "var(--purple-50)" : "white",
                border: `1px solid ${sel ? "var(--purple-600)" : "var(--ink-200)"}`,
                borderRadius: 6, cursor: "pointer",
                transition: "border-color 120ms ease, background 120ms ease",
                fontFamily: "inherit",
                boxShadow: sel ? "0 0 0 3px var(--purple-100)" : "none",
              }}
              onMouseEnter={(e) => { if (!sel) e.currentTarget.style.borderColor = "var(--ink-300)"; }}
              onMouseLeave={(e) => { if (!sel) e.currentTarget.style.borderColor = "var(--ink-200)"; }}
              >
                <div style={{
                  flexShrink: 0, width: 20, height: 20, borderRadius: 4,
                  background: sel ? "var(--purple-700)" : "transparent",
                  border: sel ? "none" : "1px solid var(--ink-300)",
                  color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, marginTop: 1,
                }}>
                  {sel ? <Icon.Check /> : String.fromCharCode(65 + i)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--ink-900)", fontSize: 13.5, fontWeight: 500, lineHeight: 1.4 }}>{opt.label}</div>
                  {opt.sub && <div style={{ color: "var(--ink-500)", fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>{opt.sub}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 20, padding: "12px 28px", background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
          Press <Mono style={{ background: "var(--ink-200)", padding: "1px 5px", borderRadius: 3 }}>A–{String.fromCharCode(64 + step.options.length)}</Mono> to select
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onApply(answers)} disabled={Object.keys(answers).length === 0} style={{ ...ghostBtn, opacity: Object.keys(answers).length === 0 ? 0.5 : 1, cursor: Object.keys(answers).length === 0 ? "not-allowed" : "pointer" }} title="Submit answers collected so far">
            Apply now
          </button>
          <button onClick={next} disabled={!answered} style={{ ...primaryBtn, opacity: answered ? 1 : 0.4, cursor: answered ? "pointer" : "not-allowed" }}>
            {isLast ? "Generate flow" : "Next"} <Icon.Arrow />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// steps.jsx — step cards
// ─────────────────────────────────────────────

function StepCard({ step, idx, total, onContact, onSituationChange, situationValue }) {
  const [open, setOpen] = useState(false);
  const c = CONTACTS[step.contact];

  return (
    <div style={{ background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: "var(--purple-700)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>
          {String(idx + 1).padStart(2, "0")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Mono style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.6, textTransform: "uppercase" }}>
            Step {idx + 1} of {total} · {step.office}
          </Mono>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)", marginTop: 3, letterSpacing: -0.1 }}>{step.action}</div>
        </div>
      </div>

      {step.situation && (
        <div style={{ padding: "10px 20px", background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Situation</Mono>
          <span style={{ fontSize: 12.5, color: "var(--ink-700)" }}>{step.situation.label}:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {step.situation.options.map((opt) => {
              const sel = situationValue === opt.value;
              return (
                <button key={opt.value} onClick={() => onSituationChange(step.situation.branchOf, opt.value)} style={{
                  padding: "4px 10px", borderRadius: 999,
                  background: sel ? "var(--purple-700)" : "white",
                  color: sel ? "white" : "var(--ink-700)",
                  border: `1px solid ${sel ? "var(--purple-700)" : "var(--ink-200)"}`,
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
              );
            })}
          </div>
        </div>
      )}

      {open && (
        <div style={{ padding: "14px 20px", background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
          <Mono style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.6, textTransform: "uppercase" }}>Materials to prepare</Mono>
          <ul style={{ margin: "10px 0 4px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {step.materials.map((m, i) => (
              <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "var(--ink)" }}>
                <span style={{ color: "var(--ink-3)", marginTop: 1, flexShrink: 0 }}><Icon.Doc /></span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ padding: "12px 20px", background: "white", borderTop: "1px solid var(--ink-200)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => onContact(step.contact)} style={ghostBtn}>
          <Icon.Mail /> Contact {c.name.split(" ")[0]}
        </button>
        <button onClick={() => setOpen(!open)} style={{ ...ghostBtn, background: open ? "var(--ink-100)" : "white" }}>
          <Icon.Doc /> Materials to prepare
          <span style={{ transform: open ? "rotate(180deg)" : "rotate(0)", display: "inline-flex", transition: "transform 150ms" }}>
            <Icon.Chevron />
          </span>
        </button>
        <div style={{ flex: 1 }} />
        <Mono style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.5 }}>{c.dept}</Mono>
      </div>
    </div>
  );
}

function StepResults({ steps, situationOverrides, onSituationChange, onContact }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? steps : steps.slice(0, 1);

  return (
    <div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((s, i) => (
          <React.Fragment key={i}>
            <StepCard
              step={s} idx={i} total={steps.length}
              onContact={onContact}
              onSituationChange={onSituationChange}
              situationValue={s.situation ? situationOverrides[s.situation.branchOf] : null}
            />
            {i < visible.length - 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 8 }}>
                <div style={{ width: 1, height: 12, background: "var(--hairline-2)", marginTop: -6 }} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {steps.length > 1 && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: "white", border: "1px dashed var(--ink-300)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            {showAll
              ? `Showing all ${steps.length} steps in this signing flow.`
              : `${steps.length - 1} more step${steps.length - 1 === 1 ? "" : "s"} after this one.`}
          </div>
          <button onClick={() => setShowAll(!showAll)} style={linkBtn}>
            {showAll ? "Fold to step 1" : "See all steps"} <Icon.Arrow />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// customize.jsx — customization panel
// ─────────────────────────────────────────────

function CustomizePanel({ questions, answers }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--ink-200)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Stage 3</Mono>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2 }}>
            Your choice
          </div>
        </div>
      </div>

      <div style={{ padding: "6px 0" }}>
        {(questions || []).map((q, i) => {
          const opt = (q.options || []).find((o) => o.value === answers[q.id]);
          return (
            <div key={q.id} style={{ padding: "12px 20px", borderTop: i === 0 ? "none" : "1px solid var(--ink-200)", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.5, marginTop: 4, flexShrink: 0, width: 26 }}>
                Q{i + 1}
              </Mono>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.4 }}>{q.title}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 13.5, color: "var(--ink-900)", fontWeight: 500 }}>
                    {opt ? opt.label : <span style={{ color: "var(--ink-500)", fontWeight: 400, fontStyle: "italic" }}>Not answered</span>}
                  </span>
                  {opt?.sub && (
                    <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--ink-500)", lineHeight: 1.45 }}>{opt.sub}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// documents-pages.jsx — index + detail
// ─────────────────────────────────────────────

// ── Read-only flowchart canvas (card-style nodes + bezier edges) ──

const RO_NODE_W = 220;

function roDecisionAnswerBlockH(a) {
  return 26 + (String(a.rationale || '').trim() ? 14 : 0);
}

function roNodeHeight(node) {
  if (node.type === "DEFINITION") return 112;
  if (node.type === "PEOPLE") return 76;
  if (node.type === "ACTION") {
    const mats = Math.min((node.content?.materials || []).length, 4);
    return 82 + (node.content?.assignee ? 20 : 0) + mats * 20;
  }
  const ans = node.answers || [];
  return 78 + ans.reduce((s, a) => s + roDecisionAnswerBlockH(a), 0) + 4;
}

function roPortPos(node, portId) {
  const h = roNodeHeight(node);
  const x = node.posX, y = node.posY;
  if (portId === "in")  return { x, y: y + h / 2 };
  if (portId === "out") return { x: x + RO_NODE_W, y: y + h / 2 };
  const idx = (node.answers || []).findIndex((a) => a.id === portId);
  if (idx >= 0) {
    const answers = node.answers || [];
    let acc = 78;
    for (let k = 0; k < idx; k += 1) acc += roDecisionAnswerBlockH(answers[k]);
    acc += roDecisionAnswerBlockH(answers[idx]) / 2;
    return { x: x + RO_NODE_W, y: y + acc };
  }
  return { x: x + RO_NODE_W, y: y + h / 2 };
}

function roBezier(a, b) {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

function ReadOnlyFlowNode({ node }) {
  const label = node.content?.question || node.content?.title || node.label;
  const BADGE = {
    DECISION:   { bg: "var(--purple-100)",        color: "var(--purple-800)" },
    ACTION:     { bg: "oklch(0.94 0.04 155)",     color: "oklch(0.38 0.12 155)" },
    DEFINITION: { bg: "oklch(0.92 0.05 200)",     color: "oklch(0.32 0.12 200)" },
    PEOPLE:     { bg: "oklch(0.91 0.06 220)",     color: "oklch(0.34 0.14 220)" },
  };
  const badge = BADGE[node.type] || { bg: "var(--ink-100)", color: "var(--ink-700)" };
  return (
    <div style={{
      position: "absolute", left: node.posX, top: node.posY, width: RO_NODE_W,
      background: "white", borderRadius: 8, border: "1px solid var(--ink-200)",
      boxShadow: "0 1px 4px rgba(30,20,50,0.08)", userSelect: "none", pointerEvents: "none",
      ...(node.type === "DEFINITION" ? { borderLeft: "3px solid oklch(0.52 0.12 200)" } : {}),
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px 6px", borderBottom: "1px solid var(--ink-200)" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 500, padding: "2px 5px", borderRadius: 3, letterSpacing: "0.04em", textTransform: "uppercase", background: badge.bg, color: badge.color }}>
          {node.type.toLowerCase()}
        </span>
      </div>
      <div style={{ padding: "7px 10px 9px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-900)", lineHeight: 1.35 }}>{label}</div>
        {node.type === "DECISION" && (node.answers || []).map((a, i) => (
          <div key={a.id} style={{ padding: "2px 0 1px", fontSize: 11.5, color: "var(--ink-700)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: "var(--purple-700)", background: "var(--purple-100)", borderRadius: 3, padding: "1px 4px", flexShrink: 0, marginTop: 1, lineHeight: 1.4 }}>{i + 1}</span>
              <span style={{ lineHeight: 1.4 }}>{a.text}</span>
            </div>
            {String(a.rationale || "").trim() && (
              <div style={{ paddingLeft: 22, marginTop: 2, fontSize: 10, lineHeight: 1.35, color: "var(--ink-500)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {a.rationale}
              </div>
            )}
          </div>
        ))}
        {node.type === "ACTION" && node.content?.assignee && (
          <div style={{ marginTop: 3, fontSize: 11, color: "var(--ink-500)", fontStyle: "italic" }}>{node.content.assignee}</div>
        )}
        {node.type === "ACTION" && (node.content?.materials || []).slice(0, 3).map((m, i) => (
          <div key={i} style={{ fontSize: 11, color: "var(--ink-600)", marginTop: 2 }}>· {m.label}</div>
        ))}
        {node.type === "DEFINITION" && node.content?.description && (
          <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--ink-700)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
            {node.content.description}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadOnlyFlowCanvas({ nodes, edges }) {
  const containerRef = useRef(null);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const lastXY = useRef(null);
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  useEffect(() => {
    if (!containerRef.current || !nodes.length) return;
    const xs = nodes.map((n) => n.posX), ys = nodes.map((n) => n.posY);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + RO_NODE_W;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 200;
    const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight;
    const newZoom = Math.min(1, (cw - 80) / (maxX - minX), (ch - 80) / (maxY - minY));
    setPan({ x: (cw - (maxX - minX) * newZoom) / 2 - minX * newZoom, y: (ch - (maxY - minY) * newZoom) / 2 - minY * newZoom });
    setZoom(newZoom);
  }, [nodes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const LINE = WheelEvent.DOM_DELTA_LINE;
    const PAGE = WheelEvent.DOM_DELTA_PAGE;
    const PIXEL = WheelEvent.DOM_DELTA_PIXEL;
    const handler = (e) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom((z) => Math.max(0.25, Math.min(2, z + -e.deltaY * 0.002)));
        return;
      }
      const mouseLikeZoom =
        e.deltaMode === LINE ||
        e.deltaMode === PAGE ||
        (e.deltaMode === PIXEL && absY >= 32 && absY > absX * 1.4);
      if (mouseLikeZoom && absY >= absX) {
        e.preventDefault();
        let dz;
        if (e.deltaMode === LINE) dz = -Math.sign(e.deltaY || 1) * 0.09;
        else if (e.deltaMode === PAGE) dz = -Math.sign(e.deltaY || 1) * 0.22;
        else dz = Math.max(-0.22, Math.min(0.22, -e.deltaY * 0.0022));
        setZoom((z) => Math.max(0.25, Math.min(2, z + dz)));
        return;
      }
      e.preventDefault();
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  function onPD(e) {
    if (e.button !== 0) return;
    dragging.current = true; lastXY.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPM(e) {
    if (!dragging.current || !lastXY.current) return;
    const dx = e.clientX - lastXY.current.x, dy = e.clientY - lastXY.current.y;
    lastXY.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function onPU() { dragging.current = false; lastXY.current = null; }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "var(--canvas-bg)", cursor: "grab" }}
      onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}>
      <div style={{ position: "absolute", transformOrigin: "0 0", transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
        <svg style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }} width="1" height="1">
          {edges.map((edge) => {
            const fn = nodeById[edge.sourceNodeId], tn = nodeById[edge.targetNodeId];
            if (!fn || !tn) return null;
            const fp = edge.sourceAnswerId ? roPortPos(fn, edge.sourceAnswerId) : roPortPos(fn, "out");
            const tp = roPortPos(tn, "in");
            const d = roBezier(fp, tp);
            // Answer index for DECISION outgoing edges (bezier midpoint = avg of endpoints for symmetric control points)
            let ansNum = null;
            if (edge.sourceAnswerId && fn.type === "DECISION") {
              const idx = (fn.answers || []).findIndex((a) => a.id === edge.sourceAnswerId);
              if (idx >= 0) ansNum = idx + 1;
            }
            const mx = (fp.x + tp.x) / 2;
            const my = (fp.y + tp.y) / 2;
            return (
              <g key={edge.id}>
                <path d={d} fill="none" stroke="var(--ink-300)" strokeWidth="1.5" strokeLinecap="round" />
                {ansNum !== null && (
                  <g>
                    <circle cx={mx} cy={my} r={8} fill="white" stroke="var(--purple-600)" strokeWidth="1.2" />
                    <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="9" fontFamily="'JetBrains Mono', monospace" fill="var(--purple-700)" fontWeight="700">{ansNum}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        {nodes.map((n) => <ReadOnlyFlowNode key={n.id} node={n} />)}
      </div>
      <div style={{ position: "absolute", bottom: 10, right: 14, fontSize: 11, color: "var(--ink-400)", pointerEvents: "none", display: "flex", gap: 8 }}>
        <span>Drag to pan</span><span>·</span><span>Scroll to zoom</span>
      </div>
    </div>
  );
}

function FlowchartModal({ doc, onClose }) {
  const graph = doc._snapshot?.snapshotJson || {};
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(20,10,40,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 960, height: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 28px 90px rgba(20,10,40,0.28)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--ink-200)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>Flowchart — {doc.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 1 }}>Read-only · drag to pan · scroll to zoom</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-500)", padding: "4px 8px", borderRadius: 4, fontSize: 20, lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {nodes.length > 0
            ? <ReadOnlyFlowCanvas nodes={nodes} edges={edges} />
            : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-500)", fontSize: 13, fontStyle: "italic" }}>No flowchart data available.</div>
          }
        </div>
      </div>
    </div>
  );
}

function FlowchartPreview({ doc, hideLabel }) {
  const [showModal, setShowModal] = useState(false);
  const graph = doc._snapshot?.snapshotJson || {};
  const nodes = graph.nodes || [];
  const decisions = nodes.filter((n) => n.type === "DECISION").length;
  const actions = nodes.filter((n) => n.type === "ACTION").length;
  const hasData = nodes.length > 0;

  return (
    <div style={{ marginTop: hideLabel ? 0 : 28 }}>
      {!hideLabel && <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Flowchart preview</Mono>}
      <div
        onClick={hasData ? () => setShowModal(true) : undefined}
        style={{ marginTop: 10, background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, boxShadow: "var(--shadow-sm)", overflow: "hidden", cursor: hasData ? "pointer" : "default", transition: "border-color 120ms, box-shadow 120ms" }}
        onMouseEnter={hasData ? (e) => { e.currentTarget.style.borderColor = "var(--purple-200)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; } : undefined}
        onMouseLeave={hasData ? (e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; } : undefined}
      >
        {/* Thumbnail area */}
        <div style={{ background: "var(--canvas-bg)", borderBottom: "1px solid var(--ink-200)", height: 92, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <svg width="268" height="76" viewBox="0 0 268 76" style={{ opacity: hasData ? 0.75 : 0.35 }}>
            <rect x="4"   y="20" width="52"  height="28" rx="4" fill="oklch(0.92 0.05 200)" stroke="oklch(0.72 0.10 200)" strokeWidth="1"/>
            <text x="30"  y="37" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="oklch(0.32 0.12 200)">definition</text>
            <rect x="76"  y="9"  width="62"  height="50" rx="4" fill="var(--purple-100)" stroke="var(--purple-300)" strokeWidth="1"/>
            <text x="107" y="27" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="var(--purple-800)">decision</text>
            <line x1="84" y1="39" x2="130" y2="39" stroke="var(--purple-200)" strokeWidth="0.8"/>
            <text x="107" y="50" textAnchor="middle" fontSize="7.5" fill="var(--purple-600)">A / B / C</text>
            <rect x="160" y="4"  width="54"  height="26" rx="4" fill="oklch(0.94 0.04 155)" stroke="oklch(0.74 0.10 155)" strokeWidth="1"/>
            <text x="187" y="19" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="oklch(0.38 0.12 155)">action</text>
            <rect x="160" y="40" width="54"  height="26" rx="4" fill="oklch(0.94 0.04 155)" stroke="oklch(0.74 0.10 155)" strokeWidth="1"/>
            <text x="187" y="55" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="oklch(0.38 0.12 155)">action</text>
            <rect x="222" y="20" width="42"  height="26" rx="4" fill="oklch(0.94 0.04 155)" stroke="oklch(0.74 0.10 155)" strokeWidth="1"/>
            <text x="243" y="35" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="oklch(0.38 0.12 155)">action</text>
            <path d="M56 34 C66 34 66 34 76 34" stroke="var(--ink-400)" strokeWidth="1.2" fill="none"/>
            <path d="M138 24 C149 24 149 17 160 17" stroke="var(--ink-400)" strokeWidth="1.2" fill="none"/>
            <path d="M138 44 C149 44 149 53 160 53" stroke="var(--ink-400)" strokeWidth="1.2" fill="none"/>
            <path d="M138 34 C149 34 149 33 222 33" stroke="var(--ink-400)" strokeWidth="1.2" fill="none"/>
          </svg>
        </div>
        {/* Footer */}
        <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-700)" }}>
            {hasData
              ? <span><span style={{ fontWeight: 600 }}>{decisions}</span> decision{decisions !== 1 ? "s" : ""} · <span style={{ fontWeight: 600 }}>{actions}</span> outcome{actions !== 1 ? "s" : ""}</span>
              : <span style={{ color: "var(--ink-400)", fontStyle: "italic" }}>No flowchart available</span>
            }
          </div>
          {hasData && (
            <button onClick={(e) => { e.stopPropagation(); setShowModal(true); }} style={{ ...primaryBtn, fontSize: 12, padding: "5px 12px" }}>
              View full flowchart <Icon.Arrow />
            </button>
          )}
        </div>
      </div>
      {showModal && <FlowchartModal doc={doc} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── Signing Flow Steps: tabs + swimlane ──

function shortAnswerLabel(text, numWords) {
  if (!text) return "";
  const ci = text.indexOf(":");
  if (ci > 0 && ci <= 22) return text.slice(0, ci).trim();
  const words = text.split(/\s+/);
  return words.slice(0, numWords || 1).join(" ").slice(0, 24);
}

function pathTabLabel(path, actionNode) {
  if (!path || !path.length) {
    const t = actionNode?.content?.title || actionNode?.label || "Path";
    return t.length > 30 ? t.slice(0, 28) + "…" : t;
  }
  const labels = path.map((s, i) =>
    shortAnswerLabel(s.answerText, i === path.length - 1 ? 2 : 1)
  ).filter(Boolean);
  return labels.join(" — ") || "Path";
}

function findAllTerminalPaths(nodes, edges) {
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const definition = nodes.find((n) => n.type === "DEFINITION");
  const rootEdge = edges.find((e) => e.sourceNodeId === definition?.id);
  const rootNode = rootEdge ? nodeById[rootEdge.targetNodeId] : null;
  if (!rootNode) return [];
  const results = [];
  function traverse(node, cur, visited) {
    if (!node || visited.has(node.id)) return;
    const nv = new Set(visited);
    nv.add(node.id);
    const outs = edges.filter((e) => e.sourceNodeId === node.id);

    if (node.type === "ACTION") {
      if (!outs.length) {
        results.push({ actionNode: node, path: [...cur] });
        return;
      }
      for (const edge of outs) {
        const next = nodeById[edge.targetNodeId];
        if (next) traverse(next, cur, nv);
      }
      return;
    }

    if (node.type === "DECISION") {
      for (const edge of outs) {
        const answer = (node.answers || []).find((a) => a.id === edge.sourceAnswerId);
        const next = nodeById[edge.targetNodeId];
        if (next) {
          traverse(next, [...cur, { decisionNode: node, answerId: edge.sourceAnswerId, answerText: answer?.text || "", question: node.content?.question || node.label }], nv);
        }
      }
      return;
    }

    for (const edge of outs) {
      const next = nodeById[edge.targetNodeId];
      if (next) traverse(next, cur, nv);
    }
  }
  traverse(rootNode, [], new Set());
  return results;
}

const SWIMLANE_STYLES = {
  pi:     { tagBg: "var(--purple-100)", tagColor: "var(--purple-800)", accent: "var(--purple-600)", hdrBg: "oklch(0.95 0.04 290)", hdrColor: "oklch(0.35 0.12 290)" },
  office: { tagBg: "oklch(0.93 0.04 85)", tagColor: "oklch(0.36 0.12 85)", accent: "oklch(0.62 0.12 85)", hdrBg: "oklch(0.95 0.04 85)", hdrColor: "oklch(0.36 0.12 85)" },
  done:   { tagBg: "rgba(46,109,72,0.12)", tagColor: "#2E6D48", accent: "#2E6D48", hdrBg: "rgba(46,109,72,0.08)", hdrColor: "#2E6D48" },
};

function SwimlaneStepCard({ num, title, desc, tag, style, materials, borderAccent }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, padding: "13px 16px 12px", boxShadow: "0 1px 4px rgba(30,20,50,0.06)", borderLeft: `3px solid ${borderAccent}` }}>
      <Mono style={{ fontSize: 9, color: "var(--ink-500)", letterSpacing: 1, textTransform: "uppercase" }}>Step {num}</Mono>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-900)", marginTop: 4, lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--ink-700)", marginTop: 5, lineHeight: 1.5 }}>{desc}</div>
      {materials && materials.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          {materials.map((m, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "var(--ink-600)", display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ color: "var(--ink-400)", flexShrink: 0 }}>·</span>{m}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: style.tagBg, color: style.tagColor }}>{tag}</span>
      </div>
    </div>
  );
}

function SigningSwimlane({ pathData, allNodes }) {
  const { actionNode, path } = pathData;
  const assignee = actionNode.content?.assignee || "Office";

  const peopleNode = allNodes.find((n) => {
    if (n.type !== "PEOPLE") return false;
    const al = assignee.toLowerCase();
    const an = (n.content?.name || "").toLowerCase();
    const ad = (n.content?.department || "").toLowerCase();
    const a0 = al.split(/\s+/)[0];
    const n0 = an.split(/\s+/)[0];
    const d0 = ad.split(/\s+/)[0];
    return (n0 && (al.includes(n0) || a0 && an.includes(a0))) ||
           (d0 && (al.includes(d0) || a0 && ad.includes(a0)));
  });

  const columns = [
    { label: "UW Researcher (PI)", style: SWIMLANE_STYLES.pi },
    { label: assignee, sub: peopleNode ? `${peopleNode.content?.name}${peopleNode.content?.email ? " · " + peopleNode.content.email : ""}` : null, style: SWIMLANE_STYLES.office },
  ];

  const pathContext = path.map((s) => s.answerText).join(" → ");
  const materials = (actionNode.content?.materials || []).map((m) => m.label).filter((l) => l && l !== "Material");

  const rows = [
    {
      transition: null,
      cells: [
        { col: 0, num: 1, title: "Submit request", desc: pathContext ? `Initiate your request. Routing path: ${pathContext.length > 120 ? pathContext.slice(0, 118) + "…" : pathContext}` : "Initiate your request via the signing flow wizard.", tag: "PI initiates", style: SWIMLANE_STYLES.pi },
        null,
      ],
    },
    {
      transition: `Received by ${assignee}`,
      cells: [
        null,
        { col: 1, num: 2, title: actionNode.content?.title || actionNode.label, desc: actionNode.content?.description || "Review and process the agreement.", tag: assignee, style: SWIMLANE_STYLES.office, materials },
      ],
    },
    {
      transition: "Agreement processed — PI review required",
      cells: [
        { col: 0, num: 3, title: "Review & acknowledge", desc: "Review the processed agreement. Confirm all terms and provide PI signature or acknowledgment as required by your institution.", tag: "PI reviews", style: SWIMLANE_STYLES.pi },
        null,
      ],
    },
  ];

  return (
    <div style={{ marginTop: 14, overflowX: "auto" }}>
      <div style={{ minWidth: 480 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 8, marginBottom: 8 }}>
          {columns.map((col, i) => (
            <div key={i} style={{ padding: "9px 14px", background: col.style.hdrBg, borderRadius: 6, textAlign: "center" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: col.style.hdrColor, letterSpacing: 0.5, textTransform: "uppercase" }}>{col.label}</div>
              {col.sub && <div style={{ fontSize: 10.5, color: col.style.hdrColor, opacity: 0.75, marginTop: 1 }}>{col.sub}</div>}
            </div>
          ))}
        </div>

        {rows.map((row, ri) => (
          <React.Fragment key={ri}>
            {row.transition && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--ink-500)", fontSize: 11.5 }}>
                <div style={{ flex: 1, height: 1, background: "var(--ink-200)" }} />
                <span>↓ {row.transition} ↓</span>
                <div style={{ flex: 1, height: 1, background: "var(--ink-200)" }} />
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 8, alignItems: "start", marginBottom: 2 }}>
              {row.cells.map((cell, ci) =>
                cell ? (
                  <SwimlaneStepCard key={ci} num={cell.num} title={cell.title} desc={cell.desc} tag={cell.tag} style={cell.style} materials={cell.materials} borderAccent={cell.style.accent} />
                ) : (
                  <div key={ci} />
                )
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function SigningFlowSteps({ doc, hideLabel }) {
  const [activeTab, setActiveTab] = useState(0);
  const graph = doc._snapshot?.snapshotJson || {};
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  const allPaths = useMemo(() => findAllTerminalPaths(nodes, edges), [doc]);
  if (!allPaths.length) return null;

  const safeTab = Math.min(activeTab, allPaths.length - 1);

  return (
    <div style={{ marginTop: hideLabel ? 0 : 28 }}>
      {!hideLabel && <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Signing flow steps</Mono>}

      {allPaths.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {allPaths.map((p, i) => {
            const label = pathTabLabel(p.path, p.actionNode);
            const active = i === safeTab;
            return (
              <button key={i} onClick={() => setActiveTab(i)} style={{
                padding: "6px 14px", borderRadius: 6, fontFamily: "inherit", cursor: "pointer",
                fontSize: 13, fontWeight: active ? 600 : 500,
                background: active ? "var(--ink-900)" : "white",
                color: active ? "white" : "var(--ink-700)",
                border: `1px solid ${active ? "var(--ink-900)" : "var(--ink-200)"}`,
                transition: "all 120ms",
              }}>{label}</button>
            );
          })}
        </div>
      )}

      <SigningSwimlane pathData={allPaths[safeTab]} allNodes={nodes} />

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 18, padding: "10px 0", borderTop: "1px solid var(--ink-200)" }}>
        {[
          { dot: "var(--purple-600)", label: "PI / Researcher action" },
          { dot: "oklch(0.62 0.12 85)", label: "Office / CoMotion review" },
        ].map(({ dot, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-500)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, display: "inline-block" }} />{label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SigningFlowModal({ doc, onClose, onContact }) {
  const [stage, setStage] = useState("questions");
  const [graphResultNode, setGraphResultNode] = useState(null);
  const [graphPath, setGraphPath] = useState([]);
  const [answers, setAnswers] = useState({});
  const [situationOverrides, setSituationOverrides] = useState({});
  const isBackendFlow = Boolean(doc?._snapshot);

  const customizeQuestions = useMemo(() => {
    if (isBackendFlow && graphPath.length > 0) {
      return graphPath.map(({ node }) => ({
        id: node.id,
        title: node.content?.question || node.label,
        options: (node.answers || []).map((a) => {
          const rat = String(a.rationale || "").trim();
          return { value: a.id, label: a.text, ...(rat ? { sub: rat } : {}) };
        }),
      }));
    }
    return doc?.flow?.questions || [];
  }, [isBackendFlow, graphPath, doc]);

  const customizeAnswers = useMemo(() => {
    if (isBackendFlow && graphPath.length > 0) {
      return Object.fromEntries(graphPath.map(({ node, answerId }) => [node.id, answerId]));
    }
    return answers;
  }, [isBackendFlow, graphPath, answers]);

  const steps = useMemo(() => {
    if (stage !== "results") return [];
    if (isBackendFlow && graphResultNode) {
      return [{ office: graphResultNode.content?.assignee || "UW CoMotion", contact: "comotion_legal", action: graphResultNode.content?.title || graphResultNode.label, materials: (graphResultNode.content?.materials || []).map((m) => m.label) }];
    }
    if (doc?.flow?.compute) return doc.flow.compute({ ...answers, ...situationOverrides });
    return [];
  }, [stage, answers, situationOverrides, doc, isBackendFlow, graphResultNode]);

  function handleGraphResult(actionNode, path) { setGraphResultNode(actionNode); setGraphPath(path || []); setStage("results"); }
  function applyAnswers(a) { setAnswers(a); setStage("results"); setSituationOverrides({}); }
  function restartFlow() { setStage("questions"); setAnswers({}); setSituationOverrides({}); setGraphResultNode(null); setGraphPath([]); }
  function handleBackdropClick(e) { if (e.target === e.currentTarget) onClose(); }

  return (
    <div onClick={handleBackdropClick} style={{ position: "fixed", inset: 0, background: "rgba(20,10,40,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(20,10,40,0.22)" }}>
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--ink-200)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: 19, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.3 }}>Find a signing flow</div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>{doc.name}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-400)", padding: "4px 8px", borderRadius: 4, fontSize: 20, lineHeight: 1, fontFamily: "inherit" }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 28px" }}>
          {stage === "questions" ? (
            isBackendFlow
              ? <GraphDocWizard snapshot={doc._snapshot} onResult={handleGraphResult} onCancel={onClose} />
              : <DocWizard doc={doc} initialAnswers={answers} onApply={applyAnswers} onCancel={onClose} />
          ) : (
            <div>
              <div style={{ padding: "10px 14px", background: "rgba(46,109,72,0.06)", border: "1px solid rgba(46,109,72,0.18)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Pill tone="success"><Icon.Check /> Flow generated</Pill>
                  <span style={{ fontSize: 12.5, color: "var(--ink-700)" }}>{steps.length} step{steps.length === 1 ? "" : "s"}</span>
                </div>
                <button onClick={restartFlow} style={{ ...linkBtn, fontSize: 12 }}><Icon.Refresh /> Restart</button>
              </div>
              <StepResults
                steps={steps}
                situationOverrides={situationOverrides}
                onSituationChange={(key, val) => setSituationOverrides({ ...situationOverrides, [key]: val })}
                onContact={(key) => { onClose(); onContact(key); }}
              />
              {customizeQuestions.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <CustomizePanel questions={customizeQuestions} answers={customizeAnswers} />
                </div>
              )}
              <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={ghostBtn} onClick={onClose}>Close</button>
                <button style={primaryBtn}>Apply now <Icon.Arrow /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MyRequestsSigningModal({ docs, onClose, onContact }) {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const selectedDoc = docs.find((d) => d.id === selectedDocId);
  if (selectedDoc) return <SigningFlowModal doc={selectedDoc} onClose={onClose} onContact={onContact} />;

  function handleBackdropClick(e) { if (e.target === e.currentTarget) onClose(); }

  return (
    <div onClick={handleBackdropClick} style={{ position: "fixed", inset: 0, background: "rgba(20,10,40,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(20,10,40,0.22)" }}>
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--ink-200)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: 19, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.3 }}>Find a signing flow</div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>Question 01 — select a document type</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-400)", padding: "4px 8px", borderRadius: 4, fontSize: 20, lineHeight: 1, fontFamily: "inherit" }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 28px" }}>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 14 }}>
            What type of document are you applying for?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {docs.map((doc, i) => (
              <button key={doc.id} onClick={() => setSelectedDocId(doc.id)} style={{
                textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 14px", background: "white", border: "1px solid var(--ink-200)",
                borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--purple-400)"; e.currentTarget.style.background = "var(--purple-50)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.background = "white"; }}
              >
                <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: "1px solid var(--ink-300)", color: "var(--ink-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-900)" }}>
                    <Mono style={{ fontSize: 11, color: "var(--purple-700)", marginRight: 6 }}>{doc.abbrev}</Mono>
                    {doc.name}
                  </div>
                  {doc.summary && <div style={{ fontSize: 12.5, color: "var(--ink-700)", marginTop: 3, lineHeight: 1.45 }}>{doc.summary}</div>}
                </div>
                <Icon.Arrow style={{ color: "var(--ink-400)", flexShrink: 0, marginTop: 3 }} />
              </button>
            ))}
            {docs.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ink-500)", fontStyle: "italic", padding: "20px 0" }}>No published document types available yet.</div>
            )}
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--ink-50)", border: "1px solid var(--ink-200)", borderRadius: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-700)" }}>Not sure which applies to you? </span>
            <button onClick={onClose} style={{ ...linkBtn, fontSize: 12.5, verticalAlign: "baseline" }}>
              Browse all agreement types in the Knowledge Base <Icon.Arrow />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyRequestsView({ docs = [], onNavigateKB }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--canvas-bg)" }}>
      <div style={{ padding: "24px 40px 20px", borderBottom: "1px solid var(--ink-200)", background: "white", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 22, color: "var(--ink-900)", letterSpacing: -0.4, fontWeight: 700 }}>My requests</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-700)" }}>Track your submitted and in-progress agreement requests.</div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ ...primaryBtn, fontSize: 13, padding: "9px 16px", flexShrink: 0 }}>
          Find a signing flow <Icon.Arrow />
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "var(--ink-500)", padding: 40 }}>
        <Mono style={{ fontSize: 10.5, letterSpacing: 0.6 }}>STUB</Mono>
        <div style={{ fontSize: 13, maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>In-flight and submitted document requests across all offices live here. Out of scope for this prototype.</div>
      </div>
      {showModal && (
        <MyRequestsSigningModal docs={docs} onClose={() => setShowModal(false)} onContact={() => setShowModal(false)} />
      )}
    </div>
  );
}

function DocumentTypesIndex({ onPick, docs = [] }) {
  const [q, setQ] = useState("");
  const filtered = docs.filter((d) => {
    if (!q) return true;
    const hay = (d.name + " " + d.abbrev + " " + d.summary).toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      <div style={{ padding: "32px 40px 56px" }}>
        <div style={{ fontFamily: "var(--font-headline)", fontSize: 26, color: "var(--ink-900)", letterSpacing: -0.4, fontWeight: 700 }}>
          Document types
        </div>
        <div style={{ marginTop: 8, color: "var(--ink-700)", fontSize: 13.5, maxWidth: 640, lineHeight: 1.5 }}>
          Browse the agreements and approvals UW supports. Open a document type to learn what it covers and find a signing flow tailored to your situation.
        </div>

        <div style={{ marginTop: 22, position: "relative", maxWidth: 480 }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-500)" }}>
            <Icon.Search />
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name (MTA, NDA, IRB…)"
            style={{ width: "100%", padding: "9px 14px 9px 38px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 6, fontSize: 13, color: "var(--ink-900)", fontFamily: "inherit", outline: "none" }}
            onFocus={(e) => { e.target.style.borderColor = "var(--purple-600)"; e.target.style.boxShadow = "0 0 0 3px var(--purple-100)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--ink-200)"; e.target.style.boxShadow = "none"; }}
          />
        </div>

        <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
          {filtered.map((d) => (
            <div key={d.id} onClick={() => onPick(d.id)} style={{ minWidth: 0, padding: "18px 18px 16px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, cursor: "pointer", transition: "border-color 120ms ease, box-shadow 120ms ease", display: "flex", flexDirection: "column", gap: 10, boxShadow: "var(--shadow-sm)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--purple-200)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6 }}>{d.abbrev}</Mono>
                  <div style={{ fontFamily: "var(--font-headline)", fontSize: 15, fontWeight: 600, color: "var(--ink-900)", marginTop: 2, letterSpacing: -0.2, overflowWrap: "anywhere" }}>{d.name}</div>
                </div>
                <div style={{ color: "var(--ink-400)" }}><Icon.Arrow /></div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.5 }}>{d.summary}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                {d.offices.slice(0, 3).map((k) => (
                  <Pill key={k} tone="soft">{(CONTACTS[k]?.dept || k).replace(/^Office of /, "").replace(/\(.*\)/, "").trim()}</Pill>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 30, color: "var(--ink-500)", fontSize: 13 }}>No document types match.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentDetailPreviousDraft({ docId, onBack, onContact }) {
  const doc = DOC_BY_ID[docId];
  const [stage, setStage] = useState("questions");
  const [answers, setAnswers] = useState({});
  const [situationOverrides, setSituationOverrides] = useState({});
  const isBackendFlow = Boolean(doc?._snapshot);

  const steps = useMemo(() => {
    if (stage !== "results") return [];
    return doc.flow.compute({ ...answers, ...situationOverrides });
  }, [stage, answers, situationOverrides, doc]);

  function applyAnswers(a) { setAnswers(a); setStage("results"); setSituationOverrides({}); }
  function restartFlow() { setStage("questions"); setAnswers({}); setSituationOverrides({}); }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--canvas-bg)" }}>
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        background: "rgba(255,255,255,0.96)",
        borderBottom: "1px solid var(--ink-200)",
        boxShadow: "0 1px 3px rgba(40,20,70,0.04)",
        padding: "12px 40px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-700)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit", fontSize: 12.5 }}>
            <Icon.Back /> Document types
          </button>
          <span style={{ color: "var(--ink-400)" }}>›</span>
          <span style={{ color: "var(--ink-500)", fontSize: 12 }}>{doc.abbrev}</span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: "0 0 63%", minWidth: 0, overflowY: "auto", padding: "24px 36px 64px 40px" }}>
          <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--font-headline)", fontSize: 30, color: "var(--ink-900)", letterSpacing: -0.5, fontWeight: 700, lineHeight: 1.1 }}>{doc.name}</div>
            <Pill tone="outline">{doc.abbrev}</Pill>
          </div>
          <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.65, color: "var(--ink-900)", maxWidth: 600 }}>{doc.definition}</div>

          <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 20, color: "var(--ink-900)", letterSpacing: -0.3, fontWeight: 700, lineHeight: 1.2 }}>
            Find a signing flow
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.5 }}>
            Answer a few questions to get a customized routing for your {doc.abbrev}.
          </div>

          <div style={{ marginTop: 16 }}>
            {stage === "questions" ? (
              <>
                {isBackendFlow && (
                  <GraphDocWizard snapshot={doc._snapshot} onResult={(actionNode) => { setStage("results"); }} onCancel={() => setStage("questions")} />
                )}
                {!isBackendFlow && (
                  <DocWizard doc={doc} initialAnswers={answers} onApply={applyAnswers} onCancel={() => setAnswers({})} />
                )}
              </>
            ) : (
              <>
                <div style={{ padding: "10px 14px", background: "rgba(46,109,72,0.06)", border: "1px solid rgba(46,109,72,0.18)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Pill tone="success"><Icon.Check /> Flow generated</Pill>
                    <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{steps.length} step{steps.length === 1 ? "" : "s"}</span>
                  </div>
                  <button onClick={restartFlow} style={{ ...linkBtn, fontSize: 12 }}><Icon.Refresh /> Restart</button>
                </div>

                <StepResults
                  steps={steps}
                  situationOverrides={situationOverrides}
                  onSituationChange={(key, val) => setSituationOverrides({ ...situationOverrides, [key]: val })}
                  onContact={onContact}
                />

                <div style={{ marginTop: 24 }}>
                  <CustomizePanel
                    questions={doc?.flow?.questions || []}
                    answers={answers}
                  />
                </div>
              </>
            )}
          </div>
          </div>
          </section>
        </div>

        <div style={{ flex: "0 0 37%", minWidth: 0, borderLeft: "1px solid var(--ink-200)", overflowY: "auto", background: "var(--canvas-bg)" }}>
          <div style={{ padding: "24px 24px 48px" }}>
            <div>
              <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Related offices</Mono>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxWidth: 480 }}>
                {doc.offices.map((k) => {
                  const c = CONTACTS[k];
                  return (
                    <div key={k} onClick={() => onContact(k)} style={{ padding: "10px 12px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 120ms, box-shadow 120ms", boxShadow: "var(--shadow-sm)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--purple-200)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                    >
                      <Avatar name={c.name} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)" }}>{c.dept}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 1 }}>{c.name} · {c.role}</div>
                      </div>
                      <Icon.Arrow />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Available templates</Mono>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxWidth: 480 }}>
                {doc.templates.map((t, i) => (
                  <a key={i} href="#" onClick={(e) => e.preventDefault()} style={{ padding: "10px 12px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 6, textDecoration: "none", display: "flex", alignItems: "center", gap: 10, transition: "border-color 120ms, box-shadow 120ms", boxShadow: "var(--shadow-sm)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--purple-200)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                  >
                    <div style={{ color: "var(--ink-500)" }}><Icon.Doc /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)" }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 1 }}>{t.format} · {t.size}</div>
                    </div>
                    <div style={{ color: "var(--purple-700)" }}><Icon.Download /></div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentDetail({ docId, onBack, onContact, docs = [] }) {
  const doc = docs.find((d) => d.id === docId) || DOC_BY_ID[docId];
  const [showModal, setShowModal] = useState(false);
  const [activeSection, setActiveSection] = useState("description");
  const scrollRef = useRef(null);
  const sectRefs = useRef({});

  const NAV_ITEMS = [
    { id: "description", label: "Description" },
    { id: "offices",     label: "Related Offices" },
    { id: "templates",   label: "Available Templates" },
    { id: "flowchart",   label: "Flowchart Preview" },
    { id: "signing",     label: "Signing Flow Steps" },
    { id: "processing",  label: "Processing Time" },
    { id: "apply",       label: "Still don't know how to apply?" },
  ];

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    function updateActive() {
      const containerTop = container.getBoundingClientRect().top;
      let current = NAV_ITEMS[0].id;
      for (const { id } of NAV_ITEMS) {
        const el = document.getElementById("ksec-" + id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - containerTop <= 48) current = id;
      }
      setActiveSection(current);
    }
    updateActive();
    container.addEventListener("scroll", updateActive, { passive: true });
    return () => container.removeEventListener("scroll", updateActive);
  }, [doc?.id]);

  function scrollTo(id) {
    const container = scrollRef.current;
    if (!container) return;
    const el = document.getElementById("ksec-" + id);
    if (!el) return;
    setActiveSection(id);
    container.scrollTop = el.getBoundingClientRect().top
      - container.getBoundingClientRect().top
      + container.scrollTop
      - 24;
  }

  function reg(id) { return (el) => { sectRefs.current[id] = el; }; }

  if (!doc) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--canvas-bg)" }}>
      {/* Breadcrumb bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.96)", borderBottom: "1px solid var(--ink-200)", boxShadow: "0 1px 3px rgba(40,20,70,0.04)", padding: "12px 40px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-700)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit", fontSize: 12.5 }}>
          <Icon.Back /> Document types
        </button>
        <span style={{ color: "var(--ink-400)" }}>›</span>
        <span style={{ color: "var(--ink-500)", fontSize: 12 }}>{doc.abbrev}</span>
      </div>

      {/* Body: scroll area fills full width; nav overlaid via absolute position */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>

        {/* Section nav — absolutely overlaid, does not affect content width or centering */}
        <div className="doc-secnav-panel">
          <nav className="doc-secnav">
            {NAV_ITEMS.map(({ id, label }) => {
              const active = id === activeSection;
              return (
                <button key={id} onClick={() => scrollTo(id)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "none", border: "none",
                  borderLeft: `2px solid ${active ? "var(--purple-600)" : "var(--ink-200)"}`,
                  padding: "6px 0 6px 12px", marginBottom: 2,
                  fontSize: 12.5, fontWeight: active ? 600 : 400,
                  color: active ? "var(--purple-700)" : "var(--ink-400)",
                  cursor: "pointer", fontFamily: "inherit",
                  lineHeight: 1.4, transition: "color 120ms, border-color 120ms",
                }}>
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Scroll container — full width so maxWidth:760 content stays centered */}
        <div ref={scrollRef} style={{ width: "100%", height: "100%", overflowY: "auto" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 40px 80px" }}>

            {/* Title */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: 30, color: "var(--ink-900)", letterSpacing: -0.5, fontWeight: 700, lineHeight: 1.1 }}>{doc.name}</div>
              <Pill tone="outline">{doc.abbrev}</Pill>
            </div>

            {/* Description */}
            <div id="ksec-description" ref={reg("description")} data-sid="description" style={{ marginTop: 36, scrollMarginTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 12 }}>Description</div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ink-900)" }}>{doc.definition}</div>
            </div>

            {/* Related Offices */}
            <div id="ksec-offices" ref={reg("offices")} data-sid="offices" style={{ marginTop: 44, scrollMarginTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 12 }}>Related Offices</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {doc.offices.map((k) => {
                  const c = CONTACTS[k];
                  return (
                    <div key={k} onClick={() => onContact(k)} style={{ padding: "10px 12px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 120ms, box-shadow 120ms", boxShadow: "var(--shadow-sm)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--purple-200)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                    >
                      <Avatar name={c.name} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)" }}>{c.dept}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 1 }}>{c.name} · {c.role}</div>
                      </div>
                      <Icon.Arrow />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Available Templates */}
            <div id="ksec-templates" ref={reg("templates")} data-sid="templates" style={{ marginTop: 44, scrollMarginTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 12 }}>Available Templates</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {doc.templates.map((t, i) => (
                  <a key={i} href="#" onClick={(e) => e.preventDefault()} style={{ padding: "10px 12px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 6, textDecoration: "none", display: "flex", alignItems: "center", gap: 10, transition: "border-color 120ms, box-shadow 120ms", boxShadow: "var(--shadow-sm)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--purple-200)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                  >
                    <div style={{ color: "var(--ink-500)" }}><Icon.Doc /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-900)" }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 1 }}>{t.format} · {t.size}</div>
                    </div>
                    <div style={{ color: "var(--purple-700)" }}><Icon.Download /></div>
                  </a>
                ))}
              </div>
            </div>

            {/* Flowchart Preview */}
            <div id="ksec-flowchart" ref={reg("flowchart")} data-sid="flowchart" style={{ marginTop: 44, scrollMarginTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 12 }}>Flowchart Preview</div>
              <FlowchartPreview doc={doc} hideLabel />
            </div>

            {/* Signing Flow Steps */}
            <div id="ksec-signing" ref={reg("signing")} data-sid="signing" style={{ marginTop: 44, scrollMarginTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 12 }}>Signing Flow Steps</div>
              <SigningFlowSteps doc={doc} hideLabel />
            </div>

            {/* Processing Time */}
            <div id="ksec-processing" ref={reg("processing")} data-sid="processing" style={{ marginTop: 44, scrollMarginTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 12 }}>Processing Time</div>
              <div style={{ padding: "12px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 6, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                  {[{ label: "1-3 days", pct: 42 }, { label: "3-7 days", pct: 38 }, { label: ">7 days", pct: 20 }].map((item) => (
                    <div key={item.label}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "var(--ink-700)" }}>
                        <span>{item.label}</span>
                        <Mono style={{ fontSize: 10.5, color: "var(--ink-500)" }}>{item.pct}%</Mono>
                      </div>
                      <div style={{ marginTop: 5, height: 6, background: "var(--ink-100)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${item.pct}%`, height: "100%", background: "var(--purple-700)", borderRadius: 999 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {["AP", "JL", "SR"].map((initials, i) => (
                      <div key={initials} style={{ width: 18, height: 18, borderRadius: "50%", background: ["var(--purple-600)", "oklch(0.62 0.14 205)", "oklch(0.66 0.14 145)"][i], color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7.5, fontWeight: 700, marginLeft: i === 0 ? 0 : -5, border: "1.5px solid white", filter: "blur(0.7px)", opacity: 0.8 }}>
                        {initials}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-500)", fontStyle: "italic" }}>data from real cases</div>
                </div>
              </div>
            </div>

            {/* Still don't know / CTA */}
            <div id="ksec-apply" ref={reg("apply")} data-sid="apply" style={{ marginTop: 44, scrollMarginTop: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-900)", letterSpacing: -0.2, marginBottom: 12 }}>Still don't know how to apply?</div>
              <div style={{ padding: "28px 32px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, boxShadow: "var(--shadow-sm)" }}>
                <button onClick={() => setShowModal(true)} style={{ ...primaryBtn, fontSize: 14, padding: "10px 22px", borderRadius: 8 }}>
                  Find a signing flow <Icon.Arrow />
                </button>
                <div style={{ fontSize: 13, color: "var(--ink-700)", lineHeight: 1.5 }}>
                  Answer a few questions to get your personalized routing.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <SigningFlowModal doc={doc} onClose={() => setShowModal(false)} onContact={onContact} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// contacts-pages.jsx — directory + detail
// ─────────────────────────────────────────────

function ContactDirectory({ onContact }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      <div style={{ padding: "32px 40px 56px" }}>
        <div style={{ fontFamily: "var(--font-headline)", fontSize: 26, color: "var(--ink-900)", letterSpacing: -0.4, fontWeight: 700 }}>Contact directory</div>
        <div style={{ marginTop: 8, color: "var(--ink-700)", fontSize: 13.5, maxWidth: 620, lineHeight: 1.5 }}>
          All routing destinations, organized by office. Use this if you already know who you need.
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 28 }}>
          {OFFICE_GROUPS.map((g) => (
            <div key={g.title}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>{g.title}</Mono>
                <Hairline style={{ flex: 1, maxWidth: "60%" }} />
                <Mono style={{ fontSize: 10.5, color: "var(--ink-500)" }}>{g.keys.length}</Mono>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {g.keys.map((k) => {
                  const c = CONTACTS[k];
                  return (
                    <div key={k} onClick={() => onContact(k)} style={{ padding: "16px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, cursor: "pointer", transition: "border-color 120ms ease, box-shadow 120ms ease", boxShadow: "var(--shadow-sm)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--purple-200)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ink-200)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <Avatar name={c.name} size={38} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-900)" }}>{c.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 2 }}>{c.role}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {c.handles.slice(0, 2).map((h) => (
                          <span key={h} style={{ fontSize: 11, color: "var(--ink-700)", background: "var(--ink-100)", padding: "2px 7px", borderRadius: 4 }}>{h}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactDetail({ contactKey, onBack }) {
  const c = CONTACTS[contactKey];
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
    <div style={{ padding: "32px 40px 56px", maxWidth: 760 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-700)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit", fontSize: 12.5, marginBottom: 22 }}>
        <Icon.Back /> Back
      </button>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <Avatar name={c.name} size={64} />
        <div>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: 24, color: "var(--ink-900)", fontWeight: 700, letterSpacing: -0.4 }}>{c.name}</div>
          <div style={{ fontSize: 14, color: "var(--ink-700)", marginTop: 2 }}>{c.role}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 2 }}>{c.dept}</div>
        </div>
      </div>
      <div style={{ marginTop: 24, background: "white", border: "1px solid var(--ink-200)", borderRadius: 8, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <ContactRow icon={<Icon.Mail />} label="Email" value={c.email} link={`mailto:${c.email}`} />
        <ContactRow icon={<Icon.Phone />} label="Phone" value={c.phone} link={`tel:${c.phone.replace(/\D/g, "")}`} borderTop />
        <ContactRow icon={<Icon.Pin />} label="Office" value={c.office} borderTop />
        <ContactRow icon={<Icon.Doc />} label="Hours" value={c.hours} borderTop />
      </div>
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Typically handles</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {c.handles.map((h) => <Pill key={h} tone="outline">{h}</Pill>)}
        </div>
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// app.jsx — top-level portal shell
// ─────────────────────────────────────────────

const NavIcon = {
  Inbox: (p) => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" {...p}>
      <path d="M2 10.5h11L11 5H4L2 10.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M2 10.5V13h11v-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5.5 11.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M7.5 2v3M5.5 3.5l2-1.5 2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Book: (p) => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" {...p}>
      <path d="M3 2.5h6.5c.3 0 .5.2.5.5v9c0 .3-.2.5-.5.5H3a1 1 0 01-1-1V3.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M9.5 2.5L12 4v9l-2.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5 5.5h3M5 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  Chat: (p) => (
    <svg width="16" height="16" viewBox="0 0 15 15" fill="none" {...p}>
      <path d="M2 2.5h11c.3 0 .5.2.5.5v7c0 .3-.2.5-.5.5H5L2 13V3c0-.3.2-.5.5-.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5 5.5h5M5 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  Settings: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.03V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.03-.33H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.03V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15.4 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.37.36.7.64.97.28.28.66.44 1.05.44H21a2 2 0 0 1 0 4h-.09c-.39 0-.77.16-1.05.44-.28.27-.5.6-.64.97z"/>
    </svg>
  ),
  Help: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4"/><line x1="12" y1="17" x2="12" y2="17.01"/>
    </svg>
  ),
  Trash: (p) => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...p}>
      <path d="M2.5 4h10M6 4V2.8h3V4M4 4l.5 8h6l.5-8M6.5 6.3v3.8M8.5 6.3v3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  LogOut: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

function TopBar() {
  return (
    <div style={{
      gridArea: "topbar",
      background: "white",
      borderBottom: "1px solid var(--ink-200)",
      display: "flex",
      alignItems: "center",
      padding: "0 18px",
      gap: 16,
      zIndex: 10,
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-headline)", fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em", flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg, var(--purple-700), var(--purple-900))", color: "white", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "0.02em", flexShrink: 0 }}>UW</div>
        <span style={{ color: "var(--ink-900)" }}>Document Triage</span>
        <span style={{ color: "var(--ink-500)", fontWeight: 500, paddingLeft: 14, marginLeft: 4, borderLeft: "1px solid var(--ink-300)", fontSize: 12.5 }}>Researcher Portal</span>
      </div>
      {/* Right: search + bell + avatar */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--ink-100)", border: "1px solid var(--ink-200)", padding: "6px 12px", borderRadius: 6, fontSize: 12.5, color: "var(--ink-500)", width: 240, cursor: "text" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span style={{ flex: 1 }}>Search…</span>
          <kbd style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, background: "white", border: "1px solid var(--ink-300)", padding: "1px 5px", borderRadius: 3, color: "var(--ink-500)" }}>⌘K</kbd>
        </div>
        {/* Notification bell */}
        <button style={{ width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-700)", background: "none", border: "none", cursor: "pointer", transition: "background 120ms" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--ink-100)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2a4.5 4.5 0 00-4.5 4.5v2L2 10v1h12v-1l-1.5-1.5v-2A4.5 4.5 0 008 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>
        {/* User avatar only */}
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, var(--purple-500), var(--purple-700))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0, cursor: "pointer" }}>EM</div>
      </div>
    </div>
  );
}

function LeftSidebar({ active, setActive, collapsed, dragging, onResizeStart }) {
  const topTabs = [
    { id: "My requests",    icon: NavIcon.Inbox },
    { id: "Knowledge base", icon: NavIcon.Book  },
    { id: "Messages",       icon: NavIcon.Chat  },
  ];
  const bottomActions = [
    { id: "settings", label: "Settings", icon: NavIcon.Settings },
    { id: "help", label: "Help", icon: NavIcon.Help },
    { id: "logout", label: "Log Out", icon: NavIcon.LogOut },
  ];

  return (
    <div className={`researcher-sidebar ${collapsed ? "researcher-sidebar-collapsed" : ""}`} data-collapsed={collapsed}>
      <div className={`researcher-resize-handle ${dragging ? "dragging" : ""}`} onPointerDown={onResizeStart} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} />
      <nav className="researcher-sidebar-main">
        {topTabs.map(({ id, icon: NavIc }) => {
          const a = id === active;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`researcher-nav-item ${a ? "active" : ""}`}
              data-tooltip={id}
              title={collapsed ? id : ""}
            >
              <NavIc style={{ color: a ? "var(--purple-700)" : "var(--ink-500)" }} />
              <span className="researcher-nav-label">{id}</span>
            </button>
          );
        })}
      </nav>
      <div className="researcher-sidebar-actions">
        {bottomActions.map(({ id, label, icon: ActionIcon }) => (
          <button key={id} className="researcher-nav-item" data-tooltip={label} title={collapsed ? label : ""}>
            <ActionIcon />
            <span className="researcher-nav-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

