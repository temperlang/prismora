// The page's behavior: the color converter, the code tabs, and library
// sizes. Prismora comes from Temper's JS output through the import map.

import { Color, Space } from "prismora";

// Spaces in the table, with channel names and what each is for.
const SPACES = [
  [Space.srgb, "R G B", "The standard for screens and the web: amounts of red, green and blue light."],
  [Space.srgbLinear, "R G B", "sRGB without its brightness curve, so values are proportional to light. Used inside color math."],
  [Space.hsl, "H S L", "sRGB as hue, saturation and lightness. Easy to reason about, but its lightness doesn't match what eyes see."],
  [Space.hsv, "H S V", "Hue, saturation and value, as in many color pickers."],
  [Space.hwb, "H W B", "Hue, plus how much white and black to mix in."],
  [Space.oklab, "L a b", "Made so equal steps look equal. L is lightness; a runs green to red, b blue to yellow."],
  [Space.oklch, "L C H", "Oklab as lightness, chroma (colorfulness) and hue. Usually the best space for picking and adjusting colors."],
  [Space.displayP3, "R G B", "A wider gamut used by many phones and laptops, with more vivid reds and greens than sRGB."],
  [Space.a98Rgb, "R G B", "Adobe RGB (1998), a wide gamut from photography and print."],
  [Space.prophotoRgb, "R G B", "A very wide gamut for photo editing, including some colors no eye can see."],
  [Space.rec2020, "R G B", "The ultra-wide gamut of HDR and UHD video."],
  [Space.xyzD65, "X Y Z", "CIE XYZ, the reference other spaces are defined from, with daylight as white."],
  [Space.xyzD50, "X Y Z", "XYZ with the warmer white used in print and by CIE Lab."],
  [Space.lab, "L a b", "CIE Lab, the classic perceptual space: older and less even than Oklab."],
  [Space.lch, "L C H", "CIE Lab as lightness, chroma and hue."],
];

const $ = (id) => document.getElementById(id);

function fmt(x) {
  const v = Math.abs(x) < 0.00005 ? 0 : x;
  return v.toFixed(Math.abs(v) >= 10 ? 2 : 4);
}

function setSwatch(element, css) {
  element.style.setProperty("--swatch", css);
}

function showColor(text) {
  const status = $("color-status");
  let color;
  try {
    color = Color.parse(text.trim());
  } catch {
    status.textContent = "Not a color Prismora can read yet.";
    status.classList.add("error");
    return;
  }
  status.classList.remove("error");
  status.textContent = `Hex: ${color.toHex()[0]}`;

  // The browser draws the color as written; if it can't, the hex will do.
  const asWritten = CSS.supports("color", text) ? text : color.toCss()[0];
  setSwatch($("swatch-color"), asWritten);
  const inSrgb = color.inGamut(Space.srgb)[0];
  $("mapped-figure").hidden = inSrgb;
  $("gamut-note").hidden = inSrgb;
  setSwatch($("swatch-mapped"), color.toHex()[0]);

  const rows = SPACES.map(([space, channels, about]) => {
    const converted = color.convert(space);
    const values = converted.rows.toList().map(fmt);
    const labeled = channels.split(" ").map((name, i) => `${name} ${values[i]}`).join("  ");
    const alpha = converted.alpha === null ? "" : `  α ${fmt(converted.alphaAt(0))}`;
    const tr = document.createElement("tr");
    for (const [cls, content] of [
      ["name", space.name],
      ["values", labeled + alpha],
      ["css", converted.toCss()[0]],
      ["about", about],
    ]) {
      const td = document.createElement(cls === "name" ? "th" : "td");
      if (cls === "name") td.scope = "row";
      td.className = cls;
      td.textContent = content;
      tr.append(td);
    }
    return tr;
  });
  $("spaces-body").replaceChildren(...rows);

  const [white, black] = [Color.parse("white"), Color.parse("black")];
  const onWhite = color.contrast(white)[0];
  const onBlack = color.contrast(black)[0];
  $("contrast").textContent =
    `Contrast with white text: ${onWhite.toFixed(2)}:1. With black text: ${onBlack.toFixed(2)}:1. ` +
    `WCAG asks for at least 4.5:1 for body text.`;
}

const input = $("color-input");
input.addEventListener("input", () => showColor(input.value));
for (const button of document.querySelectorAll(".examples button")) {
  button.addEventListener("click", () => {
    input.value = button.textContent;
    showColor(input.value);
  });
}
showColor(input.value);

// Code tabs: each language's tour, with a small highlighter.

const LANGUAGES = [
  ["Python", "py", "uv run tour.py", "#"],
  ["JavaScript", "js", "npm install && npm start", "//"],
  ["Java", "java", "./gradlew run", "//"],
  ["C#", "cs", "dotnet run", "//"],
  ["Rust", "rs", "cargo run", "//"],
  ["C++", "cpp", "cmake -B build && cmake --build build && ./build/tour", "//"],
  ["Lua", "lua", "lua -l paths tour.lua", "--"],
];

const KEYWORDS = new Set(
  ("and as auto bool break case catch class const continue def do double else elif end except " +
    "false fn for foreach from function if import in int let local match mut new None nil not null " +
    "or private public return self static string struct template then true True False try type " +
    "typename use using var void while")
    .split(" "),
);

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

function highlight(source, comment) {
  const commentPattern = comment === "#" ? "#[^\\n]*" : comment === "--" ? "--[^\\n]*" : "//[^\\n]*|/\\*[\\s\\S]*?\\*/";
  const token = new RegExp(
    `(${commentPattern})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*'|\`[^\`]*\`)|` +
      `\\b(0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b|([A-Za-z_]\\w*)`,
    "g",
  );
  let out = "";
  let last = 0;
  for (const m of source.matchAll(token)) {
    out += escapeHtml(source.slice(last, m.index));
    const [text, isComment, isString, isNumber, word] = m;
    const cls = isComment ? "comment" : isString ? "string" : isNumber ? "number" : KEYWORDS.has(word) ? "keyword" : null;
    out += cls ? `<span class="tok-${cls}">${escapeHtml(text)}</span>` : escapeHtml(text);
    last = m.index + text.length;
  }
  return out + escapeHtml(source.slice(last));
}

const tabs = document.querySelector(".tabs");
const sources = new Map();

async function selectTab(index) {
  const [, file, run, comment] = LANGUAGES[index];
  for (const [i, button] of [...tabs.children].entries()) {
    button.setAttribute("aria-selected", String(i === index));
    button.tabIndex = i === index ? 0 : -1;
  }
  $("run-command").textContent = run;
  if (!sources.has(file)) {
    const response = await fetch(`tour/tour.${file}`);
    sources.set(file, response.ok ? await response.text() : "// Couldn't load this tour.");
  }
  $("source").innerHTML = highlight(sources.get(file), comment);
}

for (const [i, [name]] of LANGUAGES.entries()) {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "tab";
  button.textContent = name;
  button.addEventListener("click", () => selectTab(i));
  button.addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) {
      const next = (i + step + LANGUAGES.length) % LANGUAGES.length;
      selectTab(next);
      tabs.children[next].focus();
    }
  });
  tabs.append(button);
}
selectTab(0);

// Library sizes, measured when the site was built.

fetch("sizes.json")
  .then((response) => response.json())
  .then((sizes) => {
    const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
    const items = sizes.map(
      ({ name, raw, gzip }) => `<li>${escapeHtml(name)}: ${kb(raw)}, or ${kb(gzip)} gzipped</li>`,
    );
    $("sizes").innerHTML = items.join("");
  })
  .catch(() => {});
