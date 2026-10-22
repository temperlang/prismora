# /// script
# requires-python = ">=3.11"
# ///
"""Runs Prismora's tour in each language and checks the output matches.

Usage, from anywhere in the repo, after building the libraries:

    temper build -b cpp -b csharp -b java -b js -b lua -b py -b rust
    uv run demos/run.py [LANGUAGE ...]

Each `demos/tour/<language>/` builds and runs with that language's usual
tools, as its README section shows; this runs the same commands. Every tour
must print exactly `demos/tour/expected.txt`. Exits non-zero on any failure.
"""

import argparse
import difflib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOUR = ROOT / "demos" / "tour"

# Commands per language, run in its directory. All but the last only build.
COMMANDS = {
    "cpp": [
        ["cmake", "-B", "build", "-DCMAKE_BUILD_TYPE=Release"],
        ["cmake", "--build", "build", "-j", "4"],
        ["./build/tour"],
    ],
    "csharp": [["dotnet", "run", "-v", "q", "--nologo"]],
    "java": [
        ["sh", "-c", "javac -nowarn -d build $(find ../../../temper.out/java/*/src/main/java -name '*.java')"],
        ["java", "-cp", "build", "Tour.java"],
    ],
    "js": [["npm", "install", "--silent", "--no-audit", "--no-fund"], ["npm", "start", "--silent"]],
    "lua": [["lua", "tour.lua"]],
    "py": [["uv", "run", "-q", "tour.py"]],
    "rust": [["cargo", "run", "-q", "--release"]],
}


def java_built(dir):
    """Whether compiled Java is newer than the generated sources, since
    compiling them all takes minutes."""
    built = dir / "build" / "prismora" / "Color.class"
    source = ROOT / "temper.out" / "java" / "prismora" / "src" / "main" / "java" / "prismora" / "Color.java"
    return built.exists() and built.stat().st_mtime > source.stat().st_mtime


def run_tour(language):
    """Builds and runs one tour, returning its output."""
    dir = TOUR / language
    for args in COMMANDS[language]:
        if language == "java" and args[0] == "sh" and java_built(dir):
            continue
        result = subprocess.run(args, cwd=dir, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"{' '.join(args)} failed:\n{result.stderr}{result.stdout}")
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("languages", nargs="*", metavar="LANGUAGE", help=", ".join(COMMANDS))
    languages = parser.parse_args().languages or list(COMMANDS)
    unknown = set(languages) - set(COMMANDS)
    if unknown:
        parser.error(f"unknown: {', '.join(sorted(unknown))}")
    expected = (TOUR / "expected.txt").read_text()
    failed = []
    for language in languages:
        try:
            actual = run_tour(language)
        except (RuntimeError, OSError) as error:
            print(f"{language}: error\n{error}")
            failed.append(language)
            continue
        if actual == expected:
            print(f"{language}: ok")
        else:
            print(f"{language}: output differs")
            diff = difflib.unified_diff(
                expected.splitlines(keepends=True),
                actual.splitlines(keepends=True),
                "expected.txt",
                language,
            )
            sys.stdout.writelines(diff)
            failed.append(language)
    if failed:
        print(f"Failed: {' '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
