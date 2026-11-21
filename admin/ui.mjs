/* Маленькие помощники для интерфейса редактора: создание элементов, диалоги, всплывающие сообщения. */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c) || c instanceof NodeList || c instanceof HTMLCollection) { [...c].forEach(add); return; }
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* значки редактора: та же линия 1.5, что и на сайте */
const IC = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>', tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>', phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>', plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<path d="M8.5 8.5h11v11h-11z"/><path d="M15.5 8.5v-4h-11v11h4"/>', up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>', reset: '<path d="M4 4v6h6"/><path d="M20 20a9 9 0 0 0-15.5-9.5L4 10"/>', crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>', page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none"/>',
  site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', works: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  series: '<path d="M4 6h16M4 12h16M4 18h10"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  rotl: '<path d="M2.5 2v6h6"/><path d="M2.6 13.5A9.5 9.5 0 1 0 4.8 6L2.5 8"/>', rotr: '<path d="M21.5 2v6h-6"/><path d="M21.4 13.5A9.5 9.5 0 1 1 19.2 6l2.3 2"/>', fliph: '<path d="M12 3v18M8 7 3 12l5 5V7zM16 7l5 5-5 5V7z"/>', flipv: '<path d="M3 12h18M7 8l5-5 5 5H7zM7 16l5 5 5-5H7z"/>',
  logout: '<path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3"/>', upload: '<path d="M12 16V4M6.5 9.5 12 4l5.5 5.5M5 20h14"/>', ext: '<path d="M7 17 17 7M9 7h8v8"/>', check: '<path d="m5 12 5 5 9-10"/>', warn: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/>'
};
export function icon(n) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "ic");
  s.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (IC[n] || "") + "</g>";
  return s;
}

export function toast(msg, kind = "", ms = 4200) {
  let box = $("#toasts");
  if (!box) { box = h("div", { id: "toasts", role: "status", "aria-live": "polite" }); document.body.append(box); }
  const el = h("div", { class: "toast " + kind }, msg);
  box.append(el);
  setTimeout(() => el.remove(), ms);
}

/* окно подтверждения: кнопка по умолчанию — «Отмена» */
export function confirmBox(title, text, okLabel = "Да", danger = false) {
  return new Promise((res) => {
    const close = (v) => { dlg.close(); dlg.remove(); res(v); };
    const cancel = h("button", { class: "btn", type: "button", onclick: () => close(false) }, "Отмена");
    const dlg = h("dialog", { class: "modal small" },
      h("h2", null, title), text ? h("p", { class: "muted" }, text) : null,
      h("div", { class: "row end" }, cancel, h("button", { class: "btn " + (danger ? "danger" : "primary"), type: "button", onclick: () => close(true) }, okLabel)));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(false); });
    document.body.append(dlg);
    dlg.showModal();
    cancel.focus();
  });
}
export function modal(title, body, opt = {}) {
  const dlg = h("dialog", { class: "modal " + (opt.cls || "") }, h("div", { class: "modal-head" }, h("h2", null, title), h("button", { class: "iconbtn", type: "button", "aria-label": "Закрыть", onclick: () => close() }, icon("close"))), body);
  const close = () => { dlg.close(); dlg.remove(); if (opt.onClose) opt.onClose(); };
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { dlg, close };
}
