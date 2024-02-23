# Helpers

Most things here are internal helpers. If we want to export any from the
library, we might should move them somewhere else.

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

      let needed = minSize - string.codePoints.length;
      if (needed <= 0) {
        return string;
      }

We need padding.

      let builder = new ListBuilder<String>();
      for (var i = 0; i < needed; i += 1) {
        builder.add(pad);
      }
      builder.add(string);
      join(builder)
    }

    test("padLeft") {
      assert(padLeft("hi", 1, " ") == "hi");
      assert(padLeft("hi", 3, " ") == " hi");
    }

## Math

### Cube Root

Should we implement `cbrt` in Temper implicits?

    let cbrt(x: Float64): Float64 { x ** (1.0 / 3.0) }
