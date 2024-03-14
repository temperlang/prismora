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

## Single-Row Factory

For convenience, provide a factory method for single-row matrices.

      public static rowOf(values: List<Float64>): Matrix {
        { ncols: values.length, values }
      }

## Get Individual Value

Get by full coordinates.

    public get(i: Int, j: Int): Float64 | Bubble { values[i * ncols + j] }

Or by flat.

    public at(i: Int): Float64 | Bubble { values[i] }

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

## Map Values

Map individually to create a new matrix.

    public map(transform: fn (Float64): Float64): Matrix {
      new Matrix(ncols, values.map(transform))
    }

Or by row, adding new values on to the provided builder for each call. If
`this` doesn't have at least one row, or if built rows are empty or
inconsistent, then bubble.

    public mapRows(
      build: fn (row: Listed<Float64>, builder: ListBuilder<Float64>): Void,
    ): Matrix | Bubble {
      let builder = new ListBuilder<Float64>();
      let buffer = new ListBuilder<Float64>();
      var ncols = 0;
      for (var i = 0; i < nrows; i += 1) {
        build(row(i, buffer), builder);
        if (i == 0) {
          ncols = builder.length;
        }
      }
      { ncols, values: builder.toList() }
    }

Or to create a list of whatever by row.

    public mapRowsToList<T>(transform: fn (Listed<Float64>): T): List<T> {
      let builder = new ListBuilder<T>();
      let buffer = new ListBuilder<Float64>();
      for (var i = 0; i < nrows; i += 1) {
        builder.add(transform(row(i, buffer)));
      }
      builder.toList()
    }

## Math

### Matrix Multiply

    public mul(other: Matrix): Matrix | Bubble {
      if (ncols != other.nrows) { bubble() }
      mapRows { (row, builder);;
        for (var k = 0; k < other.ncols; k += 1) {
          var sum = 0.0;
          for (var j = 0; j < ncols; j += 1) {
            sum += other[j, k];
          }
          builder.add(sum);
        }
      }
    }

## Private Members

Keep `values` private in case that makes sense for some backend-connected matrix
types in the future.

      let values: List<Float64>;
    }

## Tests

### Basic Access

    test("matrix basic access") {
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

### Map

    test("matrix map") {
      let matrix = new Matrix(3, [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
      let half = matrix.map { (x);; x * 0.5 };
      assert(half.ncols == matrix.ncols);
      assert(half.nrows == matrix.nrows);
      assert(half[0, 0] == 0.5);
      assert(half[1, 2] == 3.0);
    }
