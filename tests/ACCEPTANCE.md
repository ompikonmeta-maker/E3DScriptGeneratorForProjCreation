# Acceptance tests

Automate A1–A4 and N1–N16 in the headless engine test suite (Node, or `tests/run-tests.html` that runs
in the browser and prints PASS/FAIL). U1–U12 are manual UI checks; `tests/ui-smoke.js` automates
U1, U3–U5, U7, U10 (ZIP content), U12 and N16 through the UI when Playwright is available.
Since UI v2 the screen numbers map to: 1 → Project sheet + Daftar (DB referensi) + Cek & Unduh (project match),
2 → Daftar, 3 → Susunan, 4 → Nama, 5 and 6 → Cek & Unduh + Masalah sheet.

## A. Preset ZRF

| Id | Given / When | Then |
|---|---|---|
| A1 | Load `presets/zrf.config.json` | teams 11 (5 new, 6 existing), DBs 250, sites 250, separators 90, zones 2876, reference DBs 122 active + 3 inactive, `/MDB-ZRF` members 372 |
| A2 | Validate | errors 0; warnings exactly: V19 (NEW ZONE untested) ×1, V20 for rows E, I, T, N ×4; info V22 ×1 |
| A3 | Generate | 33 .mac files + README + register + config.json; file names and folders as in OUTPUT-FORMAT §1 |
| A4 | Compare with fixtures (non-comment lines) | equal to `fixtures/zrf/**` (`.prefix.mac` = prefix match), and equal to the output of `python tools/reference_generator.py presets/zrf.config.json --out <dir>` for **all 33 files** |
| A5 | Export config → import → export | identical JSON |

## N. Negative cases (mutate the preset, expect the rule)

| Id | Mutation | Expect |
|---|---|---|
| N1 | Area `M2` slot = `1` | V07 error (DBNO duplicate, 1.3) for every row |
| N2 | `dbNo` = `{Area.slot} + 7000` | V06 error (1.3) |
| N3 | Disiplin `L` mdbMulai = `1` | V09 error (position duplicate) |
| N4 | `mdbPos` = `{INDEX} + 4990` | V09 error (outside 1–5000) |
| N5 | Add 63 Area rows with unused slots (2-letter codes, group OTHERS appended at its end) | V10 error (1002 current > 1000, 1.7); V09 also fires (positions overlap) |
| N6 | dbDefaults type `DICT` with access MULTIWRITE | V11 error (1.4) |
| N7 | `site` = `{Disiplin.kode}-{Area.kode}` (no `/`) | V12 error (3.5) |
| N8 | `site` = `/{Disiplin.kode|lower}-{Area.kode}` | V14 warning (3.5) |
| N9 | `sepGroup` = `/{Disiplin.kode}=={Grup.kode}==` | V15 warning (§9) |
| N10 | Area row order: move `Q1` after `HC` | V16 error (group PIPE-RACK not contiguous, 3.4) |
| N11 | Disiplin `L` team = `XXX` | V01 error (ref target missing); after adding team `XXX` with existing=false: no error, 00-TEAMS gains `CREATE TEAM XXX …` |
| N12 | `dbName` uses `{Area.nope}` | V03 error on the dbName card |
| N13 | `dbNo` = `{Area.slot} / 2` | V04 error (non-integer) for odd slots |
| N14 | Area desc contains `é` | V18 error |
| N15 | `combination.excluded` = `[["T","HB"]]` | DBs 249; T positions 201–224; T DBNO for HK stays 10941; B2 of Telecom has no `/T----HULL-BODY----` and no `/T-HBD` |
| N16 | Import `inUse` with DB `ZRFPIP/DESI-L-M1D` number 10201 | V07 and V08 errors |

## U. UI (manual)

| Id | Check |
|---|---|
| U1 | Opens from `file://` with the network disabled (DevTools offline); no console errors, no requests |
| U2 | Screen 1: Kosong → confirm dialog when data exists; Import config.json shows summary before applying |
| U3 | Screen 2: add attribute, add `ref` column, paste 10 rows from Excel; invalid cell shows red outline + message |
| U4 | Screen 2: deleting an attribute that is referenced is blocked and lists the references |
| U5 | Screen 3: unticking a cell updates counts, order table, and preview immediately |
| U6 | Screen 3: dragging an Area row changes B2 order and MDB positions |
| U7 | Screen 4: click a token inserts it at the cursor; sample updates live; unresolved token shows error |
| U8 | Screen 4: add/reorder zone rules with `in` clause and `forEach` |
| U9 | Screen 5: clicking an error navigates to the exact screen and cell |
| U10 | Screen 6: file preview equals the file inside the downloaded ZIP; ZIP opens in Windows Explorer |
| U11 | Register .xlsx opens in Excel without repair prompt; sheets per SPEC §9 |
| U12 | Reload the page: work is restored from localStorage |
