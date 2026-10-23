# Demos

## Tour

`tour/` walks through Prismora's whole public API in each supported
language: making and parsing colors, converting between spaces, formatting,
gamut mapping, mixing, adjusting, contrast, and the `Matrix` underneath. Every
version prints the same text, `tour/expected.txt`, so the tours double as a
cross-language test.

First build the libraries from the repo's top, with
[Temper](https://temperlang.dev/):

    temper build -b cpp -b csharp -b java -b js -b lua -b py -b rust

Each tour uses the generated library in `temper.out/` by relative path. Run
one from its directory:

| Language | In `tour/…` | Commands |
|---|---|---|
| C++ | `cpp` | `cmake -B build && cmake --build build && ./build/tour` |
| C# | `csharp` | `dotnet run` |
| Java | `java` | `./gradlew run` |
| JS | `js` | `npm ci && npm start` |
| Lua | `lua` | `lua -l paths tour.lua` |
| Python | `py` | `uv run tour.py` |
| Rust | `rust` | `cargo run` |

Or run them all and compare each with `expected.txt`:

    uv run demos/run.py [LANGUAGE ...]

Java's Gradle build compiles the generated sources along with the tour,
because the generated Maven projects expect a JDK 8 toolchain and release
signing.
