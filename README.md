# Prismora

A cross-language color transformation library, working toward the color math of
[CSS Color 4][CssColor4] and the mixing of [CSS Color 5][CssColor5].

## Status

Working now:

- Conversion between sRGB, linear sRGB, HSL, HSV, HWB, Oklab, OkLCh, Display
  P3, A98 RGB, ProPhoto RGB, Rec. 2020, XYZ (D65 and D50), CIE Lab, and CIE
  LCH, for single colors or in bulk
- Optional alpha, kept separate from color channels, with interleaved RGBA in
  and out
- Parsing hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) and CSS named colors
- Formatting as packed ints and `#rrggbb` or `#rrggbbaa` strings
- Out-of-range values kept exact through conversions, with clamping when
  packing or on request
- Gamut mapping as in CSS Color 4, reducing chroma in OkLCh to fit sRGB,
  Display P3 or another RGB gamut, plus the deltaEOK color difference

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

And on all of them before a pull request:

    temper test -b cpp -b csharp -b java -b js -b lua -b py -b rust

CI runs the tests on every backend for pull requests and pushes to `main`,
using Temper's nightly `dev` build.

[CssColor4]: https://www.w3.org/TR/css-color-4/
[CssColor5]: https://www.w3.org/TR/css-color-5/
[Temper]: https://temperlang.dev/
