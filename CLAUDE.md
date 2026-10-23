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

Built: engine (`src/engine/`), IO (`src/io/`), six screens (`src/ui/`), build script, tests.
Deliverable `dist/e3d-setup-generator.html` and `tests/run-tests.html` are **generated and committed** —
rebuild after every source change. Decisions by omPik (2026-10-23):
- The tool ships **generic**: no ZRF preset card; start = Kosong / Import config.json / Import Export Config.
  `presets/zrf.config.json` stays in the repo for tests and is opened via Import config.json.
- UI uses the MD3 toolkit in `material-design-3-project/` (tokens CSS + dynamic color JS, seed `#00658A`),
  but **not** `md3-components.js`: its icons need the Material Symbols web font, which is blocked offline.
  Controls are native elements styled with MD3 tokens; icons are inline SVG (`src/ui/util.js`).

## Commands

```
python tools/build.py                 # -> dist/e3d-setup-generator.html + tests/run-tests.html
node tests/run.js                     # engine: A1-A5, N1-N16, X*, and byte-compare with the Python reference
node tests/run.js N1                  # one test (prefix match on id)
NODE_PATH=$(npm root -g) node tests/ui-smoke.js [shotDir]   # built file in headless Chromium, offline
python tools/reference_generator.py presets/zrf.config.json --check fixtures/zrf
```

Expected on the preset: 0 errors, warnings V19 x1 + V20 x4 (E, I, T, N), info V22 x1; 33 .mac files.
Never edit `presets/` or `fixtures/` for tests — mutation cases copy the preset in memory.

## Architecture (how the pieces fit)

`src/manifest.json` is the single file list (load order) used by `tools/build.py` and `tests/load.js`.
Everything is classic scripts sharing two globals: `E3D` (engine + io, no DOM) and `UI`.

Engine pipeline, mirroring `tools/reference_generator.py`: `E3D.compute(config)` → `index` (attributes
by id/name, rows by `kode`) → `buildModel` (cells = row attr sorted by `urutan` × col attr in row order,
filtered by `combination.mode`; per cell `db/desc/dbno/pos/site/zones/mdb`; separators) → `generate`
(ordered `{path, text, module, step}`) → `validate(cfg, model, files)` (V01–V24, each issue has
`{id, severity, ref, message, location}`). `readme`, `registerSheets`, `packageNames` build the rest.

Key mechanics that span several files:
- **Tokens** `{Head.col[.col]|filter}`: `Head` is an attribute *name*, `PROJECT`, `SITE` or `INDEX`.
  Allowed heads per template come from `E3D.TEMPLATE_KINDS` + `contextHeads` (SPEC 3.2) — V03.
  Rendering never throws: unresolvable tokens become `?` (data problems are reported by V01).
- **Expressions** (`dbNo`, `mdbPos`): rendered, then `evaluate` (no eval); failures → V04.
- **B2 DB clause**: ` DB <db>` only when the DB differs from the previous `NEW SITE` line (`siteOrder`).
- **Output text**: comment and command lines both match the Python reference byte-for-byte (A4b).
- **E3D facts as flags**: `E3D.FACTS.newZoneTested` / `interDbOrderProven` — flip when omPik confirms (OI-04/05).
- **UI state** (`src/ui/app.js`): `A.mutate(fn)` = snapshot (undo) + recompute + full screen render;
  typing in `[data-bind]` inputs = `A.touch()` (debounced recompute, then only `[data-part]` regions and
  `[data-loc]` error marks refresh, so focus is kept). `U.locKeys(issue.location)` ↔ `data-loc` attributes
  drive red outlines and click-to-navigate from screen 5. Autosave key `e3d-setup-generator/v1`.

Domain data uses Indonesian keys — `kode`, `desc`, `urutan`, `anggota`, `existing`, `mdbMulai`, `slot`,
`fungsi`, `grup` — keep them; they are part of the config schema.

The Python reference only covers what the ZRF preset exercises (no V-ids, inUse, `all`/`condition`
modes, per-row MDB, `perStep`, README, register). The JS engine implements those from SPEC/RULES and
`tests/suite.js` covers them (X2, N16, …).

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
- omPik's Material Design base is `material-design-3-project/` (see Current state). Use its tokens
  (`--md-sys-*`) for every color, type, shape and motion value; no raw hex in `src/ui/styles.css`.
