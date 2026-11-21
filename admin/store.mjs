/*
  Черновик редактора: файлы content/*.json как объекты, загруженные картинки, отмена/повтор.
  Ничего не знает про DOM и сеть — поэтому покрыт тестами.
*/
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const ser = (v) => (v === undefined ? undefined : JSON.stringify(v));
export const fileText = (v) => JSON.stringify(v, null, 2) + "\n";

/* путь вида "blocks.2.data.title" → чтение и запись */
export function getAt(obj, p) {
  if (!p) return obj;
  return String(p).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setAt(obj, p, v) {
  const ks = String(p).split(".");
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = v;
}

export function uid(prefix = "b") { return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }

export class Store {
  constructor() {
    this.base = "";          // коммит, от которого начат черновик
    this.files = {};         // путь → объект
    this.original = {};      // путь → текст с GitHub (для «что изменилось»)
    this.uploads = {};       // путь в media/ → { bytes: Uint8Array, type }
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.lastKey = ""; this.lastAt = 0;
  }
  /* загрузить файлы с GitHub: { path: { text } } */
  load(base, files) {
    this.base = base;
    this.files = {}; this.original = {}; this.uploads = {};
    for (const p of Object.keys(files)) {
      this.files[p] = JSON.parse(files[p].text);
      this.original[p] = ser(this.files[p]);
    }
    this.undoStack = []; this.redoStack = [];
    this.emit({ kind: "load" });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(e) { for (const fn of this.listeners) fn(e); }

  /*
    Изменить один или несколько файлов: fn(get) получает доступ к объектам и меняет их.
    paths — какие файлы затронуты (можно новые: создадутся; null в fn → удаление).
    coalesce — ключ для склейки быстрых правок (ползунок, набор текста) в один шаг отмены.
  */
  edit(paths, fn, opt = {}) {
    paths = [].concat(paths);
    const before = {};
    for (const p of paths) before[p] = ser(this.files[p]);
    const draft = {};
    for (const p of paths) draft[p] = this.files[p];
    const res = fn((p) => draft[p], (p, v) => { draft[p] = v; });
    const after = {};
    let changed = false;
    for (const p of paths) {
      if (draft[p] === null || draft[p] === undefined) delete this.files[p]; else this.files[p] = draft[p];
      after[p] = ser(this.files[p]);
      if (after[p] !== before[p]) changed = true;
    }
    if (!changed) return res;
    const now = Date.now();
    const top = this.undoStack[this.undoStack.length - 1];
    if (opt.coalesce && top && this.lastKey === opt.coalesce && now - this.lastAt < 800 && paths.every((p) => p in top.before)) {
      for (const p of paths) top.after[p] = after[p];
    } else {
      this.undoStack.push({ before, after, label: opt.label || "" });
      if (this.undoStack.length > 200) this.undoStack.shift();
    }
    this.lastKey = opt.coalesce || ""; this.lastAt = now;
    this.redoStack = [];
    this.emit({ kind: "edit", paths, label: opt.label });
    return res;
  }
  /* поле по пути внутри файла */
  set(path, field, value, opt = {}) {
    return this.edit(path, (get) => { const o = get(path); setAt(o, field, value); }, Object.assign({ coalesce: path + "#" + field }, opt));
  }
  apply(state, dir) {
    for (const p of Object.keys(state)) {
      if (state[p] === undefined) delete this.files[p]; else this.files[p] = JSON.parse(state[p]);
    }
    this.lastKey = "";
    this.emit({ kind: dir, paths: Object.keys(state) });
  }
  undo() { const s = this.undoStack.pop(); if (!s) return false; this.redoStack.push(s); this.apply(s.before, "undo"); return true; }
  redo() { const s = this.redoStack.pop(); if (!s) return false; this.undoStack.push(s); this.apply(s.after, "redo"); return true; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  addUpload(path, bytes, type) {
    this.uploads[path] = { bytes, type };
    this.emit({ kind: "upload", paths: [path] });
  }

  /* что изменилось относительно GitHub: для коммита и для подсказки «N изменений» */
  changes() {
    const out = [];
    const all = new Set(Object.keys(this.files).concat(Object.keys(this.original)));
    for (const p of [...all].sort()) {
      const cur = ser(this.files[p]);
      if (cur === this.original[p]) continue;
      if (cur === undefined) out.push({ path: p, delete: true });
      else out.push({ path: p, text: fileText(this.files[p]) });
    }
    // загруженные картинки — только те, на которые есть ссылки (выброшенные загрузки не публикуются)
    const used = this.referencedMedia();
    for (const p of Object.keys(this.uploads)) if (used.has(p)) out.push({ path: p, bytes: this.uploads[p].bytes });
    return out;
  }
  get dirty() { return this.changes().length > 0; }
  referencedMedia() {
    const set = new Set();
    const walk = (v) => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (typeof v.src === "string") set.add(v.src.replace(/^\/+/, ""));
      Object.keys(v).forEach((k) => walk(v[k]));
    };
    Object.values(this.files).forEach(walk);
    return set;
  }
  /*
    После удачной публикации «оригиналом» становится ровно то, что ушло в коммит (sent = changes() на момент отправки).
    Правки, сделанные пока шла отправка, остаются неопубликованными.
  */
  committed(sha, sent) {
    this.base = sha;
    for (const c of sent) {
      if (c.bytes) { if (this.uploads[c.path] && this.uploads[c.path].bytes === c.bytes) delete this.uploads[c.path]; continue; }
      if (c.delete) delete this.original[c.path]; else this.original[c.path] = ser(JSON.parse(c.text));
    }
    this.emit({ kind: "committed" });
  }
  /* «Сбросить изменения» */
  reset() {
    const all = new Set(Object.keys(this.files).concat(Object.keys(this.original)));
    const before = {}, after = {};
    for (const p of all) { before[p] = ser(this.files[p]); after[p] = this.original[p]; }
    this.undoStack.push({ before, after, label: "Сброс" });
    this.redoStack = [];
    this.apply(after, "reset");
  }

  /* черновик для автосохранения на этом устройстве (картинки — отдельно, в IndexedDB) */
  snapshot() {
    const changed = {};
    for (const c of this.changes()) if (!c.bytes) changed[c.path] = c.delete ? null : c.text;
    return { base: this.base, at: new Date().toISOString(), changed, uploads: Object.keys(this.uploads) };
  }
  restore(snap, uploads = {}) {
    const paths = Object.keys(snap.changed || {});
    this.edit(paths, (get, put) => { for (const p of paths) put(p, snap.changed[p] == null ? null : JSON.parse(snap.changed[p])); }, { label: "Черновик" });
    for (const p of Object.keys(uploads)) this.uploads[p] = uploads[p];
    this.emit({ kind: "restore" });
  }

  /* ---------- контент как модель для страниц (то же, что engine/content.js) ---------- */
  model() {
    const f = this.files, M = { theme: f["content/theme.json"], site: f["content/site.json"], pages: {}, works: [], series: [], programs: {} };
    for (const p of Object.keys(f)) {
      let m;
      if ((m = /^content\/pages\/([^/]+)\.json$/.exec(p))) M.pages[m[1]] = f[p];
      else if ((m = /^content\/programs\/([^/]+)\.json$/.exec(p))) M.programs[m[1]] = f[p];
      else if ((m = /^content\/works\/([^/]+)\.json$/.exec(p))) M.works.push(Object.assign({ id: m[1] }, f[p]));
      else if ((m = /^content\/series\/([^/]+)\.json$/.exec(p))) M.series.push(Object.assign({ id: m[1] }, f[p]));
    }
    const ord = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));
    M.works.sort(ord); M.series.sort(ord);
    return M;
  }

  /* ---------- блоки ---------- */
  moveBlock(page, from, to) {
    const p = "content/pages/" + page + ".json";
    this.edit(p, (get) => {
      const bl = get(p).blocks;
      if (from < 0 || from >= bl.length || to < 0 || to >= bl.length || from === to) return;
      bl.splice(to, 0, bl.splice(from, 1)[0]);
    }, { label: "Порядок блоков" });
  }
  addBlock(page, block, at) {
    const p = "content/pages/" + page + ".json";
    block = clone(block);
    block.id = block.id || uid();
    this.edit(p, (get) => { const bl = get(p).blocks; bl.splice(at == null ? bl.length : at, 0, block); }, { label: "Новый блок" });
    return block.id;
  }
  removeBlock(page, id) {
    const p = "content/pages/" + page + ".json";
    this.edit(p, (get) => { const o = get(p); o.blocks = o.blocks.filter((b) => b.id !== id); }, { label: "Удалён блок" });
  }
  duplicateBlock(page, id) {
    const p = "content/pages/" + page + ".json";
    let nid = "";
    this.edit(p, (get) => {
      const bl = get(p).blocks, i = bl.findIndex((b) => b.id === id);
      if (i < 0) return;
      const copy = clone(bl[i]);
      copy.id = nid = uid();
      bl.splice(i + 1, 0, copy);
    }, { label: "Копия блока" });
    return nid;
  }
  /* работы: порядок — по полю order */
  reorderWorks(ids) {
    const paths = ids.map((id) => "content/works/" + id + ".json");
    this.edit(paths, (get) => { ids.forEach((id, i) => { get("content/works/" + id + ".json").order = (i + 1) * 10; }); }, { label: "Порядок работ" });
  }
}
