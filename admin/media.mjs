/*
  Картинки в редакторе.
  • Оригиналы берутся из закрытого репозитория (по sha) и кэшируются на этом устройстве (IndexedDB) — второй раз грузятся мгновенно.
  • Для предпросмотра кадр (поворот, отражение, вырезка) применяется на canvas, результат уменьшается до 1600 px.
  • Новые файлы перед загрузкой уменьшаются до 4000 px по длинной стороне и пересохраняются без метаданных (EXIF, GPS).
*/
import { normalize, isFull, rotatedSize } from "./cropmath.mjs";

const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#2E2B28"/></svg>');
const MAX_UPLOAD = 4000, MAX_PREVIEW = 1600;

/* ---------- маленькое хранилище на устройстве ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("avgust-admin", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("blobs"); r.result.createObjectStore("uploads"); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbGet(store, key) {
  try { const db = await idb(); return await new Promise((res) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e) { return undefined; }
}
async function dbPut(store, key, val) {
  try { const db = await idb(); await new Promise((res) => { const t = db.transaction(store, "readwrite"); t.objectStore(store).put(val, key); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* без кэша */ }
}
async function dbDel(store, key) {
  try { const db = await idb(); await new Promise((res) => { const t = db.transaction(store, "readwrite"); t.objectStore(store).delete(key); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* ок */ }
}
export const uploadsDb = {
  put: (path, val) => dbPut("uploads", path, val),
  get: (path) => dbGet("uploads", path),
  del: (path) => dbDel("uploads", path)
};

export class Media {
  constructor({ gh, store, tree, onReady }) {
    this.gh = gh; this.store = store; this.tree = tree || {};
    this.onReady = onReady || (() => {});
    this.bitmaps = new Map();   // путь → Promise<ImageBitmap>
    this.ready = new Map();     // ключ кадра → { src, w, h }
    this.pending = new Set();
    this.failed = new Map();    // ключ кадра → когда не загрузилось (повтор не чаще раза в 15 с)
  }
  async bytes(path) {
    const up = this.store.uploads[path];
    if (up) return new Blob([up.bytes], { type: up.type || "image/jpeg" });
    const t = this.tree[path];
    if (!t) throw new Error("Нет файла " + path);
    if (t.bytes) return new Blob([t.bytes]);
    let buf = await dbGet("blobs", t.sha);
    if (!buf) { buf = await this.gh.blobBytes(t.sha); dbPut("blobs", t.sha, buf); }
    return new Blob([buf]);
  }
  bitmap(path) {
    if (!this.bitmaps.has(path)) {
      const p = this.bytes(path).then((b) => decode(b)).then((im) => { if (!im || !im.w) throw new Error("Не открылась картинка " + path); return im.src; });
      p.catch(() => { if (this.bitmaps.get(path) === p) this.bitmaps.delete(path); }); // сбой сети не запоминаем навсегда
      this.bitmaps.set(path, p);
    }
    return this.bitmaps.get(path);
  }
  key(ref) { return ref.src + "|" + JSON.stringify(isFull(ref.crop) ? null : normalize(ref.crop)); }

  /* картинка для предпросмотра — сразу (если готова) или заглушка, а когда загрузится — onReady(ключ) */
  get(ref) {
    if (!ref || !ref.src) return null;
    const k = this.key(ref);
    const r = this.ready.get(k);
    if (r) return r;
    if (!this.pending.has(k) && !(Date.now() - (this.failed.get(k) || 0) < 15000)) {
      this.pending.add(k);
      this.render(ref).then((x) => {
        this.ready.set(k, x); this.pending.delete(k); this.failed.delete(k);
        if (this.ready.size > 400) { const [ok, ov] = this.ready.entries().next().value; this.ready.delete(ok); URL.revokeObjectURL(ov.src); }
        this.onReady(k);
      }, () => { this.pending.delete(k); this.failed.set(k, Date.now()); });
    }
    return null;
  }
  placeholder() { return { src: PLACEHOLDER, w: 4, h: 3 }; }

  /* кадр на canvas → blob: URL */
  async render(ref, max = MAX_PREVIEW) {
    const bm = await this.bitmap(ref.src);
    const c = normalize(ref.crop);
    const R = rotatedSize(bm.width, bm.height, c.rot);
    const sx = c.x * R.w, sy = c.y * R.h, sw = Math.max(1, c.w * R.w), sh = Math.max(1, c.h * R.h);
    const k = Math.min(1, max / Math.max(sw, sh));
    const cw = Math.round(sw * k), ch = Math.round(sh * k);
    const cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    const g = cv.getContext("2d");
    g.imageSmoothingQuality = "high";
    // как в сборке (sharp): отражения оригинала, затем поворот; потом сдвиг, чтобы в холст попал кадр
    g.scale(k, k);
    g.translate(-sx, -sy);
    g.translate(R.w / 2, R.h / 2);
    g.rotate((c.rot * Math.PI) / 180);
    g.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
    g.drawImage(bm, -bm.width / 2, -bm.height / 2);
    // JPEG (PNG — для PNG с прозрачностью): WebP и AVIF Safari в режиме блокировки не показывает
    const png = /\.png$/i.test(ref.src);
    const blob = await new Promise((res) => cv.toBlob(res, png ? "image/png" : "image/jpeg", 0.86));
    cv.width = cv.height = 0;
    if (!blob) throw new Error("Не получилось показать " + ref.src);
    return { src: URL.createObjectURL(blob), w: cw, h: ch };
  }
  /* размеры оригинала (после поворота) — для кадрирования */
  async size(ref) { const bm = await this.bitmap(ref.src); const c = normalize(ref.crop); return rotatedSize(bm.width, bm.height, c.rot); }
  /* картинка целиком (без кадра) для окна кадрирования */
  async whole(ref) { return this.render({ src: ref.src, crop: null }, 2000); }
  forget(path) { this.bitmaps.delete(path); for (const [k, v] of [...this.ready]) if (k.startsWith(path + "|")) { this.ready.delete(k); URL.revokeObjectURL(v.src); } }
}

/* во что превратится файл: PNG остаётся PNG (снимки экрана, прозрачность), всё остальное — JPEG, в том числе HEIC/HEIF с iPhone */
export function uploadFormat(name, type) {
  const png = /png$/i.test(type || "") || /\.png$/i.test(name || "");
  return png ? { type: "image/png", ext: "png" } : { type: "image/jpeg", ext: "jpg" };
}
export const isHeic = (name, type) => /hei[cf]/i.test(type || "") || /\.hei[cf]$/i.test(name || "");
/* что умеют открыть фото-пикеры: HEIC/HEIF указаны явно — иначе часть браузеров не даёт их выбрать */
export const ACCEPT = "image/*,.heic,.heif";

/* JPEG без метаданных: убираются сегменты APP1…APP15 (EXIF, GPS, XMP, ICC, Photoshop) и комментарии.
   Нужна и после canvas: Safari сам дописывает в JPEG маленький EXIF и блок Photoshop. Не JPEG — без изменений. */
export function stripJpegMeta(bytes) {
  if (!(bytes && bytes[0] === 0xFF && bytes[1] === 0xD8)) return bytes;
  const keep = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xFF) {
    const m = bytes[i + 1];
    if (m === 0xD9 || m === 0xDA) break; // дальше — сами данные картинки
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) return bytes; // битый файл — не трогаем
    if (!((m >= 0xE1 && m <= 0xEF) || m === 0xFE)) keep.push(bytes.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  keep.push(bytes.subarray(i));
  const out = new Uint8Array(keep.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of keep) { out.set(x, o); o += x.length; }
  return out;
}

/* открыть файл: createImageBitmap, а если не вышло (часть версий Safari так не открывает HEIC) — через <img> */
async function decode(file) {
  try { const bm = await createImageBitmap(file, { imageOrientation: "from-image" }); return { src: bm, w: bm.width, h: bm.height, done: () => bm.close && bm.close() }; } catch (e) { /* ниже */ }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); return null; }
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/* новый файл → уменьшенный, без метаданных (EXIF, GPS): картинка заново рисуется на canvas и сохраняется */
export async function prepareUpload(file) {
  const im = await decode(file);
  if (!im || !im.w) {
    throw new Error(isHeic(file.name, file.type)
      ? "Этот браузер не открыл фото HEIC «" + file.name + "». Откройте кабинет в Safari или выберите фото ещё раз — iPhone обычно сам отдаёт JPEG."
      : "Этот браузер не умеет открывать «" + file.name + "». Сохраните картинку как JPEG или PNG и загрузите снова.");
  }
  const k = Math.min(1, MAX_UPLOAD / Math.max(im.w, im.h));
  const w = Math.max(1, Math.round(im.w * k)), h = Math.max(1, Math.round(im.h * k));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  const out = uploadFormat(file.name, file.type);
  if (out.ext === "jpg") { g.fillStyle = "#1B1A19"; g.fillRect(0, 0, w, h); }
  g.drawImage(im.src, 0, 0, w, h);
  im.done();
  const blob = await new Promise((res) => cv.toBlob(res, out.type, 0.9));
  cv.width = cv.height = 0; // память на iPhone
  if (!blob) throw new Error("Не получилось подготовить «" + file.name + "»");
  return { bytes: stripJpegMeta(new Uint8Array(await blob.arrayBuffer())), type: blob.type, ext: out.ext, w, h };
}

/* безопасное имя файла: латиница, цифры, дефис */
export function fileSlug(name) {
  const map = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya" };
  const base = String(name || "").replace(/\.[^.]+$/, "").toLowerCase().split("").map((c) => (map[c] != null ? map[c] : c)).join("");
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "img";
}
