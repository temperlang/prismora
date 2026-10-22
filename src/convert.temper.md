# Spaces and Conversion

## Spaces

Each space can have a parent space it converts to and from. Spaces form trees,
with linear sRGB as the root for those defined here. Converting climbs from the
source to the nearest space shared with the target, then walks down to the
target. So a new space needs only one pair of functions, and nearby spaces take
no detours, such as Oklab to OkLCh.

Linear sRGB is the root, rather than CSS's XYZ-D65, so common conversions need
no extra matrix multiply. Other RGB spaces can still go through XYZ by
precombining matrices.

    export class Space(

The name is considered a unique full identifier. If defining new spaces outside
this library, use some namespace prefix.

      public name: String,
      public ncols: Int,

A space without a parent is a root. So `new Space("custom", 3)` is valid, but
it converts only to itself.

      public parent: Space? = null,
    ) {

Roots have depth 0.

      public depth: Int = do {
        let p = parent;
        if (p == null) { 0 } else { p.depth + 1 }
      };

      public toString(): String { name }

      @operator("==")
      public eq(other: Space): Boolean { name == other.name }

Some of the supported spaces here aren't considered by everyone to be true
separate "spaces". For example, some consider RGB and HSV just to be different
representations of the same space, but we don't make that distinction here.

      public static srgbLinear = new Space("srgbLinear", 3);
      public static srgb = new Space("srgb", 3, Space.srgbLinear);
      public static oklab = new Space("oklab", 3, Space.srgbLinear);
      public static oklch = new Space("oklch", 3, Space.oklab);
      public static hsl = new Space("hsl", 3, Space.srgb);
      public static hsv = new Space("hsv", 3, Space.srgb);
      public static hwb = new Space("hwb", 3, Space.hsv);
      public static displayP3 = new Space("displayP3", 3, Space.srgbLinear);
      public static a98Rgb = new Space("a98Rgb", 3, Space.srgbLinear);
      public static prophotoRgb = new Space("prophotoRgb", 3, Space.srgbLinear);
      public static rec2020 = new Space("rec2020", 3, Space.srgbLinear);
      public static xyzD65 = new Space("xyzD65", 3, Space.srgbLinear);
      public static xyzD50 = new Space("xyzD50", 3, Space.xyzD65);
      public static lab = new Space("lab", 3, Space.xyzD50);
      public static lch = new Space("lch", 3, Space.lab);
    }

## Conversion

Climbing just follows fields, and nothing is allocated beyond the converted
matrices, which matters for single colors.

    export let convert(rows: Matrix, from: Space, to: Space): Matrix throws Bubble {
      if (from == to) {
        return rows;
      }

Climb the deeper side until both sides are at the same depth, then climb both
until they meet. Only the source side converts on the way up. Spaces in
different trees never meet, so climbing past a root bubbles.

      var current = rows;
      var up = from;
      var meet = to;
      while (up.depth > meet.depth) {
        current = toParent(current, up);
        up = parentOf(up);
      }
      while (meet.depth > up.depth) {
        meet = parentOf(meet);
      }
      while (up != meet) {
        current = toParent(current, up);
        up = parentOf(up);
        meet = parentOf(meet);
      }
      descend(current, up, to)
    }

    let parentOf(space: Space): Space throws Bubble {
      let parent = space.parent;
      if (parent == null) { bubble() } else { parent }
    }

Convert down from an ancestor to a descendant. Trees are shallow, so recursion
stays shallow.

    let descend(rows: Matrix, ancestor: Space, space: Space): Matrix throws Bubble {
      if (space == ancestor) {
        rows
      } else {
        fromParent(descend(rows, ancestor, parentOf(space)), space)
      }
    }

## Steps

Each space's conversion to and from its parent.

TODO Store these as function fields on `Space` instead, which would let users
add connected spaces. For now, the py backend defines class statics before the
functions they reference, and calling function fields directly needs a local.

    let toParent(rows: Matrix, space: Space): Matrix throws Bubble {
      when (space) {
        Space.srgb -> srgbGammaToLinear(rows);
        Space.oklab -> oklabToSrgbLinear(rows);
        Space.oklch -> lchToLab(rows);
        Space.hsl -> hslToSrgb(rows);
        Space.hsv -> hsvToSrgb(rows);
        Space.hwb -> hwbToHsv(rows);
        Space.displayP3 -> displayP3ToSrgbLinear(rows);
        Space.a98Rgb -> a98RgbToSrgbLinear(rows);
        Space.prophotoRgb -> prophotoRgbToSrgbLinear(rows);
        Space.rec2020 -> rec2020ToSrgbLinear(rows);
        Space.xyzD65 -> xyzD65ToSrgbLinear(rows);
        Space.xyzD50 -> xyzD50ToXyzD65(rows);
        Space.lab -> labToXyzD50(rows);
        Space.lch -> cieLchToLab(rows);
        else -> bubble();
      }
    }

    let fromParent(rows: Matrix, space: Space): Matrix throws Bubble {
      when (space) {
        Space.srgb -> srgbLinearToGamma(rows);
        Space.oklab -> srgbLinearToOklab(rows);
        Space.oklch -> labToLch(rows);
        Space.hsl -> srgbToHsl(rows);
        Space.hsv -> srgbToHsv(rows);
        Space.hwb -> hsvToHwb(rows);
        Space.displayP3 -> srgbLinearToDisplayP3(rows);
        Space.a98Rgb -> srgbLinearToA98Rgb(rows);
        Space.prophotoRgb -> srgbLinearToProphotoRgb(rows);
        Space.rec2020 -> srgbLinearToRec2020(rows);
        Space.xyzD65 -> srgbLinearToXyzD65(rows);
        Space.xyzD50 -> xyzD65ToXyzD50(rows);
        Space.lab -> xyzD50ToLab(rows);
        Space.lch -> cieLabToLch(rows);
        else -> bubble();
      }
    }

## Tests

Every pair of spaces should round trip.

    test("convert round trips between all spaces") { test =>
      let spaces = [
        Space.srgb, Space.srgbLinear, Space.oklab, Space.oklch, Space.hsl, Space.hsv, Space.hwb,
        Space.displayP3, Space.a98Rgb, Space.prophotoRgb, Space.rec2020,
        Space.xyzD65, Space.xyzD50, Space.lab, Space.lch,
      ];
      let source = Color.from(Space.srgb, [0.2, 0.4, 0.6, 0.9, 0.1, 0.3]);
      for (var i = 0; i < spaces.length; i += 1) {
        let from = source.to(spaces[i]);
        for (var j = 0; j < spaces.length; j += 1) {
          assertColors(test, from, from.to(spaces[j]).to(spaces[i]));
        }
      }
    }

Converting between spaces in different trees bubbles.

    test("convert unconnected space bubbles") {
      let rows = Matrix.rowOf([0.5, 0.5, 0.5]);
      let custom = new Space("custom", 3);
      assert(do { convert(rows, Space.srgb, custom); false } orelse true);
      assert(do { convert(rows, custom, Space.srgb); false } orelse true);
    }
