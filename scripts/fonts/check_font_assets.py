from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
except ModuleNotFoundError as error:
    raise SystemExit(
        "fonttools is required. Run: python -m pip install --user fonttools brotli"
    ) from error


ROOT = Path(__file__).resolve().parents[2]
FONT_DIR = ROOT / "public" / "fonts"
LAYOUT_PATH = ROOT / "src" / "app" / "layout.tsx"
KLEE_GLYPHS_PATH = Path(__file__).resolve().parent / "klee-one-glyphs.txt"

FONT_ASSETS = (
    ("klee-one-400-subset.woff2", 400),
    ("klee-one-600-subset.woff2", 600),
    ("zen-kaku-gothic-new-400-subset.woff2", 400),
    ("zen-kaku-gothic-new-500-subset.woff2", 500),
)

ZEN_REQUIRED_COPY = """
設定
今夜の4枚
「とどいた」に残す1枚をえらんでください
この1枚を残す
今回はどの写真も保存しない
Googleでログイン
利用規約
プライバシーポリシー
"""


def font_codepoints(font: TTFont) -> set[int]:
    return {
        codepoint
        for table in font["cmap"].tables
        for codepoint in table.cmap
    }


def display_characters() -> set[str]:
    return {
        character
        for character in KLEE_GLYPHS_PATH.read_text(encoding="utf-8")
        if not character.isspace()
    }


def ui_characters() -> set[str]:
    return {character for character in ZEN_REQUIRED_COPY if not character.isspace()}


def format_missing(characters: set[str]) -> str:
    return ", ".join(
        f"U+{ord(character):04X} {character}" for character in sorted(characters)
    )


def check_layout_registration(layout_text: str, filename: str, weight: int) -> str | None:
    pattern = re.compile(
        rf"path:\s*[\"']\.\./\.\./public/fonts/{re.escape(filename)}[\"']"
        rf"[\s\S]{{0,180}}?weight:\s*[\"']{weight}[\"']"
    )
    if pattern.search(layout_text):
        return None
    return f"layout.tsx does not register {filename} at weight {weight}"


def main() -> None:
    failures: list[str] = []
    layout_text = LAYOUT_PATH.read_text(encoding="utf-8")
    required_display_characters = display_characters()
    required_ui_characters = ui_characters()

    for filename, expected_weight in FONT_ASSETS:
        path = FONT_DIR / filename
        if not path.exists():
            failures.append(f"missing font asset: {path.relative_to(ROOT)}")
            continue

        try:
            font = TTFont(path)
        except Exception as error:  # pragma: no cover - diagnostic path
            failures.append(f"cannot read {filename}: {error}")
            continue

        actual_weight = int(font["OS/2"].usWeightClass)
        if actual_weight != expected_weight:
            failures.append(
                f"{filename} has weight {actual_weight}; expected {expected_weight}"
            )

        layout_failure = check_layout_registration(
            layout_text,
            filename,
            expected_weight,
        )
        if layout_failure:
            failures.append(layout_failure)

        if filename.startswith("klee-one-"):
            cmap = font_codepoints(font)
            missing = {
                character
                for character in required_display_characters
                if ord(character) not in cmap
            }
            if missing:
                failures.append(
                    f"{filename} is missing display glyphs: {format_missing(missing)}"
                )
        elif filename.startswith("zen-kaku-gothic-new-"):
            cmap = font_codepoints(font)
            missing = {
                character
                for character in required_ui_characters
                if ord(character) not in cmap
            }
            if missing:
                failures.append(
                    f"{filename} is missing UI glyphs: {format_missing(missing)}"
                )

    if failures:
        print("Font asset check failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        raise SystemExit(1)

    print("Font assets, weights, layout registration, and required glyphs are aligned.")


if __name__ == "__main__":
    main()
