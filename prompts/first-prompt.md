# First prompt for Claude Code

Open a terminal in this folder (or attach it to a Claude Code session) and paste:

---

Read CLAUDE.md and follow it. Then read docs/SPEC.md, docs/RULES.md, docs/OUTPUT-FORMAT.md,
docs/UI.md, docs/OPEN-ITEMS.md, tests/ACCEPTANCE.md, schema/config.schema.json and
tools/reference_generator.py.

Before writing code:
1. Run `python tools/reference_generator.py presets/zrf.config.json --check fixtures/zrf` and confirm all PASS.
2. Tell me which runtime you have for headless tests (Node or browser test page) and the build approach
   that produces the single offline file dist/e3d-setup-generator.html.
3. Ask me for the path of my "07_Material Design" base CSS if I want it used; otherwise use docs/UI.md tokens.

Then build in phases, committing after each:
- Phase 1: pure JS engine (model, validation V01–V24, .mac generation) + headless tests A1–A5, N1–N16.
  Output for the ZRF preset must equal the reference generator for all 33 files.
- Phase 2: screens 1–4 with real editing, autosave, config.json import/export.
- Phase 3: screen 5 (tree, MDB, register table, validation list with navigation).
- Phase 4: screen 6 (file preview, ZIP writer, register .xlsx writer, README).
- Phase 5: Export Config .xlsx import (inUse), CSV/paste import, UI checks U1–U12.

Reply to me in Indonesian, concisely. Do not invent E3D command syntax; anything not in docs/RULES.md
or docs/OUTPUT-FORMAT.md must be asked.

---
