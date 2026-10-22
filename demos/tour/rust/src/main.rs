//! A tour of Prismora's whole public API, from Rust.
//!
//! The same tour exists for each language Prismora supports, and they all
//! print the same text. See ../README.md for how to run them.

use prismora::{Color, HueMethod, Matrix, Space};
use std::sync::Arc;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

/// Numbers print with 4 decimals, the same way in every language.
fn num(x: f64) -> String {
    let x = if x.abs() < 0.00005 { 0.0 } else { x }; // No "-0.0000".
    format!("{x:.4}")
}

fn nums(values: &[f64]) -> String {
    let parts: Vec<String> = values.iter().map(|&x| num(x)).collect();
    format!("[{}]", parts.join(", "))
}

fn yes(b: bool) -> &'static str {
    if b { "yes" } else { "no" }
}

fn join(strings: &[Arc<String>], sep: &str) -> String {
    strings.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(sep)
}

fn show(label: &str, color: &Color) -> Result<()> {
    println!("{label} ({}, {} x {}):", color.space().name(), color.length(), color.width());
    for i in 0..color.length() {
        let mut row = Vec::new();
        for j in 0..color.width() {
            row.push(color.get(i, j)?);
        }
        let alpha = match color.alpha() {
            Some(_) => format!(" alpha {}", num(color.alpha_at(i)?)),
            None => String::new(),
        };
        println!("  {}{alpha}", nums(&row));
    }
    Ok(())
}

fn section(title: &str) {
    println!();
    println!("## {title}");
}

fn main() -> Result<()> {
    // Sets up Prismora's constants. Call it once before anything else.
    prismora::init(None)?;

    println!("# Prismora tour");

    section("1. Making colors");

    // Channels go from 0 to 1, and hue is in turns (0 to 1), not degrees.
    let orange = Color::from_list(Space::srgb(), [1.0, 0.5, 0.0]);
    show("orange", &orange)?;

    // A Color holds any number of colors, one per row, channels back to back.
    let pair = Color::from_list(Space::oklch(), [0.7, 0.1, 0.4, 0.5, 0.2, 0.8]);
    show("two OkLCh colors", &pair)?;

    // Alpha (opacity, 0 to 1) goes after each row's channels.
    let see_through = Color::from_alpha(Space::srgb(), [1.0, 0.0, 0.0, 0.5, 0.0, 0.0, 1.0, 0.25]);
    show("red and blue, see-through", &see_through)?;
    show("orange at 80%", &orange.with_alpha([0.8]))?;

    // Packed 0xRRGGBB ints, as in hex literals or canvas pixels.
    show("from ints", &Color::from_rgb_ints([0x663399, 0x00ff80]))?;

    // From a Matrix: a flat list read as rows of a given width.
    let rows = Matrix::new(3, [0.5, 1.0, 0.25, 0.0, 0.0, 0.5]);
    show("from rows", &Color::from_rows(Space::hsl(), rows))?;

    // Any CSS color. Each keeps the space it was written in.
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
    ] {
        show(text, &Color::parse(text)?)?;
    }

    // Text that isn't a color fails.
    match Color::parse("not a color") {
        Ok(_) => println!("parsed?"),
        Err(_) => println!("'not a color' fails to parse"),
    }

    section("2. Spaces and converting");

    let spaces = [
        Space::srgb(), Space::srgb_linear(), Space::hsl(), Space::hsv(), Space::hwb(),
        Space::oklab(), Space::oklch(), Space::display_p3(), Space::a98_rgb(),
        Space::prophoto_rgb(), Space::rec2020(), Space::xyz_d65(), Space::xyz_d50(),
        Space::lab(), Space::lch(),
    ];

    // Each space converts through its parent, up to linear sRGB at the root.
    // Its gamut is the RGB space whose 0-to-1 cube bounds it, if any.
    for space in &spaces {
        let parent = space.parent().map_or("none".to_string(), |p| p.name().to_string());
        let gamut = space.gamut().map_or("none".to_string(), |g| g.name().to_string());
        println!(
            "{}: {} channels, parent {parent}, depth {}, gamut {gamut}",
            space.name(),
            space.ncols(),
            space.depth(),
        );
    }

    // The same orange in every space.
    for space in &spaces {
        println!("orange in {}: {}", space.name(), nums(&orange.convert(space.clone()).rows().to_list()));
    }

    section("3. Formatting");

    // Hex and ints fit colors into sRGB first; CSS keeps each color's space.
    let mixed = Color::parse("oklch(70% 0.15 200 / 50%)")?;
    let p3 = Color::parse("color(display-p3 1 0 0)")?;
    for color in [&orange, &see_through, &pair, &mixed, &p3] {
        println!("hex {}", join(&color.to_hex(), ", "));
        println!("css {}", join(&color.to_css(), ", "));
        let ints: Vec<String> = color.to_rgb_ints().iter().map(|n| format!("{n:06x}")).collect();
        println!("ints {}", ints.join(", "));
    }

    section("4. Gamuts");

    // Display P3's red is redder than any sRGB color: as sRGB, it's out of the
    // 0-to-1 range.
    let p3_red = Color::from_list(Space::display_p3(), [1.0, 0.0, 0.0]);
    println!(
        "P3 red in sRGB? {}; in P3? {}",
        yes(p3_red.in_gamut(Space::srgb())[0]),
        yes(p3_red.in_gamut(Space::display_p3())[0]),
    );
    show("P3 red as sRGB", &p3_red.convert(Space::srgb()))?;

    // To show a color like this vivid blue on an sRGB screen, either map it into
    // the gamut as CSS does, keeping lightness and hue and reducing chroma, or
    // clip each channel, which can change lightness and hue too.
    let vivid = Color::from_list(Space::oklch(), [0.6, 0.35, 0.75]);
    let mapped = vivid.to_gamut(Space::srgb());
    let clipped = vivid.clip(Space::srgb());
    show("vivid blue", &vivid)?;
    show("mapped, in OkLCh", &mapped.convert(Space::oklch()))?;
    show("clipped, in OkLCh", &clipped.convert(Space::oklch()))?;

    // deltaEOK measures how different two colors look: under about 0.02 is hard
    // to see.
    println!("mapped vs clipped: {}", num(mapped.delta_e_ok(clipped.clone())[0]));

    section("5. Mixing and gradients");

    let red = Color::parse("red")?;
    let blue = Color::parse("blue")?;
    // Oklab mixes look even; sRGB mixes go dull in the middle.
    println!("halfway in oklab: {}", red.mix(blue.clone(), 0.5, Space::oklab()).to_hex()[0]);
    println!("halfway in srgb: {}", red.mix(blue.clone(), 0.5, Space::srgb()).to_hex()[0]);

    // In a space with hue, choose which way around the hue wheel to go.
    for hue in [HueMethod::shorter(), HueMethod::longer(), HueMethod::increasing(), HueMethod::decreasing()] {
        let name = hue.name();
        println!("halfway in oklch, {name}: {}", red.mix_hue(blue.clone(), 0.5, Space::oklch(), hue).to_hex()[0]);
    }

    // Alpha mixes too, premultiplied as in CSS.
    show("see-through mix", &see_through.mix(orange.clone(), 0.5, Space::oklab()))?;

    // Gradients run through all rows as stops.
    let stops = Color::from_list(Space::srgb(), [1.0, 0.0, 0.0, 0.0, 0.0, 1.0]);
    println!("gradient: {}", join(&stops.gradient(5, Space::oklab()).to_hex(), " "));
    println!("long way: {}", join(&stops.gradient_hue(5, Space::oklch(), HueMethod::longer()).to_hex(), " "));

    section("6. Adjusting");

    // Adjustments happen in OkLCh, so equal steps look equal.
    let steel = Color::parse("steelblue")?;
    println!("steelblue {}", steel.to_hex()[0]);
    println!("lighter {}, darker {}", steel.lighten(0.1).to_hex()[0], steel.lighten(-0.1).to_hex()[0]);
    println!("more saturated {}, less {}", steel.saturate(1.5).to_hex()[0], steel.saturate(0.5).to_hex()[0]);
    println!("opposite hue {}, gray {}", steel.rotate_hue(0.5).to_hex()[0], steel.grayscale().to_hex()[0]);

    // Or change every channel value directly.
    show("orange halved", &orange.map(Arc::new(|x| x / 2.0)))?;

    section("7. Contrast");

    // Relative luminance and contrast ratios, as WCAG defines them. Text needs
    // 4.5 or more against its background for normal sizes.
    let white = Color::parse("white")?;
    let texts = Color::from_rgb_ints([0x000000, 0x767676, 0x999999]);
    println!("luminance {}", nums(&texts.luminance()));
    println!("against white {}", nums(&texts.contrast(white)));

    section("8. Matrix");

    // A Color's rows are a Matrix: one flat list, row after row.
    let rows = pair.rows();
    println!("{} rows of {}", rows.nrows(), rows.ncols());
    println!("row 1, column 2: {}; flat 4: {}", num(rows.get(1, 2)?), num(rows.at(4)?));
    println!("values {}", nums(&rows.to_list()));
    println!("doubled {}", nums(&rows.map(Arc::new(|x| x * 2.0)).to_list()));
    println!("one row {}", nums(&Matrix::row_of([0.1, 0.2, 0.3]).to_list()));
    println!("with alpha {}", nums(&see_through.rows_with_alpha().to_list()));

    // Reading past the end fails.
    match pair.get(0, 5) {
        Ok(_) => println!("got?"),
        Err(_) => println!("column 5 doesn't exist"),
    }
    Ok(())
}
