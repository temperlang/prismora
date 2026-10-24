# XYZ and CIE Lab

The CIE spaces from [CSS Color 4][Css4Lab]. XYZ-D65 hangs off linear sRGB in
the conversion tree, XYZ-D50 off XYZ-D65 through Bradford chromatic adaptation,
CIE Lab off XYZ-D50, and LCH off Lab. As in CSS, Lab's lightness goes from 0
to 100, unlike Oklab's 0 to 1, and LCH's hue is in degrees like OkLCh's.

Matrices come from the sample code in CSS Color 4 (see `NOTICE`).

## XYZ

    let srgbLinearToXyzD65(rgb: Matrix): Matrix {
      times(rgb, srgbLinearToXyzD65Matrix) orelse panic()
    }

    let xyzD65ToSrgbLinear(xyz: Matrix): Matrix {
      times(xyz, xyzD65ToSrgbLinearMatrix) orelse panic()
    }

    let xyzD65ToXyzD50(xyz: Matrix): Matrix {
      times(xyz, xyzD65ToXyzD50Matrix) orelse panic()
    }

    let xyzD50ToXyzD65(xyz: Matrix): Matrix {
      times(xyz, xyzD50ToXyzD65Matrix) orelse panic()
    }

    let srgbLinearToXyzD65Matrix = transpose(new Matrix(3, [
      0.4123907992659595, 0.35758433938387796, 0.1804807884018343,
      0.21263900587151036, 0.7151686787677559, 0.07219231536073371,
      0.01933081871559185, 0.11919477979462599, 0.9505321522496606,
    ]));

    let xyzD65ToSrgbLinearMatrix = transpose(new Matrix(3, [
      3.2409699419045213, -1.5373831775700935, -0.4986107602930033,
      -0.9692436362808798, 1.8759675015077206, 0.04155505740717561,
      0.05563007969699361, -0.20397695888897657, 1.0569715142428786,
    ]));

Bradford chromatic adaptation between the D65 and D50 white points.

    let xyzD65ToXyzD50Matrix = transpose(new Matrix(3, [
      1.0479297925449969, 0.022946870601609652, -0.05019226628920524,
      0.02962780877005599, 0.9904344267538799, -0.017073799063418826,
      -0.009243040646204504, 0.015055191490298152, 0.7518742814281371,
    ]));

    let xyzD50ToXyzD65Matrix = transpose(new Matrix(3, [
      0.955473421488075, -0.02309845494876471, 0.06325924320057072,
      -0.0283697093338637, 1.0099953980813041, 0.021041441191917323,
      0.012314014864481998, -0.020507649298898964, 1.330365926242124,
    ]));

## CIE Lab

The D50 white point, and CIE's constants for the curve's linear segment.

    let d50X = 0.3457 / 0.3585;
    let d50Z = (1.0 - 0.3457 - 0.3585) / 0.3585;
    let labEpsilon = 216.0 / 24389.0;
    let labKappa = 24389.0 / 27.0;

    let xyzD50ToLab(xyz: Matrix): Matrix {
      mapRows(xyz) { row, builder =>
        do {
          let fx = labCurve(row[0] / d50X);
          let fy = labCurve(row[1]);
          let fz = labCurve(row[2] / d50Z);
          builder.add(116.0 * fy - 16.0);
          builder.add(500.0 * (fx - fy));
          builder.add(200.0 * (fy - fz));
        } orelse panic();
      }
    }

    let labCurve(x: Float64): Float64 throws Bubble {
      if (x > labEpsilon) { cbrt(x) } else { (labKappa * x + 16.0) / 116.0 }
    }

    let labToXyzD50(lab: Matrix): Matrix {
      mapRows(lab) { row, builder =>
        do {
          let l = row[0];
          let fy = (l + 16.0) / 116.0;
          let fx = fy + row[1] / 500.0;
          let fz = fy - row[2] / 200.0;
          builder.add(d50X * labCurveInverse(fx));
          builder.add(
            if (l > labKappa * labEpsilon) { fy * fy * fy } else { l / labKappa },
          );
          builder.add(d50Z * labCurveInverse(fz));
        } orelse panic();
      }
    }

    let labCurveInverse(f: Float64): Float64 throws Bubble {
      let cubed = f * f * f;
      if (cubed > labEpsilon) { cubed } else { (116.0 * f - 16.0) / labKappa }
    }

## CIE LCH

CSS treats CIE LCH hue as powerless below a chroma of 0.0015, so below that,
hue is 0 here, as with OkLCh.

    let cieLabToLch(lab: Matrix): Matrix {
      labToPolar(lab, 0.0015)
    }

    let cieLchToLab(lch: Matrix): Matrix {
      lchToLab(lch)
    }

## Tests

Expected values come from running CSS Color 4's sample code.

    test("xyz and lab conversions") { test =>
      let rgb = Color.fromList(Space.srgb, [
        0.2, 0.4, 0.6,
        1.0, 0.0, 0.0,
        0.9, 0.85, 0.1,
        0.5, 0.5, 0.5,
      ]);
      assertConvertColors(test, rgb, Color.fromList(Space.xyzD65, [
        0.118655305792, 0.125059256093, 0.319266107174,
        0.412390799266, 0.212639005872, 0.0193308187156,
        0.574004282513, 0.663105680765, 0.107239599411,
        0.203436670604, 0.214041140482, 0.233103163024,
      ]));
      assertConvertColors(test, rgb, Color.fromList(Space.xyzD50, [
        0.111187459082, 0.121927403966, 0.24083403015,
        0.436065746874, 0.222493177111, 0.0139239214632,
        0.611349790415, 0.671938196549, 0.0853083348359,
        0.206398946345, 0.214041140482, 0.176606330138,
      ]));
      assertConvertColors(test, rgb, Color.fromList(Space.lab, [
        41.5208239274, -4.57308993264, -33.4941945924,
        54.2905414047, 80.8049281704, 69.8909647686,
        85.6017291037, -8.40550223965, 81.3059722071,
        53.3889647411, 0.0, 0.0,
      ]));
      assertConvertColors(test, rgb, Color.fromList(Space.lch, [
        41.5208239274, 33.8049437646, 262.22526207864,
        54.2905414047, 106.837181603, 40.85765650512,
        85.6017291037, 81.7393025689, 95.90233392072,
        53.3889647411, 0.0, 0.0,
      ]));
    }

[Css4Lab]: https://www.w3.org/TR/css-color-4/#lab-colors
