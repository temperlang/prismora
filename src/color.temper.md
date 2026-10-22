# Core Types

## Color

We can represent color in many color spaces as a vector, often 3D. We also use
floats primarily for colors, so we can maintain precision.

While colorspaces often are 3D, that's not always the case, such as for
grayscale or CMYK. We might also want to operate in bulk on multiple color
values. Because of this, we store color values as `Matrix` rows. This requires
extra overhead for single colors, but frequently it's when we have a large
number of colors that we'll care more about efficiency.

Given a color, we also want to know what space it's in. Or we might have a list
of colors in the same space. But here's a single color with a defined space.

    export class Color {
      public space: Space;
      public rows: Matrix;

### Alpha

Alpha is optional, with one value per row, and null means fully opaque. So
opaque colors cost nothing extra. Alpha is straight, not premultiplied, and
like other channels, it isn't clamped until formatting.

Alpha is stored apart from `rows` because conversions never touch it, so they
stay simple and fast. To give or get alpha inline with the channels, as in
`[r, g, b, a, ...]`, use `fromAlpha` and `rowsWithAlpha` below. To give alpha
as its own list, use `withAlpha`.

      public alpha: List<Float64>?;

The number of rows, which is the number of colors.

      public length: Int;

### Construction

The constructor is private, so colors come from the factories below. That
keeps calls plain in every backend, such as Rust, where an omitted optional
list needs a typed `None`, and leaves room to change how colors are stored.
Checking here panics on mismatched shapes, like the `Matrix` constructor does.

      private constructor(space: Space, rows: Matrix, alpha: List<Float64>?) {
        if (rows.ncols != space.ncols) { panic() }
        if (alpha != null && alpha.length != rows.nrows) { panic() }
        this.space = space;
        this.rows = rows;
        this.alpha = alpha;
        this.length = rows.nrows;
      }

Opaque colors from a flat list of channels, such as `[r, g, b, r, g, b]`.

      public static from(space: Space, values: List<Float64>): Color {
        new Color(space, new Matrix(space.ncols, values), null)
      }

Opaque colors from a matrix with one color per row.

      public static fromRows(space: Space, rows: Matrix): Color {
        new Color(space, rows, null)
      }

Each row's channels followed by its alpha, as in `[r, g, b, a, r, g, b, a]`
for sRGB, in any space. Panics unless the values divide into rows.

      public static fromAlpha(space: Space, values: List<Float64>): Color {
        let ncols = space.ncols;
        let width = ncols + 1;
        if (((values.length % width) orelse panic()) != 0) { panic() }
        let channels = new ListBuilder<Float64>();
        let alpha = new ListBuilder<Float64>();
        for (var offset = 0; offset < values.length; offset += width) {
          for (var j = 0; j < ncols; j += 1) {
            channels.add(values[offset + j] orelse panic());
          }
          alpha.add(values[offset + ncols] orelse panic());
        }
        new Color(space, new Matrix(ncols, channels.toList()), alpha.toList())
      }

A copy with the given alpha, one value per row. Panics if the lengths differ.

      public withAlpha(alpha: List<Float64>): Color {
        new Color(space, rows, alpha)
      }

### Convenience Access

While `rows` is public, it's sometimes nice to skip through it.

      public get(i: Int, j: Int): Float64 throws Bubble { rows[i, j] }

      public at(i: Int): Float64 throws Bubble { rows.at(i) }

      public get width(): Int { rows.ncols }

Alpha for row `i`, which is 1 if `alpha` is null.

      public alphaAt(i: Int): Float64 throws Bubble {
        let a = alpha;
        if (a == null) {
          if (i < 0 || i >= length) { bubble() }
          1.0
        } else {
          a[i]
        }
      }

### Conversion

Both of these keep alpha as is, since `transform` applies only to channels.

      public map(transform: fn (Float64): Float64): Color {
        new Color(space, rows.map(transform), alpha)
      }

      public to(space: Space): Color throws Bubble {
        if (space == this.space) {
          this
        } else {
          new Color(space, convert(rows, this.space, space), alpha)
        }
      }

### Gamut

Converts to `space`, reducing chroma where needed to fit its gamut, while
keeping lightness and hue. See [gamut](gamut.temper.md).

      public toGamut(space: Space): Color throws Bubble {
        new Color(space, mapToGamut(this, space), alpha)
      }

Whether each row fits in the gamut of `space`.

      public inGamut(space: Space): List<Boolean> throws Bubble { inGamutRows(this, space) }

The deltaEOK color difference from each row of `other`, where about 0.02 is
just noticeable. Panics if the lengths differ.

      public deltaEOk(other: Color): List<Float64> throws Bubble { deltaEOkRows(this, other) }

### Mixing

Blends with `other` in `space`, by `amount` from 0 (all this color) to 1
(all `other`), going the shorter way around any hue. The result is in
`space`. Either color may have one row, used for every row of the other;
otherwise their lengths must match. See [mix](mix.temper.md).

      public mix(other: Color, amount: Float64, space: Space): Color throws Bubble {
        mixColors(this, other, amount, space, HueMethod.shorter)
      }

The same, with a chosen path around the hue wheel.

      public mixHue(
        other: Color, amount: Float64, space: Space, hue: HueMethod,
      ): Color throws Bubble {
        mixColors(this, other, amount, space, hue)
      }

`count` colors evenly spaced along this color's rows, used as stops, from
the first to the last, in `space`.

      public gradient(count: Int, space: Space): Color throws Bubble {
        gradientColors(this, count, space, HueMethod.shorter)
      }

      public gradientHue(count: Int, space: Space, hue: HueMethod): Color throws Bubble {
        gradientColors(this, count, space, hue)
      }

### Adjusting

Changes in OkLCh, converted back to this color's space, with alpha kept.
Results aren't clamped; use `toGamut` to show them. See
[adjust](adjust.temper.md).

Adds `amount` to OkLCh lightness, from 0 for black to 1 for white, so
negative amounts darken.

      public lighten(amount: Float64): Color throws Bubble {
        new Color(space, adjustLch(this, amount, 1.0, 0.0), alpha)
      }

Multiplies OkLCh chroma by `factor`: 0 for gray, 2 for twice as vivid.

      public saturate(factor: Float64): Color throws Bubble {
        new Color(space, adjustLch(this, 0.0, factor, 0.0), alpha)
      }

Turns hue by `turns`, so 0.5 gives the opposite hue.

      public rotateHue(turns: Float64): Color throws Bubble {
        new Color(space, adjustLch(this, 0.0, 1.0, turns), alpha)
      }

Gray with the same OkLCh lightness, like `saturate(0.0)`.

      public grayscale(): Color throws Bubble { saturate(0.0) }

### Contrast

WCAG relative luminance of each row, from 0 for black to 1 for white.

      public luminance(): List<Float64> throws Bubble { luminanceRows(this) }

WCAG contrast ratio with each row of `other`, from 1 to 21. Either may have
one row, used for every row of the other.

      public contrast(other: Color): List<Float64> throws Bubble {
        contrastRows(this, other)
      }

### CSS

Parses CSS color syntax: hex, named colors, and functions such as
`rgb()`, `hsl()`, `oklch()` and `color()`. Bubbles on anything else. See
[css](css.temper.md).

      public static parse(text: String): Color throws Bubble { parseCssColor(text) }

Each row as CSS in this color's own space, such as `oklch(0.7 0.1 180)`.

      public toCss(): List<String> throws Bubble { cssStrings(this) }

### Hex

As `#rrggbb` strings, or `#rrggbbaa` with alpha, after mapping to the sRGB
gamut, since hex is for display. Alpha is clamped when packed. See also
`parseHex`.

      public toHex(): List<String> throws Bubble {
        let rgb = toGamut(Space.srgb).rows;
        let a = alpha;
        if (a == null) {
          rgbUnitToString(rgb)
        } else {
          rgbaUnitToString(rgb, a)
        }
      }

### Channels With Alpha

Rows of this color's channels followed by alpha, in its own space and
unclamped, the reverse of `fromAlpha`. Opaque colors get alpha 1. For canvas
pixels or NumPy arrays, convert to sRGB first.

      public rowsWithAlpha(): Matrix {
        let width = rows.ncols;
        let builder = new ListBuilder<Float64>();
        for (var i = 0; i < length; i += 1) {
          for (var j = 0; j < width; j += 1) {
            builder.add(rows[i, j] orelse panic());
          }
          builder.add(alphaAt(i) orelse panic());
        }
        new Matrix(width + 1, builder.toList())
      }
    }

    test("color conversions") { test =>
      let srgb = Color.from(Space.srgb, [0.691, 0.139, 0.259]);

Might be nice to check against something like
[this color converter][AjaltConverter], but they use
[different math][AjaltLinearRgb]. These numbers are fairly close to those,
however. And we match [CSS Color Model Level 4 conversion][Css4Srgb].

      let expected = Color.from(Space.srgbLinear, [
        0.43527856667280590, 0.01717585039723197, 0.05455383078270364,
      ]);
      assertConvertColors(test, srgb, expected)
    }

### Alpha Tests

    test("alpha passes through conversion and map") {
      let source = Color.fromAlpha(Space.srgb, [
        0.2, 0.4, 0.6, 0.5,
        0.9, 0.1, 0.3, 0.25,
      ]);
      let lch = source.to(Space.oklch);
      assert(lch.alphaAt(0) == 0.5);
      assert(lch.alphaAt(1) == 0.25);
      assert(source.map { x => x * 0.5 }.alphaAt(1) == 0.25);
    }

    test("opaque alpha") {
      let opaque = Color.from(Space.srgb, [0.1, 0.2, 0.3]);
      let noAlpha = opaque.alpha == null;
      assert(noAlpha);
      assert(opaque.alphaAt(0) == 1.0);
      assert(do { opaque.alphaAt(1); false } orelse true);
    }

    test("rows with alpha round trip") { test =>
      let source = Color.fromAlpha(Space.oklab, [
        0.5, 0.1, 0.05, 0.5,
        0.8, -0.02, 0.03, 1.0,
      ]);
      let rgba = source.to(Space.srgb).rowsWithAlpha();
      assert(rgba.ncols == 4);
      assert(rgba[0, 3] == 0.5);
      let back = Color.fromAlpha(Space.srgb, rgba.toList());
      assert(back.alphaAt(0) == 0.5);
      assertColors(test, source, back.to(Space.oklab));
      assert(Color.from(Space.srgb, [0.1, 0.2, 0.3]).rowsWithAlpha()[0, 3] == 1.0);
    }

A separate alpha list goes through `withAlpha`.

    test("separate alpha list") {
      let color = Color.from(Space.srgb, [0.1, 0.2, 0.3]).withAlpha([0.75]);
      assert(color.alphaAt(0) == 0.75);
      let flat = color.rowsWithAlpha().toList();
      assert(flat.length == 4);
      assert(flat[2] == 0.3);
      assert(flat[3] == 0.75);
    }

It would be nice to support expanded value types and also connect with backend
matrices and so on, but this will have to do for now.

Spaces and conversion between them are in [convert](convert.temper.md).

## References

[AjaltConverter]: https://ajalt.github.io/colormath/converter/
[AjaltLinearRgb]: https://github.com/ajalt/colormath/blob/9ff469060467d478466315280c19d803e4dd2bcd/colormath/src/commonMain/kotlin/com/github/ajalt/colormath/model/RGBColorSpaces.kt#L109
[Css4Srgb]: https://www.w3.org/TR/css-color-4/#valdef-color-srgb
