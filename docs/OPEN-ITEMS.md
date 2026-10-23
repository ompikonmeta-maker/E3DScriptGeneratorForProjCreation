# Open items

Do not guess these. Implement the fallback and ask omPik when the answer is needed.

| Id | Item | Evidence | Fallback in v1 |
|---|---|---|---|
| OI-01 | Full list of zones for Dummy sites (function X). | Register sheet Zones: one `-STRU` zone per dummy site. Package B3 example for `/L-DUX` shows `-STRU` and `-EQUI`, and the Package Files sheet counts imply **5** zones per dummy site (e.g. Piping 2573 = 24 × 107 + 5). The preset generates 2 → total 2876 instead of 2906. | Preset rule `dummy` = `-STRU`, `-EQUI`. omPik to confirm the other 3 names; then only the preset changes. |
| OI-02 | Zone naming for Electrical, Instrumentation, Telecom, Structure. | Not in project doc 3.9 (PENDING in register). | No rules (only dummy). Validation V20 warns. |
| OI-03 | Header of the `Teams` sheet in the Export Config workbook. | Facts cover only the `Databases` header (6.4). | Detect a header cell containing "Name"; otherwise ask the user to choose the column. Ask omPik for `template_ImportConfig.xlsx` to add as a fixture. |
| OI-04 | Whether `NEW ZONE` after navigating to a site works (facts §9). | Community source; not tested in ZRF. | Generate it with warnings (README, B3 header, validation). After omPik's test, remove the warning via a `facts` flag in code. |
| OI-05 | Inter-DB site order in Model Explorer (facts §9). | Not separable in the Piping test. | MDB order = creation order (safe in both cases). |
| OI-06 | Maximum name lengths for team, DB, site, zone. | Not documented in the facts. | No length rule. |
| OI-07 | Root cause of error (43,41). | Random, environment-related. | README known-issue text only. |
| OI-08 | Hook Up (HK) module is not yet in the official project document. | Register note. | Kept in the preset as in the register. |
