# Checks before every deploy

```
npm i --no-save acorn && node tools/check-globals.mjs     # same top-level name declared twice across a page's scripts
python3 -m http.server 8765 &  &&  python3 tools/check_panels.py   # seller / sales / admin pages open with 0 page errors
```

Both exit with code 1 when something is wrong. When a panel script changes, bump its `?v=` in the HTML so phones load the new file.
