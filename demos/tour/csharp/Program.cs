// A tour of Chromarite's whole public API, from C#.
//
// The same tour exists for each language Chromarite supports, and they all
// print the same text. See ../README.md for how to run them.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Chromarite;

// Numbers print with 4 decimals, the same way in every language.
static string Num(double x)
{
    if (Math.Abs(x) < 0.00005)
    {
        x = 0.0; // No "-0.0000".
    }
    return x.ToString("F4", CultureInfo.InvariantCulture);
}

static string Nums(IEnumerable<double> values) => "[" + string.Join(", ", values.Select(Num)) + "]";

static string Yes(bool b) => b ? "yes" : "no";

static void Show(string label, Color color)
{
    Console.WriteLine($"{label} ({color.Space.Name}, {color.Length} x {color.Width}):");
    for (int i = 0; i < color.Length; i++)
    {
        var row = new List<double>();
        for (int j = 0; j < color.Width; j++)
        {
            row.Add(color.Get(i, j));
        }
        string alpha = color.Alpha == null ? "" : $" alpha {Num(color.AlphaAt(i))}";
        Console.WriteLine($"  {Nums(row)}{alpha}");
    }
}

static void Section(string title)
{
    Console.WriteLine();
    Console.WriteLine($"## {title}");
}

Console.WriteLine("# Chromarite tour");

Section("1. Making colors");

// Most channels go from 0 to 1, and hue is in degrees (0 to 360), as in CSS.
var orange = Color.FromList(Space.Srgb, new[] { 1.0, 0.5, 0.0 });
Show("orange", orange);

// A Color holds any number of colors, one per row, channels back to back.
var pair = Color.FromList(Space.Oklch, new[] { 0.7, 0.1, 144.0, 0.5, 0.2, 288.0 });
Show("two OkLCh colors", pair);

// Alpha (opacity, 0 to 1) goes after each row's channels.
var seeThrough = Color.FromListWithAlpha(Space.Srgb, new[] { 1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 1.0, 0.25 });
Show("red and blue, see-through", seeThrough);
Show("orange at 80%", orange.WithAlpha(new[] { 0.8 }));

// Packed 0xRRGGBB ints, as in hex literals or canvas pixels.
Show("from ints", Color.FromRgbInts(new[] { 0x663399, 0x00ff80 }));

// Any CSS color. Each keeps the space it was written in.
foreach (var text in new[]
{
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
})
{
    Show(text, Color.Parse(text));
}

// Text that isn't a color fails.
try
{
    Color.Parse("not a color");
    Console.WriteLine("parsed?");
}
catch (Exception)
{
    Console.WriteLine("'not a color' fails to parse");
}

Section("2. Spaces and converting");

var spaces = new[]
{
    Space.Srgb, Space.SrgbLinear, Space.Hsl, Space.Hsv, Space.Hwb,
    Space.Oklab, Space.Oklch, Space.DisplayP3, Space.A98_Rgb,
    Space.ProphotoRgb, Space.Rec2020, Space.XyzD65, Space.XyzD50,
    Space.Lab, Space.Lch,
};

// Each space converts through its parent, up to linear sRGB at the root.
// Its gamut is the RGB space whose 0-to-1 cube bounds it, if any.
foreach (var space in spaces)
{
    string parent = space.Parent?.Name ?? "none";
    string gamut = space.Gamut?.Name ?? "none";
    Console.WriteLine(
        $"{space.Name}: {space.Width} channels, parent {parent}, depth {space.Depth}, gamut {gamut}");
}

// The same orange in every space.
foreach (var space in spaces)
{
    var converted = orange.ToSpace(space);  // snippet: convert
    Console.WriteLine($"orange in {space.Name}: {Nums(converted.ToList())}");
}

Section("3. Formatting");

// Hex and ints fit colors into sRGB first; CSS keeps each color's space.
var mixed = Color.Parse("oklch(70% 0.15 200 / 50%)");  // snippet: parse
foreach (var color in new[] { orange, seeThrough, pair, mixed, Color.Parse("color(display-p3 1 0 0)") })
{
    var hexes = color.ToHex();  // snippet: format
    var css = color.ToCss();  // snippet: format
    Console.WriteLine($"hex {string.Join(", ", hexes)}");
    Console.WriteLine($"css {string.Join(", ", css)}");
    Console.WriteLine($"ints {string.Join(", ", color.ToRgbInts().Select(n => n.ToString("x6")))}");
}

Section("4. Gamuts");

// Display P3's red is redder than any sRGB color: as sRGB, it's out of the
// 0-to-1 range.
var p3Red = Color.FromList(Space.DisplayP3, new[] { 1.0, 0.0, 0.0 });  // snippet: gamut
var inSrgb = p3Red.InGamut(Space.Srgb);  // snippet: gamut
var inP3 = p3Red.InGamut(Space.DisplayP3);  // snippet: gamut
Console.WriteLine($"P3 red in sRGB? {Yes(inSrgb[0])}; in P3? {Yes(inP3[0])}");
Show("P3 red as sRGB", p3Red.ToSpace(Space.Srgb));

// To show a color like this vivid blue on an sRGB screen, either map it into
// the gamut as CSS does, keeping lightness and hue and reducing chroma, or
// clip each channel, which can change lightness and hue too.
var vivid = Color.FromList(Space.Oklch, new[] { 0.6, 0.35, 270.0 });  // snippet: snap, edges
var mapped = vivid.ToGamut(Space.Srgb);  // snippet: snap
var clipped = vivid.ToGamutClipped(Space.Srgb);
Show("vivid blue", vivid);
Show("mapped, in OkLCh", mapped.ToSpace(Space.Oklch));
Show("clipped, in OkLCh", clipped.ToSpace(Space.Oklch));

// deltaEOK measures how different two colors look: under about 0.02 is hard
// to see.
Console.WriteLine($"mapped vs clipped: {Num(mapped.DeltaEOk(clipped)[0])}");

// The most chroma vivid blue's lightness and hue can have in sRGB, and the
// color lowered to it, keeping lightness and hue exactly.
var most = vivid.MaxChroma(Space.Srgb);  // snippet: edges
Console.WriteLine($"max chroma in sRGB: {Num(most[0])}");
var fitted = vivid.FitChroma(Space.Srgb);  // snippet: snap
Show("fitted, in OkLCh", fitted);

Section("5. Mixing and gradients");

var red = Color.Parse("red");
var blue = Color.Parse("blue");
// Oklab mixes look even; sRGB mixes go dull in the middle.
Console.WriteLine($"halfway in oklab: {red.Mix(blue, 0.5, Space.Oklab).ToHex()[0]}");
Console.WriteLine($"halfway in srgb: {red.Mix(blue, 0.5, Space.Srgb).ToHex()[0]}");

// In a space with hue, choose which way around the hue wheel to go.
foreach (var hue in new[] { HueMethod.Shorter, HueMethod.Longer, HueMethod.Increasing, HueMethod.Decreasing })
{
    Console.WriteLine($"halfway in oklch, {hue.Name}: {red.MixHue(blue, 0.5, Space.Oklch, hue).ToHex()[0]}");
}

// Alpha mixes too, premultiplied as in CSS.
Show("see-through mix", seeThrough.Mix(orange, 0.5, Space.Oklab));

// Gradients run through all rows as stops.
var stops = Color.FromList(Space.Srgb, new[] { 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 });
Console.WriteLine($"gradient: {string.Join(" ", stops.Gradient(5, Space.Oklab).ToHex())}");
Console.WriteLine($"long way: {string.Join(" ", stops.GradientHue(5, Space.Oklch, HueMethod.Longer).ToHex())}");

Section("6. Adjusting");

// Adjustments happen in OkLCh, so equal steps look equal.
var steel = Color.Parse("steelblue");  // snippet: harmony, shades
Console.WriteLine($"steelblue {steel.ToHex()[0]}");
var lighter = steel.Lighten(0.1);  // snippet: shades
var darker = steel.Lighten(-0.1);  // snippet: shades
Console.WriteLine($"lighter {lighter.ToHex()[0]}, darker {darker.ToHex()[0]}");
Console.WriteLine($"more saturated {steel.Saturate(1.5).ToHex()[0]}, less {steel.Saturate(0.5).ToHex()[0]}");
var opposite = steel.RotateHue(180.0);  // snippet: harmony
Console.WriteLine($"opposite hue {opposite.ToHex()[0]}, gray {steel.Grayscale().ToHex()[0]}");

// Or change every channel value directly.
Show("orange halved", orange.Map(x => x / 2));

Section("7. Contrast");

// Relative luminance and contrast ratios, as WCAG defines them. Text needs
// 4.5 or more against its background for normal sizes.
var white = Color.Parse("white");  // snippet: contrast
var texts = Color.FromRgbInts(new[] { 0x000000, 0x767676, 0x999999 });  // snippet: contrast
var ratios = texts.Contrast(white);  // snippet: contrast
Console.WriteLine($"luminance {Nums(texts.Luminance())}");
Console.WriteLine($"against white {Nums(ratios)}");

// The lightest steelblue that white text can sit on, at 4.5 or more.
var shade = steel.FitContrast(white, 4.5, Space.Srgb);
Console.WriteLine($"steelblue for white text {shade.ToHex()[0]}, {Num(shade.Contrast(white)[0])}");

Section("8. Channels as lists");

// A Color keeps its channels in one flat list, row after row.
Console.WriteLine($"{pair.Length} colors of {pair.Width} channels");
Console.WriteLine($"row 1, channel 2: {Num(pair.Get(1, 2))}");
Console.WriteLine($"values {Nums(pair.ToList())}");
Console.WriteLine($"doubled {Nums(pair.Map(x => x * 2).ToList())}");
Console.WriteLine($"with alpha {Nums(seeThrough.ToListWithAlpha())}");

// Reading past the end fails.
try
{
    pair.Get(0, 5);
    Console.WriteLine("got?");
}
catch (Exception)
{
    Console.WriteLine("channel 5 doesn't exist");
}
