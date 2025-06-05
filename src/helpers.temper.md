# Helpers

Most things here are internal helpers. If we want to export any from the
library, we might should move them somewhere else.

## Asserts

### Assert Near

Provides extra info over simple assert.

    let assertNear(test: Test, label: String, a: Float64, b: Float64): Void {

Hardcode the tolerance we expect for our color operations.

      let absTol = 1e-5;
      assert(a.near(b, null, absTol)) {
        "${label} ${a} not near ${b} with absTol ${absTol}"
      }
    }

### Assert Color Conversion

Assert color lists and also conversion from one space to another.

    let assertColors(test: Test, actual: Color, expected: Color): Void {
      assert(actual.space == expected.space);
      for (var i = 0; i < actual.length; i += 1) {
        let iText = i.toString();
        for (var j = 0; j < actual.width; j += 1) {
          let label = "[${iText}, ${j}]";
          assertNear(test, label, actual[i, j], expected[i, j]) orelse panic();
        }
      }
    }

    let assertConvertColors(
      test: Test, source: Color, expected: Color
    ): Void | Bubble {
      assertColors(test, source.to(expected.space), expected);
    }

## Clamp Withing Bounds

### Clamp Float

    let clamp(x: Float64, low: Float64, high: Float64): Float64 {

This is a case where the infix is less clear, even though it's sometimes already
hard for me to think about max and min correctly.

      x.max(low).min(high)
    }

### Clamp Int

Separated from clamp for floats because I'm not sure generics across languages
can be trusted to be efficient.

    let clampInt(i: Int, low: Int, high: Int): Int {

Also, we don't have builtin max/min for ints.

      if (i < low) {
        low
      } else if (i > high) {
        high
      } else {
        i
      }
    }

### Clamp Int to Byte Range

    let clampByte(i: Int): Int { clampInt(i, 0, 255) }

### Clamp Float to Unit Range

    let clampUnit(x: Float64): Float64 { clamp(x, 0.0, 1.0) }

## Formatting

### String Joining

    let join(strings: Listed<String>): String { strings.join("") { (it);; it } }

### String Padding

Pad left to a minimum size in code points, where `pad` is expected to be a
single code point.

    let padLeft(string: String, minSize: Int, pad: String): String {

Optimize the case where we have no padding to add.

      let needed = minSize - string.countBetween(String.begin, string.end);
      if (needed <= 0) {
        return string;
      }

We need padding.

      let builder = new StringBuilder();
      for (var i = 0; i < needed; i += 1) {
        builder.append(pad);
      }
      builder.append(string);
      builder.toString()
    }

    test("padLeft") {
      assert(padLeft("hi", 1, " ") == "hi");
      assert(padLeft("hi", 3, " ") == " hi");
    }

## Math

### Cube Root

Should we implement `cbrt` in Temper implicits?

    let cbrt(x: Float64): Float64 { x ** (1.0 / 3.0) }

## Imports

    let { StringBuilder } = import("std/strings");
