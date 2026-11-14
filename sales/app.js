// Gali Bazaar — Sales panel on the web. Routes: /sales/login/, /sales/setup/, /sales/, /sales/shops/, /sales/payouts/, /sales/profile/
const db = makeClient("gb-sales-auth");
const NAV = [["", "Overview", "M3 11 12 4l9 7v9h-6v-6H9v6H3z"], ["shops", "Your shops", "M4 9h16l-1.5-5h-13zM5 9v11h14V9M9 20v-6h6v6"],
  ["payouts", "Payouts & TDS", "M3 7h18v12H3zM3 11h18M7 15h4"], ["kyc", "KYC & bank", "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4"],
  ["guide", "Sales guide", "M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6M8 11h6"], ["profile", "Profile", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6"]];
const ico = d => `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
let me = null, D = null, shopFilter = "all", shopQ = "";
const route = () => location.pathname.replace(/^\/sales\/?/, "").replace(/\/$/, "").split("/")[0];
const go = p => { history.pushState({}, "", "/sales/" + (p ? p + "/" : "")); render(); };
window.onpopstate = () => render();

async function render() {
  const r = route();
  if (r === "login") return loginView();
  if (r === "setup") return setupView();
  const { data: { session } } = await db.auth.getSession();
  if (!session) { location.replace("/sales/login/"); return; }
  if (!me) {
    const { data: sp, error } = await db.from("sales_people").select("*").eq("profile", session.user.id).maybeSingle();
    if (error) return fail(niceErr(error));
    if (!sp) {   // applied but not approved yet → show the application status
      const { data: ap } = await db.from("sales_applications").select("*").eq("profile", session.user.id).order("created_at", { ascending: false }).limit(1);
      if (ap && ap[0]) return appStatus(ap[0]);
      return wrongAccount(session.user.email);
    }
    if (!sp.active || sp.login_blocked) return blocked();
    if (!sp.username) { history.replaceState({}, "", "/sales/setup/"); return setupView(3, session.user.email); }
    me = sp;
    if (sp.must_change) return changePassView(true);
    if (window.GBTerms) await GBTerms.gate(db, "sales", () => location.replace("/sales/login/"));
    await load();
    // "How your commission works" — every sign-in until the current text + this person's % / type is accepted
    if (D.sum && D.sum.needs_accept) await commissionGate(D.sum, async () => { await db.auth.signOut(); me = null; location.href = "/sales/login/"; });
    liveSync(db, "sales", ["commissions", "payouts", "sales_people", "shops"], async () => {
      const { data } = await db.from("sales_people").select("*").eq("id", me.id).maybeSingle();
      if (!data || !data.active || data.login_blocked) return blocked();
      me = data; await load(); page();
    });
  }
  shell(); page();
}
function appStatus(a) {
  document.body.innerHTML = `<div class="login">${LOGO}<h1>${a.status === "rejected" ? "Application not approved" : "Application received"}</h1>
    <p class="sub">${a.status === "rejected" ? `Reason: ${esc(a.reject_reason || "")}. You can apply again after 30 days.` : "We'll review your application and email you. Usually 1–2 days."}</p>
    <a class="btn ghost" href="/help/sales-guide/">Read the Sales guide</a> <a class="btn ghost" href="#" onclick="db.auth.signOut().then(()=>location.href='/');return false">Sign out</a></div>`;
}
function fail(m) { document.body.innerHTML = `<div class="login">${LOGO}<h1>Couldn't open</h1><p class="sub">${esc(m)}</p><a class="btn ghost" href="/sales/login/">Back</a></div>`; }
async function wrongAccount(email) {
  await db.auth.signOut();
  document.body.innerHTML = `<div class="login">${LOGO}<h1>This account isn't a sales account</h1><p class="sub">${esc(email || "")} is not on the Gali Bazaar sales team, so it can't open the sales panel. You've been signed out.</p><a class="btn pink" href="/sales/login/">Sign in again</a></div>`;
}
async function blocked() {
  await db.auth.signOut(); me = null;
  document.body.innerHTML = `<div class="login">${LOGO}<h1>Login blocked</h1><p class="sub">Your sales login is blocked or removed. Contact the Gali Bazaar admin.</p><a class="btn ghost" href="/">Go to website</a></div>`;
}

// ---------------- sign in ----------------
function loginView() {
  document.body.innerHTML = `<div class="auth"><div class="hero"><div>${LOGO}<span class="pill2">SALES TEAM</span></div>
      <h1>Your sales, commission<br>&amp; payouts — <em>on the web.</em></h1>
      <p>Can't use the app? Sign in here and see every shop you brought, your commission, payouts and TDS. Only for people the admin added to the sales team.</p>
      <div class="feat"><div>🔗<b>Referral code</b><span>Copy &amp; share</span></div><div>🏪<b>Your shops</b><span>Live, trial, expired</span></div><div>💸<b>Payouts &amp; TDS</b><span>Gross, TDS, net</span></div></div></div>
    <div class="form"><div class="card2"><h2>Sign in</h2><div class="sub">With the username &amp; password you created.</div>
      <label>USERNAME</label><input class="in" id="un" autocomplete="username" autocapitalize="none" spellcheck="false">
      <label>PASSWORD</label><div class="inwrap"><input class="in" id="pw" type="password" autocomplete="current-password"><button class="show" type="button" id="sh">Show</button></div>
      <div class="msg" id="lm"></div><button class="btn dark full" id="lb" style="padding:14px;border-radius:14px;font-size:14px">Sign in</button>
      <a class="first" href="/sales/setup/"><span class="sii">✉️</span><div><b>First time here?</b><span>Set up with the email your admin added</span></div><em>Set up →</em></a>
      <p class="sub" style="font-size:12px">Forgot username or password? <b>Ask the Gali Bazaar admin to reset it.</b></p>
      <p class="sub" style="font-size:12px"><a href="/" style="color:#7C3AED">← galibazaar.site</a></p></div></div></div>`;
  $("#sh").onclick = () => { const p = $("#pw"); p.type = p.type === "password" ? "text" : "password"; $("#sh").textContent = p.type === "password" ? "Show" : "Hide"; };
  const submit = async () => {
    const m = $("#lm"), un = $("#un").value.trim(), pw = $("#pw").value;
    if (!un || !pw) { m.className = "msg err"; m.textContent = "Enter your username and password"; return; }
    $("#lb").disabled = true; m.textContent = "";
    const { data, error } = await db.rpc("sales_login_email", { p_username: un, p_password: pw });
    const email = typeof data === "string" ? data : data && data.email;
    if (error || !email) {
      m.className = "msg err"; m.textContent = error ? (/function|schema cache/.test(error.message) ? "Sales login isn't switched on yet — ask the admin." : niceErr(error)) : "Wrong username or password.";
      $("#lb").disabled = false; return;
    }
    const r = await db.auth.signInWithPassword({ email, password: pw });
    if (r.error) { m.className = "msg err"; m.textContent = "Wrong username or password."; $("#lb").disabled = false; return; }
    await db.rpc("sales_signed_in").then(() => {}, () => {});
    me = null; go("");
  };
  $("#lb").onclick = submit; $("#pw").onkeydown = e => { if (e.key === "Enter") submit(); };
  $("#un").focus();
}

// ---------------- first-time setup: email → code → username & password ----------------
async function setupView(startAt = 1, knownEmail = "") {
  let step = startAt, email = knownEmail, stopCd = null;
  if (startAt === 1) { const { data: { session } } = await db.auth.getSession(); if (session) { email = session.user.email; step = 3; } }
  document.body.innerHTML = `<div class="pagewrap"><div class="toprow">${LOGO}<span class="pill2">SALES TEAM</span><div class="sp"></div><span class="sub">Already set up? <a href="/sales/login/" style="color:#1D0F30;font-weight:700">Sign in</a></span></div>
    <h1 style="font-size:30px;margin-top:34px">Set up your sales login</h1><div class="sub">One time only • after this you sign in with your username &amp; password</div>
    <div class="steps3">
      <div class="st" id="s1"><h3><span class="n">1</span>Your email</h3><div class="sub">The one the admin added</div>
        <label>EMAIL</label><div class="inwrap"><input class="in" id="em" type="email" autocomplete="email" placeholder="you@gmail.com"><span id="emok"></span></div>
        <button class="btn pink full" id="b1" style="margin-top:12px">Send code</button>
        <div class="msg" id="m1"></div><div class="sub" style="font-size:11.5px">Only emails the admin added work. Any other email: “This email isn't on the Gali Bazaar sales team.”</div></div>
      <div class="st" id="s2"><h3><span class="n">2</span>Enter the code</h3><div class="sub">Sent to your email</div>
        <div class="sub" id="sentto" style="margin:0 0 10px"></div><div id="cb"></div>
        <div class="msg" id="m2"></div><div class="sub" style="font-size:11.5px">Code works for 10 minutes • <a href="#" id="rs" style="color:#7C3AED;pointer-events:none"></a></div>
        <button class="btn dark full" id="b2" style="margin-top:12px">Verify</button></div>
      <div class="st" id="s3"><h3><span class="n">3</span>Username &amp; password</h3><div class="sub">You'll use these to sign in</div>
        <label>CHOOSE A USERNAME</label><div class="inwrap"><input class="in" id="un" autocapitalize="none" spellcheck="false" placeholder="e.g. rahul.gb"><span id="unok"></span></div>
        <label>CREATE PASSWORD</label><input class="in" id="p1" type="password" autocomplete="new-password">
        <label>CONFIRM PASSWORD</label><input class="in" id="p2" type="password" autocomplete="new-password">
        <div class="sub" style="font-size:11.5px">8+ characters, with a number</div><div class="msg" id="m3"></div>
        ${window.GBTerms ? GBTerms.html("sales", "tsales") : ""}
        <button class="btn pink full" id="b3" style="margin-top:8px">Create &amp; sign in</button></div>
    </div>
    <div class="note" style="margin-top:22px">🛡 Your username is shown to the admin. If you forget your username or password, the admin can reset it for you.</div></div>`;
  const boxes = codeBoxes($("#cb"), v => verify(v));
  const paint = () => ["s1", "s2", "s3"].forEach((id, i) => { const n = i + 1; $("#" + id).className = "st " + (n < step ? "done" : n === step ? "cur" : "off"); $(`#${id} .n`).textContent = n < step ? "✓" : n; });
  const resendOn = () => { const a = $("#rs"); a.textContent = "Resend code"; a.style.pointerEvents = "auto"; };
  async function send() {
    const m = $("#m1"); email = $("#em").value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { m.className = "msg err"; m.textContent = "Enter your email"; return; }
    $("#b1").disabled = true; m.textContent = "";
    const ok = await db.rpc("sales_email_ok", { p_email: email });
    if (ok.error || ok.data !== true) { m.className = "msg err"; m.textContent = ok.error && /function|schema cache/.test(ok.error.message) ? "Sales login isn't switched on yet — ask the admin." : "This email isn't on the Gali Bazaar sales team."; $("#b1").disabled = false; $("#emok").innerHTML = ""; return; }
    $("#emok").innerHTML = '<span class="ok2">✓ On sales team</span>';
    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) { m.className = "msg err"; m.textContent = niceErr(error); $("#b1").disabled = false; return; }
    $("#b1").textContent = "Code sent ✓"; $("#sentto").innerHTML = `We sent a ${OTP_LEN}-digit code to <b>${esc(email)}</b>`;
    step = 2; paint(); boxes.focus();
    const a = $("#rs"); a.style.pointerEvents = "none"; stopCd && stopCd(); stopCd = countdown(a, 45, resendOn);
  }
  async function verify(v) {
    const m = $("#m2"); v = v || boxes.value();
    if (v.length < 6) { m.className = "msg err"; m.textContent = "Enter the code from your email"; return; }
    $("#b2").disabled = true;
    const { error } = await db.auth.verifyOtp({ email, token: v, type: "email" });
    $("#b2").disabled = false;
    if (error) { m.className = "msg err"; m.textContent = "Wrong or expired code."; boxes.ok(false); return; }
    const { data: { session } } = await db.auth.getSession();
    const { data: sp } = await db.from("sales_people").select("id,username,active,login_blocked").eq("profile", session.user.id).maybeSingle();
    if (!sp) return wrongAccount(email);
    if (!sp.active || sp.login_blocked) return blocked();
    boxes.ok(true); m.className = "msg ok"; m.textContent = "✓ Email verified";
    stopCd && stopCd(); $("#rs").textContent = ""; step = 3; paint(); $("#un").value = sp.username || ""; $("#un").focus();
  }
  let ut = null;
  $("#un").oninput = () => {
    clearTimeout(ut); const u = $("#un").value.trim().toLowerCase(), o = $("#unok");
    if (!u) { o.innerHTML = ""; return; }
    if (!/^[a-z0-9._]{4,20}$/.test(u)) { o.innerHTML = '<span class="bad2">4–20: a-z 0-9 . _</span>'; return; }
    ut = setTimeout(async () => { const { data } = await db.rpc("sales_username_free", { p_username: u }); o.innerHTML = data === false ? '<span class="bad2">Taken</span>' : data === true ? '<span class="ok2">Available</span>' : ""; }, 350);
  };
  async function create() {
    const m = $("#m3"), un = $("#un").value.trim(), p1 = $("#p1").value;
    if (p1.length < 8 || !/\d/.test(p1)) { m.className = "msg err"; m.textContent = "Password: 8+ characters with a number"; return; }
    if (p1 !== $("#p2").value) { m.className = "msg err"; m.textContent = "Passwords don't match"; return; }
    $("#b3").disabled = true;
    const { error } = await db.rpc("sales_set_login", { p_username: un, p_password: p1 });
    if (error) { m.className = "msg err"; m.textContent = niceErr(error); $("#b3").disabled = false; return; }
    await db.auth.signInWithPassword({ email, password: p1 }).then(() => {}, () => {});
    if (window.GBTerms) await GBTerms.accept(db, "sales").catch(() => {});
    me = null; go("");
  }
  $("#b1").onclick = send; $("#em").onkeydown = e => { if (e.key === "Enter") send(); };
  $("#rs").onclick = e => { e.preventDefault(); $("#b1").disabled = false; send(); };
  $("#b2").onclick = () => verify(); $("#b3").onclick = create;
  if (window.GBTerms) GBTerms.bind("tsales", $("#b3"));
  if (email) $("#em").value = email;
  if (step === 3) { $("#emok").innerHTML = '<span class="ok2">✓ On sales team</span>'; $("#b1").textContent = "Verified ✓"; $("#sentto").innerHTML = `<b>${esc(email)}</b>`; $("#m2").className = "msg ok"; $("#m2").textContent = "✓ Email verified"; }
  paint();
}

// admin asked to change password at next sign-in (or the person wants to)
function changePassView(forced) {
  document.body.innerHTML = `<div class="login">${LOGO}<h1>${forced ? "Set a new password" : "Change password"}</h1>
    <div class="sub">${forced ? "The admin reset your login. Choose your own password to continue." : ""} Username: <b>${esc(me.username)}</b></div>
    <label>NEW PASSWORD</label><input class="in" id="p1" type="password" autocomplete="new-password">
    <label>CONFIRM PASSWORD</label><input class="in" id="p2" type="password" autocomplete="new-password">
    <div class="sub" style="font-size:11.5px">8+ characters, with a number</div><div class="msg" id="lm"></div>
    <button class="btn pink full" id="lb">Save password</button>${forced ? "" : `<button class="btn ghost full" style="margin-top:8px" onclick="render()">Cancel</button>`}</div>`;
  $("#lb").onclick = async () => {
    const m = $("#lm"), p1 = $("#p1").value;
    if (p1.length < 8 || !/\d/.test(p1)) { m.className = "msg err"; m.textContent = "Password: 8+ characters with a number"; return; }
    if (p1 !== $("#p2").value) { m.className = "msg err"; m.textContent = "Passwords don't match"; return; }
    const { error } = await db.rpc("sales_set_login", { p_username: me.username, p_password: p1 });
    if (error) { m.className = "msg err"; m.textContent = niceErr(error); return; }
    toast("Password saved"); me = null; render();
  };
}

// ---------------- data ----------------
async function load() {
  const [shops, com, pay, tds, sum] = await Promise.all([
    db.rpc("my_referral_shops"), db.from("commissions").select("*").eq("sales", me.id).order("created_at", { ascending: false }),
    db.from("payouts").select("*").eq("sales", me.id).order("pdate", { ascending: false }), db.rpc("my_tds"), db.rpc("my_sales_summary"),
  ]);
  let list = shops.data;
  if (shops.error) { const r = await db.rpc("my_referrals"); list = r.data || []; }
  D = { shops: list || [], com: com.data || [], pay: pay.data || [], tds: tds.data || null, sum: sum.data || null };
  const byShop = {};
  D.com.forEach(c => { const b = byShop[c.shop] || (byShop[c.shop] = { earned: 0, last: null }); b.earned += Number(c.amount || 0); if (!b.last || c.created_at > b.last) b.last = c.created_at; });
  D.byShop = byShop;
}
const today = () => new Date().toISOString().slice(0, 10);
function shopState(s) {
  const live = s.sub_until && s.sub_until >= today();
  if (s.kyc !== "APPROVED") return "kyc";
  if (live) return s.paid ? "live" : "trial";
  return "expired";
}
function statusPill(s) {
  const st = shopState(s), d = s.sub_until ? Math.ceil((new Date(s.sub_until) - new Date(today())) / 864e5) : 0;
  return { live: `<span class="pill ok">Live till ${dmyy(s.sub_until)}</span>`, trial: `<span class="pill" style="background:#F3EDFF;color:#6D28D9">Free trial • ${d} day${d === 1 ? "" : "s"}</span>`,
    kyc: `<span class="pill warn">KYC pending</span>`, expired: `<span class="pill bad">Plan expired</span>` }[st];
}

// ---------------- layout ----------------
function shell() {
  const first = (me.name || "").trim().charAt(0).toUpperCase() || "S";
  document.body.innerHTML = `<div class="app"><aside class="side">${LOGO}<div class="tagline">SALES TEAM</div><nav class="nav">
    ${NAV.map(([k, l, d]) => `<a data-k="${k}" href="/sales/${k ? k + "/" : ""}">${ico(d)}${l}</a>`).join("")}</nav>
    <div class="who"><div class="r"><span class="av">${esc(first)}</span><div><b>${esc(me.name)}</b><small>${esc(me.email || "")}</small></div></div>
    <a href="/">← Website</a><a id="so">✕ Sign out</a></div></aside><main class="main" id="main"></main></div><div class="scrim" id="scrim"></div>`;
  document.querySelector(".app").insertAdjacentHTML("afterbegin", `<div class="mtop"><button id="mb" aria-label="Menu">☰</button>${LOGO}<small>Sales team</small></div>`);
  $$(".nav a").forEach(a => a.onclick = e => { e.preventDefault(); menu(false); go(a.dataset.k); });
  $("#so").onclick = async () => { await db.auth.signOut(); me = null; location.href = "/sales/login/"; };
  $("#mb").onclick = () => menu(true); $("#scrim").onclick = () => menu(false);
}
function menu(o) { $(".side").classList.toggle("open", o); $("#scrim").classList.toggle("open", o); }
function codeBox() { return `<div class="codebox">Your code <b>${esc(me.code)}</b><button onclick="copyCode()">Copy</button></div>`; }
function copyCode() { navigator.clipboard?.writeText(me.code).then(() => toast("Code copied")); }
function head(t, sub) { return `<div class="top"><div><h1>${t}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="sp"></div><span class="live" id="livepill">Live</span>${codeBox()}</div>`; }
function page() {
  const r = route();
  $$(".nav a").forEach(a => a.classList.toggle("on", a.dataset.k === r));
  if (r === "guide") { location.href = "/help/sales-guide/"; return; }
  ({ "": overview, shops, payouts: () => D.sum ? payoutsPage() : payouts(), kyc: () => D.sum ? kycPage() : overview(), profile }[r] || overview)();
}

// ---------------- Overview ----------------
function overview() {
  const fy = fyStart(), inFy = x => new Date(x) >= fy;
  const fyCom = D.com.filter(c => inFy(c.created_at)), earned = fyCom.reduce((a, c) => a + Number(c.amount || 0), 0);
  const due = D.com.filter(c => c.status !== "PAID").reduce((a, c) => a + Number(c.amount || 0), 0), dueN = D.com.filter(c => c.status !== "PAID").length;
  const t = D.tds || {}, fyPay = D.pay.filter(p => inFy(p.pdate));
  const paidNet = fyPay.reduce((a, p) => a + Number(p.net || 0), 0), paidTds = fyPay.reduce((a, p) => a + Number(p.tds || 0), 0);
  const live = D.shops.filter(s => shopState(s) === "live").length, follow = D.shops.filter(s => ["kyc", "expired"].includes(shopState(s)));
  // commission by month (Apr → Mar)
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(fy.getFullYear(), 3 + i, 1); return { y: d.getFullYear(), m: d.getMonth(), v: 0 }; });
  fyCom.forEach(c => { const d = new Date(c.created_at); const b = months.find(x => x.y === d.getFullYear() && x.m === d.getMonth()); if (b) b.v += Number(c.amount || 0); });
  const nowI = months.findIndex(x => x.y === new Date().getFullYear() && x.m === new Date().getMonth());
  const shown = months.slice(0, Math.max(nowI + 1, 1)), max = Math.max(1, ...shown.map(x => x.v));
  const lim = t.threshold || 20000, credited = Number(t.fy_credited || 0) + Number(t.due || 0), over = credited > lim;
  const scale = Math.max(lim * 1.25, credited), pct = Math.min(100, credited / scale * 100), limPct = lim / scale * 100;
  $("#main").innerHTML = head(`Hi ${esc((me.name || "").split(" ")[0])} 👋`, `${fyLabel()} • ${me.commission_pct}% of every plan amount after GST`) + (D.sum ? statusStrip(D.sum) + codeCard(D.sum) : "") + `
    <div class="kpis k4">
      <div class="kpi"><span>Earned this year</span><b>${inr2(earned)}</b><small>${fyCom.length} commission${fyCom.length === 1 ? "" : "s"}</small></div>
      <div class="kpi"><span>Pending payout</span><b class="or">${inr2(due)}</b><small>${dueN ? `TDS ≈ ${inr2(t.tds || 0)} • you get ≈ ${inr2(t.net ?? due)}` : "Nothing pending"}</small></div>
      <div class="kpi"><span>Paid out (net)</span><b class="gr">${inr2(paidNet)}</b><small>after ${inr2(paidTds)} TDS</small></div>
      <div class="kpi"><span>Shops joined</span><b class="pu">${D.shops.length}</b><small>${live} live • ${follow.length} need follow-up</small></div>
    </div>
    <div class="grid2">
      <div class="box"><h3>Commission by month <span style="float:right">${fyLabel()}</span></h3>
        <div class="bars">${shown.map((x, i) => `<div class="b ${i === nowI ? "now" : ""}"><em>${x.v ? inr(x.v) : ""}</em><i style="height:${Math.max(4, x.v / max * 170)}px"></i><span>${MON[x.m]}</span></div>`).join("")}</div></div>
      <div>
        <div class="box"><h3>TDS this year ${over ? `<span class="pill warn" style="float:right">Limit crossed</span>` : ""}</h3>
          <div class="tdsbar"><i class="${over ? "over" : ""}" style="width:${pct}%;--lim:${(limPct / pct * 100).toFixed(1)}%"></i><u style="left:${limPct}%"></u></div>
          <div class="lims"><span>₹0</span><span>${inr(lim)} limit</span><span>${inr(credited)}</span></div>
          <div class="sub" style="margin-top:8px">Above ${inr(lim)} in a year → <b>${t.rate || 2}% TDS</b> on the whole year${t.tds_done ? `. Cut so far <b>${inr2(t.tds_done)}</b>` : ""}.</div>
          ${t.has_pan ? `<div class="okline">✓ PAN added • ${esc(t.pan_masked || "")} (2%, not 20%)</div>` : `<div class="warnline">PAN not added — TDS is 20% without PAN. Ask the admin to add it.</div>`}</div>
        <div class="box"><h3>Need follow-up</h3>${follow.length ? follow.slice(0, 6).map(s => `<div class="fu"><div><b>${esc(s.name)}</b><span>${shopState(s) === "kyc" ? "KYC not finished" : "Plan expired " + dmy(s.sub_until)}</span></div>${phoneLink(s.phone) ? `<a class="callb" href="${phoneLink(s.phone)}">📞 Call</a>` : ""}</div>`).join("")
          : `<div class="sub">All your shops are fine 👍</div>`}</div>
      </div></div>
    <div class="note">Help the shop download the app from galibazaar.site, tap “Register your shop” and enter your code <b>${esc(me.code)}</b> in “Referral code”. No commission during the free trial — only on approved plan payments, as per your commission type.</div>`;
  if (D.sum && D.sum.code_active) drawQr(D.sum.code);
}

// ---------------- Your shops ----------------
function shops() {
  const cnt = k => D.shops.filter(s => k === "all" || shopState(s) === k).length;
  const F = [["all", "All"], ["live", "Live"], ["trial", "Free trial"], ["kyc", "KYC pending"], ["expired", "Expired"]];
  $("#main").innerHTML = head(`${D.shops.length} shop${D.shops.length === 1 ? "" : "s"} joined with your code`, "Live, trial, KYC and expired — call the ones that need you") + `
    <div class="bar2"><div class="fchips">${F.map(([k, l]) => `<button class="fchip ${shopFilter === k ? "on" : ""}" data-f="${k}">${l} ${cnt(k)}</button>`).join("")}</div><div class="sp"></div>
      <input class="search" id="q" placeholder="Search shop or area" value="${esc(shopQ)}"><button class="btn ghost" id="ex" style="padding:9px 14px">⇩ Export</button></div>
    <div class="box" id="tb"></div><div class="sub">No commission during the free trial • only on real plan payments, for as long as the shop stays</div>`;
  const draw = () => {
    const q = shopQ.toLowerCase();
    const list = D.shops.filter(s => (shopFilter === "all" || shopState(s) === shopFilter) && (s.name + " " + s.locality + " " + s.city).toLowerCase().includes(q));
    $("#tb").innerHTML = list.length ? `<table><thead><tr><th>SHOP</th><th class="hm">AREA</th><th>STATUS</th><th class="hm">PLAN</th><th class="hm">LAST PAYMENT</th><th>YOU EARNED</th><th></th></tr></thead><tbody>${list.map(s => {
      const b = D.byShop[s.id] || {}, st = shopState(s);
      return `<tr><td><b>${esc(s.name)}</b><br><span class="sub">Joined ${dmyy(s.created_at)}</span></td><td class="hm">${esc([s.locality, s.city].filter(Boolean).join(", "))}</td><td>${statusPill(s)}</td>
        <td class="hm">${s.months ? s.months + " month" + (s.months === 1 ? "" : "s") : "—"}</td><td class="hm">${b.last ? dmy(b.last) : "—"}</td><td><b>${inr2(b.earned || 0)}</b></td>
        <td>${(st === "kyc" || st === "expired") && phoneLink(s.phone) ? `<a class="callb" href="${phoneLink(s.phone)}">📞 Call</a>` : ""}</td></tr>`; }).join("")}</tbody></table>`
      : `<div class="sub" style="padding:14px 0">No shops here. Shops appear as soon as they register with your code.</div>`;
  };
  $$(".fchip").forEach(b => b.onclick = () => { shopFilter = b.dataset.f; shops(); });
  $("#q").oninput = e => { shopQ = e.target.value; draw(); };
  $("#ex").onclick = () => csvDownload("my-shops.csv", [["Shop", "Area", "City", "Phone", "Status", "Plan months", "Last payment", "Earned"],
    ...D.shops.map(s => [s.name, s.locality, s.city, s.phone, shopState(s), s.months || "", D.byShop[s.id]?.last?.slice(0, 10) || "", (D.byShop[s.id]?.earned || 0).toFixed(2)])]);
  draw();
}

// ---------------- Payouts & TDS ----------------
function payouts() {
  const fy = fyStart(), inFy = x => new Date(x) >= fy, t = D.tds || {};
  const fyPay = D.pay.filter(p => inFy(p.pdate)), gross = fyPay.reduce((a, p) => a + Number(p.gross || 0), 0), tds = fyPay.reduce((a, p) => a + Number(p.tds || 0), 0), net = fyPay.reduce((a, p) => a + Number(p.net || 0), 0);
  const due = D.com.filter(c => c.status !== "PAID"), dueAmt = due.reduce((a, c) => a + Number(c.amount || 0), 0);
  const name = id => D.shops.find(s => s.id === id)?.name || "Shop";
  $("#main").innerHTML = head("Every payout with gross, TDS and what you got", `Admin sends payouts to ${esc(me.upi || "your UPI")}`) + `
    <div class="kpis k4">
      <div class="kpi pend"><span style="color:#B45309;font-weight:600">Pending (next payout)</span><b>${inr2(dueAmt)}</b><small>${due.length} commission${due.length === 1 ? "" : "s"} • TDS ≈ ${inr2(t.tds || 0)} • you get ≈ ${inr2(t.net ?? dueAmt)}</small></div>
      <div class="kpi"><span>Paid out this year (gross)</span><b>${inr2(gross)}</b><small>${fyPay.length} payout${fyPay.length === 1 ? "" : "s"}</small></div>
      <div class="kpi"><span>TDS cut this year</span><b style="color:#DC2626">${inr2(tds)}</b><small>${t.rate || 2}% • ${t.has_pan ? "PAN added" : "no PAN (20%)"}</small></div>
      <div class="kpi"><span>Got in hand (net)</span><b class="gr">${inr2(net)}</b><small>to ${esc(me.upi || "your UPI")}</small></div>
    </div>
    <div class="grid2">
      <div class="box"><h3>Payouts <button class="mini" style="float:right" id="dl">⇩ Download TDS summary</button></h3>${D.pay.length ? `<table><thead><tr><th>DATE</th><th>GROSS</th><th>TDS</th><th>NET</th><th class="hm">UPI REF</th><th class="hm"></th></tr></thead><tbody>${D.pay.map(p => `<tr>
        <td><b>${dmyy(p.pdate)}</b></td><td>${inr2(p.gross)}</td><td style="color:${Number(p.tds) ? "#DC2626" : "inherit"}">${inr2(p.tds)}</td><td><b style="color:#16A34A">${inr2(p.net)}</b></td><td class="hm">${esc(p.ref || "—")}</td><td class="hm"><span class="pill ok">PAID</span></td></tr>`).join("")}</tbody></table>`
        : `<div class="sub">No payouts yet.</div>`}</div>
      <div class="box"><h3>Commission entries <span style="float:right">${D.com.filter(c => inFy(c.created_at)).length} this year</span></h3>${D.com.length ? `<table><thead><tr><th>DATE</th><th>SHOP</th><th class="hm">PLAN</th><th>AMOUNT</th><th></th></tr></thead><tbody>${D.com.map(c => `<tr>
        <td>${dmy(c.created_at)}</td><td><b>${esc(name(c.shop))}</b></td><td class="hm">${inr(c.base_amount)} · ${c.pct}%</td><td><b>${inr2(c.amount)}</b></td><td><span class="pill ${c.status === "PAID" ? "grey" : "warn"}">${c.status === "PAID" ? "PAID" : "DUE"}</span></td></tr>`).join("")}</tbody></table>`
        : `<div class="sub">No commission yet — it starts when a shop from your code pays for a plan.</div>`}</div>
    </div>`;
  $("#dl").onclick = () => csvDownload(`tds-summary-${fyLabel().replace(/\s/g, "")}.csv`, [["Date", "Gross", "TDS", "Net", "UPI ref"], ...D.pay.map(p => [String(p.pdate).slice(0, 10), p.gross, p.tds, p.net, p.ref || ""]),
    [], ["Total this FY", gross.toFixed(2), tds.toFixed(2), net.toFixed(2)], ["PAN", t.pan_masked || "not added"]]);
}

// ---------------- Profile ----------------
function profile() {
  $("#main").innerHTML = head("Profile", "Your sales account") + `<div class="box" style="max-width:640px">
    ${[["Name", me.name], ["Username", me.username], ["Email (login)", me.email], ["Phone", me.phone], ["UPI for payouts", me.upi || "Not added"], ["PAN", D.tds?.pan_masked || "Not added"],
       ["Referral code", `${me.code} · ${me.commission_pct}% commission`], ["Last sign-in", dt(me.last_sign_in)]].map(([k, v], i) =>
      `<div class="row" ${i ? "" : 'style="border:0;margin:0"'}><div><b>${k}</b><span>${esc(v || "—")}</span></div></div>`).join("")}
    <div class="note">To change your UPI, phone, PAN or username, ask the Gali Bazaar admin.</div>
    <button class="btn dark" id="cp">Change password</button> <button class="btn ghost" id="so2">Sign out</button></div>`;
  $("#cp").onclick = () => changePassView(false);
  $("#so2").onclick = async () => { await db.auth.signOut(); me = null; location.href = "/sales/login/"; };
}

render();
