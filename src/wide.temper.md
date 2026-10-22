# Wide-Gamut RGB

Display P3, A98 RGB, ProPhoto RGB, and Rec. 2020 from [CSS Color 4][Css4Rgb].
Each is a child of linear sRGB in the conversion tree: its transfer curve, then
one matrix. The matrices combine the steps through XYZ ahead of time,
including Bradford adaptation for ProPhoto's D50 white, so each conversion is
a single multiply.

Transfer curves and matrices come from CSS Color 4's sample code (see
`NOTICE`). Like sRGB, the curves mirror negative values.

    let signedPow(x: Float64, power: Float64): Float64 {
      x.sign() * x.abs() ** power
    }

## Display P3

P3 uses the same transfer curve as sRGB.

    let displayP3ToSrgbLinear(rgb: Matrix): Matrix {
      times(srgbGammaToLinear(rgb), displayP3ToSrgbLinearMatrix) orelse panic()
    }

    let srgbLinearToDisplayP3(rgb: Matrix): Matrix {
      srgbLinearToGamma(times(rgb, srgbLinearToDisplayP3Matrix) orelse panic())
    }

    let displayP3ToSrgbLinearMatrix = transpose(new Matrix(3, [
      1.2249401762805598, -0.22494017628055996, 0.0,
      -0.04205695470968816, 1.042056954709688, 0.0,
      -0.019637554590334432, -0.07863604555063189, 1.0982736001409663,
    ]));

    let srgbLinearToDisplayP3Matrix = transpose(new Matrix(3, [
      0.8224619687143623, 0.17753803128563775, 0.0,
      0.03319419885096162, 0.9668058011490384, 0.0,
      0.017082630721120033, 0.07239744066396347, 0.9105199286149165,
    ]));

## A98 RGB

    let a98RgbToSrgbLinear(rgb: Matrix): Matrix {
      times(rgb.map { x => signedPow(x, 563.0 / 256.0) }, a98RgbToSrgbLinearMatrix) orelse panic()
    }

    let srgbLinearToA98Rgb(rgb: Matrix): Matrix {
      (times(rgb, srgbLinearToA98RgbMatrix) orelse panic()).map { x => signedPow(x, 256.0 / 563.0) }
    }

    let a98RgbToSrgbLinearMatrix = transpose(new Matrix(3, [
      1.3983557439607783, -0.3983557439607783, 0.0,
      0.0, 1.0, 0.0,
      0.0, -0.042928989294473266, 1.0429289892944733,
    ]));

    let srgbLinearToA98RgbMatrix = transpose(new Matrix(3, [
      0.7151256068556247, 0.2848743931443754, 0.0,
      0.0, 1.0, 0.0,
      0.0, 0.04116194845011847, 0.9588380515498816,
    ]));

## ProPhoto RGB

ProPhoto's curve is linear near zero, below 16/512 encoded or 1/512 linear.

    let prophotoRgbToSrgbLinear(rgb: Matrix): Matrix {
      let linear = rgb.map { x =>
        if (x.abs() <= 16.0 / 512.0) { (x / 16.0) orelse panic() } else { signedPow(x, 1.8) }
      };
      times(linear, prophotoRgbToSrgbLinearMatrix) orelse panic()
    }

    let srgbLinearToProphotoRgb(rgb: Matrix): Matrix {
      (times(rgb, srgbLinearToProphotoRgbMatrix) orelse panic()).map { x =>
        if (x.abs() >= 1.0 / 512.0) { signedPow(x, 1.0 / 1.8) } else { 16.0 * x }
      }
    }

    let prophotoRgbToSrgbLinearMatrix = transpose(new Matrix(3, [
      2.0343808495169955, -0.7276357899341348, -0.3067450595828617,
      -0.2288257316330503, 1.231742541190105, -0.002916809557054527,
      -0.008558828783917411, -0.1532667021380372, 1.1618255309219545,
    ]));

    let srgbLinearToProphotoRgbMatrix = transpose(new Matrix(3, [
      0.5292769776226117, 0.330154501978493, 0.14056852039889556,
      0.09836585954044928, 0.8734707129069618, 0.028163427552589028,
      0.01687534092138685, 0.11765941425612084, 0.8654652448224923,
    ]));

## Rec. 2020

CSS Color 4 uses the BT.1886 reference curve, a plain 2.4 power.

    let rec2020ToSrgbLinear(rgb: Matrix): Matrix {
      times(rgb.map { x => signedPow(x, 2.4) }, rec2020ToSrgbLinearMatrix) orelse panic()
    }

    let srgbLinearToRec2020(rgb: Matrix): Matrix {
      (times(rgb, srgbLinearToRec2020Matrix) orelse panic()).map { x => signedPow(x, 1.0 / 2.4) }
    }

    let rec2020ToSrgbLinearMatrix = transpose(new Matrix(3, [
      1.6604910021084345, -0.5876411387885495, -0.07284986331988488,
      -0.12455047452159074, 1.1328998971259603, -0.008349422604369477,
      -0.018150763354905303, -0.10057889800800739, 1.1187296613629127,
    ]));

    let srgbLinearToRec2020Matrix = transpose(new Matrix(3, [
      0.627403895934699, 0.3292830383778837, 0.043313065687417225,
      0.06909728935823208, 0.9195403950754587, 0.011362315566309178,
      0.01639143887515028, 0.08801330787722575, 0.895595253247624,
    ]));

## Tests

Expected values come from running CSS Color 4's sample code.

    test("wide-gamut conversions") { test =>
      let rgb = Color.fromList(Space.srgb, [
        0.2, 0.4, 0.6,
        1.0, 0.0, 0.0,
        0.9, 0.85, 0.1,
        0.5, 0.5, 0.5,
      ]);
      assertConvertColors(test, rgb, Color.fromList(Space.displayP3, [
        0.249851333138, 0.395240072219, 0.584033770793,
        0.917487557325, 0.200286807741, 0.138560591211,
        0.891391892272, 0.851722072242, 0.298871078056,
        0.5, 0.5, 0.5,
      ]));
      assertConvertColors(test, rgb, Color.fromList(Space.a98Rgb, [
        0.281431625299, 0.39940515013, 0.587886651311,
        0.858591602295, 0.0, 0.0,
        0.88281679472, 0.845892959087, 0.226319800967,
        0.496103698449, 0.496103698449, 0.496103698449,
      ]));
      assertConvertColors(test, rgb, Color.fromList(Space.prophotoRgb, [
        0.287661355919, 0.319551532681, 0.504537907869,
        0.702248075228, 0.275720531025, 0.10354766465,
        0.784909212301, 0.808617388605, 0.283459001462,
        0.424672394878, 0.424672394878, 0.424672394878,
      ]));
      assertConvertColors(test, rgb, Color.fromList(Space.rec2020, [
        0.346027280161, 0.424740633604, 0.603441621589,
        0.823464101975, 0.328429446017, 0.180339328981,
        0.873261057133, 0.85721957769, 0.354134042116,
        0.526066350711, 0.526066350711, 0.526066350711,
      ]));
    }

A wide-gamut color outside sRGB gets negative sRGB channels, which still
round trip through the mirrored curves.

    test("wide-gamut outside srgb round trip") { test =>
      let p3 = Color.fromList(Space.displayP3, [0.0, 1.0, 0.0]);
      let rgb = p3.convert(Space.srgb);
      assert(rgb[0, 0] < 0.0);
      assertColors(test, p3, rgb.convert(Space.displayP3));
    }

[Css4Rgb]: https://www.w3.org/TR/css-color-4/#predefined
