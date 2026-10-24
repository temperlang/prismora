// A tour of Chromarite's whole public API, from Java.
//
// The same tour exists for each language Chromarite supports, and they all
// print the same text. See ../README.md for how to run them.

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import chromarite.Color;
import chromarite.HueMethod;
import chromarite.Space;

public class Tour {
    // Numbers print with 4 decimals, the same way in every language.
    static String num(double x) {
        if (Math.abs(x) < 0.00005) {
            x = 0.0; // No "-0.0000".
        }
        return String.format(Locale.ROOT, "%.4f", x);
    }

    static String nums(List<Double> values) {
        return values.stream().map(Tour::num).collect(Collectors.joining(", ", "[", "]"));
    }

    static String yes(boolean b) {
        return b ? "yes" : "no";
    }

    static void show(String label, Color color) {
        System.out.printf(
            "%s (%s, %d x %d):%n", label, color.getSpace().getName(), color.getLength(), color.getWidth());
        for (int i = 0; i < color.getLength(); i++) {
            List<Double> row = new ArrayList<>();
            for (int j = 0; j < color.getWidth(); j++) {
                row.add(color.get(i, j));
            }
            String alpha = color.getAlpha() == null ? "" : " alpha " + num(color.alphaAt(i));
            System.out.println("  " + nums(row) + alpha);
        }
    }

    static void section(String title) {
        System.out.println();
        System.out.println("## " + title);
    }

    public static void main(String[] args) {
        System.out.println("# Chromarite tour");

        section("1. Making colors");

        // Most channels go from 0 to 1, and hue is in degrees (0 to 360), as in CSS.
        Color orange = Color.fromList(Space.srgb, List.of(1.0, 0.5, 0.0));
        show("orange", orange);

        // A Color holds any number of colors, one per row, channels back to back.
        Color pair = Color.fromList(Space.oklch, List.of(0.7, 0.1, 144.0, 0.5, 0.2, 288.0));
        show("two OkLCh colors", pair);

        // Alpha (opacity, 0 to 1) goes after each row's channels.
        Color seeThrough = Color.fromListWithAlpha(Space.srgb, List.of(1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 1.0, 0.25));
        show("red and blue, see-through", seeThrough);
        show("orange at 80%", orange.withAlpha(List.of(0.8)));

        // Packed 0xRRGGBB ints, as in hex literals or canvas pixels.
        show("from ints", Color.fromRgbInts(List.of(0x663399, 0x00ff80)));

        // Any CSS color. Each keeps the space it was written in.
        for (String text : List.of(
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
            "color(rec2020 0 1 0)"
        )) {
            show(text, Color.parse(text));
        }

        // Text that isn't a color fails.
        try {
            Color.parse("not a color");
            System.out.println("parsed?");
        } catch (RuntimeException e) {
            System.out.println("'not a color' fails to parse");
        }

        section("2. Spaces and converting");

        List<Space> spaces = List.of(
            Space.srgb, Space.srgbLinear, Space.hsl, Space.hsv, Space.hwb,
            Space.oklab, Space.oklch, Space.displayP3, Space.a98Rgb,
            Space.prophotoRgb, Space.rec2020, Space.xyzD65, Space.xyzD50,
            Space.lab, Space.lch);

        // Each space converts through its parent, up to linear sRGB at the root.
        // Its gamut is the RGB space whose 0-to-1 cube bounds it, if any.
        for (Space space : spaces) {
            String parent = space.getParent() == null ? "none" : space.getParent().getName();
            String gamut = space.getGamut() == null ? "none" : space.getGamut().getName();
            System.out.printf(
                "%s: %d channels, parent %s, depth %d, gamut %s%n",
                space.getName(), space.getWidth(), parent, space.getDepth(), gamut);
        }

        // The same orange in every space.
        for (Space space : spaces) {
            Color converted = orange.toSpace(space);  // snippet: convert
            System.out.println("orange in " + space.getName() + ": " + nums(converted.toList()));
        }

        section("3. Formatting");

        // Hex and ints fit colors into sRGB first; CSS keeps each color's space.
        Color mixed = Color.parse("oklch(70% 0.15 200 / 50%)");  // snippet: parse
        for (Color color : List.of(orange, seeThrough, pair, mixed, Color.parse("color(display-p3 1 0 0)"))) {
            List<String> hexes = color.toHex();  // snippet: format
            List<String> css = color.toCss();  // snippet: format
            System.out.println("hex " + String.join(", ", hexes));
            System.out.println("css " + String.join(", ", css));
            System.out.println("ints " + color.toRgbInts().stream()
                .map(n -> String.format("%06x", n)).collect(Collectors.joining(", ")));
        }

        section("4. Gamuts");

        // Display P3's red is redder than any sRGB color: as sRGB, it's out of the
        // 0-to-1 range.
        Color p3Red = Color.fromList(Space.displayP3, List.of(1.0, 0.0, 0.0));  // snippet: gamut
        List<Boolean> inSrgb = p3Red.inGamut(Space.srgb);  // snippet: gamut
        List<Boolean> inP3 = p3Red.inGamut(Space.displayP3);  // snippet: gamut
        System.out.printf("P3 red in sRGB? %s; in P3? %s%n", yes(inSrgb.get(0)), yes(inP3.get(0)));
        show("P3 red as sRGB", p3Red.toSpace(Space.srgb));

        // To show a color like this vivid blue on an sRGB screen, either map it into
        // the gamut as CSS does, keeping lightness and hue and reducing chroma, or
        // clip each channel, which can change lightness and hue too.
        Color vivid = Color.fromList(Space.oklch, List.of(0.6, 0.35, 270.0));  // snippet: snap, edges
        Color mapped = vivid.toGamut(Space.srgb);  // snippet: snap
        Color clipped = vivid.toGamutClipped(Space.srgb);
        show("vivid blue", vivid);
        show("mapped, in OkLCh", mapped.toSpace(Space.oklch));
        show("clipped, in OkLCh", clipped.toSpace(Space.oklch));

        // deltaEOK measures how different two colors look: under about 0.02 is hard
        // to see.
        System.out.println("mapped vs clipped: " + num(mapped.deltaEOk(clipped).get(0)));

        // The most chroma vivid blue's lightness and hue can have in sRGB, and the
        // color lowered to it, keeping lightness and hue exactly.
        List<Double> most = vivid.maxChroma(Space.srgb);  // snippet: edges
        System.out.println("max chroma in sRGB: " + num(most.get(0)));
        Color fitted = vivid.fitChroma(Space.srgb);  // snippet: snap
        show("fitted, in OkLCh", fitted);

        section("5. Mixing and gradients");

        Color red = Color.parse("red");
        Color blue = Color.parse("blue");
        // Oklab mixes look even; sRGB mixes go dull in the middle.
        System.out.println("halfway in oklab: " + red.mix(blue, 0.5, Space.oklab).toHex().get(0));
        System.out.println("halfway in srgb: " + red.mix(blue, 0.5, Space.srgb).toHex().get(0));

        // In a space with hue, choose which way around the hue wheel to go.
        for (HueMethod hue : List.of(HueMethod.shorter, HueMethod.longer, HueMethod.increasing, HueMethod.decreasing)) {
            System.out.println(
                "halfway in oklch, " + hue.getName() + ": " + red.mixHue(blue, 0.5, Space.oklch, hue).toHex().get(0));
        }

        // Alpha mixes too, premultiplied as in CSS.
        show("see-through mix", seeThrough.mix(orange, 0.5, Space.oklab));

        // Gradients run through all rows as stops.
        Color stops = Color.fromList(Space.srgb, List.of(1.0, 0.0, 0.0, 0.0, 0.0, 1.0));
        System.out.println("gradient: " + String.join(" ", stops.gradient(5, Space.oklab).toHex()));
        System.out.println("long way: " + String.join(" ", stops.gradientHue(5, Space.oklch, HueMethod.longer).toHex()));

        section("6. Adjusting");

        // Adjustments happen in OkLCh, so equal steps look equal.
        Color steel = Color.parse("steelblue");  // snippet: harmony, shades
        System.out.println("steelblue " + steel.toHex().get(0));
        Color lighter = steel.lighten(0.1);  // snippet: shades
        Color darker = steel.lighten(-0.1);  // snippet: shades
        System.out.println("lighter " + lighter.toHex().get(0) + ", darker " + darker.toHex().get(0));
        System.out.println(
            "more saturated " + steel.saturate(1.5).toHex().get(0) + ", less " + steel.saturate(0.5).toHex().get(0));
        Color opposite = steel.rotateHue(180.0);  // snippet: harmony
        System.out.println("opposite hue " + opposite.toHex().get(0) + ", gray " + steel.grayscale().toHex().get(0));

        // Or change every channel value directly.
        show("orange halved", orange.map(x -> x / 2));

        section("7. Contrast");

        // Relative luminance and contrast ratios, as WCAG defines them. Text needs
        // 4.5 or more against its background for normal sizes.
        Color white = Color.parse("white");  // snippet: contrast
        Color texts = Color.fromRgbInts(List.of(0x000000, 0x767676, 0x999999));  // snippet: contrast
        List<Double> ratios = texts.contrast(white);  // snippet: contrast
        System.out.println("luminance " + nums(texts.luminance()));
        System.out.println("against white " + nums(ratios));

        // The lightest steelblue that white text can sit on, at 4.5 or more.
        Color shade = steel.fitContrast(white, 4.5, Space.srgb);
        System.out.println("steelblue for white text " + shade.toHex().get(0) + ", " + num(shade.contrast(white).get(0)));

        section("8. Channels as lists");

        // A Color keeps its channels in one flat list, row after row.
        System.out.println(pair.getLength() + " colors of " + pair.getWidth() + " channels");
        System.out.println("row 1, channel 2: " + num(pair.get(1, 2)));
        System.out.println("values " + nums(pair.toList()));
        System.out.println("doubled " + nums(pair.map(x -> x * 2).toList()));
        System.out.println("with alpha " + nums(seeThrough.toListWithAlpha()));

        // Reading past the end fails.
        try {
            pair.get(0, 5);
            System.out.println("got?");
        } catch (RuntimeException e) {
            System.out.println("channel 5 doesn't exist");
        }
    }
}
