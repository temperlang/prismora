# Named Colors

The 148 named colors of [CSS Color 4][Css4Named], plus `transparent`. Names are
case-insensitive, as in CSS. These are handy for input, but they're a fixed and
arbitrary set, not evenly spaced in any way, so they make poor palettes.

    export let parseNamed(name: String): Color throws Bubble {
      let lower = asciiLower(name);
      if (lower == "transparent") {
        return Color.fromAlpha(Space.srgb, [0.0, 0.0, 0.0, 0.0]);
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

Packed as `0xrrggbb`.

    let namedColors = new Map([
      new Pair("aliceblue", 0xf0f8ff),
      new Pair("antiquewhite", 0xfaebd7),
      new Pair("aqua", 0x00ffff),
      new Pair("aquamarine", 0x7fffd4),
      new Pair("azure", 0xf0ffff),
      new Pair("beige", 0xf5f5dc),
      new Pair("bisque", 0xffe4c4),
      new Pair("black", 0x000000),
      new Pair("blanchedalmond", 0xffebcd),
      new Pair("blue", 0x0000ff),
      new Pair("blueviolet", 0x8a2be2),
      new Pair("brown", 0xa52a2a),
      new Pair("burlywood", 0xdeb887),
      new Pair("cadetblue", 0x5f9ea0),
      new Pair("chartreuse", 0x7fff00),
      new Pair("chocolate", 0xd2691e),
      new Pair("coral", 0xff7f50),
      new Pair("cornflowerblue", 0x6495ed),
      new Pair("cornsilk", 0xfff8dc),
      new Pair("crimson", 0xdc143c),
      new Pair("cyan", 0x00ffff),
      new Pair("darkblue", 0x00008b),
      new Pair("darkcyan", 0x008b8b),
      new Pair("darkgoldenrod", 0xb8860b),
      new Pair("darkgray", 0xa9a9a9),
      new Pair("darkgreen", 0x006400),
      new Pair("darkgrey", 0xa9a9a9),
      new Pair("darkkhaki", 0xbdb76b),
      new Pair("darkmagenta", 0x8b008b),
      new Pair("darkolivegreen", 0x556b2f),
      new Pair("darkorange", 0xff8c00),
      new Pair("darkorchid", 0x9932cc),
      new Pair("darkred", 0x8b0000),
      new Pair("darksalmon", 0xe9967a),
      new Pair("darkseagreen", 0x8fbc8f),
      new Pair("darkslateblue", 0x483d8b),
      new Pair("darkslategray", 0x2f4f4f),
      new Pair("darkslategrey", 0x2f4f4f),
      new Pair("darkturquoise", 0x00ced1),
      new Pair("darkviolet", 0x9400d3),
      new Pair("deeppink", 0xff1493),
      new Pair("deepskyblue", 0x00bfff),
      new Pair("dimgray", 0x696969),
      new Pair("dimgrey", 0x696969),
      new Pair("dodgerblue", 0x1e90ff),
      new Pair("firebrick", 0xb22222),
      new Pair("floralwhite", 0xfffaf0),
      new Pair("forestgreen", 0x228b22),
      new Pair("fuchsia", 0xff00ff),
      new Pair("gainsboro", 0xdcdcdc),
      new Pair("ghostwhite", 0xf8f8ff),
      new Pair("gold", 0xffd700),
      new Pair("goldenrod", 0xdaa520),
      new Pair("gray", 0x808080),
      new Pair("green", 0x008000),
      new Pair("greenyellow", 0xadff2f),
      new Pair("grey", 0x808080),
      new Pair("honeydew", 0xf0fff0),
      new Pair("hotpink", 0xff69b4),
      new Pair("indianred", 0xcd5c5c),
      new Pair("indigo", 0x4b0082),
      new Pair("ivory", 0xfffff0),
      new Pair("khaki", 0xf0e68c),
      new Pair("lavender", 0xe6e6fa),
      new Pair("lavenderblush", 0xfff0f5),
      new Pair("lawngreen", 0x7cfc00),
      new Pair("lemonchiffon", 0xfffacd),
      new Pair("lightblue", 0xadd8e6),
      new Pair("lightcoral", 0xf08080),
      new Pair("lightcyan", 0xe0ffff),
      new Pair("lightgoldenrodyellow", 0xfafad2),
      new Pair("lightgray", 0xd3d3d3),
      new Pair("lightgreen", 0x90ee90),
      new Pair("lightgrey", 0xd3d3d3),
      new Pair("lightpink", 0xffb6c1),
      new Pair("lightsalmon", 0xffa07a),
      new Pair("lightseagreen", 0x20b2aa),
      new Pair("lightskyblue", 0x87cefa),
      new Pair("lightslategray", 0x778899),
      new Pair("lightslategrey", 0x778899),
      new Pair("lightsteelblue", 0xb0c4de),
      new Pair("lightyellow", 0xffffe0),
      new Pair("lime", 0x00ff00),
      new Pair("limegreen", 0x32cd32),
      new Pair("linen", 0xfaf0e6),
      new Pair("magenta", 0xff00ff),
      new Pair("maroon", 0x800000),
      new Pair("mediumaquamarine", 0x66cdaa),
      new Pair("mediumblue", 0x0000cd),
      new Pair("mediumorchid", 0xba55d3),
      new Pair("mediumpurple", 0x9370db),
      new Pair("mediumseagreen", 0x3cb371),
      new Pair("mediumslateblue", 0x7b68ee),
      new Pair("mediumspringgreen", 0x00fa9a),
      new Pair("mediumturquoise", 0x48d1cc),
      new Pair("mediumvioletred", 0xc71585),
      new Pair("midnightblue", 0x191970),
      new Pair("mintcream", 0xf5fffa),
      new Pair("mistyrose", 0xffe4e1),
      new Pair("moccasin", 0xffe4b5),
      new Pair("navajowhite", 0xffdead),
      new Pair("navy", 0x000080),
      new Pair("oldlace", 0xfdf5e6),
      new Pair("olive", 0x808000),
      new Pair("olivedrab", 0x6b8e23),
      new Pair("orange", 0xffa500),
      new Pair("orangered", 0xff4500),
      new Pair("orchid", 0xda70d6),
      new Pair("palegoldenrod", 0xeee8aa),
      new Pair("palegreen", 0x98fb98),
      new Pair("paleturquoise", 0xafeeee),
      new Pair("palevioletred", 0xdb7093),
      new Pair("papayawhip", 0xffefd5),
      new Pair("peachpuff", 0xffdab9),
      new Pair("peru", 0xcd853f),
      new Pair("pink", 0xffc0cb),
      new Pair("plum", 0xdda0dd),
      new Pair("powderblue", 0xb0e0e6),
      new Pair("purple", 0x800080),
      new Pair("rebeccapurple", 0x663399),
      new Pair("red", 0xff0000),
      new Pair("rosybrown", 0xbc8f8f),
      new Pair("royalblue", 0x4169e1),
      new Pair("saddlebrown", 0x8b4513),
      new Pair("salmon", 0xfa8072),
      new Pair("sandybrown", 0xf4a460),
      new Pair("seagreen", 0x2e8b57),
      new Pair("seashell", 0xfff5ee),
      new Pair("sienna", 0xa0522d),
      new Pair("silver", 0xc0c0c0),
      new Pair("skyblue", 0x87ceeb),
      new Pair("slateblue", 0x6a5acd),
      new Pair("slategray", 0x708090),
      new Pair("slategrey", 0x708090),
      new Pair("snow", 0xfffafa),
      new Pair("springgreen", 0x00ff7f),
      new Pair("steelblue", 0x4682b4),
      new Pair("tan", 0xd2b48c),
      new Pair("teal", 0x008080),
      new Pair("thistle", 0xd8bfd8),
      new Pair("tomato", 0xff6347),
      new Pair("turquoise", 0x40e0d0),
      new Pair("violet", 0xee82ee),
      new Pair("wheat", 0xf5deb3),
      new Pair("white", 0xffffff),
      new Pair("whitesmoke", 0xf5f5f5),
      new Pair("yellow", 0xffff00),
      new Pair("yellowgreen", 0x9acd32),
    ]);

    test("parseNamed") { test =>
      let purple = parseNamed("RebeccaPurple");
      assert(purple.toHex()[0] == "#663399");
      assert(parseNamed("grey").toHex()[0] == parseNamed("gray").toHex()[0]);
      assert(parseNamed("transparent").alphaAt(0) == 0.0);
      assert(do { parseNamed("notacolor"); false } orelse true);
    }

[Css4Named]: https://www.w3.org/TR/css-color-4/#named-colors
