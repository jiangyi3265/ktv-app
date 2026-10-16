"""Build a small OFL-licensed Noto Sans SC subset for the 22-screen H5 review."""
from pathlib import Path
import argparse
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("source", help="Path to NotoSansSC-VF.ttf from the Noto distribution")
args = parser.parse_args()
characters = set(chr(i) for i in range(32, 127))
for folder in ("views", "components", "common", "pages"):
    for source in (root / folder).rglob("*"):
        if source.suffix in (".vue", ".js", ".mjs"):
            characters.update(source.read_text(encoding="utf-8"))
font = TTFont(args.source)
options = subset.Options()
options.flavor = "woff2"
options.name_IDs = ["*"]
options.name_legacy = True
options.name_languages = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text="".join(sorted(characters)))
subsetter.subset(font)
for record in font["name"].names:
    replacement = {1: "KTV UI Sans", 4: "KTV UI Sans", 6: "KTVUISans", 16: "KTV UI Sans"}.get(record.nameID)
    if replacement:
        record.string = replacement.encode(record.getEncoding())
font.flavor = "woff2"
target = root / "static/fonts/ktv-ui-sans.woff2"
target.parent.mkdir(parents=True, exist_ok=True)
font.save(target)
print(f"Saved {target.name}: {target.stat().st_size} bytes, {len(characters)} source characters")
