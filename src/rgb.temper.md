# RGB Conversions

## RGB Formatting

Renders as an HTML/CSS `#rrggbb` string. For now, it gives lowercase hex,
although that could maybe change in the future.

And this technically could apply to any color space, but the format typically
means RGB.

    export let rgbUnitToString(rgb: Vec3): String {
      "#${unitToString(rgb)}"
    }

## Gamma-Corrected <-> Linear sRGB

Sources:

- https://bottosson.github.io/posts/colorwrong/#what-can-we-do%3F
- https://en.wikipedia.org/wiki/SRGB#Transformation

The Wikipedia example linearizes as part of the transformation to CIE XYZ.

    export let srgbGammaToLinear(rgb: Vec3): Vec3 {
      rgb.map { (x);; channelGammaToLinear(x) }
    }

    export let srgbLinearToGamma(rgb: Vec3): Vec3 {
      rgb.map { (x);; channelLinearToGamma(x) }
    }

    export let channelGammaToLinear(x: Float64): Float64 {
      if (x >= 0.04045) {
        ((x + 0.055) / 1.055) ** 2.4
      } else {
        x / 12.92
      }
    }

    export let channelLinearToGamma(x: Float64): Float64 {
      if (x >= 0.0031308) {
        1.055 * x ** (1.0 / 2.4) - 0.055
      } else {
        12.92 * x
      }
    }
