# E3D Setup Generator — functional specification (v1)

Status: approved by omPik on 2026-10-23 (mockups and workflow). Source data: project "Belajar AVEVA E3D",
docs `fakta-terverifikasi-e3d-admin.md`, `contoh-paket-setup-zrf.md`, `contoh-register-zrf.md`.

## 1. Purpose

An E3D administrator defines a naming convention as data (attributes + templates). The tool turns it
into a ready-to-run package of command macros that build, in the mandatory order (fact 3.8):

```
Team → DB → MDB → SITE → ZONE
```

The tool is generic: nothing about ZRF is hard-coded. ZRF ships as a preset (`presets/zrf.config.json`).

## 2. Terms

| Term | Meaning |
|---|---|
| Attribute | A user-defined table (e.g. Disiplin, Area, Fluid). Columns `kode` and `desc` are mandatory. |
| Role | What an attribute means to E3D: `team`, `user`, `separator`, `none`. Only the first three produce commands. |
| Cell | One combination of the row attribute × column attribute (e.g. Piping × M1). One cell = one DB + one site. |
| Separator | An empty site used as a visual divider in Model Explorer (project practice, fact 5.4 — not an E3D feature). |
| Token | `{Attribute.column}` placeholder in a template. |
| In-use list | Team/DB names and DB numbers that already exist in the target project, read from an Export Config workbook. |

## 3. Data model (`config.json`)

The JSON Schema is `schema/config.schema.json`. Top-level keys:

| Key | Content |
|---|---|
| `schema` | Integer schema version. Current: `1`. Older versions are migrated on import (show what changed). |
| `project` | `code`, `name`, `target` (free text, written in file headers), `filePrefix`, `packageName`, `lineEnding` (`CRLF`/`LF`). |
| `mdbs` | List of `{name, default}`. Exactly one default. Names start with `/`. |
| `dbDefaults` | `type` (upper-case word; UI offers DESI, CATA, DRAFT, ISODRAFT + free entry), `access` (`MULTIWRITE`/`UPDATE`/`CONTROLLED`), `claim` (`IMPLICIT`/`EXPLICIT`). |
| `attributes` | List of attribute objects (3.1). Order = display order. |
| `combination` | Which cells exist (3.3). |
| `templates` | Name, number and file-name templates (3.4). |
| `zoneRules` | Ordered zone rules (3.6). |
| `referenceDbs` | Existing DBs to ADD to the MDB in step 90: `{db, pos, active, note}`; `pos` null when inactive. |
| `inUse` | Optional `{teams: [..], dbs: [{name, number}], source, importedAt}` from an Export Config import. |
| `output` | Package options (screen 6). |

### 3.1 Attribute

```json
{ "id": "disiplin", "name": "Disiplin", "role": "none",
  "columns": [ {"id":"kode","name":"Kode","type":"text","required":true},
               {"id":"desc","name":"Deskripsi","type":"text","required":true},
               {"id":"urutan","name":"Urutan","type":"number","required":true},
               {"id":"team","name":"Team","type":"ref","target":"team","required":true} ],
  "rows": [ {"kode":"L","desc":"Piping","urutan":2,"team":"ZRFPIP"} ] }
```

- `id`: stable key (`[a-z][a-z0-9_]*`), used in references. `name`: label and token head; unique;
  `[A-Za-z][A-Za-z0-9_]*` (no spaces, so tokens stay parseable). Renaming an attribute rewrites tokens.
- Column types: `text`, `number` (integer), `boolean`, `ref` (value = `kode` of a row in `target`),
  `refList` (array of `kode`s in `target`).
- `kode` unique within the attribute.
- Roles: at most one attribute each for `team` and `user`. `team` rows may have `existing` (boolean)
  and `anggota` (`refList` → user). `user` rows may have `free` (boolean, informational only).
  `separator`: its rows produce group separator sites (see 4.4).

### 3.2 Tokens

Syntax: `{Head.col[.col…]}` with optional filters `|upper`, `|lower`, `|pad:N` (left-pad with zeros).

| Head | Resolves to |
|---|---|
| Attribute `name` (e.g. `Disiplin`) | The row of that attribute in the current context. Following segments are column ids; a `ref` column may be followed by a column of its target (`Disiplin.team.kode`). |
| `PROJECT` | `project` keys (`PROJECT.code`, `PROJECT.filePrefix`). |
| `SITE` | The site name of the current cell (zone patterns only). |
| `INDEX` | 1-based position of the cell inside its row (after exclusions). |

A token that cannot be resolved in its context is a template error (shown on the card, blocks Generate).

Context per template:

| Template | Available heads |
|---|---|
| `dbName`, `dbDesc`, `dbNo`, `mdbPos`, `site` | row attr, column attr, group attr, `INDEX`, `PROJECT` |
| `sepDiscipline`, `discFolder`, `b1File`, `b2File`, `b3File` | row attr, `PROJECT` |
| `sepGroup` | row attr, group attr, column attr (first cell of the group), `PROJECT` |
| zone `patterns` | everything of the cell + `SITE` + the `forEach` attribute |
| `teamsFile`, `refFile`, `fixupFile`, `registerFile`, folders | `PROJECT` |

### 3.3 Combination

```json
{ "rowAttr": "disiplin", "colAttr": "area", "groupBy": "grup",
  "mode": "matrix", "excluded": [["T","HB"]], "condition": [], "mdb": "/MDB-ZRF" }
```

- `rowAttr` rows need a `number` column `urutan` (sort key). `colAttr` row order is the display order.
- `groupBy`: id of a `ref` column of `colAttr` (optional). Its target is the group attribute.
- `mode`: `all` (every cell), `matrix` (every cell except `excluded` pairs of `[rowKode, colKode]`),
  `condition` (cells whose context matches all `condition` clauses; clause format as in 3.6).
- `mdb`: MDB for ADD/CURRENT lines. If the row attribute has a `text` column with id `mdb`, a non-empty
  value overrides it for that row (each MDB is validated separately).

### 3.4 Templates

| Key | Kind | ZRF preset value |
|---|---|---|
| `dbName` | text | `{Disiplin.team.kode}/DESI-{Disiplin.kode}-{Area.kode}{Area.fungsi.kode}` |
| `dbDesc` | text | `DB for {Disiplin.desc} - {Area.desc}` |
| `dbNo` | expression | `10000 + {Disiplin.urutan} * 100 + {Area.slot}` |
| `mdbPos` | expression | `{Disiplin.mdbMulai} + {INDEX} - 1` |
| `site` | text | `/{Disiplin.kode}-{Area.kode}{Area.fungsi.kode}` |
| `sepDiscipline` | text, optional | `/----{Disiplin.desc|upper}----` |
| `sepGroup` | text, optional | `/{Disiplin.kode}----{Grup.kode}----` |
| `discFolder`, `b1File`, `b2File`, `b3File`, `teamsFile`, `refFile`, `fixupFile`, `registerFile`, `teamsFolder`, `refFolder`, `fixupFolder` | text | see preset |

The part of `dbName` before `/` is the owning team (fact 1.1) and must be a `kode` of the team attribute.

### 3.5 Expressions

Rendered tokens must be integers; then evaluated with `+ - * /` and parentheses. Integer result
required (division must be exact). Never use `eval`/`Function`. Reference: `evaluate()` in
`tools/reference_generator.py`.

### 3.6 Zone rules

```json
{ "id": "pipe-fluid",
  "when": [ {"token":"Disiplin.kode","op":"eq","value":"L"},
            {"token":"Area.fungsi.kode","op":"ne","value":"X"} ],
  "forEach": "fluid",
  "patterns": ["{SITE}-PIPE-{Fluid.kode}"],
  "source": "doc 3.9 B" }
```

- `op`: `eq`, `ne`, `in` (value is a list). All clauses must match.
- Rules are evaluated per cell in list order. Zones are emitted in rule order; with `forEach`, in row
  order of that attribute, and for each row in pattern order.
- `source`: free text shown in the UI and register (where the naming comes from).

## 4. Engine

Implement as pure functions (`src/engine/*.js`), mirrored by `tools/reference_generator.py`.

1. **Resolve** attributes, rows by `kode`, references.
2. **Cells**: rows of `rowAttr` sorted by `urutan`; for each, columns of `colAttr` in row order, filtered
   by `combination`. `INDEX` counts kept cells per row.
3. **Per cell**: `db`, `desc`, `dbno`, `pos`, `site`, `team` (= part of `db` before `/`), `zones`.
4. **Separators** per row: `sepDiscipline` once (if the template is set); `sepGroup` once per group that
   has at least one cell, only if the group attribute has role `separator` and the template is set.
5. **Site order** (drives B2, fact 3.4): discipline separator → for each cell in order: when the group
   changes, the group separator → the site. Groups must be contiguous inside a row (error otherwise).
6. **DB clause** (facts 3.2, 3.3): each `NEW SITE` line carries ` DB <db>` only when its DB differs from the
   previous line's DB in the same file. A separator belongs to the DB of the first cell that follows it.
7. **MDB order**: `ADD db n` uses `pos`; MDB order follows `n`, not DBNO (fact 1.9). The tool keeps
   MDB order equal to site creation order (the inter-DB display rule is unproven, §9).
8. **Validate** (RULES.md) after every edit (debounced ~300 ms; the ZRF preset has ~3 000 elements).
9. **Generate** text files (OUTPUT-FORMAT.md) and the register.

## 5. Validation

- Severity `error` blocks Generate; `warning` and `info` do not.
- Each issue: `{severity, ref, message, location: {screen, attributeId?, rowKode?, column?, template?, cell?}}`.
  Clicking an issue in screen 5 navigates to the location and highlights it.
- Inline: invalid table cells get a red outline + tooltip; template cards show their own checks.
- Full list and wording: RULES.md.

## 6. Screens

All screens share: top bar (app name, project code + MDB, Import JSON, Export JSON, Generate ZIP),
left step navigation (1–6, done = ✓, current highlighted), Indonesian labels. Layout and tokens:
`docs/UI.md`. Each screen is reachable at any time; Generate stays disabled while errors exist.

### Screen 1 — Project
- **Start**: radio cards `Preset ZRF`, `Kosong`, `Import config.json`, `Import Export Config (.xlsx)`.
  Choosing Preset/Kosong when data exists asks for confirmation (replaces current config).
  `Import config.json`: file picker → schema check → migrate → summary dialog (counts) → Lanjut/Batal.
  `Import Export Config`: reads sheets `Teams` and `Databases` into `inUse` (8.2); does not change attributes.
- **Identitas**: code, name, target version (free text with ZRF default), file prefix.
- **MDB**: list with add/remove/rename, one default (radio). Shows member count and checks (1.7).
- **Default DB**: type/access/claim selects; invalid multiwrite type → inline error (1.4).
- **DB referensi (step 90)**: table `db`, `pos`, `active`, `note`; add row, paste rows (TSV: db, pos, note),
  import from the Export Config `Databases` sheet (pick rows). Inactive rows are emitted commented.

### Screen 2 — Attribute
- Left list: attributes with role chip and `n rows · m columns`; add, duplicate, delete (blocked while
  referenced — show where), reorder.
- Editor: name, role select; column table (add/rename/delete/reorder; type; required; ref target);
  each column shows its token. Data grid: inline edit, add/delete/reorder rows, paste from Excel (TSV,
  header row optional, mapped by column name), import CSV. Search/filter.
- Validation chips under the grid (unique kode, required filled, numbers valid, refs valid).
- Team role: rows not found in `inUse.teams` (when present) get chip "baru", found ones "ada" — and
  `existing` is offered to be synced from `inUse`.

### Screen 3 — Relasi & kombinasi
1. **Relasi**: one card per `ref`/`refList` column: `Attr.col → Target`, counts, status.
2. **Kombinasi**: pick row attribute, column attribute, group column; mode segmented control.
   Matrix: rows × columns with checkboxes, grouped column headers, sticky first column, row totals,
   grand total; row/column toggle-all. Condition mode: clause editor (same as zone rules).
3. **Daftar objek**: counts of teams (new/existing), DBs, sites, separators, zones.
4. **Urutan**: tab per row value; table `#`, type (separator/site), `NEW SITE` name, DB (shown only
   where the DB clause is emitted), `ADD n`. Drag rows of the column attribute to reorder (changes the
   attribute's row order globally). Shows the §9 note on inter-DB order.

### Screen 4 — Template
- Left: token palette grouped by attribute (+ `PROJECT`, `SITE`, `INDEX`, free text), searchable.
  Click inserts at cursor; drag & drop onto a pattern.
- Right: one card per template (3.4) and a zone-rule card list (add/remove/reorder rules; clause editor;
  `forEach` select; multiple patterns).
- Pattern editor: chips (token / literal), editable literal text, filters per token chip, raw-text toggle.
- Each card: live sample (first applicable cell), result count, range (for expressions), checks with
  fact refs, error text when a token cannot resolve.

### Screen 5 — Preview & validasi
- Tiles: errors, warnings, teams (new), DBs (+ references), sites (+ separators), zones.
- Validation list grouped by severity; click → navigate.
- Tree: WORLD → separators → sites → zones (virtualized; expand per site).
- MDB list per MDB with positions; register table with tab per row value and search.
- "Lanjut ke Generate" disabled while errors exist.

### Screen 6 — Generate
- Options: package name, include README / register / config.json / 90-REFERENCE / 99-FIXUP /
  commented block of existing teams, split `perDiscipline` (B1, B2, B3 per row) or `perStep`
  (one B1, one B2, one B3 file for all rows, rows in order).
- File tree of the package with counts; click shows the file text (monospace, copy button).
- "Unduh ZIP": builds the archive in the browser and downloads it. "Unduh file ini" per file.
- Run-order table and the (43,41) known-issue box, same text as the README.

## 7. Output

Exact formats: `docs/OUTPUT-FORMAT.md`. Files are ASCII; non-ASCII in any generated line is an error
(E3D character support is undocumented). Line ending per `project.lineEnding` (default CRLF).

## 8. Import / export

### 8.1 `config.json`
Export = the full config, pretty-printed (2 spaces), keys in schema order. Import validates against the
schema; unknown keys are kept and re-exported untouched.

### 8.2 Export Config workbook (.xlsx) → `inUse`
- Read with `DecompressionStream('deflate-raw')` and a minimal XML parser.
- The first row of each sheet is a comment row with column descriptions (fact 6.3).
- `Databases` header (fact 6.4): `#Keyword, Owning Team, Name, Description, Type, Claim Mode, Number,
  WithType, WithName, Product, AreaCode`. Use `Owning Team` + `Name` → `TEAM/NAME`, `Number` → DBNO.
- `Teams` sheet: header not yet confirmed (OPEN-ITEMS OI-03). Locate the column by header text
  containing `Name`; if not found, ask the user to pick the column.
- Store `inUse.source` (file name) and `importedAt`.

### 8.3 Tables
Paste: TSV from Excel. CSV import: comma or semicolon (auto-detect), UTF-8, header row required.

## 9. Register workbook (.xlsx)

Sheets and columns:

| Sheet | Columns |
|---|---|
| Setup Steps | Step, What, File, Module, Check (rows as in OUTPUT-FORMAT §4) |
| Package Files | No, Folder, File, Module, Step, Content |
| Teams & Users | Team, Description, Status (Baru/Ada), Members, DB count |
| DB Register | No, Row (e.g. Disiplin), Row code, Team, Column (e.g. Area) code, Description, DB Name, DB No, MDB, Position, Type, Access, Claim, Site |
| Site Order | Order, Row, Type (Separator - discipline / Separator - group / Site), Site Name, Created in DB, DB No, Group |
| Zones | Site, Zone, Rule id, Source |
| Reference DBs | DB, Position, Active, Note |
| Validation | Severity, Ref, Message |
| Attributes | one sheet per attribute: its columns and rows |

Write with inline strings or a shared-strings part; header row bold; freeze the header row.

## 10. Non-functional

- Preset load + full validation < 1 s on a normal laptop; editing stays responsive (debounce, virtual lists).
- Keyboard accessible: real buttons/inputs, labels, visible focus, `aria-current` on the active step.
- Works at 1280 px and down to tablet width; tables scroll horizontally inside their card.
- No telemetry, no storage other than `localStorage` key `e3d-setup-generator/v1`.
