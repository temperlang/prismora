# Generic Conversions

These operations might be appropriate for more than one color space.

## 8-Bit <-> Unit-Bounded

These take an byte-per-channel int value, such as 0x112233. This requires at
least 24 bits in the backend int representation. Can we promise that?

    export let intToUnit(vec: Int): Vec3 {

TODO Do we have bit shifting?

      let x = (vec & 0xFF0000) / 0x10000;
      let y = (vec & 0xFF00) / 0x100;
      let z = vec & 0xFF;
      byteToUnit({

These are safe because we controlled the bounds above.

And I do a lot of repeating myself for each channel here. I could make a
`mapVec` function, but I'm afraid the callback will be inefficient on some
backends. On the other hand, on NumPy, just operating a 3xN array all at once
would be most efficient for channel-wise ops. This would be a case where known
array-friendly ops and a backend-connected map function might be better.

        x: x.toFloat64Unsafe(),
        y: y.toFloat64Unsafe(),
        z: z.toFloat64Unsafe(),
      })
    }

    export let unitToInt(vec: Vec3): Int {
      let byte = unitToByte(vec);
      let x = clampToIntByte(byte.x);
      let y = clampToIntByte(byte.y);
      let z = clampToIntByte(byte.z);

Again, bit shifting would be nice here. Maybe some backends can optimize,
anyway?

      x * 0x10000 + y * 0x100 + z
    }

Support convenient string formatting of packed int colors. Common HTML/CSS
formatting for RGB with leading "\#" is defined with other RGB operations.

    export let unitToString(vec: Vec3): String {
      padLeft(unitToInt(vec).toString(16), 6, "0")
    }

    test("unitToString top bound and left pad") {
      let vec = new Vec3(0.0, 0.5, 1.0);
      assert(unitToInt(vec) == 0x0080ff);
      assert(unitToString(vec) == "0080ff");
    }

These operate on floats rather than ints.

    export let byteToUnit(vec: Vec3): Vec3 {
      {
        x: vec.x / 255.0,
        y: vec.y / 255.0,
        z: vec.z / 255.0,
      }
    }

    export let unitToByte(vec: Vec3): Vec3 {
      {
        x: vec.x * 255.0,
        y: vec.y * 255.0,
        z: vec.z * 255.0,
      }
    }

Presumes that `x` is known to be approximately in the 0 to 255 range already.

    export let clampToIntByte(x: Float64): Int {
      clampByte(x.round().toIntUnsafe())
    }
