# Helpers

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

## Cube Root

Should we implement `cbrt` in Temper implicits?

    let cbrt(x: Float64): Float64 { x ** (1.0 / 3.0) }
