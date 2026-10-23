// @ts-check

// <prismora-picker>: a color picker any page can use.
//
//     <prismora-picker value="oklch(70% 0.2 30)"></prismora-picker>
//
// Its `value` is any CSS color, as an attribute or property; it fires
// `input` while the color changes and `change` when a change is done, and
// its `color` property is the Prismora Color. It fits its width, and takes
// --text, --muted, --border, --surface, --bg and --accent from the page.
// Parts, for styling or pointing at: plane, swatch, status, snap, readout
// and text.
//
// It shows an OkLCh plane for one hue at a time, lightness up and chroma
// across, with the edges of the sRGB, Display P3 and Rec. 2020 gamuts drawn
// on it. Prismora computes everything shown: each pixel, in one bulk
// conversion, the gamut edges, with `maxChroma`, and the chosen color's
// swatches, slider gradients, numbers and status.

import { Color, Space } from "prismora";

/**
 * A gamut drawn on the plane: its Prismora space, a key for styles, a label,
 * and the lightness where the label goes.
 * @typedef {{ space: Space, key: string, label: string, at: number }} Gamut
 */

/**
 * A color in OkLCh as the picker holds it: lightness and chroma as Prismora
 * has them, and hue in degrees.
 * @typedef {{ L: number, C: number, H: number }} Lch
 */

/**
 * The most chroma each gamut allows, by row of lightness, keyed like `Gamut`.
 * @typedef {Record<string, number[]>} Edges
 */

// OkLCh chroma at the plane's right edge. CSS takes 0.4 as 100%.
const MAX_CHROMA = 0.4;

// Rows of lightness for the gamut edges.
const EDGE_ROWS = 96;

// Plane resolution while dragging, and at rest.
const FAST_SIZE = 64;
const FULL_SIZE = 192;

/**
 * Whether this screen and browser can show Display P3, which is wider than
 * sRGB; most recent phones and Macs can.
 *
 * @returns {boolean}
 */
function wideGamut() {
  if (!matchMedia("(color-gamut: p3)").matches) return false;
  const ctx = document.createElement("canvas").getContext("2d", { colorSpace: "display-p3" });
  return ctx?.getContextAttributes?.().colorSpace === "display-p3";
}

/**
 * The gamuts drawn on the plane, from narrowest to widest.
 *
 * @type {Gamut[]}
 */
const GAMUTS = [
  { space: Space.srgb, key: "srgb", label: "sRGB", at: 0.3 },
  { space: Space.displayP3, key: "p3", label: "Display P3", at: 0.5 },
  { space: Space.rec2020, key: "rec2020", label: "Rec. 2020", at: 0.7 },
];

/**
 * Status pill text and its explanation, by how wide a gamut the color needs.
 *
 * @type {[string, string][]}
 */
const STATUS = [
  ["Fits every screen", "Inside sRGB, the range every screen and the web can show."],
  [
    "Wide-gamut screens only",
    "Outside sRGB but inside Display P3: newer phones and laptops show it; other screens show the closest sRGB color.",
  ],
  [
    "Beyond today's screens",
    "Inside Rec. 2020, the gamut of HDR video, but past what most screens can show. Screens show the closest color they can.",
  ],
  ["Beyond every gamut here", "Past even Rec. 2020. Screens show the closest color they can."],
];

/**
 * Keeps `x` between `lo` and `hi`.
 *
 * @param {number} x
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

/**
 * The most chroma that fits each gamut, for each row of lightness: Prismora's
 * maxChroma, capped at the plane's edge.
 *
 * @param {number} hueDegrees
 * @returns {Edges}
 */
function gamutEdges(hueDegrees) {
  const turns = hueDegrees / 360;
  const column = [];
  for (let i = 0; i <= EDGE_ROWS; i++) column.push(i / EDGE_ROWS, MAX_CHROMA, turns);
  const colors = Color.fromList(Space.oklch, column);
  /** @type {Edges} */
  const edges = {};
  for (const { space, key } of GAMUTS) {
    edges[key] = colors.maxChroma(space).map((c) => Math.min(c, MAX_CHROMA));
  }
  return edges;
}

/**
 * The edge's chroma at any lightness, between rows.
 *
 * @param {number[]} edge
 * @param {number} L
 * @returns {number}
 */
function edgeAt(edge, L) {
  const x = clamp(L, 0, 1) * EDGE_ROWS;
  const i = Math.min(Math.floor(x), EDGE_ROWS - 1);
  return edge[i] + (edge[i + 1] - edge[i]) * (x - i);
}

const TEMPLATE = `
<style>
  :host {
    display: block;
    container-type: inline-size;
    color: var(--text, #1d1d24);
  }
  * { box-sizing: border-box; }
  .grid { display: grid; gap: 1.5rem 2.5rem; }
  @container (min-width: 46rem) {
    .grid { grid-template-columns: minmax(0, 1.25fr) minmax(15rem, 1fr); align-items: start; }
  }
  .frame {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: 1fr auto;
    gap: 0.35rem 0.5rem;
  }
  .axis { font-size: 0.85rem; color: var(--muted, #5b5b6b); }
  .axis-y { writing-mode: vertical-rl; transform: rotate(180deg); align-self: center; }
  .axis-x { grid-column: 2; justify-self: center; }
  .plane, .hue, .frame, .hue-label { user-select: none; -webkit-user-select: none; }
  .plane {
    position: relative;
    aspect-ratio: 1;
    border-radius: 14px;
    cursor: crosshair;
    touch-action: none;
    outline-offset: 3px;
    /* Empty space, past every gamut. */
    background: repeating-linear-gradient(45deg, transparent 0 7px,
      color-mix(in oklab, currentColor 6%, transparent) 7px 8px);
  }
  .plane canvas, .plane svg {
    position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 14px;
  }
  .plane:focus-visible, .hue:focus-visible { outline: 2px solid var(--accent, #5b3fd1); }
  .edge { fill: none; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
  .edge.halo { stroke: rgb(0 0 0 / 0.28); stroke-width: 3.2; }
  .edge.line { stroke: #fff; stroke-width: 1.5; }
  .edge.p3 { stroke-dasharray: 6 4; }
  .edge.rec2020 { stroke-dasharray: 1 4; stroke-linecap: round; }
  .labels { position: absolute; inset: 0; pointer-events: none; }
  .edge-label {
    position: absolute;
    transform: translate(0.4rem, -50%);
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
    text-shadow: 0 0 3px rgb(0 0 0 / 0.75);
    white-space: nowrap;
  }
  .marker {
    position: absolute;
    width: 26px; height: 26px; margin: -13px 0 0 -13px;
    border-radius: 50%;
    background: var(--swatch, transparent);
    border: 3px solid #fff;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45), 0 3px 10px rgb(0 0 0 / 0.35);
    pointer-events: none;
  }
  .hue {
    position: relative;
    height: 26px;
    margin: 1.4rem 0 0 1.6rem;
    border-radius: 13px;
    cursor: pointer;
    touch-action: none;
  }
  .hue-label { margin: 0.35rem 0 0 1.6rem; text-align: center; }
  .hue canvas { display: block; width: 100%; height: 100%; border-radius: 13px; }
  .hue-marker {
    position: absolute; top: -4px; bottom: -4px; width: 8px; margin-left: -4px;
    border-radius: 4px; border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45);
    pointer-events: none;
  }
  .legend {
    display: flex; flex-wrap: wrap; gap: 0.3rem 1.2rem;
    margin: 0.9rem 0 0 1.6rem; padding: 0; list-style: none;
    font-size: 0.85rem; color: var(--muted, #5b5b6b);
  }
  .key {
    display: inline-block; width: 1.6rem; margin-right: 0.4rem; vertical-align: middle;
    border-top: 2px solid currentColor;
  }
  .key.p3 { border-top-style: dashed; }
  .key.rec2020 { border-top-style: dotted; }
  .swatches { display: flex; gap: 1rem; align-items: flex-end; }
  figure { margin: 0; text-align: center; font-size: 0.85rem; color: var(--muted, #5b5b6b); }
  .main { flex: 1; }
  .swatch {
    position: relative;
    width: 7rem; aspect-ratio: 1;
    border-radius: 14px;
    border: 1px solid var(--border, #dedde6);
    background: var(--swatch, transparent);
  }
  .swatch.big { width: 100%; aspect-ratio: 16 / 10; border-radius: 16px; box-shadow: 0 6px 24px rgb(0 0 0 / 0.18); }
  .sample { position: absolute; left: 1rem; bottom: 0.8rem; font-size: 1.4rem; font-weight: 600; }
  .pill {
    display: inline-block; padding: 0.2rem 0.8rem; border-radius: 999px;
    font-size: 0.9rem; font-weight: 600; color: var(--bg, #fff); background: var(--accent, #5b3fd1);
  }
  .pill[data-level="0"] { background: #1f7f47; }
  .pill[data-level="2"], .pill[data-level="3"] { background: #a8431a; }
  .explain { margin: 0.4rem 0 0; color: var(--muted, #5b5b6b); font-size: 0.95rem; }
  .readout { display: flex; align-items: center; gap: 0.6rem; margin-top: 1rem; }
  code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .readout code { font-size: 1.2rem; font-weight: 600; }
  .hex { margin: 0.2rem 0 1rem; color: var(--muted, #5b5b6b); }
  button {
    font: inherit; font-size: 0.8rem; padding: 0.1rem 0.6rem; cursor: pointer;
    color: inherit; background: var(--surface, #fff);
    border: 1px solid var(--border, #dedde6); border-radius: 6px;
  }
  .sliders label {
    display: grid; grid-template-columns: 6rem 1fr; align-items: center;
    margin: 0.35rem 0; font-size: 0.9rem; color: var(--muted, #5b5b6b);
  }
  /* Each slider's track shows what moving it does. */
  input[type="range"] {
    appearance: none; -webkit-appearance: none;
    width: 100%; height: 14px; margin: 0;
    border-radius: 7px; background: var(--track, var(--border, #ddd));
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
    background: #fff; border: 1px solid rgb(0 0 0 / 0.4); box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
  }
  input[type="range"]::-moz-range-thumb {
    width: 16px; height: 16px; border-radius: 50%;
    background: #fff; border: 1px solid rgb(0 0 0 / 0.4); box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
  }
  .type { display: block; margin-top: 1rem; font-weight: 600; }
  input[type="text"] {
    width: 100%; margin-top: 0.25rem; padding: 0.5rem 0.7rem; font: inherit;
    color: inherit; background: var(--surface, #fff);
    border: 1px solid var(--border, #dedde6); border-radius: 8px;
  }
  .gamut { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 1rem; }
  .snap { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .snap[hidden] { display: none; }
  .status { min-height: 1.4em; margin: 0.3rem 0 0; font-size: 0.9rem; color: #c62828; }
</style>
<div class="grid">
  <div>
    <div class="frame">
      <span class="axis axis-y" aria-hidden="true">Lightness ↑</span>
      <div id="plane" part="plane" class="plane" tabindex="0" role="slider"
           aria-label="Lightness and chroma. Up and down change lightness; left and right change chroma.">
        <canvas id="plane-canvas"></canvas>
        <svg id="lines" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div id="labels" class="labels" aria-hidden="true"></div>
        <div id="marker" class="marker" aria-hidden="true"></div>
      </div>
      <span class="axis axis-x" aria-hidden="true">Chroma (colorfulness) →</span>
    </div>
    <div id="hue" class="hue" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="360">
      <canvas id="hue-canvas"></canvas>
      <div id="hue-marker" class="hue-marker" aria-hidden="true"></div>
    </div>
    <div class="axis hue-label" aria-hidden="true">Hue</div>
    <ul class="legend">
      <li><span class="key"></span>sRGB: every screen</li>
      <li><span class="key p3"></span>Display P3: wide-gamut screens</li>
      <li><span class="key rec2020"></span>Rec. 2020: HDR video</li>
    </ul>
  </div>
  <div>
    <div class="swatches">
      <figure class="main">
        <div id="swatch" part="swatch" class="swatch big"><span id="sample" class="sample"></span></div>
        <figcaption id="swatch-caption">On your screen</figcaption>
      </figure>
      <figure id="srgb-figure" hidden>
        <div id="swatch-srgb" class="swatch"></div>
        <figcaption>Closest in sRGB</figcaption>
      </figure>
    </div>
    <div class="gamut">
      <span id="status" part="status" class="pill"></span>
      <div id="snap" part="snap" class="snap">
        <button type="button" id="snap-srgb">Snap into sRGB</button>
        <button type="button" id="snap-p3">Snap into Display P3</button>
      </div>
    </div>
    <p id="explain" class="explain"></p>
    <div class="readout" part="readout">
      <code id="css"></code>
      <button type="button" id="copy">Copy</button>
    </div>
    <p class="hex">Hex, for sRGB: <code id="hex"></code></p>
    <div class="sliders">
      <label>Lightness <input id="slider-l" type="range" min="0" max="1" step="0.001"></label>
      <label>Chroma <input id="slider-c" type="range" min="0" max="0.4" step="0.001"></label>
      <label>Hue <input id="slider-h" type="range" min="0" max="359.9" step="0.1"></label>
    </div>
    <label class="type" for="text">Or type any CSS color</label>
    <input id="text" part="text" type="text" spellcheck="false" autocomplete="off"
           placeholder="rebeccapurple, #36c, hsl(200 80% 45%)…" aria-describedby="text-status">
    <p id="text-status" class="status" role="status"></p>
  </div>
</div>
`;

/**
 * The `<prismora-picker>` element. Set `value` (attribute or property) to any
 * CSS color; read `value` and `color`. Fires `input` while the color changes
 * and `change` when a change is done. Takes --text, --muted, --border,
 * --surface, --bg and --accent from the page.
 */
class PrismoraPicker extends HTMLElement {
  static observedAttributes = ["value"];

  /** @type {Lch} */
  #state = { L: 0.7, C: 0.2, H: 30 };
  /** @type {Edges | null} */
  #edges = null;
  /** The hue the plane was last drawn for. @type {number | null} */
  #drawnHue = null;
  #sharpTimer = 0;
  #frame = 0;
  /** @type {Color | null} */
  #color = null;
  #css = "";
  #wide = wideGamut();
  #screen = this.#wide ? Space.displayP3 : Space.srgb;
  /** @type {PredefinedColorSpace} */
  #colorSpace = this.#wide ? "display-p3" : "srgb";

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = TEMPLATE;
  }

  /**
   * An element in the picker's shadow DOM.
   *
   * @param {string} id
   * @returns {any}
   */
  #el(id) {
    return this.shadowRoot.getElementById(id);
  }

  /**
   * The chosen color, as CSS: `oklch(L% C H)`.
   *
   * @returns {string}
   */
  get value() {
    return this.#css;
  }

  /**
   * Sets the color from any CSS color.
   *
   * @param {string} text
   */
  set value(text) {
    this.#setFromText(text);
  }

  /**
   * The chosen color as a Prismora `Color`, in OkLCh.
   *
   * @returns {Color | null}
   */
  get color() {
    return this.#color;
  }

  /**
   * Follows the `value` attribute.
   *
   * @param {string} name
   * @param {string | null} old
   * @param {string | null} text
   */
  attributeChangedCallback(name, old, text) {
    if (text !== null && text !== this.#css) this.#setFromText(text);
  }

  connectedCallback() {
    if (this.#drawnHue !== null) return;
    this.#wire();
    this.#drawHueStrip();
    if (this.hasAttribute("value")) this.#setFromText(this.getAttribute("value"));
    else this.#set({});
    this.#redrawPlane(true);
    new ResizeObserver(() => {
      this.#drawnHue = null;
      this.#redrawPlane(true);
    }).observe(this.#el("plane"));
  }

  /**
   * The plane: each pixel converted from OkLCh to the screen's space in one
   * bulk Prismora call, on a small grid scaled up smoothly, since the plane
   * is all gradients. Then, at full resolution, the gamut edges cut it
   * sharply: colors the screen can't show are faded, and colors past
   * Rec. 2020 are left out.
   *
   * @param {number} size
   */
  #drawPlane(size) {
    const canvas = this.#el("plane-canvas");
    const turns = this.#state.H / 360;
    const values = new Array(size * size * 3);
    let k = 0;
    for (let y = 0; y < size; y++) {
      const L = 1 - (y + 0.5) / size;
      for (let x = 0; x < size; x++) {
        values[k++] = L;
        values[k++] = ((x + 0.5) / size) * MAX_CHROMA;
        values[k++] = turns;
      }
    }
    const shown = Color.fromList(Space.oklch, values).convert(this.#screen).rows.toList();
    const space = { colorSpace: this.#colorSpace };
    const off = document.createElement("canvas");
    off.width = off.height = size;
    const ctx = /** @type {CanvasRenderingContext2D} */ (off.getContext("2d", space));
    const image = ctx.createImageData(size, size, space);
    // Opaque here, so scaling up doesn't blend in empty pixels.
    for (let p = 0, v = 0; v < shown.length; p += 4, v += 3) {
      for (let c = 0; c < 3; c++) image.data[p + c] = Math.round(clamp(shown[v + c], 0, 1) * 255);
      image.data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const width = Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (!width) return;
    canvas.width = canvas.height = width;
    const out = canvas.getContext("2d", space);
    out.imageSmoothingEnabled = true;
    out.imageSmoothingQuality = "high";
    out.drawImage(off, 0, 0, width, width);

    // The cut, per screen pixel, against Prismora's gamut edges, with a
    // one-pixel ramp for smooth edges.
    const full = out.getImageData(0, 0, width, width, space);
    const screenEdge = this.#wide ? this.#edges.p3 : this.#edges.srgb;
    for (let y = 0, p = 3; y < width; y++) {
      const L = 1 - (y + 0.5) / width;
      const fits = (edgeAt(screenEdge, L) / MAX_CHROMA) * width;
      const exists = (edgeAt(this.#edges.rec2020, L) / MAX_CHROMA) * width;
      for (let x = 0; x < width; x++, p += 4) {
        const solid = clamp(fits - x, 0, 1);
        const there = clamp(exists - x, 0, 1);
        full.data[p] = Math.round(255 * solid + 70 * Math.max(there - solid, 0));
      }
    }
    out.putImageData(full, 0, 0);
  }

  // Gamut edges as vector lines, labeled at staggered lightness.
  #drawEdges() {
    const ns = "http://www.w3.org/2000/svg";
    const lines = this.#el("lines");
    const labels = this.#el("labels");
    lines.replaceChildren();
    labels.replaceChildren();
    for (const { key, label, at } of GAMUTS) {
      const edge = this.#edges[key];
      const points = edge.map((c, i) => `${(c / MAX_CHROMA).toFixed(4)},${(1 - i / EDGE_ROWS).toFixed(4)}`).join(" ");
      for (const part of ["halo", "line"]) {
        const line = document.createElementNS(ns, "polyline");
        line.setAttribute("points", points);
        line.setAttribute("class", `edge ${part} ${key}`);
        lines.append(line);
      }
      const span = document.createElement("span");
      span.className = "edge-label";
      span.textContent = label;
      span.style.left = `${(edgeAt(edge, at) / MAX_CHROMA) * 100}%`;
      span.style.top = `${(1 - at) * 100}%`;
      labels.append(span);
    }
  }

  /**
   * Colors as CSS for the screen, fitted to what it can show.
   *
   * @param {Color} color
   * @returns {string[]}
   */
  #onScreen(color) {
    return color.toGamut(this.#screen).convert(this.#screen).toCss();
  }

  // The hue strip: each hue at a middle lightness, fitted to the screen.
  #drawHueStrip() {
    const canvas = this.#el("hue-canvas");
    const n = 360;
    const values = [];
    for (let h = 0; h < n; h++) values.push(0.72, 0.16, h / n);
    const shown = Color.fromList(Space.oklch, values).toGamut(this.#screen).convert(this.#screen).rows.toList();
    const space = { colorSpace: this.#colorSpace };
    canvas.width = n;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", space);
    const image = ctx.createImageData(n, 1, space);
    for (let h = 0; h < n; h++) {
      for (let c = 0; c < 3; c++) image.data[h * 4 + c] = Math.round(clamp(shown[h * 3 + c], 0, 1) * 255);
      image.data[h * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  /**
   * Redraws the plane, coarse while dragging or sharp at rest, with new gamut edges for a new hue.
   *
   * @param {boolean} sharp
   */
  #redrawPlane(sharp) {
    if (this.#drawnHue !== this.#state.H) {
      this.#edges = gamutEdges(this.#state.H);
      this.#drawEdges();
      this.#drawnHue = this.#state.H;
    }
    this.#drawPlane(sharp ? FULL_SIZE : FAST_SIZE);
  }

  // Slider tracks: what each slider would give, from end to end, in one
  // bulk conversion.
  #drawTracks() {
    const { L, C, H } = this.#state;
    const n = 12;
    const values = [];
    for (let i = 0; i <= n; i++) values.push(i / n, C, H / 360);
    for (let i = 0; i <= n; i++) values.push(L, (i / n) * MAX_CHROMA, H / 360);
    for (let i = 0; i <= 2 * n; i++) values.push(L, C, i / (2 * n));
    const css = this.#onScreen(Color.fromList(Space.oklch, values));
    const gradient = (stops) => `linear-gradient(to right, ${stops.join(", ")})`;
    this.#el("slider-l").style.setProperty("--track", gradient(css.slice(0, n + 1)));
    this.#el("slider-c").style.setProperty("--track", gradient(css.slice(n + 1, 2 * n + 2)));
    this.#el("slider-h").style.setProperty("--track", gradient(css.slice(2 * n + 2)));
  }

  // Everything that follows the chosen color.
  #show() {
    this.#frame = 0;
    const { L, C, H } = this.#state;
    const color = Color.fromList(Space.oklch, [L, C, H / 360]);
    const marker = this.#el("marker");
    marker.style.left = `${(C / MAX_CHROMA) * 100}%`;
    marker.style.top = `${(1 - L) * 100}%`;
    this.#el("hue-marker").style.left = `${(H / 360) * 100}%`;
    this.#el("plane").setAttribute("aria-valuetext", `Lightness ${(L * 100).toFixed(0)}%, chroma ${C.toFixed(3)}`);
    this.#el("hue").setAttribute("aria-valuenow", H.toFixed(0));
    this.#el("slider-l").value = L;
    this.#el("slider-c").value = C;
    this.#el("slider-h").value = H;
    this.#drawTracks();

    const onScreen = this.#onScreen(color)[0];
    const fitted = color.toGamut(Space.srgb);
    const fits = GAMUTS.map(({ space }) => color.inGamut(space)[0]);
    const level = fits.includes(true) ? fits.indexOf(true) : 3;
    marker.style.setProperty("--swatch", onScreen);
    this.#el("swatch").style.setProperty("--swatch", onScreen);
    this.#el("swatch-srgb").style.setProperty("--swatch", fitted.toHex()[0]);
    // On an sRGB screen, the screen's color is already the sRGB one.
    this.#el("srgb-figure").hidden = fits[0] || !this.#wide;
    const screenFits = this.#wide ? fits[1] : fits[0];
    this.#el("swatch-caption").textContent = screenFits ? "On your screen" : "The closest your screen can show";

    this.#el("snap-srgb").hidden = fits[0];
    this.#el("snap-p3").hidden = fits[1] || !this.#wide;
    this.#el("snap").hidden = this.#el("snap-srgb").hidden && this.#el("snap-p3").hidden;

    const status = this.#el("status");
    status.textContent = STATUS[level][0];
    status.dataset.level = level;
    this.#el("explain").textContent = STATUS[level][1];

    // Readable text on the swatch: whichever of white and black contrasts
    // more, with the WCAG ratio.
    const onWhite = fitted.contrast(Color.parse("white"))[0];
    const onBlack = fitted.contrast(Color.parse("black"))[0];
    const sample = this.#el("sample");
    sample.style.color = onWhite >= onBlack ? "#fff" : "#000";
    sample.textContent = `Aa ${Math.max(onWhite, onBlack).toFixed(1)}:1`;

    this.#color = color;
    this.#css = `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
    this.#el("css").textContent = this.#css;
    this.#el("hex").textContent = fitted.toHex()[0];
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  /**
   * Changes redraw once per frame; a new hue redraws the plane coarsely now,
   * and sharply once things settle.
   *
   * @param {Partial<Lch>} changes
   */
  #set(changes) {
    const state = this.#state;
    const hueChanged = changes.H !== undefined && changes.H !== state.H;
    Object.assign(state, changes);
    state.L = clamp(state.L, 0, 1);
    state.C = clamp(state.C, 0, MAX_CHROMA);
    state.H = ((state.H % 360) + 360) % 360;
    if (hueChanged && this.isConnected && this.#drawnHue !== null) {
      this.#redrawPlane(false);
      clearTimeout(this.#sharpTimer);
      this.#sharpTimer = setTimeout(() => this.#redrawPlane(true), 180);
    }
    if (!this.#frame) this.#frame = requestAnimationFrame(() => this.#show());
  }

  /**
   * Sets the color from any CSS color, keeping the hue for grays.
   *
   * @param {string} text
   */
  #setFromText(text) {
    const [L, C, turns] = Color.parse(text.trim()).convert(Space.oklch).rows.toList();
    this.#set({ L, C, H: Number.isFinite(turns) && C > 0.0001 ? turns * 360 : this.#state.H });
  }

  #changed() {
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  #wire() {
    const drag = (element, onPoint) => {
      element.addEventListener("pointerdown", (event) => {
        // Dragging shouldn't select text on the page.
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        element.focus({ preventScroll: true });
        onPoint(event);
      });
      element.addEventListener("pointermove", (event) => {
        if (element.hasPointerCapture(event.pointerId)) onPoint(event);
      });
      element.addEventListener("pointerup", () => this.#changed());
    };
    const plane = this.#el("plane");
    const hue = this.#el("hue");
    drag(plane, (event) => {
      const box = plane.getBoundingClientRect();
      this.#set({
        C: ((event.clientX - box.left) / box.width) * MAX_CHROMA,
        L: 1 - (event.clientY - box.top) / box.height,
      });
    });
    drag(hue, (event) => {
      const box = hue.getBoundingClientRect();
      this.#set({ H: clamp((event.clientX - box.left) / box.width, 0, 0.9999) * 360 });
    });

    plane.addEventListener("keydown", (event) => {
      const big = event.shiftKey ? 5 : 1;
      const { L, C } = this.#state;
      const step = {
        ArrowUp: { L: L + 0.01 * big },
        ArrowDown: { L: L - 0.01 * big },
        ArrowRight: { C: C + 0.004 * big },
        ArrowLeft: { C: C - 0.004 * big },
      }[event.key];
      if (step) {
        event.preventDefault();
        this.#set(step);
      }
    });
    hue.addEventListener("keydown", (event) => {
      const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (delta) {
        event.preventDefault();
        this.#set({ H: this.#state.H + delta * (event.shiftKey ? 10 : 1) });
      }
    });
    for (const [id, key] of [["slider-l", "L"], ["slider-c", "C"], ["slider-h", "H"]]) {
      const slider = this.#el(id);
      slider.addEventListener("input", () => this.#set({ [key]: Number(slider.value) }));
      slider.addEventListener("change", () => this.#changed());
    }

    const text = this.#el("text");
    text.addEventListener("input", () => {
      if (!text.value.trim()) {
        this.#el("text-status").textContent = "";
        return;
      }
      try {
        this.#setFromText(text.value);
        this.#el("text-status").textContent = "";
      } catch {
        this.#el("text-status").textContent = "Not a CSS color this picker can read.";
      }
    });
    text.addEventListener("change", () => this.#changed());

    // Snapping keeps lightness and hue exactly and lowers chroma to the most
    // that fits: Prismora's fitChroma.
    /** @type {[string, Space][]} */
    const snaps = [["snap-srgb", Space.srgb], ["snap-p3", Space.displayP3]];
    for (const [id, space] of snaps) {
      this.#el(id).addEventListener("click", () => {
        const [, C] = this.#color.fitChroma(space).rows.toList();
        this.#set({ C });
        this.#changed();
      });
    }

    const copy = this.#el("copy");
    copy.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(this.#css);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    });
  }
}

customElements.define("prismora-picker", PrismoraPicker);
