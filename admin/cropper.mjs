/*
  Кадрирование: рамка поверх картинки (тянуть за середину — сдвиг, за углы и края — размер),
  пропорции, масштаб, поворот на 90°, отражение, «заполнить/вписать», точка фокуса.
  Результат — данные { crop, focal, fit, aspect }; файл-оригинал не меняется, кадр применяется при сборке.
*/
import { h, icon, modal } from "./ui.mjs";
import * as CM from "./cropmath.mjs";

export function openCropper(media, ref, opt = {}) {
  return new Promise(async (done) => {
    let st = {
      crop: CM.normalize(ref.crop), focal: Object.assign({ x: 0.5, y: 0.5 }, ref.focal || {}),
      fit: ref.fit === "fit" ? "fit" : "fill", aspect: ref.aspect || "auto"
    };
    const slot = opt.slotRatio || null;   // пропорция места на странице («как у блока»)
    let W = 1, H = 1, url = "";
    const img = h("img", { alt: "", class: "crop-img", draggable: "false" });
    const rect = h("div", { class: "crop-rect", tabindex: "0", "aria-label": "Кадр. Стрелки двигают кадр." });
    ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((p) => rect.append(h("span", { class: "hd hd-" + p, "data-h": p })));
    const dot = h("span", { class: "focal", title: "Точка фокуса: эта часть остаётся видна, если блок обрезает картинку" });
    rect.append(dot);
    const stage = h("div", { class: "crop-stage" }, h("div", { class: "crop-box" }, img, rect));
    const si = h("img", { alt: "" }), win = h("div", { class: "crop-win" }, si);
    const sample = h("div", { class: "crop-sample" }, win);
    const zoom = h("input", { type: "range", min: 1, max: 8, step: 0.01, value: 1, "aria-label": "Масштаб" });
    const ratio = () => {
      if (st.aspect === "free") return null;
      if (st.aspect === "original") return W / H;
      if (st.aspect === "auto") return slot;
      return CM.ratioOf(st.aspect);
    };

    const asp = h("div", { class: "seg wrap" }, CM.ASPECTS.map(([v, l]) => h("button", { type: "button", "data-a": v, onclick: () => { st.aspect = v; const r = ratio(); if (r) st.crop = CM.maxAspect(r, W, H, st.crop); else if (v === "original") st.crop = CM.normalize(Object.assign({}, st.crop, { x: 0, y: 0, w: 1, h: 1 })); draw(); } }, l)));
    const fitSeg = h("div", { class: "seg" }, [["fill", "Заполнить (обрезать по рамке)"], ["fit", "Вписать (показать целиком)"]].map(([v, l]) => h("button", { type: "button", "data-f": v, onclick: () => { st.fit = v; draw(); } }, l)));
    const tools = h("div", { class: "row" },
      h("button", { type: "button", class: "btn sm", onclick: () => turn(CM.rotateCCW) }, icon("rotl"), "90° влево"),
      h("button", { type: "button", class: "btn sm", onclick: () => turn(CM.rotateCW) }, icon("rotr"), "90° вправо"),
      h("button", { type: "button", class: "btn sm", onclick: () => { st.crop = CM.flipH(st.crop); reload(); } }, icon("fliph"), "Отразить ↔"),
      h("button", { type: "button", class: "btn sm", onclick: () => { st.crop = CM.flipV(st.crop); reload(); } }, icon("flipv"), "Отразить ↕"),
      h("button", { type: "button", class: "btn sm", onclick: () => { st = { crop: CM.normalize(null), focal: { x: 0.5, y: 0.5 }, fit: "fill", aspect: "auto" }; reload(); } }, icon("reset"), "Сбросить"));
    const side = h("div", { class: "crop-side" },
      h("div", { class: "fld-l" }, "Пропорции"), asp,
      h("div", { class: "fld-l" }, "Масштаб"), zoom,
      h("div", { class: "fld-l" }, "Поворот и отражение"), tools,
      h("div", { class: "fld-l" }, "Как показывать в рамке"), fitSeg,
      h("div", { class: "fld-l" }, "Так будет в блоке"), sample,
      h("p", { class: "hint" }, "Точка фокуса (кружок) — какая часть остаётся видна, когда рамка на странице уже кадра."));
    const ok = h("button", { type: "button", class: "btn primary" }, "Готово");
    const m = modal("Кадр", h("div", { class: "crop" }, stage, side, h("div", { class: "row end crop-foot" }, h("button", { type: "button", class: "btn", onclick: () => { m.close(); done(null); } }, "Отмена"), ok)), { cls: "wide", onClose: () => done(null) });
    ok.onclick = () => {
      m.dlg.close(); m.dlg.remove();
      const crop = CM.isFull(st.crop) ? null : CM.normalize(st.crop);
      done(Object.assign({}, ref, { crop, focal: { x: +st.focal.x.toFixed(3), y: +st.focal.y.toFixed(3) }, fit: st.fit, aspect: st.aspect }));
    };

    async function reload() {
      const full = { src: ref.src, crop: Object.assign({}, CM.FULL, { rot: st.crop.rot, flipH: st.crop.flipH, flipV: st.crop.flipV }) };
      const r = await media.render(full, 1600);
      if (url) URL.revokeObjectURL(url);
      url = r.src; img.src = r.src;
      const s = await media.size({ src: ref.src, crop: full.crop });
      W = s.w; H = s.h;
      draw();
    }
    function turn(fn) { st.crop = fn(st.crop); reload(); }
    function draw() {
      const c = st.crop;
      Object.assign(rect.style, { left: c.x * 100 + "%", top: c.y * 100 + "%", width: c.w * 100 + "%", height: c.h * 100 + "%" });
      Object.assign(dot.style, { left: st.focal.x * 100 + "%", top: st.focal.y * 100 + "%" });
      zoom.value = CM.zoomOf(c, ratio(), W, H);
      asp.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.a === st.aspect));
      fitSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.f === st.fit));
      // образец: кадр в рамке блока — видимая часть кадра с учётом точки фокуса (или кадр целиком при «вписать»)
      const cw = c.w * W, ch = c.h * H, cr = cw / ch;
      const sR = st.aspect === "auto" && slot ? slot : cr;
      sample.style.aspectRatio = String(sR);
      let vx = 0, vy = 0, vw = 1, vh = 1, box = { l: 0, t: 0, w: 100, h: 100 };
      if (st.fit === "fill") {
        if (cr > sR) { vw = sR / cr; vx = (1 - vw) * st.focal.x; } else { vh = cr / sR; vy = (1 - vh) * st.focal.y; }
      } else if (cr > sR) { box.h = (sR / cr) * 100; box.t = (100 - box.h) / 2; } else { box.w = (cr / sR) * 100; box.l = (100 - box.w) / 2; }
      const X = c.x + vx * c.w, Y = c.y + vy * c.h, Wf = vw * c.w, Hf = vh * c.h;
      Object.assign(win.style, { left: box.l + "%", top: box.t + "%", width: box.w + "%", height: box.h + "%" });
      Object.assign(si.style, { width: 100 / Wf + "%", height: 100 / Hf + "%", left: (-X / Wf) * 100 + "%", top: (-Y / Hf) * 100 + "%" });
      si.src = img.src;
    }
    zoom.addEventListener("input", () => { st.crop = CM.zoomTo(st.crop, +zoom.value, ratio(), W, H); draw(); });

    // перетаскивание: кадр, углы, точка фокуса
    let drag = null;
    const box = stage.querySelector(".crop-box");
    const frac = (e) => { const b = box.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
    box.addEventListener("pointerdown", (e) => {
      const t = e.target;
      const p = frac(e);
      if (t === dot) drag = { kind: "focal" };
      else if (t.dataset && t.dataset.h) drag = { kind: "resize", h: t.dataset.h, p, c: st.crop };
      else if (t === rect) drag = { kind: "move", p, c: st.crop };
      else return;
      e.preventDefault();
      try { box.setPointerCapture(e.pointerId); } catch (x) { /* касание уже кончилось — тянуть без захвата */ }
    });
    box.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = frac(e);
      if (drag.kind === "focal") {
        const c = st.crop;
        st.focal = { x: Math.max(0, Math.min(1, (p.x - c.x) / c.w)), y: Math.max(0, Math.min(1, (p.y - c.y) / c.h)) };
      } else if (drag.kind === "move") st.crop = CM.moveBy(drag.c, p.x - drag.p.x, p.y - drag.p.y);
      else st.crop = CM.resize(drag.c, drag.h, p.x - drag.p.x, p.y - drag.p.y, ratio(), W, H);
      draw();
    });
    const end = () => { drag = null; };
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
    rect.addEventListener("keydown", (e) => {
      const d = e.shiftKey ? 0.05 : 0.01;
      const k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
      if (!k) return;
      e.preventDefault();
      st.crop = CM.moveBy(st.crop, k[0], k[1]);
      draw();
    });
    try { await reload(); } catch (e) { m.close(); done(null); throw e; }
  });
}
