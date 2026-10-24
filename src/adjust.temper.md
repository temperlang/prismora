# Adjustments and Contrast

## Adjustments

Lightening, vividness and hue changes happen in OkLCh, so equal steps look
about equally big across colors, and hue stays put while lightness or
vividness changes. Results convert back to the color's own space, with alpha
kept. They aren't clamped, so a lightened or more vivid color can end up
outside a display's gamut; use `toGamut` before showing it.

The methods are on `Color`: `lighten`, `saturate`, `rotateHue` and
`grayscale`. They all come down to this, which adds `lightness` to OkLCh
lightness, multiplies chroma by `chromaFactor`, and adds `degrees` to hue.
Grays keep hue 0, as elsewhere in Chromarite.

    let adjustLch(
      color: Color, lightness: Float64, chromaFactor: Float64, degrees: Float64,
    ): Matrix throws Bubble {
      let lch = rowsOf(color.toSpace(Space.oklch));
      let adjusted = mapRows(lch) { row, builder =>
        do {
          let chroma = row[1] * chromaFactor;
          builder.add(row[0] + lightness);
          builder.add(chroma);
          builder.add(if (chroma == 0.0) { 0.0 } else { wrap(row[2] + degrees, 360.0) });
        } orelse panic();
      };
      convertRows(adjusted, Space.oklch, color.space)
    }

### Tests

    test("lighten") { test =>
      let color = Color.fromListWithAlpha(Space.srgb, [0.2, 0.4, 0.6, 0.5]);
      let lighter = color.lighten(0.1);
      assert(lighter.space == Space.srgb);
      assert(lighter.alphaAt(0) == 0.5);
      let before = color.toSpace(Space.oklch);
      let after = lighter.toSpace(Space.oklch);
      assertNear(test, "lightness", after[0, 0], before[0, 0] + 0.1);
      assertNear(test, "chroma", after[0, 1], before[0, 1]);
      assertNear(test, "hue", after[0, 2], before[0, 2]);
      assertColors(test, lighter.lighten(-0.1), color);
    }

    test("saturate, rotate hue and grayscale") { test =>
      let color = Color.fromList(Space.oklch, [0.6, 0.1, 288.0]);
      assertColors(test, color.saturate(2.0), Color.fromList(Space.oklch, [0.6, 0.2, 288.0]));
      assertColors(test, color.rotateHue(180.0), Color.fromList(Space.oklch, [0.6, 0.1, 108.0]));
      assertColors(test, color.grayscale(), Color.fromList(Space.oklch, [0.6, 0.0, 0.0]));
      let gray = Color.fromList(Space.srgb, [0.9, 0.2, 0.3]).grayscale();
      assertNear(test, "gray g", gray[0, 1], gray[0, 0]);
      assertNear(test, "gray b", gray[0, 2], gray[0, 0]);
    }

## Contrast

[WCAG 2][WcagContrast] contrast between colors for readability, as a ratio
from 1 (none) to 21 (black on white). WCAG asks for at least 4.5 for normal
text and 3 for large text.

Relative luminance is CIE Y, from linear sRGB. That's WCAG's formula, with
the sRGB curve as CSS defines it, which WCAG 2.2 also uses. Colors outside
sRGB are gamut-mapped first, since WCAG is about displayed colors.

    let luminanceRows(color: Color): List<Float64> throws Bubble {
      let xyz = rowsOf(color.toGamut(Space.srgb).toSpace(Space.xyzD65));
      let builder = new ListBuilder<Float64>();
      for (var i = 0; i < color.length; i += 1) {
        builder.add(xyz[i, 1]);
      }
      builder.toList()
    }

Either color may have one row, used for every row of the other; otherwise
their lengths must match, or this panics.

    let contrastRows(a: Color, b: Color): List<Float64> throws Bubble {
      let length = if (a.length == b.length || b.length == 1) {
        a.length
      } else if (a.length == 1) {
        b.length
      } else {
        panic()
      };
      let la = luminanceRows(a);
      let lb = luminanceRows(b);
      let builder = new ListBuilder<Float64>();
      for (var i = 0; i < length; i += 1) {
        let x = la[if (a.length == 1) { 0 } else { i }];
        let y = lb[if (b.length == 1) { 0 } else { i }];
        builder.add((x.max(y) + 0.05) / (x.min(y) + 0.05));
      }
      builder.toList()
    }

### Tests

Known ratios: 21 for black on white, about 4.54 for `#767676` on white (the
lightest gray that passes for normal text), and about 4.0 for red on white.

    test("contrast") { test =>
      let white = Color.fromList(Space.srgb, [1.0, 1.0, 1.0]);
      assertNear(test, "white luminance", white.luminance()[0], 1.0);
      let others = Color.fromList(Space.srgb, [
        0.0, 0.0, 0.0,
        118.0 / 255.0, 118.0 / 255.0, 118.0 / 255.0,
        1.0, 0.0, 0.0,
      ]);
      let ratios = others.contrast(white);
      assertNear(test, "black", ratios[0], 21.0);
      assert((ratios[1] - 4.54).abs() < 0.005);
      assert((ratios[2] - 3.998).abs() < 0.001);
      assert(white.contrast(others)[2] == ratios[2]);
    }

## Reaching a Contrast Ratio

Accessible palettes need things like "this hue, as light as it can be while
keeping 4.5:1 against white". `fitContrast` does that for each row: it keeps
OkLCh hue and chroma, and moves OkLCh lightness as little as it can to reach
`ratio` against `against`. Chroma drops where needed to stay in the gamut of
`space`, as `fitChroma` does, since a color that can't be shown can't be
checked. Rows that already reach the ratio are unchanged.

A row moves away from `against`: lighter if it's already lighter, darker
otherwise. If that way can't reach the ratio, it goes the other way, and if
neither can, it goes to whichever end, black or white, contrasts most.

Contrast rises steadily along the way, so bisection finds the lightness,
for all rows at once. Each step keeps the side that reaches the ratio, so
results reach it, apart from rounding when shown, such as to hex; ask for a
hair more than you need if that matters.

Each try fits chroma, which costs a bisection of its own, so this keeps tries
few. The ends are black and white, whose contrast needs no try. And
bisection starts near where a gray would reach the ratio, since a gray's
OkLab lightness is the cube root of its luminance, falling back to the whole
way only for rows whose colorfulness puts them far from that.

    let contrastSteps = 12;
    let grayMargin = 0.15;

    let fitContrastRows(
      color: Color, against: Color, ratio: Float64, space: Space,
    ): Matrix throws Bubble {
      let n = color.length;
      if (against.length != 1 && against.length != n) { panic() }
      let lch = rowsOf(color.toSpace(Space.oklch));
      let current = contrastRows(color, against);
      let luminance = luminanceRows(color);
      let others = luminanceRows(against);

For each row, the end it heads for, and a bracket around the answer: `lo`
doesn't reach the ratio, and `hi` does, or is the end.

      let end = new ListBuilder<Float64>();
      let lo = new ListBuilder<Float64>();
      let hi = new ListBuilder<Float64>();
      for (var i = 0; i < n; i += 1) {
        let other = others[if (against.length == 1) { 0 } else { i }];
        let start = clamp(lch[i, 0], 0.0, 1.0);
        let atWhite = 1.05 / (other + 0.05);
        let atBlack = (other + 0.05) / 0.05;
        let preferUp = luminance[i] >= other;
        let upReaches = atWhite >= ratio;
        let downReaches = atBlack >= ratio;
        let goUp = if (preferUp && upReaches) {
          true
        } else if (!preferUp && downReaches) {
          false
        } else if (upReaches != downReaches) {
          upReaches
        } else {
          atWhite >= atBlack
        };
        let to = if (goUp) { 1.0 } else { 0.0 };
        end.add(to);
        if (current[i] >= ratio) {
          lo.add(start);
          hi.add(start);
        } else if (!upReaches && !downReaches) {
          lo.add(to);
          hi.add(to);
        } else if (goUp) {
          let gray = cbrt((ratio * (other + 0.05) - 0.05).max(0.0));
          lo.add(clamp(gray - grayMargin, start, 1.0));
          hi.add(clamp(gray + grayMargin, start, 1.0));
        } else {
          let gray = cbrt(((other + 0.05) / ratio - 0.05).max(0.0));
          lo.add(clamp(gray + grayMargin, 0.0, start));
          hi.add(clamp(gray - grayMargin, 0.0, start));
        }
      }

Check both sides of every bracket in one try, widening any that miss.

      let sides = new ListBuilder<Float64>();
      sides.addAll(lo.toList());
      sides.addAll(hi.toList());
      let both = new ListBuilder<Float64>();
      for (var k = 0; k < 2; k += 1) {
        for (var i = 0; i < n; i += 1) {
          both.add(lch[i, 0]);
          both.add(lch[i, 1]);
          both.add(lch[i, 2]);
        }
      }
      let checked = contrastRows(lightnessIn(new Matrix(3, both.toList()), sides.toList(), space), against2(against, n));
      for (var i = 0; i < n; i += 1) {
        if (lo[i] != hi[i]) {
          if (checked[i] >= ratio) { lo.set(i, clamp(lch[i, 0], 0.0, 1.0)) }
          if (checked[n + i] < ratio) { hi.set(i, end[i]) }
        }
      }
      for (var step = 0; step < contrastSteps; step += 1) {
        let mid = new ListBuilder<Float64>();
        for (var i = 0; i < n; i += 1) {
          mid.add((lo[i] + hi[i]) * 0.5);
        }
        let middle = mid.toList();
        let reached = contrastRows(lightnessIn(lch, middle, space), against);
        for (var i = 0; i < n; i += 1) {
          if (lo[i] != hi[i]) {
            if (reached[i] >= ratio) { hi.set(i, middle[i]) } else { lo.set(i, middle[i]) }
          }
        }
      }
      let moved = rowsOf(lightnessIn(lch, hi.toList(), space).toSpace(color.space));
      let original = rowsOf(color);
      let width = color.width;
      let result = new ListBuilder<Float64>();
      for (var i = 0; i < n; i += 1) {
        let source = if (current[i] >= ratio) { original } else { moved };
        for (var j = 0; j < width; j += 1) {
          result.add(source[i, j]);
        }
      }
      new Matrix(width, result.toList())
    }

`against` repeated for twice the rows, for checking both sides at once.

    let against2(against: Color, n: Int): Color {
      if (against.length == 1) {
        against
      } else {
        let values = new ListBuilder<Float64>();
        values.addAll(against.toList());
        values.addAll(against.toList());
        Color.fromList(against.space, values.toList())
      }
    }

The OkLCh rows with new lightness, chroma fitted to `space`.

    let lightnessIn(lch: Matrix, lightness: List<Float64>, space: Space): Color throws Bubble {
      let values = new ListBuilder<Float64>();
      for (var i = 0; i < lch.nrows; i += 1) {
        values.add(lightness[i]);
        values.add(lch[i, 1]);
        values.add(lch[i, 2]);
      }
      Color.fromList(Space.oklch, values.toList()).fitChroma(space)
    }

### Tests

    test("fit contrast") { test =>
      let white = Color.parse("white");
      let shades = Color.fromList(Space.oklch, [
        0.7, 0.15, 250.0,
        0.9, 0.05, 30.0,
        0.3, 0.1, 140.0,
      ]);
      let fitted = shades.fitContrast(white, 4.5, Space.srgb);
      assert(fitted.space == Space.oklch);
      let ratios = fitted.contrast(white);
      for (var i = 0; i < 3; i += 1) {
        assert(ratios[i] >= 4.5);
        assertNear(test, "hue", fitted[i, 2], shades[i, 2]);
      }

The first two had to darken, and only just reach the ratio. The last already
reached it, so it's unchanged.

      assert(ratios[0] < 4.51);
      assert(ratios[1] < 4.51);
      assert(fitted[0, 0] < 0.7);
      assertColors(test, Color.fromList(Space.oklch, [0.3, 0.1, 140.0]), Color.fromList(Space.oklch, [
        fitted[2, 0], fitted[2, 1], fitted[2, 2],
      ]));
    }

Against black, rows lighten instead, and alpha and the color's own space
stay.

    test("fit contrast lightens against dark colors") { test =>
      let black = Color.parse("black");
      let gray = Color.fromListWithAlpha(Space.srgb, [0.3, 0.3, 0.3, 0.5]);
      let fitted = gray.fitContrast(black, 7.0, Space.srgb);
      assert(fitted.space == Space.srgb);
      assert(fitted.alphaAt(0) == 0.5);
      let ratio = fitted.contrast(black)[0];
      assert(ratio >= 7.0 && ratio < 7.01);
      assert(fitted[0, 0] > 0.3);
    }

A ratio nothing can reach, such as 21 against mid gray, goes to the end
with the most contrast: black here, at about 5.3, where white gives about
4.0. That's even though the row starts lighter than the gray.

    test("fit contrast past what's possible") {
      let gray = Color.fromList(Space.srgb, [0.5, 0.5, 0.5]);
      let fitted = Color.fromList(Space.srgb, [0.6, 0.6, 0.6]).fitContrast(gray, 21.0, Space.srgb);
      assert(fitted.toHex()[0] == "#000000");
    }

[WcagContrast]: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
