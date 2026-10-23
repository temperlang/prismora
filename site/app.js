// The page's behavior: the color converter, the code tabs, and library
// sizes. Prismora comes from Temper's JS output through the import map.

import { Color, HueMethod, Matrix, Space } from "prismora";
import "./picker.js";

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

// The table of spaces and the contrast note, for the picked color.
function showDetails(color) {
  const rows = SPACES.map(([space, channels, about]) => {
    const converted = color.convert(space);
    const values = converted.rows.toList().map(fmt);
    // Each channel is a chip that wraps as a whole, so the table needn't
    // scroll sideways.
    const chips = channels.split(" ").map((name, i) => `${name} ${values[i]}`);
    if (converted.alpha !== null) chips.push(`α ${fmt(converted.alphaAt(0))}`);
    const tr = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.className = "name";
    name.textContent = space.name;
    const valuesCell = document.createElement("td");
    valuesCell.className = "values";
    valuesCell.append(
      ...chips.map((text) => {
        const chip = document.createElement("span");
        chip.textContent = text;
        return chip;
      }),
    );
    tr.append(name, valuesCell);
    for (const [cls, content] of [["css", converted.toCss()[0]], ["about", about]]) {
      const td = document.createElement("td");
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

// The picker drives the details below it, a wash of its hue behind it, and
// the URL, so any color is a shareable link.
const picker = $("picker");
picker.addEventListener("input", () => {
  const color = picker.color;
  showDetails(color);
  const [L, C, turns] = color.convert(Space.oklch).rows.toList();
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const wash = Color.fromList(Space.oklch, [dark ? 0.2 : 0.965, Math.min(C, dark ? 0.03 : 0.025), turns]);
  $("pick").style.setProperty("--wash", wash.toHex()[0]);
  history.replaceState(null, "", `#color=${encodeURIComponent(picker.value)}`);
});
picker.value = new URLSearchParams(location.hash.slice(1)).get("color") ?? "oklch(70% 0.2 30)";
for (const button of document.querySelectorAll(".examples button")) {
  button.addEventListener("click", () => (picker.value = button.textContent));
}

// Playground: runs the visitor's own code in their browser, with
// console.log sent to the page.

const PLAY_START = `// Parse any CSS color.
const brand = Color.parse("oklch(60% 0.15 250)");
console.log("brand", brand.toHex()[0]);

// Five shades, evenly spaced in OkLCh lightness, from dark to light.
// A Color can hold many colors: each row is lightness, chroma and hue.
const ends = Color.fromList(Space.oklch, [
  0.3, 0.12, 0.69, // dark blue
  0.9, 0.05, 0.69, // pale blue
]);
console.log(ends.gradient(5, Space.oklch).toHex().join(" "));

// Is white text readable on it? WCAG wants 4.5 or more.
console.log("contrast", brand.contrast(Color.parse("white"))[0].toFixed(2));
`;

const playCode = $("play-code");
const playOutput = $("play-output");
const playHighlight = $("play-highlight");
playCode.value = PLAY_START;

// Redraws the highlighted copy behind the textarea, and keeps it scrolled
// the same. A trailing newline needs a space after it to be drawn.
function syncHighlight() {
  playHighlight.firstChild.innerHTML = highlight(playCode.value + " ", "//");
  playHighlight.scrollTop = playCode.scrollTop;
  playHighlight.scrollLeft = playCode.scrollLeft;
}
// Grows the editor to fit its code, so it doesn't scroll up and down.
function fitEditor() {
  playCode.style.height = "auto";
  playCode.style.height = `${playCode.scrollHeight + 2}px`;
}
playCode.addEventListener("input", () => {
  fitEditor();
  syncHighlight();
});
playCode.addEventListener("scroll", syncHighlight);

function showOutput(text, isError = false) {
  const line = document.createElement("div");
  if (isError) line.className = "error";
  // A swatch before each hex color.
  for (const part of text.split(/(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b)/)) {
    if (/^#[0-9a-fA-F]{6}/.test(part)) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.background = part;
      line.append(chip);
    }
    line.append(part);
  }
  playOutput.append(line);
}

// Runs code as the body of an async function, given Prismora's classes and
// a console that writes to `log`. Visitors run their own code in their own
// browser; the page shares nothing with it but these.
const AsyncFunction = (async () => {}).constructor;

async function runCode(code, log) {
  const console = { log, error: log, warn: log, info: log };
  const run = new AsyncFunction("Color", "HueMethod", "Matrix", "Space", "console", code);
  await run(Color, HueMethod, Matrix, Space, console);
}

async function runPlay() {
  playOutput.replaceChildren();
  try {
    await runCode(playCode.value, (...args) => showOutput(args.map(String).join(" ")));
  } catch (error) {
    showOutput(String(error), true);
  }
}

$("play-run").addEventListener("click", runPlay);
playCode.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runPlay();
  }
});
runPlay();

// Code tabs: each language's tour, with a small highlighter.

const LANGUAGES = [
  ["C++", "cpp", "cmake -B build && cmake --build build && ./build/tour", "//"],
  ["C#", "cs", "dotnet run", "//"],
  ["Java", "java", "./gradlew run", "//"],
  ["JavaScript", "js", "npm ci && npm start", "//"],
  ["Lua", "lua", "lua -l paths tour.lua", "--"],
  ["Python", "py", "uv run tour.py", "#"],
  ["Rust", "rs", "cargo run", "//"],
];
// Python is well known, and JavaScript already has the playground above.
const DEFAULT_LANGUAGE = "py";

const KEYWORDS = new Set(
  ("and as async auto await bool break case catch class const continue def do double else elif end except export " +
    "false fn for foreach from function if import in int let local match mut new None nil not null " +
    "of or private public return self static string struct template then this throw true True False try " +
    "type typename typeof use using var void while")
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
  $("source-label").textContent = `Read-only example: ${LANGUAGES[index][0]}`;
  if (!sources.has(file)) {
    const response = await fetch(`tour/tour.${file}`, { cache: "no-cache" });
    sources.set(file, response.ok ? await response.text() : "// Couldn't load this tour.");
  }
  $("source").innerHTML = highlight(sources.get(file), comment);
  selectedTour = file;
  $("tour-run").disabled = !(file in TOUR_RUNNERS);
  $("tour-output").hidden = true;
  $("tour-run-note").textContent = RUN_NOTES[file] ?? "Only JavaScript and Rust run in this page; run this one locally with the command above.";
}

// Tours the page can run: Rust compiled to wasm, whose println! calls an
// imported print function, and JavaScript as a module, with console.log
// sent to the page.

let selectedTour = null;

// Compiled once, on the first run, then reused; each run gets a fresh
// instance, so runs don't share memory.
let rustModule = null;

async function runRustTour() {
  rustModule ??= WebAssembly.compileStreaming(fetch("tour/tour.wasm", { cache: "no-cache" }))
    // Some servers don't label wasm as such, which streaming needs.
    .catch(() => fetch("tour/tour.wasm", { cache: "no-cache" }).then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b)))
    .catch((error) => {
      rustModule = null; // Try again next time.
      throw error;
    });
  let memory;
  let out = "";
  const decoder = new TextDecoder();
  const instance = await WebAssembly.instantiate(await rustModule, {
    env: { print: (ptr, len) => (out += decoder.decode(new Uint8Array(memory.buffer, ptr, len))) },
  });
  memory = instance.exports.memory;
  instance.exports.run();
  return out;
}

async function runJsTour() {
  // The tour's import line names what runCode passes in.
  const code = sources.get("js").replace(/^import .* from "prismora";$/m, "");
  const lines = [];
  await runCode(code, (...args) => lines.push(args.map(String).join(" ")));
  return lines.map((line) => line + "\n").join("");
}

const TOUR_RUNNERS = { rs: runRustTour, js: runJsTour };
const RUN_NOTES = {
  js: "Runs as JavaScript in this page.",
  rs: "Precompiled to WebAssembly, and run in this page.",
};

$("tour-run").addEventListener("click", async () => {
  const output = $("tour-output");
  const note = $("tour-run-note");
  output.hidden = false;
  output.textContent = "Running…";
  try {
    const out = await TOUR_RUNNERS[selectedTour]();
    output.textContent = out;
    // TOUR_EXPECTED is the tours' shared output, which CI checks in every
    // language; the site build fills it in.
    note.textContent = out === TOUR_EXPECTED ? "✓ The same output as every other language." : "The output differs from the other languages.";
  } catch (error) {
    output.textContent = String(error);
    note.textContent = "";
  }
});

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

// Library sizes, measured when the site was built.

fetch("sizes.json", { cache: "no-cache" })
  .then((response) => response.json())
  .then((sizes) => {
    const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
    const items = sizes.map(
      ({ name, raw, gzip }) => `<li>${escapeHtml(name)}: ${kb(raw)}, or ${kb(gzip)} gzipped</li>`,
    );
    $("sizes").innerHTML = items.join("");
  })
  .catch(() => {});

// Start up, once everything above is defined.
selectTab(LANGUAGES.findIndex(([, file]) => file === DEFAULT_LANGUAGE));
fitEditor();
syncHighlight();
