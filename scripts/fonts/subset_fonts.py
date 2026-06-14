from __future__ import annotations

import argparse
import subprocess
import sys
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FONT_DIR = Path(__file__).resolve().parent
DEFAULT_SRC_DIR = FONT_DIR / "src"
DEFAULT_OUT_DIR = ROOT / "public" / "fonts"

FONT_SOURCES = {
    "KleeOne-Regular.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/kleeone/KleeOne-Regular.ttf",
    "KleeOne-SemiBold.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/kleeone/KleeOne-SemiBold.ttf",
    "ZenKakuGothicNew-Regular.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/ZenKakuGothicNew-Regular.ttf",
    "ZenKakuGothicNew-Medium.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf",
}

OFL_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/kleeone/OFL.txt"

OUTPUTS = [
    {
        "source": "KleeOne-Regular.ttf",
        "output": "klee-one-400-subset.woff2",
        "text_files": ["klee-one-glyphs.txt"],
        "include_app_text": False,
    },
    {
        "source": "KleeOne-SemiBold.ttf",
        "output": "klee-one-600-subset.woff2",
        "text_files": ["klee-one-glyphs.txt"],
        "include_app_text": False,
    },
    {
        "source": "ZenKakuGothicNew-Regular.ttf",
        "output": "zen-kaku-gothic-new-400-subset.woff2",
        "text_files": ["joyo.txt", "jinmeiyo.txt"],
        "include_app_text": True,
    },
    {
        "source": "ZenKakuGothicNew-Medium.ttf",
        "output": "zen-kaku-gothic-new-500-subset.woff2",
        "text_files": ["joyo.txt", "jinmeiyo.txt"],
        "include_app_text": True,
    },
]

UNICODE_RANGES = ",".join(
    [
        "U+0020-007E",  # Basic Latin
        "U+00A0-00FF",  # Latin-1 punctuation and symbols
        "U+2000-206F",  # General punctuation
        "U+3000-303F",  # CJK symbols and punctuation
        "U+3040-309F",  # Hiragana
        "U+30A0-30FF",  # Katakana
        "U+31F0-31FF",  # Katakana phonetic extensions
        "U+FF00-FFEF",  # Halfwidth and fullwidth forms
    ]
)

APP_TEXT_GLOBS = [
    "src/app/**/*.{ts,tsx,css}",
    "src/components/**/*.{ts,tsx,css}",
    "src/lib/**/*.{ts,tsx}",
    "docs/**/*.{md,html}",
]

IGNORED_PARTS = {
    ".next",
    "node_modules",
    "artifacts",
    "public",
    "test-results",
    "playwright-report",
}


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as response:
        destination.write_bytes(response.read())


def ensure_sources(src_dir: Path, out_dir: Path) -> None:
    src_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    for filename, url in FONT_SOURCES.items():
        destination = src_dir / filename
        if destination.exists():
            continue
        print(f"download {filename}")
        download(url, destination)

    ofl_path = out_dir / "OFL.txt"
    if not ofl_path.exists():
        print("download OFL.txt")
        download(OFL_URL, ofl_path)


def app_source_files() -> list[Path]:
    files: set[Path] = set()
    for pattern in APP_TEXT_GLOBS:
        files.update(ROOT.glob(pattern))
    return sorted(
        path
        for path in files
        if path.is_file() and not any(part in IGNORED_PARTS for part in path.parts)
    )


def collect_app_text(destination: Path) -> None:
    chars: set[str] = set()
    for path in app_source_files():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        chars.update(ch for ch in text if not ch.isspace())
    destination.write_text("".join(sorted(chars)), encoding="utf-8")


def combined_text_file(
    names: list[str], app_text: Path, destination: Path, *, include_app_text: bool
) -> None:
    chars: set[str] = set(app_text.read_text(encoding="utf-8")) if include_app_text else set()
    for name in names:
        chars.update((FONT_DIR / name).read_text(encoding="utf-8"))
    destination.write_text("".join(sorted(chars)), encoding="utf-8")


def subset_font(source: Path, output: Path, text_file: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "fontTools.subset",
        str(source),
        f"--output-file={output}",
        "--flavor=woff2",
        f"--unicodes={UNICODE_RANGES}",
        f"--text-file={text_file}",
        "--layout-features=kern",
        "--no-hinting",
        "--no-recalc-timestamp",
    ]
    subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate local webfont subsets.")
    parser.add_argument("--src-dir", type=Path, default=DEFAULT_SRC_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument(
        "--no-download",
        action="store_true",
        help="Require original font files to already exist in --src-dir.",
    )
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    if args.no_download:
        missing = [name for name in FONT_SOURCES if not (args.src_dir / name).exists()]
        if missing:
            raise SystemExit(f"Missing source fonts: {', '.join(missing)}")
        if not (args.out_dir / "OFL.txt").exists():
            raise SystemExit("Missing public/fonts/OFL.txt")
    else:
        ensure_sources(args.src_dir, args.out_dir)

    build_dir = FONT_DIR / ".build"
    build_dir.mkdir(parents=True, exist_ok=True)
    app_text = build_dir / "app-text.txt"
    collect_app_text(app_text)

    for item in OUTPUTS:
        text_file = build_dir / f"{Path(item['output']).stem}.txt"
        combined_text_file(
            item["text_files"],
            app_text,
            text_file,
            include_app_text=item["include_app_text"],
        )
        subset_font(args.src_dir / item["source"], args.out_dir / item["output"], text_file)

    for item in OUTPUTS:
        path = args.out_dir / item["output"]
        print(f"{path.relative_to(ROOT)} {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
