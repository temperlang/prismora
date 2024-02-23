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
      let l = 0.4122214708f * rgb.r + 0.5363325363f * rgb.g + 0.0514459929f * rgb.b;
      let m = 0.2119034982f * rgb.r + 0.6806995451f * rgb.g + 0.1073969566f * rgb.b;
      let s = 0.0883024619f * rgb.r + 0.2817188376f * rgb.g + 0.6299787005f * rgb.b;
      let l_ = cbrt(l);
      let m_ = cbrt(m);
      let s_ = cbrt(s);
      {
        l: 0.2104542553f * l_ + 0.7936177850f * m_ - 0.0040720468f * s_,
        a: 1.9779984951f * l_ - 2.4285922050f * m_ + 0.4505937099f * s_,
        b: 0.0259040371f * l_ + 0.7827717662f * m_ - 0.8086757660f * s_,
      }
    }

## Helpers

Should we implement `cbrt` in Temper implicits?

    let cbrt(x: Float64): Float64 { x ** (1.0 / 3.0) }
