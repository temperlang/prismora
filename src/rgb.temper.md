# RGB Conversions

## RGB Formatting

Renders as an HTML/CSS `#rrggbb` string, or `#rrggbbaa` if `rgb` has a fourth
column for alpha. For now, it gives lowercase hex, although that could maybe
change in the future. Like the color channels, alpha is clamped when packed.

And this technically could apply to any color space, but the format typically
means RGB.

TODO Support css rendering of all spaces?

    export let rgbUnitToString(rgb: Matrix): List<String> {
      let hexes = unitToString(rgb);
      if (rgb.ncols < 4) {
        return hexes.map { (it): String => "#${it}" };
      }
      let builder = new ListBuilder<String>();
      for (var i = 0; i < hexes.length; i += 1) {
        let alpha = rgb.at(i * rgb.ncols + 3) orelse panic();
        let alphaByte = clampToIntByte(alpha * 255.0);
        let alphaHex = padLeft(alphaByte.toString(16), 2, "0");
        builder.add("#${hexes[i] orelse panic()}${alphaHex}");
      }
      builder.toList()
    }

    test("rgbUnitToString with and without alpha") {
      let rgb = new Matrix(3, [0.0, 0.5, 1.0, 1.0, 1.0, 1.0]);
      assert(rgbUnitToString(rgb)[0] == "#0080ff");
      let rgba = new Matrix(4, [0.0, 0.5, 1.0, 0.5, 1.0, 1.0, 1.0, 2.0]);
      let withAlpha = rgbUnitToString(rgba);
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
      rgb.mapChannels(3) { x => channelGammaToLinear(x) }
    }

    export let srgbLinearToGamma(rgb: Matrix): Matrix {
      rgb.mapChannels(3) { x => channelLinearToGamma(x) }
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
