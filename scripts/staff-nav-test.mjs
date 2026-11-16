// update-89 staff roles — the website menu each role gets (run: node scripts/staff-nav-test.mjs)
// Role → permissions mirrors has_perm() in the app repo's supabase/update-89-ops.sql; the server checks them again on every call.
import { readFileSync } from "node:fs";
const js = readFileSync(new URL("../admin/staff.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../admin/index.html", import.meta.url), "utf8");
const STAFF_NAV = eval("(" + js.match(/const STAFF_NAV = (\{[\s\S]*?\});/)[1] + ")");
const NAV = eval(html.match(/const NAV = (\[\[[\s\S]*?\]\]);/)[1]).map(n => n[0]);
const PERMS = {
  SUPPORT: ["complaints", "orders_lookup", "customers", "seller_chat"],
  KYC: ["kyc", "photo_review", "shops_view"],
  ACCOUNTS: ["payments", "bills", "books", "tds"],
  ACCOUNTANT_TAX: ["tds"],
};
const pagesFor = r => NAV.filter(k => new Set(PERMS[r].map(p => STAFF_NAV[p])).has(k));
let bad = 0; const check = (ok, msg) => { if (!ok) { bad++; console.log("✗ " + msg); } };
const OWNER_ONLY = ["settings", "team", "activity", "sales", "festivals", "categories", "featured", "dashboard"];
for (const r of Object.keys(PERMS)) {
  const p = pagesFor(r);
  console.log(`${r}: ${p.join(", ")}`);
  for (const o of OWNER_ONLY) check(!p.includes(o), `${r} can open ${o}`);
}
const S = pagesFor("SUPPORT"), K = pagesFor("KYC"), A = pagesFor("ACCOUNTS");
for (const x of ["settings", "accounts", "kyc"]) check(!S.includes(x), `SUPPORT can open ${x}`);
for (const x of ["complaints", "orders", "customers", "support"]) check(S.includes(x), `SUPPORT can't open ${x}`);
for (const x of ["payments", "customers", "accounts", "tax"]) check(!K.includes(x), `KYC can see ${x}`);
for (const x of ["kyc", "photos", "sellers"]) check(K.includes(x), `KYC can't open ${x}`);
for (const x of ["payments", "accounts", "tax"]) check(A.includes(x), `ACCOUNTS can't open ${x}`);
check(/body\.staff \[onclick\^="csvDl"\]\{display:none\}/.test(html) && /Only the owner can download exports/.test(js), "staff can still download exports");
check(/kyc_view/.test(js) && /createSignedUrl/.test(js.split("if (!window.STAFF)")[1] || ""), "KYC docs: staff path not view-only");
check(/staff_set_kyc/.test(html) && !/from\("shops"\)\.update\(\{ kyc/.test(html), "KYC approve doesn't go through staff_set_kyc");
console.log(bad ? `${bad} problem(s)` : "OK — staff menus match their roles");
process.exit(bad ? 1 : 0);
