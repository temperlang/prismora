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
Spaces defined outside Prismora count as unbounded.

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
      let labA = a.to(Space.oklab).rows;
      let labB = b.to(Space.oklab).rows;
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
        let rows = color.to(gamut).rows;
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
        convert(color.rows, color.space, space)
      } else {
        let lch = color.to(Space.oklch).rows;
        let builder = new ListBuilder<Float64>();
        for (var i = 0; i < color.length; i += 1) {
          let mapped = mapRow(lch[i, 0], lch[i, 1], lch[i, 2], gamut);
          builder.add(mapped.at(0));
          builder.add(mapped.at(1));
          builder.add(mapped.at(2));
        }
        convert(new Matrix(3, builder.toList()), gamut, space)
      }
    }

One OkLCh color, mapped into the unit cube of the RGB space `gamut`, following
the CSS sample pseudocode step by step.

    let mapRow(l: Float64, c: Float64, h: Float64, gamut: Space): Matrix throws Bubble {
      if (l >= 1.0) {
        return convert(Matrix.rowOf([1.0, 0.0, 0.0]), Space.oklab, gamut);
      }
      if (l <= 0.0) {
        return convert(Matrix.rowOf([0.0, 0.0, 0.0]), Space.oklab, gamut);
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
      convert(Matrix.rowOf([l, c, h]), Space.oklch, gamut)
    }

Distance from a clamped row in `gamut` to the OkLCh color it came from.

    let clippedDelta(
      clipped: Matrix, gamut: Space, l: Float64, c: Float64, h: Float64,
    ): Float64 throws Bubble {
      let lab = convert(clipped, gamut, Space.oklab);
      let turn = 2.0 * Float64.pi * h;
      distance3(lab.at(0) - l, lab.at(1) - c * turn.cos(), lab.at(2) - c * turn.sin())
    }

    let rowInUnitCube(row: Matrix): Boolean throws Bubble {
      inUnitCube(row.at(0), row.at(1), row.at(2))
    }

    let inUnitCube(x: Float64, y: Float64, z: Float64): Boolean {
      x >= 0.0 && x <= 1.0 && y >= 0.0 && y <= 1.0 && z >= 0.0 && z <= 1.0
    }

## Tests

Expected values come from running the CSS pseudocode, written in JavaScript
on top of the spec's sample conversion code. They reproduce the spec's
examples: `oklch(76% 0.27 60)` maps to about `color(display-p3 1 0.546 0)`,
and `color(display-p3 1.1 0.4 0.2)` to about `color(display-p3 1 0.473 0.314)`.

    let gamutSources(): Color {
      Color.fromAlpha(Space.oklch, [
        0.7, 0.1, 0.1, 1.0,
        0.76, 0.27, 60.0 / 360.0, 0.5,
        0.6, 0.4, 0.75, 1.0,
        0.9, 0.3, 0.3, 1.0,
        0.2, 0.2, 0.6, 1.0,
        1.1, 0.1, 0.2, 0.25,
        -0.1, 0.1, 0.2, 1.0,
      ])
    }

    test("gamut map to srgb") { test =>
      let mapped = gamutSources().toGamut(Space.srgb);
      assertColors(test, mapped, Color.from(Space.srgb, [
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
      assertColors(test, gamutSources().toGamut(Space.displayP3), Color.from(Space.displayP3, [
        0.790739120765, 0.545501485469, 0.466200353057,
        1.0, 0.545792071593, 0.0,
        0.315356275266, 0.393245093513, 1.0,
        0.934981983451, 0.9049438887, 0.0,
        0.0, 0.106537539269, 0.156663374284,
        1.0, 1.0, 1.0,
        0.0, 0.0, 0.0,
      ]));
      let p3 = Color.from(Space.displayP3, [1.1, 0.4, 0.2]);
      assertColors(test, p3.toGamut(Space.displayP3), Color.from(Space.displayP3, [
        1.0, 0.472833690532, 0.314161886196,
      ]));
    }

HSL maps through sRGB, and unbounded spaces just convert.

    test("gamut map to hsl and unbounded spaces") { test =>
      let sources = gamutSources();
      assertConvertColors(test, sources.toGamut(Space.srgb), sources.toGamut(Space.hsl));
      assertColors(test, sources.toGamut(Space.lab), sources.to(Space.lab));
      let unbounded = Space.oklab.gamut == null;
      assert(Space.hsl.gamut == Space.srgb);
      assert(unbounded);
    }

Hex output maps to sRGB first. Display P3 red would clamp to `#ff0000`, but
mapping keeps its lightness and hue.

    test("hex maps to the srgb gamut") {
      assert(Color.from(Space.displayP3, [1.0, 0.0, 0.0]).toHex()[0] == "#ff0b0c");
    }

    test("in gamut") {
      let checks = gamutSources().inGamut(Space.srgb);
      assert(checks[0]);
      assert(!checks[1]);
      assert(!checks[2]);
      let vivid = Color.from(Space.srgb, [1.05, 0.5, 0.5]);
      assert(!vivid.inGamut(Space.srgb)[0]);
      assert(vivid.inGamut(Space.displayP3)[0]);
      assert(vivid.inGamut(Space.oklab)[0]);
    }

    test("delta e ok") { test =>
      let black = Color.from(Space.srgb, [0.0, 0.0, 0.0, 0.3, 0.4, 0.5]);
      let white = Color.from(Space.srgb, [1.0, 1.0, 1.0, 0.3, 0.4, 0.5]);
      let deltas = black.deltaEOk(white);
      assertNear(test, "black to white", deltas[0], 1.0);
      assertNear(test, "same", deltas[1], 0.0);
    }

[CssGamutMapping]: https://www.w3.org/TR/css-color-4/#gamut-mapping
