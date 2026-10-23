"""A tour of Prismora's whole public API, from Python.

The same tour exists for each language Prismora supports, and they all print
the same text. See ../README.md for how to run them.
"""

from prismora import Color, HueMethod, Matrix, Space


# Numbers print with 4 decimals, the same way in every language.
def num(x):
    if abs(x) < 0.00005:
        x = 0.0  # No "-0.0000".
    return f"{x:.4f}"


def nums(values):
    return "[" + ", ".join(num(x) for x in values) + "]"


def yes(b):
    return "yes" if b else "no"


def show(label, color):
    print(f"{label} ({color.space.name}, {color.length} x {color.width}):")
    for i in range(color.length):
        row = [color.get(i, j) for j in range(color.width)]
        alpha = "" if color.alpha is None else f" alpha {num(color.alpha_at(i))}"
        print(f"  {nums(row)}{alpha}")


def section(title):
    print()
    print(f"## {title}")


print("# Prismora tour")

section("1. Making colors")

# Channels go from 0 to 1, and hue is in turns (0 to 1), not degrees.
orange = Color.from_list(Space.srgb, [1.0, 0.5, 0.0])
show("orange", orange)

# A Color holds any number of colors, one per row, channels back to back.
pair = Color.from_list(Space.oklch, [0.7, 0.1, 0.4, 0.5, 0.2, 0.8])
show("two OkLCh colors", pair)

# Alpha (opacity, 0 to 1) goes after each row's channels.
see_through = Color.from_alpha(Space.srgb, [1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 1.0, 0.25])
show("red and blue, see-through", see_through)
show("orange at 80%", orange.with_alpha([0.8]))

# Packed 0xRRGGBB ints, as in hex literals or canvas pixels.
show("from ints", Color.from_rgb_ints([0x663399, 0x00FF80]))

# From a Matrix: a flat list read as rows of a given width.
show("from rows", Color.from_rows(Space.hsl, Matrix(3, [0.5, 1.0, 0.25, 0.0, 0.0, 0.5])))

# Any CSS color. Each keeps the space it was written in.
for text in [
    "rebeccapurple",
    "#ff8000",
    "#36c8",
    "rgb(255 128 0 / 50%)",
    "hsl(120deg 60% 40%)",
    "hwb(200 10% 20%)",
    "lab(50% 40 -30)",
    "lch(60% 50 120)",
    "oklab(0.6 0.1 -0.1)",
    "oklch(70% 0.15 200)",
    "color(display-p3 1 0 0)",
    "color(rec2020 0 1 0)",
]:
    show(text, Color.parse(text))

# Text that isn't a color fails.
try:
    Color.parse("not a color")
    print("parsed?")
except Exception:
    print("'not a color' fails to parse")

section("2. Spaces and converting")

spaces = [
    Space.srgb, Space.srgb_linear, Space.hsl, Space.hsv, Space.hwb,
    Space.oklab, Space.oklch, Space.display_p3, Space.a98_rgb,
    Space.prophoto_rgb, Space.rec2020, Space.xyz_d65, Space.xyz_d50,
    Space.lab, Space.lch,
]

# Each space converts through its parent, up to linear sRGB at the root.
# Its gamut is the RGB space whose 0-to-1 cube bounds it, if any.
for space in spaces:
    parent = "none" if space.parent is None else space.parent.name
    gamut = "none" if space.gamut is None else space.gamut.name
    print(
        f"{space.name}: {space.ncols} channels, parent {parent}, "
        f"depth {space.depth}, gamut {gamut}"
    )

# The same orange in every space.
for space in spaces:
    converted = orange.convert(space)  # snippet: convert
    print(f"orange in {space.name}: {nums(converted.rows.to_list())}")

section("3. Formatting")

# Hex and ints fit colors into sRGB first; CSS keeps each color's space.
mixed = Color.parse("oklch(70% 0.15 200 / 50%)")  # snippet: parse
for color in [orange, see_through, pair, mixed, Color.parse("color(display-p3 1 0 0)")]:
    hexes = color.to_hex()  # snippet: format
    css = color.to_css()  # snippet: format
    print(f"hex {', '.join(hexes)}")
    print(f"css {', '.join(css)}")
    print(f"ints {', '.join(f'{n:06x}' for n in color.to_rgb_ints())}")

section("4. Gamuts")

# Display P3's red is redder than any sRGB color: as sRGB, it's out of the
# 0-to-1 range.
p3_red = Color.from_list(Space.display_p3, [1.0, 0.0, 0.0])  # snippet: gamut
in_srgb = p3_red.in_gamut(Space.srgb)  # snippet: gamut
in_p3 = p3_red.in_gamut(Space.display_p3)  # snippet: gamut
print(f"P3 red in sRGB? {yes(in_srgb[0])}; in P3? {yes(in_p3[0])}")
show("P3 red as sRGB", p3_red.convert(Space.srgb))

# To show a color like this vivid blue on an sRGB screen, either map it into
# the gamut as CSS does, keeping lightness and hue and reducing chroma, or
# clip each channel, which can change lightness and hue too.
vivid = Color.from_list(Space.oklch, [0.6, 0.35, 0.75])  # snippet: snap, edges
mapped = vivid.to_gamut(Space.srgb)  # snippet: snap
clipped = vivid.clip(Space.srgb)
show("vivid blue", vivid)
show("mapped, in OkLCh", mapped.convert(Space.oklch))
show("clipped, in OkLCh", clipped.convert(Space.oklch))

# deltaEOK measures how different two colors look: under about 0.02 is hard
# to see.
print(f"mapped vs clipped: {num(mapped.delta_e_ok(clipped)[0])}")

# The most chroma vivid blue's lightness and hue can have in sRGB, and the
# color lowered to it, keeping lightness and hue exactly.
most = vivid.max_chroma(Space.srgb)  # snippet: edges
print(f"max chroma in sRGB: {num(most[0])}")
fitted = vivid.fit_chroma(Space.srgb)  # snippet: snap
show("fitted, in OkLCh", fitted)

section("5. Mixing and gradients")

red = Color.parse("red")
blue = Color.parse("blue")
# Oklab mixes look even; sRGB mixes go dull in the middle.
print(f"halfway in oklab: {red.mix(blue, 0.5, Space.oklab).to_hex()[0]}")
print(f"halfway in srgb: {red.mix(blue, 0.5, Space.srgb).to_hex()[0]}")

# In a space with hue, choose which way around the hue wheel to go.
for hue in [HueMethod.shorter, HueMethod.longer, HueMethod.increasing, HueMethod.decreasing]:
    print(f"halfway in oklch, {hue.name}: {red.mix_hue(blue, 0.5, Space.oklch, hue).to_hex()[0]}")

# Alpha mixes too, premultiplied as in CSS.
show("see-through mix", see_through.mix(orange, 0.5, Space.oklab))

# Gradients run through all rows as stops.
stops = Color.from_list(Space.srgb, [1.0, 0.0, 0.0, 0.0, 0.0, 1.0])
print(f"gradient: {' '.join(stops.gradient(5, Space.oklab).to_hex())}")
print(f"long way: {' '.join(stops.gradient_hue(5, Space.oklch, HueMethod.longer).to_hex())}")

section("6. Adjusting")

# Adjustments happen in OkLCh, so equal steps look equal.
steel = Color.parse("steelblue")  # snippet: harmony, shades
print(f"steelblue {steel.to_hex()[0]}")
lighter = steel.lighten(0.1)  # snippet: shades
darker = steel.lighten(-0.1)  # snippet: shades
print(f"lighter {lighter.to_hex()[0]}, darker {darker.to_hex()[0]}")
print(f"more saturated {steel.saturate(1.5).to_hex()[0]}, less {steel.saturate(0.5).to_hex()[0]}")
opposite = steel.rotate_hue(0.5)  # snippet: harmony
print(f"opposite hue {opposite.to_hex()[0]}, gray {steel.grayscale().to_hex()[0]}")

# Or change every channel value directly.
show("orange halved", orange.map(lambda x: x / 2))

section("7. Contrast")

# Relative luminance and contrast ratios, as WCAG defines them. Text needs
# 4.5 or more against its background for normal sizes.
white = Color.parse("white")  # snippet: contrast
texts = Color.from_rgb_ints([0x000000, 0x767676, 0x999999])  # snippet: contrast
ratios = texts.contrast(white)  # snippet: contrast
print(f"luminance {nums(texts.luminance())}")
print(f"against white {nums(ratios)}")

section("8. Matrix")

# A Color's rows are a Matrix: one flat list, row after row.
rows = pair.rows
print(f"{rows.nrows} rows of {rows.ncols}")
print(f"row 1, column 2: {num(rows.get(1, 2))}; flat 4: {num(rows.at(4))}")
print(f"values {nums(rows.to_list())}")
print(f"doubled {nums(rows.map(lambda x: x * 2).to_list())}")
print(f"one row {nums(Matrix.row_of([0.1, 0.2, 0.3]).to_list())}")
print(f"with alpha {nums(see_through.rows_with_alpha().to_list())}")

# Reading past the end fails.
try:
    pair.get(0, 5)
    print("got?")
except Exception:
    print("column 5 doesn't exist")
