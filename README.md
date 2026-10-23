# E3D Setup Generator — paket handoff untuk Claude Code

Paket ini berisi semua yang dibutuhkan Claude Code untuk membangun tool HTML offline yang menghasilkan
macro setup AVEVA E3D (Team → DB → MDB → Site → Zone) dari konvensi penamaan yang bebas diatur.

## Pakai tool

1. Buka `dist/e3d-setup-generator.html` (klik dua kali) di Microsoft Edge atau Google Chrome. Tanpa
   instalasi, tanpa hak admin, tanpa internet. File boleh disalin ke folder lokal, USB, atau share.
2. Layar 1: **Kosong** untuk konvensi baru, atau **Import config.json** (mis. `presets/zrf.config.json`).
   Opsional: **Import Export Config (.xlsx)** dari project tujuan untuk cek bentrok nama dan DBNO.
3. Layar 2–4: atur attribute, kombinasi dan template. Validasi berjalan langsung; layar 5 menampilkan
   semua temuan (klik untuk lompat ke sel terkait).
4. Layar 6: periksa isi file, lalu **Unduh ZIP** (macro .mac, README, register .xlsx, config.json).

Pekerjaan tersimpan otomatis di browser; `Export JSON` adalah simpanan permanen. Ctrl+Z / Ctrl+Y untuk
batal/ulang.

Untuk pengembang (butuh Python 3 dan Node):

```
python tools/build.py        # bangun ulang dist/ dari src/
node tests/run.js            # uji engine (A1-A5, N1-N16) + banding byte dengan engine referensi Python
```

`tests/run-tests.html` menjalankan uji engine yang sama langsung di browser.

## Isi paket handoff

| Path | Isi |
|---|---|
| `CLAUDE.md` | Instruksi utama untuk Claude Code: batasan, urutan baca, definition of done |
| `docs/SPEC.md` | Spesifikasi: model data, token, engine, 6 layar, import/export, register |
| `docs/RULES.md` | Fakta E3D [DOC]/[TES] + 24 aturan validasi (dengan nomor fakta) |
| `docs/OUTPUT-FORMAT.md` | Format persis tiap file .mac, README, struktur ZIP, urutan jalan |
| `docs/UI.md` | Layout dan token warna dari mockup |
| `docs/OPEN-ITEMS.md` | Hal yang belum diketahui + fallback-nya |
| `schema/config.schema.json` | JSON Schema untuk `config.json` |
| `presets/zrf.config.json` | Preset ZRF lengkap: 11 team, 6 user, 10 disiplin, 8 grup, 25 area, 107 fluid, 6 aturan zone, 125 DB referensi |
| `fixtures/zrf/` | Output nyata dari paket ZRF (00-TEAMS, B1/B2/B3 Piping, 90, 99) sebagai acuan uji |
| `tools/reference_generator.py` | Engine referensi (Python stdlib), sudah lolos semua fixture |
| `tests/ACCEPTANCE.md` | Uji preset, 16 kasus negatif, 12 cek UI |
| `reference/mockups/` | 6 file mockup layar (dari kanvas Design) |
| `prompts/first-prompt.md` | Prompt pertama untuk ditempel ke Claude Code |

## Cara mulai

1. Ekstrak ZIP ke folder kerja, misalnya `D:\tools\e3d-setup-generator`.
2. Buka Claude Code di folder itu.
3. Tempel isi `prompts/first-prompt.md`.
4. Jawab pertanyaan Claude Code (runtime tes, path 07_Material Design bila mau dipakai).

Cek cepat engine referensi (butuh Python 3):

```
python tools/reference_generator.py presets/zrf.config.json --check fixtures/zrf
```

Hasil saat paket dibuat: 6/6 PASS, 0 error, 5 peringatan (NEW ZONE belum dites; zone E/I/T/N belum ada).

## Yang perlu omPik konfirmasi (lihat `docs/OPEN-ITEMS.md`)

- **OI-01:** 3 nama zone Dummy lainnya (paket ZRF berisi 5 zone per site Dummy; yang diketahui baru `-STRU` dan `-EQUI`).
- **OI-03:** file `template_ImportConfig.xlsx` untuk fixture import sheet Teams.
- **OI-04:** hasil tes `NEW ZONE` di ZRF, supaya peringatannya bisa dicabut.
