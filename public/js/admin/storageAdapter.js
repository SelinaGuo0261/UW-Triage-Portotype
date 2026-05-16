// Shared key resolver — single place to maintain; used by save, delete, and any other
// feature that reads or writes a flow's localStorage slot.
// Works identically for both scratch flows (id = 'local_...') and AI/backend flows (id = 'flow_...').
function resolveFlowStorageKey(id) {
  return 'flow_' + id;
}

// Storage adapter — swap this file to switch from localStorage to a real API backend.
// All autosave writes go through here; nothing else in the codebase should touch localStorage directly.
var storageAdapter = (function () {
  var NS = 'uw_triage_';

  function key(k) { return NS + k; }

  return {
    /** Persist data under the given key. Returns { ok, quota, error }. */
    save: async function (k, data) {
      try {
        localStorage.setItem(key(k), JSON.stringify(data));
        return { ok: true };
      } catch (err) {
        var isQuota =
          err.name === 'QuotaExceededError' ||
          err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          err.code === 22;
        return { ok: false, quota: !!isQuota, error: isQuota ? 'quota' : (err.message || 'unknown') };
      }
    },

    /** Load data for the given key. Returns { ok, data, error }. */
    load: async function (k) {
      try {
        var raw = localStorage.getItem(key(k));
        if (!raw) return { ok: true, data: null };
        return { ok: true, data: JSON.parse(raw) };
      } catch (err) {
        return { ok: false, data: null, error: err.message || 'parse error' };
      }
    },

    /** Remove a key. */
    remove: async function (k) {
      try {
        localStorage.removeItem(key(k));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },

    /** Return every draft saved under 'flow_*' (local-only flows created from scratch). */
    loadAllFlows: async function () {
      try {
        var FLOW_KEY = NS + 'flow_';
        var flows = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k2 = localStorage.key(i);
          if (k2 && k2.startsWith(FLOW_KEY)) {
            try { flows.push(JSON.parse(localStorage.getItem(k2))); } catch (e) { /* skip corrupted */ }
          }
        }
        return { ok: true, data: flows };
      } catch (err) {
        return { ok: false, data: [], error: err.message };
      }
    },
  };
})();
