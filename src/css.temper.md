# CSS Colors

Parsing and formatting [CSS Color 4][Css4Syntax] syntax. The methods are
`Color.parse` and `toCss` on `Color`.

## Parsing

Accepts hex (`#rgb` through `#rrggbbaa`), named colors, and the functions
`rgb()`, `rgba()`, `hsl()`, `hsla()`, `hwb()`, `lab()`, `lch()`, `oklab()`,
`oklch()` and `color()`, case-insensitively, in modern syntax
(`rgb(255 128 0 / 50%)`) or legacy comma syntax for `rgb()` and `hsl()`
(`rgba(255, 128, 0, 0.5)`). The result is in the matching Chromarite space,
such as `Space.oklch` for `oklch()`, with alpha only if given. Anything else
bubbles, including `currentcolor`, system colors, and relative colors like
`oklch(from red l c h)`.

Units follow Chromarite rather than CSS: channels are 0 to 1 where CSS uses
0 to 255 or percentages, and hue is in degrees, so `hsl(0.5turn 50% 50%)`
gives `[180, 0.5, 0.5]`. Lab and LCH keep CSS's 0 to 100 lightness. As in CSS,
`rgb()` channels and alpha are clamped to their ranges, as are lightness and
negative chroma or saturation; `color()` channels aren't. A missing channel,
`none`, becomes 0, as for an achromatic hue elsewhere in Chromarite.

    let parseCssColor(text: String): Color throws Bubble {
      let lower = asciiLower(trimCss(text));
      if (lower.isEmpty) { bubble() }
      if (lower[String.begin] == HASH) {
        return parseHex(lower);
      }
      var open = String.begin;
      let end = lower.end;
      while (open < end && lower[open] != OPEN_PAREN) { open = lower.next(open) }
      if (open == end) {
        return parseNamed(lower);
      }
      let close = lower.prev(end);
      if (lower[close] != CLOSE_PAREN) { bubble() }
      let name = lower.slice(String.begin, open);
      let args = parseArgs(tokenize(lower.slice(lower.next(open), close)), name);
      if (name == "rgb" || name == "rgba") {
        rgbColor(args)
      } else if (name == "hsl" || name == "hsla") {
        hueFirstColor(Space.hsl, args)
      } else if (name == "hwb") {
        hueFirstColor(Space.hwb, args)
      } else if (name == "lab") {
        labColor(Space.lab, args, 100.0, 125.0)
      } else if (name == "lch") {
        lchColor(Space.lch, args, 100.0, 150.0)
      } else if (name == "oklab") {
        labColor(Space.oklab, args, 1.0, 0.4)
      } else if (name == "oklch") {
        lchColor(Space.oklch, args, 1.0, 0.4)
      } else if (name == "color") {
        predefinedColor(args)
      } else {
        bubble()
      }
    }

### Tokens

A number, percentage, number with a unit, identifier, comma or slash.

    class CssToken(
      public kind: Int,
      public value: Float64,
      public text: String,
    ) {}

    let NUMBER = 0;
    let PERCENT = 1;
    let DIMENSION = 2;
    let IDENT = 3;
    let COMMA_TOKEN = 4;
    let SLASH_TOKEN = 5;

Code points for the characters that matter.

    let TAB = 9;
    let LINE_FEED = 10;
    let FORM_FEED = 12;
    let CARRIAGE_RETURN = 13;
    let SPACE = 32;
    let PERCENT_SIGN = 37;
    let OPEN_PAREN = 40;
    let CLOSE_PAREN = 41;
    let PLUS = 43;
    let COMMA = 44;
    let MINUS = 45;
    let DOT = 46;
    let SLASH = 47;
    let DIGIT_0 = 48;
    let DIGIT_9 = 57;
    let UPPER_E = 69;
    let LOWER_A = 97;
    let LOWER_E = 101;
    let LOWER_Z = 122;

    let isCssSpace(c: Int): Boolean {
      c == SPACE || c == TAB || c == LINE_FEED || c == CARRIAGE_RETURN || c == FORM_FEED
    }

    let isDigit(c: Int): Boolean { c >= DIGIT_0 && c <= DIGIT_9 }

    let isIdentPart(c: Int): Boolean {
      (c >= LOWER_A && c <= LOWER_Z) || isDigit(c) || c == MINUS
    }

    let trimCss(text: String): String {
      var begin = String.begin;
      var end = text.end;
      while (begin < end && isCssSpace(text[begin])) { begin = text.next(begin) }
      while (end > begin && isCssSpace(text[text.prev(end)])) { end = text.prev(end) }
      text.slice(begin, end)
    }

Splits lowercase text into tokens, bubbling on anything else.

    let tokenize(text: String): List<CssToken> throws Bubble {
      let tokens = new ListBuilder<CssToken>();
      var i = String.begin;
      let end = text.end;
      while (i < end) {
        let c = text[i];
        if (isCssSpace(c)) {
          i = text.next(i);
        } else if (c == COMMA) {
          tokens.add(new CssToken(COMMA_TOKEN, 0.0, ","));
          i = text.next(i);
        } else if (c == SLASH) {
          tokens.add(new CssToken(SLASH_TOKEN, 0.0, "/"));
          i = text.next(i);
        } else if (startsNumber(text, i)) {
          let numberEnd = scanNumber(text, i);
          let value = toNumber(text.slice(i, numberEnd));
          i = numberEnd;
          if (i < end && text[i] == PERCENT_SIGN) {
            tokens.add(new CssToken(PERCENT, value, ""));
            i = text.next(i);
          } else if (i < end && text[i] >= LOWER_A && text[i] <= LOWER_Z) {
            let unitEnd = scanIdent(text, i);
            tokens.add(new CssToken(DIMENSION, value, text.slice(i, unitEnd)));
            i = unitEnd;
          } else {
            tokens.add(new CssToken(NUMBER, value, ""));
          }
        } else if ((c >= LOWER_A && c <= LOWER_Z) || c == MINUS) {
          let identEnd = scanIdent(text, i);
          tokens.add(new CssToken(IDENT, 0.0, text.slice(i, identEnd)));
          i = identEnd;
        } else {
          bubble();
        }
      }
      tokens.toList()
    }

    let scanIdent(text: String, begin: StringIndex): StringIndex {
      var i = begin;
      while (i < text.end && isIdentPart(text[i])) { i = text.next(i) }
      i
    }

Whether a number starts here: a digit, or a sign or dot before one.

    let startsNumber(text: String, i: StringIndex): Boolean {
      let c = text[i];
      if (isDigit(c)) {
        true
      } else if (c == PLUS || c == MINUS || c == DOT) {
        let next = text.next(i);
        if (next >= text.end) {
          false
        } else {
          let d = text[next];
          isDigit(d) || (c != DOT && d == DOT && startsNumber(text, next))
        }
      } else {
        false
      }
    }

CSS numbers: an optional sign, digits with an optional fraction (or just a
fraction), then an optional exponent.

    let scanNumber(text: String, begin: StringIndex): StringIndex {
      let end = text.end;
      var i = begin;
      if (text[i] == PLUS || text[i] == MINUS) { i = text.next(i) }
      while (i < end && isDigit(text[i])) { i = text.next(i) }
      if (i < end && text[i] == DOT) {
        let afterDot = text.next(i);
        if (afterDot < end && isDigit(text[afterDot])) {
          i = afterDot;
          while (i < end && isDigit(text[i])) { i = text.next(i) }
        }
      }
      if (i < end && (text[i] == LOWER_E || text[i] == UPPER_E)) {
        var j = text.next(i);
        if (j < end && (text[j] == PLUS || text[j] == MINUS)) { j = text.next(j) }
        if (j < end && isDigit(text[j])) {
          i = j;
          while (i < end && isDigit(text[i])) { i = text.next(i) }
        }
      }
      i
    }

Adds a leading 0 before a bare fraction, such as `.5` or `-.5`, for
`toFloat64` in every backend.

    let toNumber(text: String): Float64 throws Bubble {
      var sign = "";
      var begin = String.begin;
      if (text[begin] == PLUS || text[begin] == MINUS) {
        if (text[begin] == MINUS) { sign = "-" }
        begin = text.next(begin);
      }
      let rest = text.slice(begin, text.end);
      let digits = if (rest[String.begin] == DOT) { "0${rest}" } else { rest };
      "${sign}${digits}".toFloat64()
    }

### Arguments

Channel tokens, the alpha token or null, and whether they used legacy comma
syntax. That's only for `rgb()` and `hsl()`, with exactly one comma between
values and no `none`.

    class CssArgs(
      public channels: List<CssToken>,
      public alpha: CssToken?,
      public legacy: Boolean,
    ) {}

    let parseArgs(tokens: List<CssToken>, name: String): CssArgs throws Bubble {
      var commas = false;
      for (let token of tokens) {
        if (token.kind == COMMA_TOKEN) { commas = true; }
      }
      if (commas) {
        parseLegacyArgs(tokens, name)
      } else {
        parseModernArgs(tokens)
      }
    }

    let parseModernArgs(tokens: List<CssToken>): CssArgs throws Bubble {
      let channels = new ListBuilder<CssToken>();
      var slash = -1;
      for (var i = 0; i < tokens.length; i += 1) {
        let token = tokens[i];
        if (token.kind == SLASH_TOKEN) {
          if (slash >= 0) { bubble() }
          slash = i;
        } else if (slash < 0) {
          channels.add(token);
        }
      }
      if (slash < 0) {
        new CssArgs(channels.toList(), null, false)
      } else {
        if (slash != tokens.length - 2) { bubble() }
        new CssArgs(channels.toList(), tokens[slash + 1], false)
      }
    }

    let parseLegacyArgs(tokens: List<CssToken>, name: String): CssArgs throws Bubble {
      if (name != "rgb" && name != "rgba" && name != "hsl" && name != "hsla") { bubble() }
      let values = new ListBuilder<CssToken>();
      for (var i = 0; i < tokens.length; i += 1) {
        let token = tokens[i];
        let shouldBeComma = i % 2 == 1;
        let isComma = token.kind == COMMA_TOKEN;
        if (isComma && !shouldBeComma || !isComma && shouldBeComma) { bubble() }
        if (token.kind == SLASH_TOKEN || (token.kind == IDENT && token.text == "none")) {
          bubble()
        }
        if (!shouldBeComma) { values.add(token) }
      }
      let count = values.length;
      if (tokens.length % 2 == 0 || (count != 3 && count != 4)) { bubble() }
      let list = values.toList();
      if (count == 4) {
        new CssArgs(list.slice(0, 3), list[3], true)
      } else {
        new CssArgs(list, null, true)
      }
    }

### Channel Values

A number as is, or a percentage scaled so 100% is `percentFull`, with
`none` as 0.

    let numberOrPercent(token: CssToken, percentFull: Float64): Float64 throws Bubble {
      if (token.kind == NUMBER) {
        token.value
      } else if (token.kind == PERCENT) {
        token.value * percentFull / 100.0
      } else if (token.kind == IDENT && token.text == "none") {
        0.0
      } else {
        bubble()
      }
    }

Hue in degrees, from a number or an angle with a unit, wrapped to 0 up to
360.

    let hueValue(token: CssToken): Float64 throws Bubble {
      let degrees = if (token.kind == NUMBER) {
        token.value
      } else if (token.kind == DIMENSION) {
        let unit = token.text;
        if (unit == "deg") {
          token.value
        } else if (unit == "grad") {
          token.value * 0.9
        } else if (unit == "rad") {
          token.value * 180.0 / Float64.pi
        } else if (unit == "turn") {
          token.value * 360.0
        } else {
          bubble()
        }
      } else if (token.kind == IDENT && token.text == "none") {
        0.0
      } else {
        bubble()
      };
      wrap(degrees, 360.0)
    }

    let alphaValue(token: CssToken): Float64 throws Bubble {
      numberOrPercent(token, 1.0).max(0.0).min(1.0)
    }

    let clampTo(x: Float64, low: Float64, high: Float64): Float64 { x.max(low).min(high) }

### Functions

    let finish(space: Space, channels: List<Float64>, args: CssArgs): Color throws Bubble {
      let alpha = args.alpha;
      if (alpha == null) {
        Color.fromList(space, channels)
      } else {
        Color.fromListWithAlpha(space, [channels[0], channels[1], channels[2], alphaValue(alpha)])
      }
    }

`rgb()` channels are 0 to 255 or percentages, clamped. Legacy syntax needs
all numbers or all percentages.

    let rgbColor(args: CssArgs): Color throws Bubble {
      let tokens = args.channels;
      if (tokens.length != 3) { bubble() }
      if (args.legacy && (tokens[1].kind != tokens[0].kind || tokens[2].kind != tokens[0].kind)) {
        bubble()
      }
      let channels = new ListBuilder<Float64>();
      for (let token of tokens) {
        channels.add(clampTo(numberOrPercent(token, 255.0) / 255.0, 0.0, 1.0));
      }
      finish(Space.srgb, channels.toList(), args)
    }

HSL and HWB: hue, then two channels as percentages, or in modern syntax
numbers out of 100. HSL's negative saturation clamps to 0, as in CSS.

    let hueFirstColor(space: Space, args: CssArgs): Color throws Bubble {
      let tokens = args.channels;
      if (tokens.length != 3) { bubble() }
      if (args.legacy && (tokens[1].kind != PERCENT || tokens[2].kind != PERCENT)) {
        bubble()
      }
      let h = hueValue(tokens[0]);
      let a = numberOrPercent(tokens[1], 100.0) / 100.0;
      let b = numberOrPercent(tokens[2], 100.0) / 100.0;
      let first = if (space == Space.hsl) { a.max(0.0) } else { a };
      finish(space, [h, first, b], args)
    }

LCH and OkLCh: lightness clamped to 0 up to `lightnessFull`, chroma where
100% is `chromaFull` and negative clamps to 0, then hue.

    let lchColor(space: Space, args: CssArgs, lightnessFull: Float64, chromaFull: Float64): Color throws Bubble {
      let tokens = args.channels;
      if (tokens.length != 3) { bubble() }
      let l = clampTo(numberOrPercent(tokens[0], lightnessFull), 0.0, lightnessFull);
      let c = numberOrPercent(tokens[1], chromaFull).max(0.0);
      finish(space, [l, c, hueValue(tokens[2])], args)
    }

Lab and Oklab: lightness clamped to its range, then `a` and `b`, where 100%
is `abFull`.

    let labColor(space: Space, args: CssArgs, lightnessFull: Float64, abFull: Float64): Color throws Bubble {
      let tokens = args.channels;
      if (tokens.length != 3) { bubble() }
      let l = clampTo(numberOrPercent(tokens[0], lightnessFull), 0.0, lightnessFull);
      let a = numberOrPercent(tokens[1], abFull);
      let b = numberOrPercent(tokens[2], abFull);
      finish(space, [l, a, b], args)
    }

`color(space c1 c2 c3)`, where 100% is 1, unclamped.

    let predefinedColor(args: CssArgs): Color throws Bubble {
      let tokens = args.channels;
      if (tokens.length != 4 || tokens[0].kind != IDENT) { bubble() }
      let space = predefinedSpace(tokens[0].text);
      let channels = [
        numberOrPercent(tokens[1], 1.0),
        numberOrPercent(tokens[2], 1.0),
        numberOrPercent(tokens[3], 1.0),
      ];
      finish(space, channels, args)
    }

    let predefinedSpace(name: String): Space throws Bubble {
      if (name == "srgb") {
        Space.srgb
      } else if (name == "srgb-linear") {
        Space.srgbLinear
      } else if (name == "display-p3") {
        Space.displayP3
      } else if (name == "a98-rgb") {
        Space.a98Rgb
      } else if (name == "prophoto-rgb") {
        Space.prophotoRgb
      } else if (name == "rec2020") {
        Space.rec2020
      } else if (name == "xyz" || name == "xyz-d65") {
        Space.xyzD65
      } else if (name == "xyz-d50") {
        Space.xyzD50
      } else {
        bubble()
      }
    }

## Formatting

Each row as CSS in this color's own space, such as `oklch(0.7 0.1 180)`,
with ` / alpha` if alpha is given, rounded enough to round trip closely.
sRGB within range uses `rgb()`, out of range `color(srgb ...)`, since
`rgb()` clamps. HSV, which CSS lacks, is written as sRGB. Spaces defined
outside Chromarite bubble.

    let cssStrings(color: Color): List<String> throws Bubble {
      let source = if (color.space == Space.hsv) { color.toSpace(Space.srgb) } else { color };
      let space = source.space;
      let rows = rowsOf(source);
      let builder = new ListBuilder<String>();
      for (var i = 0; i < source.length; i += 1) {
        let x = rows[i, 0];
        let y = rows[i, 1];
        let z = rows[i, 2];
        let body = if (space == Space.srgb && inUnitCube(x, y, z)) {
          "rgb(${formatNumber(x * 255.0, 3)} ${formatNumber(y * 255.0, 3)} ${formatNumber(z * 255.0, 3)}"
        } else if (space == Space.hsl || space == Space.hwb) {
          "${space.name}(${formatNumber(x, 4)} ${formatNumber(y * 100.0, 4)}% ${formatNumber(z * 100.0, 4)}%"
        } else if (space == Space.lab) {
          "lab(${formatNumber(x, 4)} ${formatNumber(y, 4)} ${formatNumber(z, 4)}"
        } else if (space == Space.lch) {
          "lch(${formatNumber(x, 4)} ${formatNumber(y, 4)} ${formatNumber(z, 4)}"
        } else if (space == Space.oklab) {
          "oklab(${formatNumber(x, 6)} ${formatNumber(y, 6)} ${formatNumber(z, 6)}"
        } else if (space == Space.oklch) {
          "oklch(${formatNumber(x, 6)} ${formatNumber(y, 6)} ${formatNumber(z, 4)}"
        } else {
          "color(${predefinedName(space)} ${formatNumber(x, 6)} ${formatNumber(y, 6)} ${formatNumber(z, 6)}"
        };
        let alpha = source.alpha;
        if (alpha == null) {
          builder.add("${body})");
        } else {
          builder.add("${body} / ${formatNumber(alpha[i], 4)})");
        }
      }
      builder.toList()
    }

    let predefinedName(space: Space): String throws Bubble {
      when (space) {
        Space.srgb -> "srgb";
        Space.srgbLinear -> "srgb-linear";
        Space.displayP3 -> "display-p3";
        Space.a98Rgb -> "a98-rgb";
        Space.prophotoRgb -> "prophoto-rgb";
        Space.rec2020 -> "rec2020";
        Space.xyzD65 -> "xyz-d65";
        Space.xyzD50 -> "xyz-d50";
        else -> bubble();
      }
    }

Rounds to `places` decimal places and drops trailing zeros, so 0.5 gives
`0.5`, 2.0 gives `2`, and -0.0001 at 3 places gives `0`. The same in every
backend, unlike float `toString`.

    let formatNumber(x: Float64, places: Int): String {
      var scale = 1.0;
      for (var k = 0; k < places; k += 1) { scale *= 10.0 }
      let scaled = (x * scale).round();
      if (scaled == 0.0) {
        "0"
      } else if (scaled.abs() >= 1.0e15) {
        x.toString()
      } else {
        let magnitude = scaled.abs();
        let whole = ((magnitude / scale) orelse panic()).floor();
        var fraction = magnitude - whole * scale;
        var digits = places;
        while (digits > 0 && fraction - ((fraction / 10.0) orelse panic()).floor() * 10.0 == 0.0) {
          fraction = ((fraction / 10.0) orelse panic()).floor();
          digits -= 1;
        }
        let sign = if (scaled < 0.0) { "-" } else { "" };
        let wholeText = whole.toInt64Unsafe().toString();
        if (digits == 0) {
          "${sign}${wholeText}"
        } else {
          let fractionText = padLeft(fraction.toInt64Unsafe().toString(), digits, "0");
          "${sign}${wholeText}.${fractionText}"
        }
      }
    }

## Tests

    test("parse rgb") { test =>
      assertColors(test, Color.parse("rgb(255 128 0)"), Color.fromList(Space.srgb, [1.0, 128.0 / 255.0, 0.0]));
      let half = Color.parse("rgb(100% 50% 0% / 50%)");
      assertColors(test, half, Color.fromList(Space.srgb, [1.0, 0.5, 0.0]));
      assert(half.alphaAt(0) == 0.5);
      let legacy = Color.parse("  RGBA(255, 0, 0, 0.25) ");
      assertColors(test, legacy, Color.fromList(Space.srgb, [1.0, 0.0, 0.0]));
      assert(legacy.alphaAt(0) == 0.25);
      assertColors(test, Color.parse("rgb(300 -10 none)"), Color.fromList(Space.srgb, [1.0, 0.0, 0.0]));
      let opaque = Color.parse("rgb(1 2 3)").alpha == null;
      assert(opaque);
    }

    test("parse hsl and hwb") { test =>
      assertColors(test, Color.parse("hsl(120deg 100% 50%)"), Color.fromList(Space.hsl, [120.0, 1.0, 0.5]));
      assertColors(test, Color.parse("hsl(0.5turn 50 25)"), Color.fromList(Space.hsl, [180.0, 0.5, 0.25]));
      assertColors(test, Color.parse("hsla(-90, 10%, 20%, 1)"), Color.fromList(Space.hsl, [270.0, 0.1, 0.2]));
      assertColors(test, Color.parse("hwb(200grad 20% 30%)"), Color.fromList(Space.hwb, [180.0, 0.2, 0.3]));
    }

    test("parse lab, lch, oklab and oklch") { test =>
      assertColors(test, Color.parse("lab(50% 40 -20)"), Color.fromList(Space.lab, [50.0, 40.0, -20.0]));
      assertColors(test, Color.parse("lch(50 100% 270deg)"), Color.fromList(Space.lch, [50.0, 150.0, 270.0]));
      assertColors(test, Color.parse("oklab(50% 25% -25%)"), Color.fromList(Space.oklab, [0.5, 0.1, -0.1]));
      assertColors(test, Color.parse("oklch(0.7 0.1 180)"), Color.fromList(Space.oklch, [0.7, 0.1, 180.0]));
      assertColors(test, Color.parse("oklch(.5 none 1.5708rad)"), Color.fromList(Space.oklch, [0.5, 0.0, 1.5708 * 180.0 / Float64.pi]));
      assertColors(test, Color.parse("oklch(120% -0.1 0)"), Color.fromList(Space.oklch, [1.0, 0.0, 0.0]));
    }

    test("parse color and others") { test =>
      assertColors(test, Color.parse("color(display-p3 1 50% 0)"), Color.fromList(Space.displayP3, [1.0, 0.5, 0.0]));
      assertColors(test, Color.parse("color(xyz 0.2 0.3 0.4)"), Color.fromList(Space.xyzD65, [0.2, 0.3, 0.4]));
      assertColors(test, Color.parse("color(srgb 1.2 -0.1 0.5e0)"), Color.fromList(Space.srgb, [1.2, -0.1, 0.5]));
      assert(Color.parse("RebeccaPurple").toHex()[0] == "#663399");
      assert(Color.parse("#0f08").toHex()[0] == "#00ff0088");
      for (let bad of [
        "", "rgb(1 2)", "rgb(1, 2 3)", "rgb(1 2 3", "foo(1 2 3)", "hsl(1 2 3 4)",
        "rgb(1 2 3 /)", "rgb(1 2 3 / 4 / 5)", "lab(1, 2, 3)", "color(cmyk 1 2 3)",
        "rgb(1 2 3) x", "oklch(0.5 0.1 10px)", "rgb(none, 0, 0)", "currentcolor",
        "rgb(255, 50%, 0)", "hsl(120, 50, 50)",
      ]) {
        assert(do { Color.parse(bad); false } orelse true) { "should fail: ${bad}" }
      }
    }

    test("format css") {
      assert(Color.fromList(Space.srgb, [1.0, 0.5, 0.0]).toCss()[0] == "rgb(255 127.5 0)");
      assert(Color.fromList(Space.srgb, [1.1, 0.0, 0.0]).toCss()[0] == "color(srgb 1.1 0 0)");
      assert(Color.fromList(Space.oklch, [0.7, 0.1, 180.0]).toCss()[0] == "oklch(0.7 0.1 180)");
      assert(Color.fromList(Space.hsl, [90.0, 0.5, 0.125]).toCss()[0] == "hsl(90 50% 12.5%)");
      assert(Color.fromListWithAlpha(Space.displayP3, [1.0, 0.0, 0.25, 0.5]).toCss()[0] == "color(display-p3 1 0 0.25 / 0.5)");
      assert(Color.fromList(Space.lab, [50.0, -20.0, 0.00001]).toCss()[0] == "lab(50 -20 0)");
    }

Formatting then parsing gives back about the same color in every space.

    test("css round trip") { test =>
      let srgb = Color.fromListWithAlpha(Space.srgb, [0.2, 0.4, 0.6, 0.8]);
      for (let space of [
        Space.srgb, Space.srgbLinear, Space.hsl, Space.hwb, Space.lab, Space.lch,
        Space.oklab, Space.oklch, Space.displayP3, Space.a98Rgb, Space.prophotoRgb,
        Space.rec2020, Space.xyzD65, Space.xyzD50,
      ]) {
        let color = srgb.toSpace(space);
        let back = Color.parse(color.toCss()[0]);
        assert(back.space == space);
        assertConvertColors(test, back, srgb);
        assert(back.alphaAt(0) == 0.8);
      }
    }

[Css4Syntax]: https://www.w3.org/TR/css-color-4/#color-syntax
