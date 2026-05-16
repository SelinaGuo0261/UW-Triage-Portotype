// Debounced autosave hook.
// Returns { saveStatus, flushSave }.
// saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'quota'
// flushSave(): bypasses debounce and saves immediately (call before navigating away).
//
// All writes go through storageAdapter — swap that file to move to a real API backend.
function useSaveManager({ flowId, flowTitle, flowDescription, graph, isLocal }) {
  const [saveStatus, setSaveStatus] = useState('idle');
  const debounceRef = useRef(null);
  const latestRef = useRef(null);

  // currentStateRef is always current — safe to read in cleanups and the unmount effect
  // without stale-closure bugs. Synced after every render (no deps array intentionally).
  const currentStateRef = useRef(null);
  useEffect(function () {
    currentStateRef.current = { flowId, flowTitle, flowDescription, graph, isLocal };
  });

  const doSave = useCallback(async function (snapshot) {
    const result = await storageAdapter.save(resolveFlowStorageKey(snapshot.flowId), {
      id: snapshot.flowId,
      name: snapshot.flowTitle,
      description: snapshot.flowDescription,
      graph: snapshot.graph,
      isLocal: !!snapshot.isLocal,
      savedAt: Date.now(),
    });
    if (result.ok) setSaveStatus('saved');
    else if (result.quota) setSaveStatus('quota');
    else setSaveStatus('error');
  }, []);

  // Public API: save right now, bypassing the 500 ms debounce.
  // Reads from currentStateRef so it is never stale.
  function flushSave() {
    const s = currentStateRef.current;
    if (!s || !s.flowId) return;
    storageAdapter.save(resolveFlowStorageKey(s.flowId), {
      id: s.flowId,
      name: s.flowTitle,
      description: s.flowDescription,
      graph: s.graph,
      isLocal: !!s.isLocal,
      savedAt: Date.now(),
    });
  }

  // Mid-session debounced save. Cleanup only cancels the timer — it does NOT flush.
  // Flushing here would save on every single keystroke and defeat the debounce.
  useEffect(function () {
    if (!flowId) return;
    latestRef.current = { flowId, flowTitle, flowDescription, graph, isLocal };
    setSaveStatus('saving');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(function () {
      doSave(latestRef.current);
    }, 500);
    return function () { clearTimeout(debounceRef.current); };
  }, [flowId, flowTitle, flowDescription, graph, isLocal, doSave]);

  // Bug 1 fix — flush when flowId changes (user opens a different flow).
  // Cleanup reads latestRef, which holds the last snapshot for the OLD flowId.
  // This is correct: latestRef was last written by the debounce effect during the
  // previous flow's session, before any new-flow state has landed.
  useEffect(function () {
    return function () {
      const s = latestRef.current;
      if (!s || !s.flowId) return;
      storageAdapter.save(resolveFlowStorageKey(s.flowId), {
        id: s.flowId,
        name: s.flowTitle,
        description: s.flowDescription,
        graph: s.graph,
        isLocal: !!s.isLocal,
        savedAt: Date.now(),
      });
    };
  }, [flowId]);

  // Bug 1 fix — flush on hook unmount (browser tab closed, etc.).
  // Empty deps: runs cleanup only once, on unmount.
  // Reads currentStateRef — never stale.
  useEffect(function () {
    return function () {
      clearTimeout(debounceRef.current);
      flushSave();
    };
  }, []);

  // Auto-clear 'saved' status after 3 s so the indicator doesn't linger.
  useEffect(function () {
    if (saveStatus !== 'saved') return;
    const t = setTimeout(function () { setSaveStatus('idle'); }, 3000);
    return function () { clearTimeout(t); };
  }, [saveStatus]);

  return { saveStatus: saveStatus, flushSave: flushSave };
}
