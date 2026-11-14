/*
  Правая панель: поля по описаниям из fields.mjs. Каждое изменение — store.set(файл, путь, значение),
  поэтому всё отменяется Cmd+Z и сразу видно в предпросмотре.
*/
import { h, icon, toast } from "./ui.mjs";
import { getAt } from "./store.mjs";
import { contrast } from "./shared/theme.mjs";
import { FONTS } from "./shared/fonts.mjs";
import { GEMS } from "./fields.mjs";

const GEM_HEX = { ruby: "#B11226", amethyst: "#8E3BB5", diamond: "#E9E2D2", sapphire: "#2F5FD0", emerald: "#1F9E6B", topaz: "#D08A1E", aquamarine: "#2EC4B6", tourmaline: "#C2365F" };
let seq = 0;
const nid = () => "f" + (++seq);

/*
  ctx: { app, file (путь файла), base (префикс пути внутри файла, например "blocks.2." или ""), obj (объект для условий when) }
  groups: [{ title, fields }]
*/
export function renderGroups(ctx, groups, opt = {}) {
  return groups.map((g) => {
    const body = h("div", { class: "grp-body" }, g.fields.map((f) => field(ctx, f)).filter(Boolean));
    if (!body.childNodes.length) return null;
    return h("details", { class: "grp", open: opt.closed && opt.closed.indexOf(g.title) !== -1 ? null : true }, h("summary", null, g.title), body);
  }).filter(Boolean);
}

export function field(ctx, f) {
  const { app } = ctx;
  if (f.when && !f.when(ctx.obj || {})) return null;
  if (f.noHome && ctx.isHome) return null;
  if (f.t === "note") return h("p", { class: "note" }, f.text);
  const path = ctx.base + f.k;
  const get = () => getAt(app.store.files[ctx.file], path);
  const set = (v, opt) => app.store.set(ctx.file, path, v, opt);
  const id = nid();
  const wrap = (control, extra) => h("div", { class: "fld fld-" + f.t, "data-k": path }, h("label", { for: id, class: "fld-l" }, f.label), control, f.hint ? h("p", { class: "hint" }, f.hint) : null, extra || null);
  const rerender = () => app.renderInspector();

  if (f.t === "text" || f.t === "area") {
    const mk = (lang) => {
      const v = get();
      const val = f.i18n ? (v && typeof v === "object" ? v[lang] : lang === "ru" ? v : "") : v;
      const attrs = { id: lang === "ru" ? id : id + "-en", lang, placeholder: f.ph || "", "aria-label": f.label + (f.i18n ? " (" + lang.toUpperCase() + ")" : "") };
      const el = f.t === "area" ? h("textarea", Object.assign(attrs, { rows: f.rows || 3 })) : h("input", Object.assign(attrs, { type: "text" }));
      el.value = val == null ? "" : val;
      el.addEventListener("input", () => {
        if (!f.i18n) { set(el.value); return; }
        const cur = get();
        const o = cur && typeof cur === "object" ? Object.assign({}, cur) : { ru: typeof cur === "string" ? cur : "", en: "" };
        o[lang] = el.value;
        set(o);
      });
      return el;
    };
    if (!f.i18n) return wrap(mk("ru"));
    const ru = mk("ru"), en = mk("en");
    const copy = h("button", { class: "mini", type: "button", title: "Скопировать русский текст в английское поле как черновик перевода", onclick: () => {
      const cur = get() || {};
      if (cur.en && cur.en.trim() && !confirm("Заменить английский текст русским?")) return;
      set(Object.assign({}, cur, { en: cur.ru || "" }), { coalesce: "" });
      en.value = cur.ru || "";
    } }, "RU → EN");
    return h("div", { class: "fld fld-i18n", "data-k": path }, h("div", { class: "fld-head" }, h("label", { for: id, class: "fld-l" }, f.label), copy),
      h("div", { class: "pair" }, h("div", null, h("span", { class: "lang-tag" }, "RU"), ru), h("div", null, h("span", { class: "lang-tag" }, "EN"), en)), f.hint ? h("p", { class: "hint" }, f.hint) : null);
  }

  if (f.t === "num") {
    const v = get();
    const range = h("input", { type: "range", id, min: f.min, max: f.max, step: f.step || 1, value: v == null ? (f.min + f.max) / 2 : v });
    const num = h("input", { type: "number", min: f.min, max: f.max, step: f.step || 1, value: v == null ? "" : v, "aria-label": f.label, class: "num" });
    const apply = (x) => { x = Math.max(f.min, Math.min(f.max, Number(x))); if (!isFinite(x)) return; range.value = x; num.value = x; set(x); };
    range.addEventListener("input", () => apply(range.value));
    num.addEventListener("change", () => apply(num.value));
    return wrap(h("div", { class: "rng" }, range, num, f.unit ? h("span", { class: "unit" }, f.unit) : null));
  }

  if (f.t === "seg") {
    const v = get();
    return wrap(h("div", { class: "seg", role: "radiogroup", id }, f.options.map(([val, label]) => h("button", { type: "button", role: "radio", "aria-checked": String(v === val), class: v === val ? "on" : "", onclick: () => { set(val, { coalesce: "" }); rerender(); } }, label))));
  }
  if (f.t === "select") {
    const v = get();
    const sel = h("select", { id, onchange: () => { set(sel.value); rerender(); } }, f.options.map(([val, label]) => h("option", { value: val, selected: v === val }, label)));
    return wrap(sel);
  }
  if (f.t === "toggle") {
    const v = !!get();
    const btn = h("button", { type: "button", id, role: "switch", "aria-checked": String(v), class: "switch" + (v ? " on" : ""), onclick: () => { set(!get(), { coalesce: "" }); rerender(); } }, h("i"));
    return h("div", { class: "fld fld-toggle", "data-k": path }, btn, h("label", { for: id, class: "fld-l" }, f.label), f.hint ? h("p", { class: "hint" }, f.hint) : null);
  }

  if (f.t === "color") {
    const v = get() || "";
    const pick = h("input", { type: "color", id, value: /^#[0-9a-f]{6}$/i.test(v) ? v : "#888888" });
    const hex = h("input", { type: "text", class: "hex", value: v, placeholder: f.allowEmpty ? "как в теме" : "#RRGGBB", "aria-label": f.label + " — код цвета", maxlength: 7 });
    const warn = h("p", { class: "warn", hidden: true });
    const check = (c) => {
      const w = ctx.contrastFor ? ctx.contrastFor(f.k, c) : null;
      warn.hidden = !w; warn.textContent = w || "";
    };
    const apply = (c, opt) => { hex.value = c; if (/^#[0-9a-f]{6}$/i.test(c)) pick.value = c; set(c, opt); check(c); };
    pick.addEventListener("input", () => apply(pick.value.toUpperCase()));
    hex.addEventListener("change", () => { const c = hex.value.trim(); if (!c && f.allowEmpty) { apply("", { coalesce: "" }); return; } if (/^#?[0-9a-f]{6}$/i.test(c)) apply(("#" + c.replace("#", "")).toUpperCase()); else toast("Цвет — в виде #RRGGBB", "err"); });
    const sw = (app.swatches() || []).map((c) => h("button", { type: "button", class: "sw", title: c, style: { background: c }, onclick: () => apply(c, { coalesce: "" }) }));
    check(v);
    return wrap(h("div", { class: "clr" }, pick, hex, f.allowEmpty ? h("button", { type: "button", class: "mini", onclick: () => apply("", { coalesce: "" }) }, "Сброс") : null), h("div", null, h("div", { class: "swatches" }, sw), warn));
  }

  if (f.t === "font") {
    const v = get();
    const list = h("div", { class: "fonts", role: "listbox", id, "aria-label": f.label }, FONTS.map((x) => {
      const fam = x.id === "system" ? "-apple-system,system-ui,sans-serif" : '"' + x.name + '",serif';
      return h("button", { type: "button", role: "option", "aria-selected": String(v === x.id), class: "font-opt" + (v === x.id ? " on" : ""), onclick: () => { set(x.id, { coalesce: "" }); rerender(); } },
        h("span", { class: "fo-s", style: { fontFamily: fam } }, "Аа Bb — a_a_avgust"), h("span", { class: "fo-n" }, x.name));
    }));
    return wrap(list);
  }

  if (f.t === "gem") {
    const v = get();
    const opts = (f.allowNone ? [["none", "Без знака"]] : []).concat(GEMS);
    return wrap(h("div", { class: "gems", role: "radiogroup", id }, opts.map(([val, label]) => h("button", { type: "button", role: "radio", title: label, "aria-label": label, "aria-checked": String(v === val), class: "gem" + (v === val ? " on" : ""), onclick: () => { set(val, { coalesce: "" }); rerender(); } },
      val === "none" ? "—" : h("i", { style: { background: GEM_HEX[val] } })))));
  }

  if (f.t === "link") {
    const v = get() || "";
    const pages = app.pageList().map((p) => [p.key, p.label]);
    const isPage = pages.some((p) => p[0] === v);
    const url = h("input", { type: "text", class: "url", placeholder: "https://…", value: isPage ? "" : v, hidden: isPage || f.pagesOnly, "aria-label": f.label + " — адрес" });
    const sel = h("select", { id, onchange: () => { if (sel.value === "@url") { url.hidden = false; url.focus(); set(url.value); } else { url.hidden = true; set(sel.value, { coalesce: "" }); } } },
      pages.map(([k, l]) => h("option", { value: k, selected: k === v }, l)), f.pagesOnly ? null : h("option", { value: "@url", selected: !isPage }, "Внешняя ссылка…"));
    url.addEventListener("input", () => set(url.value.trim()));
    return wrap(h("div", { class: "link" }, sel, url));
  }

  if (f.t === "strings") {
    const v = get() || [];
    const inp = h("input", { type: "text", id, value: v.join(", "), placeholder: "через запятую" });
    inp.addEventListener("input", () => set(inp.value.split(",").map((s) => s.trim()).filter(Boolean)));
    return wrap(inp);
  }

  if (f.t === "series") {
    const v = get() || "";
    const sel = h("select", { id, onchange: () => set(sel.value, { coalesce: "" }) }, h("option", { value: "" }, "— без серии —"), app.store.model().series.map((s) => h("option", { value: s.id, selected: s.id === v }, (s.title && s.title.ru) || s.id)));
    return wrap(sel);
  }
  if (f.t === "work") {
    const v = get() || "";
    const sel = h("select", { id, onchange: () => set(sel.value, { coalesce: "" }) }, h("option", { value: "" }, "— первая работа серии —"), app.store.model().works.map((w) => h("option", { value: w.id, selected: w.id === v }, (w.title && w.title.ru) || w.id)));
    return wrap(sel);
  }

  if (f.t === "image") return wrap(app.imageControl(ctx.file, path, f), null);

  if (f.t === "list") {
    const arr = get() || [];
    const box = h("div", { class: "list", id });
    arr.forEach((it, i) => {
      const itemCtx = Object.assign({}, ctx, { base: path + "." + i + ".", obj: it });
      const title = f.itemLabel ? f.itemLabel(it, i) : "№" + (i + 1);
      const move = (d) => { const a = (get() || []).slice(); const j = i + d; if (j < 0 || j >= a.length) return; a.splice(j, 0, a.splice(i, 1)[0]); set(a, { coalesce: "" }); rerender(); };
      const head = h("div", { class: "li-head" }, h("span", { class: "li-t" }, title),
        h("button", { type: "button", class: "iconbtn sm", "aria-label": "Выше", onclick: () => move(-1) }, icon("up")),
        h("button", { type: "button", class: "iconbtn sm", "aria-label": "Ниже", onclick: () => move(1) }, icon("down")),
        h("button", { type: "button", class: "iconbtn sm danger", "aria-label": "Удалить", onclick: () => { if (!confirm("Удалить «" + title + "»?")) return; const a = (get() || []).slice(); a.splice(i, 1); set(a, { coalesce: "" }); rerender(); } }, icon("trash")));
      let body;
      if (f.textItems) body = field(Object.assign({}, ctx, { base: path + "." }), { k: String(i), t: "area", i18n: true, label: "Текст", rows: 3 });
      else body = h("div", { class: "li-body" }, (f.fields || []).map((sf) => field(itemCtx, sf)).filter(Boolean));
      box.append(h("details", { class: "li", open: arr.length <= 3 ? true : null }, h("summary", null, head), body));
    });
    box.append(h("button", { type: "button", class: "btn sm add", onclick: () => { const a = (get() || []).slice(); a.push(f.make ? f.make() : {}); set(a, { coalesce: "" }); rerender(); } }, icon("plus"), "Добавить"));
    return h("div", { class: "fld fld-list", "data-k": path }, h("div", { class: "fld-l" }, f.label), box, f.hint ? h("p", { class: "hint" }, f.hint) : null);
  }
  return null;
}

/* предупреждение о контрасте для цвета палитры: с чем сравнивать */
export function paletteContrast(theme, mode) {
  return (k, c) => {
    const p = Object.assign({}, theme[mode], { [k.split(".").pop()]: c });
    const pairs = [["ink", "ground", 4.5, "Текст на фоне"], ["muted", "ground", 4.5, "Пояснения на фоне"], ["muted", "surface", 4.5, "Пояснения на карточках"], ["link", "ground", 4.5, "Ссылки"], ["accentInk", "ground", 4.5, "Акцентный текст"], ["onAccent", "accent", 4.5, "Текст на кнопке"], ["gold", "ground", 4.5, "Надписи над заголовками"]];
    const key = k.split(".").pop();
    const bad = pairs.filter(([a, b]) => a === key || b === key).map(([a, b, need, label]) => [label, contrast(p[a], p[b]), need]).filter((x) => x[1] < x[2]);
    if (!bad.length) return "";
    return "Плохо читается: " + bad.map((x) => x[0] + " — контраст " + x[1].toFixed(1) + " (нужно " + x[2] + ")").join("; ") + ". Это предупреждение: сохранить можно.";
  };
}
