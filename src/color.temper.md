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

Alpha is optional. When `hasAlpha` is true, `rows` has one more column than the
space has channels, with alpha last, as in interleaved RGBA. So a color with
alpha is a single list, and sRGB with alpha is ready for canvas pixels or NumPy
without copying. Alpha is straight, not premultiplied, and like other channels,
it isn't clamped until formatting. Conversions pass it through unchanged.

      public hasAlpha: Boolean = false,
    ) {

Checking here panics on mismatched shapes, like the `Matrix` constructor does.

      public length: Int = do {
        let expected = if (hasAlpha) { space.ncols + 1 } else { space.ncols };
        if (rows.ncols != expected) { panic() }
        rows.nrows
      };

With `hasAlpha`, `values` has alpha after each color's channels.

      public static from(
        space: Space,
        values: List<Float64>,
        hasAlpha: Boolean = false,
      ): Color {
        let ncols = if (hasAlpha) { space.ncols + 1 } else { space.ncols };
        { space, rows: { ncols, values }, hasAlpha }
      }

### Convenience Access

While `rows` is public, it's sometimes nice to skip through it.

      public get(i: Int, j: Int): Float64 throws Bubble { rows[i, j] }

      public at(i: Int): Float64 throws Bubble { rows.at(i) }

Columns per row, including alpha if present.

      public get width(): Int { rows.ncols }

Alpha for row `i`, which is 1 without `hasAlpha`.

      public alphaAt(i: Int): Float64 throws Bubble {
        if (hasAlpha) {
          rows[i, space.ncols]
        } else {
          if (i < 0 || i >= length) { bubble() }
          1.0
        }
      }

### Conversion

Both of these keep alpha as is, since `transform` applies only to channels.

      public map(transform: fn (Float64): Float64): Color {
        { space, rows: rows.mapChannels(space.ncols, transform), hasAlpha }
      }

      public to(space: Space): Color throws Bubble {
        if (space == this.space) {
          this
        } else {
          { space, rows: convert(rows, this.space, space), hasAlpha }
        }
      }

### Interleaved RGBA

As sRGB rows of red, green, blue, and alpha, all from 0 to 1, but unclamped.
For sRGB with alpha, these just return or wrap the same rows without copying.
Opaque colors get alpha 1.

      public toRgba(): Matrix throws Bubble {
        let rgb = to(Space.srgb).rows;
        if (hasAlpha) {
          return rgb;
        }
        let builder = new ListBuilder<Float64>();
        for (var i = 0; i < length; i += 1) {
          let offset = i * 3;
          builder.add(rgb.at(offset));
          builder.add(rgb.at(offset + 1));
          builder.add(rgb.at(offset + 2));
          builder.add(1.0);
        }
        new Matrix(4, builder.toList())
      }

Panics unless `rgba` has 4 columns.

      public static fromRgba(rgba: Matrix): Color {
        { space: Space.srgb, rows: rgba, hasAlpha: true }
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
      let source = Color.from(
        Space.srgb, [0.2, 0.4, 0.6, 0.5, 0.9, 0.1, 0.3, 0.25], true,
      );
      let lch = source.to(Space.oklch);
      assert(lch.alphaAt(0) == 0.5);
      assert(lch.alphaAt(1) == 0.25);
      assert(source.map { x => x * 0.5 }.alphaAt(1) == 0.25);
    }

    test("opaque alpha") {
      let opaque = Color.from(Space.srgb, [0.1, 0.2, 0.3]);
      assert(!opaque.hasAlpha);
      assert(opaque.alphaAt(0) == 1.0);
      assert(do { opaque.alphaAt(1); false } orelse true);
    }

    test("rgba round trip") { test =>
      let source = Color.from(
        Space.oklab, [0.5, 0.1, 0.05, 0.5, 0.8, -0.02, 0.03, 1.0], true,
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
