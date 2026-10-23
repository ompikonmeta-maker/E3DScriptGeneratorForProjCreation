# UI

Reference mockups: `reference/mockups/*.dc.html` (also on the claude.ai canvas "E3D Setup Generator").
They are Design-canvas files: plain HTML inside `<x-dc>`, with data arrays in the `renderVals()` script
at the bottom. Read them for layout, copy, spacing and colours; do not ship their runtime markup
(`<x-dc>`, `<sc-for>`, `{{…}}`).

| Screen | Mockup |
|---|---|
| 1 Project | `Project.dc.html` |
| 2 Attribute | `Main.dc.html` |
| 3 Relasi & kombinasi | `Relasi.dc.html` |
| 4 Template | `Template.dc.html` |
| 5 Preview & validasi | `Preview.dc.html` |
| 6 Generate | `Generate.dc.html` |

## Layout

- Top bar 64 px: logo + "E3D Setup Generator", project code + MDB, buttons Import JSON / Export JSON
  (outlined pill) and Generate ZIP (filled pill).
- Left navigation 200–220 px: six steps; state icons ✓ (done = no errors in that screen), number
  (pending), filled (current). On narrow screens it wraps above the content.
- Content: 24 px padding, cards 12 px radius, 1 px border, 18–20 px padding, 20 px gap.
- Tables: header row tinted, 1 px row dividers, monospace for codes/names/numbers, horizontal scroll
  inside the card.

## Tokens

Implemented with the MD3 toolkit (`material-design-3-project/md3-tokens.css` + `md3-dynamic-color.js`,
seed `#00658A`, style tonalSpot; success/warning containers generated from their own seeds). The table
below is the original mockup palette the seed reproduces.

### Mockup palette

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F4F7F9` | page |
| `--surface` | `#FFFFFF` | cards, top bar, nav |
| `--surface-2` | `#F7F9FA` | inner panels |
| `--surface-3` | `#EEF2F4` | table headers, neutral chips |
| `--border` | `#DCE3E8` | cards |
| `--divider` | `#E5EAED` | table rows |
| `--outline` | `#71787E` | inputs, outlined buttons |
| `--text` | `#191C1E` | primary text |
| `--text-2` | `#41484D` | secondary text |
| `--primary` | `#00658A` | filled buttons, selection border, checkbox accent |
| `--primary-container` | `#CBE6F5` / text `#003549` | tokens, active nav, selected tab |
| `--selected` | `#EAF4FA` | selected list item / card |
| `--ok` | bg `#E3F4E8` / text `#14522C` | passed checks |
| `--warn` | bg `#FFF1D6` / text `#4A3200` | warnings, decisions |
| `--info` | bg `#E1EEF6` / text `#003549` | info |
| `--e3d-role` | bg `#FFE0CC` / text `#5C2A00` | attributes/rows that produce commands (Team, User, Separator) |
| `--error` | bg `#FDE7E7` / text `#8C1D18` | errors (not in mockups; use for invalid cells and error chips) |
| Fonts | `"Segoe UI", Roboto, system-ui, sans-serif`; mono `Consolas, "Cascadia Mono", monospace` | no web fonts |

Dark mode: optional for v1.

## Interaction notes

- Token chips: primary-container fill, monospace. Literal chips: white with outline. Drop target: dashed
  28 px square at the end of each pattern line.
- Matrix: 16 px checkboxes, sticky first column, grouped headers with a left divider at each group.
- Order table: drag handle `⋮⋮` per row (keyboard: Alt+↑/↓ on the focused row).
- Every icon-only button has `aria-label`. Focus ring visible (2 px primary).
- Snackbar (bottom) for import/export/generate results; dialogs for destructive actions.
