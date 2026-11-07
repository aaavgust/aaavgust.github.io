/*
  Шрифты, из которых можно выбирать в редакторе. Все — с кириллицей, свои копии woff2 в /assets/fonts/
  (пакеты Fontsource 5.3.0, лицензия SIL OFL — engine/public/fonts/licenses). Внешних сервисов шрифтов нет.
  «Системный» — шрифт устройства (на Mac — SF Pro): ничего не загружается.
*/
export const FONTS = [
  { id: "system", name: "Системный (SF Pro на Mac)", kind: "sans", weights: [400, 600, 700], stack: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,Roboto,"Helvetica Neue",Arial,sans-serif' },
  { id: "cormorant-garamond", name: "Cormorant Garamond", kind: "serif", weights: [400, 600, 700], fallback: { local: "Georgia", size: 84, ascent: 105, descent: 33 } },
  { id: "eb-garamond", name: "EB Garamond", kind: "serif", weights: [400, 600, 700] },
  { id: "playfair-display", name: "Playfair Display", kind: "serif", weights: [400, 600, 700] },
  { id: "lora", name: "Lora", kind: "serif", weights: [400, 600, 700] },
  { id: "pt-serif", name: "PT Serif", kind: "serif", weights: [400, 700] },
  { id: "spectral", name: "Spectral", kind: "serif", weights: [400, 600, 700] },
  { id: "alegreya", name: "Alegreya", kind: "serif", weights: [400, 600, 700] },
  { id: "literata", name: "Literata", kind: "serif", weights: [400, 600, 700] },
  { id: "prata", name: "Prata", kind: "serif", weights: [400] },
  { id: "inter", name: "Inter", kind: "sans", weights: [400, 600, 700] },
  { id: "manrope", name: "Manrope", kind: "sans", weights: [400, 600, 700] },
  { id: "montserrat", name: "Montserrat", kind: "sans", weights: [400, 600, 700] },
  { id: "raleway", name: "Raleway", kind: "sans", weights: [400, 600, 700] },
  { id: "rubik", name: "Rubik", kind: "sans", weights: [400, 600, 700] },
  { id: "jost", name: "Jost", kind: "sans", weights: [400, 600, 700] },
  { id: "nunito", name: "Nunito", kind: "sans", weights: [400, 600, 700] },
  { id: "pt-sans", name: "PT Sans", kind: "sans", weights: [400, 700] },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", kind: "sans", weights: [400, 600, 700] },
  { id: "unbounded", name: "Unbounded", kind: "display", weights: [400, 600, 700] },
  { id: "oswald", name: "Oswald", kind: "display", weights: [400, 600, 700] }
];

const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const CYR = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";

export function font(id) { return FONTS.find((f) => f.id === id) || FONTS[0]; }

/* ближайший доступный вес */
export function weightFor(f, w) {
  return f.weights.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), f.weights[0]);
}

/* CSS-стек семейства: свой шрифт → запасной с близкими метриками → системный */
export function stack(id) {
  const f = font(id);
  if (f.id === "system") return f.stack;
  const fb = f.fallback ? `"${f.name} Fallback",` : "";
  return `"${f.name}",${fb}${f.kind === "sans" || f.kind === "display" ? FONTS[0].stack : "Georgia,serif"}`;
}

/* @font-face для выбранных шрифтов и весов (только нужные файлы) */
export function fontFaces(uses) {
  const out = [], seen = new Set();
  for (const u of uses) {
    const f = font(u.id);
    if (f.id === "system") continue;
    const w = weightFor(f, u.weight);
    const key = f.id + w;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const [sub, range] of [["latin", LATIN], ["cyrillic", CYR]]) {
      out.push(`@font-face{font-family:"${f.name}";font-style:normal;font-weight:${w};font-display:swap;src:url(/assets/fonts/${f.id}-${sub}-${w}-normal.woff2) format("woff2");unicode-range:${range}}`);
    }
    if (f.fallback && !seen.has(f.id + "fb")) {
      seen.add(f.id + "fb");
      out.push(`@font-face{font-family:"${f.name} Fallback";src:local("${f.fallback.local}");size-adjust:${f.fallback.size}%;ascent-override:${f.fallback.ascent}%;descent-override:${f.fallback.descent}%;line-gap-override:0%}`);
    }
  }
  return out.join("\n");
}

/* файлы для <link rel=preload>: заголовочный шрифт нужного языка */
export function preloadFiles(id, weight, lang) {
  const f = font(id);
  if (f.id === "system") return [];
  const w = weightFor(f, weight);
  return (lang === "en" ? ["latin"] : ["cyrillic", "latin"]).map((s) => `/assets/fonts/${f.id}-${s}-${w}-normal.woff2`);
}
