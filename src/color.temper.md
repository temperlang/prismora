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

    export class Color(
      public space: Space,
      public rows: Matrix,

### Alpha

Alpha is optional, with one value per row, and null means fully opaque. So
opaque colors cost nothing extra. Alpha is straight, not premultiplied, and
like other channels, it isn't clamped until formatting.

Alpha is stored apart from `rows` because conversions never touch it, so they
stay simple and fast. To give or get alpha inline with the channels, as in
`[r, g, b, a, ...]`, use `fromAlpha` and `rowsWithAlpha` below. To give alpha
as its own list, use the constructor, as in
`new Color(space, new Matrix(3, values), alpha)`.

      public alpha: List<Float64>? = null,
    ) {

Checking here panics on mismatched shapes, like the `Matrix` constructor does.

      public length: Int = do {
        if (rows.ncols != space.ncols) { panic() }
        let a = alpha;
        if (a != null && a.length != rows.nrows) { panic() }
        rows.nrows
      };

Separate factories rather than an optional `alpha` argument keep calls plain in
every backend, such as Rust, where an omitted optional list needs a typed
`None`.

      public static from(space: Space, values: List<Float64>): Color {
        { space, rows: { ncols: space.ncols, values } }
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
        { space, rows: { ncols, values: channels.toList() }, alpha: alpha.toList() }
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
        { space, rows: rows.map(transform), alpha }
      }

      public to(space: Space): Color throws Bubble {
        if (space == this.space) {
          this
        } else {
          { space, rows: convert(rows, this.space, space), alpha }
        }
      }

### Gamut

Converts to `space`, reducing chroma where needed to fit its gamut, while
keeping lightness and hue. See [gamut](gamut.temper.md).

      public toGamut(space: Space): Color throws Bubble { mapToGamut(this, space) }

Whether each row fits in the gamut of `space`.

      public inGamut(space: Space): List<Boolean> throws Bubble { inGamutRows(this, space) }

The deltaEOK color difference from each row of `other`, where about 0.02 is
just noticeable. Panics if the lengths differ.

      public deltaEOk(other: Color): List<Float64> throws Bubble { deltaEOkRows(this, other) }

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

A separate alpha list still works through the constructor.

    test("separate alpha list") {
      let color = new Color(Space.srgb, new Matrix(3, [0.1, 0.2, 0.3]), [0.75]);
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
