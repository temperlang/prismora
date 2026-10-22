# RGB Conversions

## RGB Formatting

Renders as an HTML/CSS `#rrggbb` string. For now, it gives lowercase hex,
although that could maybe change in the future.

And this technically could apply to any color space, but the format typically
means RGB.

TODO Support css rendering of all spaces?

    export let rgbUnitToString(rgb: Matrix): List<String> {
      unitToString(rgb).map { (it): String => "#${it}" }
    }

Or as `#rrggbbaa`, with one alpha value per row. Like the color channels,
alpha is clamped when packed.

    export let rgbaUnitToString(rgb: Matrix, alpha: List<Float64>): List<String> {
      let hexes = unitToString(rgb);
      if (alpha.length != hexes.length) { panic() }
      let builder = new ListBuilder<String>();
      for (var i = 0; i < hexes.length; i += 1) {
        let alphaByte = clampToIntByte((alpha[i] orelse panic()) * 255.0);
        let alphaHex = padLeft(alphaByte.toString(16), 2, "0");
        builder.add("#${hexes[i] orelse panic()}${alphaHex}");
      }
      builder.toList()
    }

    test("rgb and rgba unit to string") {
      let rgb = new Matrix(3, [0.0, 0.5, 1.0, 1.0, 1.0, 1.0]);
      assert(rgbUnitToString(rgb)[0] == "#0080ff");
      let withAlpha = rgbaUnitToString(rgb, [0.5, 2.0]);
      assert(withAlpha[0] == "#0080ff80");
      assert(withAlpha[1] == "#ffffffff");
    }

## Gamma-Corrected <-> Linear sRGB

Sources:

- https://bottosson.github.io/posts/colorwrong/#what-can-we-do%3F
- https://en.wikipedia.org/wiki/SRGB#Transformation
- https://www.w3.org/TR/css-color-4/#valdef-color-srgb

The Wikipedia example linearizes as part of the transformation to CIE XYZ.

    export let srgbGammaToLinear(rgb: Matrix): Matrix {
      rgb.map { x => channelGammaToLinear(x) }
    }

    export let srgbLinearToGamma(rgb: Matrix): Matrix {
      rgb.map { x => channelLinearToGamma(x) }
    }

    export let channelGammaToLinear(x: Float64): Float64 {
      if (x >= 0.04045) {
        (((x + 0.055) / 1.055) orelse panic()) ** 2.4
      } else {
        (x / 12.92) orelse panic()
      }
    }

    export let channelLinearToGamma(x: Float64): Float64 {
      if (x >= 0.0031308) {
        1.055 * x ** (1.0 / 2.4) - 0.055
      } else {
        12.92 * x
      }
    }
