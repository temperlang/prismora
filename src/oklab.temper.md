# Oklab Color Space

## Oklab Conversion

References:

- https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab

Note that we need to linearize before Oklab conversion.

    export let srgbLinearToOklab(rgb: Matrix): Matrix | Bubble {
      rgb
        .times(srgbLinearToOklab0)
        .map { (x);; cbrt(x) }
        .times(srgbLinearToOklab1)
    }

    let srgbLinearToOklab0 = trustTransposed(3, [
      0.4122214708, 0.5363325363, 0.0514459929,
      0.2119034982, 0.6806995451, 0.1073969566,
      0.0883024619, 0.2817188376, 0.6299787005,
    ]);

    let srgbLinearToOklab1 = trustTransposed(3, [
      0.2104542553, +0.7936177850, -0.0040720468,
      1.9779984951, -2.4285922050, +0.4505937099,
      0.0259040371, +0.7827717662, -0.8086757660,
    ]);

So we can map each row one at a time, combining different operations, but the
matrix form is clearer. Matrix form would also be more efficient in Python if
using NumPy. Unfortunately, we're not using that. But use matrices, anyway.

    let oklabToSrgbLinear(lab: Matrix): Matrix {
      lab
        .times(oklabToSrgbLinear0)
        .map { (x);; x * x * x }
        .times(oklabToSrgbLinear1)
    }

    let oklabToSrgbLinear0 = trustTransposed(3, [
      1.0, +0.3963377774, +0.2158037573,
      1.0, -0.1055613458, -0.0638541728,
      1.0, -0.0894841775, -1.2914855480,
    ]);

    let oklabToSrgbLinear1 = trustTransposed(3, [
      +4.0767416621, -3.3077115913, +0.2309699292,
      -1.2684380046, +2.6097574011, -0.3413193965,
      -0.0041960863, -0.7034186147, +1.7076147010,
    ]);

We can't allow bubbling at top level or else ordering because messy. So make a
matrix that we know can't bubble and use it as fake backup. Our matrices won't
bubble, but we need `orelse` to convince Temper.

TODO Work out a strategy for top-level bubble handling or prohibition of it.

    let safeMatrix = Matrix.rowOf([0.0]);
    let trustTransposed(ncols: Int, values: List<Float64>): Matrix {
      { ncols, values }.transpose() orelse safeMatrix
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
