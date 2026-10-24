# Named Colors

The 148 named colors of [CSS Color 4][Css4Named], plus `transparent`. Names are
case-insensitive, as in CSS. These are handy for input, but they're a fixed and
arbitrary set, not evenly spaced in any way, so they make poor palettes.

    let parseNamed(name: String): Color throws Bubble {
      let lower = asciiLower(name);
      if (lower == "transparent") {
        return Color.fromListWithAlpha(Space.srgb, [0.0, 0.0, 0.0, 0.0]);
      }
      Color.fromRows(Space.srgb, intToUnit([namedColors.get(lower)]))
    }

Lowercases only ASCII letters, which is all color names need.

    let asciiLower(text: String): String {
      let builder = new StringBuilder();
      for (var i = String.begin; i < text.end; i = text.next(i)) {
        let codePoint = text[i];
        let lowered = if (codePoint >= 65 && codePoint <= 90) { codePoint + 32 } else { codePoint };
        builder.append(String.fromCodePoint(lowered) orelse panic());
      }
      builder.toString()
    }

Packed as `0xrrggbb`. Built with one `set` per color rather than a map
literal, which Temper's Java backend turns into one huge generic expression
that javac takes minutes to type-check, or fails on.

    let namedColors: Map<String, Int> = do {
      let colors = new MapBuilder<String, Int>();
      colors.set("aliceblue", 0xf0f8ff);
      colors.set("antiquewhite", 0xfaebd7);
      colors.set("aqua", 0x00ffff);
      colors.set("aquamarine", 0x7fffd4);
      colors.set("azure", 0xf0ffff);
      colors.set("beige", 0xf5f5dc);
      colors.set("bisque", 0xffe4c4);
      colors.set("black", 0x000000);
      colors.set("blanchedalmond", 0xffebcd);
      colors.set("blue", 0x0000ff);
      colors.set("blueviolet", 0x8a2be2);
      colors.set("brown", 0xa52a2a);
      colors.set("burlywood", 0xdeb887);
      colors.set("cadetblue", 0x5f9ea0);
      colors.set("chartreuse", 0x7fff00);
      colors.set("chocolate", 0xd2691e);
      colors.set("coral", 0xff7f50);
      colors.set("cornflowerblue", 0x6495ed);
      colors.set("cornsilk", 0xfff8dc);
      colors.set("crimson", 0xdc143c);
      colors.set("cyan", 0x00ffff);
      colors.set("darkblue", 0x00008b);
      colors.set("darkcyan", 0x008b8b);
      colors.set("darkgoldenrod", 0xb8860b);
      colors.set("darkgray", 0xa9a9a9);
      colors.set("darkgreen", 0x006400);
      colors.set("darkgrey", 0xa9a9a9);
      colors.set("darkkhaki", 0xbdb76b);
      colors.set("darkmagenta", 0x8b008b);
      colors.set("darkolivegreen", 0x556b2f);
      colors.set("darkorange", 0xff8c00);
      colors.set("darkorchid", 0x9932cc);
      colors.set("darkred", 0x8b0000);
      colors.set("darksalmon", 0xe9967a);
      colors.set("darkseagreen", 0x8fbc8f);
      colors.set("darkslateblue", 0x483d8b);
      colors.set("darkslategray", 0x2f4f4f);
      colors.set("darkslategrey", 0x2f4f4f);
      colors.set("darkturquoise", 0x00ced1);
      colors.set("darkviolet", 0x9400d3);
      colors.set("deeppink", 0xff1493);
      colors.set("deepskyblue", 0x00bfff);
      colors.set("dimgray", 0x696969);
      colors.set("dimgrey", 0x696969);
      colors.set("dodgerblue", 0x1e90ff);
      colors.set("firebrick", 0xb22222);
      colors.set("floralwhite", 0xfffaf0);
      colors.set("forestgreen", 0x228b22);
      colors.set("fuchsia", 0xff00ff);
      colors.set("gainsboro", 0xdcdcdc);
      colors.set("ghostwhite", 0xf8f8ff);
      colors.set("gold", 0xffd700);
      colors.set("goldenrod", 0xdaa520);
      colors.set("gray", 0x808080);
      colors.set("green", 0x008000);
      colors.set("greenyellow", 0xadff2f);
      colors.set("grey", 0x808080);
      colors.set("honeydew", 0xf0fff0);
      colors.set("hotpink", 0xff69b4);
      colors.set("indianred", 0xcd5c5c);
      colors.set("indigo", 0x4b0082);
      colors.set("ivory", 0xfffff0);
      colors.set("khaki", 0xf0e68c);
      colors.set("lavender", 0xe6e6fa);
      colors.set("lavenderblush", 0xfff0f5);
      colors.set("lawngreen", 0x7cfc00);
      colors.set("lemonchiffon", 0xfffacd);
      colors.set("lightblue", 0xadd8e6);
      colors.set("lightcoral", 0xf08080);
      colors.set("lightcyan", 0xe0ffff);
      colors.set("lightgoldenrodyellow", 0xfafad2);
      colors.set("lightgray", 0xd3d3d3);
      colors.set("lightgreen", 0x90ee90);
      colors.set("lightgrey", 0xd3d3d3);
      colors.set("lightpink", 0xffb6c1);
      colors.set("lightsalmon", 0xffa07a);
      colors.set("lightseagreen", 0x20b2aa);
      colors.set("lightskyblue", 0x87cefa);
      colors.set("lightslategray", 0x778899);
      colors.set("lightslategrey", 0x778899);
      colors.set("lightsteelblue", 0xb0c4de);
      colors.set("lightyellow", 0xffffe0);
      colors.set("lime", 0x00ff00);
      colors.set("limegreen", 0x32cd32);
      colors.set("linen", 0xfaf0e6);
      colors.set("magenta", 0xff00ff);
      colors.set("maroon", 0x800000);
      colors.set("mediumaquamarine", 0x66cdaa);
      colors.set("mediumblue", 0x0000cd);
      colors.set("mediumorchid", 0xba55d3);
      colors.set("mediumpurple", 0x9370db);
      colors.set("mediumseagreen", 0x3cb371);
      colors.set("mediumslateblue", 0x7b68ee);
      colors.set("mediumspringgreen", 0x00fa9a);
      colors.set("mediumturquoise", 0x48d1cc);
      colors.set("mediumvioletred", 0xc71585);
      colors.set("midnightblue", 0x191970);
      colors.set("mintcream", 0xf5fffa);
      colors.set("mistyrose", 0xffe4e1);
      colors.set("moccasin", 0xffe4b5);
      colors.set("navajowhite", 0xffdead);
      colors.set("navy", 0x000080);
      colors.set("oldlace", 0xfdf5e6);
      colors.set("olive", 0x808000);
      colors.set("olivedrab", 0x6b8e23);
      colors.set("orange", 0xffa500);
      colors.set("orangered", 0xff4500);
      colors.set("orchid", 0xda70d6);
      colors.set("palegoldenrod", 0xeee8aa);
      colors.set("palegreen", 0x98fb98);
      colors.set("paleturquoise", 0xafeeee);
      colors.set("palevioletred", 0xdb7093);
      colors.set("papayawhip", 0xffefd5);
      colors.set("peachpuff", 0xffdab9);
      colors.set("peru", 0xcd853f);
      colors.set("pink", 0xffc0cb);
      colors.set("plum", 0xdda0dd);
      colors.set("powderblue", 0xb0e0e6);
      colors.set("purple", 0x800080);
      colors.set("rebeccapurple", 0x663399);
      colors.set("red", 0xff0000);
      colors.set("rosybrown", 0xbc8f8f);
      colors.set("royalblue", 0x4169e1);
      colors.set("saddlebrown", 0x8b4513);
      colors.set("salmon", 0xfa8072);
      colors.set("sandybrown", 0xf4a460);
      colors.set("seagreen", 0x2e8b57);
      colors.set("seashell", 0xfff5ee);
      colors.set("sienna", 0xa0522d);
      colors.set("silver", 0xc0c0c0);
      colors.set("skyblue", 0x87ceeb);
      colors.set("slateblue", 0x6a5acd);
      colors.set("slategray", 0x708090);
      colors.set("slategrey", 0x708090);
      colors.set("snow", 0xfffafa);
      colors.set("springgreen", 0x00ff7f);
      colors.set("steelblue", 0x4682b4);
      colors.set("tan", 0xd2b48c);
      colors.set("teal", 0x008080);
      colors.set("thistle", 0xd8bfd8);
      colors.set("tomato", 0xff6347);
      colors.set("turquoise", 0x40e0d0);
      colors.set("violet", 0xee82ee);
      colors.set("wheat", 0xf5deb3);
      colors.set("white", 0xffffff);
      colors.set("whitesmoke", 0xf5f5f5);
      colors.set("yellow", 0xffff00);
      colors.set("yellowgreen", 0x9acd32);
      colors.toMap()
    };

    test("parseNamed") { test =>
      let purple = parseNamed("RebeccaPurple");
      assert(purple.toHex()[0] == "#663399");
      assert(parseNamed("grey").toHex()[0] == parseNamed("gray").toHex()[0]);
      assert(parseNamed("transparent").alphaAt(0) == 0.0);
      assert(do { parseNamed("notacolor"); false } orelse true);
    }

[Css4Named]: https://www.w3.org/TR/css-color-4/#named-colors
