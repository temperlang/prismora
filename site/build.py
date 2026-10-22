# /// script
# requires-python = ">=3.11"
# ///
"""Builds Prismora's site into `site/build/`.

    temper build -b js
    uv run site/build.py
    python3 -m http.server -d site/build

Copies the page, Temper's JS output for Prismora and its runtime, and each
language's tour source, and measures the JS the page loads.
"""

import gzip
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = SITE / "build"
JS = ROOT / "temper.out" / "js"
TOUR = ROOT / "demos" / "tour"

# Each tour's source, by the extension the page asks for.
TOURS = {
    "py": "py/tour.py",
    "js": "js/tour.js",
    "java": "java/src/main/java/Tour.java",
    "cs": "csharp/Program.cs",
    "rs": "rust/src/main.rs",
    "cpp": "cpp/tour.cpp",
    "lua": "lua/tour.lua",
}


def copy(source, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest)


def sizes(name, files):
    data = b"".join(f.read_bytes() for f in files)
    return {"name": name, "raw": len(data), "gzip": len(gzip.compress(data, 9))}


def main():
    if not (JS / "prismora" / "prismora.internal.js").exists():
        raise SystemExit("Build the JS library first: temper build -b js")
    shutil.rmtree(OUT, ignore_errors=True)
    for name in ["index.html", "style.css", "app.js"]:
        copy(SITE / name, OUT / name)
    # GitHub Pages serves files as they are, without Jekyll.
    (OUT / ".nojekyll").touch()

    prismora = [JS / "prismora" / f for f in ["index.js", "prismora.js", "prismora.internal.js"]]
    core = sorted((JS / "temper-core").glob("*.js"))
    for f in prismora:
        copy(f, OUT / "lib" / "prismora" / f.name)
    for f in core:
        copy(f, OUT / "lib" / "temper-core" / f.name)
    for ext, path in TOURS.items():
        copy(TOUR / path, OUT / "tour" / f"tour.{ext}")

    measured = [sizes("Prismora", prismora), sizes("Temper's JS runtime", core)]
    (OUT / "sizes.json").write_text(json.dumps(measured, indent=2) + "\n")
    for m in measured:
        print(f"{m['name']}: {m['raw']} bytes, {m['gzip']} gzipped")
    print(f"Built {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
