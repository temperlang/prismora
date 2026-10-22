# Spaces and Conversion

## Spaces

Each space can have a parent space, plus functions to convert to and from it.
Spaces form trees, with linear sRGB as the root for those defined here.
Converting climbs from the source to the nearest space shared with the target,
then walks down to the target. So a new space needs only one pair of functions,
and nearby spaces take no detours, such as Oklab to OkLCh.

Linear sRGB is the root, rather than CSS's XYZ-D65, so common conversions need
no extra matrix multiply. Other RGB spaces can still go through XYZ by
precombining matrices.

TODO How to say that we want to support identity equality on a type?

    export class Space(

The name is considered a unique full identifier. If defining new spaces outside
this library, use some namespace prefix.

      public name: String,
      public ncols: Int,

A space without a parent is a root. Its conversion functions are never called.
So `new Space("custom", 3)` is valid, but it converts only to itself.

      public parent: Space? = null,
      public toParent: fn (Matrix): Matrix = fn (rows: Matrix): Matrix { rows },
      public fromParent: fn (Matrix): Matrix = fn (rows: Matrix): Matrix { rows },
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

TODO Pass functions directly once the py backend defines functions before
statics that reference them. For now, wrapping defers the lookup.

      public static srgbLinear = new Space("srgbLinear", 3);
      public static srgb = new Space(
        "srgb", 3, Space.srgbLinear,
        fn (rows: Matrix): Matrix { srgbGammaToLinear(rows) },
        fn (rows: Matrix): Matrix { srgbLinearToGamma(rows) },
      );
      public static oklab = new Space(
        "oklab", 3, Space.srgbLinear,
        fn (rows: Matrix): Matrix { oklabToSrgbLinear(rows) },
        fn (rows: Matrix): Matrix { srgbLinearToOklab(rows) },
      );
      public static oklch = new Space(
        "oklch", 3, Space.oklab,
        fn (rows: Matrix): Matrix { lchToLab(rows) },
        fn (rows: Matrix): Matrix { labToLch(rows) },
      );

HSV isn't implemented yet, so it has no parent.

      public static hsv = new Space("hsv", 3);
    }

## Conversion

Conversion just follows fields, with no lookups and nothing allocated beyond
the converted matrices, which matters for single colors.

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
        current = climb(current, up);
        up = parentOf(up);
      }
      while (meet.depth > up.depth) {
        meet = parentOf(meet);
      }
      while (up != meet) {
        current = climb(current, up);
        up = parentOf(up);
        meet = parentOf(meet);
      }
      descend(current, up, to)
    }

Calling a function field directly as `space.toParent(rows)` doesn't work in
Temper yet, so copy it to a local first.

    let climb(rows: Matrix, space: Space): Matrix {
      let step = space.toParent;
      step(rows)
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
        let step = space.fromParent;
        step(descend(rows, ancestor, parentOf(space)))
      }
    }

## Tests

Every pair of spaces should round trip.

    test("convert round trips between all spaces") { test =>
      let spaces = [Space.srgb, Space.srgbLinear, Space.oklab, Space.oklch];
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

A custom space can join the tree with its own functions.

    test("convert custom child space") { test =>
      let halved = new Space(
        "test.halved", 3, Space.srgb,
        fn (rows: Matrix): Matrix { rows.map { x => x * 2.0 } },
        fn (rows: Matrix): Matrix { rows.map { x => x * 0.5 } },
      );
      let source = Color.from(Space.oklab, [0.5, 0.1, 0.05]);
      let viaHalved = source.to(halved);
      let viaSrgb = source.to(Space.srgb);
      assertNear(test, "halved", viaHalved[0, 1], viaSrgb[0, 1] * 0.5);
      assertColors(test, source, viaHalved.to(Space.oklab));
    }
