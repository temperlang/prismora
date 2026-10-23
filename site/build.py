# /// script
# requires-python = ">=3.11"
# ///
"""Builds Prismora's site into `site/build/`.

    temper build -b js -b rust
    rustup target add wasm32-unknown-unknown
    npm ci --prefix site
    uv run site/build.py
    python3 -m http.server -d site/build

Bundles Temper's JS output for Prismora, with the parts of Temper's runtime
it uses, into one minified module, which the page's import map names
"prismora" so the playground can import it too. Compiles the Rust tour to
wasm, so the page can run it, and builds the tours' expected output into the
page's script. Copies the page and each language's tour source, and measures
what the page loads.
"""

import gzip
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
OUT = SITE / "build"
JS = ROOT / "temper.out" / "js"
ESBUILD = SITE / "node_modules" / ".bin" / "esbuild"
TOUR = ROOT / "demos" / "tour"

# Each tour's source, by the extension the page asks for.
TOURS = {
    "cpp": "cpp/tour.cpp",
    "cs": "csharp/Program.cs",
    "java": "java/src/main/java/Tour.java",
    "js": "js/tour.js",
    "lua": "lua/tour.lua",
    "py": "py/tour.py",
    "rs": "rust/src/main.rs",
}


def copy(source, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest)


def sizes(name, files):
    data = b"".join(f.read_bytes() for f in files)
    return {"name": name, "raw": len(data), "gzip": len(gzip.compress(data, 9))}


def esbuild(*args):
    # Temper's runtime declares Pair's key and value as fields and getters;
    # that's in notes for Temper, and harmless here.
    quiet = "--log-override:duplicate-class-member=silent"
    subprocess.run([ESBUILD, "--log-level=warning", quiet, "--format=esm", "--target=es2022", "--minify", *args], check=True)


def main():
    if not (JS / "prismora" / "prismora.internal.js").exists():
        raise SystemExit("Build the JS library first: temper build -b js")
    if not ESBUILD.exists():
        raise SystemExit("Install esbuild first: (cd site && npm ci)")
    shutil.rmtree(OUT, ignore_errors=True)
    for name in ["index.html", "style.css"]:
        copy(SITE / name, OUT / name)
    # GitHub Pages serves files as they are, without Jekyll.
    (OUT / ".nojekyll").touch()

    bundle = OUT / "lib" / "prismora.js"
    esbuild(
        JS / "prismora" / "index.js",
        "--bundle",
        f"--alias:@temperlang/core={JS / 'temper-core' / 'index.js'}",
        f"--outfile={bundle}",
    )
    expected = json.dumps((TOUR / "expected.txt").read_text())
    esbuild(
        SITE / "app.js",
        "--bundle",
        "--external:prismora",
        f"--define:TOUR_EXPECTED={expected}",
        f"--outfile={OUT / 'app.js'}",
    )
    for ext, path in TOURS.items():
        copy(TOUR / path, OUT / "tour" / f"tour.{ext}")

    wasm_dir = SITE / "wasm"
    subprocess.run(["cargo", "build", "-q", "--release", "--target", "wasm32-unknown-unknown"], cwd=wasm_dir, check=True)
    wasm = OUT / "tour" / "tour.wasm"
    copy(wasm_dir / "target" / "wasm32-unknown-unknown" / "release" / "prismora_tour_wasm.wasm", wasm)

    # Unbundled, for comparison: what the page would load without esbuild.
    prismora = [JS / "prismora" / f for f in ["index.js", "prismora.js", "prismora.internal.js"]]
    core = sorted((JS / "temper-core").glob("*.js"))
    measured = [
        sizes("Prismora with the runtime it uses, bundled and minified", [bundle]),
        sizes("Unbundled, for comparison: Prismora and all of Temper's JS runtime", prismora + core),
        sizes("The Rust tour as wasm, with Prismora compiled in", [wasm]),
    ]
    (OUT / "sizes.json").write_text(json.dumps(measured, indent=2) + "\n")

    # Each reference gets its file's hash, so browsers fetch changed files
    # instead of reusing cached ones.
    page = OUT / "index.html"
    html = page.read_text()
    for ref in ["style.css", "app.js", "./lib/prismora.js"]:
        digest = hashlib.sha256((OUT / ref).read_bytes()).hexdigest()[:10]
        html = html.replace(f'"{ref}"', f'"{ref}?v={digest}"')
    page.write_text(html)
    for m in measured:
        print(f"{m['name']}: {m['raw']} bytes, {m['gzip']} gzipped")
    print(f"Built {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
