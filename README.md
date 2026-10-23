# Prismora

A cross-language color transformation library, working toward the color math of
[CSS Color 4][CssColor4] and the mixing of [CSS Color 5][CssColor5].

## Examples

In Temper, and the same API in each [supported language](#languages):

```temper
// Channels go from 0 to 1, and hue is in turns (0 to 1), not degrees.
let red = Color.fromList(Space.srgb, [1.0, 0.0, 0.0]);
let lch = red.convert(Space.oklch); // About 0.628, 0.258, 0.081

// Parse any CSS color, and format as hex or CSS.
let purple = Color.parse("rebeccapurple");
console.log(purple.toHex()[0]); // #663399
console.log(purple.toCss()[0]); // rgb(102 51 153)
let teal = Color.parse("oklch(65% 0.1 200 / 80%)");
console.log(teal.toHex()[0]); // #2ba1a7cc

// Many colors at once, one per row, with alpha after each row's channels.
let vivid = Color.fromAlpha(Space.oklch, [
  0.7, 0.1, 0.1, 1.0,
  0.6, 0.4, 0.75, 0.8,
]);
// Fit them into sRGB as CSS does, keeping lightness and hue.
console.log(vivid.toGamut(Space.srgb).toHex()[1]); // #4d69ffcc
```

## Status

Working now:

- Conversion between sRGB, linear sRGB, HSL, HSV, HWB, Oklab, OkLCh, Display
  P3, A98 RGB, ProPhoto RGB, Rec. 2020, XYZ (D65 and D50), CIE Lab, and CIE
  LCH, for single colors or in bulk
- Optional alpha, given and read inline with the channels in any space, and
  stored apart so conversions skip it
- Parsing CSS Color 4 syntax: hex, named colors, and `rgb()`, `hsl()`,
  `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` and `color()`, in modern
  or legacy comma syntax
- Formatting as CSS, `#rrggbb` or `#rrggbbaa` strings, and packed ints
- Out-of-range values kept exact through conversions
- Gamut mapping as in CSS Color 4, reducing chroma in OkLCh to fit sRGB,
  Display P3 or another RGB gamut, used for hex output, plus clamping on
  request and the deltaEOK color difference
- Mixing and gradients as in CSS Color 4 and 5, in Oklab by default or any
  space, with CSS's hue paths and premultiplied alpha
- Lightening, saturating, hue rotation and grayscale in OkLCh, so changes
  look even across colors
- WCAG luminance and contrast ratios

Also: a [tour](demos/README.md) of the whole API in each language, with
identical output, and a [site](site/) to try colors in the browser.

Planned:

- More demos, and a richer site
- Later: NumPy arrays for Python, CSS relative color syntax, and more color
  difference formulas

Prismora uses material from CSS Color 4 and web-platform-tests. See
[NOTICE](NOTICE).

## Languages

Being made in Temper, Prismora supports these languages automatically, and its
tests run on each:

- C++
- C\#
- Java
- JS
- Lua
- Python
- Rust

This library is also a testing ground for how well we can support specific
language needs. For example, it would be nice to support NumPy arrays of colors
out of the box for Python. This library might help figure out what Temper still
needs for things like that.

## Development

Developed primarily with AI coding (specifically Claude Code on Opus 5.5) as of
October 2026.

Run tests with [Temper][Temper], on one backend while working:

    temper test -b py

Or on all of them:

    temper test -b cpp -b csharp -b java -b js -b lua -b py -b rust

Run the API tour in every language against `temper.out/`, checking each
prints the same text (see [demos](demos/README.md)):

    uv run demos/run.py

Build and preview the site, which uses the JS backend's output, and the
Rust backend's compiled to wasm:

    temper build -b js -b rust
    rustup target add wasm32-unknown-unknown
    npm ci --prefix site
    uv run site/build.py
    python3 -m http.server -d site/build

CI runs the tests and the tour on every backend for pull requests and pushes
to `main`, using Temper's nightly `dev` build, and publishes the site from
`main`. Source files in `src/` are literate Markdown, with tests next to the
code they cover.

[CssColor4]: https://www.w3.org/TR/css-color-4/
[CssColor5]: https://www.w3.org/TR/css-color-5/
[Temper]: https://temperlang.dev/
