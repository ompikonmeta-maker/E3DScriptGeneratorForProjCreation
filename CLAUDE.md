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
