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

TODO Default constructor to check ncols vs space.ncols.

      public static of(space: Space, values: List<Float64>): Color {
        { space, rows: { ncols: space.ncols, values } }
      }

TODO Some consistent representation for opacity?

### Convenience Access

While `rows` is public, it's sometimes nice to skip through it.

    public get(i: Int, j: Int): Float64 | Bubble { rows[i, j] }

    public at(i: Int): Float64 | Bubble { rows.at(i) }

    public get length(): Int { rows.nrows }

    public get width(): Int { rows.ncols }

### Conversion

      public map(transform: fn (Float64): Float64): Color {
        { space, rows: rows.map(transform) }
      }

      public to(space: Space): Color {
        if (space == this.space) {
          this
        } else {
          { space, rows: convert(rows, from = this.space, to = space) }
        }
      }
    }

    test("color conversions") {
      let check(name: String, y: Float64, z: Float64): Void {
        assertNear(name, y, z) { (message);; assert(false) {message} }
      }
      let srgb = Color.of(Space.srgb, [0.691, 0.139, 0.259]);
      let linear = srgb.to(Space.srgbLinear);
      assert(linear.space == Space.srgbLinear)

Might be nice to check against something like
[this color converter][AjaltConverter], but they use
[different math][AjaltLinearRgb]. These numbers are fairly close to those,
however. And we match [CSS Color Model Level 4 conversion][Css4Srgb].

      check("r", linear.at(0), 0.43527856667280590);
      check("g", linear.at(1), 0.01717585039723197);
      check("b", linear.at(2), 0.05455383078270364);
    }

It would be nice to support expanded value types and also connect with backend
matrices and so on, but this will have to do for now.

## Color Spaces

TODO How to say that we want to support identity equality on a type?

    export class Space {

This class is a simulated enum, although maybe we do want it open beyond spaces
defined in this library.

      public name: String;
      public ncols: Int;
      public toString(): String { name }

Some of the supported spaces here aren't considered by everyone to be true
separate "spaces". For example, some consider RGB and HSV just to be different
representations of the same space, but we don't make that distinction here.

      public static hsv = new Space("hsv", 3);
      public static oklab = new Space("oklab", 3);
      public static oklch = new Space("oklch", 3);
      public static srgb = new Space("srgb", 3);
      public static srgbLinear = new Space("srgbLinear", 3);
    }

## Conversion

Generic conversion functions call specific functions depending on the spaces
involved.

    export let convert(rows: Matrix, from: Space, to: Space): Matrix | Bubble {
      match (from) {
        Space.oklab -> match (to) {
          Space.oklab -> rows;
          Space.srgb -> srgbLinearToGamma(oklabToSrgbLinear(rows));
          Space.srgbLinear -> oklabToSrgbLinear(rows);
          else -> bubble();
        }
        Space.srgb -> match (to) {
          Space.oklab -> srgbLinearToOklab(srgbGammaToLinear(rows));
          Space.srgb -> rows;
          Space.srgbLinear -> srgbGammaToLinear(rows);
          else -> bubble();
        }
        Space.srgbLinear -> match (to) {
          Space.oklab -> srgbLinearToOklab(rows);
          Space.srgb -> srgbLinearToGamma(rows);
          Space.srgbLinear -> rows;
          else -> bubble();
        }
        else -> bubble();
      }
    }

## References

[AjaltConverter]: https://ajalt.github.io/colormath/converter/
[AjaltLinearRgb]: https://github.com/ajalt/colormath/blob/9ff469060467d478466315280c19d803e4dd2bcd/colormath/src/commonMain/kotlin/com/github/ajalt/colormath/model/RGBColorSpaces.kt#L109
[Css4Srgb]: https://www.w3.org/TR/css-color-4/#valdef-color-srgb
