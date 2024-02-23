# RGB Conversions

## Data Type

We can use a common RGB type whether for sRGB specifically or in general.

    export class Rgb {
      public r: Float64;
      public g: Float64;
      public b: Float64;
    }

## 8-Bit <-> Unit-Bounded

These take an RGB int value, such as 0x112233. This requires at least 24 bits in
the backend int representation. Can we promise that?

    export let rgbIntToUnit(rgb: Int): Rgb {

TODO Do we have bit shifting?

      let r = (rgb & 0xFF0000) / 0x10000;
      let g = (rgb & 0xFF00) / 0x100;
      let b = rgb & 0xFF;
      rgbByteToUnit({

These are safe because we controlled the bounds above.

And I do a lot of repeating myself for each channel here. I could make a
`mapRgb` function, but I'm afraid the callback will be inefficient on some
backends. On the other hand, on NumPy, just operating a 3xN array all at once
would be most efficient for channel-wise ops. This would be a case where known
array-friendly ops and a backend-connected map function might be better.

        r: r.toFloat64Unsafe(),
        g: g.toFloat64Unsafe(),
        b: b.toFloat64Unsafe(),
      })
    }

    export let rgbUnitToInt(rgb: Rgb): Int {
      let byte = rgbUnitToByte(rgb);
      let r = clampToIntByte(byte.r);
      let g = clampToIntByte(byte.g);
      let b = clampToIntByte(byte.b);

Again, bit shifting would be nice here. Maybe some backends can optimize,
anyway?

      r * 0x10000 + g * 0x100 + b
    }

    test("rgbUnitToInt top bound") {
      assert(rgbUnitToInt(new Rgb(0.0, 0.5, 1.0)) == 0x0080FF);
    }

These operate on floats rather than ints.

    export let rgbByteToUnit(rgb: Rgb): Rgb {
      {
        r: rgb.r / 255.0,
        g: rgb.g / 255.0,
        b: rgb.b / 255.0,
      }
    }

    export let rgbUnitToByte(rgb: Rgb): Rgb {
      {
        r: rgb.r * 255.0,
        g: rgb.g * 255.0,
        b: rgb.b * 255.0,
      }
    }

Presumes that `x` is known to be approximately in the 0 to 255 range already.

    export let clampToIntByte(x: Float64): Int {
      clampByte(x.round().toIntUnsafe())
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
