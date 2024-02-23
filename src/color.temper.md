# Core Types

## Color

We can represent color in many color spaces as a 3D vector. We also use floats
primarily for colors, so we can maintain precision.

We don't call the type `Xyz`, even though those are the property names, because
some color spaces are explicitly called XYZ. And note that this is a
general-purpose 3D vector, separate from any notion of color.

    export class Vec3 {

These channels/components might be rgb, lab, lch, hsv, or otherwise.

      public x: Float64;
      public y: Float64;
      public z: Float64;

Convenience for channel-wise operations. Backends that can't inline this might
have performance hurt, so it might be nice to make this inlined or macro in
Temper sometime.

      public map(transform: fn (Float64): Float64): Vec3 {
        { x: transform(x), y: transform(y), z: transform(z) }
      }
    }

We don't currently have opacity/alpha, but we might ought to extend to that
generally, even though it's not directly interesting in color space conversion.

Given a color, we also want to know what space it's in. Or we might have a list
of colors in the same space. But here's a single color with a defined space.

    export class Color {
      public space: Space;
      public vec: Vec3;

      public map(transform: fn (Float64): Float64): Color {
        { space, vec: vec.map(transform) }
      }

      public to(space: Space): Color {
        if (space == this.space) {
          this
        } else {
          { space, vec: convert(vec, from = this.space, to = space) }
        }
      }
    }

    test("color conversions") {
      let check(name: String, y: Float64, z: Float64): Void {
        assertNear(name, y, z) { (message);; assert(false) {message} }
      }
      let srgb = new Vec3(0.691, 0.139, 0.259);
      let linear = new Color(Spaces.srgb, srgb).to(Spaces.srgbLinear);
      assert(linear.space == Spaces.srgbLinear)

Might be nice to check against something like
[this color converter][AjaltConverter], but they use
[different math][AjaltLinearRgb]. These numbers are fairly close to those,
however. And we match [CSS Color Model Level 4 conversion][Css4Srgb].

      check("r", linear.vec.x, 0.43527856667280590);
      check("g", linear.vec.y, 0.01717585039723197);
      check("b", linear.vec.z, 0.05455383078270364);
    }

It would be nice to support expanded value types and also connect with backend
matrices and so on, but this will have to do for now.

## Color Spaces

TODO How to say that we want to support identity equality on a type?

    export class Space {

This class is a simulated enum, although maybe we do want it open beyond spaces
defined in this library.

      public name: String;
      public toString(): String { name }

We can't actually define static instances here because we generate broken
Python, at least. Haven't checked all backends.

    }

Some of the supported spaces here aren't considered by everyone to be true
separate "spaces". For example, some consider RGB and HSV just to be different
representations of the same space, but we don't make that distinction here.

Anyway, put our instances in a separate type for now, per our conversion
problems mentioned above.

    export class Spaces {

We don't actually make constructors private yet, but pretend we can.

      private constructor() {}

And here are our currently defined color spaces.

      public static hsv = new Space("hsv");
      public static oklab = new Space("oklab");
      public static oklch = new Space("oklch");
      public static srgb = new Space("srgb");
      public static srgbLinear = new Space("srgbLinear");
    }

## Conversion

Generic conversion functions call specific functions depending on the spaces
involved.

    export let convert(vec: Vec3, from: Space, to: Space): Vec3 | Bubble {
      match (from) {
        Spaces.oklab -> match (to) {
          Spaces.oklab -> vec;
          Spaces.srgb -> srgbLinearToGamma(oklabToLinearSrgb(vec));
          Spaces.srgbLinear -> oklabToLinearSrgb(vec);
          else -> bubble();
        }
        Spaces.srgb -> match (to) {
          Spaces.oklab -> linearSrgbToOklab(srgbGammaToLinear(vec));
          Spaces.srgb -> vec;
          Spaces.srgbLinear -> srgbGammaToLinear(vec);
          else -> bubble();
        }
        Spaces.srgbLinear -> match (to) {
          Spaces.oklab -> linearSrgbToOklab(vec);
          Spaces.srgb -> srgbLinearToGamma(vec);
          Spaces.srgbLinear -> vec;
          else -> bubble();
        }
        else -> bubble();
      }
    }

## References

[AjaltConverter]: https://ajalt.github.io/colormath/converter/
[AjaltLinearRgb]: https://github.com/ajalt/colormath/blob/9ff469060467d478466315280c19d803e4dd2bcd/colormath/src/commonMain/kotlin/com/github/ajalt/colormath/model/RGBColorSpaces.kt#L109
[Css4Srgb]: https://www.w3.org/TR/css-color-4/#valdef-color-srgb
