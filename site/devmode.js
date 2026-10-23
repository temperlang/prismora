// @ts-check

// Dev mode: a switch that shows the Prismora code behind each part of the
// page, in any of its languages. Badges sit over the page, and each opens a
// card with a short snippet. It works from outside the components, finding
// what to point at through their parts, so they stay plain components.
//
// Snippets come from the tours: build.py collects lines marked
// `snippet: <name>` into snippets.json, and CI runs every tour, so each
// snippet is code that runs.

/**
 * A part of the page with code behind it.
 * @typedef {{ id: string, title: string, about: string, target: () => Element | null | undefined }} Spot
 *
 * In `about`, names in backticks are Prismora's, as JavaScript spells them;
 * the card spells them as the chosen language does.
 */

/**
 * A language of the tours: its name, the tour file's extension, and its
 * line comment.
 * @typedef {{ name: string, file: string, comment: string }} Language
 */

/**
 * The part named `name` inside the first `host` element's shadow DOM.
 *
 * @param {string} host
 * @param {string} name
 * @returns {Element | null | undefined}
 */
const part = (host, name) => document.querySelector(host)?.shadowRoot?.querySelector(`[part~="${name}"]`);

/** @type {Spot[]} */
const SPOTS = [
  {
    id: "edges",
    title: "Where each gamut ends",
    about: "The lines on the square are gamut edges: `maxChroma` gives the most chroma a lightness and hue can have in a gamut.",
    target: () => part("prismora-picker", "plane"),
  },
  {
    id: "contrast",
    title: "Readable text",
    about: "`contrast` gives WCAG's contrast ratio between colors. Body text needs 4.5 or more against its background.",
    target: () => part("prismora-picker", "swatch"),
  },
  {
    id: "gamut",
    title: "Which screens can show it",
    about: "`inGamut` says whether colors fit a space's gamut, like sRGB for every screen or Display P3 for newer ones.",
    target: () => part("prismora-picker", "status"),
  },
  {
    id: "snap",
    title: "Snapping into a gamut",
    about: "`toGamut` brings a color into a gamut the way CSS does. `fitChroma` keeps lightness and hue exactly, lowering only chroma.",
    target: () => part("prismora-picker", "snap"),
  },
  {
    id: "format",
    title: "Writing colors out",
    about: "`toCss` writes colors as CSS, each in its own space. `toHex` fits them into sRGB first.",
    target: () => part("prismora-picker", "readout"),
  },
  {
    id: "parse",
    title: "Reading any CSS color",
    about: "`Color.parse` reads any CSS color and keeps the space it was written in.",
    target: () => part("prismora-picker", "text"),
  },
  {
    id: "harmony",
    title: "Turning the hue",
    about: "`rotateHue` turns colors around the OkLCh hue wheel, in turns, so 0.5 is the opposite hue. Harmonies spread hues this way.",
    target: () => part("prismora-palette", "harmonies"),
  },
  {
    id: "shades",
    title: "Lighter and darker",
    about: "`lighten` moves lightness in OkLCh, where equal steps look equal; a negative amount darkens. Each ramp steps lightness the same way.",
    target: () => part("prismora-palette", "ramps"),
  },
  {
    id: "convert",
    title: "Converting between spaces",
    about: "`convert` gives the same colors in any other space. Every row of this table is one call.",
    target: () => document.querySelector("#spaces table"),
  },
];

/**
 * A Prismora name, like `Color.parse` or `toGamut`, as `file`'s language
 * spells it: snake_case in Python and Rust, PascalCase in C#, and `::`
 * after a type in C++ and Rust.
 *
 * @param {string} name
 * @param {string} file
 * @returns {string}
 */
function spell(name, file) {
  const parts = name.split(".").map((part) => {
    if (/^[A-Z]/.test(part)) return part;
    if (file === "py" || file === "rs") return part.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (file === "cs") return part[0].toUpperCase() + part.slice(1);
    return part;
  });
  return parts.join(file === "rs" || file === "cpp" ? "::" : ".");
}

/** @param {string} s */
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

// Phones get the card as a sheet along the bottom instead.
const narrow = matchMedia("(max-width: 640px)");

/**
 * Sets up dev mode.
 *
 * @param {{
 *   toggle: HTMLButtonElement,
 *   languages: Language[],
 *   language: string,
 *   highlight: (code: string, comment: string) => string,
 *   showTour: (file: string) => void,
 * }} options
 * @returns {{ setLanguage: (file: string) => void }}
 */
export function initDevMode({ toggle, languages, language, highlight, showTour }) {
  /** @type {Record<string, Record<string, string>> | null} */
  let snippets = null;
  /** @type {Spot | null} */
  let open = null;
  let frame = 0;

  const layer = document.createElement("div");
  layer.className = "dev-layer";
  layer.hidden = true;
  const badges = new Map(
    SPOTS.map((spot) => {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "dev-badge";
      badge.textContent = "</>";
      badge.setAttribute("aria-label", `Code: ${spot.title}`);
      badge.setAttribute("aria-expanded", "false");
      badge.setAttribute("aria-controls", "dev-card");
      badge.addEventListener("click", () => (open === spot ? close() : show(spot)));
      layer.append(badge);
      return [spot, badge];
    }),
  );

  const card = document.createElement("div");
  card.id = "dev-card";
  card.className = "dev-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-labelledby", "dev-card-title");
  card.tabIndex = -1;
  card.hidden = true;
  card.innerHTML = `
    <div class="dev-card-head">
      <h3 id="dev-card-title"></h3>
      <button type="button" class="dev-close" aria-label="Close">×</button>
    </div>
    <p class="dev-about"></p>
    <div class="dev-languages" role="group" aria-label="Language"></div>
    <pre class="dev-code"><code></code></pre>
    <p class="dev-foot"><span>From the <span class="dev-lang"></span> tour, which runs in CI.</span>
      <button type="button" class="dev-tour">See it in the full tour</button></p>`;
  const $ = (/** @type {string} */ selector) => /** @type {HTMLElement} */ (card.querySelector(selector));
  for (const { name, file } of languages) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = name;
    chip.dataset.file = file;
    chip.addEventListener("click", () => setLanguage(file));
    $(".dev-languages").append(chip);
  }
  $(".dev-close").addEventListener("click", () => close());
  $(".dev-tour").addEventListener("click", () => {
    close(false);
    showTour(language);
  });
  document.body.append(layer, card);

  /** Fills the card with the open spot's snippet in the chosen language. */
  function render() {
    if (!open) return;
    const lang = languages.find((l) => l.file === language) ?? languages[0];
    $("#dev-card-title").textContent = open.title;
    $(".dev-about").innerHTML = escapeHtml(open.about).replace(/`([^`]+)`/g, (_, name) => `<code>${spell(name, lang.file)}</code>`);
    $(".dev-lang").textContent = lang.name;
    for (const chip of $(".dev-languages").children) {
      chip.setAttribute("aria-pressed", String(/** @type {HTMLElement} */ (chip).dataset.file === lang.file));
    }
    const code = snippets?.[open.id]?.[lang.file];
    $(".dev-code code").innerHTML = code
      ? highlight(code, lang.comment)
      : snippets
        ? "This snippet is missing."
        : "Loading…";
  }

  /** @param {Spot} spot */
  async function show(spot) {
    if (open) badges.get(open)?.setAttribute("aria-expanded", "false");
    open = spot;
    badges.get(spot)?.setAttribute("aria-expanded", "true");
    card.hidden = false;
    render();
    place();
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function close(refocus = true) {
    if (!open) return;
    const badge = badges.get(open);
    badge?.setAttribute("aria-expanded", "false");
    open = null;
    card.hidden = true;
    if (refocus) badge?.focus({ preventScroll: true });
  }

  /** @param {string} file */
  function setLanguage(file) {
    if (!languages.some((l) => l.file === file)) return;
    language = file;
    render();
    // The card's height may change with the language.
    place();
  }

  // Badges go at their parts' top right corners, in page coordinates, so
  // they scroll with the page; layout changes move them.
  function place() {
    frame = 0;
    if (layer.hidden) return;
    const width = document.documentElement.clientWidth;
    for (const [spot, badge] of badges) {
      const target = spot.target();
      const rect = target?.getBoundingClientRect();
      const shown = !!rect && rect.width > 0 && rect.height > 0;
      badge.hidden = !shown;
      if (!shown || !rect) continue;
      badge.style.left = `${Math.min(rect.right - 14, width - 40) + scrollX}px`;
      badge.style.top = `${rect.top - 14 + scrollY}px`;
    }
    if (!open) return;
    const badge = badges.get(open);
    if (!badge || badge.hidden) return close(false);
    if (narrow.matches) {
      card.style.left = card.style.top = "";
      return;
    }
    // Below the badge if it fits on screen, else above it.
    const b = badge.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const below = b.bottom + 10 + h <= innerHeight || b.top - 10 - h < 0;
    card.style.left = `${Math.max(16, Math.min(b.right - w + 12, width - w - 16)) + scrollX}px`;
    card.style.top = `${(below ? b.bottom + 10 : b.top - 10 - h) + scrollY}px`;
  }
  const schedule = () => {
    if (!frame && !layer.hidden) frame = requestAnimationFrame(place);
  };

  addEventListener("resize", schedule);
  new ResizeObserver(schedule).observe(document.body);
  // Clicks and input can show, hide or move parts, like the tabs do.
  document.addEventListener("click", schedule, true);
  document.addEventListener("input", schedule, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) close();
  });
  document.addEventListener("pointerdown", (event) => {
    const t = /** @type {Node} */ (event.target);
    if (open && !card.contains(t) && !layer.contains(t)) close(false);
  });

  toggle.addEventListener("click", async () => {
    const on = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(on));
    toggle.querySelector(".dev-label").textContent = on ? "Hide the code" : "Show the code";
    layer.hidden = !on;
    if (!on) return close(false);
    place();
    if (!snippets) {
      try {
        const response = await fetch("snippets.json", { cache: "no-cache" });
        snippets = response.ok ? await response.json() : {};
      } catch {
        snippets = {};
      }
      render();
    }
  });

  return { setLanguage };
}
