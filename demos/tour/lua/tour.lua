-- A tour of Prismora's whole public API, from Lua.
--
-- The same tour exists for each language Prismora supports, and they all
-- print the same text. See ../README.md for how to run them.

local prismora = require("prismora")
-- Prismora's null is temper-core's `null`, not Lua's `nil`.
local is_null = require("temper-core").is_null
local Color, HueMethod, Matrix, Space =
  prismora.Color, prismora.HueMethod, prismora.Matrix, prismora.Space

-- Numbers print with 4 decimals, the same way in every language.
local function num(x)
  if math.abs(x) < 0.00005 then
    x = 0.0 -- No "-0.0000".
  end
  return string.format("%.4f", x)
end

local function map(values, f)
  local result = {}
  for i, v in ipairs(values) do
    result[i] = f(v)
  end
  return result
end

local function nums(values)
  return "[" .. table.concat(map(values, num), ", ") .. "]"
end

local function yes(b)
  return b and "yes" or "no"
end

local function show(label, color)
  print(string.format("%s (%s, %d x %d):", label, color.space.name, color.length, color.width))
  for i = 0, color.length - 1 do
    local row = {}
    for j = 0, color.width - 1 do
      row[#row + 1] = color:get(i, j)
    end
    local alpha = is_null(color.alpha) and "" or (" alpha " .. num(color:alphaAt(i)))
    print("  " .. nums(row) .. alpha)
  end
end

local function section(title)
  print()
  print("## " .. title)
end

print("# Prismora tour")

section("1. Making colors")

-- Channels go from 0 to 1, and hue is in turns (0 to 1), not degrees.
local orange = Color.fromList(Space.srgb, { 1.0, 0.5, 0.0 })
show("orange", orange)

-- A Color holds any number of colors, one per row, channels back to back.
local pair = Color.fromList(Space.oklch, { 0.7, 0.1, 0.4, 0.5, 0.2, 0.8 })
show("two OkLCh colors", pair)

-- Alpha (opacity, 0 to 1) goes after each row's channels.
local seeThrough = Color.fromAlpha(Space.srgb, { 1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 1.0, 0.25 })
show("red and blue, see-through", seeThrough)
show("orange at 80%", orange:withAlpha({ 0.8 }))

-- Packed 0xRRGGBB ints, as in hex literals or canvas pixels.
show("from ints", Color.fromRgbInts({ 0x663399, 0x00ff80 }))

-- From a Matrix: a flat list read as rows of a given width.
show("from rows", Color.fromRows(Space.hsl, Matrix(3, { 0.5, 1.0, 0.25, 0.0, 0.0, 0.5 })))

-- Any CSS color. Each keeps the space it was written in.
for _, text in ipairs({
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
}) do
  show(text, Color.parse(text))
end

-- Text that isn't a color fails.
if pcall(Color.parse, "not a color") then
  print("parsed?")
else
  print("'not a color' fails to parse")
end

section("2. Spaces and converting")

local spaces = {
  Space.srgb, Space.srgbLinear, Space.hsl, Space.hsv, Space.hwb,
  Space.oklab, Space.oklch, Space.displayP3, Space.a98Rgb,
  Space.prophotoRgb, Space.rec2020, Space.xyzD65, Space.xyzD50,
  Space.lab, Space.lch,
}

-- Each space converts through its parent, up to linear sRGB at the root.
-- Its gamut is the RGB space whose 0-to-1 cube bounds it, if any.
for _, space in ipairs(spaces) do
  local parent = is_null(space.parent) and "none" or space.parent.name
  local gamut = is_null(space.gamut) and "none" or space.gamut.name
  print(string.format(
    "%s: %d channels, parent %s, depth %d, gamut %s",
    space.name, space.ncols, parent, space.depth, gamut
  ))
end

-- The same orange in every space.
for _, space in ipairs(spaces) do
  print("orange in " .. space.name .. ": " .. nums(orange:convert(space).rows:toList()))
end

section("3. Formatting")

-- Hex and ints fit colors into sRGB first; CSS keeps each color's space.
local mixed = Color.parse("oklch(70% 0.15 200 / 50%)")
for _, color in ipairs({ orange, seeThrough, pair, mixed, Color.parse("color(display-p3 1 0 0)") }) do
  print("hex " .. table.concat(color:toHex(), ", "))
  print("css " .. table.concat(color:toCss(), ", "))
  local ints = map(color:toRgbInts(), function(n) return string.format("%06x", n) end)
  print("ints " .. table.concat(ints, ", "))
end

section("4. Gamuts")

-- Display P3's red is redder than any sRGB color: as sRGB, it's out of the
-- 0-to-1 range.
local p3Red = Color.fromList(Space.displayP3, { 1.0, 0.0, 0.0 })
print(string.format(
  "P3 red in sRGB? %s; in P3? %s",
  yes(p3Red:inGamut(Space.srgb)[1]), yes(p3Red:inGamut(Space.displayP3)[1])
))
show("P3 red as sRGB", p3Red:convert(Space.srgb))

-- To show a color like this vivid blue on an sRGB screen, either map it into
-- the gamut as CSS does, keeping lightness and hue and reducing chroma, or
-- clip each channel, which can change lightness and hue too.
local vivid = Color.fromList(Space.oklch, { 0.6, 0.35, 0.75 })
local mapped = vivid:toGamut(Space.srgb)
local clipped = vivid:clip(Space.srgb)
show("vivid blue", vivid)
show("mapped, in OkLCh", mapped:convert(Space.oklch))
show("clipped, in OkLCh", clipped:convert(Space.oklch))

-- deltaEOK measures how different two colors look: under about 0.02 is hard
-- to see.
print("mapped vs clipped: " .. num(mapped:deltaEOk(clipped)[1]))

section("5. Mixing and gradients")

local red = Color.parse("red")
local blue = Color.parse("blue")
-- Oklab mixes look even; sRGB mixes go dull in the middle.
print("halfway in oklab: " .. red:mix(blue, 0.5, Space.oklab):toHex()[1])
print("halfway in srgb: " .. red:mix(blue, 0.5, Space.srgb):toHex()[1])

-- In a space with hue, choose which way around the hue wheel to go.
for _, hue in ipairs({ HueMethod.shorter, HueMethod.longer, HueMethod.increasing, HueMethod.decreasing }) do
  print("halfway in oklch, " .. hue.name .. ": " .. red:mixHue(blue, 0.5, Space.oklch, hue):toHex()[1])
end

-- Alpha mixes too, premultiplied as in CSS.
show("see-through mix", seeThrough:mix(orange, 0.5, Space.oklab))

-- Gradients run through all rows as stops.
local stops = Color.fromList(Space.srgb, { 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 })
print("gradient: " .. table.concat(stops:gradient(5, Space.oklab):toHex(), " "))
print("long way: " .. table.concat(stops:gradientHue(5, Space.oklch, HueMethod.longer):toHex(), " "))

section("6. Adjusting")

-- Adjustments happen in OkLCh, so equal steps look equal.
local steel = Color.parse("steelblue")
print("steelblue " .. steel:toHex()[1])
print("lighter " .. steel:lighten(0.1):toHex()[1] .. ", darker " .. steel:lighten(-0.1):toHex()[1])
print("more saturated " .. steel:saturate(1.5):toHex()[1] .. ", less " .. steel:saturate(0.5):toHex()[1])
print("opposite hue " .. steel:rotateHue(0.5):toHex()[1] .. ", gray " .. steel:grayscale():toHex()[1])

-- Or change every channel value directly.
show("orange halved", orange:map(function(x) return x / 2 end))

section("7. Contrast")

-- Relative luminance and contrast ratios, as WCAG defines them. Text needs
-- 4.5 or more against its background for normal sizes.
local white = Color.parse("white")
local texts = Color.fromRgbInts({ 0x000000, 0x767676, 0x999999 })
print("luminance " .. nums(texts:luminance()))
print("against white " .. nums(texts:contrast(white)))

section("8. Matrix")

-- A Color's rows are a Matrix: one flat list, row after row.
local rows = pair.rows
print(string.format("%d rows of %d", rows.nrows, rows.ncols))
print("row 1, column 2: " .. num(rows:get(1, 2)) .. "; flat 4: " .. num(rows:at(4)))
print("values " .. nums(rows:toList()))
print("doubled " .. nums(rows:map(function(x) return x * 2 end):toList()))
print("one row " .. nums(Matrix.rowOf({ 0.1, 0.2, 0.3 }):toList()))
print("with alpha " .. nums(seeThrough:rowsWithAlpha():toList()))

-- Reading past the end fails.
if pcall(pair.get, pair, 0, 5) then
  print("got?")
else
  print("column 5 doesn't exist")
end
