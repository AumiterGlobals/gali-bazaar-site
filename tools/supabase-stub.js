// Test-only stand-in for supabase-js (tools/check_panels.py): every call answers with empty data, never throws.
(function () {
  const ME = { id: "u1", email: "test@example.com" };
  const rowFor = t => t === "profiles" ? { id: "u1", role: "admin", name: "Test", email: ME.email } : t === "settings" ? { id: 1, tax_report_emails: [] } : null;
  function chain(t) {
    const res = { data: [], error: null, count: 0 };
    const p = new Proxy(function () {}, {
      get(_, k) {
        if (k === "then") return (a, b) => Promise.resolve(res).then(a, b);
        if (k === "single" || k === "maybeSingle") return () => Promise.resolve({ data: rowFor(t), error: null });
        return () => p;
      },
      apply() { return p; }
    });
    return p;
  }
  const asyncNoop = v => new Proxy({}, { get: (_, k) => k === "then" ? undefined : (..._a) => Promise.resolve(v(k)) });
  const auth = new Proxy({}, { get: (_, k) => {
    if (k === "getSession") return async () => ({ data: { session: { user: ME, access_token: "x" } }, error: null });
    if (k === "getUser") return async () => ({ data: { user: ME }, error: null });
    if (k === "onAuthStateChange") return () => ({ data: { subscription: { unsubscribe() {} } } });
    return async () => ({ data: {}, error: null });
  } });
  const channel = () => { const c = new Proxy({}, { get: () => () => c }); return c; };
  window.supabase = { createClient: () => ({
    auth, from: chain, rpc: async () => ({ data: [], error: null }), channel, removeChannel() {}, removeAllChannels() {},
    storage: { from: () => asyncNoop(() => ({ data: null, error: null })) },
    functions: { invoke: async () => ({ data: null, error: null }) }
  }) };
})();
