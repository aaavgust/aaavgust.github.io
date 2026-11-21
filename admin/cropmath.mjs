/*
  Математика кадра. Кадр: { x, y, w, h } — доли (0…1) от повёрнутой и отражённой картинки, rot — 0/90/180/270, flipH/flipV.
  Порядок как в sharp при сборке: сначала отражения оригинала (flipV, flipH), потом поворот по часовой на rot.
  Точка фокуса — доли внутри кадра. Оригинал никогда не меняется: кадр применяется при сборке.
*/
export const FULL = { x: 0, y: 0, w: 1, h: 1, rot: 0, flipH: false, flipV: false };
export const ASPECTS = [
  ["auto", "Как у блока"], ["original", "Оригинал"], ["free", "Свободно"], ["1:1", "1:1"], ["4:5", "4:5"], ["3:4", "3:4"], ["9:16", "9:16"], ["16:9", "16:9"], ["3:2", "3:2"], ["2:3", "2:3"]
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r4 = (v) => Math.round(v * 10000) / 10000;

export function ratioOf(aspect) {
  const m = /^(\d+):(\d+)$/.exec(aspect || "");
  return m ? +m[1] / +m[2] : null;
}
/* размеры картинки после поворота */
export function rotatedSize(w, h, rot) { return rot % 180 ? { w: h, h: w } : { w, h }; }

export function normalize(c) {
  c = Object.assign({}, FULL, c || {});
  c.w = clamp(c.w, 0.01, 1); c.h = clamp(c.h, 0.01, 1);
  c.x = clamp(c.x, 0, 1 - c.w); c.y = clamp(c.y, 0, 1 - c.h);
  for (const k of ["x", "y", "w", "h"]) c[k] = r4(c[k]);
  c.rot = ((Math.round((c.rot || 0) / 90) * 90) % 360 + 360) % 360;
  return c;
}
export const isFull = (c) => { c = normalize(c); return c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1 && !c.rot && !c.flipH && !c.flipV; };

/* поворот на 90° по часовой: кадр поворачивается вместе с картинкой, отражения оригинала не меняются */
export function rotateCW(c) {
  c = normalize(c);
  return normalize({ x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w, rot: (c.rot + 90) % 360, flipH: c.flipH, flipV: c.flipV });
}
export function rotateCCW(c) { return rotateCW(rotateCW(rotateCW(c))); }
/* отразить то, что видно на экране: при повороте на 90/270 это отражение оригинала по другой оси */
export function flipH(c) {
  c = normalize(c);
  const side = c.rot % 180 === 0 ? "flipH" : "flipV";
  return normalize(Object.assign({}, c, { x: 1 - c.x - c.w, [side]: !c[side] }));
}
export function flipV(c) {
  c = normalize(c);
  const side = c.rot % 180 === 0 ? "flipV" : "flipH";
  return normalize(Object.assign({}, c, { y: 1 - c.y - c.h, [side]: !c[side] }));
}

/*
  Подогнать кадр под соотношение сторон (ratio = ширина/высота в пикселях) с сохранением центра.
  W, H — размеры повёрнутой картинки в пикселях.
*/
export function fitAspect(c, ratio, W, H) {
  c = normalize(c);
  if (!ratio) return c;
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  let pw = c.w * W, ph = pw / ratio;
  if (ph > c.h * H) { ph = c.h * H; pw = ph * ratio; }
  // кадр не может быть меньше 5% и больше картинки
  if (pw > W) { pw = W; ph = pw / ratio; }
  if (ph > H) { ph = H; pw = ph * ratio; }
  const w = pw / W, h = ph / H;
  return normalize(Object.assign({}, c, { x: cx - w / 2, y: cy - h / 2, w, h }));
}
/* самый большой кадр нужной пропорции по центру */
export function maxAspect(ratio, W, H, base) {
  const c = normalize(Object.assign({}, base || FULL, { x: 0, y: 0, w: 1, h: 1 }));
  return fitAspect(c, ratio, W, H);
}
/* масштаб: zoom 1 — самый большой кадр этой пропорции, 8 — в 8 раз ближе; центр сохраняется */
export function zoomTo(c, zoom, ratio, W, H) {
  c = normalize(c);
  const r = ratio || (c.w * W) / (c.h * H);
  const big = maxAspect(r, W, H, c), z = clamp(zoom, 1, 8);
  const w = big.w / z, h = big.h / z, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  return normalize(Object.assign({}, c, { x: cx - w / 2, y: cy - h / 2, w, h }));
}
export function zoomOf(c, ratio, W, H) {
  c = normalize(c);
  const r = ratio || (c.w * W) / (c.h * H);
  return Math.max(1, maxAspect(r, W, H, c).w / c.w);
}
/* перетаскивание кадра (dx, dy — доли картинки) */
export function moveBy(c, dx, dy) { c = normalize(c); return normalize(Object.assign({}, c, { x: c.x + dx, y: c.y + dy })); }

/*
  Изменение размера за угол/край: handle — "nw","n","ne","e","se","s","sw","w"; dx, dy в долях картинки.
  ratio (ширина/высота в пикселях) сохраняется, если задан.
*/
export function resize(c, handle, dx, dy, ratio, W, H) {
  c = normalize(c);
  let x1 = c.x, y1 = c.y, x2 = c.x + c.w, y2 = c.y + c.h;
  if (handle.includes("w")) x1 += dx;
  if (handle.includes("e")) x2 += dx;
  if (handle.includes("n")) y1 += dy;
  if (handle.includes("s")) y2 += dy;
  const min = 0.03;
  if (x2 - x1 < min) { if (handle.includes("w")) x1 = x2 - min; else x2 = x1 + min; }
  if (y2 - y1 < min) { if (handle.includes("n")) y1 = y2 - min; else y2 = y1 + min; }
  x1 = clamp(x1, 0, 1); y1 = clamp(y1, 0, 1); x2 = clamp(x2, 0, 1); y2 = clamp(y2, 0, 1);
  if (ratio) {
    let pw = (x2 - x1) * W, ph = (y2 - y1) * H;
    const horiz = handle === "e" || handle === "w";
    const vert = handle === "n" || handle === "s";
    if (horiz) ph = pw / ratio; else if (vert) pw = ph * ratio; else if (pw / ph > ratio) pw = ph * ratio; else ph = pw / ratio;
    let w = pw / W, h = ph / H;
    if (handle.includes("w")) x1 = x2 - w; else if (handle.includes("e")) x2 = x1 + w; else { const cx = (x1 + x2) / 2; x1 = cx - w / 2; x2 = cx + w / 2; }
    if (handle.includes("n")) y1 = y2 - h; else if (handle.includes("s")) y2 = y1 + h; else { const cy = (y1 + y2) / 2; y1 = cy - h / 2; y2 = cy + h / 2; }
    // не выходить за картинку: ужать, сохранив пропорцию
    if (x1 < 0 || y1 < 0 || x2 > 1 || y2 > 1) {
      const k = Math.min(1, x2 > 1 ? (1 - x1) / w : 1, x1 < 0 ? x2 / w : 1, y2 > 1 ? (1 - y1) / h : 1, y1 < 0 ? y2 / h : 1);
      w *= k; h *= k;
      if (handle.includes("w")) x1 = x2 - w; else x2 = x1 + w;
      if (handle.includes("n")) y1 = y2 - h; else y2 = y1 + h;
    }
  }
  return normalize(Object.assign({}, c, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }));
}

/* позиция картинки в рамке (CSS object-position) по точке фокуса */
export function objectPosition(focal) {
  const f = focal || { x: 0.5, y: 0.5 };
  return Math.round(clamp(f.x, 0, 1) * 100) + "% " + Math.round(clamp(f.y, 0, 1) * 100) + "%";
}
