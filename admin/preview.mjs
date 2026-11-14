/*
  Внутри окна предпросмотра: получает разметку страницы от редактора, обновляет только изменившееся,
  сообщает, на что нажали (блок, поле, работа). Ссылки и кнопки здесь не срабатывают.
*/
const style = document.getElementById("av-theme");
let selected = "";
const post = (m) => parent.postMessage(m, location.origin);

function setPage(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const y = scrollY;
  for (const a of ["lang", "data-gem", "data-theme"]) {
    const v = doc.documentElement.getAttribute(a);
    if (v == null) document.documentElement.removeAttribute(a); else document.documentElement.setAttribute(a, v);
  }
  document.body.className = doc.body.className;
  document.body.replaceChildren(...doc.body.childNodes);
  scrollTo(0, y);
  mark();
}
function mark() {
  document.querySelectorAll(".av-sel").forEach((e) => e.classList.remove("av-sel"));
  if (selected) { const el = document.querySelector('[data-bid="' + CSS.escape(selected) + '"]'); if (el) el.classList.add("av-sel"); }
}
addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data || typeof e.data !== "object") return;
  const m = e.data;
  if (m.type === "page") setPage(m.html);
  if (m.type === "css") style.textContent = m.css;
  if (m.type === "theme") document.documentElement.setAttribute("data-theme", m.theme);
  if (m.type === "block") {
    const el = document.querySelector('[data-bid="' + CSS.escape(m.bid) + '"]');
    if (el && m.html) { const t = document.createElement("template"); t.innerHTML = m.html; el.replaceWith(t.content); mark(); }
  }
  if (m.type === "select") {
    selected = m.bid || "";
    mark();
    if (m.scroll && selected) {
      const el = document.querySelector('[data-bid="' + CSS.escape(selected) + '"]');
      if (el) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight * 0.8) el.scrollIntoView({ block: "start", behavior: "smooth" }); }
    }
  }
});
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("a,button,summary,input")) e.preventDefault();
  const work = t.closest("[data-work]");
  const f = t.closest("[data-f]");
  const b = t.closest("[data-bid]");
  if (!b && !work) return;
  e.preventDefault();
  post({ type: "pick", bid: b ? b.getAttribute("data-bid") : "", field: f ? f.getAttribute("data-f") : "", work: work ? work.getAttribute("data-work") : "" });
}, true);
document.addEventListener("keydown", (e) => {
  // отмена/повтор работают и когда фокус в предпросмотре
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); post({ type: "key", key: e.shiftKey ? "redo" : "undo" }); }
});
/* как на сайте (headJs в render.mjs): если AVIF/WebP не открылись — <picture> заменяется чистой копией <img> с запасным JPEG */
document.addEventListener("error", (e) => {
  const i = e.target, p = i && i.parentNode;
  if (!p || i.tagName !== "IMG" || p.tagName !== "PICTURE" || !p.parentNode) return;
  const n = i.cloneNode(false);
  n.removeAttribute("srcset"); n.removeAttribute("sizes");
  p.replaceWith(n);
}, true);
post({ type: "ready" });
