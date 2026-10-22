# Conversion

Each space converts to and from one parent space, forming a tree rooted at
linear sRGB. Converting climbs from the source to the nearest space shared with
the target, then walks down to the target. So each new space needs only one
pair of functions, and nearby spaces take no detours, such as Oklab to OkLCh.

Linear sRGB is the root, rather than CSS's XYZ-D65, so common conversions need
no extra matrix multiply. Other RGB spaces can still go through XYZ by
precombining matrices.

    export let convert(rows: Matrix, from: Space, to: Space): Matrix throws Bubble {
      if (from == to) {
        return rows;
      }
      let toChain = ancestry(to);
      var current = rows;
      var space = from;
      var index = indexIn(toChain, space);
      while (index < 0) {
        current = toParent(current, space);
        space = parentOf(space);
        index = indexIn(toChain, space);
      }
      for (var i = index - 1; i >= 0; i -= 1) {
        current = fromParent(current, toChain[i]);
      }
      current
    }

## The Tree

The root is its own parent. Unknown spaces bubble.

    let parentOf(space: Space): Space throws Bubble {
      when (space) {
        Space.srgbLinear -> Space.srgbLinear;
        Space.srgb -> Space.srgbLinear;
        Space.oklab -> Space.srgbLinear;
        Space.oklch -> Space.oklab;
        else -> bubble();
      }
    }

    let toParent(rows: Matrix, space: Space): Matrix throws Bubble {
      when (space) {
        Space.srgb -> srgbGammaToLinear(rows);
        Space.oklab -> oklabToSrgbLinear(rows);
        Space.oklch -> lchToLab(rows);
        else -> bubble();
      }
    }

    let fromParent(rows: Matrix, space: Space): Matrix throws Bubble {
      when (space) {
        Space.srgb -> srgbLinearToGamma(rows);
        Space.oklab -> srgbLinearToOklab(rows);
        Space.oklch -> labToLch(rows);
        else -> bubble();
      }
    }

## Paths

A space followed by its ancestors, ending at the root.

    let ancestry(space: Space): List<Space> throws Bubble {
      let builder = new ListBuilder<Space>();
      var current = space;
      while (true) {
        builder.add(current);
        let parent = parentOf(current);
        if (parent == current) {
          break;
        }
        current = parent;
      }
      builder.toList()
    }

    let indexIn(spaces: List<Space>, space: Space): Int {
      for (var i = 0; i < spaces.length; i += 1) {
        if ((spaces[i] orelse panic()) == space) {
          return i;
        }
      }
      -1
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

Converting to or from a space outside the tree bubbles.

    test("convert unknown space bubbles") {
      let rows = Matrix.rowOf([0.5, 0.5, 0.5]);
      let custom = new Space("custom", 3);
      assert(do { convert(rows, Space.srgb, custom); false } orelse true);
      assert(do { convert(rows, custom, Space.srgb); false } orelse true);
    }
