# RGB Conversions

## 8-Bit <-> Unit-Bounded

These take an RGB int value, such as 0x112233. This requires at least 24 bits in
the backend int representation. Can we promise that?

    export let rgbIntToUnit(rgb: Int): Vec3 {

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

        x: r.toFloat64Unsafe(),
        y: g.toFloat64Unsafe(),
        z: b.toFloat64Unsafe(),
      })
    }

    export let rgbUnitToInt(rgb: Vec3): Int {
      let byte = rgbUnitToByte(rgb);
      let r = clampToIntByte(byte.x);
      let g = clampToIntByte(byte.y);
      let b = clampToIntByte(byte.z);

Again, bit shifting would be nice here. Maybe some backends can optimize,
anyway?

      r * 0x10000 + g * 0x100 + b
    }

Renders as an HTML/CSS `#rrggbb` string. For now, it gives lowercase hex,
although that could maybe change in the future.

    export let rgbUnitToString(rgb: Vec3): String {
      "#${padLeft(rgbUnitToInt(rgb).toString(16), 6, "0")}"
    }

    test("rgbUnitToInt top bound and left pad") {
      let rgb = new Vec3(0.0, 0.5, 1.0);
      assert(rgbUnitToInt(rgb) == 0x0080ff);
      assert(rgbUnitToString(rgb) == "#0080ff");
    }

These operate on floats rather than ints.

    export let rgbByteToUnit(rgb: Vec3): Vec3 {
      {
        x: rgb.x / 255.0,
        y: rgb.y / 255.0,
        z: rgb.z / 255.0,
      }
    }

    export let rgbUnitToByte(rgb: Vec3): Vec3 {
      {
        x: rgb.x * 255.0,
        y: rgb.y * 255.0,
        z: rgb.z * 255.0,
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

    export let srgbGammaToLinear(rgb: Vec3): Vec3 {
      {
        x: channelGammaToLinear(rgb.x),
        y: channelGammaToLinear(rgb.y),
        z: channelGammaToLinear(rgb.z),
      }
    }

    export let srgbLinearToGamma(rgb: Vec3): Vec3 {
      {
        x: channelLinearToGamma(rgb.x),
        y: channelLinearToGamma(rgb.y),
        z: channelLinearToGamma(rgb.z),
      }
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
