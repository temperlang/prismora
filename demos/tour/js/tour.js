// A tour of Prismora's whole public API, from JavaScript.
//
// The same tour exists for each language Prismora supports, and they all
// print the same text. See ../README.md for how to run them.

import { Color, HueMethod, Matrix, Space } from "prismora";

// Numbers print with 4 decimals, the same way in every language.
function num(x) {
  if (Math.abs(x) < 0.00005) {
    x = 0; // No "-0.0000".
  }
  return x.toFixed(4);
}

function nums(values) {
  return "[" + values.map(num).join(", ") + "]";
}

function yes(b) {
  return b ? "yes" : "no";
}

function show(label, color) {
  console.log(`${label} (${color.space.name}, ${color.length} x ${color.width}):`);
  for (let i = 0; i < color.length; i++) {
    const row = [];
    for (let j = 0; j < color.width; j++) {
      row.push(color.get(i, j));
    }
    const alpha = color.alpha === null ? "" : ` alpha ${num(color.alphaAt(i))}`;
    console.log(`  ${nums(row)}${alpha}`);
  }
}

function section(title) {
  console.log();
  console.log(`## ${title}`);
}

console.log("# Prismora tour");

section("1. Making colors");

// Channels go from 0 to 1, and hue is in turns (0 to 1), not degrees.
const orange = Color.fromList(Space.srgb, [1.0, 0.5, 0.0]);
show("orange", orange);

// A Color holds any number of colors, one per row, channels back to back.
const pair = Color.fromList(Space.oklch, [0.7, 0.1, 0.4, 0.5, 0.2, 0.8]);
show("two OkLCh colors", pair);

// Alpha (opacity, 0 to 1) goes after each row's channels.
const seeThrough = Color.fromAlpha(Space.srgb, [1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 1.0, 0.25]);
show("red and blue, see-through", seeThrough);
show("orange at 80%", orange.withAlpha([0.8]));

// Packed 0xRRGGBB ints, as in hex literals or canvas pixels.
show("from ints", Color.fromRgbInts([0x663399, 0x00ff80]));

// From a Matrix: a flat list read as rows of a given width.
show("from rows", Color.fromRows(Space.hsl, new Matrix(3, [0.5, 1.0, 0.25, 0.0, 0.0, 0.5])));

// Any CSS color. Each keeps the space it was written in.
for (const text of [
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
]) {
  show(text, Color.parse(text));
}

// Text that isn't a color fails.
try {
  Color.parse("not a color");
  console.log("parsed?");
} catch {
  console.log("'not a color' fails to parse");
}

section("2. Spaces and converting");

const spaces = [
  Space.srgb, Space.srgbLinear, Space.hsl, Space.hsv, Space.hwb,
  Space.oklab, Space.oklch, Space.displayP3, Space.a98Rgb,
  Space.prophotoRgb, Space.rec2020, Space.xyzD65, Space.xyzD50,
  Space.lab, Space.lch,
];

// Each space converts through its parent, up to linear sRGB at the root.
// Its gamut is the RGB space whose 0-to-1 cube bounds it, if any.
for (const space of spaces) {
  const parent = space.parent === null ? "none" : space.parent.name;
  const gamut = space.gamut === null ? "none" : space.gamut.name;
  console.log(
    `${space.name}: ${space.ncols} channels, parent ${parent}, ` +
      `depth ${space.depth}, gamut ${gamut}`,
  );
}

// The same orange in every space.
for (const space of spaces) {
  console.log(`orange in ${space.name}: ${nums(orange.convert(space).rows.toList())}`);
}

section("3. Formatting");

// Hex and ints fit colors into sRGB first; CSS keeps each color's space.
const mixed = Color.parse("oklch(70% 0.15 200 / 50%)");
for (const color of [orange, seeThrough, pair, mixed, Color.parse("color(display-p3 1 0 0)")]) {
  console.log(`hex ${color.toHex().join(", ")}`);
  console.log(`css ${color.toCss().join(", ")}`);
  console.log(`ints ${color.toRgbInts().map((n) => n.toString(16).padStart(6, "0")).join(", ")}`);
}

section("4. Gamuts");

// Display P3's red is redder than any sRGB color: as sRGB, it's out of the
// 0-to-1 range.
const p3Red = Color.fromList(Space.displayP3, [1.0, 0.0, 0.0]);
console.log(
  `P3 red in sRGB? ${yes(p3Red.inGamut(Space.srgb)[0])}; ` +
    `in P3? ${yes(p3Red.inGamut(Space.displayP3)[0])}`,
);
show("P3 red as sRGB", p3Red.convert(Space.srgb));

// To show a color like this vivid blue on an sRGB screen, either map it into
// the gamut as CSS does, keeping lightness and hue and reducing chroma, or
// clip each channel, which can change lightness and hue too.
const vivid = Color.fromList(Space.oklch, [0.6, 0.35, 0.75]);
const mapped = vivid.toGamut(Space.srgb);
const clipped = vivid.clip(Space.srgb);
show("vivid blue", vivid);
show("mapped, in OkLCh", mapped.convert(Space.oklch));
show("clipped, in OkLCh", clipped.convert(Space.oklch));

// deltaEOK measures how different two colors look: under about 0.02 is hard
// to see.
console.log(`mapped vs clipped: ${num(mapped.deltaEOk(clipped)[0])}`);

// The most chroma vivid blue's lightness and hue can have in sRGB, and the
// color lowered to it, keeping lightness and hue exactly.
console.log(`max chroma in sRGB: ${num(vivid.maxChroma(Space.srgb)[0])}`);
show("fitted, in OkLCh", vivid.fitChroma(Space.srgb));

section("5. Mixing and gradients");

const red = Color.parse("red");
const blue = Color.parse("blue");
// Oklab mixes look even; sRGB mixes go dull in the middle.
console.log(`halfway in oklab: ${red.mix(blue, 0.5, Space.oklab).toHex()[0]}`);
console.log(`halfway in srgb: ${red.mix(blue, 0.5, Space.srgb).toHex()[0]}`);

// In a space with hue, choose which way around the hue wheel to go.
for (const hue of [HueMethod.shorter, HueMethod.longer, HueMethod.increasing, HueMethod.decreasing]) {
  console.log(`halfway in oklch, ${hue.name}: ${red.mixHue(blue, 0.5, Space.oklch, hue).toHex()[0]}`);
}

// Alpha mixes too, premultiplied as in CSS.
show("see-through mix", seeThrough.mix(orange, 0.5, Space.oklab));

// Gradients run through all rows as stops.
const stops = Color.fromList(Space.srgb, [1.0, 0.0, 0.0, 0.0, 0.0, 1.0]);
console.log(`gradient: ${stops.gradient(5, Space.oklab).toHex().join(" ")}`);
console.log(`long way: ${stops.gradientHue(5, Space.oklch, HueMethod.longer).toHex().join(" ")}`);

section("6. Adjusting");

// Adjustments happen in OkLCh, so equal steps look equal.
const steel = Color.parse("steelblue");
console.log(`steelblue ${steel.toHex()[0]}`);
console.log(`lighter ${steel.lighten(0.1).toHex()[0]}, darker ${steel.lighten(-0.1).toHex()[0]}`);
console.log(`more saturated ${steel.saturate(1.5).toHex()[0]}, less ${steel.saturate(0.5).toHex()[0]}`);
console.log(`opposite hue ${steel.rotateHue(0.5).toHex()[0]}, gray ${steel.grayscale().toHex()[0]}`);

// Or change every channel value directly.
show("orange halved", orange.map((x) => x / 2));

section("7. Contrast");

// Relative luminance and contrast ratios, as WCAG defines them. Text needs
// 4.5 or more against its background for normal sizes.
const white = Color.parse("white");
const texts = Color.fromRgbInts([0x000000, 0x767676, 0x999999]);
console.log(`luminance ${nums(texts.luminance())}`);
console.log(`against white ${nums(texts.contrast(white))}`);

section("8. Matrix");

// A Color's rows are a Matrix: one flat list, row after row.
const rows = pair.rows;
console.log(`${rows.nrows} rows of ${rows.ncols}`);
console.log(`row 1, column 2: ${num(rows.get(1, 2))}; flat 4: ${num(rows.at(4))}`);
console.log(`values ${nums(rows.toList())}`);
console.log(`doubled ${nums(rows.map((x) => x * 2).toList())}`);
console.log(`one row ${nums(Matrix.rowOf([0.1, 0.2, 0.3]).toList())}`);
console.log(`with alpha ${nums(seeThrough.rowsWithAlpha().toList())}`);

// Reading past the end fails.
try {
  pair.get(0, 5);
  console.log("got?");
} catch {
  console.log("column 5 doesn't exist");
}
