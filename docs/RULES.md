# E3D rules used by the generator

Source: `fakta-terverifikasi-e3d-admin.md` (project "Belajar AVEVA E3D", updated 2026-10-21).
Labels: **[DOC]** = AVEVA documentation, **[TES]** = proven by omPik in project ZRF
(E3D 3.1.8.1 / Administration 2.1.0.1). Only these facts may drive generator behaviour.
Fact numbers are stable; cite them in validation messages.

## 1. Facts

| Fact | Statement | Label |
|---|---|---|
| 1.1 | Every DB is owned by one Team. DB name is `TEAM/NAME`, e.g. `ZRFPIP/DESI-L-M1D`. | DOC |
| 1.2 | General users write only to DBs of their team; Free users write to all DBs. | DOC |
| 1.3 | Usable DB numbers: 1–7000 and 10000–250000. 7001–9999 and 250001–255000 are reserved. DB number must be unique within one MDB. | DOC |
| 1.4 | Multiwrite: many writers; Update: one writer. Only MODEL (DESI), CATALOGUE, DRAFT and ISODRAFT DBs can be multiwrite. | DOC |
| 1.5 | Multiwrite claim mode: IMPLICIT or EXPLICIT. | DOC |
| 1.6 | MDB = list of DBs opened in Design; members are current or deferred. | DOC |
| 1.7 | One MDB holds up to 5000 DBs; at most 1000 can be current at the same time. | DOC |
| 1.8 | Admin DB list is sorted by DB number. | TES |
| 1.9 | MDB order is set by the position number in `ADD db n` / `CURRENT db n`, not by DB number. | TES + DOC |
| 1.10 | Teams and users can be created in any order. | DOC |
| 1.11 | A user must be a member of the owning team to write to a DB. | DOC |
| 1.12 | When creating a DB, the owning team must already exist. | DOC |
| 1.13 | An MDB is built from DBs that already exist in the project. | DOC |
| 1.14 | The DB to be written must be the first DB of its type in the MDB member list. | DOC |
| §2 | Admin commands: `CREATE TEAM teamid DESC 'text'`; `CREATE DB team/db DESI ACCESS MULTIWRITE CLAIM IMPLICIT DBNO n DESC 'text'`; `CREATE MDB /name`; `SET MDB /name` (required before ADD/CURRENT); `ADD team/db n` (n 1–5000; without n → deferred); `CURRENT team/db n` (1–5000); `DEFER team/db`; `SET TEAM x` then `TADD userid` / `TREM userid`. `CREATE DB` has no option to create a SITE. The CREATE DB syntax incl. DBNO and DESC is proven in ZRF. | DOC + TES |
| 3.1 | Hierarchy: WORLD > SITE > ZONE > elements. No folder level above SITE. | TES |
| 3.2 | `NEW SITE /name DB team/db` creates the site in that DB. | TES |
| 3.3 | `NEW SITE /name` without `DB` goes into the same DB as the previously created site. | TES |
| 3.4 | Within one DB, sites appear in Model Explorer in creation order. | TES |
| 3.5 | Element names start with `/`. E3D is case-sensitive; AVEVA recommends upper case. Allowed characters are not documented. | DOC |
| 3.7 | The only valid owner of SITE is WORLD. ZONE owners: SITE, ZONE, APPLDATA. | DOC |
| 3.8 | Mandatory creation order: Team → DB → MDB → SITE → ZONE. | DOC + TES |
| 4.4 | REORDER of sites works only between sites in the same DB (the generator does not use REORDER). | TES |
| 5.4 | Empty sites as visual separators are a project practice, not an E3D feature. | TES |
| 6.3 | Export Config: the first row of every sheet is a comment row with column descriptions. | DOC |
| 6.4 | Databases sheet header: `#Keyword, Owning Team, Name, Description, Type, Claim Mode, Number, WithType, WithName, Product, AreaCode`. | TES |
| 6.6 | Import Config only accepts the export format (text cells `t="str"`); inline-string files are rejected. | TES |
| §7 | `(43,41) Unable to open DB team/db, MCD:6 The handle is invalid` occurs randomly when creating DBs (Import or `CREATE DB` macro); recreating the DB usually works. | TES |

## 2. Not verified (§9) — never treat as facts

| Item | Generator behaviour |
|---|---|
| Inter-DB site order follows MDB order | Keep MDB order = creation order; show info note. |
| `NEW ZONE` after navigating to a site (`/site` then `NEW ZONE /x`) | Generate it (from the ZRF package), add a warning comment as the first header line of every B3 file, and a warning in validation. |
| Characters other than letters, digits and `-` in names | Warning per name. |
| `ADD db n` with n beyond the current member count | Not relevant when positions are contiguous; no rule. |
| Create SITE field in the Admin GUI Create Database window | Not used. |

## 3. Validation rules

| Id | Check | Severity | Ref |
|---|---|---|---|
| V01 | Attribute `kode` unique; required columns filled; numbers are integers; `ref`/`refList` targets exist | error | — |
| V02 | Attribute names unique and match `[A-Za-z][A-Za-z0-9_]*`; at most one `team` and one `user` attribute | error | — |
| V03 | Every template token resolves in its context (SPEC 3.2) | error | — |
| V04 | Expressions evaluate to integers | error | — |
| V05 | Owning team (part of DB name before `/`) exists in the team attribute | error | 1.1, 1.12 |
| V06 | DB number within 1–7000 or 10000–250000 | error | 1.3 |
| V07 | DB number unique among generated DBs and `inUse.dbs` | error | 1.3 |
| V08 | DB name unique among generated DBs and not in `inUse.dbs` | error | 1.1 |
| V09 | MDB position within 1–5000 and unique per MDB (generated + active reference DBs) | error | §2 |
| V10 | Current members per MDB ≤ 1000 | error | 1.7 |
| V11 | `access = MULTIWRITE` only with type DESI, CATA, DRAFT, ISODRAFT | error | 1.4 |
| V12 | Site, separator and zone names start with `/` | error | 3.5 |
| V13 | Site, separator and zone names unique | error | — |
| V14 | Name not upper case | warning | 3.5 |
| V15 | Name contains characters other than `A-Z 0-9 - /` | warning | §9 |
| V16 | Groups contiguous within a row (site order) | error | 3.4 |
| V17 | (merged into V05) | — | — |
| V18 | Generated line contains non-ASCII characters | error | tool |
| V19 | Zone rules produce zones (any) | warning "NEW ZONE untested" | §9 |
| V20 | A row of the row attribute gets no zones from a rule that targets it (a rule whose `when` has a clause on the row attribute's token head). ZRF: E, I, T, N only get the dummy zones → 4 warnings | warning | — |
| V21 | Team in `inUse.teams` but `existing = false` (would fail with "Team name already defined") | warning | — |
| V22 | `inUse` not loaded: collisions with existing project data not checked | info | — |
| V23 | Reference DB listed active without a position, or duplicate reference DB | error | §2 |
| V24 | DB clause logic: a separator emitted before any site of its DB (cannot happen if engine is correct; assert) | error | 3.2, 3.3 |

Message format: `"<what> (<value>) <problem>"`, e.g. `DBNO 8000 (ZRFPIP/DESI-L-M1D) outside 1-7000 / 10000-250000`.
UI shows Indonesian text plus the ref chip; the register sheet uses the same text.
