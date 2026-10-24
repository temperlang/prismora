// A tour of Chromarite's whole public API, from C++.
//
// The same tour exists for each language Chromarite supports, and they all
// print the same text. See ../README.md for how to run them.

#include <cmath>
#include <cstdio>
#include <exception>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

#include "chromarite/init.hpp"

using chromarite::Color;
using chromarite::HueMethod;
using chromarite::Space;

// Chromarite takes lists as shared vectors.
template <typename T>
std::shared_ptr<std::vector<T>> list(std::initializer_list<T> values) {
  return std::make_shared<std::vector<T>>(values);
}

// Numbers print with 4 decimals, the same way in every language.
std::string num(double x) {
  if (std::fabs(x) < 0.00005) {
    x = 0.0;  // No "-0.0000".
  }
  char buf[32];
  std::snprintf(buf, sizeof buf, "%.4f", x);
  return buf;
}

std::string nums(std::vector<double> const &values) {
  std::string out = "[";
  for (size_t i = 0; i < values.size(); i++) {
    out += (i ? ", " : "") + num(values[i]);
  }
  return out + "]";
}

std::string join(std::vector<std::string> const &strings, std::string const &sep) {
  std::string out;
  for (size_t i = 0; i < strings.size(); i++) {
    out += (i ? sep : "") + strings[i];
  }
  return out;
}

std::string hex6(int32_t n) {
  char buf[16];
  std::snprintf(buf, sizeof buf, "%06x", n);
  return buf;
}

std::string yes(bool b) { return b ? "yes" : "no"; }

void show(std::string const &label, std::shared_ptr<Color> const &color) {
  std::cout << label << " (" << color->get_space()->get_name() << ", " << color->get_length() << " x "
            << color->get_width() << "):\n";
  for (int32_t i = 0; i < color->get_length(); i++) {
    std::vector<double> row;
    for (int32_t j = 0; j < color->get_width(); j++) {
      row.push_back(color->get(i, j));
    }
    std::string alpha = color->get_alpha() ? " alpha " + num(color->alphaAt(i)) : "";
    std::cout << "  " << nums(row) << alpha << "\n";
  }
}

void section(std::string const &title) { std::cout << "\n## " << title << "\n"; }

int main() {
  // Sets up Chromarite's constants. Call it once before anything else.
  chromarite::global_init_init();

  std::cout << "# Chromarite tour\n";

  section("1. Making colors");

  // Most channels go from 0 to 1, and hue is in degrees (0 to 360), as in CSS.
  auto orange = Color::fromList(Space::srgb, list({1.0, 0.5, 0.0}));
  show("orange", orange);

  // A Color holds any number of colors, one per row, channels back to back.
  auto pair = Color::fromList(Space::oklch, list({0.7, 0.1, 144.0, 0.5, 0.2, 288.0}));
  show("two OkLCh colors", pair);

  // Alpha (opacity, 0 to 1) goes after each row's channels.
  auto seeThrough = Color::fromListWithAlpha(Space::srgb, list({1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 1.0, 0.25}));
  show("red and blue, see-through", seeThrough);
  show("orange at 80%", orange->withAlpha(list({0.8})));

  // Packed 0xRRGGBB ints, as in hex literals or canvas pixels.
  show("from ints", Color::fromRgbInts(list<int32_t>({0x663399, 0x00ff80})));

  // Any CSS color. Each keeps the space it was written in.
  for (std::string text : {
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
       }) {
    show(text, Color::parse(text));
  }

  // Text that isn't a color fails.
  try {
    Color::parse("not a color");
    std::cout << "parsed?\n";
  } catch (std::exception const &) {
    std::cout << "'not a color' fails to parse\n";
  }

  section("2. Spaces and converting");

  std::vector<std::shared_ptr<Space>> spaces = {
      Space::srgb,        Space::srgbLinear, Space::hsl,         Space::hsv,    Space::hwb,
      Space::oklab,       Space::oklch,      Space::displayP3,   Space::a98Rgb, Space::prophotoRgb,
      Space::rec2020,     Space::xyzD65,     Space::xyzD50,      Space::lab,    Space::lch,
  };

  // Each space converts through its parent, up to linear sRGB at the root.
  // Its gamut is the RGB space whose 0-to-1 cube bounds it, if any.
  for (auto const &space : spaces) {
    auto parent = space->get_parent();
    auto gamut = space->get_gamut();
    std::cout << space->get_name() << ": " << space->get_width() << " channels, parent "
              << (parent ? parent->get_name() : "none") << ", depth " << space->get_depth() << ", gamut "
              << (gamut ? gamut->get_name() : "none") << "\n";
  }

  // The same orange in every space.
  for (auto const &space : spaces) {
    auto converted = orange->toSpace(space);  // snippet: convert
    std::cout << "orange in " << space->get_name() << ": " << nums(*converted->toList()) << "\n";
  }

  section("3. Formatting");

  // Hex and ints fit colors into sRGB first; CSS keeps each color's space.
  auto mixed = Color::parse("oklch(70% 0.15 200 / 50%)");  // snippet: parse
  for (auto const &color : {orange, seeThrough, pair, mixed, Color::parse("color(display-p3 1 0 0)")}) {
    auto hexes = color->toHex();  // snippet: format
    auto css = color->toCss();  // snippet: format
    std::cout << "hex " << join(*hexes, ", ") << "\n";
    std::cout << "css " << join(*css, ", ") << "\n";
    // Keep the returned list alive while looping over it.
    auto rgbInts = color->toRgbInts();
    std::vector<std::string> ints;
    for (int32_t n : *rgbInts) {
      ints.push_back(hex6(n));
    }
    std::cout << "ints " << join(ints, ", ") << "\n";
  }

  section("4. Gamuts");

  // Display P3's red is redder than any sRGB color: as sRGB, it's out of the
  // 0-to-1 range.
  auto p3Red = Color::fromList(Space::displayP3, list({1.0, 0.0, 0.0}));  // snippet: gamut
  auto inSrgb = p3Red->inGamut(Space::srgb);  // snippet: gamut
  auto inP3 = p3Red->inGamut(Space::displayP3);  // snippet: gamut
  std::cout << "P3 red in sRGB? " << yes((*inSrgb)[0]) << "; in P3? " << yes((*inP3)[0]) << "\n";
  show("P3 red as sRGB", p3Red->toSpace(Space::srgb));

  // To show a color like this vivid blue on an sRGB screen, either map it into
  // the gamut as CSS does, keeping lightness and hue and reducing chroma, or
  // clip each channel, which can change lightness and hue too.
  auto vivid = Color::fromList(Space::oklch, list({0.6, 0.35, 270.0}));  // snippet: snap, edges
  auto mapped = vivid->toGamut(Space::srgb);  // snippet: snap
  auto clipped = vivid->toGamutClipped(Space::srgb);
  show("vivid blue", vivid);
  show("mapped, in OkLCh", mapped->toSpace(Space::oklch));
  show("clipped, in OkLCh", clipped->toSpace(Space::oklch));

  // deltaEOK measures how different two colors look: under about 0.02 is hard
  // to see.
  std::cout << "mapped vs clipped: " << num((*mapped->deltaEOk(clipped))[0]) << "\n";

  // The most chroma vivid blue's lightness and hue can have in sRGB, and the
  // color lowered to it, keeping lightness and hue exactly.
  auto most = vivid->maxChroma(Space::srgb);  // snippet: edges
  std::cout << "max chroma in sRGB: " << num((*most)[0]) << "\n";
  auto fitted = vivid->fitChroma(Space::srgb);  // snippet: snap
  show("fitted, in OkLCh", fitted);

  section("5. Mixing and gradients");

  auto red = Color::parse("red");
  auto blue = Color::parse("blue");
  // Oklab mixes look even; sRGB mixes go dull in the middle.
  std::cout << "halfway in oklab: " << (*red->mix(blue, 0.5, Space::oklab)->toHex())[0] << "\n";
  std::cout << "halfway in srgb: " << (*red->mix(blue, 0.5, Space::srgb)->toHex())[0] << "\n";

  // In a space with hue, choose which way around the hue wheel to go.
  for (auto const &hue : {HueMethod::shorter, HueMethod::longer, HueMethod::increasing, HueMethod::decreasing}) {
    std::cout << "halfway in oklch, " << hue->get_name() << ": "
              << (*red->mixHue(blue, 0.5, Space::oklch, hue)->toHex())[0] << "\n";
  }

  // Alpha mixes too, premultiplied as in CSS.
  show("see-through mix", seeThrough->mix(orange, 0.5, Space::oklab));

  // Gradients run through all rows as stops.
  auto stops = Color::fromList(Space::srgb, list({1.0, 0.0, 0.0, 0.0, 0.0, 1.0}));
  std::cout << "gradient: " << join(*stops->gradient(5, Space::oklab)->toHex(), " ") << "\n";
  std::cout << "long way: " << join(*stops->gradientHue(5, Space::oklch, HueMethod::longer)->toHex(), " ") << "\n";

  section("6. Adjusting");

  // Adjustments happen in OkLCh, so equal steps look equal.
  auto steel = Color::parse("steelblue");  // snippet: harmony, shades
  std::cout << "steelblue " << (*steel->toHex())[0] << "\n";
  auto lighter = steel->lighten(0.1);  // snippet: shades
  auto darker = steel->lighten(-0.1);  // snippet: shades
  std::cout << "lighter " << (*lighter->toHex())[0] << ", darker " << (*darker->toHex())[0] << "\n";
  std::cout << "more saturated " << (*steel->saturate(1.5)->toHex())[0] << ", less "
            << (*steel->saturate(0.5)->toHex())[0] << "\n";
  auto opposite = steel->rotateHue(180.0);  // snippet: harmony
  std::cout << "opposite hue " << (*opposite->toHex())[0] << ", gray " << (*steel->grayscale()->toHex())[0] << "\n";

  // Or change every channel value directly.
  show("orange halved", orange->map([](double x) { return x / 2; }));

  section("7. Contrast");

  // Relative luminance and contrast ratios, as WCAG defines them. Text needs
  // 4.5 or more against its background for normal sizes.
  auto white = Color::parse("white");  // snippet: contrast
  auto texts = Color::fromRgbInts(list<int32_t>({0x000000, 0x767676, 0x999999}));  // snippet: contrast
  auto ratios = texts->contrast(white);  // snippet: contrast
  std::cout << "luminance " << nums(*texts->luminance()) << "\n";
  std::cout << "against white " << nums(*ratios) << "\n";

  section("8. Channels as lists");

  // A Color keeps its channels in one flat list, row after row.
  std::cout << pair->get_length() << " colors of " << pair->get_width() << " channels\n";
  std::cout << "row 1, channel 2: " << num(pair->get(1, 2)) << "\n";
  std::cout << "values " << nums(*pair->toList()) << "\n";
  std::cout << "doubled " << nums(*pair->map([](double x) { return x * 2; })->toList()) << "\n";
  std::cout << "with alpha " << nums(*seeThrough->toListWithAlpha()) << "\n";

  // Reading past the end fails.
  try {
    pair->get(0, 5);
    std::cout << "got?\n";
  } catch (std::exception const &) {
    std::cout << "channel 5 doesn't exist\n";
  }
  return 0;
}
