# HSL, HSV and HWB

These are cylindrical forms of gamma-encoded sRGB, following
[CSS Color 4][Css4Hsl]. Hue is in degrees, from 0 up to 360, as in CSS and
every space here with hue, and the other channels go from 0 to 1 rather than
percentages. Grays have hue 0.

In the conversion tree, HSL and HSV are children of sRGB, and HWB is a child of
HSV, since they differ only in how they express whiteness and blackness.

## Hue

Hue in degrees from sRGB channels, given their max and their spread, which must
be nonzero.

    let hueDegrees(r: Float64, g: Float64, b: Float64, max: Float64, spread: Float64): Float64 throws Bubble {
      let sixths = if (max == r) {
        (g - b) / spread + (if (g < b) { 6.0 } else { 0.0 })
      } else if (max == g) {
        (b - r) / spread + 2.0
      } else {
        (r - g) / spread + 4.0
      };
      sixths * 60.0
    }

Wraps any value into the range from 0 up to `modulus`.

    let wrap(x: Float64, modulus: Float64): Float64 throws Bubble {
      x - (x / modulus).floor() * modulus
    }

## HSL

    let srgbToHsl(rgb: Matrix): Matrix {
      mapRows(rgb) { row, builder =>
        do {
          let r = row[0];
          let g = row[1];
          let b = row[2];
          let max = r.max(g).max(b);
          let min = r.min(g).min(b);
          let l = (min + max) * 0.5;
          let spread = max - min;
          var h = 0.0;
          var s = 0.0;
          if (spread != 0.0) {
            s = if (l == 0.0 || l == 1.0) { 0.0 } else { (max - l) / l.min(1.0 - l) };
            h = hueDegrees(r, g, b, max, spread);
          }

Out-of-gamut input can give negative saturation, which CSS turns into the
opposite hue instead.

          if (s < 0.0) {
            h += 180.0;
            s = -s;
          }
          builder.add(wrap(h, 360.0));
          builder.add(s);
          builder.add(l);
        } orelse panic();
      }
    }

    let hslToSrgb(hsl: Matrix): Matrix {
      mapRows(hsl) { row, builder =>
        do {
          let twelfths = row[0] / 30.0;
          let s = row[1];
          let l = row[2];
          let a = s * l.min(1.0 - l);
          for (var n = 0; n < 3; n += 1) {
            let offset = if (n == 0) { 0.0 } else if (n == 1) { 8.0 } else { 4.0 };
            let k = wrap(offset + twelfths, 12.0);
            builder.add(l - a * (-1.0).max((k - 3.0).min(9.0 - k).min(1.0)));
          }
        } orelse panic();
      }
    }

## HSV

    let srgbToHsv(rgb: Matrix): Matrix {
      mapRows(rgb) { row, builder =>
        do {
          let r = row[0];
          let g = row[1];
          let b = row[2];
          let max = r.max(g).max(b);
          let spread = max - r.min(g).min(b);
          let h = if (spread == 0.0) { 0.0 } else { hueDegrees(r, g, b, max, spread) };
          let s = if (max == 0.0) { 0.0 } else { spread / max };
          builder.add(h);
          builder.add(s);
          builder.add(max);
        } orelse panic();
      }
    }

    let hsvToSrgb(hsv: Matrix): Matrix {
      mapRows(hsv) { row, builder =>
        do {
          let sixths = row[0] / 60.0;
          let s = row[1];
          let v = row[2];
          for (var n = 0; n < 3; n += 1) {
            let offset = if (n == 0) { 5.0 } else if (n == 1) { 3.0 } else { 1.0 };
            let k = wrap(offset + sixths, 6.0);
            builder.add(v - v * s * 0.0.max(k.min(4.0 - k).min(1.0)));
          }
        } orelse panic();
      }
    }

## HWB

Whiteness and blackness relate to HSV as `w = (1 - s) * v` and `b = 1 - v`.
When whiteness and blackness add up to 1 or more, CSS scales them down, which
gives a gray.

    let hsvToHwb(hsv: Matrix): Matrix {
      mapRows(hsv) { row, builder =>
        do {
          let s = row[1];
          let v = row[2];
          builder.add(row[0]);
          builder.add((1.0 - s) * v);
          builder.add(1.0 - v);
        } orelse panic();
      }
    }

    let hwbToHsv(hwb: Matrix): Matrix {
      mapRows(hwb) { row, builder =>
        do {
          let w = row[1];
          let b = row[2];
          builder.add(row[0]);
          if (w + b >= 1.0) {
            builder.add(0.0);
            builder.add(w / (w + b));
          } else {
            let v = 1.0 - b;
            builder.add(if (v == 0.0) { 0.0 } else { 1.0 - w / v });
            builder.add(v);
          }
        } orelse panic();
      }
    }

## Tests

Expected values follow the CSS Color 4 examples, with hue in degrees.

    test("hsl conversions") { test =>
      let rgb = Color.fromList(Space.srgb, [
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 0.5,
        1.0, 0.5, 0.0,
        0.5, 0.5, 0.5,
      ]);
      let hsl = Color.fromList(Space.hsl, [
        0.0, 1.0, 0.5,
        120.0, 1.0, 0.5,
        240.0, 1.0, 0.25,
        30.0, 1.0, 0.5,
        0.0, 0.0, 0.5,
      ]);
      assertConvertColors(test, rgb, hsl);
      assertConvertColors(test, hsl, rgb);
    }

Out-of-range input can give negative saturation, which flips to the opposite
hue, and still round trips.

    test("hsl out of range") { test =>
      let rgb = Color.fromList(Space.srgb, [1.5, 1.2, 1.1]);
      let hsl = Color.fromList(Space.hsl, [195.0, 2.0 / 3.0, 1.3]);
      assertConvertColors(test, rgb, hsl);
      assertConvertColors(test, hsl, rgb);
    }

    test("hsv conversions") { test =>
      let rgb = Color.fromList(Space.srgb, [
        1.0, 0.0, 0.0,
        1.0, 0.5, 0.0,
        0.25, 0.5, 0.5,
        0.0, 0.0, 0.0,
      ]);
      let hsv = Color.fromList(Space.hsv, [
        0.0, 1.0, 1.0,
        30.0, 1.0, 1.0,
        180.0, 0.5, 0.5,
        0.0, 0.0, 0.0,
      ]);
      assertConvertColors(test, rgb, hsv);
      assertConvertColors(test, hsv, rgb);
    }

    test("hwb conversions") { test =>
      let hwb = Color.fromList(Space.hwb, [
        0.0, 0.0, 0.0,
        120.0, 0.2, 0.2,
        0.0, 0.6, 0.6,
      ]);
      let rgb = Color.fromList(Space.srgb, [
        1.0, 0.0, 0.0,
        0.2, 0.8, 0.2,
        0.5, 0.5, 0.5,
      ]);
      assertConvertColors(test, hwb, rgb);
    }

[Css4Hsl]: https://www.w3.org/TR/css-color-4/#hsl-to-rgb
