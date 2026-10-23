#!/usr/bin/env python3
"""Build the single offline file dist/e3d-setup-generator.html (Python 3 stdlib only).

Inlines, in order: MD3 tokens CSS (web-font @import removed, system font stack), app CSS,
MD3 dynamic color JS, engine, io and UI scripts listed in src/manifest.json.
Also writes tests/run-tests.html (browser test page for the engine).

Usage: python tools/build.py
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_OVERRIDE = """
/* Offline: no web fonts. System stack per CLAUDE.md. */
:root {
  --md-sys-typescale-font-brand: "Segoe UI", Roboto, system-ui, sans-serif;
  --md-sys-typescale-font-plain: "Segoe UI", Roboto, system-ui, sans-serif;
}
"""


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def write(rel, text):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def script_safe(js):
    return js.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def tokens_css(rel):
    css = read(rel)
    css = re.sub(r"@import\s+url\([^)]*\)\s*;", "/* web-font import removed for offline use */", css)
    css = re.sub(r"\.md-icon\s*\{[^}]*\}", "", css)          # icon font is not shipped; icons are inline SVG
    css = re.sub(r"\.md-icon\.filled\s*\{[^}]*\}", "", css)
    return css + FONT_OVERRIDE


def check_offline(html):
    bad = [p for p in (r"@import\s", r"<link\s+rel=\"stylesheet\"", r"<script\s+src=", r"url\(\s*['\"]?https?:", r"src=\"https?:", r"href=\"https?:")
           if re.search(p, html, re.I)]
    if bad:
        sys.exit(f"build: external resource reference found: {bad}")


def main():
    m = json.loads(read("src/manifest.json"))
    version = re.search(r"E\.VERSION = '([^']+)'", read("src/engine/core.js")).group(1)
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    css = tokens_css(m["toolkit"]["css"]) + "\n" + "\n".join(read(f) for f in m["css"])
    js_files = [m["toolkit"]["js"]] + m["engine"] + m["io"] + m["ui"]
    js = "\n".join(f"/* ---- {f} ---- */\n{read(f)}" for f in js_files)
    html = read("src/index.html").replace("/*CSS*/", css).replace("/*JS*/", script_safe(js))
    html = html.replace("{{VERSION}}", version).replace("{{BUILD}}", stamp)
    check_offline(html)
    write("dist/e3d-setup-generator.html", html)

    # Browser test page: engine + io + suite + preset + fixtures, no UI.
    fixtures = {}
    fdir = os.path.join(ROOT, "fixtures", "zrf")
    for base, _, names in os.walk(fdir):
        for n in sorted(names):
            p = os.path.join(base, n)
            fixtures[os.path.relpath(p, fdir).replace(os.sep, "/")] = open(p, encoding="utf-8").read()
    test_js = "\n".join(read(f) for f in m["engine"] + m["io"]) + "\n" + read("tests/suite.js")
    data = f"var PRESET = {read('presets/zrf.config.json')};\nvar FIXTURES = {json.dumps(fixtures)};\n"
    runner = """
(async function () {
  const out = document.getElementById('out'); let pass = 0, fail = 0;
  for (const t of makeSuite(E3D, PRESET, FIXTURES)) {
    try { await t.run(); pass++; out.textContent += 'PASS ' + t.id + '  ' + t.title + '\\n'; }
    catch (e) { fail++; out.textContent += 'FAIL ' + t.id + '  ' + t.title + '\\n  ' + e.message + '\\n'; }
  }
  out.textContent += '\\n' + pass + ' passed, ' + fail + ' failed\\n';
  document.title = (fail ? 'FAIL' : 'PASS') + ' - E3D engine tests';
})();
"""
    page = ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>E3D engine tests</title></head>"
            "<body><pre id=\"out\" style=\"font:13px Consolas,monospace\"></pre><script>\n"
            + script_safe(data + test_js + runner) + "\n</script></body></html>\n")
    write("tests/run-tests.html", page)
    size = os.path.getsize(os.path.join(ROOT, "dist/e3d-setup-generator.html"))
    print(f"dist/e3d-setup-generator.html  {size / 1024:.0f} KB  v{version}  ({len(js_files)} scripts)")
    print("tests/run-tests.html")


if __name__ == "__main__":
    main()
