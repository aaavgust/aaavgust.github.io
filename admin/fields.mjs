/*
  Что можно менять у каждого блока, темы и сайта — описания полей для правой панели (инспектора).
  Поле: { k: путь, t: тип, label, i18n?, hint?, ... }. Типы: text, area, num, seg, select, toggle, color, image, link, list, strings, font, gem.
  Подсказки и значения по умолчанию — без ярлыков жанра и стиля (правило владельца).
*/
import { FONTS } from "./shared/fonts.mjs";

export const GEMS = [["ruby", "Рубин"], ["amethyst", "Аметист"], ["diamond", "Алмаз"], ["sapphire", "Сапфир"], ["emerald", "Изумруд"], ["topaz", "Топаз"], ["aquamarine", "Аквамарин"], ["tourmaline", "Турмалин"]];
const T = (ru = "", en = "") => ({ ru, en });
export const emptyRef = () => null;

/* ---------- раскладка и стиль: общие для всех блоков ---------- */
const ALIGN = { k: "layout.align", t: "seg", label: "Выравнивание", options: [["left", "Слева"], ["center", "По центру"], ["right", "Справа"]] };
const IMGPOS = { k: "layout.imagePos", t: "seg", label: "Картинка", options: [["left", "Слева"], ["right", "Справа"], ["top", "Сверху"], ["background", "Фоном"], ["none", "Скрыть"]] };
const COLS = { k: "layout.columns", t: "seg", label: "Колонки", options: [[1, "1"], [2, "2"], [3, "3"]] };
const PAD = { k: "layout.padding", t: "num", label: "Отступы сверху и снизу", min: 0, max: 3, step: 0.25, unit: "×" };
const WIDTH = { k: "layout.width", t: "seg", label: "Ширина", options: [["narrow", "Узкая"], ["normal", "Обычная"], ["wide", "Широкая"], ["full", "Во всю"]] };
export const STYLE = [
  { k: "style.bg.kind", t: "seg", label: "Фон блока", options: [["none", "Нет"], ["color", "Цвет"], ["gradient", "Градиент"], ["image", "Картинка"]] },
  { k: "style.bg.color", t: "color", label: "Цвет фона", when: (b) => ["color", "gradient"].includes(((b.style || {}).bg || {}).kind) },
  { k: "style.bg.color2", t: "color", label: "Второй цвет", when: (b) => ((b.style || {}).bg || {}).kind === "gradient" },
  { k: "style.bg.angle", t: "num", label: "Угол градиента", min: 0, max: 360, step: 5, unit: "°", when: (b) => ((b.style || {}).bg || {}).kind === "gradient" },
  { k: "style.bg.image", t: "image", label: "Картинка фона", when: (b) => ((b.style || {}).bg || {}).kind === "image" },
  { k: "style.bg.overlay", t: "num", label: "Затемнение картинки", min: 0, max: 1, step: 0.05, when: (b) => ((b.style || {}).bg || {}).kind === "image" },
  { k: "style.ink", t: "color", label: "Цвет текста", allowEmpty: true, hint: "Пусто — цвет темы" },
  { k: "style.scale", t: "num", label: "Размер текста", min: 0.6, max: 1.8, step: 0.05, unit: "×" }
];

/* ---------- блоки ---------- */
const link = { t: "link", label: "Ссылка" };
export const BLOCKS = {
  hero: {
    name: "Первый экран", addable: true, layout: [ALIGN, PAD, WIDTH],
    content: [
      { k: "data.eyebrow", t: "text", i18n: true, label: "Надпись сверху" },
      { k: "data.title", t: "text", i18n: true, label: "Заголовок" },
      { k: "data.tagline", t: "area", i18n: true, label: "Строка под заголовком" },
      { k: "data.sign", t: "gem", label: "Знак", allowNone: true, hint: "Если выбрана картинка ниже — показывается она" },
      { k: "data.image", t: "image", label: "Картинка вместо знака", optional: true },
      { k: "data.imageAlt", t: "text", i18n: true, label: "Описание картинки (alt)", when: (b) => !!(b.data || {}).image }
    ],
    make: () => ({ eyebrow: T(), title: T("a_a_avgust", "a_a_avgust"), tagline: T(), sign: "ruby", image: null })
  },
  "page-head": {
    name: "Заголовок страницы", addable: true, layout: [ALIGN, PAD, WIDTH],
    content: [
      { k: "data.eyebrow", t: "text", i18n: true, label: "Надпись сверху" },
      { k: "data.title", t: "text", i18n: true, label: "Заголовок" },
      { k: "data.lead", t: "area", i18n: true, label: "Вступление" },
      { k: "data.showCount", t: "toggle", label: "Показывать число работ" }
    ],
    make: () => ({ eyebrow: T(), title: T("Новый раздел", "New section"), lead: T(), showCount: false })
  },
  cards: {
    name: "Карточки", addable: true, layout: [COLS, PAD, WIDTH],
    content: [
      { k: "data.title", t: "text", i18n: true, label: "Заголовок над карточками" },
      { k: "data.items", t: "list", label: "Карточки", itemLabel: (it, i) => (it.title && it.title.ru) || (it.link ? "→ " + it.link : "Карточка " + (i + 1)),
        fields: [
          { k: "title", t: "text", i18n: true, label: "Заголовок", hint: "Пусто — название страницы из меню" },
          { k: "text", t: "area", i18n: true, label: "Текст" },
          { k: "link", t: "link", label: "Куда ведёт" },
          { k: "cta", t: "text", i18n: true, label: "Текст кнопки" },
          { k: "art", t: "seg", label: "Картинка карточки", options: [["image", "Картинка"], ["programs", "Знаки программ"], ["none", "Без картинки"]] },
          { k: "image", t: "image", label: "Картинка", when: (it) => it.art === "image" }
        ],
        make: () => ({ title: T(), text: T(), link: "", cta: T(), art: "image", image: null }) }
    ],
    make: () => ({ title: T(), items: [] })
  },
  gallery: {
    name: "Галерея работ", addable: true, layout: [PAD, WIDTH],
    content: [
      { k: "data.showFilters", t: "toggle", label: "Фильтр по сериям" },
      { k: "data.columns", t: "seg", label: "Колонок на компьютере", options: [[2, "2"], [3, "3"], [4, "4"], [5, "5"]] },
      { t: "note", text: "Сами работы, их порядок, названия и кадр — в разделе «Работы» слева." }
    ],
    make: () => ({ showFilters: true, columns: 4 })
  },
  music: {
    name: "Музыка", addable: false, layout: [IMGPOS, PAD, WIDTH],
    content: [
      { k: "data.text", t: "area", i18n: true, label: "Текст", rows: 5 },
      { k: "data.links", t: "list", label: "Площадки", itemLabel: (it) => it.label || "Ссылка", fields: [{ k: "label", t: "text", label: "Название" }, { k: "href", t: "text", label: "Ссылка", ph: "https://…" }], make: () => ({ label: "", href: "" }) },
      { k: "data.releases", t: "list", label: "Релизы", itemLabel: (it) => it.title || "Релиз", fields: [{ k: "title", t: "text", label: "Название" }, { k: "text", t: "text", i18n: true, label: "Подпись" }], make: () => ({ title: "", text: T() }) },
      { k: "data.image", t: "image", label: "Картинка", optional: true },
      { k: "data.imageAlt", t: "text", i18n: true, label: "Описание картинки (alt)" }
    ]
  },
  apps: { name: "Список программ", addable: true, layout: [COLS, PAD, WIDTH], content: [{ t: "note", text: "Карточки берутся из программ. Тексты — на страницах программ." }], make: () => ({}) },
  about: {
    name: "Обо мне", addable: false, layout: [IMGPOS, PAD, WIDTH],
    content: [
      { k: "data.name", t: "text", i18n: true, label: "Имя на странице" },
      { k: "data.role", t: "text", i18n: true, label: "Строка под именем" },
      { k: "data.paragraphs", t: "list", label: "Абзацы", itemLabel: (it, i) => ((it && it.ru) || "").slice(0, 40) || "Абзац " + (i + 1), textItems: true, make: () => T() },
      { k: "data.tools", t: "strings", label: "Инструменты" },
      { k: "data.sign", t: "gem", label: "Знак (если нет картинки)" },
      { k: "data.image", t: "image", label: "Картинка вместо знака", optional: true },
      { k: "data.imageAlt", t: "text", i18n: true, label: "Описание картинки (alt)", when: (b) => !!(b.data || {}).image }
    ]
  },
  contact: {
    name: "Почта и «Поддержать»", addable: false, layout: [PAD, WIDTH],
    content: [{ k: "data.showCopy", t: "toggle", label: "Кнопка «Скопировать адрес»" }, { k: "data.showDonate", t: "toggle", label: "Кнопка «Поддержать» (если есть ссылка)" },
      { t: "note", text: "Адрес почты и ссылка «Поддержать» — в разделе «Сайт» слева." }]
  },
  text: {
    name: "Текст", addable: true, layout: [ALIGN, IMGPOS, COLS, PAD, WIDTH],
    content: [
      { k: "data.eyebrow", t: "text", i18n: true, label: "Надпись сверху" },
      { k: "data.title", t: "text", i18n: true, label: "Заголовок" },
      { k: "data.paragraphs", t: "list", label: "Абзацы", itemLabel: (it, i) => ((it && it.ru) || "").slice(0, 40) || "Абзац " + (i + 1), textItems: true, make: () => T() },
      { k: "data.image", t: "image", label: "Картинка", optional: true },
      { k: "data.imageAlt", t: "text", i18n: true, label: "Описание картинки (alt)", when: (b) => !!(b.data || {}).image }
    ],
    make: () => ({ eyebrow: T(), title: T("Заголовок", "Title"), paragraphs: [T("Текст.", "Text.")], image: null })
  },
  image: {
    name: "Картинка", addable: true, layout: [PAD, WIDTH],
    content: [{ k: "data.image", t: "image", label: "Картинка" }, { k: "data.alt", t: "text", i18n: true, label: "Описание (alt)" }, { k: "data.caption", t: "text", i18n: true, label: "Подпись" }],
    make: () => ({ image: null, alt: T(), caption: T() })
  },
  divider: { name: "Разделитель", addable: true, layout: [PAD], content: [{ k: "data.style", t: "seg", label: "Вид", options: [["ornament", "С восьмиугольником"], ["line", "Линия"]] }], make: () => ({ style: "ornament" }) }
};

/* блоки страниц программ: тексты лежат в файле программы (programs/<slug>.json) */
const P = (k, t, label, extra) => Object.assign({ k: "program." + k, t, label }, extra || {});
const pl = (k, label, fields, make, itemLabel) => P(k, "list", label, { fields, make, itemLabel: itemLabel || ((it, i) => ((it.title || it.q || it.caption || it.label || it.alt || {}).ru || "").slice(0, 40) || label + " " + (i + 1)) });
export const PROGRAM_BLOCKS = {
  "program-hero": { name: "Первый экран программы", layout: [ALIGN, PAD], content: [
    P("name", "text", "Название (Avgust …)"), P("gem", "gem", "Камень знака"), P("tagline", "text", "Одна строка", { i18n: true }), P("title", "text", "Подзаголовок курсивом", { i18n: true }),
    P("lead", "area", "Описание своими словами", { i18n: true }), P("repo", "text", "Репозиторий для «Скачать»", { hint: "владелец/имя, например aaavgust/AvgustFamiliar" }),
    P("aliases", "strings", "Старые адреса, которые ведут сюда"), P("os", "text", "Система (для поисковиков)"), P("hidden", "toggle", "Скрыть программу с сайта")] },
  "program-mock": { name: "Макет окна чата", layout: [PAD], content: [P("showMock", "toggle", "Показывать макет окна")] },
  "program-facts": { name: "Цифры", layout: [PAD], content: [pl("facts", "Цифры", [{ k: "title", t: "text", i18n: true, label: "Крупно" }, { k: "text", t: "text", i18n: true, label: "Пояснение" }], () => ({ title: T(), text: T() }))] },
  "program-shots": { name: "Снимки экрана", layout: [PAD], content: [P("shotsTitle", "text", "Заголовок", { i18n: true }),
    pl("shots", "Снимки", [{ k: "image", t: "image", label: "Снимок (RU)" }, { k: "imageEn", t: "image", label: "Снимок (EN), если отличается", optional: true }, { k: "alt", t: "text", i18n: true, label: "Подпись и alt" },
      { k: "theme", t: "seg", label: "Для темы", options: [["any", "Обеих"], ["dark", "Тёмной"], ["light", "Светлой"]] }, { k: "hero", t: "toggle", label: "Крупно под первым экраном" }], () => ({ image: null, imageEn: null, alt: T(), theme: "any", hero: false }))] },
  "program-features": { name: "Возможности", layout: [PAD], content: [P("featuresTitle", "text", "Заголовок", { i18n: true }), P("featuresLead", "area", "Вступление", { i18n: true }),
    pl("features", "Возможности", [{ k: "title", t: "text", i18n: true, label: "Название" }, { k: "text", t: "area", i18n: true, label: "Что делает" },
      { k: "bullets", t: "list", label: "Пункты", textItems: true, make: () => T(), itemLabel: (it, i) => ((it && it.ru) || "").slice(0, 40) || "Пункт " + (i + 1) }], () => ({ title: T(), text: T(), bullets: [] })),
    P("makers", "strings", "Модели от")] },
  "program-gallery": { name: "Галерея", layout: [PAD], content: [P("galleryTitle", "text", "Заголовок", { i18n: true }), P("galleryLead", "area", "Вступление", { i18n: true }),
    pl("gallery", "Картинки", [{ k: "image", t: "image", label: "Картинка" }, { k: "caption", t: "text", i18n: true, label: "Подпись и alt" }], () => ({ image: null, caption: T() })),
    pl("options", "Параметры", [{ k: "title", t: "text", i18n: true, label: "Параметр" }, { k: "text", t: "text", i18n: true, label: "Значение" }], () => ({ title: T(), text: T() }))] },
  "program-panels": { name: "Приватность и прочее", layout: [PAD], content: [P("panelsTitle", "text", "Заголовок", { i18n: true }),
    pl("panels", "Блоки", [{ k: "title", t: "text", i18n: true, label: "Заголовок" }, { k: "text", t: "area", i18n: true, label: "Текст" }, { k: "image", t: "image", label: "Картинка", optional: true }, { k: "imageAlt", t: "text", i18n: true, label: "Alt картинки" }], () => ({ title: T(), text: T(), image: null, imageAlt: T() }))] },
  "program-install": { name: "Установка", layout: [PAD], content: [P("stepsTitle", "text", "Заголовок", { i18n: true }),
    pl("steps", "Шаги", [{ k: "title", t: "text", i18n: true, label: "Заголовок шага" }, { k: "text", t: "area", i18n: true, label: "Текст" }, { k: "image", t: "image", label: "Картинка", optional: true },
      { k: "imageAlt", t: "text", i18n: true, label: "Alt картинки" }, { k: "key", t: "toggle", label: "Выделить шаг" }], () => ({ title: T(), text: T(), image: null, imageAlt: T(), key: false })),
    P("note", "area", "Почему macOS предупреждает", { i18n: true }),
    pl("requirements", "Требования", [{ k: "title", t: "text", i18n: true, label: "Что (можно пусто)" }, { k: "text", t: "text", i18n: true, label: "Требование" }], () => ({ title: T(), text: T() }))] },
  "program-docs": { name: "Документы", layout: [PAD], content: [P("license", "area", "Лицензия коротко", { i18n: true }),
    pl("docs", "Документы в репозитории", [{ k: "label", t: "text", i18n: true, label: "Название" }, { k: "path", t: "text", label: "Путь", hint: "например blob/main/LICENSE" }], () => ({ label: T(), path: "" }))] },
  "program-download": { name: "Блок «Скачать»", layout: [PAD], content: [P("downloadTitle", "text", "Заголовок", { i18n: true }), P("notes", "area", "Что нового", { i18n: true }), P("updatesText", "area", "Про обновления", { i18n: true })] },
  "program-faq": { name: "Вопросы", layout: [PAD], content: [P("faqTitle", "text", "Заголовок", { i18n: true }),
    pl("faq", "Вопросы", [{ k: "q", t: "text", i18n: true, label: "Вопрос" }, { k: "a", t: "area", i18n: true, label: "Ответ" }], () => ({ q: T(), a: T() }))] }
};
export function blockDef(type) { return BLOCKS[type] || PROGRAM_BLOCKS[type] || { name: type, layout: [], content: [] }; }
export function newBlock(type) {
  const d = BLOCKS[type];
  return { type, hidden: false, layout: { align: type === "hero" ? "center" : "left", imagePos: "right", columns: type === "cards" ? 3 : 1, padding: 1, width: "normal" },
    style: { bg: { kind: "none", color: "", color2: "", angle: 180, image: null, overlay: 0.5 }, ink: "", scale: 1 }, data: d && d.make ? d.make() : {} };
}

/* ---------- тема ---------- */
const fontOpts = FONTS.map((f) => [f.id, f.name]);
const color = (k, label) => ({ k, t: "color", label });
export const THEME = [
  { title: "Шрифты", fields: [
    { k: "fonts.heading", t: "font", label: "Заголовки", options: fontOpts }, { k: "fonts.body", t: "font", label: "Текст", options: fontOpts }, { k: "fonts.ui", t: "font", label: "Меню, кнопки, надписи", options: fontOpts },
    { k: "type.headingWeight", t: "seg", label: "Насыщенность заголовков", options: [[400, "Обычные"], [600, "Полужирные"], [700, "Жирные"]] },
    { k: "type.bodyWeight", t: "seg", label: "Насыщенность текста", options: [[400, "Обычный"], [500, "Средний"], [600, "Полужирный"]] }] },
  { title: "Размеры текста", fields: [
    { k: "type.base", t: "num", label: "Основной текст", min: 13, max: 22, step: 1, unit: "px" }, { k: "type.headingScale", t: "num", label: "Заголовки", min: 0.6, max: 1.6, step: 0.05, unit: "×" },
    { k: "type.bodyLineHeight", t: "num", label: "Межстрочный интервал", min: 1.1, max: 2.2, step: 0.05 }, { k: "type.headingTracking", t: "num", label: "Разрядка заголовков", min: -5, max: 20, step: 0.5, unit: "%" },
    { k: "type.labelTracking", t: "num", label: "Разрядка надписей капслоком", min: 0, max: 40, step: 1, unit: "%" }] },
  { title: "Форма и сетка", fields: [
    { k: "shape.corners", t: "seg", label: "Углы кнопок и карточек", options: [["chamfer", "Срезанные"], ["round", "Скруглённые"], ["square", "Прямые"]] },
    { k: "shape.size", t: "num", label: "Размер угла", min: 0, max: 32, step: 1, unit: "px" },
    { k: "layout.maxWidth", t: "num", label: "Ширина содержимого", min: 720, max: 1800, step: 20, unit: "px" },
    { k: "layout.spacing", t: "num", label: "Интервалы между разделами", min: 0.5, max: 2, step: 0.05, unit: "×" },
    { k: "layout.gutter", t: "num", label: "Поля по краям", min: 8, max: 48, step: 2, unit: "px" }] },
  { title: "Фон", fields: [
    { k: "background.kind", t: "seg", label: "Фон страницы", options: [["solid", "Цвет"], ["gradient", "Градиент"], ["image", "Картинка"]] },
    { k: "background.angle", t: "num", label: "Угол градиента", min: 0, max: 360, step: 5, unit: "°", when: (t) => (t.background || {}).kind === "gradient" },
    { k: "background.image", t: "image", label: "Картинка фона", when: (t) => (t.background || {}).kind === "image" },
    { k: "background.overlay", t: "num", label: "Затемнение картинки", min: 0, max: 1, step: 0.05, when: (t) => (t.background || {}).kind === "image" },
    { k: "background.glow", t: "num", label: "Свечение (островки света)", min: 0, max: 1, step: 0.05 },
    { k: "background.vignette", t: "num", label: "Тень по краям", min: 0, max: 1, step: 0.05 },
    { k: "background.haze", t: "num", label: "Дымка", min: 0, max: 1, step: 0.05 },
    { k: "background.motion", t: "toggle", label: "Медленное движение дымки" }] },
  { title: "Тема по умолчанию", fields: [{ k: "mode", t: "seg", label: "Для новых посетителей", options: [["system", "Как в системе"], ["dark", "Тёмная"], ["light", "Светлая"]] }] }
];
export const PALETTE = [
  ["ground", "Фон"], ["surface", "Карточки"], ["raised", "Поднятые элементы"], ["hair", "Линии и рамки"], ["ink", "Текст"], ["muted", "Пояснения"],
  ["accent", "Акцент (кнопки)"], ["accentDeep", "Акцент при нажатии"], ["onAccent", "Текст на кнопке"], ["accentInk", "Акцентный текст"], ["link", "Ссылки"],
  ["gold", "Золото: надписи и рамки"], ["focus", "Рамка фокуса"], ["glow", "Свечение знака"], ["light", "Свет сверху"], ["haze", "Дымка"], ["bgFrom", "Градиент: верх"], ["bgTo", "Градиент: низ"]
].map(([k, label]) => color(k, label));

/* ---------- сайт ---------- */
export const SITE = [
  { title: "Поиск и превью ссылок", fields: [{ k: "title", t: "text", i18n: true, label: "Заголовок сайта" }, { k: "description", t: "area", i18n: true, label: "Описание сайта", hint: "20–200 символов. Нейтрально, без ярлыков жанра и стиля." }] },
  { title: "Почта и «Поддержать»", fields: [{ k: "email", t: "text", label: "Почта" }, { k: "donate", t: "text", label: "Ссылка «Поддержать»", ph: "https://…", hint: "Пусто — кнопки нет" }] },
  { title: "Меню", fields: [{ k: "nav", t: "list", label: "Пункты меню", itemLabel: (it) => it.page + (it.hidden ? " (скрыт)" : ""),
    fields: [{ k: "page", t: "link", label: "Страница", pagesOnly: true }, { k: "label", t: "text", i18n: true, label: "Надпись", hint: "Пусто — название страницы" }, { k: "hidden", t: "toggle", label: "Скрыть" }],
    make: () => ({ page: "home", label: T(), hidden: false }) }] },
  { title: "Подвал", fields: [{ k: "footer.text", t: "text", i18n: true, label: "Строка под именем" }, { k: "footer.note", t: "text", i18n: true, label: "Строка с ©", hint: "Пусто — «Сайт без счётчиков и cookie»" },
    { k: "footer.showSign", t: "toggle", label: "Знак" }, { k: "footer.showNav", t: "toggle", label: "Ссылки на разделы" }, { k: "footer.showEmail", t: "toggle", label: "Почта" }, { k: "footer.showLang", t: "toggle", label: "Ссылка на другой язык" }] },
  { title: "Вход через GitHub", fields: [{ k: "authUrl", t: "text", label: "Адрес сервера входа", ph: "https://sveltia-cms-auth.имя.workers.dev", hint: "Нужен для кнопки «Войти через GitHub». Пусто — вход по токену." }] }
];
export const PAGE = [
  { title: "Страница", fields: [{ k: "title", t: "text", i18n: true, label: "Название (в меню и в списке слева)" }, { k: "path", t: "text", label: "Адрес", hint: "латиница и дефис, со / в конце, например projects/", noHome: true },
    { k: "gem", t: "gem", label: "Камень (значок вкладки)" }, { k: "hidden", t: "toggle", label: "Скрыть страницу", noHome: true }] },
  { title: "Поиск и превью ссылок", fields: [{ k: "seo.title", t: "text", i18n: true, label: "Заголовок вкладки", hint: "Пусто — по заголовку страницы" },
    { k: "seo.description", t: "area", i18n: true, label: "Описание для поисковиков" }, { k: "seo.og", t: "image", label: "Картинка превью ссылки (1200×630)", optional: true, aspect: "16:9" }] }
];
export const WORK = [
  { title: "Работа", fields: [{ k: "image", t: "image", label: "Картинка и кадр" }, { k: "title", t: "text", i18n: true, label: "Название" }, { k: "alt", t: "area", i18n: true, label: "Что изображено (alt)", hint: "Для незрячих и поисковиков: кто, что делает, где. Без ярлыков жанра и стиля." },
    { k: "series", t: "series", label: "Серия" }, { k: "featured", t: "toggle", label: "Звезда" }, { k: "hidden", t: "toggle", label: "Скрыть с сайта" }] }
];
export const SERIES = [{ title: "Серия", fields: [{ k: "title", t: "text", i18n: true, label: "Название" }, { k: "text", t: "area", i18n: true, label: "Описание" }, { k: "cover", t: "work", label: "Обложка" }] }];
