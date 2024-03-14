# Oklab Color Space

## Oklab Conversion

References:

- https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab

Note that we need to linearize before Oklab conversion.

    export let srgbLinearToOklab(rgb: Matrix): Matrix | Bubble {
      rgb.mapRows { (row, builder);;
        let x = row[0];
        let y = row[1];
        let z = row[2];
        let l = 0.4122214708 * x + 0.5363325363 * y + 0.0514459929 * z;
        let m = 0.2119034982 * x + 0.6806995451 * y + 0.1073969566 * z;
        let s = 0.0883024619 * x + 0.2817188376 * y + 0.6299787005 * z;
        let l_ = cbrt(l);
        let m_ = cbrt(m);
        let s_ = cbrt(s);
        builder.add(0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_);
        builder.add(1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_);
        builder.add(0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_);
      }
    }

    export let oklabToSrgbLinear(lab: Matrix): Matrix {
      lab.mapRows { (row, builder);;
        let x = row[0];
        let y = row[1];
        let z = row[2];
        let l_ = x + 0.3963377774 * y + 0.2158037573 * z;
        let m_ = x - 0.1055613458 * y - 0.0638541728 * z;
        let s_ = x - 0.0894841775 * y - 1.2914855480 * z;
        let l = l_ * l_ * l_;
        let m = m_ * m_ * m_;
        let s = s_ * s_ * s_;
        builder.add(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
        builder.add(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
        builder.add(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
      }
    }

### Matrix form

So we can map each row one at a time, combining different operations, but the
matrix form is clearer. Matrix form would also be more efficient in Python if
using NumPy. Unfortunately, we're not using that. But use matrices, anyway.

    let oklabToSrgbLinearTimes(lab: Matrix): Matrix {

The real problem for now is that we can't seem to cache these matrices as
top-level members. Our ordering seems to be off. TODO Investigate!

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

      lab
        .times(oklabToSrgbLinear0)
        .map { (x);; x * x * x }
        .times(oklabToSrgbLinear1)
    }

### Tests

    test("oklab round trip") {
      let rgb0 = new Matrix(3, [
        0.0, 0.0, 0.0,
        0.3, 0.4, 0.5,
        1.0, 1.0, 1.0,
      ]);
      let check(name: String, y: Float64, z: Float64): Void {
        assertNear(name, y, z) { (message);; assert(false) {message} }
      }
      let linear0 = srgbGammaToLinear(rgb0);
      let oklab = srgbLinearToOklab(linear0);
      let linear1 = oklabToSrgbLinear(oklab);
      let rgb1 = srgbLinearToGamma(linear1);
      for (var i = 0; i < rgb0.nrows; i += 1) {
        check("x", rgb0[i, 0], rgb1[i, 0]);
        check("y", rgb0[i, 1], rgb1[i, 1]);
        check("z", rgb0[i, 2], rgb1[i, 2]);
      }
    }

## Oklch Conversion

TODO
