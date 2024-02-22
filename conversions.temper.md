# Color Conversions

    class Rgb {
      public r: Float64;
      public g: Float64;
      public b: Float64;
    }

    class Xyz {
      public x: Float64;
      public y: Float64;
      public z: Float64;
    }

## Gamma-Corrected <-> Linear sRGB

Sources:

- https://bottosson.github.io/posts/colorwrong/#what-can-we-do%3F
- https://en.wikipedia.org/wiki/SRGB#Transformation

The Wikipedia example linearizes as part of the transformation to CIE XYZ.

    export let srgbGammaToLinear(rgb: Rgb): Rgb {
      {
        r: componentGammaToLinear(rgb.r),
        g: componentGammaToLinear(rgb.g),
        b: componentGammaToLinear(rgb.b),
      }
    }

    export let srgbLinearToGamma(rgb: Rgb): Rgb {
      {
        r: componentLinearToGamma(rgb.r),
        g: componentLinearToGamma(rgb.g),
        b: componentLinearToGamma(rgb.b),
      }
    }

    export let componentGammaToLinear(x: Float64): Float64 {
      if (x >= 0.04045) {
        ((x + 0.055) / 1.055) ** 2.4
      } else {
        x / 12.92
      }
    }

    export let componentLinearToGamma(x: Float64): Float64 {
      if (x >= 0.0031308) {
        1.055 * x ** (1.0 / 2.4) - 0.055
      } else {
        12.92 * x
      }
    }
