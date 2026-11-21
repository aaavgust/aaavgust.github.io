/*
  Токены дизайна (content/theme.json) → CSS-переменные сайта.
  Работает и при сборке (Node), и в редакторе (браузер) — предпросмотр показывает ровно то, что будет на сайте.
*/
import { fontFaces, stack, font, weightFor } from "./fonts.mjs";

export const GEMS = { ruby: "#B11226", amethyst: "#8E3BB5", diamond: "#E9E2D2", sapphire: "#2F5FD0", emerald: "#1F9E6B", topaz: "#D08A1E", aquamarine: "#2EC4B6", tourmaline: "#C2365F" };

/* ---------- цвет ---------- */
export function hexRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a) {
  const c = hexRgb(hex) || [0, 0, 0];
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, +a.toFixed(3)))})`;
}
export function mix(hex, to, k) {
  const a = hexRgb(hex) || [0, 0, 0], b = hexRgb(to) || [0, 0, 0];
  return "#" + a.map((x, i) => Math.round(x + (b[i] - x) * k).toString(16).padStart(2, "0")).join("").toUpperCase();
}
function lum(hex) {
  const c = hexRgb(hex);
  if (!c) return 0;
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
/* контраст WCAG: 4.5 — норма для обычного текста (AA), 3 — для крупного */
export function contrast(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* Пары цветов, которые редактор проверяет на читаемость (предупреждает, но не запрещает). */
export function contrastIssues(theme) {
  const out = [];
  for (const mode of ["dark", "light"]) {
    const p = theme[mode] || {};
    const pairs = [["ink", "ground", "Текст на фоне", 4.5], ["muted", "ground", "Пояснения на фоне", 4.5], ["muted", "surface", "Пояснения на карточках", 4.5],
      ["link", "ground", "Ссылки на фоне", 4.5], ["accentInk", "ground", "Акцентный текст на фоне", 4.5], ["onAccent", "accent", "Текст на кнопке", 4.5], ["gold", "ground", "Надписи над заголовками", 4.5]];
    for (const [f, b, label, need] of pairs) {
      if (!p[f] || !p[b]) continue;
      const r = contrast(p[f], p[b]);
      if (r < need) out.push({ mode, fg: f, bg: b, label, ratio: Math.round(r * 100) / 100, need });
    }
  }
  return out;
}

/* ---------- палитра одной темы ---------- */
function palette(p, mode, bg) {
  const dark = mode === "dark";
  const glow = bg.glow == null ? 1 : bg.glow, vig = bg.vignette == null ? 1 : bg.vignette, haze = bg.haze == null ? 1 : bg.haze;
  return [
    `--ground:${p.ground}`, `--surface:${p.surface}`, `--raised:${p.raised}`, `--hair:${p.hair}`, `--ink:${p.ink}`, `--muted:${p.muted}`,
    `--blood:${p.accent}`, `--blood-deep:${p.accentDeep}`, `--blood-text:${p.accentInk}`, `--link:${p.link || p.accentInk}`,
    `--gold:${p.gold}`, `--gold-line:${rgba(p.gold, dark ? 0.5 : 0.55)}`, `--focus:${p.focus}`,
    `--gem:${p.accent}`, `--gem-deep:${p.accentDeep}`, `--gem-ink:${p.accentInk}`, `--on-gem:${p.onAccent}`,
    `--glow:${rgba(p.glow || p.accent, (dark ? 0.34 : 0.16) * glow)}`,
    `--light:${rgba(p.light, (dark ? 0.075 : 0.9) * glow)}`,
    `--shade:${dark ? rgba("#000000", 0.62 * vig) : rgba("#5C4022", 0.16 * vig)}`,
    `--haze:${rgba(p.haze, (dark ? 0.035 : 0.1) * haze)}`,
    `--bg-from:${p.bgFrom || p.ground}`, `--bg-to:${p.bgTo || p.ground}`,
    `--shadow:${dark ? "0 10px 30px rgba(0,0,0,.55)" : "0 6px 18px rgba(40,28,18,.12)"}`,
    `--sg-d:${dark ? "block" : "none"}`, `--sg-l:${dark ? "none" : "block"}`, `color-scheme:${mode}`
  ].join(";");
}

/* камни программ: ruby — акцент темы; аметист и алмаз — значения бренда; остальные — из цвета камня */
const GEM_FIXED = {
  amethyst: { light: { gem: "#8E3BB5", deep: "#6E2A8E", ink: "#7A2F9E", on: "#F4F1EA", glow: "rgba(142,59,181,.16)" }, dark: { gem: "#8E3BB5", deep: "#6E2A8E", ink: "#C99BE8", on: "#F4F1EA", glow: "rgba(142,59,181,.36)" } },
  diamond: { light: { gem: "#2E2B28", deep: "#16120F", ink: "#4A443C", on: "#F4F1EA", glow: "rgba(120,110,95,.14)" }, dark: { gem: "#E9E2D2", deep: "#CFC6B2", ink: "#E9E2D2", on: "#1B1A19", glow: "rgba(233,226,210,.16)" } }
};
function gemVars(g, mode, theme) {
  const p = theme[mode];
  let v;
  if (g === "ruby") v = { gem: p.accent, deep: p.accentDeep, ink: p.accentInk, on: p.onAccent, glow: rgba(p.glow || p.accent, mode === "dark" ? 0.34 : 0.16) };
  else if (GEM_FIXED[g]) v = GEM_FIXED[g][mode];
  else {
    const c = GEMS[g] || GEMS.ruby;
    v = { gem: c, deep: mix(c, "#000000", 0.25), ink: mode === "dark" ? mix(c, "#FFFFFF", 0.35) : mix(c, "#000000", 0.2), on: contrast(c, "#F4F1EA") >= 4.5 ? "#F4F1EA" : "#1B1A19", glow: rgba(c, mode === "dark" ? 0.34 : 0.16) };
  }
  return `--gem:${v.gem};--gem-deep:${v.deep};--gem-ink:${v.ink};--on-gem:${v.on};--glow:${v.glow}`;
}

/* ---------- всё вместе ---------- */
export function themeCss(theme) {
  const t = theme, ty = t.type || {}, sh = t.shape || {}, la = t.layout || {}, bg = t.background || {};
  const hf = font(t.fonts && t.fonts.heading), bf = font(t.fonts && t.fonts.body), uf = font(t.fonts && t.fonts.ui);
  const hw = weightFor(hf, ty.headingWeight || 600), bw = weightFor(bf, ty.bodyWeight || 400), bwStrong = weightFor(bf, 600);
  const uses = [{ id: hf.id, weight: hw }, { id: bf.id, weight: bw }, { id: bf.id, weight: bwStrong }, { id: uf.id, weight: 400 }, { id: uf.id, weight: 600 }];
  let css = fontFaces(uses);
  if (hf.id === "cormorant-garamond") {
    css += "\n" + ["latin", "cyrillic"].map((s) => `@font-face{font-family:"Cormorant Garamond";font-style:italic;font-weight:500;font-display:swap;src:url(/assets/fonts/cormorant-garamond-${s}-500-italic.woff2) format("woff2");unicode-range:${s === "latin" ? "U+0000-00FF,U+2000-206F" : "U+0400-045F"}}`).join("");
  }
  const root = [
    `--display:${stack(hf.id)}`, `--sans:${stack(bf.id)}`, `--ui:${stack(uf.id)}`,
    `--hw:${hw}`, `--bw:${bw}`, `--bw2:${bwStrong}`, `--ht:${(ty.headingTracking == null ? 0.5 : ty.headingTracking) / 100}em`,
    `--fs:${ty.base || 16}px`, `--lh:${ty.bodyLineHeight || 1.6}`, `--hs0:${ty.headingScale || 1}`, `--hs:var(--hs0)`, `--lt:${(ty.labelTracking == null ? 14 : ty.labelTracking) / 100}em`,
    `--maxw:${la.maxWidth || 1180}px`, `--sp:${la.spacing || 1}`, `--gut:${la.gutter || 16}px`,
    `--cs:${sh.corners === "chamfer" ? (sh.size == null ? 10 : sh.size) : 0}px`, `--rad:${sh.corners === "round" ? (sh.size == null ? 10 : sh.size) : 0}px`
  ].join(";");
  css += `\n:root{${root};${palette(t.light, "light", bg)}}`;
  css += `\n:root[data-theme=dark]{${palette(t.dark, "dark", bg)}}`;
  // без скриптов — по системной теме
  css += `\n@media (prefers-color-scheme:dark){:root:not([data-theme]){${palette(t.dark, "dark", bg)}}}`;
  for (const g of Object.keys(GEMS)) {
    css += `\n[data-gem=${g}]{${gemVars(g, "light", t)}}\n:root[data-theme=dark][data-gem=${g}],[data-theme=dark] [data-gem=${g}]{${gemVars(g, "dark", t)}}`;
  }
  // углы кнопок и карточек: срезанные (восьмиугольник знака), скруглённые или прямые
  if (sh.corners !== "chamfer") {
    css += `\n.btn::before,.chip::before,.oct::before,.btn.ghost::after,.chip::after,.oct::after{clip-path:none;border-radius:var(--rad)}.btn.ghost::after,.chip::after,.oct::after{border-radius:max(0px,calc(var(--rad) - 1px))}.card-art{clip-path:none}`;
  }
  // фон страницы
  if (bg.kind === "gradient") css += `\nbody{background:linear-gradient(${bg.angle == null ? 180 : bg.angle}deg,var(--bg-from),var(--bg-to)) fixed var(--ground)}`;
  if (bg.kind === "image" && bg.imageUrl) css += `\nbody{background:linear-gradient(${rgba("#000000", 0)} ,${rgba("#000000", 0)}),url("${bg.imageUrl}") center/cover fixed var(--ground)}.atmo::after{content:"";position:absolute;inset:0;background:var(--ground);opacity:${bg.overlay == null ? 0.6 : bg.overlay}}`;
  if (bg.motion === false) css += `\n.atmo i{animation:none}`;
  return css;
}

/* какой режим темы ставить, если посетитель сам не выбирал */
export function defaultMode(theme) { return theme && (theme.mode === "dark" || theme.mode === "light") ? theme.mode : "system"; }
