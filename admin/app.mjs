/*
  Редактор сайта a_a_avgust: https://aaavgust.github.io/admin/
  Слева — страницы и блоки, в центре — живой предпросмотр настоящего сайта из черновика, справа — свойства.
  «Опубликовать» отправляет все изменения ОДНИМ коммитом в закрытый репозиторий, дальше GitHub Actions собирает и выкладывает сайт.
  Пароля у сайта нет: вход только аккаунтом GitHub с правом записи в репозиторий.
*/
import { GitHub, REPO, GhError } from "./gh.mjs";
import { Store, uid, getAt } from "./store.mjs";
import { Media, prepareUpload, fileSlug, uploadsDb, ACCEPT } from "./media.mjs";
import { h, $, $$, icon, toast, confirmBox, modal } from "./ui.mjs";
import { renderGroups, paletteContrast } from "./inspector.mjs";
import { BLOCKS, PROGRAM_BLOCKS, blockDef, newBlock, STYLE, THEME, PALETTE, SITE, PAGE, WORK, SERIES } from "./fields.mjs";
import { openCropper } from "./cropper.mjs";
import { renderPage, renderBlock } from "./shared/render.mjs";
import { themeCss, contrastIssues, contrast } from "./shared/theme.mjs";
import { validate } from "./shared/schema.mjs";
import { UI } from "./shared/ui.mjs";
import * as CM from "./cropmath.mjs";

const SITE_URL = "https://aaavgust.github.io/";
const TOKEN_KEY = "av-token", DRAFT_KEY = "av-draft:" + REPO.owner + "/" + REPO.name;
const CORE_PAGES = ["home", "works", "music", "apps", "about", "contact"];
const DEVICES = { desktop: 1280, tablet: 820, phone: 390 };
/* телефон: своя раскладка — шапка, вкладки снизу («Страницы», «Правка», «Просмотр»), всё на всю ширину */
const MOBILE = window.matchMedia ? matchMedia("(max-width: 819.98px)") : null;
const isMob = () => !!(MOBILE && MOBILE.matches);
const TABS = [["pages", "Страницы", "page"], ["edit", "Правка", "sliders"], ["view", "Просмотр", "eye"]];

const app = {
  store: new Store(), gh: null, media: null, tree: {}, releases: {}, user: null, config: {},
  state: { page: "home", sel: { kind: "page", page: "home" }, device: "desktop", theme: "dark", lang: "ru", view: "preview", work: "", series: "", tab: "view" },
  frame: null, frameReady: false, last: { css: "", order: "", blocks: new Map(), chrome: "" }
};
window.__avgustAdmin = app; // для автотестов

/* ---------- вход ---------- */
function tokenStored() {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
}
function saveToken(t, remember) {
  try { sessionStorage.setItem(TOKEN_KEY, t); if (remember) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* без хранилища — до закрытия вкладки */ }
}
function forgetToken() { try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ок */ } }

function loginView(err) {
  const root = $("#app");
  document.body.classList.toggle("mob", isMob());
  const tok = h("input", { type: "password", id: "tok", autocomplete: "off", spellcheck: "false", placeholder: "github_pat_…", "aria-describedby": "tok-hint" });
  const rem = h("input", { type: "checkbox", id: "rem" });
  const msg = h("p", { class: "err", role: "alert" }, err || "");
  const go = async () => {
    const t = tok.value.trim();
    if (!t) { msg.textContent = "Вставьте токен."; return; }
    msg.textContent = "Проверяю…";
    try { await start(t); saveToken(t, rem.checked); } catch (e) { msg.textContent = e.message; }
  };
  tok.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  root.replaceChildren(h("div", { class: "login" }, h("form", { class: "card", onsubmit: (e) => { e.preventDefault(); go(); } },
    h("img", { src: "/assets/brand/sign-ruby-dark.svg", alt: "", width: 72, height: 72, class: "login-sign" }),
    h("h1", null, "Кабинет a_a_avgust"),
    h("p", { class: "muted" }, "Вход только аккаунтом GitHub, у которого есть право менять сайт."),
    app.config.authUrl ? [h("button", { type: "button", class: "btn primary wide", onclick: oauth }, "Войти через GitHub"), h("p", { class: "or" }, "или по токену")] : null,
    h("label", { for: "tok", class: "fld-l" }, "Токен доступа GitHub"), tok,
    h("p", { class: "hint", id: "tok-hint" }, "Токен с доступом только к aaavgust/a_a_avgust-site: Contents — Read and write, Actions — Read-only. ",
      h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "Создать токен ↗")),
    h("label", { class: "check" }, rem, " Запомнить на этом устройстве"),
    h("button", { type: "submit", class: "btn primary wide" }, "Войти"), msg)));
  tok.focus();
}
/* вход через GitHub: окно сервера входа (Cloudflare Worker) присылает токен сообщением */
let authListener = null;
function oauth() {
  if (authListener) removeEventListener("message", authListener);
  const base = app.config.authUrl.replace(/\/$/, "");
  const origin = new URL(base).origin;
  const w = window.open(base + "/auth?provider=github&site_id=" + encodeURIComponent(location.hostname) + "&scope=repo", "avgust-auth", "width=600,height=720");
  if (!w) { toast("Браузер не открыл окно входа. Разрешите всплывающие окна для этого сайта.", "err"); return; }
  const onMsg = async (e) => {
    if (e.origin !== origin || typeof e.data !== "string") return;
    if (e.data === "authorizing:github") { if (e.source) e.source.postMessage("authorizing:github", e.origin); return; }
    const m = /^authorization:github:(success|error):(.*)$/s.exec(e.data);
    if (!m) return;
    removeEventListener("message", onMsg); authListener = null;
    let d = {};
    try { d = JSON.parse(m[2]); } catch (x) { d = {}; }
    if (m[1] !== "success" || !d.token) { toast("Вход не удался: " + (d.error || "нет токена"), "err", 8000); return; }
    try { await start(d.token); saveToken(d.token, false); } catch (x) { loginView(x.message); }
  };
  authListener = onMsg;
  addEventListener("message", onMsg);
}

/* ---------- загрузка ---------- */
async function start(token) {
  const gh = new GitHub(token);
  app.user = await gh.whoami();
  app.gh = gh;
  const head = await gh.head();
  const [files, tree, rel] = await Promise.all([gh.loadContent(head), gh.mediaTree(head), fetch("/admin/releases.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))]);
  app.tree = tree; app.releases = rel;
  app.store.load(head, files);
  app.media = new Media({ gh, store: app.store, tree, onReady: () => schedule() });
  layout();
  if (!app.unsub) app.unsub = app.store.on(onStoreEvent);
  offerDraft();
}

/* ---------- раскладка ---------- */
function layout() {
  const s = app.state;
  const mob = isMob();
  document.body.classList.toggle("mob", mob);
  const seg = (name, items, cur, fn, cls = "") => h("div", { class: "seg tb " + cls, role: "radiogroup", "aria-label": name }, items.map(([v, label, ic]) => h("button", { type: "button", role: "radio", "aria-checked": String(cur === v), class: cur === v ? "on" : "", title: label, "aria-label": label, onclick: () => fn(v) }, ic ? icon(ic) : label)));
  const bar = mob ? h("header", { class: "bar mbar" },
    h("button", { class: "iconbtn", type: "button", "aria-label": "Меню кабинета", onclick: mobileMenu }, icon("menu")),
    h("div", { class: "mtitle", id: "mtitle" }, mobileTitle()),
    h("button", { class: "iconbtn", type: "button", id: "undo", "aria-label": "Отменить", disabled: !app.store.canUndo, onclick: () => app.store.undo() }, icon("undo")),
    h("button", { class: "btn primary pub", type: "button", id: "publish", onclick: publish }, "Опубликовать", h("span", { class: "badge", id: "count" })))
  : h("header", { class: "bar" },
    h("button", { class: "iconbtn only-m", type: "button", "aria-label": "Страницы и блоки", onclick: () => document.body.classList.toggle("tree-open") }, icon("menu")),
    h("a", { class: "logo", href: "/", target: "_blank", rel: "noopener", title: "Открыть сайт" }, h("img", { src: "/assets/brand/favicon-ruby.svg", alt: "", width: 22, height: 22 }), h("span", null, "a_a_avgust")),
    h("div", { class: "grow" }),
    seg("Устройство", [["desktop", "Компьютер", "desktop"], ["tablet", "Планшет", "tablet"], ["phone", "iPhone", "phone"]], s.device, (v) => { s.device = v; layout(); }, "devs"),
    seg("Тема", [["dark", "Тёмная", "moon"], ["light", "Светлая", "sun"]], s.theme, (v) => { s.theme = v; post({ type: "theme", theme: v }); refresh(true); layout(); }),
    seg("Язык", [["ru", "RU"], ["en", "EN"]], s.lang, (v) => { s.lang = v; refresh(true); layout(); }),
    h("div", { class: "sep" }),
    h("button", { class: "iconbtn", type: "button", id: "undo", "aria-label": "Отменить (Cmd+Z)", title: "Отменить (Cmd+Z)", disabled: !app.store.canUndo, onclick: () => app.store.undo() }, icon("undo")),
    h("button", { class: "iconbtn", type: "button", id: "redo", "aria-label": "Повторить (Shift+Cmd+Z)", title: "Повторить (Shift+Cmd+Z)", disabled: !app.store.canRedo, onclick: () => app.store.redo() }, icon("redo")),
    h("button", { class: "iconbtn", type: "button", "aria-label": "История версий", title: "История версий", onclick: history }, icon("history")),
    h("button", { class: "iconbtn", type: "button", "aria-label": "Сбросить изменения", title: "Сбросить изменения", onclick: resetAll }, icon("reset")),
    h("div", { class: "sep" }),
    h("button", { class: "btn primary pub", type: "button", id: "publish", onclick: publish }, "Опубликовать", h("span", { class: "badge", id: "count" })),
    h("button", { class: "iconbtn", type: "button", "aria-label": "Выйти", title: "Выйти (" + (app.user ? app.user.login : "") + ")", onclick: logout }, icon("logout")));
  const frameW = DEVICES[s.device];
  if (!app.frame) {
    app.frame = h("iframe", { src: "/admin/preview.html", title: "Предпросмотр сайта", class: "frame" });
    app.frame.addEventListener("load", () => { app.frameReady = false; });
  }
  const stage = h("main", { class: "stage", id: "stage" }, s.view === "works" ? worksView() : null, h("div", { class: "frame-wrap" + (s.view === "works" ? " hidden" : ""), style: { "--fw": frameW + "px" } }, app.frame));
  const root = $("#app");
  const tabs = mob ? h("nav", { class: "mtabs", "aria-label": "Разделы кабинета" }, TABS.map(([v, label, ic]) =>
    h("button", { type: "button", "data-tab": v, "aria-current": s.tab === v ? "page" : null, onclick: () => setTab(v) }, icon(ic), h("span", null, label)))) : null;
  root.replaceChildren(h("div", { class: "shell" + (mob ? " mob" : ""), "data-tab": mob ? s.tab : null }, bar, h("aside", { class: "tree", id: "tree", "aria-label": "Страницы и блоки" }), stage,
    h("aside", { class: "insp", id: "insp", "aria-label": "Свойства" }), tabs));
  renderTree(); renderInspector(); updateBar(); fitFrame();
  if (app.frameReady) refresh(true);
}
function fitFrame() {
  const st = $("#stage"), wrap = st && st.querySelector(".frame-wrap");
  if (!wrap) return;
  if (isMob()) { // на телефоне предпросмотр — настоящая ширина экрана, без уменьшения
    wrap.style.setProperty("--k", 1);
    app.frame.style.width = "100%";
    app.frame.style.height = "100%";
    return;
  }
  const w = DEVICES[app.state.device], avail = st.clientWidth - 24, k = Math.min(1, avail / w);
  wrap.style.setProperty("--k", k);
  app.frame.style.width = w + "px";
  app.frame.style.height = Math.max(400, (st.clientHeight - 24) / k) + "px";
}
addEventListener("resize", () => fitFrame());
if (MOBILE) MOBILE.addEventListener("change", () => { if (app.gh) layout(); });

/* ---------- телефон: вкладки, заголовок, меню ---------- */
function setTab(tab) {
  const s = app.state;
  s.tab = tab;
  const sh = $(".shell");
  if (!sh || !sh.classList.contains("mob")) return;
  sh.setAttribute("data-tab", tab);
  $$(".mtabs button").forEach((b) => { if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  const t = $("#mtitle"); if (t) t.textContent = mobileTitle();
  if (tab === "view") fitFrame();
}
function mobileTitle() {
  const s = app.state;
  if (s.tab === "edit") {
    if (s.sel.kind === "theme") return "Тема";
    if (s.sel.kind === "site") return "Сайт";
    if (s.sel.kind === "series") return "Серии";
    if (s.sel.kind === "work" || s.sel.kind === "works") return "Работы";
  }
  if (s.view === "works" && s.tab === "view") return "Работы";
  const p = app.store.files["content/pages/" + s.page + ".json"]; // без сборки всей модели — вызывается на каждую правку
  return p ? (p.title && p.title.ru) || s.page : "Кабинет";
}
function mobileMenu() {
  const s = app.state;
  const seg = (items, cur, fn) => h("div", { class: "seg wrap" }, items.map(([v, l]) => h("button", { type: "button", class: cur === v ? "on" : "", "aria-pressed": String(cur === v), onclick: () => { m.close(); fn(v); } }, l)));
  const item = (ic, label, fn) => h("button", { type: "button", class: "ti", onclick: () => { m.close(); fn(); } }, icon(ic), h("span", { class: "tl" }, label));
  const m = modal("Кабинет", h("div", { class: "msheet" },
    h("div", { class: "fld-l" }, "Предпросмотр"),
    seg([["dark", "Тёмная тема"], ["light", "Светлая тема"]], s.theme, (v) => { s.theme = v; post({ type: "theme", theme: v }); refresh(true); }),
    seg([["ru", "Русский"], ["en", "English"]], s.lang, (v) => { s.lang = v; refresh(true); }),
    h("div", { class: "fld-l" }, "Правки"),
    item("redo", "Повторить отменённое", () => app.store.redo()),
    item("history", "История версий", history),
    item("reset", "Сбросить все изменения", resetAll),
    h("div", { class: "fld-l" }, "Ещё"),
    h("a", { class: "ti", href: SITE_URL + (s.lang === "en" ? "en/" : "") + ((app.store.model().pages[s.page] || {}).path || ""), target: "_blank", rel: "noopener" }, icon("ext"), h("span", { class: "tl" }, "Открыть сайт")),
    item("logout", "Выйти" + (app.user ? " (" + app.user.login + ")" : ""), logout)), { cls: "sheet" });
}

function updateBar() {
  const n = app.store.changes().length;
  const c = $("#count"); if (c) { c.textContent = n ? String(n) : ""; c.hidden = !n; }
  const t = $("#mtitle"); if (t) t.textContent = mobileTitle();
  const u = $("#undo"), r = $("#redo");
  if (u) u.disabled = !app.store.canUndo;
  if (r) r.disabled = !app.store.canRedo;
}

/* ---------- дерево ---------- */
app.pageList = () => {
  const M = app.store.model();
  const order = (k) => { const i = CORE_PAGES.indexOf(k); return i === -1 ? 100 + (M.pages[k].program ? 0 : 50) : i; };
  return Object.keys(M.pages).sort((a, b) => order(a) - order(b) || a.localeCompare(b)).map((k) => ({ key: k, label: (M.pages[k].title && M.pages[k].title.ru) || k, page: M.pages[k] }));
};
function renderTree() {
  const t = $("#tree"); if (!t) return;
  const s = app.state, M = app.store.model();
  const item = (kind, label, ic, on, click, extra) => h("button", { type: "button", class: "ti" + (on ? " on" : ""), onclick: click, "aria-current": on ? "true" : null }, icon(ic), h("span", { class: "tl" }, label), extra || null);
  const pages = app.pageList();
  t.replaceChildren(...[
    h("div", { class: "tsec" }, "Весь сайт"),
    item("theme", "Тема: цвета, шрифты, фон", "theme", s.sel.kind === "theme", () => select({ kind: "theme" })),
    item("site", "Меню, подвал, почта, SEO", "site", s.sel.kind === "site", () => select({ kind: "site" })),
    item("works", "Работы", "works", s.sel.kind === "works" || s.sel.kind === "work", () => { s.view = "works"; s.page = "works"; select({ kind: "works" }); layout(); }, h("span", { class: "cnt" }, String(M.works.length))),
    item("series", "Серии", "series", s.sel.kind === "series", () => select({ kind: "series" })),
    h("div", { class: "tsec" }, "Страницы"),
    pages.map((p) => [
      item("page", p.label + (p.page.hidden ? " · скрыта" : ""), "page", s.page === p.key && s.sel.kind === "page", () => { s.view = "preview"; s.page = p.key; select({ kind: "page", page: p.key }); layout(); }),
      s.page === p.key ? blocksList(p.key) : null
    ]),
    h("button", { type: "button", class: "ti add", onclick: addPage }, icon("plus"), h("span", { class: "tl" }, "Новая страница"))].flat(Infinity).filter(Boolean));
}
function blocksList(key) {
  const M = app.store.model(), page = M.pages[key], s = app.state;
  const ul = h("ol", { class: "blocks", "aria-label": "Блоки страницы" });
  (page.blocks || []).forEach((b, i) => {
    const def = blockDef(b.type);
    const label = def.name + (b.data && b.data.title && b.data.title.ru ? " · " + b.data.title.ru : "");
    const li = h("li", { class: "bi" + (s.sel.kind === "block" && s.sel.bid === b.id ? " on" : "") + (b.hidden ? " off" : ""), draggable: "true", "data-i": i },
      h("span", { class: "grip", "aria-hidden": "true" }, icon("grip")),
      h("button", { type: "button", class: "bl", onclick: () => select({ kind: "block", page: key, bid: b.id }, true),
        onkeydown: (e) => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); app.store.moveBlock(key, i, i + (e.key === "ArrowUp" ? -1 : 1)); } } }, label),
      // на телефоне перетаскивать неудобно — кнопки «выше/ниже»
      h("button", { type: "button", class: "iconbtn sm mv", "aria-label": "Блок выше", disabled: i === 0, onclick: () => app.store.moveBlock(key, i, i - 1) }, icon("up")),
      h("button", { type: "button", class: "iconbtn sm mv", "aria-label": "Блок ниже", disabled: i === page.blocks.length - 1, onclick: () => app.store.moveBlock(key, i, i + 1) }, icon("down")),
      h("button", { type: "button", class: "iconbtn sm", "aria-label": b.hidden ? "Показать блок" : "Скрыть блок", title: b.hidden ? "Показать" : "Скрыть", onclick: () => toggleHidden(key, b.id) }, icon(b.hidden ? "eyeoff" : "eye")));
    li.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/av-block", String(i)); e.dataTransfer.effectAllowed = "move"; li.classList.add("drag"); });
    li.addEventListener("dragend", () => li.classList.remove("drag"));
    li.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/av-block")) { e.preventDefault(); li.classList.add("over"); } });
    li.addEventListener("dragleave", () => li.classList.remove("over"));
    li.addEventListener("drop", (e) => { e.preventDefault(); li.classList.remove("over"); const from = +e.dataTransfer.getData("text/av-block"); app.store.moveBlock(key, from, i); });
    ul.append(li);
  });
  if (!page.program) {
    const addable = Object.keys(BLOCKS).filter((k) => BLOCKS[k].addable);
    const sel = h("select", { class: "addsel", "aria-label": "Добавить блок", onchange: () => { if (!sel.value) return; const id = app.store.addBlock(key, newBlock(sel.value)); sel.value = ""; select({ kind: "block", page: key, bid: id }, true); } },
      h("option", { value: "" }, "+ Добавить блок…"), addable.map((k) => h("option", { value: k }, BLOCKS[k].name)));
    ul.append(h("li", { class: "bi addrow" }, sel));
  }
  return ul;
}
function toggleHidden(key, bid) {
  const f = "content/pages/" + key + ".json";
  const i = app.store.files[f].blocks.findIndex((b) => b.id === bid);
  app.store.set(f, "blocks." + i + ".hidden", !app.store.files[f].blocks[i].hidden, { coalesce: "", label: "Скрыть блок" });
}

function select(sel, scroll) {
  const s = app.state;
  s.sel = sel;
  if (sel.page) s.page = sel.page;
  if (sel.kind === "work" || sel.kind === "works") s.page = "works";
  if (sel.kind !== "works" && sel.kind !== "work" && s.view === "works") { s.view = "preview"; layout(); }
  renderTree(); renderInspector();
  if (sel.kind === "block") post({ type: "select", bid: sel.bid, scroll: !!scroll });
  else post({ type: "select", bid: "" });
  if (s.view === "preview") refresh(false);
  document.body.classList.remove("tree-open");
  document.body.classList.add("insp-open");
  if (isMob()) { setTab(sel.kind === "page" ? "pages" : sel.kind === "works" ? "view" : "edit"); if (s.tab === "edit") $("#insp").scrollTop = 0; }
}

/* ---------- инспектор ---------- */
app.renderInspector = () => renderInspector();
function renderInspector(focusPath) {
  const box = $("#insp"); if (!box) return;
  const s = app.state, M = app.store.model();
  const keep = box.scrollTop;
  let title = "", groups = [], tools = null;
  const contrastInk = (k, c) => { if (!c) return ""; const g = M.theme[s.theme].ground; const r = contrast(c, g); return r < 4.5 ? "Плохо читается на фоне темы: контраст " + r.toFixed(1) + " (нужно 4.5). Это предупреждение: сохранить можно." : ""; };
  if (s.sel.kind === "theme") {
    title = "Тема";
    const ctx = { app, file: "content/theme.json", base: "", obj: M.theme };
    const mode = s.theme;
    const issues = contrastIssues(M.theme);
    groups = renderGroups(ctx, THEME).concat([
      h("details", { class: "grp", open: true }, h("summary", null, "Цвета · " + (mode === "dark" ? "тёмная" : "светлая") + " тема"),
        h("p", { class: "hint" }, "Тему для правки цветов переключайте вверху (луна / солнце)."),
        issues.length ? h("div", { class: "warnbox" }, icon("warn"), h("div", null, "Плохо читается: ", issues.map((i) => (i.mode === "dark" ? "тёмная" : "светлая") + " — " + i.label.toLowerCase() + " (" + i.ratio + " из " + i.need + ")").join("; "), ". Сохранить можно, но лучше поправить.")) : null,
        h("div", { class: "grp-body" }, [...renderGroups(Object.assign({}, ctx, { base: mode + ".", contrastFor: paletteContrast(M.theme, mode) }), [{ title: "x", fields: PALETTE }])[0].querySelector(".grp-body").children]))
    ]);
  } else if (s.sel.kind === "site") {
    title = "Сайт";
    groups = renderGroups({ app, file: "content/site.json", base: "", obj: M.site }, SITE).concat([uiLabels(M)]);
  } else if (s.sel.kind === "page") {
    const p = M.pages[s.page]; if (!p) return;
    title = "Страница «" + ((p.title && p.title.ru) || s.page) + "»";
    groups = renderGroups({ app, file: "content/pages/" + s.page + ".json", base: "", obj: p, isHome: s.page === "home" }, PAGE);
    if (CORE_PAGES.indexOf(s.page) === -1 && !p.program) tools = h("button", { type: "button", class: "btn sm danger", onclick: () => deletePage(s.page) }, icon("trash"), "Удалить страницу");
  } else if (s.sel.kind === "block") {
    const file = "content/pages/" + s.page + ".json", page = app.store.files[file];
    const i = (page.blocks || []).findIndex((b) => b.id === s.sel.bid);
    if (i < 0) { s.sel = { kind: "page", page: s.page }; return renderInspector(); }
    const b = page.blocks[i], def = blockDef(b.type);
    title = def.name;
    const bctx = { app, file, base: "blocks." + i + ".", obj: b, contrastFor: contrastInk };
    let content;
    if (b.type.indexOf("program-") === 0) {
      const pf = "content/programs/" + page.program + ".json";
      const fields = def.content.map((f) => Object.assign({}, f, { k: f.k.replace(/^program\./, "") }));
      content = renderGroups({ app, file: pf, base: "", obj: app.store.files[pf] }, [{ title: "Содержимое", fields }]);
    } else content = renderGroups(bctx, [{ title: "Содержимое", fields: def.content }]);
    groups = content.concat(renderGroups(bctx, [{ title: "Раскладка", fields: def.layout || [] }, { title: "Стиль", fields: STYLE }], { closed: ["Стиль"] }));
    tools = h("div", { class: "row" },
      h("button", { type: "button", class: "btn sm", onclick: () => app.store.moveBlock(s.page, i, i - 1) }, icon("up"), "Выше"),
      h("button", { type: "button", class: "btn sm", onclick: () => app.store.moveBlock(s.page, i, i + 1) }, icon("down"), "Ниже"),
      h("button", { type: "button", class: "btn sm", onclick: () => toggleHidden(s.page, b.id) }, icon(b.hidden ? "eye" : "eyeoff"), b.hidden ? "Показать" : "Скрыть"),
      page.program ? null : h("button", { type: "button", class: "btn sm", onclick: () => { const id = app.store.duplicateBlock(s.page, b.id); select({ kind: "block", page: s.page, bid: id }, true); } }, icon("copy"), "Копия"),
      page.program ? null : h("button", { type: "button", class: "btn sm danger", onclick: async () => { if (await confirmBox("Удалить блок «" + def.name + "»?", "Его можно вернуть кнопкой «Отменить» или из истории версий.", "Удалить", true)) { app.store.removeBlock(s.page, b.id); select({ kind: "page", page: s.page }); } } }, icon("trash"), "Удалить"));
  } else if (s.sel.kind === "work") {
    const file = "content/works/" + s.sel.work + ".json", w = app.store.files[file];
    if (!w) { s.sel = { kind: "works" }; return renderInspector(); }
    title = (w.title && w.title.ru) || "Работа";
    groups = renderGroups({ app, file, base: "", obj: w }, WORK);
    const ids = M.works.map((x) => x.id), wi = ids.indexOf(s.sel.work);
    const shift = (d) => { const j = wi + d; if (wi < 0 || j < 0 || j >= ids.length) return; ids.splice(j, 0, ids.splice(wi, 1)[0]); app.store.reorderWorks(ids); renderInspector(); };
    tools = h("div", { class: "row" },
      h("button", { type: "button", class: "btn sm mv", disabled: wi <= 0, onclick: () => shift(-1) }, icon("up"), "Раньше"),
      h("button", { type: "button", class: "btn sm mv", disabled: wi < 0 || wi >= ids.length - 1, onclick: () => shift(1) }, icon("down"), "Позже"),
      h("button", { type: "button", class: "btn sm danger", onclick: () => deleteWork(s.sel.work) }, icon("trash"), "Удалить работу"));
  } else if (s.sel.kind === "works") {
    title = "Работы";
    groups = [h("p", { class: "note" }, "Перетаскивайте карточки, чтобы менять порядок. Чтобы добавить работы, перетащите файлы в сетку или нажмите «Загрузить». Нажмите на работу — справа появятся её название, описание, серия и кадр."),
      h("button", { type: "button", class: "btn", onclick: () => $("#upl") && $("#upl").click() }, icon("upload"), "Загрузить картинки")];
  } else if (s.sel.kind === "series") {
    title = "Серии";
    groups = [seriesEditor(M)];
  }
  box.replaceChildren(...[h("div", { class: "insp-head" }, h("h2", null, title), h("button", { type: "button", class: "iconbtn only-m", "aria-label": "Свернуть", onclick: () => document.body.classList.remove("insp-open") }, icon("down"))), tools ? h("div", { class: "insp-tools" }, tools) : null].concat(groups).filter(Boolean));
  box.scrollTop = keep;
  if (focusPath) {
    const el = box.querySelector('[data-k="' + CSS.escape(focusPath) + '"] input, [data-k="' + CSS.escape(focusPath) + '"] textarea, [data-k="' + CSS.escape(focusPath) + '"] button');
    // на телефоне без фокуса — иначе сразу выезжает клавиатура
    if (el) { el.closest("details") && (el.closest("details").open = true); el.scrollIntoView({ block: "center" }); if (!isMob()) el.focus({ preventScroll: true }); }
  }
}
function uiLabels(M) {
  const rows = Object.keys(UI.ru).map((k) => {
    const mk = (lang) => {
      const inp = h("input", { type: "text", placeholder: UI[lang][k], value: ((M.site.ui || {})[lang] || {})[k] || "", "aria-label": k + " (" + lang.toUpperCase() + ")", lang });
      inp.addEventListener("input", () => app.store.set("content/site.json", "ui." + lang + "." + k, inp.value));
      return inp;
    };
    return h("div", { class: "pair ui-row" }, h("div", null, h("span", { class: "lang-tag" }, "RU"), mk("ru")), h("div", null, h("span", { class: "lang-tag" }, "EN"), mk("en")));
  });
  return h("details", { class: "grp" }, h("summary", null, "Подписи кнопок и разделов"), h("p", { class: "hint" }, "Серым — текст по умолчанию; впишите своё, чтобы заменить."), h("div", { class: "grp-body" }, rows));
}
function seriesEditor(M) {
  const s = app.state;
  const wrap = h("div", { class: "grp-body" });
  M.series.forEach((x) => {
    const on = s.series === x.id;
    wrap.append(h("button", { type: "button", class: "ti" + (on ? " on" : ""), onclick: () => { s.series = x.id; renderInspector(); } }, icon("series"), h("span", { class: "tl" }, (x.title && x.title.ru) || x.id), h("span", { class: "cnt" }, String(M.works.filter((w) => w.series === x.id).length))));
    if (on) wrap.append(...renderGroups({ app, file: "content/series/" + x.id + ".json", base: "", obj: app.store.files["content/series/" + x.id + ".json"] }, SERIES));
  });
  wrap.append(h("button", { type: "button", class: "btn sm add", onclick: () => {
    const name = prompt("Название серии");
    if (!name) return;
    let id = fileSlug(name), n = 2;
    while (app.store.files["content/series/" + id + ".json"]) id = fileSlug(name) + "-" + n++;
    const f = "content/series/" + id + ".json";
    app.store.edit(f, (get, put) => put(f, { title: { ru: name, en: "" }, text: { ru: "", en: "" }, order: (M.series.length + 1) * 10, cover: "" }), { label: "Новая серия" });
    s.series = id; renderInspector();
  } }, icon("plus"), "Новая серия"));
  if (s.series) wrap.append(h("button", { type: "button", class: "btn sm danger", onclick: async () => {
    if (!(await confirmBox("Удалить серию?", "Работы останутся, просто без серии.", "Удалить", true))) return;
    const id = s.series, paths = ["content/series/" + id + ".json"].concat(M.works.filter((w) => w.series === id).map((w) => "content/works/" + w.id + ".json"));
    app.store.edit(paths, (get, put) => { put(paths[0], null); paths.slice(1).forEach((p) => { get(p).series = ""; }); }, { label: "Удалена серия" });
    s.series = ""; renderInspector();
  } }, icon("trash"), "Удалить эту серию"));
  return h("details", { class: "grp", open: true }, h("summary", null, "Серии"), wrap);
}

/* ---------- картинки в инспекторе ---------- */
app.swatches = () => {
  const M = app.store.model(), p = M.theme[app.state.theme] || {};
  return [...new Set([p.ground, p.surface, p.ink, p.muted, p.accent, p.accentInk, p.gold, p.focus, "#1B1A19", "#F4F1EA", "#B11226", "#8E3BB5", "#E9E2D2", "#2EC4B6"].filter(Boolean))];
};
/* пропорция места для картинки «как у блока» */
function slotFor(path) {
  const phone = app.state.device === "phone";
  if (/\.items\.\d+\.image$/.test(path)) return phone ? 3 / 2 : 4 / 5;
  if (/data\.image$/.test(path) && /blocks\.\d+\.data\.image$/.test(path)) return 4 / 5;
  if (/seo\.og$/.test(path)) return 1200 / 630;
  return null;
}
app.imageControl = (file, path, f) => {
  const ref = getAt(app.store.files[file], path);
  const set = (v) => app.store.set(file, path, v, { coalesce: "", label: "Картинка" });
  const thumb = h("div", { class: "thumb" });
  let tries = 0;
  const paint = () => {
    thumb.replaceChildren();
    if (!ref || !ref.src) { thumb.append(h("span", { class: "muted" }, "Нет картинки")); return; }
    const r = app.media.get(ref);
    thumb.append(h("img", { src: r ? r.src : app.media.placeholder().src, alt: "" }));
    if (!r && ++tries < 60) setTimeout(() => { if (thumb.isConnected) paint(); }, 600);
  };
  paint();
  const file$ = h("input", { type: "file", accept: ACCEPT, hidden: true, onchange: async () => {
    const fl = file$.files[0]; if (!fl) return;
    const bar = busy("Готовлю фото…");
    try {
      const up = await prepareUpload(fl);
      bar.done();
      const p = "media/uploads/" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + fileSlug(fl.name) + "-" + Math.random().toString(36).slice(2, 6) + "." + up.ext;
      app.store.addUpload(p, up.bytes, up.type);
      uploadsDb.put(p, { bytes: up.bytes, type: up.type });
      set({ src: p, crop: null, focal: { x: 0.5, y: 0.5 }, fit: (ref && ref.fit) || "fill", aspect: (ref && ref.aspect) || (f.aspect ? f.aspect : "auto") });
      renderInspector();
    } catch (e) { bar.done(); toast(e.message, "err", 8000); }
    file$.value = "";
  } });
  const btns = h("div", { class: "row wrap" },
    h("button", { type: "button", class: "btn sm", onclick: () => file$.click() }, icon("upload"), ref ? "Заменить…" : "Выбрать файл…"),
    h("button", { type: "button", class: "btn sm", onclick: () => pickWork((src) => { set({ src, crop: null, focal: { x: 0.5, y: 0.5 }, fit: (ref && ref.fit) || "fill", aspect: (ref && ref.aspect) || "auto" }); renderInspector(); }) }, icon("works"), "Из работ…"),
    ref ? h("button", { type: "button", class: "btn sm", onclick: async () => {
      try { const r = await openCropper(app.media, ref, { slotRatio: slotFor(path) }); if (r) { set(r); renderInspector(); } } catch (e) { toast("Не открылась картинка: " + e.message, "err"); }
    } }, icon("crop"), "Кадр…") : null,
    ref && f.optional ? h("button", { type: "button", class: "btn sm", onclick: () => { set(null); renderInspector(); } }, "Убрать") : null, file$);
  const quick = ref ? h("div", { class: "seg" }, [["fill", "Заполнить"], ["fit", "Вписать целиком"]].map(([v, l]) => h("button", { type: "button", class: ref.fit === v || (!ref.fit && v === "fill") ? "on" : "", onclick: () => { set(Object.assign({}, ref, { fit: v })); renderInspector(); } }, l))) : null;
  return h("div", { class: "imgc" }, thumb, btns, quick);
};
function pickWork(cb) {
  const M = app.store.model();
  const grid = h("div", { class: "pick" }, M.works.map((w) => {
    const r = app.media.get(w.image);
    return h("button", { type: "button", title: (w.title && w.title.ru) || "", onclick: () => { m.close(); cb(w.image.src); } }, h("img", { src: r ? r.src : app.media.placeholder().src, alt: (w.title && w.title.ru) || "", loading: "lazy" }));
  }));
  const m = modal("Выбрать из работ", grid, { cls: "wide" });
}

/* ---------- работы: сетка ---------- */
function worksView() {
  const M = app.store.model(), s = app.state;
  const upl = h("input", { type: "file", id: "upl", accept: ACCEPT, multiple: true, hidden: true, onchange: () => uploadWorks([...upl.files]) });
  const grid = h("ul", { class: "wgrid", "aria-label": "Работы" });
  M.works.forEach((w, i) => {
    const r = app.media.get(w.image);
    const li = h("li", { class: "wi" + (s.sel.kind === "work" && s.sel.work === w.id ? " on" : "") + (w.hidden ? " off" : ""), draggable: "true", "data-id": w.id },
      h("button", { type: "button", class: "wb", onclick: () => select({ kind: "work", work: w.id }) },
        h("img", { src: r ? r.src : app.media.placeholder().src, alt: (w.title && w.title.ru) || "", loading: "lazy" }),
        h("span", { class: "wt" }, (w.featured ? "★ " : "") + ((w.title && w.title.ru) || "Без названия")),
        w.hidden ? h("span", { class: "wf" }, "скрыта") : null));
    li.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/av-work", w.id); li.classList.add("drag"); });
    li.addEventListener("dragend", () => li.classList.remove("drag"));
    li.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/av-work")) { e.preventDefault(); li.classList.add("over"); } });
    li.addEventListener("dragleave", () => li.classList.remove("over"));
    li.addEventListener("drop", (e) => {
      e.preventDefault(); li.classList.remove("over");
      const id = e.dataTransfer.getData("text/av-work"); if (!id || id === w.id) return;
      const ids = M.works.map((x) => x.id).filter((x) => x !== id);
      ids.splice(ids.indexOf(w.id), 0, id);
      app.store.reorderWorks(ids);
    });
    grid.append(li);
  });
  const zone = h("div", { class: "works-wrap" },
    h("div", { class: "works-bar" }, h("h2", null, "Работы · " + M.works.length), h("button", { type: "button", class: "btn sm", onclick: () => upl.click() }, icon("upload"), "Загрузить"), h("button", { type: "button", class: "btn sm", onclick: () => { s.view = "preview"; layout(); } }, icon("eye"), "Как на сайте"), upl),
    h("p", { class: "hint" }, "Перетаскивайте карточки, чтобы менять порядок. Файлы можно бросить прямо сюда."), grid);
  zone.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); zone.classList.add("drop"); } });
  zone.addEventListener("dragleave", (e) => { if (e.target === zone) zone.classList.remove("drop"); });
  zone.addEventListener("drop", (e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); zone.classList.remove("drop"); uploadWorks([...e.dataTransfer.files].filter((f) => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))); });
  return zone;
}
async function uploadWorks(files) {
  if (!files.length) return;
  const M = app.store.model();
  let order = Math.min(0, ...M.works.map((w) => Number(w.order) || 0)) - 10;
  let ok = 0, n = 0;
  const bar = busy("Готовлю фото…");
  for (const fl of files) {
    bar.set(++n, files.length, "Готовлю фото " + n + " из " + files.length + "…");
    try {
      const up = await prepareUpload(fl);
      const id = "w" + uid("").replace(/^-/, "");
      const src = "media/works/" + id + "." + up.ext;
      app.store.addUpload(src, up.bytes, up.type);
      uploadsDb.put(src, { bytes: up.bytes, type: up.type });
      const f = "content/works/" + id + ".json";
      const name = fl.name.replace(/\.[^.]+$/, "");
      const title = /^[0-9A-F]{8}[ _-][0-9A-F]{4}/i.test(name) || /^(IMG|DSC|PXL)[ _-]?\d/i.test(name) ? "" : name.replace(/[_-]+/g, " ").slice(0, 60);
      app.store.edit(f, (get, put) => put(f, { image: { src, crop: null, focal: { x: 0.5, y: 0.5 }, fit: "fill", aspect: "auto" }, title: { ru: title, en: "" }, alt: { ru: "", en: "" }, series: "", order: order, featured: false, hidden: false }), { label: "Новая работа" });
      order -= 10; ok++;
    } catch (e) { toast(fl.name + ": " + e.message, "err", 8000); }
  }
  bar.done();
  if (ok) toast("Добавлено работ: " + ok + ". Впишите названия и описания — и «Опубликовать».", "ok");
  layout();
}
async function deleteWork(id) {
  if (!(await confirmBox("Удалить работу с сайта?", "Файл останется в истории репозитория — работу можно вернуть из «Истории версий».", "Удалить", true))) return;
  const M = app.store.model();
  const paths = ["content/works/" + id + ".json"].concat(M.series.filter((x) => x.cover === id).map((x) => "content/series/" + x.id + ".json"));
  app.store.edit(paths, (get, put) => { put(paths[0], null); paths.slice(1).forEach((p) => { get(p).cover = ""; }); }, { label: "Удалена работа" });
  select({ kind: "works" });
  layout();
}

/* ---------- страницы ---------- */
async function addPage() {
  const name = prompt("Название новой страницы (например «Проекты»)");
  if (!name) return;
  let key = fileSlug(name), n = 2;
  while (app.store.files["content/pages/" + key + ".json"]) key = fileSlug(name) + "-" + n++;
  const f = "content/pages/" + key + ".json";
  const head = newBlock("page-head"); head.id = uid(); head.data.title = { ru: name, en: "" };
  const text = newBlock("text"); text.id = uid();
  app.store.edit([f, "content/site.json"], (get, put) => {
    put(f, { path: key + "/", title: { ru: name, en: "" }, gem: "ruby", hidden: false, seo: { title: { ru: "", en: "" }, description: { ru: "", en: "" }, og: null }, blocks: [head, text] });
    get("content/site.json").nav.push({ page: key, label: { ru: "", en: "" }, hidden: false });
  }, { label: "Новая страница" });
  app.state.page = key;
  select({ kind: "page", page: key });
  layout();
}
async function deletePage(key) {
  if (!(await confirmBox("Удалить страницу?", "Её пункт меню тоже исчезнет. Вернуть можно кнопкой «Отменить» или из истории.", "Удалить", true))) return;
  const f = "content/pages/" + key + ".json";
  app.store.edit([f, "content/site.json"], (get, put) => { put(f, null); const s = get("content/site.json"); s.nav = s.nav.filter((n) => n.page !== key); }, { label: "Удалена страница" });
  app.state.page = "home";
  select({ kind: "page", page: "home" });
  layout();
}

/* полоска хода работы (подготовка фото, отправка в GitHub) */
function busy(text) {
  const label = h("span", null, text), bar = h("progress", { max: 1 });
  const el = h("div", { class: "busy", role: "status", "aria-live": "polite" }, label, bar);
  document.body.append(el);
  return {
    set(i, n, t) { bar.max = n; bar.value = i; if (t) label.textContent = t; },
    done() { el.remove(); }
  };
}

/* ---------- предпросмотр ---------- */
function post(m) { if (app.frame && app.frame.contentWindow) app.frame.contentWindow.postMessage(m, location.origin); }
function env() {
  const s = app.state;
  return {
    edit: true, css: "", js: "", url: SITE_URL, year: new Date().getFullYear(), theme: s.theme,
    img: (ref) => {
      if (!ref || !ref.src) return null;
      const r = app.media.get(ref) || app.media.placeholder();
      return { src: r.src, w: r.w, h: r.h, pos: CM.objectPosition(ref.focal), fit: ref.fit, aspect: ref.aspect && ref.aspect !== "auto" && r.w > 4 ? r.w / r.h : null };
    },
    rel: (slug) => app.releases[slug], og: () => "", ogFor: () => ""
  };
}
function themeForPreview(M) {
  const bg = M.theme.background || {};
  const r = bg.kind === "image" && bg.image ? app.media.get(bg.image) : null;
  return Object.assign({}, M.theme, { background: Object.assign({}, bg, { imageUrl: r ? r.src : "" }) });
}
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(false); }); }
function refresh(full) {
  if (!app.frameReady) return;
  const t0 = performance.now();
  const M = app.store.model(), s = app.state;
  if (!M.pages[s.page]) s.page = "home";
  const css = themeCss(themeForPreview(M));
  if (css !== app.last.css) { post({ type: "css", css }); app.last.css = css; }
  const page = M.pages[s.page];
  const e = env();
  const order = (page.blocks || []).map((b) => b.id + (b.hidden ? "~" : "")).join("|") + "|" + s.page + s.lang + s.theme;
  const chrome = JSON.stringify(M.site) + JSON.stringify(page.seo || {}) + (page.gem || "");
  if (full || order !== app.last.order || chrome !== app.last.chrome) {
    post({ type: "page", html: renderPage(M, s.page, s.lang, e) });
    app.last.blocks = new Map((page.blocks || []).map((b) => [b.id, renderBlock(M, s.page, s.lang, e, b.id)]));
    app.last.order = order; app.last.chrome = chrome;
    if (s.sel.kind === "block") post({ type: "select", bid: s.sel.bid });
  } else {
    for (const b of page.blocks || []) {
      const html = renderBlock(M, s.page, s.lang, e, b.id);
      if (html !== app.last.blocks.get(b.id)) { post({ type: "block", bid: b.id, html }); app.last.blocks.set(b.id, html); }
    }
  }
  app.lastRenderMs = performance.now() - t0;
}
addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data || e.source !== (app.frame && app.frame.contentWindow)) return;
  const m = e.data;
  if (m.type === "ready") { app.frameReady = true; app.last = { css: "", order: "", blocks: new Map(), chrome: "" }; refresh(true); }
  if (m.type === "key") { if (m.key === "undo") app.store.undo(); else app.store.redo(); }
  if (m.type === "pick") {
    if (m.work) { app.state.view = "preview"; select({ kind: "work", work: m.work }); return; }
    if (m.bid === "@footer") { select({ kind: "site" }); return; }
    if (!m.bid) return;
    select({ kind: "block", page: app.state.page, bid: m.bid });
    if (m.field) {
      const page = app.store.files["content/pages/" + app.state.page + ".json"];
      const i = page.blocks.findIndex((b) => b.id === m.bid);
      const p = m.field.indexOf("program.") === 0 ? m.field.slice(8) : "blocks." + i + "." + m.field;
      renderInspector(p.replace(/\.(image|imageEn)$/, ".$1"));
    }
  }
});

/* ---------- изменения: предпросмотр, кнопки, автосохранение ---------- */
let saveT = 0;
function onStoreEvent(e) {
  updateBar();
  if (e.kind !== "edit" || /Порядок|Новый блок|Удал|Копия|Скрыть|Новая|Черновик/.test(e.label || "")) { renderTree(); }
  if (e.kind === "undo" || e.kind === "redo" || e.kind === "reset" || e.kind === "restore") renderInspector();
  if (app.state.view === "works" && e.paths && e.paths.some((p) => p.startsWith("content/works/"))) { const st = $("#stage .works-wrap"); if (st) st.replaceWith(worksView()); }
  schedule();
  clearTimeout(saveT);
  saveT = setTimeout(autosave, 700);
}
function autosave() {
  try {
    const snap = app.store.snapshot();
    if (!Object.keys(snap.changed).length && !snap.uploads.length) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(snap));
  } catch (e) { /* место кончилось — черновик живёт до закрытия вкладки */ }
}
async function offerDraft() {
  let snap = null;
  try { snap = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { snap = null; }
  if (!snap || (!Object.keys(snap.changed || {}).length && !(snap.uploads || []).length)) return;
  const when = new Date(snap.at).toLocaleString("ru-RU");
  const bar = h("div", { class: "draftbar", role: "alert" }, "На этом устройстве есть неопубликованный черновик от " + when + ".",
    h("button", { type: "button", class: "btn sm primary", onclick: async () => {
      if (snap.base && snap.base !== app.store.base) {
        let clash = [];
        try { const theirs = await app.gh.changedBetween(snap.base, app.store.base); clash = Object.keys(snap.changed || {}).filter((p) => theirs.has(p)); } catch (e) { clash = Object.keys(snap.changed || {}); }
        if (clash.length && !(await confirmBox("Черновик устарел", "После него на сайте уже изменили: " + clash.slice(0, 6).map((p) => p.replace(/^content\//, "")).join(", ") + ". Если восстановить черновик, эти изменения в нём заменятся старыми.", "Всё равно восстановить", true))) return;
      }
      const ups = {};
      for (const p of snap.uploads || []) { const v = await uploadsDb.get(p); if (v) ups[p] = v; }
      app.store.restore(snap, ups); bar.remove(); toast("Черновик восстановлен", "ok");
    } }, "Восстановить"),
    h("button", { type: "button", class: "btn sm", onclick: () => { localStorage.removeItem(DRAFT_KEY); bar.remove(); } }, "Отбросить"));
  document.body.append(bar);
}
addEventListener("beforeunload", (e) => { if (app.store.dirty) { e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("keydown", (e) => {
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !inField) { e.preventDefault(); if (e.shiftKey) app.store.redo(); else app.store.undo(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); publish(); }
});

async function resetAll() {
  if (!app.store.dirty) { toast("Изменений нет"); return; }
  if (!(await confirmBox("Сбросить все изменения?", "Черновик вернётся к опубликованной версии. Это тоже можно отменить кнопкой «Отменить».", "Сбросить", true))) return;
  app.store.reset();
  layout();
}
async function logout() {
  if (app.store.dirty && !(await confirmBox("Выйти?", "Неопубликованный черновик останется на этом устройстве.", "Выйти"))) return;
  forgetToken();
  location.reload();
}

/* ---------- история ---------- */
async function history() {
  const list = h("ol", { class: "hist" }, h("li", { class: "muted" }, "Загружаю…"));
  const m = modal("История версий", h("div", null, h("p", { class: "hint" }, "Каждая публикация — версия. «Вернуть» загружает её в черновик: проверьте и нажмите «Опубликовать»."), list), { cls: "wide" });
  try {
    const items = await app.gh.history(40);
    list.replaceChildren(...items.map((c) => h("li", null, h("div", null, h("b", null, new Date(c.date).toLocaleString("ru-RU")), " · ", c.message, h("span", { class: "muted" }, " · " + c.author)),
      h("button", { type: "button", class: "btn sm", onclick: async () => { m.close(); await restoreVersion(c); } }, "Вернуть эту версию"))));
  } catch (e) { list.replaceChildren(h("li", { class: "err" }, e.message)); }
}
async function restoreVersion(c) {
  try {
    toast("Загружаю версию…");
    const [old, cur] = await Promise.all([app.gh.contentShas(c.sha), app.gh.contentShas(app.store.base)]);
    if (!old["content/theme.json"]) throw new Error("эта версия сделана до нового редактора, в другом формате — вернуть её отсюда нельзя.");
    const paths = [...new Set(Object.keys(old).concat(Object.keys(cur)))].filter((p) => old[p] !== cur[p]);
    const texts = {};
    for (const p of paths) if (old[p]) texts[p] = await app.gh.blobText(old[p]);
    app.store.edit(paths, (get, put) => { for (const p of paths) put(p, texts[p] ? JSON.parse(texts[p]) : null); }, { label: "Черновик" });
    toast("Версия от " + new Date(c.date).toLocaleString("ru-RU") + " загружена в черновик. Проверьте и нажмите «Опубликовать».", "ok", 8000);
    layout();
  } catch (e) { toast("Не получилось: " + e.message, "err", 8000); }
}

/* ---------- публикация ---------- */
const STAGES = [["send", "Отправляю изменения"], ["build", "GitHub собирает сайт"], ["check", "Проверка и тесты"], ["deploy", "Выкладываю"], ["live", "На сайте"]];
let publishing = false;
async function publish() {
  if (publishing) return;
  publishing = true;
  try { await publishNow(); } finally { publishing = false; }
}
async function publishNow() {
  const M = app.store.model();
  const exists = (p) => !!(app.tree[p] || app.store.uploads[p]);
  const errs = validate(M, { exists });
  if (errs.length) {
    modal("Сначала поправьте", h("div", null, h("p", null, "В черновике есть ошибки — с ними сайт не соберётся. На сайте пока остаётся прошлая версия."), h("ul", { class: "errs" }, errs.slice(0, 20).map((x) => h("li", null, x.message)))));
    return;
  }
  const changes = app.store.changes();
  if (!changes.length) { toast("Изменений нет — публиковать нечего."); return; }
  const names = [...new Set(changes.map((c) => c.path.replace(/^content\//, "").replace(/\.json$/, "").replace(/^pages\//, "стр. ").replace(/^works\/.*/, "работы").replace(/^media\/.*/, "картинки")))];
  const message = "Редактор: " + names.slice(0, 6).join(", ") + (names.length > 6 ? " и ещё " + (names.length - 6) : "");
  const btn = $("#publish"); if (btn) btn.disabled = true;
  const steps = h("ol", { class: "stages" }, STAGES.map(([k, l]) => h("li", { "data-s": k }, h("i"), l)));
  const note = h("p", { class: "muted" }, "");
  const bar = h("progress", { max: 1, value: 0, hidden: true, class: "pubbar" });
  const card = h("div", { class: "pubcard", role: "status", "aria-live": "polite" }, h("div", { class: "row" }, h("b", null, "Публикация"), h("div", { class: "grow" }), h("button", { type: "button", class: "iconbtn sm", "aria-label": "Скрыть", onclick: () => card.remove() }, icon("close"))), steps, bar, note);
  document.body.append(card);
  const mark = (k, state) => { const li = steps.querySelector('[data-s="' + k + '"]'); if (li) li.className = state; };
  mark("send", "run");
  let sha;
  try {
    const pics = changes.filter((c) => c.bytes).length;
    sha = await app.gh.commit(changes, message, app.store.base, (st, i, n) => {
      if (st === "blob" && pics) { bar.hidden = false; bar.max = n; bar.value = i; note.textContent = "Отправляю файлы: " + i + " из " + n + " (картинок — " + pics + ")"; }
    });
    bar.hidden = true;
  } catch (e) {
    bar.hidden = true;
    mark("send", "fail"); note.textContent = e.message + " Ничего не изменилось."; note.className = "err";
    if (btn) btn.disabled = false;
    return;
  }
  // загруженные файлы теперь в репозитории; байты остаются здесь, пока страницу не перезагрузят
  for (const c of changes) if (c.bytes) { app.tree[c.path] = { sha: "", size: c.bytes.length, bytes: c.bytes }; uploadsDb.del(c.path); }
  app.store.committed(sha, changes);
  autosave();
  if (btn) btn.disabled = false;
  publishing = false;
  mark("send", "done"); mark("build", "run");
  note.textContent = "Изменения сохранены в GitHub. Обычно сайт обновляется за 1–2 минуты.";
  const finished = () => {
    STAGES.forEach(([k]) => mark(k, "done"));
    note.replaceChildren("Готово — сайт обновлён. ", h("a", { href: SITE_URL + (app.state.lang === "en" ? "en/" : "") + ((app.store.model().pages[app.state.page] || {}).path || ""), target: "_blank", rel: "noopener" }, "Открыть сайт ↗"));
    note.className = "ok";
    if (!card.isConnected) toast("Готово — сайт обновлён.", "ok");
  };
  const t0 = Date.now();
  while (Date.now() - t0 < 8 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 4000));
    let run = null;
    try { run = await app.gh.runFor(sha); } catch (e) { run = null; }
    if (run && run.steps && run.steps.length) {
      const st = (n) => run.steps.find((x) => x.name.indexOf(n) === 0);
      const done = (x) => x && x.status === "completed" && x.conclusion === "success";
      const failed = run.steps.find((x) => x.conclusion === "failure");
      if (done(st("Сборка"))) { mark("build", "done"); mark("check", "run"); }
      if (done(st("Тесты"))) { mark("check", "done"); mark("deploy", "run"); }
      if (done(st("Публикация"))) mark("deploy", "done");
      if (failed || run.conclusion === "failure") {
        const k = /Сборка/.test((failed || {}).name || "") ? "build" : /Проверка|Тесты/.test((failed || {}).name || "") ? "check" : "deploy";
        mark(k, "fail");
        note.replaceChildren("Не получилось на шаге «" + ((failed || {}).name || "сборка") + "». Сайт не изменился — на нём прежняя версия. ", h("a", { href: run.url, target: "_blank", rel: "noopener" }, "Подробности на GitHub ↗"));
        note.className = "err";
        return;
      }
    }
    if (run && run.status === "completed" && run.conclusion === "success") { finished(); return; }
    try {
      const j = await fetch("/build.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
      if (j.source === sha) { finished(); return; }
    } catch (e) { /* ещё нет */ }
  }
  note.textContent = "GitHub ещё не закончил. Изменения сохранены — загляните на сайт через пару минут.";
}

/* ---------- старт ---------- */
(async function boot() {
  try { app.config = await fetch("/admin/config.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})); } catch (e) { app.config = {}; }
  const t = tokenStored();
  if (!t) { loginView(); return; }
  $("#app").replaceChildren(h("div", { class: "boot" }, "Загружаю сайт из GitHub…"));
  try { await start(t); } catch (e) {
    if (e instanceof GhError && (e.kind === "auth" || e.kind === "norepo" || e.kind === "readonly")) forgetToken();
    loginView(e.message);
  }
})();
