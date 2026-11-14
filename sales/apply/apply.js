// Gali Bazaar — apply to become a sales partner (step 1, no KYC yet). The server checks everything (apply_sales).
const db = makeClient("gb-sales-auth");
const steps = n => `<div style="display:flex;gap:6px;margin:14px 0 4px">${["Apply", "Approval", "KYC", "Active"].map((l, i) => `<div style="flex:1"><div style="height:5px;border-radius:5px;background:${i < n ? "#6A1BB0" : "#EEE7F6"}"></div><div style="font-size:11.5px;margin-top:4px;color:${i < n ? "#1D0F30" : "#8E84A8"}">${l}</div></div>`).join("")}</div>`;
const wrap = inner => document.body.innerHTML = `<div class="pagewrap" style="max-width:560px"><div class="toprow">${LOGO}<span class="pill2">SALES PARTNER</span><div class="sp"></div><a class="sub" href="/sales/login/" style="color:#1D0F30;font-weight:700">Sign in</a></div>${inner}</div>`;
async function start() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return emailStep();
  const { data: sp } = await db.from("sales_people").select("id").eq("profile", session.user.id).maybeSingle();
  if (sp) { wrap(`<div class="box" style="margin-top:30px"><h2>You're already on the sales team</h2><p class="sub">Open your sales panel to see your code, KYC and payouts.</p><a class="btn pink" href="/sales/">Open sales panel</a></div>`); return; }
  const { data: ap } = await db.from("sales_applications").select("*").eq("profile", session.user.id).order("created_at", { ascending: false }).limit(1);
  const a = ap && ap[0];
  if (a && a.status === "applied") return done();
  if (a && a.status === "rejected" && Date.now() - Date.parse(a.decided_at) < 30 * 864e5)
    return wrap(`<div class="box" style="margin-top:30px"><h2>Application not approved</h2><p class="sub">Reason: ${esc(a.reject_reason || "")}<br>You can apply again after ${dmyy(new Date(Date.parse(a.decided_at) + 30 * 864e5).toISOString())}.</p></div>`);
  form(session.user.email);
}
function emailStep() {
  wrap(`<h1 style="font-size:28px;margin-top:28px">Earn by bringing shops</h1><div class="sub">Anyone 18+ can apply · koi bhi apply kar sakta hai</div>${steps(1)}
    <div class="box" style="margin-top:16px"><h3>First, verify your email</h3><div class="sub">We send a ${OTP_LEN}-digit code. This email becomes your sales login.</div>
      <label>EMAIL</label><input class="in" id="em" type="email" autocomplete="email" placeholder="you@gmail.com">
      <button class="btn pink full" id="b1" style="margin-top:12px">Send code</button><div id="cs" style="display:none"><div class="sub" id="st" style="margin-top:12px"></div><div id="cb"></div>
      <button class="btn dark full" id="b2" style="margin-top:12px">Verify</button></div><div class="msg" id="m1"></div></div>
    <div class="note">Read the <a href="/help/sales-guide/" style="color:#7C3AED">Sales guide</a> to see how commission works.</div>`);
  let email = "";
  const boxes = codeBoxes($("#cb"), v => verify(v));
  $("#b1").onclick = async () => {
    const m = $("#m1"); email = $("#em").value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { m.className = "msg err"; m.textContent = "Enter your email"; return; }
    $("#b1").disabled = true;
    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) { m.className = "msg err"; m.textContent = niceErr(error); $("#b1").disabled = false; return; }
    $("#b1").textContent = "Code sent ✓"; $("#cs").style.display = "block"; $("#st").innerHTML = `Enter the code sent to <b>${esc(email)}</b>`; boxes.focus();
  };
  async function verify(v) {
    const m = $("#m1"); v = v || boxes.value(); if (v.length < 6) return;
    const { error } = await db.auth.verifyOtp({ email, token: v, type: "email" });
    if (error) { m.className = "msg err"; m.textContent = "Wrong or expired code."; boxes.ok(false); return; }
    start();
  }
  $("#b2").onclick = () => verify();
}
function form(email) {
  wrap(`<h1 style="font-size:28px;margin-top:28px">Apply — Sales partner</h1>${steps(1)}
    <div class="box" style="margin-top:12px"><h3>Earn by bringing shops</h3><div class="sub">Anyone 18+ can apply · koi bhi apply kar sakta hai</div>
      <label>FULL NAME</label><input class="in" id="nm" autocomplete="name">
      <label>MOBILE</label><input class="in" id="ph" inputmode="numeric" maxlength="14" placeholder="98765 43210">
      <label>EMAIL (VERIFIED)</label><input class="in" value="${esc(email)} ✓" disabled>
      <label>CITY / AREA YOU WILL WORK IN</label><input class="in" id="ct" placeholder="Ghaziabad – Indirapuram">
      <label>HOW WILL YOU FIND SHOPS? (OPTIONAL)</label><input class="in" id="hw" placeholder="My area market, friends">
      <label>YOU ARE (OPTIONAL)</label><select class="in" id="oc"><option value="">—</option><option>Currently working</option><option>Student</option><option>Shop owner</option><option>Other</option></select>
      ${GBTerms.html("sales", "tapply")}
      <div class="msg" id="m"></div><button class="btn pink full" id="go" style="margin-top:10px;padding:14px">Submit application</button></div>`);
  GBTerms.bind("tapply", $("#go"));
  $("#go").onclick = async () => {
    const m = $("#m");
    $("#go").disabled = true;
    const { error } = await db.rpc("apply_sales", { p_name: $("#nm").value, p_phone: $("#ph").value, p_city: $("#ct").value, p_how: $("#hw").value, p_occupation: $("#oc").value, p_platform: "web" });
    if (error) { m.className = "msg err"; m.textContent = niceErr(error); $("#go").disabled = false; return; }
    await GBTerms.accept(db, "sales").catch(() => {});
    done();
  };
}
function done() {
  wrap(`<h1 style="font-size:28px;margin-top:28px">Application received 🎉</h1>${steps(1)}
    <div class="box" style="margin-top:12px"><p style="font-size:15px">We'll review your application and email you. <b>Usually 1–2 days.</b></p>
    <div class="sub">After approval: set up your login, complete KYC (PAN, Aadhaar, selfie, bank and UPI). Your code starts working after KYC is approved.</div>
    <a class="btn ghost" href="/help/sales-guide/" style="margin-top:12px">Read the Sales guide</a></div>`);
}
start();
