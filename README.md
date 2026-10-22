# Prismora

A cross-language color transformation library, working toward the color math of
[CSS Color 4][CssColor4] and the mixing of [CSS Color 5][CssColor5].

## Examples

In Temper, and the same API in each [supported language](#languages):

```temper
// Channels go from 0 to 1, and hue is in turns (0 to 1), not degrees.
let red = Color.from(Space.srgb, [1.0, 0.0, 0.0]);
let lch = red.to(Space.oklch); // About 0.628, 0.258, 0.081

// Parse hex or CSS names, and format as hex.
let purple = parseNamed("rebeccapurple");
console.log(purple.toHex()[0]); // #663399

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
- Parsing hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) and CSS named colors
- Formatting as packed ints and `#rrggbb` or `#rrggbbaa` strings
- Out-of-range values kept exact through conversions
- Gamut mapping as in CSS Color 4, reducing chroma in OkLCh to fit sRGB,
  Display P3 or another RGB gamut, used for hex output, plus clamping on
  request and the deltaEOK color difference

Planned:

- Parsing other CSS formats, such as `rgb()` and `oklch()`
- Interpolation and mixing as in CSS Color 4 and 5, then grayscale and
  gradients, with defaults that match human perception

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

Run tests with [Temper][Temper], on one backend while working:

    temper test -b py

Or on all of them:

    temper test -b cpp -b csharp -b java -b js -b lua -b py -b rust

CI runs the tests on every backend for pull requests and pushes to `main`,
using Temper's nightly `dev` build. Source files in `src/` are literate
Markdown, with tests next to the code they cover.

[CssColor4]: https://www.w3.org/TR/css-color-4/
[CssColor5]: https://www.w3.org/TR/css-color-5/
[Temper]: https://temperlang.dev/
