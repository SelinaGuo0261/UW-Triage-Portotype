// ─────────────────────────────────────────────
// GraphDocWizard — 基于图遍历的向导（用于 backend 发布的 flow）
// ─────────────────────────────────────────────

function GraphDocWizard({ snapshot, onResult, onCancel }) {
  const graph = snapshot?.snapshotJson || {};
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const definition = nodes.find((n) => n.type === "DEFINITION");
  const rootEdge = edges.find((e) => e.sourceNodeId === definition?.id);
  const rootNode = nodeById[rootEdge?.targetNodeId];

  const [currentNode, setCurrentNode] = React.useState(rootNode);
  const [path, setPath] = React.useState([]);  // { node, answerId }[]

  if (!rootNode) return (
    <div style={{ padding: 20, color: "var(--ink-500)", fontSize: 13 }}>
      Flow structure invalid: no root decision node found.
    </div>
  );

  function pick(answerId) {
    const nextEdge = edges.find(
      (e) => e.sourceNodeId === currentNode.id && e.sourceAnswerId === answerId
    );
    const nextNode = nodeById[nextEdge?.targetNodeId];
    if (!nextNode) return;

    const newPath = [...path, { node: currentNode, answerId }];
    setPath(newPath);

    if (nextNode.type === "ACTION") {
      onResult(nextNode, newPath);   // 到达终态，交给父组件展示结果
    } else {
      setCurrentNode(nextNode);
    }
  }

  function back() {
    if (path.length === 0) { onCancel(); return; }
    const prev = path[path.length - 1];
    setPath(path.slice(0, -1));
    setCurrentNode(prev.node);
  }

  const stepNum = path.length + 1;
  const stepOptions = (currentNode.answers || []).map((a) => ({ value: a.id, label: a.text }));

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
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, lineHeight: 1.4, color: "var(--ink-900)" }}>{opt.label}</div>
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
  const [stage, setStage] = useState("questions");
  const [answers, setAnswers] = useState({});
  const [situationOverrides, setSituationOverrides] = useState({});
  const [graphResultNode, setGraphResultNode] = useState(null);
  const [graphPath, setGraphPath] = useState([]);  // [{ node, answerId }]

  const isBackendFlow = Boolean(doc?._snapshot);

  // Questions in traversal order for Stage 3
  const customizeQuestions = useMemo(() => {
    if (isBackendFlow && graphPath.length > 0) {
      return graphPath.map(({ node }) => ({
        id: node.id,
        title: node.content?.question || node.label,
        options: (node.answers || []).map((a) => ({ value: a.id, label: a.text })),
      }));
    }
    return doc?.flow?.questions || [];
  }, [isBackendFlow, graphPath, doc]);

  // Answers keyed by nodeId for Stage 3
  const customizeAnswers = useMemo(() => {
    if (isBackendFlow && graphPath.length > 0) {
      return Object.fromEntries(graphPath.map(({ node, answerId }) => [node.id, answerId]));
    }
    return answers;
  }, [isBackendFlow, graphPath, answers]);

  const steps = useMemo(() => {
    if (stage !== "results") return [];
    if (isBackendFlow && graphResultNode) {
      return [{
        office: graphResultNode.content?.assignee || "UW CoMotion",
        contact: "comotion_legal",
        action: graphResultNode.content?.title || graphResultNode.label,
        materials: (graphResultNode.content?.materials || []).map((m) => m.label),
      }];
    }
    return doc.flow.compute({ ...answers, ...situationOverrides });
  }, [stage, answers, situationOverrides, doc, isBackendFlow, graphResultNode]);

  function applyAnswers(a) { setAnswers(a); setStage("results"); setSituationOverrides({}); }
  function handleGraphResult(actionNode, path) { setGraphResultNode(actionNode); setGraphPath(path || []); setStage("results"); }
  function restartFlow() { setStage("questions"); setAnswers({}); setSituationOverrides({}); setGraphResultNode(null); setGraphPath([]); }
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

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 50%", minWidth: 0, padding: "24px 32px 64px" }}>
          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: 30, color: "var(--ink-900)", letterSpacing: -0.5, fontWeight: 700, lineHeight: 1.1 }}>{doc.name}</div>
              <Pill tone="outline">{doc.abbrev}</Pill>
            </div>
            <div style={{ marginTop: 18 }}>
              <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Description</Mono>
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.65, color: "var(--ink-900)", maxWidth: 600 }}>{doc.definition}</div>
            </div>

            <div style={{ marginTop: 24, maxWidth: 600 }}>
              <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Related offices</Mono>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
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

            <div style={{ marginTop: 24, maxWidth: 600 }}>
              <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Available templates</Mono>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, width: "100%" }}>
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

            <div style={{ marginTop: 24, maxWidth: 600 }}>
              <Mono style={{ fontSize: 10.5, color: "var(--ink-500)", letterSpacing: 0.6, textTransform: "uppercase" }}>Processing time</Mono>
              <div style={{ marginTop: 10, padding: "12px", background: "white", border: "1px solid var(--ink-200)", borderRadius: 6, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, width: "100%" }}>
                  {[
                    { label: "1-3 days", pct: 42 },
                    { label: "3-7 days", pct: 38 },
                    { label: ">7 days", pct: 20 },
                  ].map((item) => (
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
          </section>
        </div>

        <div style={{ width: 1, background: "var(--ink-200)", alignSelf: "stretch", flexShrink: 0, marginTop: 24, marginBottom: 24 }} />
        <div style={{ flex: "0 0 50%", minWidth: 0, background: "var(--canvas-bg)" }}>
          <div style={{ padding: "24px 32px 64px" }}>
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
                    <GraphDocWizard snapshot={doc._snapshot} onResult={handleGraphResult} onCancel={() => setStage("questions")} />
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
                      questions={customizeQuestions}
                      answers={customizeAnswers}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
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

