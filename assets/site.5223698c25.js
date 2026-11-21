/* a_a_avgust — сайт: тема, меню, появление блоков, фильтр серий, полноэкранный просмотр, свежая версия программы. */
(function () {
  "use strict";
  var d = document, root = d.documentElement;
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- тема: по системе, кнопка запоминает выбор ---------- */
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function stored() { try { return localStorage.getItem("av-theme"); } catch (e) { return null; } }
  function sys() { return mq && mq.matches ? "dark" : "light"; }
  $$(".theme-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { if (next === sys()) localStorage.removeItem("av-theme"); else localStorage.setItem("av-theme", next); } catch (e) { /* без памяти */ }
    });
  });
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { var s = stored(); if (s !== "dark" && s !== "light") root.setAttribute("data-theme", sys()); });

  /* ---------- скрытый вход для автора: Shift+Alt+A (на Mac — Shift+Option+A) ---------- */
  d.addEventListener("keydown", function (e) {
    if (e.shiftKey && e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyA") { e.preventDefault(); location.href = "/admin/"; }
  });

  /* ---------- меню на телефоне ---------- */
  var mb = $(".menu-btn"), nav = $("#nav");
  if (mb && nav) {
    var label = mb.getAttribute("aria-label"), closeL = mb.getAttribute("data-close");
    var setOpen = function (open) {
      nav.classList.toggle("open", open);
      root.classList.toggle("menu-open", open);
      mb.setAttribute("aria-expanded", open ? "true" : "false");
      mb.setAttribute("aria-label", open ? closeL : label);
    };
    mb.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); mb.focus(); } });
    d.addEventListener("click", function (e) { if (nav.classList.contains("open") && !nav.contains(e.target) && !mb.contains(e.target)) setOpen(false); });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
    // «Назад» в Safari возвращает страницу из памяти — меню не должно остаться открытым
    window.addEventListener("pageshow", function (e) { if (e.persisted) setOpen(false); });
  }

  /* ---------- появление при прокрутке ---------- */
  var rv = $$(".rv");
  if (reduce || !("IntersectionObserver" in window)) rv.forEach(function (el) { el.classList.add("in"); });
  else {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    // то, что видно сразу при открытии, показывается без анимации — иначе главный текст экрана появляется с опозданием
    var fold = window.innerHeight;
    rv.forEach(function (el) { if (el.getBoundingClientRect().top < fold) el.classList.add("in", "now"); else io.observe(el); });
  }

  /* ---------- фильтр серий ---------- */
  var chips = $$(".filters [data-f]");
  function applyFilter(id, push) {
    var ok = chips.some(function (c) { return c.getAttribute("data-f") === id; });
    if (!ok) id = "";
    chips.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-f") === id ? "true" : "false"); });
    $$(".g-item").forEach(function (li) { li.hidden = !!id && li.getAttribute("data-s") !== id; });
    $$(".s-note").forEach(function (p) { p.hidden = p.getAttribute("data-sn") !== id; });
    if (push) { try { history.replaceState(null, "", id ? "#s=" + encodeURIComponent(id) : location.pathname); } catch (e) { /* file:// */ } }
  }
  if (chips.length) {
    chips.forEach(function (c) { c.addEventListener("click", function () { applyFilter(c.getAttribute("data-f"), true); }); });
    var m = /^#s=(.+)$/.exec(location.hash);
    if (m) applyFilter(decodeURIComponent(m[1]), false);
  }

  /* ---------- полноэкранный просмотр ---------- */
  var dlg = $("#viewer");
  if (dlg && typeof dlg.showModal === "function") {
    var box = $(".v-img", dlg), cap = $(".v-t", dlg), num = $(".v-n", dlg);
    var list = [], btns = [], cur = 0, opener = null;
    var mk = function (it) {
      var p = d.createElement("picture");
      if (/ nopic/.test(root.className)) it = { j: it.j, x: it.x, y: it.y, alt: it.alt }; // AVIF/WebP здесь не показываются — сразу JPEG
      if (it.a) { var s1 = d.createElement("source"); s1.type = "image/avif"; s1.srcset = it.a; s1.sizes = "100vw"; p.appendChild(s1); }
      if (it.w) { var s2 = d.createElement("source"); s2.type = "image/webp"; s2.srcset = it.w; s2.sizes = "100vw"; p.appendChild(s2); }
      var img = d.createElement("img");
      img.src = it.j; img.alt = it.alt || ""; if (it.x) { img.width = it.x; img.height = it.y; }
      img.decoding = "async";
      p.appendChild(img);
      return p;
    };
    var visible = function () { return btns.filter(function (b) { var li = b.closest(".g-item"); return !li || !li.hidden; }); };
    var show = function (i) {
      var vis = visible();
      if (!vis.length) return;
      cur = (i + vis.length) % vis.length;
      var b = vis[cur], it = list[Number(b.getAttribute("data-v"))] || {};
      var pic = mk(it), img = pic.querySelector("img");
      img.className = "loading";
      shown = { vis: vis, b: b, at: cur };
      box.replaceChildren(pic);
      cap.textContent = it.t || "";
      num.textContent = (cur + 1) + " / " + vis.length;
    };
    // загрузилась картинка просмотра (в т. ч. запасная копия после отказа AVIF) — показать и подгрузить соседние
    // в том же формате, что выбрал браузер (AVIF, WebP или JPEG)
    var shown = null;
    box.addEventListener("load", function (e) {
      var img = e.target;
      if (img.tagName !== "IMG" || !shown) return;
      img.className = "";
      var vis = shown.vis, at = shown.at;
      var fmt = /\.avif(\?|$)/.test(img.currentSrc) ? "a" : /\.webp(\?|$)/.test(img.currentSrc) ? "w" : "";
      [at + 1, at - 1].forEach(function (k) {
        var nb = vis[(k + vis.length) % vis.length], nit = list[Number(nb.getAttribute("data-v"))];
        if (!nit || nb === shown.b) return;
        var pre = new Image();
        pre.sizes = "100vw";
        if (fmt && nit[fmt]) pre.srcset = nit[fmt];
        pre.src = nit.j;
      });
    }, true);
    $$("[data-viewer]").forEach(function (group) {
      var data = [];
      try { data = JSON.parse(($(".vdata", group) || {}).textContent || "[]"); } catch (e) { data = []; }
      $$("[data-v]", group).forEach(function (b) {
        b.addEventListener("click", function () {
          list = data;
          btns = $$("[data-v]", group);
          opener = b;
          dlg.showModal();
          show(visible().indexOf(b));
        });
      });
    });
    $(".v-x", dlg).addEventListener("click", function () { dlg.close(); });
    $(".v-prev", dlg).addEventListener("click", function () { show(cur - 1); });
    $(".v-next", dlg).addEventListener("click", function () { show(cur + 1); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(cur + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(cur - 1); }
      else if (e.key === "Home") { e.preventDefault(); show(0); }
      else if (e.key === "End") { e.preventDefault(); show(-1); }
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.classList.contains("v-stage") || e.target === box) dlg.close(); });
    dlg.addEventListener("close", function () { box.replaceChildren(); if (opener) opener.focus(); });
    // свайп
    // двумя пальцами — увеличение (жест браузера); пока картинка увеличена, свайпы не листают
    var sx = 0, sy = 0, st = 0, multi = false;
    var zoomed = function () { return window.visualViewport && visualViewport.scale > 1.02; };
    dlg.addEventListener("touchstart", function (e) { var t = e.touches[0]; multi = e.touches.length > 1; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    dlg.addEventListener("touchmove", function (e) { if (e.touches.length > 1) multi = true; }, { passive: true });
    dlg.addEventListener("touchend", function (e) {
      if (multi || zoomed()) { if (!e.touches.length) multi = false; return; }
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 800 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) show(cur + (dx < 0 ? 1 : -1));
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.6) dlg.close();
    }, { passive: true });
  }

  /* ---------- скопировать адрес ---------- */
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var span = $("span", b), was = span.textContent;
      var done = function () { span.textContent = b.getAttribute("data-done"); setTimeout(function () { span.textContent = was; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.getAttribute("data-copy")).then(done, function () { location.href = "mailto:" + b.getAttribute("data-copy"); });
      else location.href = "mailto:" + b.getAttribute("data-copy");
    });
  });

  /* ---------- кнопка «Скачать»: при открытии страницы ещё раз спрашиваем GitHub о последнем выпуске ---------- */
  var rel = $$("[data-release]");
  if (rel.length && window.fetch) {
    var repos = {};
    rel.forEach(function (el) { var r = el.getAttribute("data-release"); if (/^[\w.-]+\/[\w.-]+$/.test(r)) (repos[r] = repos[r] || []).push(el); });
    var en = root.lang === "en";
    var meta = function (j, a) {
      var ver = String(j.tag_name).replace(/^v/i, ""), date = (j.published_at || "").slice(0, 10), dt = date, mb = a.size / 1048576;
      try { dt = new Intl.DateTimeFormat(en ? "en-GB" : "ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z")).replace(/\s*г\.$/, ""); } catch (e) { dt = date; }
      var size = (mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1)) + (en ? " MB" : " МБ");
      return (en ? "Version " : "Версия ") + ver + (dt ? (en ? " of " : " от ") + dt : "") + " · " + (en ? size : size.replace(".", ","));
    };
    var owners = {};
    var check = function () {
      Object.keys(repos).forEach(function (repo) {
        var els = repos[repo];
        // запросы, которые отвечают 200 даже без выпуска или репозитория, — чтобы не было ошибок в консоли
        var H = { headers: { Accept: "application/vnd.github+json" } };
        var owner = repo.split("/")[0], name = repo.split("/")[1].toLowerCase();
        (owners[owner] = owners[owner] || fetch("https://api.github.com/users/" + owner + "/repos?per_page=100&sort=updated", H).then(function (r) { return r.ok ? r.json() : []; }))
          .then(function (list) {
            if (!Array.isArray(list) || !list.some(function (x) { return String(x.name).toLowerCase() === name; })) return null;
            return fetch("https://api.github.com/repos/" + repo + "/releases?per_page=10", H).then(function (r) { return r.ok ? r.json() : []; });
          })
          .then(function (rels) {
            var j = (rels || []).filter(function (x) { return !x.draft && !x.prerelease; })[0];
            if (!j || !j.tag_name) return;
            var pre = "https://github.com/" + repo + "/releases/download/";
            var a = (j.assets || []).filter(function (x) { return /\.dmg$/i.test(x.name) && String(x.browser_download_url).indexOf(pre) === 0; })[0];
            if (!a) return;
            els.forEach(function (el) {
              if (el.getAttribute("data-tag") === j.tag_name && el.tagName === "A") return;
              var link = el;
              if (el.tagName !== "A") { // «Скоро на GitHub» → настоящая кнопка
                link = d.createElement("a");
                link.className = el.className.replace(/\s*is-off/, "");
                Array.prototype.forEach.call(el.attributes, function (at) { if (/^data-/.test(at.name)) link.setAttribute(at.name, at.value); });
                link.innerHTML = el.innerHTML;
                var lb = link.querySelector("span"); if (lb) lb.textContent = el.getAttribute("data-label");
                el.replaceWith(link);
              }
              link.href = a.browser_download_url;
              link.setAttribute("data-tag", j.tag_name);
              var m = link.closest(".dl, .end, .app-txt");
              var mt = m && m.querySelector("[data-release-meta]");
              if (mt) mt.textContent = meta(j, a);
            });
          })
          .catch(function () { /* нет сети или лимит GitHub — остаётся то, что знала сборка */ });
      });
    };
    if (d.readyState === "complete") check(); else window.addEventListener("load", function () { if (window.requestIdleCallback) window.requestIdleCallback(check, { timeout: 3000 }); else setTimeout(check, 300); });
  }
})();
