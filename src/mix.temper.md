# Mixing and Gradients

Mixing blends two colors, as CSS's `color-mix()` does, and gradients blend a
series of them, both following [CSS Color 4 interpolation][CssInterpolation].
Blending happens in a chosen space, and the result is in that space:

- **Oklab** is CSS's default and usually the best choice: perceptually even,
  with no hue to go around the wrong way.
- **Spaces with hue,** such as OkLCh, keep colors vivid through the middle,
  going around the hue wheel by a chosen path.
- **sRGB** matches older browsers and many tools, but midpoints can look dull
  or dark.

The methods are on `Color`: `mix`, `mixHue`, `gradient` and `gradientHue`.

## Hue Paths

Which way around the hue wheel to go, when blending in a space with hue.

    export class HueMethod {
      public name: String;

The constructor is private: blending handles exactly the methods below.

      private constructor(name: String) {
        this.name = name;
      }

      public toString(): String { name }

      @operator("==")
      public eq(other: HueMethod): Boolean { name == other.name }

The shorter way, the default.

      public static shorter = new HueMethod("shorter");

The longer way.

      public static longer = new HueMethod("longer");

Always increasing or always decreasing hue. These match `shorter` or
`longer` depending on the hues, but don't flip direction partway through an
animation, when the hues pass opposite each other.

      public static increasing = new HueMethod("increasing");
      public static decreasing = new HueMethod("decreasing");
    }

## Hue Channels

Which channel holds hue, or -1 for spaces without one.

    let hueIndex(space: Space): Int {
      when (space) {
        Space.oklch, Space.lch -> 2;
        Space.hsl, Space.hsv, Space.hwb -> 0;
        else -> -1;
      }
    }

Whether hue has no effect on a row, because it's gray, and which channel
measures how colorful it is, or -1 for HWB, where whiteness and blackness
together decide. Thresholds are CSS's, scaled to Chromarite's 0 to 1 channels.
HSV isn't in CSS, so it follows HSL.

    let hueIsPowerless(space: Space, row: Listed<Float64>): Boolean throws Bubble {
      when (space) {
        Space.oklch -> row[1] <= 0.000004;
        Space.lch -> row[1] <= 0.0015;
        Space.hsl, Space.hsv -> row[1] <= 0.00001;
        Space.hwb -> row[1] + row[2] >= 0.99999;
        else -> false;
      }
    }

    let colorfulnessIndex(space: Space): Int {
      when (space) {
        Space.oklch, Space.lch, Space.hsl, Space.hsv -> 1;
        else -> -1;
      }
    }

## Mixing

Mixes rows of `a` and `b`, by `amount` toward `b`. Either may have one row,
which is used for every row of the other; otherwise their lengths must match,
or this panics. Alpha in the result is null only if both inputs are opaque.

    let mixColors(
      a: Color, b: Color, amount: Float64, space: Space, hue: HueMethod,
    ): Color throws Bubble {
      let length = if (a.length == b.length || b.length == 1) {
        a.length
      } else if (a.length == 1) {
        b.length
      } else {
        panic()
      };
      let rowsA = a.toSpace(space).rows;
      let rowsB = b.toSpace(space).rows;
      let mixed = new Blend(space, hue);
      for (var i = 0; i < length; i += 1) {
        let ia = if (a.length == 1) { 0 } else { i };
        let ib = if (b.length == 1) { 0 } else { i };
        mixed.add(rowsA, ia, a.alphaAt(ia), rowsB, ib, b.alphaAt(ib), amount);
      }
      mixed.toColor(a.alpha == null && b.alpha == null)
    }

## Gradients

`count` colors evenly spaced along the rows of `stops`, from the first row
to the last. One color gives the first stop. Panics on no stops.

    let gradientColors(stops: Color, count: Int, space: Space, hue: HueMethod): Color throws Bubble {
      let nstops = stops.length;
      if (nstops == 0) { panic() }
      let rows = stops.toSpace(space).rows;
      let mixed = new Blend(space, hue);
      for (var i = 0; i < count; i += 1) {
        if (nstops == 1 || count == 1) {
          mixed.add(rows, 0, stops.alphaAt(0), rows, 0, stops.alphaAt(0), 0.0);
        } else {

Where this color falls along the stops, as a stop index with a fraction.

          let position = i.toFloat64() * (nstops - 1).toFloat64() / (count - 1).toFloat64();
          let k = position.floor().toInt32Unsafe().min(nstops - 2);
          let t = position - k.toFloat64();
          mixed.add(rows, k, stops.alphaAt(k), rows, k + 1, stops.alphaAt(k + 1), t);
        }
      }
      mixed.toColor(stops.alpha == null)
    }

## Blending Rows

Builds blended rows one at a time, following CSS's steps:

1. A gray's hue has no effect, so it takes the other color's hue, and its
   tiny colorfulness becomes 0. If both are gray, hue is 0, as elsewhere in
   Chromarite.
2. Hues are adjusted for the chosen path around the wheel.
3. Channels other than hue are premultiplied by alpha, so that fading toward
   transparent doesn't drift toward the transparent color's channels.
4. Channels and alpha are interpolated linearly, then divided by the new
   alpha unless it's 0.

It collects channels and alpha for the result as it goes.

    class Blend(
      private space: Space,
      private hue: HueMethod,
    ) {
      private channels: ListBuilder<Float64> = new ListBuilder<Float64>();
      private alphas: ListBuilder<Float64> = new ListBuilder<Float64>();

      public add(
        rowsA: Matrix, ia: Int, alphaA: Float64,
        rowsB: Matrix, ib: Int, alphaB: Float64,
        t: Float64,
      ): Void throws Bubble {
        let ncols = space.width;
        let x = new ListBuilder<Float64>();
        let y = new ListBuilder<Float64>();
        for (var j = 0; j < ncols; j += 1) {
          x.add(rowsA[ia, j]);
          y.add(rowsB[ib, j]);
        }
        let h = hueIndex(space);
        if (h >= 0) {
          fixHues(x, y, h);
        }
        let alpha = alphaA + (alphaB - alphaA) * t;
        for (var j = 0; j < ncols; j += 1) {
          if (j == h) {
            channels.add(wrap(x[j] + (y[j] - x[j]) * t, 360.0));
          } else {
            let premultiplied = x[j] * alphaA + (y[j] * alphaB - x[j] * alphaA) * t;
            channels.add(if (alpha == 0.0) { premultiplied } else { premultiplied / alpha });
          }
        }
        alphas.add(alpha);
      }

Steps 1 and 2 for the hue channel `h`, in place.

      private fixHues(x: ListBuilder<Float64>, y: ListBuilder<Float64>, h: Int): Void throws Bubble {
        let grayX = hueIsPowerless(space, x);
        let grayY = hueIsPowerless(space, y);
        let c = colorfulnessIndex(space);
        if (grayX && c >= 0 && x[c] > 0.0) { x.set(c, 0.0) }
        if (grayY && c >= 0 && y[c] > 0.0) { y.set(c, 0.0) }
        if (grayX && grayY) {
          x.set(h, 0.0);
          y.set(h, 0.0);
        } else if (grayX) {
          x.set(h, y[h]);
        } else if (grayY) {
          y.set(h, x[h]);
        }
        let h1 = wrap(x[h], 360.0);
        let h2 = wrap(y[h], 360.0);
        let diff = h2 - h1;
        if (hue == HueMethod.shorter) {
          if (diff > 180.0) {
            x.set(h, h1 + 360.0);
            y.set(h, h2);
          } else if (diff < -180.0) {
            x.set(h, h1);
            y.set(h, h2 + 360.0);
          } else {
            x.set(h, h1);
            y.set(h, h2);
          }
        } else if (hue == HueMethod.longer) {
          if (diff > 0.0 && diff < 180.0) {
            x.set(h, h1 + 360.0);
            y.set(h, h2);
          } else if (diff > -180.0 && diff <= 0.0) {
            x.set(h, h1);
            y.set(h, h2 + 360.0);
          } else {
            x.set(h, h1);
            y.set(h, h2);
          }
        } else if (hue == HueMethod.increasing) {
          x.set(h, h1);
          y.set(h, if (h2 < h1) { h2 + 360.0 } else { h2 });
        } else {
          x.set(h, if (h1 < h2) { h1 + 360.0 } else { h1 });
          y.set(h, h2);
        }
      }

      public toColor(opaque: Boolean): Color {
        let rows = Color.fromRows(space, new Matrix(space.width, channels.toList()));
        if (opaque) { rows } else { rows.withAlpha(alphas.toList()) }
      }
    }

## Tests

Hue path examples from CSS Color 4.

    test("hue paths") { test =>
      let red = Color.fromList(Space.oklch, [0.6, 0.24, 30.0]);
      let yellow = Color.fromList(Space.oklch, [0.8, 0.15, 90.0]);
      assertColors(test, red.mix(yellow, 0.5, Space.oklch), Color.fromList(Space.oklch, [
        0.7, 0.195, 60.0,
      ]));
      assertColors(test, red.mixHue(yellow, 0.5, Space.oklch, HueMethod.longer), Color.fromList(Space.oklch, [
        0.7, 0.195, 240.0,
      ]));
      let brown = Color.fromList(Space.oklch, [0.5, 0.1, 30.0]);
      let turquoise = Color.fromList(Space.oklch, [0.7, 0.1, 190.0]);
      assertColors(test, brown.mixHue(turquoise, 0.5, Space.oklch, HueMethod.increasing), Color.fromList(Space.oklch, [
        0.6, 0.1, 110.0,
      ]));
      assertColors(test, brown.mixHue(turquoise, 0.5, Space.oklch, HueMethod.decreasing), Color.fromList(Space.oklch, [
        0.6, 0.1, 290.0,
      ]));
    }

A gray takes the other color's hue, so white to blue doesn't pass through
magenta.

    test("gray takes the other hue") { test =>
      let white = Color.fromList(Space.srgb, [1.0, 1.0, 1.0]);
      let blue = Color.fromList(Space.srgb, [0.0, 0.0, 1.0]);
      let blueLch = blue.toSpace(Space.oklch);
      let mid = white.mix(blue, 0.5, Space.oklch);
      assertNear(test, "hue", mid[0, 2], blueLch[0, 2]);
      assertNear(test, "chroma", mid[0, 1], blueLch[0, 1] * 0.5);
      let grays = Color.fromList(Space.hsl, [108.0, 0.0, 0.2, 252.0, 0.0, 0.8]);
      let grayMid = grays.mix(Color.fromList(Space.hsl, [324.0, 0.0, 0.5]), 0.5, Space.hsl);
      assert(grayMid[0, 0] == 0.0);
    }

Oklab blends each channel linearly.

    test("mix in oklab") { test =>
      let red = Color.fromList(Space.srgb, [1.0, 0.0, 0.0]);
      let blue = Color.fromList(Space.srgb, [0.0, 0.0, 1.0]);
      let a = red.toSpace(Space.oklab);
      let b = blue.toSpace(Space.oklab);
      let mid = red.mix(blue, 0.25, Space.oklab);
      assert(mid.space == Space.oklab);
      for (var j = 0; j < 3; j += 1) {
        assertNear(test, "channel", mid[0, j], a[0, j] * 0.75 + b[0, j] * 0.25);
      }
      let noAlpha = mid.alpha == null;
      assert(noAlpha);
    }

Fading to transparent keeps the color, thanks to premultiplying, and one row
mixes with every row of the other.

    test("mix with alpha and one row") { test =>
      let colors = Color.fromListWithAlpha(Space.srgb, [
        1.0, 0.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
      ]);
      let clear = Color.fromListWithAlpha(Space.srgb, [0.0, 0.0, 1.0, 0.0]);
      let faded = colors.mix(clear, 0.5, Space.srgb);
      assertColors(test, faded, Color.fromList(Space.srgb, [
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
      ]));
      assert(faded.alphaAt(0) == 0.5);
      assert(faded.alphaAt(1) == 0.5);
      let gone = colors.mix(clear, 1.0, Space.srgb);
      assert(gone.alphaAt(0) == 0.0);
    }

Gradients hit each stop and blend evenly between them.

    test("gradients") { test =>
      let stops = Color.fromList(Space.srgb, [
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0,
      ]);
      let steps = stops.gradient(5, Space.oklab);
      assert(steps.length == 5);
      let red = Color.fromList(Space.srgb, [1.0, 0.0, 0.0]);
      let green = Color.fromList(Space.srgb, [0.0, 1.0, 0.0]);
      let blue = Color.fromList(Space.srgb, [0.0, 0.0, 1.0]);
      let expected = [
        red.toSpace(Space.oklab),
        red.mix(green, 0.5, Space.oklab),
        green.toSpace(Space.oklab),
        green.mix(blue, 0.5, Space.oklab),
        blue.toSpace(Space.oklab),
      ];
      for (var i = 0; i < 5; i += 1) {
        for (var j = 0; j < 3; j += 1) {
          assertNear(test, "step", steps[i, j], expected[i][0, j]);
        }
      }
      assert(stops.gradient(1, Space.oklab).length == 1);
    }

[CssInterpolation]: https://www.w3.org/TR/css-color-4/#interpolation
