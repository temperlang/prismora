# Adjustments and Contrast

## Adjustments

Lightening, vividness and hue changes happen in OkLCh, so equal steps look
about equally big across colors, and hue stays put while lightness or
vividness changes. Results convert back to the color's own space, with alpha
kept. They aren't clamped, so a lightened or more vivid color can end up
outside a display's gamut; use `toGamut` before showing it.

The methods are on `Color`: `lighten`, `saturate`, `rotateHue` and
`grayscale`. They all come down to this, which adds `lightness` to OkLCh
lightness, multiplies chroma by `chromaFactor`, and adds `turns` to hue.
Grays keep hue 0, as elsewhere in Prismora.

    let adjustLch(
      color: Color, lightness: Float64, chromaFactor: Float64, turns: Float64,
    ): Matrix throws Bubble {
      let lch = color.to(Space.oklch).rows;
      let adjusted = lch.mapRows { row, builder =>
        do {
          let chroma = row[1] * chromaFactor;
          builder.add(row[0] + lightness);
          builder.add(chroma);
          builder.add(if (chroma == 0.0) { 0.0 } else { wrap(row[2] + turns, 1.0) });
        } orelse panic();
      };
      convert(adjusted, Space.oklch, color.space)
    }

### Tests

    test("lighten") { test =>
      let color = Color.fromAlpha(Space.srgb, [0.2, 0.4, 0.6, 0.5]);
      let lighter = color.lighten(0.1);
      assert(lighter.space == Space.srgb);
      assert(lighter.alphaAt(0) == 0.5);
      let before = color.to(Space.oklch);
      let after = lighter.to(Space.oklch);
      assertNear(test, "lightness", after[0, 0], before[0, 0] + 0.1);
      assertNear(test, "chroma", after[0, 1], before[0, 1]);
      assertNear(test, "hue", after[0, 2], before[0, 2]);
      assertColors(test, lighter.lighten(-0.1), color);
    }

    test("saturate, rotate hue and grayscale") { test =>
      let color = Color.from(Space.oklch, [0.6, 0.1, 0.8]);
      assertColors(test, color.saturate(2.0), Color.from(Space.oklch, [0.6, 0.2, 0.8]));
      assertColors(test, color.rotateHue(0.5), Color.from(Space.oklch, [0.6, 0.1, 0.3]));
      assertColors(test, color.grayscale(), Color.from(Space.oklch, [0.6, 0.0, 0.0]));
      let gray = Color.from(Space.srgb, [0.9, 0.2, 0.3]).grayscale();
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
      let xyz = color.toGamut(Space.srgb).to(Space.xyzD65).rows;
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
      let white = Color.from(Space.srgb, [1.0, 1.0, 1.0]);
      assertNear(test, "white luminance", white.luminance()[0], 1.0);
      let others = Color.from(Space.srgb, [
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

[WcagContrast]: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
