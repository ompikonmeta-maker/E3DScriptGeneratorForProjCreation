# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# E3D Setup Generator — instructions for Claude Code

## What you are building

A single, self-contained, offline HTML tool that lets an AVEVA E3D administrator design naming
conventions freely (attributes, relations, templates) and generates the setup package: command
macros (.mac) for Teams → DBs → MDB → Sites → Zones, a register workbook, a README and a
re-loadable `config.json`.

Owner: omPik (Smart3D/S3D administrator learning E3D administration). UI language: Indonesian.

## Read in this order

1. `docs/SPEC.md` — data model, screens, engine, output (the contract).
2. `docs/RULES.md` — the only E3D facts you may rely on, with severities.
3. `docs/OUTPUT-FORMAT.md` — exact .mac line formats and ZIP layout.
4. `docs/UI.md` + `reference/mockups/*.dc.html` — screen layout and design tokens.
5. `docs/OPEN-ITEMS.md` — things not yet known. Never guess them; implement the stated fallback.
6. `schema/config.schema.json`, `presets/zrf.config.json`.
7. `tools/reference_generator.py` — executable reference engine. Your JS engine must match it.

## Current state

The repo is a handoff package: specs, preset, fixtures, mockups and a Python reference engine.
No `src/`, `dist/`, build script or JS tests exist yet — they are what you build. `prompts/first-prompt.md`
lists the intended phases (1 engine + A1–A5/N1–N16, 2 screens 1–4, 3 screen 5, 4 screen 6, 5 imports + U1–U12).

## Commands

```
# Reference engine: prints counts + issues, compares non-comment lines with fixtures (exit 1 on mismatch/error)
python tools/reference_generator.py presets/zrf.config.json --check fixtures/zrf

# Write the full reference package (33 .mac files) for byte-comparison with the JS engine (acceptance A4)
python tools/reference_generator.py presets/zrf.config.json --out build/zrf
```

Expected on the preset: 6/6 PASS, `errors=0 warnings=5` (one §9 NEW ZONE warning + V20 for E, I, T, N).
Node 22 is available in the cloud container, so headless JS tests can run with plain `node` (no deps).
Mutation cases N1–N16 are applied to a copy of the preset in memory — never edit `presets/` or `fixtures/`.

## Architecture (how the pieces fit)

Pipeline, identical in Python and JS: `config.json` → **resolve** (attributes by id/name, rows by `kode`)
→ **build_model** (cells = row attr sorted by `urutan` × col attr in row order, minus `excluded`; per cell
render `db/desc/dbno/pos/site/zones`; per row discipline + group separators) → **validate** → **generate**
(`{relPath: text}`). Function names in `tools/reference_generator.py` map 1:1 to SPEC §4 steps; port them,
then add the UI on top. The engine must stay DOM-free so the same module feeds Node tests and the HTML.

Key mechanics that span several docs:
- **Tokens** `{Head.col[.col]|filter}` (regex `TOKEN_RE`): `Head` is an attribute *name* (not id),
  `PROJECT`, `SITE` or `INDEX`; a `ref` column can be traversed (`Disiplin.team.kode`). Which heads are
  available depends on the template (SPEC 3.2 table) — that is what V03 checks.
- **Expressions** (`dbNo`, `mdbPos`) are rendered first, then parsed by a tiny integer parser
  (`evaluate`). Never `eval`/`Function`; non-exact division is an error.
- **Owning team** = text of `dbName` before `/`; it must be a `kode` in the `team`-role attribute.
- **B2 DB clause**: ` DB <db>` only when the DB differs from the previous `NEW SITE` line in the file;
  a separator belongs to the DB of the next cell. This is the subtle part — fixture B2 is the oracle.
- **Zone rules** run per cell in list order; `forEach` expands over another attribute's rows.
  A rule "targets" a row when one `when` clause uses the row attribute's head (drives V20).
- **Output text**: ASCII only, CRLF by default, trailing EOL. Comment lines (`$*`) are free text;
  only command lines are compared. `.prefix.mac` fixtures match only the first N command lines.

Domain data uses Indonesian keys — `kode`, `desc`, `urutan`, `anggota`, `existing`, `mdbMulai`, `slot`,
`fungsi`, `grup` — keep them; they are part of the config schema and the preset.

## Gaps between the reference engine and the spec

The Python engine covers only what the ZRF preset exercises. Implement the rest from SPEC/RULES:
- Issue `ref`s there are fact labels (`1.3`, `sec2`, `dup`, `sec9`); the JS engine must emit V-ids
  (V01–V24) *and* the fact ref per RULES.md §3.
- Not implemented in Python: V01, V02, V18, V21, V22 (A2 expects one V22 info), V24, `inUse` checks
  (V07/V08 against `inUse.dbs`), `combination.mode` `all`/`condition`, per-row `mdb` override,
  `output.split = perStep`, README, register .xlsx, issue `location`s.

## Hard constraints

- **One HTML file** (`dist/e3d-setup-generator.html`), vanilla JS, no framework.
- **Zero network requests at runtime**: no CDN, no Google Fonts, no external images. The user's
  corporate network blocks CDNs. Fonts: system stack (`"Segoe UI", Roboto, system-ui, sans-serif`;
  mono `Consolas, "Cascadia Mono", monospace`). Icons: inline SVG.
- Must work from `file://` in current Edge/Chrome on Windows without admin rights.
- ZIP and XLSX are written by your own code (store or deflate via `CompressionStream`); reading
  an uploaded .xlsx uses `DecompressionStream('deflate-raw')`. No third-party libraries.
- Persistence: autosave to `localStorage` (wrap in try/catch); `config.json` export/import is
  the durable format.
- Source may be split into modules under `src/`; a build script (Python stdlib or Node, no
  dependencies) inlines them into `dist/`. The dist file must not need the build tooling.

## E3D correctness rules (non-negotiable)

- Do **not** invent E3D/PML command syntax. Only emit the commands listed in
  `docs/OUTPUT-FORMAT.md`. Every command there is backed by a fact number in `docs/RULES.md`.
- Validation messages cite the fact number (e.g. "1.3"), as in RULES.md.
- Items marked §9 / untested are **warnings**, never silently treated as facts.

## Definition of done

1. `python tools/reference_generator.py presets/zrf.config.json --check fixtures/zrf` passes
   (it already does — keep fixtures untouched).
2. Your JS engine, run headless (Node if available, else `tests/run-tests.html` in the browser),
   produces **byte-identical** non-comment lines to the reference generator for the preset, and
   passes every case in `tests/ACCEPTANCE.md`.
3. All six screens from the mockups work end-to-end with real data — no placeholder buttons.
4. Loading the ZRF preset shows 0 errors and the warnings listed in ACCEPTANCE.md.
5. Round-trip: export `config.json` → import → export gives identical JSON.

## Working style

- Build in this order: engine + tests → screens 1–4 → preview/validation → generate (ZIP, XLSX)
  → imports. Commit after each phase.
- Keep the engine pure (no DOM) so it can be tested headless.
- If a requirement conflicts with RULES.md or is unclear, stop and ask omPik; do not guess.
- If omPik provides his local "07_Material Design" base CSS (tokens + components, local fonts),
  use its tokens instead of the mockup colors. Ask for the path before UI work.
