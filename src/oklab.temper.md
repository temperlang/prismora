# Oklab Color Space

## Data Type

    export class Lab {
      public l: Float64;
      public a: Float64;
      public b: Float64;
    }

## Conversion

References:

- https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab

Note that we need to linearize before Oklab conversion.

    export let linearSrgbToOklab(rgb: Rgb): Lab {
      let { r, g, b } = rgb;
      let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
      let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
      let s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
      let l_ = cbrt(l);
      let m_ = cbrt(m);
      let s_ = cbrt(s);
      {
        l: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
      }
    }

    export let oklabToLinearSrgb(lab: Lab): Rgb {
      let { l as l0, a, b } = lab;
      let l_ = l0 + 0.3963377774 * a + 0.2158037573 * b;
      let m_ = l0 - 0.1055613458 * a - 0.0638541728 * b;
      let s_ = l0 - 0.0894841775 * a - 1.2914855480 * b;
      let l = l_ * l_ * l_;
      let m = m_ * m_ * m_;
      let s = s_ * s_ * s_;
      {
        r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      }
    }

    test("oklab round trip") {
      let rgbs = [
        new Rgb(0.0, 0.0, 0.0),
        new Rgb(0.3, 0.4, 0.5),
        new Rgb(1.0, 1.0, 1.0),
      ];
      let check(name: String, a: Float64, b: Float64): Void {
        assertNear(name, a, b) { (message);; assert(false) {message} }
      }
      let tol = 1e-6;
      forEach(rgbs) { (rgb0: Rgb);;
        let linear0 = srgbGammaToLinear(rgb0);
        let oklab = linearSrgbToOklab(linear0);
        let linear1 = oklabToLinearSrgb(oklab);
        let rgb1 = srgbLinearToGamma(linear1);
        check("r", rgb0.r, rgb1.r);
        check("g", rgb0.g, rgb1.g);
        check("b", rgb0.b, rgb1.b);
      }
    }
