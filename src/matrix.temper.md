# Matrix

Until we have a builtin backend-connected ND array type, here's a matrix type
that can efficiently represent lists of color of arbitrary dimensionality. We
might also want to represent some transforms as matrix operations.

    export class Matrix {

## Constructor

Our representation here is row-major. For colors, that makes each column a
channel and each row a new color. In part so that long lists can print nicer.
From this perspective it makes sense to specify positive dimensionality but
possibly zero length, calling the number of rows the length. The number of rows
is inferred from `ncols` and `values.length`.

Also, an immutable list is passed in so that matrices also are immutable.

TODO Implement nice printing.

      constructor(ncols: Int, values: List<Float64>): Void | Bubble {
        if (ncols <= 0) { bubble() }
        if (values.length % ncols != 0) { bubble() }
        this.nrows = values.length / ncols;
        this.ncols = ncols;
        this.values = values;
      }

      public nrows: Int;
      public ncols: Int;

## Get Individual Value

    public get(i: Int, j: Int): Float64 | Bubble { values[i * ncols + j] }

## Get Whole Row

For retrieving a row, if you pass in a buffer, it gets returned. Otherwise,
returns a new `List`. If you pass in a buffer, if its length is less than
`ncols`, new values are appended. Otherwise, values are just set.

TODO If we provide a way to shrink ListBuilders, should we do that here if it's
too long?

      public row(
        i: Int,
        buffer: ListBuilder<Float64> | Null = null,
      ): Listed<Float64> | Bubble {
        if (i >= nrows) { bubble() }
        let offset = i * ncols;
        let buf = buffer.as<ListBuilder<Float64>>() orelse do {
          return values.slice(offset, offset + ncols);
        };
        for (var j = 0; j < ncols; j += 1) {
          let value = values[offset + j];
          if (j < buf.length) {
            buf[j] = value;
          } else {
            buf.add(value);
          }
        }
        buf
      }

## Private Members

Keep `values` private in case that makes sense for some backend-connected matrix
types in the future.

      let values: List<Float64>;
    }

## Tests

    test("basic matrix access") {
      let matrix = new Matrix(2, [1.2, 3.4, 5.6, 7.8]);
      assert(matrix.nrows == 2);

Results for [0, 1] or [1, 0] depend on row vs column major.

      assert(matrix[0, 1] == 3.4);

Check both return value and buffer mutation.

      let row = new ListBuilder<Float64>();
      assert(matrix.row(1, row)[0] == 5.6);
      assert(row[1] == 7.8);

Also check non-buffered row access.

      assert(matrix.row(0)[1] == 3.4);
    }
