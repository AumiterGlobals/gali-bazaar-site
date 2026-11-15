// Finds top-level names declared twice across the classic <script>s of one page (e.g. `const dmy` in panel/common.js
// and again in seller/app.js → "Identifier 'dmy' has already been declared" and the second file never runs).
// Run before every deploy:   npm i --no-save acorn && node scripts/check-globals.mjs
// Exit code 1 when any page has a clash.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse } from "acorn";

const ROOT = new URL("..", import.meta.url).pathname;
const pages = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    if (f.startsWith(".") || f === "node_modules" || f === "scripts") continue;
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".html")) pages.push(p);
  }
})(ROOT);

function topNames(code, file) {
  const out = [];
  let ast;
  try { ast = parse(code, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true }); }
  catch (e) { return { err: `${file}: ${e.message}` }; }
  for (const n of ast.body) {
    if (n.type === "VariableDeclaration") for (const d of n.declarations) {
      const ids = []; (function ids_(p) { if (!p) return; if (p.type === "Identifier") ids.push(p.name); else if (p.type === "ObjectPattern") p.properties.forEach(q => ids_(q.value || q.argument)); else if (p.type === "ArrayPattern") p.elements.forEach(ids_); else if (p.type === "AssignmentPattern") ids_(p.left); else if (p.type === "RestElement") ids_(p.argument); })(d.id);
      ids.forEach(name => out.push({ name, kind: n.kind, file }));
    }
    else if (n.type === "FunctionDeclaration") out.push({ name: n.id.name, kind: "function", file });
    else if (n.type === "ClassDeclaration") out.push({ name: n.id.name, kind: "class", file });
  }
  return { out };
}

let bad = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const seen = new Map();
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/type\s*=\s*["']?(module|application\/ld\+json|text\/template)/i.test(attrs)) continue;
    const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/) || [])[1];
    let code, name;
    if (src) {
      if (/^(https?:)?\/\//.test(src)) continue;   // CDN libraries
      const path = src.split("?")[0];
      const file = path.startsWith("/") ? join(ROOT, path) : join(dirname(page), path);
      if (!existsSync(file)) continue;
      code = readFileSync(file, "utf8"); name = path;
      if (m[2].trim()) { console.log(`✗ ${page.replace(ROOT, "")}: <script src="${path}"> has code inside — browsers ignore it (tag not closed?)`); bad++; }
    } else { code = m[2]; name = `inline #${++i}`; }
    const r = topNames(code, name);
    if (r.err) { console.log(`✗ ${page.replace(ROOT, "")}: parse error ${r.err}`); bad++; continue; }
    for (const d of r.out) {
      const prev = seen.get(d.name);
      if (prev && (prev.kind !== "var" && prev.kind !== "function" || d.kind !== "var" && d.kind !== "function")) {
        console.log(`✗ ${page.replace(ROOT, "")}: '${d.name}' declared in ${prev.file} (${prev.kind}) and again in ${d.file} (${d.kind})`); bad++;
      } else if (!prev) seen.set(d.name, d);
    }
  }
}
console.log(bad ? `\n${bad} problem(s)` : `OK — ${pages.length} pages, no duplicate top-level names`);
process.exit(bad ? 1 : 0);
