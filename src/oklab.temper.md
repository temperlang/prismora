# Oklab Color Space

## Oklab Conversion

References:

- https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab

Note that we need to linearize before Oklab conversion.

    export let srgbLinearToOklab(rgb: Vec3): Vec3 {
      let { x, y, z } = rgb;
      let l = 0.4122214708 * x + 0.5363325363 * y + 0.0514459929 * z;
      let m = 0.2119034982 * x + 0.6806995451 * y + 0.1073969566 * z;
      let s = 0.0883024619 * x + 0.2817188376 * y + 0.6299787005 * z;
      let l_ = cbrt(l);
      let m_ = cbrt(m);
      let s_ = cbrt(s);
      {
        x: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        y: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        z: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
      }
    }

    export let oklabToSrgbLinear(lab: Vec3): Vec3 {
      let { x, y, z } = lab;
      let l_ = x + 0.3963377774 * y + 0.2158037573 * z;
      let m_ = x - 0.1055613458 * y - 0.0638541728 * z;
      let s_ = x - 0.0894841775 * y - 1.2914855480 * z;
      let l = l_ * l_ * l_;
      let m = m_ * m_ * m_;
      let s = s_ * s_ * s_;
      {
        x: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        y: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        z: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      }
    }

    test("oklab round trip") {
      let rgbs = [
        new Vec3(0.0, 0.0, 0.0),
        new Vec3(0.3, 0.4, 0.5),
        new Vec3(1.0, 1.0, 1.0),
      ];
      let check(name: String, y: Float64, z: Float64): Void {
        assertNear(name, y, z) { (message);; assert(false) {message} }
      }
      let tol = 1e-6;
      forEach(rgbs) { (rgb0: Vec3);;
        let linear0 = srgbGammaToLinear(rgb0);
        let oklab = srgbLinearToOklab(linear0);
        let linear1 = oklabToSrgbLinear(oklab);
        let rgb1 = srgbLinearToGamma(linear1);
        check("x", rgb0.x, rgb1.x);
        check("y", rgb0.y, rgb1.y);
        check("z", rgb0.z, rgb1.z);
      }
    }

## Oklch Conversion

TODO
