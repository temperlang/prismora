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
    ) {

TODO Default constructor to check ncols vs space.ncols.

      public static from(space: Space, values: List<Float64>): Color {
        { space, rows: { ncols: space.ncols, values } }
      }

TODO Some consistent representation for opacity?

### Convenience Access

While `rows` is public, it's sometimes nice to skip through it.

      public get(i: Int, j: Int): Float64 throws Bubble { rows[i, j] }

      public at(i: Int): Float64 throws Bubble { rows.at(i) }

      public get length(): Int { rows.nrows }

      public get width(): Int { rows.ncols }

### Conversion

      public map(transform: fn (Float64): Float64): Color {
        { space, rows: rows.map(transform) }
      }

      public to(space: Space): Color throws Bubble {
        if (space == this.space) {
          this
        } else {
          { space, rows: convert(rows, this.space, space) }
        }
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

It would be nice to support expanded value types and also connect with backend
matrices and so on, but this will have to do for now.

Spaces and conversion between them are in [convert](convert.temper.md).

## References

[AjaltConverter]: https://ajalt.github.io/colormath/converter/
[AjaltLinearRgb]: https://github.com/ajalt/colormath/blob/9ff469060467d478466315280c19d803e4dd2bcd/colormath/src/commonMain/kotlin/com/github/ajalt/colormath/model/RGBColorSpaces.kt#L109
[Css4Srgb]: https://www.w3.org/TR/css-color-4/#valdef-color-srgb
