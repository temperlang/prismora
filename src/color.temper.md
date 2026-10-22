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

Alpha is separate from `rows` because conversions never touch it, so they stay
simple and fast. For interleaved RGBA, such as canvas pixels or NumPy arrays,
see `toRgba` and `fromRgba` below.

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

      public static fromAlpha(
        space: Space,
        values: List<Float64>,
        alpha: List<Float64>,
      ): Color {
        { space, rows: { ncols: space.ncols, values }, alpha }
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

### Hex

As `#rrggbb` strings, or `#rrggbbaa` with alpha, after converting to sRGB.
Channels are clamped when packed. See also `parseHex`.

      public toHex(): List<String> throws Bubble {
        let rgb = to(Space.srgb).rows;
        let a = alpha;
        if (a == null) {
          rgbUnitToString(rgb)
        } else {
          rgbaUnitToString(rgb, a)
        }
      }

### Interleaved RGBA

As sRGB rows of red, green, blue, and alpha, all from 0 to 1, but unclamped.
Opaque colors get alpha 1.

      public toRgba(): Matrix throws Bubble {
        let rgb = to(Space.srgb).rows;
        let builder = new ListBuilder<Float64>();
        for (var i = 0; i < length; i += 1) {
          let offset = i * 3;
          builder.add(rgb.at(offset));
          builder.add(rgb.at(offset + 1));
          builder.add(rgb.at(offset + 2));
          builder.add(alphaAt(i));
        }
        new Matrix(4, builder.toList())
      }

Panics unless `rgba` has 4 columns.

      public static fromRgba(rgba: Matrix): Color {
        if (rgba.ncols != 4) { panic() }
        let rgb = new ListBuilder<Float64>();
        let alpha = new ListBuilder<Float64>();
        for (var i = 0; i < rgba.nrows; i += 1) {
          let offset = i * 4;
          rgb.add(rgba.at(offset) orelse panic());
          rgb.add(rgba.at(offset + 1) orelse panic());
          rgb.add(rgba.at(offset + 2) orelse panic());
          alpha.add(rgba.at(offset + 3) orelse panic());
        }
        { space: Space.srgb, rows: new Matrix(3, rgb.toList()), alpha: alpha.toList() }
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
      let source = Color.fromAlpha(
        Space.srgb, [0.2, 0.4, 0.6, 0.9, 0.1, 0.3], [0.5, 0.25],
      );
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

    test("rgba round trip") { test =>
      let source = Color.fromAlpha(
        Space.oklab, [0.5, 0.1, 0.05, 0.8, -0.02, 0.03], [0.5, 1.0],
      );
      let rgba = source.toRgba();
      assert(rgba.ncols == 4);
      assert(rgba[0, 3] == 0.5);
      let back = Color.fromRgba(rgba);
      assert(back.space == Space.srgb);
      assert(back.alphaAt(0) == 0.5);
      assertColors(test, source, back.to(Space.oklab));
      assert(Color.from(Space.srgb, [0.1, 0.2, 0.3]).toRgba()[0, 3] == 1.0);
    }

It would be nice to support expanded value types and also connect with backend
matrices and so on, but this will have to do for now.

Spaces and conversion between them are in [convert](convert.temper.md).

## References

[AjaltConverter]: https://ajalt.github.io/colormath/converter/
[AjaltLinearRgb]: https://github.com/ajalt/colormath/blob/9ff469060467d478466315280c19d803e4dd2bcd/colormath/src/commonMain/kotlin/com/github/ajalt/colormath/model/RGBColorSpaces.kt#L109
[Css4Srgb]: https://www.w3.org/TR/css-color-4/#valdef-color-srgb
