# Opens the seller, sales and admin panels in headless Chromium with a stub Supabase client (no network)
# and fails if any page throws (pageerror). Run before every deploy:
#   python3 -m http.server 8765 &   (from the site root)
#   python3 scripts/check_panels.py
import glob, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pages = sorted({"/" + os.path.relpath(os.path.dirname(p), ROOT).replace("\\", "/") + "/" for p in
    glob.glob(f"{ROOT}/seller/**/index.html", recursive=True) + glob.glob(f"{ROOT}/sales/**/index.html", recursive=True) + glob.glob(f"{ROOT}/admin/index.html")})
admin_tabs = ["dashboard", "sellers", "kyc", "payments", "bank", "tax", "accounts", "categories", "festivals", "settings", "support", "sales", "takedowns", "deletes"]
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    def run(url):
        global bad
        pg = b.new_page(viewport={"width": 1300, "height": 850}); errs = []
        pg.route("**/supabase-js@2*", lambda r: r.fulfill(path=f"{ROOT}/scripts/supabase-stub.js", content_type="application/javascript"))
        pg.route("https://**", lambda r: r.abort())
        pg.on("pageerror", lambda e: errs.append(str(e).split("\n")[0][:160]))
        pg.goto("http://localhost:8765" + url); pg.wait_for_timeout(1300)
        if errs: bad += 1; print("✗", url, errs[:3])
        else: print("✓", url)
        pg.close()
    for u in ["/pay/", "/seller/login/", "/sales/login/", "/admin/"] + pages: run(u)
    for t in admin_tabs: run("/admin/#" + t)
    # festival look on (dark header): the open mobile menu (#mmenu) and the "Sign in" dropdown (.sidrop)
    # must keep readable links — fail if a link's colour equals its panel's background
    CHECK = """(sel) => { const panel = document.querySelector(sel); if (!panel) return ['no ' + sel];
      const bg = getComputedStyle(panel).backgroundColor, out = [];
      panel.querySelectorAll('a').forEach(a => { const c = getComputedStyle(a).color; if (a.offsetParent && c === bg) out.push((a.textContent || '').trim().slice(0, 30) + ' = ' + c); });
      return out; }"""
    for fest in ["diwali", "chhath"]:
        for u in ["/", "/help/", "/pricing/"]:
            for w, opener, panel in [(390, "button.menu-btn", "#mmenu"), (1300, "button.sibtn", ".sidrop")]:
                pg = b.new_page(viewport={"width": w, "height": 850})
                pg.route("**/supabase-js@2*", lambda r: r.fulfill(path=f"{ROOT}/scripts/supabase-stub.js", content_type="application/javascript"))
                pg.route("https://**", lambda r: r.abort())
                pg.goto(f"http://localhost:8765{u}?fest={fest}"); pg.wait_for_timeout(1500)
                tag = f"{u}?fest={fest} {panel} @{w}px"
                if pg.locator(opener).count() == 0: print("·", tag, "(no menu here)"); pg.close(); continue
                pg.locator(opener).first.click(); pg.wait_for_timeout(400)
                hidden = pg.evaluate(CHECK, panel)
                if hidden: bad += 1; print("✗", tag, "invisible links:", hidden[:4])
                else: print("✓", tag)
                pg.close()
    b.close()
print(f"\n{bad} page(s) with errors" if bad else "\nOK — no page errors"); sys.exit(1 if bad else 0)
