# Oklab Color Space

## Oklab Conversion

References:

- https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
- https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/colorconversion.js
- https://oklch.com/
- https://www.w3.org/TR/css-color-4/#ok-lab

Note that we need to linearize before Oklab conversion. Panics if `rgb` isn't N
x 3.

    let srgbLinearToOklab(rgb: Matrix): Matrix {
      do {
        let lms = times(rgb, srgbLinearToLmsMatrix).map { x => cbrt(x) };
        times(lms, lmsToOklabMatrix)
      } orelse panic()
    }

We could map each row one at a time, combining multiple operations, but the
matrix form is clearer. Matrix form would also be more efficient in Python if
using NumPy. Unfortunately, we're not using that. But use matrices, anyway.

The matrices come from CSS Color 4's sample code, which has more precision
than Ottosson's original 10-digit coefficients, so that each forward and
inverse pair round trips to within about 1e-16. The sRGB to LMS matrices
combine the spec's sRGB to XYZ and XYZ to LMS steps.

    let srgbLinearToLmsMatrix = transpose(new Matrix(3, [
      0.412221469470763, 0.5363325372617348, 0.051445993267502196,
      0.21190349581782525, 0.6806995506452344, 0.10739695353694055,
      0.08830245919005643, 0.2817188391361215, 0.6299787016738222,
    ]));

    let lmsToOklabMatrix = transpose(new Matrix(3, [
      0.210454268309314, 0.7936177747023054, -0.0040720430116193,
      1.9779985324311684, -2.42859224204858, 0.450593709617411,
      0.0259040424655478, 0.7827717124575296, -0.8086757549230774,
    ]));

Panics if `lab` isn't N x 3.

    let oklabToSrgbLinear(lab: Matrix): Matrix {
      do {
        let lms = times(lab, oklabToLmsMatrix).map { x => x * x * x };
        times(lms, lmsToSrgbLinearMatrix)
      } orelse panic()
    }

    let oklabToLmsMatrix = transpose(new Matrix(3, [
      1.0, 0.3963377773761749, 0.2158037573099136,
      1.0, -0.1055613458156586, -0.0638541728258133,
      1.0, -0.0894841775298119, -1.2914855480194092,
    ]));

    let lmsToSrgbLinearMatrix = transpose(new Matrix(3, [
      4.076741636075958, -3.307711539258062, 0.23096990318210447,
      -1.268437973285032, 2.6097573492876887, -0.34131937600265727,
      -0.004196076138675553, -0.7034186179359363, 1.7076146940746117,
    ]));

### Tests

    test("oklab round trip") { test =>
      let rgb0 = Color.fromList(Space.srgb, [
        0.0, 0.0, 0.0,
        0.3, 0.4, 0.5,
        1.0, 1.0, 1.0,
      ]);
      let oklab = rgb0.convert(Space.oklab);
      let rgb1 = oklab.convert(Space.srgb);
      assertColors(test, rgb0, rgb1);
    }

Conversions don't clamp, so colors outside the sRGB gamut also round trip.

    test("out-of-gamut round trip") { test =>
      let lab0 = Color.fromList(Space.oklab, [0.5, 0.4, 0.0]);
      let rgb = lab0.convert(Space.srgb);
      assert(rgb[0, 0] > 1.0 || rgb[0, 1] < 0.0 || rgb[0, 2] < 0.0);
      assertColors(test, lab0, rgb.convert(Space.oklab));
    }

Color conversion test cases come from [web-platform-tests][CssColorTests].

    test("oklab from rgb conversion") { test =>
      let source = Color.fromList(Space.srgb, [
        0.0, 0.5, 0.0,
        0.0, 0.0, 0.0,
        1.0, 1.0, 1.0,
        0.48477, 0.34290, 0.38412,
        0.27888, 0.38072, 0.89414,
      ]);
      assertConvertColors(test, source, oklabExpectedResults());
    }

    let oklabExpectedResults(): Color {
      Color.fromList(Space.oklab, [
        // wpt case oklab-001.html: 0.51975, -0.1403, 0.10768,
        0.51829, -0.13991, 0.10737,
        0.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        0.5, 0.05, 0.0,
        0.55, 0.0, -0.2,
      ])      
    }

## Lab to LCH Conversion

Does this work for any Lab to LCH, whether Ok or otherwise?

Meanwhile, these functions consider the first 3 columns of the input and panic
on fewer than 3 columns. Hue is in turns, from 0 up to 1, rather than degrees.

Grays have no meaningful hue, and rounding noise in their chroma would
otherwise give them an arbitrary one. So below this chroma, hue is 0, much like
CSS Color 4 treats hue as powerless for achromatic colors. CSS would make it
`none`, but we keep plain numbers, avoiding NaN and its cross-language quirks.
Mixing can still spot grays by their chroma.

    let achromaticChroma = 0.000004;

    let labToLch(lab: Matrix): Matrix {
      labToPolar(lab, achromaticChroma)
    }

The same for any Lab space, given the chroma below which it counts as gray.
CIE Lab, for example, has a larger scale than Oklab.

    let labToPolar(lab: Matrix, achromaticChroma: Float64): Matrix {
      mapRows(lab) { row, builder =>
        do {
          let l = row[0];
          let a = row[1];
          let b = row[2];
          let c = (a * a + b * b).sqrt();
          let h = if (c < achromaticChroma) {
            0.0
          } else {
            0.5 * (1.0 + (-b).atan2(-a) / Float64.pi)
          };
          builder.add(l);
          builder.add(c);
          builder.add(h);
        } orelse panic();
      }
    }

    let lchToLab(lch: Matrix): Matrix {
      mapRows(lch) { row, builder =>
        do {
          let l = row[0];
          let c = row[1];
          let h = row[2];
          let h_ = 2.0 * Float64.pi * h;
          let a = c * h_.cos();
          let b = c * h_.sin();
          builder.add(l);
          builder.add(a);
          builder.add(b);
        } orelse panic();
      }
    }

### Tests

Any Lab space is fine for this test as long as we give the matching LCH and
turnaround Lab for it.

    test("lch round trip") { test =>
      let lab0 = oklabExpectedResults();
      let lch = lab0.convert(Space.oklch);
      let lab1 = lch.convert(Space.oklab);
      assertColors(test, lab0, lab1);
    }

Also test conversion, again from [web-platform-tests][CssColorTests].

    test("oklch from rgb conversion") { test =>
      let source = Color.fromList(Space.srgb, [
        0.0, 0.5, 0.0,
        0.0, 0.0, 0.0,
        0.70492, 0.02351, 0.37073,
        0.23056, 0.31730, 0.82628,
        1.0, 1.0, 1.0,
      ]);
      let expected = Color.fromList(Space.oklch, [
        // wpt case oklch-001.html: 0.51975, 0.17686, 0.39582 (142.495 / 360),
        0.51829, 0.17636, 0.39582,
        0.0, 0.0, 0.0,
        0.5, 0.2, 0.0,
        0.5, 0.2, 0.75,

White has `c` of about 3.7e-8 rather than exactly zero, so this checks that
near-zero chroma gives hue 0, matching wpt case oklch-003.html.

        1.0, 0.0, 0.0,
      ]);
      assertConvertColors(test, source, expected);
    }

[CssColorTests]: https://github.com/web-platform-tests/wpt/tree/master/css/css-color
