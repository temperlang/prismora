# Generic Conversions

These operations might be appropriate for more than one color space.

## 8-Bit <-> Unit-Bounded

These take an byte-per-channel int value, such as 0x112233. This requires at
least 24 bits in the backend int representation. TODO Can we promise that?

    export let intToUnit(rows: List<Int>): Matrix {
      new Matrix(
        3,
        do {
          let builder = new ListBuilder<Float64>();
          for (var i = 0; i < rows.length; i += 1) {
            let row = rows[i];

TODO Do we have bit shifting?

            let x = (row & 0xFF0000) / 0x10000;
            let y = (row & 0xFF00) / 0x100;
            let z = row & 0xFF;

These are safe because we controlled the bounds above.

            builder.add(x.toFloat64Unsafe());
            builder.add(y.toFloat64Unsafe());
            builder.add(z.toFloat64Unsafe());
          }
          builder.toList()
        } orelse panic(),
      )
    }

    export let unitToInt(rows: Matrix): List<Int> {
      unitToByte(rows).mapRowsToList { (row: Listed<Float64>): Int;;
        let x = clampToIntByte(row[0] orelse panic());
        let y = clampToIntByte(row[1] orelse panic());
        let z = clampToIntByte(row[2] orelse panic());

Again, bit shifting would be nice here. Maybe some backends can optimize,
anyway?

        x * 0x10000 + y * 0x100 + z
      }
    }

Support convenient string formatting of packed int colors. Common HTML/CSS
formatting for RGB with leading "\#" is defined with other RGB operations.

    export let unitToString(rows: Matrix): List<String> {
      unitToInt(rows).map { (i): String;; padLeft(i.toString(16), 6, "0") }
    }

    test("unitToString top bound and left pad") {
      let rows = Matrix.rowOf([0.0, 0.5, 1.0]);
      assert(unitToInt(rows)[0] == 0x0080ff);
      assert(unitToString(rows)[0] == "0080ff");
    }

These operate on floats rather than ints.

    export let byteToUnit(rows: Matrix): Matrix {
      rows.map { (x);; (x / 255.0) orelse panic() }
    }

    export let unitToByte(rows: Matrix): Matrix { rows.map { (x);; x * 255.0 } }

Presumes that `x` is known to be approximately in the 0 to 255 range already.

    export let clampToIntByte(x: Float64): Int {
      clampByte(x.round().toIntUnsafe())
    }
