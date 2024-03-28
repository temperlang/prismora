# Oklab Color Space

## Oklab Conversion

References:

- https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
- https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/colorconversion.js
- https://oklch.com/
- https://www.w3.org/TR/css-color-4/#ok-lab

Note that we need to linearize before Oklab conversion.

    export let srgbLinearToOklab(rgb: Matrix): Matrix {
      rgb
        .times(srgbLinearToOklab0)
        .map { (x);; cbrt(x) }
        .times(srgbLinearToOklab1)
    }

    let srgbLinearToOklab0 = new Matrix(3, [
      0.4122214708, 0.5363325363, 0.0514459929,
      0.2119034982, 0.6806995451, 0.1073969566,
      0.0883024619, 0.2817188376, 0.6299787005,
    ]).transpose();

    let srgbLinearToOklab1 = new Matrix(3, [
      0.2104542553, +0.7936177850, -0.0040720468,
      1.9779984951, -2.4285922050, +0.4505937099,
      0.0259040371, +0.7827717662, -0.8086757660,
    ]).transpose();

So we can map each row one at a time, combining different operations, but the
matrix form is clearer. Matrix form would also be more efficient in Python if
using NumPy. Unfortunately, we're not using that. But use matrices, anyway.

    let oklabToSrgbLinear(lab: Matrix): Matrix {
      lab
        .times(oklabToSrgbLinear0)
        .map { (x);; x * x * x }
        .times(oklabToSrgbLinear1)
    }

    let oklabToSrgbLinear0 = new Matrix(3, [
      1.0, +0.3963377774, +0.2158037573,
      1.0, -0.1055613458, -0.0638541728,
      1.0, -0.0894841775, -1.2914855480,
    ]).transpose();

    let oklabToSrgbLinear1 = new Matrix(3, [
      +4.0767416621, -3.3077115913, +0.2309699292,
      -1.2684380046, +2.6097574011, -0.3413193965,
      -0.0041960863, -0.7034186147, +1.7076147010,
    ]).transpose();

### Tests

    test("oklab round trip") { (test);;
      let rgb0 = Color.of(Space.srgb, [
        0.0, 0.0, 0.0,
        0.3, 0.4, 0.5,
        1.0, 1.0, 1.0,
      ]);
      let oklab = rgb0.to(Space.oklab);
      let rgb1 = oklab.to(Space.srgb);
      assertColors(test, rgb0, rgb1);
    }

Color conversion test cases come from [web-platform-tests][CssColorTests].

    test("oklab from rgb conversion") { (test);;
      let source = Color.of(Space.srgb, [
        0.0, 0.5, 0.0,
        0.0, 0.0, 0.0,
        1.0, 1.0, 1.0,
        0.48477, 0.34290, 0.38412,
        0.27888, 0.38072, 0.89414,
      ]);
      let expected = Color.of(Space.oklab, [
        // wpt case oklab-001.html: 0.51975, -0.1403, 0.10768,
        0.51829, -0.13991, 0.10737,
        0.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        0.5, 0.05, 0.0,
        0.55, 0.0, -0.2,
      ]);
      assertConvertColors(test, source, expected);
    }

## Lab to LCH Conversion

Does this work for any Lab to LCH, whether Ok or otherwise?

    export let labToLch(lab: Matrix): Matrix {
      lab.mapRows { (row, builder);;
        let l = row[0];
        let a = row[1];
        let b = row[2];
        let c = (a * a + b * b).sqrt();
        let h = 0.5 * (1.0 + (-b).atan2(-a) / Float64.pi);
        builder.add(l);
        builder.add(c);
        builder.add(h);
      }
    }

    export let lchToLab(lch: Matrix): Matrix {
      lch.mapRows { (row, builder);;
        let l = row[0];
        let c = row[1];
        let h = row[2];
        let h_ = 2.0 * Float64.pi * h;
        let a = c * h_.cos();
        let b = c * h_.sin();
        builder.add(l);
        builder.add(a);
        builder.add(b);
      }
    }

### Tests

    test("lch round trip") { (test);;

Any Lab space is fine for this test.

      let lab0 = Color.of(Space.oklab, [
        0.51829, -0.13991, 0.10737,
        0.0, 0.0, 0.0,
        1.0, 0.0, 0.0,
        0.5, 0.05, 0.0,
        0.55, 0.0, -0.2,
      ]);

As long as we give the matching LCH and turnaround Lab for it.

      let lch = lab0.to(Space.oklch);
      let lab1 = lch.to(Space.oklab);
      assertColors(test, lab0, lab1);
    }

[CssColorTests]: https://github.com/web-platform-tests/wpt/tree/master/css/css-color
