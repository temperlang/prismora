# Matrix

Until we have a builtin backend-connected ND array type, here's a matrix type
that can efficiently represent lists of color of arbitrary dimensionality. We
might also want to represent some transforms as matrix operations.

    export class Matrix(

## Constructor

Our representation here is row-major. For colors, that makes each column a
channel and each row a new color. In part so that long lists can print nicer.
From this perspective it makes sense to specify positive dimensionality but
possibly zero length, calling the number of rows the length. The number of rows
is inferred from `ncols` and `values.length`.

Also, an immutable list is passed in so that matrices also are immutable.

TODO Implement nice printing.

We need to know the number of columns.

      public ncols: Int,

Values is a flat list where each row is made up by a contiguous run of *ncols* entries.
Keep `values` private in case that makes sense for some backend-connected matrix
types in the future.

      private values: List<Float64>,
    ) {

      public nrows: Int = do {
        if (ncols <= 0) { panic() }
        if (((values.length % ncols) orelse panic()) != 0) { panic() }
        (values.length / ncols) orelse panic()
      };

## Single-Row Factory

For convenience, provide a factory method for single-row matrices.

      public static rowOf(values: List<Float64>): Matrix {
        { ncols: values.length, values }
      }

## Get Individual Value

Get by full coordinates.

      public get(i: Int, j: Int): Float64 throws Bubble {
        if (j >= ncols) { bubble() }
        values[i * ncols + j]
      }

Or by flat.

      public at(i: Int): Float64 throws Bubble { values[i] }

## Flat Values

All values in row-major order, as given to the constructor.

      public toList(): List<Float64> { values }

## Map Values

Map individually to create a new matrix.

      public map(transform: fn (Float64): Float64): Matrix {
        new Matrix(ncols, values.map(transform))
      }

Rows, row mapping, multiplying and transposing are internal tools below,
outside the class, so they stay out of the public API in every language.

    }

## Internal Tools

### Rows

For retrieving a row, if you pass in a buffer, it gets returned. Otherwise,
returns a new `List`. If you pass in a buffer, if its length is less than
`ncols`, new values are appended. Otherwise, values are just set.

    let matrixRow(
      m: Matrix,
      i: Int,
      buffer: ListBuilder<Float64>? = null,
    ): Listed<Float64> throws Bubble {
      if (i >= m.nrows) { bubble() }
      let ncols = m.ncols;
      let values = m.toList();
      let offset = i * ncols;
      let buf = buffer ?? do { return values.slice(offset, offset + ncols) };
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

### Mapping Rows

Adds new values on to the provided builder for each row. The first built row
sets the result's `ncols`, and each later row must add the same number of
values, so result rows always line up with input rows. If `m` has no rows, if
the first built row is empty, or if any later row adds a different number of
values, then panic.

    let mapRows(
      m: Matrix,
      build: fn (row: Listed<Float64>, builder: ListBuilder<Float64>): Void,
    ): Matrix {
      let builder = new ListBuilder<Float64>();
      let buffer = new ListBuilder<Float64>();
      var ncols = 0;
      for (var i = 0; i < m.nrows; i += 1) {
        build(matrixRow(m, i, buffer) orelse panic(), builder);
        if (i == 0) {
          ncols = builder.length;
        } else if (builder.length != (i + 1) * ncols) {
          panic();
        }
      }
      new Matrix(ncols, builder.toList())
    }

Or to create a list of whatever by row.

    let mapRowsToList<T>(m: Matrix, transform: fn (Listed<Float64>): T): List<T> {
      let builder = new ListBuilder<T>();
      let buffer = new ListBuilder<Float64>();
      for (var i = 0; i < m.nrows; i += 1) {
        builder.add(transform(matrixRow(m, i, buffer) orelse panic()));
      }
      builder.toList()
    }

### Matrix Multiply

    let times(a: Matrix, b: Matrix): Matrix throws Bubble {
      if (a.ncols != b.nrows) { bubble() }
      mapRows(a) { row, builder =>
        for (var k = 0; k < b.ncols; k += 1) {
          var sum = 0.0;
          for (var j = 0; j < a.ncols; j += 1) {
            sum += (row[j] * b[j, k]) orelse panic();
          }
          builder.add(sum);
        }
      }
    }

### Transpose

TODO Internal stride wrangling to support no-copy transpose?

    let transpose(m: Matrix): Matrix {
      let builder = new ListBuilder<Float64>();
      for (var j = 0; j < m.ncols; j += 1) {
        for (var i = 0; i < m.nrows; i += 1) {
          builder.add(m[i, j] orelse panic());
        }
      }
      new Matrix(m.nrows, builder.toList())
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
      assert(matrixRow(matrix, 1, row)[0] == 5.6);
      assert(row[1] == 7.8);

Also check non-buffered row access.

      assert(matrixRow(matrix, 0)[1] == 3.4);
    }

### Map

    test("matrix map") {
      let matrix = new Matrix(3, [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
      let result = matrix.map { x => x * 0.5 };
      assert(result.nrows == matrix.nrows);
      assert(result.ncols == matrix.ncols);
      assert(result[0, 0] == 0.5);
      assert(result[1, 2] == 3.0);
    }

Mapping rows can change the number of columns, as long as each row adds the
same number of values.

    test("matrix map rows") {
      let matrix = new Matrix(3, [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
      let result = mapRows(matrix) { row, builder =>
        builder.add(row[0] + row[1] + row[2]);
        builder.add(row[0]);
      };
      assert(result.nrows == 2);
      assert(result.ncols == 2);
      assert(result[0, 0] == 6.0);
      assert(result[0, 1] == 1.0);
      assert(result[1, 0] == 15.0);
      assert(result[1, 1] == 4.0);
    }

### Miscellaneous

    test("matrix misc") {
      let rowish = Matrix.rowOf([1.2, 3.4, 5.6]);
      assert(rowish.nrows == 1);
      assert(rowish.ncols == 3);
      assert(rowish.at(1) == 3.4);
      let sumsAsStrings = mapRowsToList(rowish) { (row): String =>
        row.reduceFrom(0.0) { (a: Float64, b): Float64 => a + b }.toString()
      };
      assert(sumsAsStrings.length == 1);
      assert(sumsAsStrings[0] == "10.2");
    }

### Multiply

    test("matrix multiply") {
      let values = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
      let a = new Matrix(3, values);
      let b = new Matrix(2, values);
      let result = times(a, b);
      assert(result.nrows == a.nrows);
      assert(result.ncols == b.ncols);
      assert(result[0, 0] == 22.0);
      assert(result[0, 1] == 28.0);
      assert(result[1, 0] == 49.0);
      assert(result[1, 1] == 64.0);
    }

### Transpose

    test("matrix transpose") {
      let matrix = new Matrix(3, [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
      let result = transpose(matrix);
      assert(result.nrows == matrix.ncols);
      assert(result.ncols == matrix.nrows);
      assert(result[0, 0] == matrix[0, 0]);
      assert(result[0, 1] == matrix[1, 0]);
      assert(result[2, 0] == matrix[0, 2]);
    }
