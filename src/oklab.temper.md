# Oklab Color Space

## Oklab Conversion

References:

- https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
- https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/colorconversion.js
- https://oklch.com/
- https://www.w3.org/TR/css-color-4/#ok-lab

Note that we need to linearize before Oklab conversion. Panics if `rgb` isn't N
x 3.

    export let srgbLinearToOklab(rgb: Matrix): Matrix {
      rgb
        .times(srgbLinearToOklab0)
        .map { (x);; cbrt(x) }
        .times(srgbLinearToOklab1) orelse panic()
    }

We could map each row one at a time, combining multiple operations, but the
matrix form is clearer. Matrix form would also be more efficient in Python if
using NumPy. Unfortunately, we're not using that. But use matrices, anyway.

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

Panics if `lab` isn't N x 3.

    let oklabToSrgbLinear(lab: Matrix): Matrix {
      lab
        .times(oklabToSrgbLinear0)
        .map { (x);; x * x * x }
        .times(oklabToSrgbLinear1) orelse panic()
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
      let rgb0 = Color.from(Space.srgb, [
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
      let source = Color.from(Space.srgb, [
        0.0, 0.5, 0.0,
        0.0, 0.0, 0.0,
        1.0, 1.0, 1.0,
        0.48477, 0.34290, 0.38412,
        0.27888, 0.38072, 0.89414,
      ]);
      assertConvertColors(test, source, oklabExpectedResults());
    }

    let oklabExpectedResults(): Color {
      Color.from(Space.oklab, [
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
on fewer than 3 columns.

    export let labToLch(lab: Matrix): Matrix {
      lab.mapRows { (row, builder);;
        do {
          let l = row[0];
          let a = row[1];
          let b = row[2];
          let c = (a * a + b * b).sqrt();
          let h = 0.5 * (1.0 + (-b).atan2(-a) / Float64.pi);
          builder.add(l);
          builder.add(c);
          builder.add(h);
        } orelse panic();
      }
    }

    export let lchToLab(lch: Matrix): Matrix {
      lch.mapRows { (row, builder);;
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

    test("lch round trip") { (test);;
      let lab0 = oklabExpectedResults();
      let lch = lab0.to(Space.oklch);
      let lab1 = lch.to(Space.oklab);
      assertColors(test, lab0, lab1);
    }

Also test conversion, again from [web-platform-tests][CssColorTests].

    test("oklch from rgb conversion") { (test);;
      let source = Color.from(Space.srgb, [
        0.0, 0.5, 0.0,
        0.0, 0.0, 0.0,
        0.70492, 0.02351, 0.37073,
        0.23056, 0.31730, 0.82628,
        1.0, 1.0, 1.0,
      ]);
      let expected = Color.from(Space.oklch, [
        // wpt case oklch-001.html: 0.51975, 0.17686, 0.39582 (142.495 / 360),
        0.51829, 0.17636, 0.39582,
        0.0, 0.0, 0.0,
        0.5, 0.2, 0.0,
        0.5, 0.2, 0.75,

This case is interesting. We get `c` of about 3.72740e-08 rather than exactly
zero, which means we also have a semi arbitary angle for `h`. Is there some
cutoff just for calling `h` zero?

        // wpt case oklch-003.html: 1.0, 0.0, 0.0
        1.0, 0.0, 0.24965,
      ]);
      assertConvertColors(test, source, expected);
    }

[CssColorTests]: https://github.com/web-platform-tests/wpt/tree/master/css/css-color
