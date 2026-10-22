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

## Hex Parsing

Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` into an sRGB color, with alpha
only if given. The `#` is optional, and digits are case-insensitive. Anything
else bubbles.

    export let parseHex(text: String): Color throws Bubble {
      let digits = new ListBuilder<Int>();
      var i = String.begin;
      let end = text.end;
      if (i < end && text[i] == HASH) {
        i = text.next(i);
      }
      for (; i < end; i = text.next(i)) {
        digits.add(hexDigit(text[i]));
      }
      let count = digits.length;
      let short = count == 3 || count == 4;
      if (!short && count != 6 && count != 8) {
        bubble();
      }
      let channels = new ListBuilder<Float64>();
      let nchannels = if (short) { count } else { count / 2 };
      for (var c = 0; c < nchannels; c += 1) {
        let byte = if (short) {
          digits[c] * 17
        } else {
          digits[2 * c] * 16 + digits[2 * c + 1]
        };
        channels.add(byte.toFloat64() / 255.0);
      }
      let values = channels.toList();
      if (nchannels == 4) {
        Color.fromAlpha(Space.srgb, values.slice(0, 3), [values[3]])
      } else {
        Color.from(Space.srgb, values)
      }
    }

Code points for `#`, `0`, `9`, `A`, `F`, `a` and `f`.

    let HASH = 35;

    let hexDigit(codePoint: Int): Int throws Bubble {
      if (codePoint >= 48 && codePoint <= 57) {
        codePoint - 48
      } else if (codePoint >= 65 && codePoint <= 70) {
        codePoint - 55
      } else if (codePoint >= 97 && codePoint <= 102) {
        codePoint - 87
      } else {
        bubble()
      }
    }

    test("parseHex") { test =>
      let six = parseHex("#0080ff");
      assertNear(test, "green", six[0, 1], 128.0 / 255.0);
      let opaque = six.alpha == null;
      assert(opaque);
      let short = parseHex("F80c");
      assertNear(test, "short green", short[0, 1], 136.0 / 255.0);
      assertNear(test, "short alpha", short.alphaAt(0), 0.8);
      assert(parseHex("#0080FF80").toHex()[0] == "#0080ff80");
      assert(do { parseHex("#12"); false } orelse true);
      assert(do { parseHex("#ggg"); false } orelse true);
      assert(do { parseHex("#-12"); false } orelse true);
      assert(do { parseHex(""); false } orelse true);
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

Negative values, which wide-gamut colors can have in sRGB, mirror the curve,
as in CSS Color 4's sample code.

    export let channelGammaToLinear(x: Float64): Float64 {
      let magnitude = x.abs();
      if (magnitude > 0.04045) {
        x.sign() * (((magnitude + 0.055) / 1.055) orelse panic()) ** 2.4
      } else {
        (x / 12.92) orelse panic()
      }
    }

    export let channelLinearToGamma(x: Float64): Float64 {
      let magnitude = x.abs();
      if (magnitude > 0.0031308) {
        x.sign() * (1.055 * magnitude ** (1.0 / 2.4) - 0.055)
      } else {
        12.92 * x
      }
    }
