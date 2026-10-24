# Gamut Mapping

Conversions keep out-of-gamut values, such as a vivid Display P3 red in sRGB.
To show such a color, we need one that's in gamut. Clamping each channel works
but can shift hue and lightness. [CSS Color 4][CssGamutMapping] instead keeps
lightness and hue in OkLCh and reduces chroma until the color fits, accepting
a clamped color once it's within a just noticeable difference.

Of the algorithms CSS allows, this is the Binary Search with Local MINDE.

The public API is on `Color` (`toGamut`, `inGamut` and `deltaEOk`) and
`Space` (`gamut`). These functions do the work.

## Gamuts

The RGB space whose unit cube bounds a space, or null if the space has no
gamut limits, as for XYZ, Lab and Oklab. HSL, HSV and HWB share sRGB's gamut.
Spaces defined outside Chromarite count as unbounded.

    let gamutOf(space: Space): Space? {
      when (space) {
        Space.srgb, Space.hsl, Space.hsv, Space.hwb -> Space.srgb;
        Space.srgbLinear, Space.displayP3, Space.a98Rgb, Space.prophotoRgb,
        Space.rec2020 -> space;
        else -> null;
      }
    }

## Color Difference

Distance in Oklab, called deltaEOK in CSS, for each pair of rows. About 0.02
is just noticeable. Panics if the colors have different lengths.

    let deltaEOkRows(a: Color, b: Color): List<Float64> throws Bubble {
      if (a.length != b.length) { panic() }
      let labA = a.toSpace(Space.oklab).rows;
      let labB = b.toSpace(Space.oklab).rows;
      let builder = new ListBuilder<Float64>();
      for (var i = 0; i < a.length; i += 1) {
        builder.add(distance3(
          labA[i, 0] - labB[i, 0], labA[i, 1] - labB[i, 1], labA[i, 2] - labB[i, 2],
        ));
      }
      builder.toList()
    }

    let distance3(x: Float64, y: Float64, z: Float64): Float64 {
      (x * x + y * y + z * z).sqrt()
    }

## Checking and Mapping

Whether each row is in the gamut of `space`, after converting to it. Always
true for unbounded spaces. There's no tolerance, so rounding noise just past
an edge counts as out, and mapping then clamps it.

    let inGamutRows(color: Color, space: Space): List<Boolean> throws Bubble {
      let gamut = gamutOf(space);
      let builder = new ListBuilder<Boolean>();
      if (gamut == null) {
        for (var i = 0; i < color.length; i += 1) { builder.add(true) }
      } else {
        let rows = color.toSpace(gamut).rows;
        for (var i = 0; i < color.length; i += 1) {
          builder.add(inUnitCube(rows[i, 0], rows[i, 1], rows[i, 2]));
        }
      }
      builder.toList()
    }

Rows converted to `space`, each mapped into its gamut. Colors already in
gamut are just converted.

For HSL, HSV and HWB, mapping and clamping happen in sRGB, which keeps them
consistent with the sRGB gamut, where CSS's sample code would clamp the
HSL or HWB channels themselves.

Null narrowing doesn't yet survive an early return in Temper, so this uses
if/else.

    let mapToGamut(color: Color, space: Space): Matrix throws Bubble {
      let gamut = gamutOf(space);
      if (gamut == null) {
        convertRows(color.rows, color.space, space)
      } else {
        let lch = color.toSpace(Space.oklch).rows;
        let builder = new ListBuilder<Float64>();
        for (var i = 0; i < color.length; i += 1) {
          let mapped = mapRow(lch[i, 0], lch[i, 1], lch[i, 2], gamut);
          builder.add(mapped.at(0));
          builder.add(mapped.at(1));
          builder.add(mapped.at(2));
        }
        convertRows(new Matrix(3, builder.toList()), gamut, space)
      }
    }

Rows converted to `space` and clamped in its gamut's RGB space, which is
what CSS calls clipping.

    let clipRows(color: Color, space: Space): Matrix {
      let gamut = gamutOf(space);
      if (gamut == null) {
        convertRows(color.rows, color.space, space)
      } else {
        convertRows(clampToUnit(color.toSpace(gamut).rows), gamut, space)
      }
    }

One OkLCh color, mapped into the unit cube of the RGB space `gamut`, following
the CSS sample pseudocode step by step.

    let mapRow(l: Float64, c: Float64, h: Float64, gamut: Space): Matrix throws Bubble {
      if (l >= 1.0) {
        return convertRows(Matrix.rowOf([1.0, 0.0, 0.0]), Space.oklab, gamut);
      }
      if (l <= 0.0) {
        return convertRows(Matrix.rowOf([0.0, 0.0, 0.0]), Space.oklab, gamut);
      }
      let origin = lchIn(l, c, h, gamut);
      if (rowInUnitCube(origin)) {
        return origin;
      }
      var clipped = clampToUnit(origin);
      var e = clippedDelta(clipped, gamut, l, c, h);
      if (e < justNoticeable) {
        return clipped;
      }

Search chroma between 0 and the original. While the lower bound is still in
gamut, in-gamut colors raise it. Past that, a clamped color within a just
noticeable difference raises it too, and one close enough to that difference
ends the search early.

      var min = 0.0;
      var max = c;
      var minInGamut = true;
      while (max - min > chromaEpsilon) {
        let chroma = (min + max) * 0.5;
        let current = lchIn(l, chroma, h, gamut);
        if (minInGamut && rowInUnitCube(current)) {
          min = chroma;
          continue;
        }
        clipped = clampToUnit(current);
        e = clippedDelta(clipped, gamut, l, chroma, h);
        if (e < justNoticeable) {
          if (justNoticeable - e < chromaEpsilon) {
            return clipped;
          }
          minInGamut = false;
          min = chroma;
        } else {
          max = chroma;
        }
      }
      clipped
    }

    let justNoticeable = 0.02;
    let chromaEpsilon = 0.0001;

    let lchIn(l: Float64, c: Float64, h: Float64, gamut: Space): Matrix throws Bubble {
      convertRows(Matrix.rowOf([l, c, h]), Space.oklch, gamut)
    }

Distance from a clamped row in `gamut` to the OkLCh color it came from.

    let clippedDelta(
      clipped: Matrix, gamut: Space, l: Float64, c: Float64, h: Float64,
    ): Float64 throws Bubble {
      let lab = convertRows(clipped, gamut, Space.oklab);
      let radians = h * Float64.pi / 180.0;
      distance3(lab.at(0) - l, lab.at(1) - c * radians.cos(), lab.at(2) - c * radians.sin())
    }

    let rowInUnitCube(row: Matrix): Boolean throws Bubble {
      inUnitCube(row.at(0), row.at(1), row.at(2))
    }

    let inUnitCube(x: Float64, y: Float64, z: Float64): Boolean {
      x >= 0.0 && x <= 1.0 && y >= 0.0 && y <= 1.0 && z >= 0.0 && z <= 1.0
    }

## Chroma Limits

The most chroma each row can have in the gamut of `space`, keeping its OkLCh
lightness and hue, found by bisecting all rows at once, up to `chromaCeiling`,
far past any real gamut (ProPhoto RGB's corners reach about 1.4). Spaces
without a gamut don't limit chroma, so they give infinity, which `1E999`
overflows to on every backend.

    let chromaCeiling = 4.0;
    let chromaSteps = 32;
    let unlimitedChroma = 1E999;

    let maxChromaRows(color: Color, space: Space): List<Float64> throws Bubble {
      let gamut = gamutOf(space);
      let lch = color.toSpace(Space.oklch).rows;
      let n = color.length;
      var lo = new ListBuilder<Float64>();
      var hi = new ListBuilder<Float64>();
      for (var i = 0; i < n; i += 1) {
        lo.add(0.0);
        hi.add(chromaCeiling);
      }
      if (gamut == null) {
        let unlimited = new ListBuilder<Float64>();
        for (var i = 0; i < n; i += 1) { unlimited.add(unlimitedChroma) }
        unlimited.toList()
      } else {
        for (var step = 0; step < chromaSteps; step += 1) {
          let trial = new ListBuilder<Float64>();
          for (var i = 0; i < n; i += 1) {
            trial.add(lch[i, 0]);
            trial.add((lo[i] + hi[i]) * 0.5);
            trial.add(lch[i, 2]);
          }
          let rows = convertRows(new Matrix(3, trial.toList()), Space.oklch, gamut);
          let nextLo = new ListBuilder<Float64>();
          let nextHi = new ListBuilder<Float64>();
          for (var i = 0; i < n; i += 1) {
            let mid = (lo[i] + hi[i]) * 0.5;
            if (inUnitCube(rows[i, 0], rows[i, 1], rows[i, 2])) {
              nextLo.add(mid);
              nextHi.add(hi[i]);
            } else {
              nextLo.add(lo[i]);
              nextHi.add(mid);
            }
          }
          lo = nextLo;
          hi = nextHi;
        }
        lo.toList()
      }
    }

Rows in their own space, with chroma lowered to the most that fits the gamut of
`space` where they don't already fit, keeping OkLCh lightness and hue exactly.
Unlike `mapToGamut`, there's no final clamp, so nothing else shifts. Rows that
fit are kept as they are.

    let fitChromaRows(color: Color, space: Space): Matrix throws Bubble {
      let fits = inGamutRows(color, space);
      let lch = color.toSpace(Space.oklch).rows;
      let limits = maxChromaRows(color, space);
      let lowered = new ListBuilder<Float64>();
      for (var i = 0; i < color.length; i += 1) {
        lowered.add(lch[i, 0]);
        lowered.add(lch[i, 1].min(limits[i]));
        lowered.add(lch[i, 2]);
      }
      let converted = convertRows(new Matrix(3, lowered.toList()), Space.oklch, color.space);
      let ncols = color.space.width;
      let result = new ListBuilder<Float64>();
      for (var i = 0; i < color.length; i += 1) {
        let source = if (fits[i]) { color.rows } else { converted };
        for (var j = 0; j < ncols; j += 1) {
          result.add(source[i, j]);
        }
      }
      new Matrix(ncols, result.toList())
    }

## Tests

Expected values come from running the CSS pseudocode, written in JavaScript
on top of the spec's sample conversion code. They reproduce the spec's
examples: `oklch(76% 0.27 60)` maps to about `color(display-p3 1 0.546 0)`,
and `color(display-p3 1.1 0.4 0.2)` to about `color(display-p3 1 0.473 0.314)`.

    let gamutSources(): Color {
      Color.fromListWithAlpha(Space.oklch, [
        0.7, 0.1, 36.0, 1.0,
        0.76, 0.27, 60.0, 0.5,
        0.6, 0.4, 270.0, 1.0,
        0.9, 0.3, 108.0, 1.0,
        0.2, 0.2, 216.0, 1.0,
        1.1, 0.1, 72.0, 0.25,
        -0.1, 0.1, 72.0, 1.0,
      ])
    }

    test("gamut map to srgb") { test =>
      let mapped = gamutSources().toGamut(Space.srgb);
      assertColors(test, mapped, Color.fromList(Space.srgb, [
        0.833627002848, 0.531871356164, 0.449552940042,
        1.0, 0.548554506922, 0.0,
        0.303462298212, 0.412289229377, 1.0,
        0.930347670046, 0.903053344931, 0.0,
        0.0, 0.107315366282, 0.148704397147,
        1.0, 1.0, 1.0,
        0.0, 0.0, 0.0,
      ]));
      assert(mapped.alphaAt(1) == 0.5);
      assert(mapped.alphaAt(5) == 0.25);
    }

    test("gamut map to display p3") { test =>
      assertColors(test, gamutSources().toGamut(Space.displayP3), Color.fromList(Space.displayP3, [
        0.790739120765, 0.545501485469, 0.466200353057,
        1.0, 0.545792071593, 0.0,
        0.315356275266, 0.393245093513, 1.0,
        0.934981983451, 0.9049438887, 0.0,
        0.0, 0.106537539269, 0.156663374284,
        1.0, 1.0, 1.0,
        0.0, 0.0, 0.0,
      ]));
      let p3 = Color.fromList(Space.displayP3, [1.1, 0.4, 0.2]);
      assertColors(test, p3.toGamut(Space.displayP3), Color.fromList(Space.displayP3, [
        1.0, 0.472833690532, 0.314161886196,
      ]));
    }

HSL maps through sRGB, and unbounded spaces just convert.

    test("gamut map to hsl and unbounded spaces") { test =>
      let sources = gamutSources();
      assertConvertColors(test, sources.toGamut(Space.srgb), sources.toGamut(Space.hsl));
      assertColors(test, sources.toGamut(Space.lab), sources.toSpace(Space.lab));
      let unbounded = Space.oklab.gamut == null;
      assert(Space.hsl.gamut == Space.srgb);
      assert(unbounded);
    }

Hex output maps to sRGB first. Display P3 red would clamp to `#ff0000`, but
mapping keeps its lightness and hue.

    test("hex maps to the srgb gamut") {
      assert(Color.fromList(Space.displayP3, [1.0, 0.0, 0.0]).toHex()[0] == "#ff0b0c");
    }

    test("in gamut") {
      let checks = gamutSources().inGamut(Space.srgb);
      assert(checks[0]);
      assert(!checks[1]);
      assert(!checks[2]);
      let vivid = Color.fromList(Space.srgb, [1.05, 0.5, 0.5]);
      assert(!vivid.inGamut(Space.srgb)[0]);
      assert(vivid.inGamut(Space.displayP3)[0]);
      assert(vivid.inGamut(Space.oklab)[0]);
    }

    test("max chroma and fit chroma") { test =>
      // A vivid blue past sRGB, and a gray that fits anything.
      let colors = Color.fromList(Space.oklch, [0.6, 0.35, 0.75, 0.5, 0.0, 0.0]);
      let limits = colors.maxChroma(Space.srgb);
      assert(limits[0] > 0.2 && limits[0] < 0.35);
      assert(limits[1] > 0.1);
      // Wider gamuts allow more chroma.
      assert(colors.maxChroma(Space.displayP3)[0] > limits[0]);
      assert(colors.maxChroma(Space.oklab)[0] > 1000.0);
      let fitted = colors.fitChroma(Space.srgb);
      assert(fitted.inGamut(Space.srgb)[0]);
      // Lightness and hue stay exactly; chroma drops to the limit.
      assertColors(test, fitted, Color.fromList(Space.oklch, [0.6, limits[0], 0.75, 0.5, 0.0, 0.0]));
      // Colors that fit don't change.
      let gray = Color.fromList(Space.srgb, [0.5, 0.5, 0.5]);
      assertColors(test, gray.fitChroma(Space.srgb), gray);
    }

    test("delta e ok") { test =>
      let black = Color.fromList(Space.srgb, [0.0, 0.0, 0.0, 0.3, 0.4, 0.5]);
      let white = Color.fromList(Space.srgb, [1.0, 1.0, 1.0, 0.3, 0.4, 0.5]);
      let deltas = black.deltaEOk(white);
      assertNear(test, "black to white", deltas[0], 1.0);
      assertNear(test, "same", deltas[1], 0.0);
    }

[CssGamutMapping]: https://www.w3.org/TR/css-color-4/#gamut-mapping
