# Self-hosted font subsets

This directory contains the reproducible pipeline for the local webfont files in
`public/fonts/`.

## Fonts

- Klee One: display / quiet emotional copy
- Zen Kaku Gothic New: UI / body / numbers

Both are distributed under the SIL Open Font License. The license text copied
with the generated webfonts lives at `public/fonts/OFL.txt`.

## Sources

The script downloads original TTF files from the Google Fonts repository when
they are missing from `scripts/fonts/src/`:

- `https://raw.githubusercontent.com/google/fonts/main/ofl/kleeone/`
- `https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/`

If network access fails, put the original TTF files in `scripts/fonts/src/` with
these exact names:

- `KleeOne-Regular.ttf`
- `KleeOne-SemiBold.ttf`
- `ZenKakuGothicNew-Regular.ttf`
- `ZenKakuGothicNew-Medium.ttf`

The `src/` directory is intentionally gitignored; generated subsets are the
committed runtime artifact.

## Character sets

- `joyo.txt`: Joyo kanji list from `joyo-kanji@0.2.1` (MIT).
- `jinmeiyo.txt`: Jinmeiyo kanji list from `jinmeiyo-kanji@1.0.0` (MIT).

The generator also scans app source files and includes fixed copy characters so
that app-specific text is not missed.

## Regenerate

Install the local Python tooling, then run:

```powershell
python -m pip install --user fonttools brotli
python scripts/fonts/subset_fonts.py
```

The subset keeps Latin kerning (`--layout-features=kern`) and drops heavier
OpenType features that are not needed for the current horizontal UI.

Outputs are written to `public/fonts/`:

- `klee-one-400-subset.woff2`
- `klee-one-600-subset.woff2`
- `zen-kaku-gothic-new-400-subset.woff2`
- `zen-kaku-gothic-new-500-subset.woff2`
