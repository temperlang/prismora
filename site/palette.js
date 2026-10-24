// @ts-check

// <chromarite-palette>: palettes from one color, for any page.
//
//     <chromarite-palette value="oklch(70% 0.2 30)"></chromarite-palette>
//
// Its `value` is the base color, any CSS color, as an attribute or property.
// A harmony adds hues around an OkLCh hue wheel, all at the base's lightness
// and chroma, so they look balanced, unlike on HSL wheels. Each hue gets a
// ramp of shades, each as colorful as the base but no more than sRGB allows,
// placed so 400, 500 and 600 have 3:1, 4.5:1 and 7:1 contrast with white
// text in every hue, and labeled with their contrast. Dragging the base arm changes the base hue and fires `input`; other
// arms make a custom harmony. Its `harmony` is a harmony's name, or a custom
// one's hue offsets, like "0,95,210"; changing it from inside fires
// `change`. Its `shades` are each ramp's hex codes, and a `shades` event
// says when they change. Clicking a shade copies its hex. Children with
// slot="actions" join the copy buttons. It takes
// --text, --muted, --border, --surface, --bg and --accent from the page.
// Parts, for styling or pointing at: harmonies and ramps.

import { Color, Space } from "chromarite";

/**
 * A color in OkLCh: lightness and chroma as Chromarite has them, and hue in
 * degrees.
 * @typedef {{ L: number, C: number, H: number }} Lch
 */

/**
 * Harmonies, as hue offsets in degrees from the base.
 *
 * @type {Record<string, { label: string, offsets: number[] }>}
 */
const HARMONIES = {
  analogous: { label: "Analogous", offsets: [0, -30, 30] },
  complementary: { label: "Complementary", offsets: [0, 180] },
  split: { label: "Split", offsets: [0, 150, 210] },
  triad: { label: "Triad", offsets: [0, 120, 240] },
  tetrad: { label: "Tetrad", offsets: [0, 90, 180, 270] },
};

// Shades, named as design systems often do, from light to dark.
const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const LIGHTEST = 0.97;
const DARKEST = 0.27;
// Shades placed by their contrast with white text, the same for every hue:
// WCAG asks 3:1 for large text, 4.5:1 for body text (AA) and 7:1 for AAA.
// The other shades fall evenly in lightness between these and the ends.
const PINNED = new Map([[400, 3], [500, 4.5], [600, 7]]);
// The first step to carry white text; lighter ones carry black.
const FIRST_WHITE = 500;
const WHITE = Color.parse("white");

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
 * Hue in degrees, wrapped into 0 to 360.
 *
 * @param {number} h
 * @returns {number}
 */
const wrap = (h) => ((h % 360) + 360) % 360;

/**
 * Shades in OkLCh at these lightnesses and hues, each with chroma `C` or as
 * much as sRGB allows: one bulk fitChroma call for them all.
 *
 * @param {number[]} lightness
 * @param {number[]} hues
 * @param {number} C
 * @returns {Color}
 */
function fitted(lightness, hues, C) {
  const wanted = lightness.flatMap((l, i) => [l, C, hues[i]]);
  return Color.fromList(Space.oklch, wanted).fitChroma(Space.srgb);
}

/**
 * For each hue, the lightness of each pinned shade: the lightest whose hex
 * code has at least its contrast with white, all hues at once. Contrast
 * falls as lightness rises, even as the chroma limit moves, so bisection
 * finds it, starting near where a gray would have it. Rounding to hex can
 * lose a little contrast, so then each steps darker until its hex passes.
 *
 * @param {number[]} hues
 * @param {number} C
 * @returns {number[]} for each hue, one lightness per pinned shade
 */
function pinnedLightness(hues, C) {
  const ratios = [...PINNED.values()];
  const at = hues.flatMap((h) => ratios.map(() => h));
  // A hair over, so other contrast checkers, rounding differently, agree.
  const want = at.map((_, i) => ratios[i % ratios.length] * 1.001);
  // A gray's OkLab lightness is the cube root of its luminance, and
  // contrast with white is 1.05 / (luminance + 0.05).
  const gray = want.map((r) => Math.cbrt(1.05 / r - 0.05));
  const lo = gray.map((l) => Math.max(l - 0.15, 0));
  const hi = gray.map((l) => Math.min(l + 0.15, 1));
  for (let round = 0; round < 11; round++) {
    const mid = lo.map((l, i) => (l + hi[i]) / 2);
    const contrast = fitted(mid, at, C).contrast(WHITE);
    mid.forEach((l, i) => {
      if (contrast[i] >= want[i]) lo[i] = l;
      else hi[i] = l;
    });
  }
  for (let round = 0; round < 8; round++) {
    const rgb = fitted(lo, at, C)
      .toHex()
      .flatMap((hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255));
    const contrast = Color.fromList(Space.srgb, rgb).contrast(WHITE);
    const short = contrast.map((c, i) => c < want[i]);
    if (!short.includes(true)) break;
    short.forEach((s, i) => s && (lo[i] -= 0.002));
  }
  return lo;
}

/**
 * One ramp's lightness for every step: the pinned ones, and the rest evenly
 * between them and the ends.
 *
 * @param {number[]} pinned lightness of each pinned step, in step order
 * @returns {number[]}
 */
function spread(pinned) {
  /** @type {[number, number][]} */
  const anchors = [[0, LIGHTEST]];
  [...PINNED.keys()].forEach((step, i) => anchors.push([STEPS.indexOf(step), pinned[i]]));
  anchors.push([STEPS.length - 1, DARKEST]);
  return STEPS.map((_, i) => {
    const b = anchors.findIndex(([j]) => j >= i);
    const [j1, l1] = anchors[b];
    if (j1 === i) return l1;
    const [j0, l0] = anchors[b - 1];
    return l0 + ((l1 - l0) * (i - j0)) / (j1 - j0);
  });
}

// Whether this screen and browser can show Display P3, which is wider than
// sRGB.
const WIDE = matchMedia("(color-gamut: p3)").matches;

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
    .grid { grid-template-columns: minmax(14rem, 0.8fr) minmax(0, 1.4fr); align-items: start; }
  }
  .wheel {
    position: relative;
    aspect-ratio: 1;
    max-width: 22rem;
    width: 100%;
    margin: 0 auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    outline-offset: 4px;
  }
  .wheel:focus-visible { outline: 2px solid var(--accent, #5b3fd1); border-radius: 50%; }
  .wheel canvas, .wheel svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .arm { stroke: #fff; stroke-width: 0.6; opacity: 0.9; }
  .knob { stroke: #fff; stroke-width: 1.2; cursor: grab; filter: drop-shadow(0 0.4px 0.8px rgb(0 0 0 / 0.5)); }
  .center { stroke: var(--border, #dedde6); stroke-width: 0.5; }
  .hint { margin: 0.6rem 0 0; text-align: center; font-size: 0.85rem; color: var(--muted, #5b5b6b); }
  .harmonies { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1rem; padding: 0; list-style: none; }
  button {
    font: inherit; font-size: 0.9rem; cursor: pointer;
    color: inherit; background: var(--surface, #fff);
    border: 1px solid var(--border, #dedde6); border-radius: 999px;
    padding: 0.2rem 0.8rem;
  }
  button[aria-pressed="true"] {
    color: var(--bg, #fff); background: var(--accent, #5b3fd1); border-color: var(--accent, #5b3fd1);
  }
  .ramp { display: grid; grid-template-columns: 3rem repeat(${STEPS.length}, minmax(0, 1fr)); gap: 0.3rem; align-items: stretch; margin-bottom: 0.3rem; }
  .ramp .name { align-self: center; font-size: 0.8rem; color: var(--muted, #5b5b6b); }
  .shade {
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 3.6rem; padding: 0.3rem 0.25rem; border: 0; border-radius: 8px;
    font-size: 0.66rem; line-height: 1.2; text-align: left;
    overflow: hidden; white-space: nowrap;
  }
  /* Too narrow for labels, as on phones: plain swatches, which still copy. */
  .side { container-type: inline-size; }
  @container (width < 34rem) {
    .shade { min-height: 2.4rem; }
    .shade span, .aa-note { display: none; }
  }
  .shade:focus-visible { outline: 2px solid var(--accent, #5b3fd1); outline-offset: 2px; }
  .steps { display: grid; grid-template-columns: 3rem repeat(${STEPS.length}, minmax(0, 1fr)); gap: 0.3rem; font-size: 0.72rem; color: var(--muted, #5b5b6b); }
  .exports { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 1rem; }
  .note { margin: 0.6rem 0 0; font-size: 0.85rem; color: var(--muted, #5b5b6b); }
  .status { font-size: 0.85rem; color: var(--muted, #5b5b6b); }
</style>
<div class="grid">
  <div>
    <div id="wheel" class="wheel" tabindex="0" role="slider" aria-label="Base hue. Left and right turn it."
         aria-valuemin="0" aria-valuemax="360">
      <canvas id="ring"></canvas>
      <svg id="arms" viewBox="0 0 100 100" aria-hidden="true"></svg>
    </div>
    <p class="hint">Drag the big dot to turn the base hue, or the others for your own harmony.</p>
  </div>
  <div class="side">
    <ul id="harmonies" part="harmonies" class="harmonies" aria-label="Harmony"></ul>
    <div class="steps" aria-hidden="true"><span></span>${STEPS.map((s) => `<span>${s}</span>`).join("")}</div>
    <div id="ramps" part="ramps"></div>
    <p class="note">
      Each shade keeps its hue and is as colorful as the base allows, within
      sRGB so every screen shows it. Shades line up by contrast in every hue:
      white text on 500 or darker meets WCAG's 4.5:1 for body text, on 400
      its 3:1 for large text, and on 600 the stricter 7:1. Lighter shades
      take black text.<span class="aa-note"> "Aa" shows each ratio.</span>
    </p>
    <div class="exports">
      <button type="button" id="copy-css">Copy shades as CSS</button>
      <button type="button" id="copy-hex">Copy hex codes</button>
      <slot name="actions"></slot>
      <span id="status" class="status" role="status"></span>
    </div>
  </div>
</div>
`;

/**
 * The `<chromarite-palette>` element. Set `value` (attribute or property) to any
 * CSS color for the base; read `value`. Fires `input` when the base hue is
 * dragged, and `change` when the harmony or an arm changes. `harmony` is a
 * harmony's name or custom hue offsets. `shades` are the ramps' hex codes,
 * and `shades` fires when they change. Takes --text, --muted, --border,
 * --surface, --bg and --accent from the page.
 */
class ChromaritePalette extends HTMLElement {
  static observedAttributes = ["value"];

  /** @type {Lch} */
  #base = { L: 0.7, C: 0.2, H: 30 };
  /** Hue offsets from the base, in degrees; the first is the base itself. */
  #offsets = HARMONIES.analogous.offsets.slice();
  /** The chosen harmony, or "custom" once an arm is dragged. */
  #harmony = "analogous";
  /** Each ramp's hex codes, for copying. @type {string[][]} */
  #hexes = [];
  #frame = 0;
  #statusTimer = 0;

  constructor() {
    super();
    /** @type {ShadowRoot} */ (this.attachShadow({ mode: "open" })).innerHTML = TEMPLATE;
  }

  /**
   * An element in the shadow DOM.
   *
   * @param {string} id
   * @returns {any}
   */
  #el(id) {
    return /** @type {ShadowRoot} */ (this.shadowRoot).getElementById(id);
  }

  /**
   * The base color, as CSS: `oklch(L% C H)`.
   *
   * @returns {string}
   */
  get value() {
    const { L, C, H } = this.#base;
    return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
  }

  /**
   * Sets the base from any CSS color, without firing `input`.
   *
   * @param {string} text
   */
  set value(text) {
    const [L, C, hue] = Color.parse(text.trim()).toSpace(Space.oklch).toList();
    const H = Number.isFinite(hue) && C > 0.0001 ? hue : this.#base.H;
    this.#base = { L, C, H };
    this.#schedule();
  }

  /**
   * Each ramp's hex codes, base hue first, from 100 to 900.
   *
   * @returns {string[][]}
   */
  get shades() {
    return this.#hexes.map((ramp) => ramp.slice());
  }

  /**
   * The harmony: a name like "triad", or a custom harmony's hue offsets in
   * degrees, like "0,95,210".
   *
   * @returns {string}
   */
  get harmony() {
    return this.#harmony === "custom" ? this.#offsets.map((d) => Math.round(d)).join(",") : this.#harmony;
  }

  /**
   * Sets the harmony by name or offsets, without firing `change`. Anything
   * else is ignored.
   *
   * @param {string} text
   */
  set harmony(text) {
    if (text in HARMONIES) {
      this.#harmony = text;
      this.#offsets = HARMONIES[text].offsets.slice();
    } else {
      const offsets = text.split(",").map(Number);
      if (offsets.length < 1 || offsets.length > 6 || offsets.some((d) => !Number.isFinite(d))) return;
      this.#harmony = "custom";
      this.#offsets = offsets.map(wrap);
      this.#offsets[0] = 0;
    }
    this.#schedule();
  }

  /**
   * Follows the `value` attribute.
   *
   * @param {string} name
   * @param {string | null} old
   * @param {string | null} text
   */
  attributeChangedCallback(name, old, text) {
    if (text) this.value = text;
  }

  connectedCallback() {
    if (this.#frame || this.#el("harmonies").children.length) return;
    this.#wire();
    this.#schedule();
    new ResizeObserver(() => this.#schedule()).observe(this.#el("wheel"));
  }

  /** Redraws once per frame. */
  #schedule() {
    if (!this.#frame) {
      this.#frame = requestAnimationFrame(() => {
        this.#frame = 0;
        this.#draw();
      });
    }
  }

  /**
   * Colors as CSS for this screen, fitted to what it can show.
   *
   * @param {Color} color
   * @returns {string[]}
   */
  #onScreen(color) {
    const screen = WIDE ? Space.displayP3 : Space.srgb;
    return color.toGamut(screen).toCss();
  }

  #draw() {
    this.#drawWheel();
    this.#drawRamps();
    this.#el("wheel").setAttribute("aria-valuenow", this.#base.H.toFixed(0));
    for (const button of this.#el("harmonies").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.harmony === this.#harmony));
    }
  }

  // The ring: every hue at the base's lightness and chroma, then the arms,
  // each a hue of the harmony, with the base arm's knob larger.
  #drawWheel() {
    const canvas = this.#el("ring");
    const size = Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (!size) return;
    canvas.width = canvas.height = size;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    const { L, C, H } = this.#base;
    const n = 180;
    const values = [];
    for (let i = 0; i < n; i++) values.push(L, Math.max(C, 0.04), (i / n) * 360);
    const css = this.#onScreen(Color.fromList(Space.oklch, values));
    const c = size / 2;
    const outer = c - 2;
    const inner = outer * 0.7;
    for (let i = 0; i < n; i++) {
      // Hue turns counterclockwise from the right, as angles do.
      const a0 = -((i - 0.6) / n) * 2 * Math.PI;
      const a1 = -((i + 0.6) / n) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(c, c, outer, a0, a1, true);
      ctx.arc(c, c, inner, a1, a0, false);
      ctx.closePath();
      ctx.fillStyle = css[i];
      ctx.fill();
    }

    const svg = this.#el("arms");
    const ns = "http://www.w3.org/2000/svg";
    svg.replaceChildren();
    const center = document.createElementNS(ns, "circle");
    center.setAttribute("cx", "50");
    center.setAttribute("cy", "50");
    center.setAttribute("r", "22");
    center.setAttribute("class", "center");
    center.setAttribute("fill", this.#onScreen(Color.fromList(Space.oklch, [L, C, H]))[0]);
    svg.append(center);
    const hues = this.#offsets.map((d) => wrap(H + d));
    const arms = this.#onScreen(Color.fromList(Space.oklch, hues.flatMap((h) => [L, C, h])));
    hues.forEach((h, k) => {
      const a = (-h * Math.PI) / 180;
      const r = 42.5;
      const x = 50 + r * Math.cos(a);
      const y = 50 + r * Math.sin(a);
      const arm = document.createElementNS(ns, "line");
      for (const [key, v] of [["x1", 50 + 22 * Math.cos(a)], ["y1", 50 + 22 * Math.sin(a)], ["x2", x], ["y2", y]]) {
        arm.setAttribute(String(key), String(v));
      }
      arm.setAttribute("class", "arm");
      const knob = document.createElementNS(ns, "circle");
      knob.setAttribute("cx", String(x));
      knob.setAttribute("cy", String(y));
      knob.setAttribute("r", k === 0 ? "6" : "4.5");
      knob.setAttribute("fill", arms[k]);
      knob.setAttribute("class", "knob");
      svg.append(arm, knob);
    });
  }

  // Ramps: for each hue, shades from light to dark, each with the base's
  // chroma or less, to fit sRGB, and the pinned ones at their contrasts.
  #drawRamps() {
    const { C, H } = this.#base;
    const hues = this.#offsets.map((d) => wrap(H + d));
    const pinned = pinnedLightness(hues, C);
    const lightness = hues.flatMap((_, k) => spread(pinned.slice(k * PINNED.size, (k + 1) * PINNED.size)));
    const shades = fitted(
      lightness,
      hues.flatMap((h) => STEPS.map(() => h)),
      C,
    );
    const hex = shades.toHex();
    const onWhite = shades.contrast(WHITE);
    const onBlack = shades.contrast(Color.parse("black"));

    const before = this.#hexes.join();
    this.#hexes = hues.map((_, k) => hex.slice(k * STEPS.length, (k + 1) * STEPS.length));
    if (this.#hexes.join() !== before) this.dispatchEvent(new Event("shades"));
    const rows = hues.map((h, k) => {
      const row = document.createElement("div");
      row.className = "ramp";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = `${Math.round(h)}°`;
      row.append(name);
      STEPS.forEach((step, i) => {
        const j = k * STEPS.length + i;
        const white = step >= FIRST_WHITE;
        const ratio = white ? onWhite[j] : onBlack[j];
        const shade = document.createElement("button");
        shade.type = "button";
        shade.className = "shade";
        shade.style.background = hex[j];
        shade.style.color = white ? "#fff" : "#000";
        shade.title = `${hex[j]}: ${onWhite[j].toFixed(1)}:1 with white text, ${onBlack[j].toFixed(1)}:1 with black`;
        shade.setAttribute("aria-label", `${Math.round(h)}° ${step}, ${hex[j]}. Copy.`);
        shade.innerHTML = `<span>${hex[j]}</span><span>Aa ${ratio.toFixed(1)}</span>`;
        shade.addEventListener("click", () => this.#copy(hex[j], `Copied ${hex[j]}`));
        row.append(shade);
      });
      return row;
    });
    this.#el("ramps").replaceChildren(...rows);
  }

  /**
   * Copies text, and says so.
   *
   * @param {string} text
   * @param {string} message
   */
  async #copy(text, message) {
    await navigator.clipboard?.writeText(text);
    const status = this.#el("status");
    status.textContent = message;
    clearTimeout(this.#statusTimer);
    this.#statusTimer = setTimeout(() => (status.textContent = ""), 1800);
  }

  #wire() {
    const list = this.#el("harmonies");
    for (const [key, { label }] of Object.entries(HARMONIES)) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.harmony = key;
      button.textContent = label;
      button.addEventListener("click", () => {
        this.#harmony = key;
        this.#offsets = HARMONIES[key].offsets.slice();
        this.#schedule();
        this.#changed();
      });
      item.append(button);
      list.append(item);
    }

    // Dragging a knob: the base turns the base hue; others set their own
    // offset, making a custom harmony.
    const wheel = this.#el("wheel");
    /**
     * The hue, in degrees, at a pointer position on the wheel.
     *
     * @param {PointerEvent} event
     * @returns {number}
     */
    const hueAt = (event) => {
      const box = wheel.getBoundingClientRect();
      const x = event.clientX - box.left - box.width / 2;
      const y = event.clientY - box.top - box.height / 2;
      return wrap((-Math.atan2(y, x) * 180) / Math.PI);
    };
    let dragging = -1;
    wheel.addEventListener("pointerdown", (/** @type {PointerEvent} */ event) => {
      event.preventDefault();
      const hue = hueAt(event);
      const hues = this.#offsets.map((d) => wrap(this.#base.H + d));
      // The nearest arm by hue.
      let best = 0;
      hues.forEach((h, k) => {
        const distance = (a) => Math.min(Math.abs(a - hue), 360 - Math.abs(a - hue));
        if (distance(h) < distance(hues[best])) best = k;
      });
      dragging = best;
      wheel.setPointerCapture(event.pointerId);
      wheel.focus({ preventScroll: true });
      this.#dragTo(dragging, hue);
    });
    wheel.addEventListener("pointermove", (/** @type {PointerEvent} */ event) => {
      if (dragging >= 0 && wheel.hasPointerCapture(event.pointerId)) this.#dragTo(dragging, hueAt(event));
    });
    wheel.addEventListener("pointerup", () => (dragging = -1));
    wheel.addEventListener("keydown", (/** @type {KeyboardEvent} */ event) => {
      /** @type {Record<string, number>} */
      const deltas = { ArrowRight: -1, ArrowDown: -1, ArrowLeft: 1, ArrowUp: 1 };
      const delta = deltas[event.key];
      if (delta) {
        event.preventDefault();
        this.#dragTo(0, this.#base.H + delta * (event.shiftKey ? 10 : 1));
      }
    });

    this.#el("copy-css").addEventListener("click", () => {
      const lines = this.#hexes.flatMap((ramp, k) => ramp.map((hex, i) => `  --palette-${k + 1}-${STEPS[i]}: ${hex};`));
      this.#copy(`:root {\n${lines.join("\n")}\n}\n`, "Copied CSS variables");
    });
    this.#el("copy-hex").addEventListener("click", () => {
      this.#copy(this.#hexes.map((ramp) => ramp.join(" ")).join("\n"), "Copied hex codes");
    });
  }

  #changed() {
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  /**
   * Moves an arm to a hue: the base arm turns the base hue and fires
   * `input`; another arm makes the harmony custom.
   *
   * @param {number} arm
   * @param {number} hue
   */
  #dragTo(arm, hue) {
    if (arm === 0) {
      this.#base = { ...this.#base, H: wrap(hue) };
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    } else {
      this.#offsets[arm] = wrap(hue - this.#base.H);
      this.#harmony = "custom";
      this.#changed();
    }
    this.#schedule();
  }
}

customElements.define("chromarite-palette", ChromaritePalette);
