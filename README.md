# E3D Setup Generator — paket handoff untuk Claude Code

Paket ini berisi semua yang dibutuhkan Claude Code untuk membangun tool HTML offline yang menghasilkan
macro setup AVEVA E3D (Team → DB → MDB → Site → Zone) dari konvensi penamaan yang bebas diatur.

## Isi

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
