/*
  GitHub API прямо из браузера, токеном владельца (токен хранится только в браузере и никуда, кроме api.github.com, не уходит).
  Всё, что меняется за одну публикацию, уходит ОДНИМ коммитом: blobs → tree → commit → ref (Git Data API).
*/
export const REPO = { owner: "aaavgust", name: "a_a_avgust-site", branch: "main" };
const API = "https://api.github.com";

export class GhError extends Error {
  constructor(message, status, kind) { super(message); this.status = status; this.kind = kind || ""; }
}

function b64(bytes) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}
function utf8b64(text) { return b64(new TextEncoder().encode(text)); }

export class GitHub {
  constructor(token, opt = {}) {
    this.token = token;
    this.repo = opt.repo || REPO;
    this.fetch = opt.fetch || ((...a) => globalThis.fetch(...a));
  }
  async req(method, path, body, accept) {
    let r;
    try {
      r = await this.fetch(path.startsWith("http") ? path : API + path, {
        method, headers: Object.assign({ Authorization: "Bearer " + this.token, Accept: accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw new GhError("Нет связи с GitHub. Проверьте интернет и попробуйте ещё раз.", 0, "network"); }
    if (r.status === 401) throw new GhError("GitHub не принял токен: он неверный или истёк. Войдите заново.", 401, "auth");
    if (r.status === 403 && r.headers.get("x-ratelimit-remaining") === "0") throw new GhError("GitHub временно ограничил запросы. Подождите минуту.", 403, "rate");
    if (!r.ok) {
      let msg = "";
      try { msg = (await r.json()).message || ""; } catch (e) { msg = ""; }
      throw new GhError(msg || "GitHub ответил " + r.status, r.status, r.status === 403 ? "forbidden" : r.status === 404 ? "notfound" : r.status === 422 ? "unprocessable" : "");
    }
    if (accept && accept.indexOf("raw") !== -1) return r.arrayBuffer();
    return r.status === 204 ? null : r.json();
  }
  get base() { return "/repos/" + this.repo.owner + "/" + this.repo.name; }

  /* кто вошёл и может ли он менять сайт */
  async whoami() {
    const user = await this.req("GET", "/user");
    let repo;
    try { repo = await this.req("GET", this.base); } catch (e) {
      if (e.status === 404) throw new GhError("У этого токена нет доступа к репозиторию " + this.repo.owner + "/" + this.repo.name + ". Создайте токен с доступом к нему.", 404, "norepo");
      throw e;
    }
    if (!repo.permissions || !repo.permissions.push) throw new GhError("Этот аккаунт может только смотреть репозиторий, но не менять. Нужно право записи (Contents: Read and write).", 403, "readonly");
    return { login: user.login, avatar: user.avatar_url };
  }

  async head() {
    const ref = await this.req("GET", this.base + "/git/ref/heads/" + this.repo.branch);
    return ref.object.sha;
  }

  /* весь контент (content/**) одним запросом GraphQL, точно на коммите head */
  async loadContent(head) {
    const q = `query($o:String!,$n:String!,$e:String!){repository(owner:$o,name:$n){object(expression:$e){... on Tree{entries{name type object{... on Blob{text oid} ... on Tree{entries{name type object{... on Blob{text oid}}}}}}}}}}`;
    const r = await this.req("POST", "/graphql", { query: q, variables: { o: this.repo.owner, n: this.repo.name, e: head + ":content" } });
    if (r.errors) throw new GhError("GitHub не отдал контент: " + r.errors.map((x) => x.message).join("; "), 0, "graphql");
    const files = {};
    const tree = r.data.repository.object;
    if (!tree) throw new GhError("В репозитории нет папки content/", 404, "notfound");
    for (const e of tree.entries) {
      if (e.type === "blob" && /\.json$/.test(e.name)) files["content/" + e.name] = { text: e.object.text, sha: e.object.oid };
      if (e.type === "tree") for (const x of e.object.entries || []) if (x.type === "blob" && /\.json$/.test(x.name)) files["content/" + e.name + "/" + x.name] = { text: x.object.text, sha: x.object.oid };
    }
    return files;
  }

  /* список файлов media/ (пути и sha) — чтобы показывать оригиналы в предпросмотре */
  async mediaTree(head) {
    const r = await this.req("GET", this.base + "/git/trees/" + head + "?recursive=1");
    const out = {};
    for (const e of r.tree) if (e.type === "blob" && e.path.startsWith("media/")) out[e.path] = { sha: e.sha, size: e.size };
    return out;
  }
  blobBytes(sha) { return this.req("GET", this.base + "/git/blobs/" + sha, null, "application/vnd.github.raw+json"); }
  async blobText(sha) { return new TextDecoder().decode(new Uint8Array(await this.blobBytes(sha))); }

  /*
    Один коммит со всеми изменениями.
    changes: [{ path, text } | { path, bytes: Uint8Array } | { path, delete: true }]
    Если за это время в main появился чужой коммит, не трогающий наши файлы, — коммит переносится на него;
    если трогает — ошибка kind "conflict".
  */
  async commit(changes, message, baseSha, onStep = () => {}) {
    if (!changes.length) throw new GhError("Нечего публиковать — изменений нет.", 0, "empty");
    onStep("blobs");
    const tree = [];
    let done = 0;
    for (const c of changes) {
      if (c.delete) { tree.push({ path: c.path, mode: "100644", type: "blob", sha: null }); continue; }
      const blob = await this.req("POST", this.base + "/git/blobs", c.bytes ? { content: b64(c.bytes), encoding: "base64" } : { content: utf8b64(c.text), encoding: "base64" });
      tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
      onStep("blob", ++done, changes.length); // ход отправки: файл done из n
    }
    let parent = baseSha;
    for (let attempt = 0; attempt < 3; attempt++) {
      onStep("tree");
      const pc = await this.req("GET", this.base + "/git/commits/" + parent);
      const t = await this.req("POST", this.base + "/git/trees", { base_tree: pc.tree.sha, tree });
      const commit = await this.req("POST", this.base + "/git/commits", { message, tree: t.sha, parents: [parent] });
      onStep("ref");
      try {
        await this.req("PATCH", this.base + "/git/refs/heads/" + this.repo.branch, { sha: commit.sha, force: false });
        return commit.sha;
      } catch (e) {
        if (e.status !== 422 && e.status !== 409) throw e;
        // main ушёл вперёд: можно ли спокойно встать поверх?
        const head = await this.head();
        const theirs = await this.changedBetween(parent, head);
        const clash = changes.filter((c) => theirs.has(c.path)).map((c) => c.path);
        if (clash.length) throw new GhError("Пока вы редактировали, на GitHub изменили эти же файлы: " + clash.slice(0, 5).join(", ") + ". Обновите страницу редактора.", 409, "conflict");
        parent = head;
      }
    }
    throw new GhError("Не получилось записать изменения: на GitHub всё время появляются новые коммиты. Попробуйте ещё раз.", 409, "conflict");
  }

  /* ход сборки в Actions для коммита (нужно право Actions: Read; без него — null) */
  async runFor(sha) {
    try {
      const r = await this.req("GET", this.base + "/actions/runs?head_sha=" + sha + "&per_page=5");
      const run = (r.workflow_runs || [])[0];
      if (!run) return { status: "queued" };
      let steps = [];
      if (run.status !== "queued") {
        const j = await this.req("GET", this.base + "/actions/runs/" + run.id + "/jobs");
        steps = ((j.jobs || [])[0] || {}).steps || [];
      }
      return { id: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion, steps: steps.map((s) => ({ name: s.name, status: s.status, conclusion: s.conclusion })) };
    } catch (e) {
      if (e.status === 403 || e.status === 404) return null;
      throw e;
    }
  }

  /* какие файлы изменились между двумя коммитами */
  async changedBetween(a, b) {
    const cmp = await this.req("GET", this.base + "/compare/" + a + "..." + b);
    return new Set((cmp.files || []).map((f) => f.filename));
  }

  /* история правок контента */
  async history(n = 30) {
    const r = await this.req("GET", this.base + "/commits?path=content&per_page=" + n + "&sha=" + this.repo.branch);
    return r.map((c) => ({ sha: c.sha, message: c.commit.message.split("\n")[0], date: c.commit.author.date, author: (c.author && c.author.login) || c.commit.author.name }));
  }
  /* содержимое content/ на старом коммите: { path: sha } */
  async contentShas(sha) {
    const r = await this.req("GET", this.base + "/git/trees/" + sha + "?recursive=1");
    const out = {};
    for (const e of r.tree) if (e.type === "blob" && e.path.startsWith("content/") && /\.json$/.test(e.path)) out[e.path] = e.sha;
    return out;
  }
}
