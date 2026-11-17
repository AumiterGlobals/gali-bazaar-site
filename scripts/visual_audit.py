# Visual audit: every public page and every web panel page, at phone and desktop width, with sample data (offline).
# Fails on: page errors, the page scrolling sideways, and boxes / text running off the screen.
#   python3 -m http.server 8765 &   (from the site root)
#   python3 scripts/visual_audit.py [shots-dir]
import glob, os, sys, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/audit"
os.makedirs(OUT, exist_ok=True)
skip = ("/.claude/", "/node_modules/")
pages = sorted({"/" + os.path.relpath(os.path.dirname(p), ROOT).replace("\\", "/") + "/" for p in glob.glob(f"{ROOT}/**/index.html", recursive=True)
                if not any(s in p for s in skip)})
pages = [p.replace("/./", "/") for p in pages]
extra = ["/pay/?shop=s1&months=1", "/pay/?shop=s1&purpose=dues", "/pay/?shop=s1&purpose=featured&days=30"] + \
        ["/admin/#" + t for t in ["dashboard", "sellers", "kyc", "payments", "bank", "tax", "accounts", "categories", "festivals", "settings", "support", "sales", "takedowns", "deletes"]]
STUB = f"{ROOT}/scripts/supabase-stub-rich.js"
PAY_INFO = None
OVER = """() => { const W = window.innerWidth, out = [];
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; if (s.position === 'fixed' && p !== el) return false; } return false; };
  document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || s.position === 'fixed') return;
    if ((r.right > W + 2 || r.left < -2) && !el.closest('aside') && !clipped(el) && el.offsetParent !== null) out.push((el.tagName + '.' + (el.className || '').toString().slice(0, 30) + ' "' + (el.textContent || '').trim().slice(0, 40) + '" ' + Math.round(r.left) + '→' + Math.round(r.right)));
  });
  const narrow = [];
  if (W < 500) document.querySelectorAll('body *').forEach(el => { if (el.closest('aside,nav,.drawer,#mmenu,.sidrop,table')) return;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (own.length < 28) return; const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (r.width > 0 && r.width < 150 && s.display !== 'none' && el.offsetParent !== null && r.right > 0 && r.left < W) narrow.push(el.tagName + ' "' + own.slice(0, 34) + '" w=' + Math.round(r.width)); });
  return { sw: document.documentElement.scrollWidth, W, out: out.filter(x => !/^SPAN\.(logo|g|d) /.test(x)).slice(0, 6), narrow: narrow.slice(0, 4) }; }"""
bad = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw, vh, tag in [(390, 844, "m"), (1300, 850, "d")]:
        for u in pages + extra:
            pg = b.new_page(viewport={"width": vw, "height": vh}); errs = []
            pg.route("**/supabase-js@2*", lambda r: r.fulfill(path=STUB, content_type="application/javascript"))
            def rest(r):
                url = r.request.url
                if "/rpc/pay_info" in url:
                    return r.fulfill(status=200, content_type="application/json", body=pg.evaluate("() => JSON.stringify(null)") if False else json.dumps({
                        "name": "Sharma General Store", "city": "Delhi", "sub_until": "2027-06-30", "kyc": "APPROVED", "upi": "galibazaar@upi", "biz": "Gali Bazaar", "price": 99,
                        "discounts": {"1": 0, "3": 10, "6": 15, "12": 20}, "feat_week": 199, "feat_month": 599, "balance": -28, "paused": False, "dues": 28, "plan_covers_month": True,
                        "due_day": 5, "quotes": [{"months": m, "from": "2026-12-01", "to": "2027-06-30", "plan": 99 * m, "pay": 99 * m + 28} for m in (1, 3, 6, 12)], "fix": [], "pending": False}))
                if "/rest/v1/settings" in url:
                    return r.fulfill(status=200, content_type="application/json", body=json.dumps([{"plan_price": 99, "plan_discounts": {"1": 0, "3": 10, "6": 15, "12": 20}}]))
                return r.abort()
            pg.route("https://**", rest)
            pg.on("pageerror", lambda e: errs.append(str(e).split("\n")[0][:160]))
            try:
                pg.goto("http://localhost:8765" + u, wait_until="load", timeout=20000); pg.wait_for_timeout(1500)
                o = pg.evaluate(OVER)
            except Exception as e:
                o = {"sw": 0, "W": vw, "out": [], "narrow": []}; errs.append("load: " + str(e)[:120])
            name = (u.strip("/").replace("/", "_").replace("?", "_").replace("&", "_").replace("=", "-").replace("#", "_") or "home") + "_" + tag
            if tag == "m": pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
            prob = []
            if errs: prob.append("errors " + "; ".join(errs[:2]))
            if o["sw"] > o["W"] + 2: prob.append(f"page scrolls sideways ({o['sw']} > {o['W']})")
            if o["out"]: prob.append("off screen: " + " | ".join(o["out"][:3]))
            if o.get("narrow"): prob.append("squeezed text: " + " | ".join(o["narrow"][:3]))
            if prob: bad.append(f"{u} @{vw}: " + " ; ".join(prob)); print("✗", u, vw, prob)
            pg.close()
    b.close()
print(f"\n{len(bad)} problem(s)" if bad else "\nOK — no problems")
open(f"{OUT}/report.txt", "w").write("\n".join(bad))
