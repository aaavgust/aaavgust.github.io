/*
  Проверка контента. Одна и та же — в редакторе перед «Опубликовать» и в GitHub Actions перед сборкой:
  испорченная правка не попадёт на сайт, на сайте останется прошлая версия.
  validate(M, { exists }) → [{ path, message }]  (пустой список — всё в порядке)
*/
import { FONTS } from "./fonts.mjs";
import { GEMS } from "./theme.mjs";

export const BLOCK_TYPES = ["hero", "cards", "page-head", "gallery", "music", "apps", "about", "contact", "text", "image", "divider",
  "program-hero", "program-mock", "program-facts", "program-shots", "program-features", "program-gallery", "program-panels", "program-install", "program-docs", "program-download", "program-faq"];
export const ASPECTS = ["auto", "original", "free", "1:1", "4:5", "3:4", "9:16", "16:9", "3:2", "2:3"];
const COLORS = ["ground", "surface", "raised", "hair", "ink", "muted", "accent", "accentDeep", "accentInk", "onAccent", "link", "gold", "focus", "glow", "light", "haze", "bgFrom", "bgTo"];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function validate(M, opt = {}) {
  const errs = [];
  const err = (path, message) => errs.push({ path, message });
  const isText = (v) => typeof v === "string" || (v && typeof v === "object" && typeof (v.ru == null ? "" : v.ru) === "string" && typeof (v.en == null ? "" : v.en) === "string");
  const num = (path, v, lo, hi, label) => { if (typeof v !== "number" || !isFinite(v) || v < lo || v > hi) err(path, `${label}: нужно число от ${lo} до ${hi}`); };
  const ref = (path, r, label) => {
    if (r == null) return;
    if (typeof r !== "object" || typeof r.src !== "string" || !/^\/?media\//.test(r.src) || r.src.indexOf("..") !== -1) { err(path, `${label}: картинка должна лежать в media/`); return; }
    if (opt.exists && !opt.exists(r.src.replace(/^\/+/, ""))) err(path, `${label}: нет файла ${r.src}`);
    if (r.crop) {
      const c = r.crop;
      for (const k of ["x", "y", "w", "h"]) if (typeof c[k] !== "number" || c[k] < 0 || c[k] > 1) err(path + ".crop." + k, `${label}: кадр выходит за картинку`);
      if (c.x + c.w > 1.0001 || c.y + c.h > 1.0001) err(path + ".crop", `${label}: кадр выходит за картинку`);
      if (c.rot != null && [0, 90, 180, 270].indexOf(c.rot) === -1) err(path + ".crop.rot", `${label}: поворот только на 90°`);
    }
    if (r.focal && (typeof r.focal.x !== "number" || typeof r.focal.y !== "number" || r.focal.x < 0 || r.focal.x > 1 || r.focal.y < 0 || r.focal.y > 1)) err(path + ".focal", `${label}: точка фокуса вне картинки`);
    if (r.fit && r.fit !== "fit" && r.fit !== "fill") err(path + ".fit", `${label}: показ «вписать» или «заполнить»`);
    if (r.aspect && ASPECTS.indexOf(r.aspect) === -1) err(path + ".aspect", `${label}: неизвестное соотношение сторон`);
  };
  const walkRefs = (path, v) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach((x, i) => walkRefs(path + "." + i, x)); return; }
    if (typeof v.src === "string") { ref(path, v, "Картинка"); return; }
    Object.keys(v).forEach((k) => walkRefs(path + "." + k, v[k]));
  };

  /* тема */
  const t = M.theme || {};
  for (const mode of ["dark", "light"]) {
    for (const k of COLORS) if (t[mode] && t[mode][k] != null && !HEX.test(t[mode][k])) err(`theme.${mode}.${k}`, `Цвет «${k}» (${mode === "dark" ? "тёмная" : "светлая"} тема): нужен формат #RRGGBB`);
    for (const k of ["ground", "ink", "muted", "accent", "accentInk", "onAccent", "gold"]) if (!t[mode] || !HEX.test(t[mode][k] || "")) err(`theme.${mode}.${k}`, `Не задан цвет «${k}» (${mode})`);
  }
  for (const k of ["heading", "body", "ui"]) if (!FONTS.some((f) => f.id === (t.fonts || {})[k])) err("theme.fonts." + k, "Неизвестный шрифт");
  const ty = t.type || {};
  num("theme.type.base", ty.base, 13, 22, "Размер текста");
  num("theme.type.headingScale", ty.headingScale, 0.6, 1.6, "Размер заголовков");
  num("theme.type.bodyLineHeight", ty.bodyLineHeight, 1.1, 2.2, "Межстрочный интервал");
  num("theme.type.headingTracking", ty.headingTracking, -5, 20, "Трекинг заголовков");
  num("theme.type.labelTracking", ty.labelTracking, 0, 40, "Трекинг надписей");
  if ([400, 500, 600, 700].indexOf(ty.headingWeight) === -1) err("theme.type.headingWeight", "Вес заголовков: 400, 500, 600 или 700");
  if ([400, 500, 600].indexOf(ty.bodyWeight) === -1) err("theme.type.bodyWeight", "Вес текста: 400, 500 или 600");
  if (["chamfer", "round", "square"].indexOf((t.shape || {}).corners) === -1) err("theme.shape.corners", "Углы: срезанные, скруглённые или прямые");
  num("theme.shape.size", (t.shape || {}).size, 0, 32, "Размер угла");
  num("theme.layout.maxWidth", (t.layout || {}).maxWidth, 720, 1800, "Ширина содержимого");
  num("theme.layout.spacing", (t.layout || {}).spacing, 0.5, 2, "Интервалы");
  num("theme.layout.gutter", (t.layout || {}).gutter, 8, 48, "Поля по краям");
  const bg = t.background || {};
  if (["solid", "gradient", "image"].indexOf(bg.kind) === -1) err("theme.background.kind", "Фон: цвет, градиент или картинка");
  for (const k of ["overlay", "glow", "vignette", "haze"]) if (bg[k] != null) num("theme.background." + k, bg[k], 0, 1, "Сила эффекта фона");
  if (bg.kind === "image") { if (!bg.image) err("theme.background.image", "Фон-картинка: выберите картинку"); else ref("theme.background.image", bg.image, "Фон"); }
  if (["system", "dark", "light"].indexOf(t.mode) === -1) err("theme.mode", "Тема по умолчанию: системная, тёмная или светлая");

  /* сайт */
  const s = M.site || {};
  if (!isText(s.title) || !(s.title.ru || s.title).trim) err("site.title", "Нет заголовка сайта");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email || "")) err("site.email", "Почта: нужен адрес вида имя@почта");
  if (s.donate && !/^https:\/\/\S+$/.test(s.donate)) err("site.donate", "Ссылка «Поддержать» должна начинаться с https://");
  if (s.authUrl && !/^https:\/\/[^\s/]+\/?$/.test(s.authUrl)) err("site.authUrl", "Адрес сервера входа: только https://имя.workers.dev");
  (s.nav || []).forEach((n, i) => { if (!M.pages[n.page]) err(`site.nav.${i}`, `Пункт меню ведёт на несуществующую страницу «${n.page}»`); });

  /* страницы */
  const paths = new Map();
  Object.keys(M.pages || {}).forEach((key) => {
    const p = M.pages[key], at = "pages." + key;
    if (!/^[a-z0-9-]+$/.test(key)) err(at, `Ключ страницы «${key}»: только латиница, цифры и дефис`);
    if (typeof p.path !== "string" || !/^([a-z0-9-]+\/)*$/.test(p.path)) err(at + ".path", `Адрес страницы «${key}»: латиница, цифры, дефис и «/» в конце`);
    else if (paths.has(p.path)) err(at + ".path", `Адрес /${p.path} уже занят страницей «${paths.get(p.path)}»`);
    else paths.set(p.path, key);
    if (p.program && !(M.programs || {})[p.program]) err(at + ".program", `Страница «${key}» ссылается на несуществующую программу`);
    if (p.seo && p.seo.og) ref(at + ".seo.og", p.seo.og, "Картинка превью");
    const ids = new Set();
    (p.blocks || []).forEach((b, i) => {
      const bp = `${at}.blocks.${i}`;
      if (!b || typeof b !== "object") { err(bp, "Пустой блок"); return; }
      if (!b.id || ids.has(b.id)) err(bp + ".id", "У блока нет своего номера или он повторяется");
      ids.add(b.id);
      if (BLOCK_TYPES.indexOf(b.type) === -1) err(bp + ".type", `Неизвестный тип блока «${b.type}»`);
      if (b.type && b.type.indexOf("program-") === 0 && !p.program) err(bp, "Блок программы стоит на странице без программы");
      const la = b.layout || {};
      if (la.align && ["left", "center", "right"].indexOf(la.align) === -1) err(bp + ".layout.align", "Выравнивание: слева, по центру или справа");
      if (la.imagePos && ["left", "right", "top", "background", "bg", "none"].indexOf(la.imagePos) === -1) err(bp + ".layout.imagePos", "Положение картинки неизвестно");
      if (la.columns != null) num(bp + ".layout.columns", la.columns, 1, 5, "Колонки");
      if (la.padding != null) num(bp + ".layout.padding", la.padding, 0, 3, "Отступы блока");
      const st = b.style || {};
      if (st.ink && !HEX.test(st.ink)) err(bp + ".style.ink", "Цвет текста блока: #RRGGBB");
      if (st.scale != null) num(bp + ".style.scale", st.scale, 0.6, 1.8, "Размер текста блока");
      if (st.bg && st.bg.kind && ["none", "color", "gradient", "image"].indexOf(st.bg.kind) === -1) err(bp + ".style.bg", "Фон блока неизвестен");
      for (const k of ["color", "color2"]) if (st.bg && st.bg[k] && !HEX.test(st.bg[k])) err(bp + ".style.bg." + k, "Цвет фона блока: #RRGGBB");
      walkRefs(bp, b.data);
      if (st.bg && st.bg.image) ref(bp + ".style.bg.image", st.bg.image, "Фон блока");
    });
  });
  if (!M.pages || !M.pages.home) err("pages.home", "Нет главной страницы");

  /* работы, серии, программы */
  const seriesIds = new Set((M.series || []).map((x) => x.id));
  (M.works || []).forEach((w) => {
    if (!w.image || !w.image.src) err("works." + w.id, "У работы нет картинки");
    else ref("works." + w.id + ".image", w.image, "Работа");
    if (w.series && !seriesIds.has(w.series)) err("works." + w.id + ".series", "Работа в несуществующей серии");
    if (!isText(w.title) || !isText(w.alt)) err("works." + w.id, "Название и описание работы — текст RU/EN");
  });
  Object.keys(M.programs || {}).forEach((k) => {
    const p = M.programs[k], at = "programs." + k;
    if (!p.name) err(at + ".name", "У программы нет названия");
    if (p.gem && !GEMS[p.gem]) err(at + ".gem", "Неизвестный камень");
    if (p.repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.repo)) err(at + ".repo", "Репозиторий: владелец/имя");
    walkRefs(at, p);
  });
  return errs;
}
