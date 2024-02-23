# Core Types

## Color

We can represent color in many color spaces as a 3D vector. We also use floats
primarily for colors, so we can maintain precision.

We don't call the type `Xyz`, even though those are the property names, because
some color spaces are explicitly called XYZ.

    export class Vec3 {

These components might be rgb, lab, lch, hsv, or otherwise.

      public x: Float64;
      public y: Float64;
      public z: Float64;
    }

We don't currently have opacity/alpha, but we might ought to extend to that
generally, even though it's not directly interesting in color space conversion.

Given a color, we also want to know what space it's in. Or we might have a list
of colors in the same space. But here's a single color with a defined space.

    export class Color {
      public space: Space;
      public vec: Vec3;
    }

It would be nice to support expanded value types and also connect with backend
matrices and so on, but this will have to do for now.

## Color Spaces

TODO How to say that we want to support identity equality on a type?

    export class Space {

This class is a simulated enum, although maybe we do want it open beyond spaces
defined in this library.

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

      public static hsv = new Space();
      public static oklab = new Space();
      public static oklch = new Space();
      public static srgb = new Space();
      public static srgbLinear = new Space();
    }
