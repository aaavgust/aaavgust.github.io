/*
  Страницы сайта из блоков. Один и тот же код работает при сборке (Node) и в редакторе (браузер):
  предпросмотр в редакторе — это настоящий сайт из черновика.

  M   — контент: { theme, site, pages: { key: page }, works: [], series: [], programs: { slug: program } }
  env — окружение: { img(ref) → картинка, og(ref) → адрес, rel(slug) → выпуск, css, js, url, edit, year }
        edit: true — разметка для редактора (data-bid/data-f, без скриптов).
*/
import { UI } from "./ui.mjs";
import { preloadFiles } from "./fonts.mjs";
import { defaultMode } from "./theme.mjs";

/* ---------- мелочи ---------- */
export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
export function safeHref(h) {
  h = String(h || "").trim();
  if (!h || /^(javascript|data|vbscript):/i.test(h)) return "#";
  return h;
}
const isExternal = (h) => /^https?:/i.test(String(h || ""));
const ext = (h) => (isExternal(h) ? ' target="_blank" rel="noopener"' : "");
/* имена файлов из «Фото» (UUID, IMG_1234) — не названия */
export function clean(s) {
  s = String(s == null ? "" : s).trim();
  if (/^[0-9A-F]{8}[ _-][0-9A-F]{4}[ _-][0-9A-F]{4}/i.test(s) || /^(IMG|DSC|PXL|Screenshot)[ _-]?\d/i.test(s)) return "";
  return s;
}
/* текст на нужном языке: строка или { ru, en }; пустой английский — русский */
export function tr(v, lang) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (lang === "en" && v.en != null && String(v.en).trim() !== "") return v.en;
  return v.ru == null ? "" : v.ru;
}
function fmtDate(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  if (isNaN(d)) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d).replace(/\s*г\.$/, "");
}
function fmtSize(b, lang) {
  if (!b) return "";
  const mb = b / 1048576, s = mb >= 10 ? Math.round(mb).toString() : mb.toFixed(1);
  return lang === "en" ? s + " MB" : s.replace(".", ",") + " МБ";
}

const IC = {
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>', ext: '<path d="M7 17 17 7M9 7h8v8"/>', down: '<path d="M12 3v12M6.5 10 12 15.5 17.5 10M5 20.5h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>', prev: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>',
  mail: '<path d="M3.5 6.5h17v11h-17z"/><path d="m4 7 8 6.2L20 7"/>', copy: '<path d="M8.5 8.5h11v11h-11z"/><path d="M15.5 8.5v-4h-11v11h4"/>',
  theme: '<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/><path d="M12 3v18h3.7L21 15.7V8.3L15.7 3z" fill="currentColor" stroke="none"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'
};
export function icon(n, cls) {
  return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + IC[n] + "</svg>";
}
/* восьмиконечная звезда для скрытого входа в подвале (простая, не знак) */
const DOT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 0l2.6 7.7L22 4.2l-3.5 7.8L24 12l-5.5.1L22 19.8l-7.4-3.5L12 24l-2.6-7.7L2 19.8l3.5-7.8L0 12l5.5-.1L2 4.2l7.4 3.5z"/></svg>';

/* знак: две версии (тёмная/светлая тема), точные векторы из бренда */
export function sign(gem, size, o = {}) {
  const a = ' alt="" width="' + size + '" height="' + size + '"' + (o.eager ? ' fetchpriority="high"' : "") + ' decoding="async"';
  return '<span class="sign' + (o.cls ? " " + o.cls : "") + '">' +
    '<img class="sg-d" src="/assets/brand/sign-' + gem + '-dark.svg"' + a + '><img class="sg-l" src="/assets/brand/sign-' + gem + '-light.svg"' + a + "></span>";
}

/* <picture>: варианты AVIF/WebP/JPEG (сборка) или одна картинка (редактор); кадр и точка фокуса */
export function picture(im, o = {}) {
  if (!im) return "";
  const style = [];
  if (im.pos && im.pos !== "50% 50%") style.push("object-position:" + im.pos);
  if (im.fit === "fit") style.push("object-fit:contain");
  const attrs = ' alt="' + esc(o.alt || "") + '"' + (im.w && im.h ? ' width="' + im.w + '" height="' + im.h + '"' : "") +
    (o.eager ? (o.high ? ' fetchpriority="high"' : "") : ' loading="lazy"') + ' decoding="async"' + (o.cls ? ' class="' + o.cls + '"' : "") +
    (style.length ? ' style="' + style.join(";") + '"' : "") + (o.f || "");
  if (im.src) return '<img src="' + esc(im.src) + '"' + attrs + ">";
  if (!im.avif || !im.avif.length) return '<img src="' + esc(im.jpg) + '"' + attrs + ">";
  const set = (list) => list.map((x) => x[1] + " " + x[0] + "w").join(", ");
  const sizes = ' sizes="' + esc(o.sizes || "100vw") + '"';
  return '<picture><source type="image/avif" srcset="' + set(im.avif) + '"' + sizes + '><source type="image/webp" srcset="' + set(im.webp) + '"' + sizes + ">" +
    '<img src="' + esc(im.jpg) + '"' + attrs + "></picture>";
}
function vItem(im, alt, title) {
  if (!im) return null;
  if (im.src) return { j: im.src, x: im.w, y: im.h, alt: alt || "", t: title || "" };
  const set = (list) => list.map((x) => x[1] + " " + x[0] + "w").join(", ");
  return { a: set(im.avif), w: set(im.webp), j: im.jpg, x: im.w, y: im.h, alt: alt || "", t: title || "" };
}
const vData = (items) => '<script type="application/json" class="vdata">' + JSON.stringify(items).replace(/</g, "\\u003c") + "</script>";
/* соотношение сторон для рамки: из кадра (если выбран) или по умолчанию раскладки */
function aspectStyle(im) { return im && im.aspect ? ' style="aspect-ratio:' + im.aspect.toFixed(4) + '"' : ""; }

/* ---------- контекст ---------- */
export function pagePath(M, key) {
  const p = M.pages[key];
  return p ? (p.path || "") : "";
}
function ctxFor(M, key, lang, env) {
  const T = Object.assign({}, UI[lang]);
  const over = (M.site.ui && M.site.ui[lang]) || {};
  Object.keys(over).forEach((k) => { if (over[k] != null && String(over[k]).trim() !== "") T[k] = over[k]; });
  const other = lang === "en" ? "ru" : "en";
  const hrefL = (k, l) => "/" + (l === "en" ? "en/" : "") + pagePath(M, k);
  return {
    M, key, lang, other, env, T, page: M.pages[key],
    t: (v) => tr(v, lang),
    href: (k) => (M.pages[k] ? hrefL(k, lang) : safeHref(k)),
    hrefL,
    abs: (p) => env.url + String(p || "").replace(/^\//, ""),
    F: (p) => (env.edit ? ' data-f="' + esc(p) + '"' : "")
  };
}
function visiblePages(M) { return Object.keys(M.pages).filter((k) => !M.pages[k].hidden && (!M.pages[k].program || (M.programs[M.pages[k].program] && !M.programs[M.pages[k].program].hidden))); }
function navItems(c) {
  const vis = new Set(visiblePages(c.M));
  return (c.M.site.nav || []).filter((n) => !n.hidden && vis.has(n.page)).map((n) => ({ key: n.page, label: c.t(n.label) || c.t(c.M.pages[n.page].title) || n.page }));
}
function programs(M) { return Object.keys(M.programs).map((k) => Object.assign({ slug: k }, M.programs[k])).filter((p) => !p.hidden && p.name).sort((a, b) => (a.order || 0) - (b.order || 0)); }
function programPage(M, slug) { return Object.keys(M.pages).find((k) => M.pages[k].program === slug) || slug; }

/* ---------- каркас ---------- */
function layout(c, o) {
  const { M, T, env, lang } = c;
  const gem = o.gem || "ruby";
  const desc = o.description || c.t(M.site.description);
  const canon = c.abs(c.hrefL(c.key, lang));
  const og = o.og || "/assets/og/site-" + lang + ".jpg";
  const nav = navItems(c);
  const donate = safeHref(M.site.donate);
  const mode = defaultMode(M.theme);
  const headJs = '(function(d){var e=d.documentElement,t;e.className+=" js";try{t=localStorage.getItem("av-theme")}catch(x){}if(t!=="dark"&&t!=="light")t=' +
    (mode === "system" ? 'window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"' : JSON.stringify(mode)) + ';e.setAttribute("data-theme",t);' +
    // AVIF/WebP не открылись (например, Safari в режиме блокировки не показывает AVIF) — <picture> заменяется чистой копией <img>
    // с запасным JPEG (если только убрать <source>, WebKit оставляет картинке плотность от AVIF и рисует её втрое меньше);
    // класс nopic — просмотр работ дальше сразу берёт JPEG
    'd.addEventListener("error",function(v){var i=v.target,p=i&&i.parentNode,n;if(!p||i.tagName!=="IMG"||p.tagName!=="PICTURE"||!p.parentNode)return;if(!/ nopic/.test(e.className))e.className+=" nopic";n=i.cloneNode(false);n.removeAttribute("srcset");n.removeAttribute("sizes");p.parentNode.replaceChild(n,p)},true)})(document)';
  const hf = (M.theme.fonts || {}).heading, hw = (M.theme.type || {}).headingWeight || 600;
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    "<title>" + esc(o.title) + "</title>",
    '<meta name="description" content="' + esc(desc) + '">',
    o.noindex ? '<meta name="robots" content="noindex">' : '<link rel="canonical" href="' + esc(canon) + '">',
    o.noindex ? "" : ["ru", "en"].map((l) => '<link rel="alternate" hreflang="' + l + '" href="' + esc(c.abs(c.hrefL(c.key, l))) + '">').join("\n") + '\n<link rel="alternate" hreflang="x-default" href="' + esc(c.abs(c.hrefL(c.key, "ru"))) + '">',
    '<meta name="color-scheme" content="dark light">',
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="' + esc(M.theme.dark.ground) + '">',
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="' + esc(M.theme.light.ground) + '">',
    '<meta property="og:type" content="website">', '<meta property="og:site_name" content="a_a_avgust">',
    '<meta property="og:locale" content="' + (lang === "en" ? "en_US" : "ru_RU") + '">', '<meta property="og:locale:alternate" content="' + (lang === "en" ? "ru_RU" : "en_US") + '">',
    '<meta property="og:title" content="' + esc(o.title) + '">', '<meta property="og:description" content="' + esc(desc) + '">',
    o.noindex ? "" : '<meta property="og:url" content="' + esc(canon) + '">',
    '<meta property="og:image" content="' + esc(isExternal(og) ? og : c.abs(og)) + '">',
    '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="' + esc(o.ogAlt || "a_a_avgust") + '">', '<meta name="twitter:card" content="summary_large_image">',
    '<link rel="icon" href="/assets/brand/favicon-' + gem + '.svg" type="image/svg+xml">',
    '<link rel="icon" href="/assets/brand/favicon-' + gem + '-32.png" sizes="32x32" type="image/png">',
    '<link rel="icon" href="/assets/brand/favicon-' + gem + '-16.png" sizes="16x16" type="image/png">',
    '<link rel="apple-touch-icon" href="/assets/brand/icon-' + gem + '-180.png">',
    preloadFiles(hf, hw, lang).map((f) => '<link rel="preload" href="' + f + '" as="font" type="font/woff2" crossorigin>').join("\n"),
    env.edit ? "" : "<script>" + headJs + "</script>",
    "<style>" + env.css + "</style>",
    env.edit ? "" : '<script src="' + env.js + '" defer></script>',
    !env.edit && o.jsonld ? '<script type="application/ld+json">' + JSON.stringify(o.jsonld).replace(/</g, "\\u003c") + "</script>" : ""
  ].filter(Boolean).join("\n");

  const header = '<header class="top"><div class="wrap top-in">' +
    '<a class="brand" href="' + c.href("home") + '"' + (c.key === "home" ? ' aria-current="page"' : "") + ">" + sign(gem, 30) + '<span class="brand-name" translate="no">a_a_avgust</span></a>' +
    '<nav class="nav" id="nav" aria-label="' + esc(T.nav) + '"><ul>' +
    nav.map((n) => {
      const on = n.key === o.navKey && o.navKey !== c.key;
      return '<li><a href="' + c.href(n.key) + '"' + (n.key === c.key ? ' aria-current="page"' : on ? ' aria-current="true"' : "") + ">" + esc(n.label) + "</a></li>";
    }).join("") + "</ul></nav>" +
    '<div class="tools">' +
    (donate !== "#" ? '<a class="btn ghost sm donate" href="' + esc(donate) + '"' + ext(donate) + ">" + icon("heart") + "<span>" + esc(T.donate) + "</span></a>" : "") +
    '<a class="lang" href="' + c.hrefL(c.key, c.other) + '" hreflang="' + c.other + '" lang="' + c.other + '" title="' + esc(T.langLabel) + '">' + (c.other === "en" ? "EN" : "RU") + "</a>" +
    '<button class="iconbtn theme-btn" type="button" aria-label="' + esc(T.theme) + '" title="' + esc(T.theme) + '">' + icon("theme") + "</button>" +
    '<button class="iconbtn menu-btn" type="button" aria-expanded="false" aria-controls="nav" aria-label="' + esc(T.menu) + '" data-close="' + esc(T.close) + '">' + icon("menu", "i-menu") + icon("close", "i-close") + "</button>" +
    "</div></div></header>";

  const ft = M.site.footer || {};
  const note = c.t(ft.note) || T.footerNote;
  const footer = '<footer class="foot"' + (env.edit ? ' data-bid="@footer"' : "") + '><div class="wrap foot-in">' +
    '<div class="foot-brand">' + (ft.showSign !== false ? sign(gem, 40) : "") + '<p><span translate="no">a_a_avgust</span><br><span class="muted"' + c.F("footer.text") + ">" + esc(c.t(ft.text)) + "</span></p></div>" +
    (ft.showNav !== false ? '<ul class="foot-links">' + nav.map((n) => '<li><a href="' + c.href(n.key) + '">' + esc(n.label) + "</a></li>").join("") + "</ul>" : "<div></div>") +
    '<div class="foot-meta">' + (ft.showEmail !== false ? '<a class="mail" href="mailto:' + esc(M.site.email) + '">' + esc(M.site.email) + "</a>" : "") +
    (donate !== "#" ? '<a href="' + esc(donate) + '"' + ext(donate) + ">" + esc(T.donate) + "</a>" : "") +
    (ft.showLang !== false ? '<a href="' + c.hrefL(c.key, c.other) + '" hreflang="' + c.other + '" lang="' + c.other + '">' + esc(T.langLink) + "</a>" : "") +
    '<span class="muted foot-note">© ' + (env.year || new Date().getFullYear()) + ' <span translate="no">a_a_avgust</span> · ' + esc(note) + "</span></div>" +
    '</div><a class="foot-key" href="/admin/" rel="nofollow" aria-label="' + esc(T.adminEntry) + '">' + DOT + "</a></footer>";

  const viewer = o.viewer && !env.edit ? '<dialog class="viewer" id="viewer" aria-label="' + esc(T.viewer) + '">' +
    '<div class="v-stage"><div class="v-img"></div></div><p class="v-cap"><span class="v-t"></span><span class="v-n" aria-live="polite"></span></p>' +
    '<button class="iconbtn v-x" type="button" aria-label="' + esc(T.close) + '">' + icon("close") + "</button>" +
    '<button class="iconbtn v-prev" type="button" aria-label="' + esc(T.prev) + '">' + icon("prev") + "</button>" +
    '<button class="iconbtn v-next" type="button" aria-label="' + esc(T.next) + '">' + icon("next") + "</button></dialog>" : "";

  return "<!doctype html>\n<html lang=\"" + lang + '" data-gem="' + gem + '"' + (env.edit ? ' data-theme="' + (env.theme || "dark") + '"' : "") + ">\n<head>\n" + head + "\n</head>\n<body class=\"pg-" + esc(c.key) + '">\n' +
    '<a class="skip" href="#main">' + esc(T.skip) + "</a>\n" +
    '<div class="atmo" aria-hidden="true"><i></i></div>\n' +
    header + '\n<main id="main" tabindex="-1">\n' + o.body + "\n</main>\n" + footer + "\n" + viewer + "\n</body>\n</html>\n";
}

/* ---------- обёртка блока: раскладка, фон, цвет и размер текста ---------- */
const PADS = { 0: 0, 0.5: 0.5, 1: 1, 1.5: 1.5, 2: 2 };
export function wrapBlock(c, b, inner) {
  const la = b.layout || {}, st = b.style || {}, bg = st.bg || {};
  const cls = ["blk", "blk-" + b.type, "al-" + (la.align || "left"), "ip-" + (la.imagePos || "right"), "w-" + (la.width || "normal")];
  const css = [];
  if (la.columns) css.push("--cols:" + Math.max(1, Math.min(5, +la.columns || 1)));
  if (la.padding != null && +la.padding !== 1) css.push("--pad:" + (PADS[la.padding] != null ? la.padding : Math.max(0, Math.min(3, +la.padding || 1))));
  if (st.ink) css.push("--ink:" + st.ink + ";--muted:color-mix(in srgb," + st.ink + " 72%,transparent);color:var(--ink)");
  if (st.scale && +st.scale !== 1) css.push("--ts:" + (+st.scale) + ";--hs:calc(var(--hs0)*" + (+st.scale) + ")");
  let bgHtml = "";
  if (bg.kind && bg.kind !== "none") {
    cls.push("has-bg");
    let back = "";
    if (bg.kind === "color" && bg.color) back = bg.color;
    if (bg.kind === "gradient") back = "linear-gradient(" + (bg.angle == null ? 180 : bg.angle) + "deg," + (bg.color || "transparent") + "," + (bg.color2 || "transparent") + ")";
    const im = bg.kind === "image" && bg.image ? c.env.img(bg.image) : null;
    bgHtml = '<div class="blk-bg' + (im ? " ov" : "") + '" aria-hidden="true" style="' + (back ? "--blk-bg:" + back + ";" : "") + (im ? "--ov:" + (bg.overlay == null ? 0.5 : bg.overlay) : "") + '">' +
      (im ? picture(im, { alt: "", sizes: "100vw" }) : "") + "</div>";
  }
  return '<div class="' + cls.join(" ") + '"' + (c.env.edit ? ' data-bid="' + esc(b.id) + '"' : "") + (css.length ? ' style="' + esc(css.join(";")) + '"' : "") + ">" + bgHtml + '<div class="blk-in">' + inner + "</div></div>";
}

/* ---------- работы ---------- */
function visibleWorks(M) { return M.works.filter((w) => !w.hidden && w.image && w.image.src); }
function workView(c, w, i) {
  const s = c.M.series.find((x) => x.id === w.series);
  const title = clean(c.t(w.title));
  const alt = clean(c.t(w.alt)) || title || (c.T.altWork + " №" + (i + 1) + (s ? ", " + c.T.altSeries + " " + c.t(s.title).trim() : ""));
  return { title, alt };
}

/* ---------- блоки ---------- */
const BLOCKS = {};
function pageHead(c, d, extra) {
  return '<header class="wrap phead"><p class="eyebrow"' + c.F("data.eyebrow") + ">" + esc(c.t(d.eyebrow)) + "</p><h1" + c.F("data.title") + ">" + esc(c.t(d.title)) + "</h1>" +
    (c.t(d.lead) ? '<p class="lead"' + c.F("data.lead") + ">" + esc(c.t(d.lead)) + "</p>" : "") + (extra || "") + "</header>";
}
BLOCKS["page-head"] = (c, b) => {
  const d = b.data || {};
  const extra = d.showCount ? '<p class="count">' + esc(c.T.worksCount.replace("{n}", visibleWorks(c.M).length)) + "</p>" : "";
  return pageHead(c, d, extra);
};
BLOCKS.hero = (c, b) => {
  const d = b.data || {};
  const im = d.image ? c.env.img(d.image) : null;
  const art = im ? '<figure class="hero-img frame"' + aspectStyle(im) + c.F("data.image") + ">" + picture(im, { alt: c.t(d.imageAlt), eager: true, high: true, sizes: "(min-width: 900px) 520px, 90vw" }) + "</figure>"
    : d.sign && d.sign !== "none" ? '<div class="pool">' + sign(d.sign, 220, { eager: true, cls: "hero-sign" }) + "</div>" : "";
  return '<section class="hero"><div class="wrap hero-in">' + art +
    (c.t(d.eyebrow) ? '<p class="eyebrow"' + c.F("data.eyebrow") + ">" + esc(c.t(d.eyebrow)) + "</p>" : "") +
    '<h1 class="display" translate="no"' + c.F("data.title") + ">" + esc(c.t(d.title) || "a_a_avgust") + "</h1>" +
    (c.t(d.tagline) ? '<p class="tagline"' + c.F("data.tagline") + ">" + esc(c.t(d.tagline)) + "</p>" : "") + "</div></section>";
};
BLOCKS.cards = (c, b, bi) => {
  const d = b.data || {}, items = d.items || [];
  const home = c.key === "home";
  const progs = programs(c.M);
  const title = c.t(d.title);
  const li = items.map((it, i) => {
    const link = it.link || "";
    const pg = c.M.pages[link];
    const t = c.t(it.title) || (pg ? (navItems(c).find((n) => n.key === link) || {}).label || c.t(pg.title) : "");
    const im = it.art === "image" && it.image ? c.env.img(it.image) : null;
    let art = "";
    if (im) art = '<span class="entry-art' + (im.fit === "fit" ? " fit" : "") + '"' + aspectStyle(im) + c.F("data.items." + i + ".image") + ">" + picture(im, { alt: "", eager: bi === 1 && i === 0, sizes: "(min-width: 1180px) 360px, (min-width: 700px) 31vw, calc(100vw - 32px)", cls: "cover" }) + "</span>";
    if (it.art === "programs") art = '<span class="entry-art"' + c.F("data.items." + i) + '><span class="apps-art">' + progs.slice(0, 3).map((p) => sign(p.gem, 120)).join("") + "</span></span>";
    if (home || it.art !== "none") {
      const href = c.href(link || "home");
      return "<li><a class=\"entry rv\" href=\"" + esc(href) + '"' + ext(href) + ">" + art +
        '<span class="entry-txt"><span class="entry-t"' + c.F("data.items." + i + ".title") + ">" + esc(t) + '</span><span class="entry-l"' + c.F("data.items." + i + ".text") + ">" + esc(c.t(it.text)) + "</span></span>" + icon("arrow", "entry-a") + "</a></li>";
    }
    const href = link ? c.href(link) : "#";
    return '<li class="card oct rv"><div class="card-body"><h3' + c.F("data.items." + i + ".title") + ">" + esc(t) + "</h3><p" + c.F("data.items." + i + ".text") + ">" + esc(c.t(it.text)) + "</p>" +
      (href !== "#" ? '<a class="btn ghost sm" href="' + esc(href) + '"' + ext(href) + ">" + esc(c.t(it.cta) || c.T.more) + icon(isExternal(href) ? "ext" : "arrow") + "</a>" : "") + "</div></li>";
  }).join("");
  const plain = !home && items.every((it) => it.art === "none");
  return '<section class="wrap ' + (plain ? "more" : "entries-wrap") + '"' + (title ? "" : ' aria-label="' + esc(c.T.nav) + '"') + ">" +
    (title ? '<h2 class="h2 rv"' + c.F("data.title") + ">" + esc(title) + "</h2>" : "") + '<ul class="' + (plain ? "cards" : "entries") + '">' + li + "</ul></section>";
};
BLOCKS.gallery = (c, b) => {
  const d = b.data || {}, T = c.T, M = c.M;
  const works = visibleWorks(M);
  const series = M.series.filter((s) => works.some((w) => w.series === s.id));
  const items = [];
  const grid = works.map((w, i) => {
    const v = workView(c, w, i), im = c.env.img(w.image);
    items.push(vItem(im, v.alt, v.title));
    return '<li class="g-item" data-s="' + esc(w.series || "") + '"' + (c.env.edit ? ' data-work="' + esc(w.id) + '"' : "") + '><button class="g-btn" type="button" data-v="' + i + '" aria-label="' + esc(T.open + ": " + v.alt) + '">' +
      picture(im, { alt: v.alt, eager: i < 4, high: i < 2, sizes: "(min-width: 1180px) 270px, (min-width: 900px) 23vw, (min-width: 600px) 31vw, 46vw" }) + "</button></li>";
  }).join("");
  const filters = d.showFilters !== false && series.length ? '<div class="filters" role="group" aria-label="' + esc(T.filter) + '">' +
    '<button class="chip" type="button" data-f="" aria-pressed="true">' + esc(T.all) + "</button>" +
    series.map((s) => '<button class="chip" type="button" data-f="' + esc(s.id) + '" aria-pressed="false">' + esc(c.t(s.title).trim()) + "</button>").join("") + "</div>" +
    series.filter((s) => c.t(s.text).trim()).map((s) => '<p class="s-note" data-sn="' + esc(s.id) + '" hidden>' + esc(c.t(s.text)) + "</p>").join("") : "";
  const cols = Math.max(2, Math.min(6, +d.columns || 4));
  return '<section class="wrap" data-viewer>' + filters + '<ul class="gallery" style="--gcols:' + cols + '">' + grid + "</ul>" + (c.env.edit ? "" : vData(items)) + "</section>";
};
BLOCKS.music = (c, b) => {
  const d = b.data || {}, T = c.T;
  const im = d.image ? c.env.img(d.image) : null;
  const rel = (d.releases || []).filter((r) => String(r.title || "").trim());
  return '<section class="wrap music split two">' +
    '<div class="music-txt rv">' + (c.t(d.text) ? '<p class="lead"' + c.F("data.text") + ">" + esc(c.t(d.text)) + "</p>" : "") +
    ((d.links || []).length ? '<h2 class="label">' + esc(T.musicListen) + '</h2><ul class="links"' + c.F("data.links") + ">" + d.links.filter((l) => l.label && l.href).map((l) => {
      const u = safeHref(l.href);
      return '<li><a class="btn ghost" href="' + esc(u) + '"' + ext(u) + ">" + esc(l.label) + icon("ext") + "</a></li>";
    }).join("") + "</ul>" : "") +
    (rel.length ? '<h2 class="label">' + esc(T.musicReleases) + '</h2><ol class="releases"' + c.F("data.releases") + ">" + rel.map((r) => '<li><span class="r-t">' + esc(String(r.title).trim()) + "</span>" +
      (c.t(r.text).trim() ? '<span class="r-s">' + esc(c.t(r.text).trim()) + "</span>" : "") + "</li>").join("") + "</ol>" : "") + "</div>" +
    (im ? '<figure class="media music-art frame rv' + (im.fit === "fit" ? " fit" : "") + '"' + (im.aspect ? aspectStyle(im) : "") + c.F("data.image") + ">" + picture(im, { alt: c.t(d.imageAlt), sizes: "(min-width: 900px) 420px, 100vw", cls: "cover" }) + "</figure>" : "") +
    "</section>";
};
BLOCKS.apps = (c, b) => {
  const T = c.T;
  return '<section class="wrap"><ul class="apps">' + programs(c.M).map((p) => {
    const R = c.env.rel(p.slug);
    return '<li class="app oct rv" data-gem="' + esc(p.gem) + '"><div class="app-sign pool">' + sign(p.gem, 132) + "</div>" +
      '<div class="app-txt"><h2 class="app-name" translate="no">' + nameHtml(p) + '</h2><p class="app-tag">' + esc(c.t(p.tagline)) + "</p><p>" + esc(c.t(p.lead)) + "</p>" +
      '<p class="meta" data-release-meta>' + esc(relMeta(c, R)) + "</p>" +
      '<div class="actions">' + downloadBtn(c, R) +
      '<a class="btn ghost" href="' + c.href(programPage(c.M, p.slug)) + '">' + esc(T.more) + '<span class="vh"> — ' + esc(p.name) + "</span>" + icon("arrow") + "</a></div></div></li>";
  }).join("") + "</ul></section>";
};
BLOCKS.about = (c, b) => {
  const d = b.data || {}, T = c.T;
  const im = d.image ? c.env.img(d.image) : null;
  const media = im ? '<figure class="media about-img frame' + (im.fit === "fit" ? " fit" : "") + '"' + aspectStyle(im) + c.F("data.image") + ">" + picture(im, { alt: c.t(d.imageAlt), sizes: "(min-width: 900px) 420px, 100vw", cls: "cover" }) + "</figure>"
    : '<div class="media about-sign pool rv"' + c.F("data.sign") + ">" + sign(d.sign || "ruby", 260) + "</div>";
  return '<section class="wrap about split two"><div class="about-txt rv"><p class="display-sm" translate="no"' + c.F("data.name") + ">" + esc(c.t(d.name) || "a_a_avgust") + "</p>" +
    (c.t(d.role) ? '<p class="role"' + c.F("data.role") + ">" + esc(c.t(d.role)) + "</p>" : "") +
    (d.paragraphs || []).map((p, i) => "<p" + c.F("data.paragraphs." + i) + ">" + esc(c.t(p)) + "</p>").join("") +
    ((d.tools || []).length ? '<h2 class="label">' + esc(T.tools) + '</h2><p class="chips"' + c.F("data.tools") + ">" + d.tools.map((t) => '<span class="chip static">' + esc(t) + "</span>").join("") + "</p>" : "") +
    "</div>" + media + "</section>";
};
BLOCKS.contact = (c, b) => {
  const d = b.data || {}, T = c.T, mail = c.M.site.email, donate = safeHref(c.M.site.donate);
  return '<section class="wrap contact rv"><div class="panel oct mailbox"><a class="mail-big" href="mailto:' + esc(mail) + '">' + icon("mail") + "<span>" + esc(mail) + "</span></a>" +
    (d.showCopy !== false ? '<button class="btn ghost sm copy" type="button" data-copy="' + esc(mail) + '" data-done="' + esc(T.copied) + '">' + icon("copy") + "<span>" + esc(T.copy) + "</span></button>" : "") + "</div>" +
    (d.showDonate !== false && donate !== "#" ? '<div class="panel oct donatebox"><p>' + esc(T.donateLead) + '</p><a class="btn" href="' + esc(donate) + '"' + ext(donate) + ">" + icon("heart") + esc(T.donate) + "</a></div>" : "") +
    "</section>";
};
BLOCKS.text = (c, b) => {
  const d = b.data || {};
  const im = d.image ? c.env.img(d.image) : null;
  const body = '<div class="text-body">' + (c.t(d.eyebrow) ? '<p class="eyebrow"' + c.F("data.eyebrow") + ">" + esc(c.t(d.eyebrow)) + "</p>" : "") +
    (c.t(d.title) ? '<h2 class="h2"' + c.F("data.title") + ">" + esc(c.t(d.title)) + "</h2>" : "") +
    '<div class="text-cols">' + (d.paragraphs || []).map((p, i) => "<p" + c.F("data.paragraphs." + i) + ">" + esc(c.t(p)) + "</p>").join("") + "</div></div>";
  return '<section class="wrap text-blk' + (im ? " split two" : "") + ' rv">' + body +
    (im ? '<figure class="media frame' + (im.fit === "fit" ? " fit" : "") + '"' + aspectStyle(im) + c.F("data.image") + ">" + picture(im, { alt: c.t(d.imageAlt), sizes: "(min-width: 900px) 460px, 100vw", cls: "cover" }) + "</figure>" : "") + "</section>";
};
BLOCKS.image = (c, b) => {
  const d = b.data || {};
  const im = d.image ? c.env.img(d.image) : null;
  return '<section class="wrap img-blk rv"><figure' + c.F("data.image") + ">" + (im ? '<span class="img-frame' + (im.fit === "fit" ? " fit" : "") + '"' + aspectStyle(im) + ">" + picture(im, { alt: c.t(d.alt), sizes: "(min-width: 1180px) 1100px, 100vw", cls: im.aspect ? "cover" : "" }) + "</span>" : "") +
    (c.t(d.caption) ? "<figcaption" + c.F("data.caption") + ">" + esc(c.t(d.caption)) + "</figcaption>" : "") + "</figure></section>";
};
BLOCKS.divider = (c, b) => '<div class="wrap"><div class="divider' + ((b.data || {}).style === "line" ? " line" : "") + '" role="presentation"><i></i></div></div>';

/* ---------- программы ---------- */
function relMeta(c, R) {
  const T = c.T, out = [];
  if (!R || R.state === "missing") return T.soonNote;
  if (R.version) out.push(T.version + " " + R.version + (R.date ? " " + T.released + " " + fmtDate(R.date, c.lang) : ""));
  if (R.size) out.push(fmtSize(R.size, c.lang));
  if (!out.length) out.push(T.onGitHub);
  return out.join(" · ");
}
/* «Скачать»: прямой .dmg, страница выпусков или «Скоро на GitHub» (без ссылки — битой ссылки не бывает) */
function downloadBtn(c, R, big) {
  const T = c.T, cls = "btn" + (big ? " big" : "");
  R = R || { state: "missing", repo: "" };
  const data = ' data-release="' + esc(R.repo) + '" data-tag="' + esc(R.tag || "") + '" data-label="' + esc(T.download) + '"';
  if (R.state === "missing") return '<span class="' + cls + ' is-off"' + data + ">" + icon("down") + "<span>" + esc(T.soon) + "</span></span>";
  return '<a class="' + cls + '" href="' + esc(R.href) + '"' + data + ">" + icon("down") + "<span>" + esc(T.download) + "</span></a>";
}
function nameHtml(p) { return String(p.name || "").trim().split(/\s+/).map((w) => "<span>" + esc(w) + "</span>").join(" "); }
const MOCK = {
  ru: { label: "Окно Avgust Arkstone: чат отвечает по базе знаний и показывает источники", tabs: ["Чат", "Код", "Художник"], net: "Интернет", newChat: "+ Новый чат", recent: "Недавние",
    recents: ["Первая помощь в походе", "Скрипт для фото", "Нарисуй горы в тумане"], q: "Что делать при обморожении пальцев?", kb: "База знаний: найдено фрагментов — 3",
    a1: "Уведи человека в тепло и сними мокрую одежду. Согревай пальцы постепенно — тёплой водой около 37–39 °C или теплом своего тела", a2: "Не растирай кожу снегом и не грей у огня — это повреждает ткани",
    a3: ". Если появились пузыри или кожа не розовеет — нужен врач", src: ["Отморожение.txt", "Первая помощь.txt", "Выживание.txt"], reply: "Ответить…", modes: ["Размышления", "Поиск", "База знаний"] },
  en: { label: "The Avgust Arkstone window: the chat answers from the knowledge base and shows its sources", tabs: ["Chat", "Code", "Artist"], net: "Internet", newChat: "+ New chat", recent: "Recent",
    recents: ["First aid on a hike", "A script for photos", "Draw mountains in fog"], q: "What should I do about frostbitten fingers?", kb: "Knowledge base: 3 passages found",
    a1: "Get the person somewhere warm and remove wet clothing. Warm the fingers gradually — with water at about 37–39 °C or with your own body heat", a2: "Do not rub the skin with snow or warm it by a fire — that damages tissue",
    a3: ". If blisters appear or the skin does not turn pink, see a doctor", src: ["Frostbite.txt", "First aid.txt", "Survival.txt"], reply: "Reply…", modes: ["Thinking", "Search", "Knowledge base"] }
};
function mockHtml(M) {
  const tabs = (on) => M.tabs.map((t, i) => "<span" + (i === on ? ' class="on"' : "") + ">" + esc(t) + "</span>").join("");
  return '<div class="mock rv" role="img" aria-label="' + esc(M.label) + '"><div class="mock-bar"><b></b><b></b><b></b><div class="mock-tabs">' + tabs(0) + '</div><span class="mock-pill"><i></i>' + esc(M.net) + "</span></div>" +
    '<div class="mock-body"><div class="mock-side"><span class="new">' + esc(M.newChat) + "</span>" + tabs(0) + "<small>" + esc(M.recent) + "</small>" + M.recents.map((t) => "<span>" + esc(t) + "</span>").join("") + "</div>" +
    '<div class="mock-main"><div class="m-user">' + esc(M.q) + '</div><div class="m-step">' + esc(M.kb) + "</div>" +
    '<div class="m-ai"><p>' + esc(M.a1) + "<sup>[1]</sup>.</p><p>" + esc(M.a2) + "<sup>[2]</sup>" + esc(M.a3) + '<span class="caret"></span></p></div>' +
    '<div class="m-src">' + M.src.map((s, i) => "<span><b>" + (i + 1) + "</b>" + esc(s) + "</span>").join("") + "</div>" +
    '<div class="m-comp"><p>' + esc(M.reply) + "</p><div>" + M.modes.map((t, i) => "<span" + (i === 2 ? ' class="on"' : "") + ">" + esc(t) + "</span>").join("") + "</div></div></div></div></div>";
}
function progImg(c, x) { return c.env.img((c.lang === "en" && x.imageEn && x.imageEn.src) ? x.imageEn : x.image); }
function secHead(c, id, label, title, lead) {
  const t = c.t(title).trim();
  return '<section class="wrap sect" id="' + id + '">' + (t ? '<p class="eyebrow rv">' + esc(label) + '</p><h2 class="h2 rv">' + esc(t) + "</h2>" : '<h2 class="h2 rv">' + esc(label) + "</h2>") +
    (c.t(lead).trim() ? '<p class="lead rv">' + esc(c.t(lead)) + "</p>" : "");
}
const has = (p, k) => (p[k] || []).length > 0;
const P = {};
P.hero = (c, p, R) => {
  const T = c.T, repoUrl = p.repo && R.state !== "missing" ? "https://github.com/" + p.repo : "";
  const page = c.page;
  const subs = [["shots", T.screenshots, has(p, "shots")], ["features", T.secFeatures, has(p, "features")], ["gallery", T.secGallery, has(p, "gallery")], ["panels", T.secPanels, has(p, "panels")],
    ["install", T.install, has(p, "steps")], ["faq", T.secFaq, has(p, "faq")]].filter((x) => x[2] && page.blocks.some((b) => b.type === "program-" + x[0] && !b.hidden));
  return '<section class="hero app-hero"><div class="wrap hero-in"><div class="pool">' + sign(p.gem || "ruby", 168, { eager: true, cls: "hero-sign" }) + "</div>" +
    '<p class="eyebrow"' + c.F("program.tagline") + ">" + esc(c.t(p.tagline)) + "</p>" +
    '<h1 class="display" translate="no">' + nameHtml(p) + "</h1>" +
    (c.t(p.title).trim() ? '<p class="tagline"' + c.F("program.title") + "><em>" + esc(c.t(p.title)) + "</em></p>" : "") +
    '<p class="lead"' + c.F("program.lead") + ">" + esc(c.t(p.lead)) + "</p>" +
    '<div class="dl">' + downloadBtn(c, R, true) + '<p class="meta" data-release-meta>' + esc(relMeta(c, R)) + "</p>" +
    (repoUrl ? '<p class="meta"><a href="' + repoUrl + '/releases" target="_blank" rel="noopener">' + esc(T.allReleases) + "</a> · " + esc(T.free) + "</p>" : "") + "</div>" +
    (subs.length >= 3 ? '<nav class="subnav" aria-label="' + esc(p.name) + '"><ul>' + subs.map((s) => '<li><a class="chip" href="#' + s[0] + '">' + esc(s[1]) + "</a></li>").join("") + "</ul></nav>" : "") +
    "</div></section>";
};
P.mock = (c, p) => (p.showMock ? '<section class="wrap sect">' + mockHtml(MOCK[c.lang]) + "</section>" : "");
P.facts = (c, p) => (has(p, "facts") ? '<section class="wrap sect"><ul class="facts">' + p.facts.map((f) => '<li class="rv"><b>' + esc(c.t(f.title)) + "</b><span>" + esc(c.t(f.text)) + "</span></li>").join("") + "</ul></section>" : "");
P.shots = (c, p) => {
  if (!has(p, "shots")) return "";
  const T = c.T, items = [], idx = {};
  p.shots.forEach((s, i) => { const im = progImg(c, s); if (im) { idx[i] = items.length; items.push(vItem(im, c.t(s.alt), c.t(s.alt))); } });
  const btn = (s, i, o) => {
    const im = progImg(c, s);
    if (!im) return "";
    return '<button class="shot-btn' + (o.cls ? " " + o.cls : "") + '" type="button" data-v="' + idx[i] + '" aria-label="' + esc(T.open + ": " + c.t(s.alt)) + '"' + c.F("program.shots." + i + ".image") + ">" +
      picture(im, { alt: c.t(s.alt), sizes: o.sizes, eager: o.eager }) + "</button>";
  };
  const heroShots = p.shots.map((s, i) => (s.hero ? btn(s, i, { cls: s.theme === "dark" ? "sg-d" : s.theme === "light" ? "sg-l" : "", sizes: "(min-width: 1180px) 1100px, 100vw", eager: true }) : "")).join("");
  const rest = p.shots.map((s, i) => (s.hero ? "" : '<li class="rv">' + btn(s, i, { sizes: "(min-width: 1180px) 540px, (min-width: 700px) 46vw, 100vw" }) + '<p class="cap">' + esc(c.t(s.alt)) + "</p></li>")).join("");
  return '<div data-viewer id="shots">' + (heroShots ? '<section class="wrap shots-hero rv"><div class="frame">' + heroShots + "</div></section>" : "") +
    (rest ? '<section class="wrap sect"><h2 class="h2 rv">' + esc(c.t(p.shotsTitle) || T.screenshots) + '</h2><ul class="shots">' + rest + "</ul></section>" : "") + (c.env.edit ? "" : vData(items)) + "</div>";
};
P.features = (c, p) => {
  if (!has(p, "features")) return "";
  const big = p.features.some((f) => (f.bullets || []).length);
  return secHead(c, "features", c.T.secFeatures, p.featuresTitle, p.featuresLead) + '<ul class="feats' + (big ? " big" : "") + '">' +
    p.features.map((f) => {
      const bl = (f.bullets || []).map((x) => c.t(x)).filter(Boolean);
      return '<li class="rv"><h3>' + esc(c.t(f.title)) + "</h3><p>" + esc(c.t(f.text)) + "</p>" + (bl.length ? '<ul class="ticks">' + bl.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") + "</li>";
    }).join("") + "</ul>" +
    ((p.makers || []).length ? '<p class="makers rv"><span class="label">' + esc(c.T.makers) + "</span>" + p.makers.map((m) => '<span class="chip static">' + esc(m) + "</span>").join("") + "</p>" : "") + "</section>";
};
P.gallery = (c, p) => {
  if (!has(p, "gallery")) return "";
  const items = [];
  const figs = p.gallery.map((x, i) => {
    const im = progImg(c, x);
    if (!im) return "";
    items.push(vItem(im, c.t(x.caption), c.t(x.caption)));
    return '<figure class="rv"><button class="shot-btn" type="button" data-v="' + (items.length - 1) + '" aria-label="' + esc(c.T.open + ": " + c.t(x.caption)) + '"' + c.F("program.gallery." + i + ".image") + ">" +
      picture(im, { alt: c.t(x.caption), sizes: "(min-width: 960px) 380px, (min-width: 600px) 46vw, 100vw" }) + "</button><figcaption>" + esc(c.t(x.caption)) + "</figcaption></figure>";
  }).join("");
  return secHead(c, "gallery", c.T.secGallery, p.galleryTitle, p.galleryLead).replace('id="gallery">', 'id="gallery" data-viewer>') + '<div class="art-grid">' + figs + "</div>" + (c.env.edit ? "" : vData(items)) +
    (has(p, "options") ? '<ul class="facts three">' + p.options.map((f) => '<li class="rv"><b>' + esc(c.t(f.title)) + "</b><span>" + esc(c.t(f.text)) + "</span></li>").join("") + "</ul>" : "") + "</section>";
};
P.panels = (c, p) => (has(p, "panels") ? secHead(c, "panels", c.T.secPanels, p.panelsTitle) + '<div class="two">' + p.panels.map((x) => {
  const im = x.image && x.image.src ? progImg(c, x) : null;
  return '<div class="panel oct rv"><h3 class="h3">' + esc(c.t(x.title)) + "</h3><p>" + esc(c.t(x.text)) + "</p>" + (im ? picture(im, { alt: c.t(x.imageAlt), sizes: "(min-width: 900px) 520px, 100vw", cls: "guard" }) : "") + "</div>";
}).join("") + "</div></section>" : "");
P.install = (c, p) => {
  if (!has(p, "steps") && !has(p, "requirements")) return "";
  const titled = (p.requirements || []).some((r) => c.t(r.title).trim());
  const req = !has(p, "requirements") ? "" : titled
    ? '<ul class="facts four">' + p.requirements.map((f) => '<li class="rv"><span class="label">' + esc(c.t(f.title)) + "</span><b>" + esc(c.t(f.text)) + "</b></li>").join("") + "</ul>"
    : '<div class="panel oct rv req"><h3 class="h3">' + esc(c.T.requirements) + '</h3><ul class="ticks">' + p.requirements.map((r) => "<li>" + esc(c.t(r.text)) + "</li>").join("") + "</ul></div>";
  return secHead(c, "install", c.T.install, p.stepsTitle) + '<ol class="steps">' + (p.steps || []).map((s) => {
    const im = s.image && s.image.src ? progImg(c, s) : null;
    return '<li class="rv' + (s.key ? " key" : "") + '">' + (c.t(s.title).trim() ? "<h3>" + esc(c.t(s.title)) + "</h3>" : "") + "<p>" + esc(c.t(s.text)) + "</p>" +
      (im ? '<figure class="inst">' + picture(im, { alt: c.t(s.imageAlt), sizes: "(min-width: 900px) 640px, 100vw" }) + "</figure>" : "") + "</li>";
  }).join("") + "</ol>" + (c.t(p.note).trim() ? '<p class="note rv">' + esc(c.t(p.note)) + "</p>" : "") + req + "</section>";
};
P.docs = (c, p, R) => {
  const repoUrl = p.repo && R.state !== "missing" ? "https://github.com/" + p.repo : "";
  if (!c.t(p.license).trim() && !has(p, "docs")) return "";
  return '<section class="wrap sect"><div class="panel oct rv docs"><h2 class="h3">' + esc(c.T.links) + "</h2>" + (c.t(p.license).trim() ? "<p>" + esc(c.t(p.license)) + "</p>" : "") + '<ul class="doclinks">' +
    (repoUrl ? '<li><a href="' + repoUrl + '" target="_blank" rel="noopener">' + esc(c.T.repo) + icon("ext") + "</a></li>" : "") +
    (repoUrl ? (p.docs || []).map((d) => '<li><a href="' + esc(repoUrl + "/" + String(d.path || "").replace(/^\/+/, "")) + '" target="_blank" rel="noopener">' + esc(c.t(d.label)) + icon("ext") + "</a></li>").join("") : "") +
    '</ul><p class="muted">' + esc(c.T.feedback) + ': <a href="mailto:' + esc(c.M.site.email) + '">' + esc(c.M.site.email) + "</a></p></div></section>";
};
P.download = (c, p, R) => {
  const lead = [c.t(p.notes), c.t(p.updatesText)].filter((t) => t.trim()).join(" ");
  return '<section class="wrap sect end rv" id="download"><div class="pool small">' + sign(p.gem || "ruby", 96) + '</div><h2 class="h2">' + esc(c.t(p.downloadTitle) || c.T.download + " — " + p.name) + "</h2>" +
    (lead ? '<p class="lead">' + esc(lead) + "</p>" : "") + downloadBtn(c, R, true) + '<p class="meta" data-release-meta>' + esc(relMeta(c, R)) + "</p></section>";
};
P.faq = (c, p) => (has(p, "faq") ? secHead(c, "faq", c.T.secFaq, p.faqTitle) + '<div class="faq rv">' + p.faq.map((q) => "<details><summary>" + esc(c.t(q.q)) + "</summary><p>" + esc(c.t(q.a)) + "</p></details>").join("") + "</div></section>" : "");
Object.keys(P).forEach((k) => {
  BLOCKS["program-" + k] = (c, b) => {
    const p = c.M.programs[c.page.program];
    if (!p) return "";
    return P[k](c, Object.assign({ slug: c.page.program }, p), c.env.rel(c.page.program) || { state: "missing", repo: p.repo || "" });
  };
});
export const BLOCK_TYPES = Object.keys(BLOCKS);

/* ---------- страница ---------- */
function blockList(c) {
  return (c.page.blocks || []).map((b, i) => {
    if (b.hidden || !BLOCKS[b.type]) return c.env.edit && b.hidden ? '<div class="blk blk-hidden" data-bid="' + esc(b.id) + '" hidden></div>' : "";
    const inner = BLOCKS[b.type](c, b, i);
    return inner ? wrapBlock(c, b, inner) : (c.env.edit ? '<div class="blk blk-empty" data-bid="' + esc(b.id) + '"></div>' : "");
  });
}
export function renderBlock(M, key, lang, env, bid) {
  const c = ctxFor(M, key, lang, env);
  const i = (c.page.blocks || []).findIndex((b) => b.id === bid);
  if (i < 0) return "";
  return blockList(c)[i];
}
export function renderMain(M, key, lang, env) { return blockList(ctxFor(M, key, lang, env)).join("\n"); }

export function renderPage(M, key, lang, env) {
  const c = ctxFor(M, key, lang, env);
  const page = c.page;
  if (!page) throw new Error("Нет страницы " + key);
  const prog = page.program ? M.programs[page.program] : null;
  const head = (page.blocks || []).find((b) => b.type === "page-head" && !b.hidden);
  const seo = page.seo || {};
  const baseTitle = c.t(seo.title) || (key === "home" ? c.t(M.site.title) : prog ? prog.name + " — " + c.t(prog.tagline) : (head ? c.t(head.data.title) : c.t(page.title)) + " — a_a_avgust");
  const desc = c.t(seo.description) || (prog ? c.t(prog.lead).slice(0, 200) : head && c.t(head.data.lead) ? c.t(head.data.lead) : "");
  const og = seo.og && seo.og.src ? env.og(seo.og) : prog && env.ogFor ? env.ogFor(page.program, lang) : "";
  const body = blockList(c).join("\n");
  const viewer = (page.blocks || []).some((b) => !b.hidden && (b.type === "gallery" || b.type === "program-shots" || b.type === "program-gallery"));
  let jsonld = null;
  if (key === "home") jsonld = { "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "a_a_avgust", url: c.abs(c.hrefL("home", lang)), inLanguage: lang }, { "@type": "Person", name: "a_a_avgust", url: c.abs(c.hrefL("home", lang)), email: "mailto:" + M.site.email }] };
  if (prog) {
    const R = env.rel(page.program) || {};
    jsonld = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: prog.name, operatingSystem: prog.os || "macOS", applicationCategory: prog.category || "UtilitiesApplication",
      softwareVersion: R.version || undefined, downloadUrl: R.state === "dmg" ? R.href : undefined, author: { "@type": "Person", name: "a_a_avgust" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, url: c.abs(c.hrefL(key, lang)) };
  }
  return layout(c, { title: baseTitle, description: desc, og: og || undefined, ogAlt: prog ? prog.name : undefined, gem: page.gem || (prog && prog.gem) || "ruby", navKey: prog ? "apps" : key, body, viewer, jsonld });
}

export function render404(M, env) {
  const ru = ctxFor(M, "home", "ru", env), en = ctxFor(M, "home", "en", env);
  const body = '<section class="hero nf"><div class="wrap hero-in"><div class="pool">' + sign("ruby", 150, { eager: true, cls: "hero-sign" }) + "</div>" +
    '<p class="eyebrow">404</p><h1 class="display-sm">' + esc(ru.T.nfTitle) + '</h1><p class="tagline">' + esc(ru.T.nfLead) + "</p>" +
    '<p class="tagline en" lang="en">' + esc(en.T.nfTitle) + ". " + esc(en.T.nfLead) + "</p>" +
    '<div class="actions center"><a class="btn" href="/">' + esc(ru.T.nfHome) + '</a><a class="btn ghost" href="/en/" lang="en">' + esc(en.T.nfHome) + "</a></div></div></section>";
  return layout(ru, { title: ru.T.nfTitle + " · 404 — a_a_avgust", body, noindex: true }).replace('<body class="pg-home">', '<body class="pg-404">');
}

/* Старый адрес → новый (GitHub Pages не умеет перенаправлять на сервере). */
export function renderRedirect(to, abs, title) {
  return '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<title>' + esc(title) + '</title>\n<meta name="robots" content="noindex">\n<link rel="canonical" href="' + esc(abs) + '">\n' +
    '<meta http-equiv="refresh" content="0; url=' + esc(to) + '">\n<script>location.replace(' + JSON.stringify(to) + "+location.hash)</script>\n</head>\n<body><p><a href=\"" + esc(to) + "\">" + esc(title) + "</a></p></body>\n</html>\n";
}

/* какие страницы публиковать */
export function pageKeys(M) { return visiblePages(M); }

/* все ссылки на картинки в контенте (сборка обрабатывает их заранее) */
export function collectRefs(M) {
  const out = [];
  const add = (r) => { if (r && r.src) out.push(r); };
  M.works.forEach((w) => { if (!w.hidden) add(w.image); });
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v.src === "string" && "crop" in v) { add(v); return; }
    Object.keys(v).forEach((k) => walk(v[k]));
  };
  Object.keys(M.pages).forEach((k) => walk(M.pages[k].blocks));
  Object.keys(M.programs).forEach((k) => walk(M.programs[k]));
  if (M.theme.background && M.theme.background.image) add(M.theme.background.image);
  return out;
}
