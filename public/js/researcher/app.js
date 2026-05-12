function KnowledgeBase({ mode, setMode }) {
  const [docId, setDocId] = useState(null);
  const [contactKey, setContactKey] = useState(null);
  const [publicDocs, setPublicDocs] = useState([]);

  useEffect(() => { setDocId(null); setContactKey(null); }, [mode]);
  useEffect(() => {
    let alive = true;
    async function loadPublicDocs() {
      try {
        const listRes = await fetch(`${API_BASE}/knowledge-base`);
        const listData = await listRes.json();
        const items = listData.items || [];
        if (!items.length) return;
        const snapshots = await Promise.all(items.map(async (item) => {
          const detailRes = await fetch(`${API_BASE}/knowledge-base/${item.id}`);
          const detailData = await detailRes.json();
          return detailData.snapshot;
        }));
        if (alive) setPublicDocs(snapshots.filter(Boolean).map(snapshotToDoc));
      } catch {
        if (alive) setPublicDocs([]);
      }
    }
    loadPublicDocs();
    return () => { alive = false; };
  }, []);

  function handleContact(key) { setMode("contacts"); setContactKey(key); }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", background: "var(--canvas-bg)" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {mode === "documents" && !docId && <DocumentTypesIndex onPick={setDocId} docs={publicDocs} />}
        {mode === "documents" && docId && <DocumentDetail docId={docId} docs={publicDocs} onBack={() => setDocId(null)} onContact={handleContact} />}
        {mode === "contacts" && contactKey && <ContactDetail contactKey={contactKey} onBack={() => setContactKey(null)} />}
      </div>
    </div>
  );
}

function StubTab({ name, blurb }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "var(--ink-500)", padding: 40 }}>
      <Mono style={{ fontSize: 10.5, letterSpacing: 0.6 }}>STUB</Mono>
      <div style={{ fontFamily: "var(--font-headline)", fontSize: 22, color: "var(--ink-700)", fontWeight: 700, letterSpacing: -0.3 }}>{name}</div>
      <div style={{ fontSize: 13, maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>{blurb}</div>
    </div>
  );
}

function Portal() {
  const [active, setActive] = useState("Knowledge base");
  const [kbMode, setKbMode] = useState("documents");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarDragging, setSidebarDragging] = useState(false);
  const [sidebarDragWidth, setSidebarDragWidth] = useState(null);
  const sidebarResizeStart = useRef(null);
  const sidebarDragWidthRef = useRef(null);
  const sidebarExpandedWidth = 220;
  const sidebarCollapsedWidth = 56;
  const sidebarWidth = sidebarDragWidth ?? (sidebarCollapsed ? sidebarCollapsedWidth : sidebarExpandedWidth);

  function handleSetActive(id) {
    setActive(id);
    if (id === "Knowledge base") setKbMode("documents");
  }

  function handleSetKbMode(m) {
    setKbMode(m);
    setActive("Knowledge base");
  }

  function handleSidebarResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    sidebarResizeStart.current = { x: e.clientX, width: sidebarWidth, collapsed: sidebarCollapsed };
    setSidebarDragging(true);
    sidebarDragWidthRef.current = sidebarWidth;
    setSidebarDragWidth(sidebarWidth);
    document.body.style.cursor = "col-resize";

    const handlePointerMove = (moveEvent) => {
      const start = sidebarResizeStart.current;
      if (!start) return;
      const delta = moveEvent.clientX - start.x;
      const nextWidth = Math.max(sidebarCollapsedWidth, Math.min(sidebarExpandedWidth, start.width + delta));
      sidebarDragWidthRef.current = nextWidth;
      setSidebarDragWidth(nextWidth);
    };

    const handlePointerUp = (upEvent) => {
      const start = sidebarResizeStart.current;
      const finalWidth = sidebarDragWidthRef.current ?? (start ? start.width : sidebarWidth);
      if (start && Math.abs(upEvent.clientX - start.x) < 8) {
        setSidebarCollapsed(!start.collapsed);
      } else {
        const midpoint = (sidebarExpandedWidth + sidebarCollapsedWidth) / 2;
        setSidebarCollapsed(finalWidth < midpoint);
      }

      sidebarResizeStart.current = null;
      sidebarDragWidthRef.current = null;
      setSidebarDragging(false);
      setSidebarDragWidth(null);
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  return (
    <div className="portal-shell" style={{ "--sidebar-w": `${sidebarWidth}px` }}>
      <TopBar />
      <LeftSidebar active={active} setActive={handleSetActive} collapsed={sidebarCollapsed} dragging={sidebarDragging} onResizeStart={handleSidebarResizeStart} />
      <div style={{ gridArea: "main", display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {active === "Knowledge base" && <KnowledgeBase mode={kbMode} setMode={handleSetKbMode} />}
        {active === "My requests" && <StubTab name="My requests" blurb="In-flight and submitted document requests across all offices live here. Out of scope for this prototype." />}
        {active === "Messages" && <StubTab name="Messages" blurb="Threaded conversations with the offices handling your requests. Out of scope for this prototype." />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Portal />);
