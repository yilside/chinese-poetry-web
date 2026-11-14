/* 诗词阁 —— 本地古诗词检索 */
(function () {
  'use strict';

  var D = {
    tang: window.POETRY_TANG || [],
    song: window.POETRY_SONG || null,
    authors: window.POETRY_AUTHORS || {}
  };
  var T2S = window.T2S || {};
  var CJK = /[\u3400-\u4DBF\u4E00-\u9FFF]/g;
  var PAGE = 40;
  var DYNASTY = { tang: '唐', song: '宋' };

  var S = {
    scope: 'tang',
    conv: 'simp',
    q: '',
    author: null,
    result: [],
    shown: 0
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var el = {
    boot: $('#boot'),
    q: $('#q'),
    list: $('#list'),
    more: $('#more'),
    meta: $('#meta'),
    authors: $('#authors'),
    scope: $('#scope'),
    btnRandom: $('#btnRandom'),
    btnConv: $('#btnConv'),
    modal: $('#modal'),
    paper: $('#paper'),
    toast: $('#toast')
  };

  var simpCache = { tang: null, song: null };

  function conv(text) {
    if (S.conv === 'trad') return text;
    return text.replace(CJK, function (c) { return T2S[c] || c; });
  }

  function esc(text) {
    return text.replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  function currentTerms() {
    var raw = S.q.trim();
    if (!raw) return [];
    return conv(raw).split(/\s+/).filter(Boolean);
  }

  /* 把整个 scope 转成简体检索串，只在需要时构建一次 */
  function haystack(scope) {
    if (simpCache[scope]) return simpCache[scope];
    var rows = D[scope] || [];
    var out = new Array(rows.length);
    for (var i = 0; i < rows.length; i++) {
      out[i] = (rows[i][0] + ' ' + rows[i][1] + ' ' + rows[i][2])
        .replace(CJK, function (c) { return T2S[c] || c; });
    }
    simpCache[scope] = out;
    return out;
  }

  function highlight(text) {
    var terms = currentTerms();
    if (!terms.length) return esc(text);
    var ranges = [];
    for (var t = 0; t < terms.length; t++) {
      var term = terms[t];
      var from = 0;
      while (true) {
        var at = text.indexOf(term, from);
        if (at === -1) break;
        ranges.push([at, at + term.length]);
        from = at + term.length;
      }
    }
    if (!ranges.length) return esc(text);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    for (var r = 0; r < ranges.length; r++) {
      var last = merged[merged.length - 1];
      if (last && ranges[r][0] <= last[1]) {
        last[1] = Math.max(last[1], ranges[r][1]);
      } else {
        merged.push([ranges[r][0], ranges[r][1]]);
      }
    }
    var out = '';
    var pos = 0;
    for (var m = 0; m < merged.length; m++) {
      out += esc(text.slice(pos, merged[m][0]));
      out += '<mark>' + esc(text.slice(merged[m][0], merged[m][1])) + '</mark>';
      pos = merged[m][1];
    }
    return out + esc(text.slice(pos));
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function runSearch() {
    var rows = D[S.scope] || [];
    var terms = currentTerms();
    var idx = [];
    var i, k, ok, hay;

    if (!terms.length && !S.author) {
      for (i = 0; i < rows.length; i++) idx.push(i);
      shuffle(idx);
    } else {
      hay = terms.length ? haystack(S.scope) : null;
      for (i = 0; i < rows.length; i++) {
        if (S.author && rows[i][0] !== S.author) continue;
        if (terms.length) {
          ok = true;
          for (k = 0; k < terms.length; k++) {
            if (hay[i].indexOf(terms[k]) === -1) { ok = false; break; }
          }
          if (!ok) continue;
        }
        idx.push(i);
      }
    }
    S.result = idx;
    S.shown = 0;
    renderMeta();
    renderList(true);
  }

  function renderMeta() {
    var parts = [];
    parts.push('共 ' + S.result.length.toLocaleString() + ' 首');
    var chips = '';
    if (S.author) {
      chips += '<span class="chip" data-clear="author">' + esc(conv(S.author)) + ' ×</span>';
    }
    if (S.q.trim()) {
      chips += '<span class="chip" data-clear="q">“' + esc(conv(S.q.trim())) + '” ×</span>';
    }
    el.meta.innerHTML = '<span>' + parts.join(' · ') + '</span>' + chips;
  }

  function renderList(reset) {
    if (reset) {
      el.list.innerHTML = '';
      el.list.style.display = '';
    }
    if (!S.result.length) {
      el.list.style.display = 'block';
      el.list.innerHTML = '<div class="empty"><em>空</em>没有找到相关的篇章，换个词试试</div>';
      el.more.innerHTML = '';
      return;
    }
    el.list.style.display = '';
    var end = Math.min(S.shown + PAGE, S.result.length);
    var frag = document.createDocumentFragment();
    for (var k = S.shown; k < end; k++) {
      var i = S.result[k];
      var row = D[S.scope][i];
      var preview = row[2].split('\n').slice(0, 2).join('　');
      var art = document.createElement('article');
      art.className = 'item';
      art.setAttribute('data-i', i);
      art.innerHTML =
        '<div class="who">' + esc(DYNASTY[S.scope] + ' · ' + conv(row[0])) + '</div>' +
        '<h3>' + highlight(conv(row[1])) + '</h3>' +
        '<p>' + highlight(conv(preview)) + '</p>';
      frag.appendChild(art);
    }
    el.list.appendChild(frag);
    S.shown = end;
    renderMore();
  }

  function renderMore() {
    if (S.shown >= S.result.length) { el.more.innerHTML = ''; return; }
    el.more.innerHTML = '<button id="moreBtn">再看一些 · 还剩 ' +
      (S.result.length - S.shown).toLocaleString() + ' 首</button>';
  }

  function buildAuthors() {
    var rows = D[S.scope] || [];
    var count = new Map();
    for (var i = 0; i < rows.length; i++) {
      count.set(rows[i][0], (count.get(rows[i][0]) || 0) + 1);
    }
    var top = Array.from(count.entries())
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 20);
    var html = '';
    for (var t = 0; t < top.length; t++) {
      var name = top[t][0];
      var active = S.author === name ? ' active' : '';
      html += '<button class="a' + active + '" data-a="' + esc(name) + '">' +
        '<span>' + esc(conv(name)) + '</span>' +
        '<span class="n">' + top[t][1] + '</span></button>';
    }
    el.authors.innerHTML = html;
  }

  /* ---------- 详情 ---------- */

  function openDetail(i) {
    var row = D[S.scope][i];
    if (!row) return;
    var lines = row[2].split('\n');
    var bio = D.authors[row[0]] || '';
    var bodyHtml = '';
    for (var k = 0; k < lines.length; k++) {
      if (!lines[k].trim()) continue;
      bodyHtml += '<p>' + highlight(conv(lines[k])) + '</p>';
    }
    el.paper.innerHTML =
      '<button class="close" data-act="close" aria-label="关闭">×</button>' +
      '<div class="kicker">' + esc(DYNASTY[S.scope] + ' · ' + conv(row[0])) + '</div>' +
      '<h2>' + esc(conv(row[1])) + '</h2>' +
      '<div class="body">' + bodyHtml + '</div>' +
      (bio ? '<div class="bio">' + esc(conv(bio)) + '</div>' : '') +
      '<div class="caption">数据来源：chinese-poetry / ' + (S.scope === 'tang' ? '全唐诗' : '全宋词') + '</div>' +
      '<div class="tools">' +
        '<button class="ghost" data-act="copy">复制全文</button>' +
        '<button class="ghost" data-act="close">关闭</button>' +
      '</div>';
    el.paper.setAttribute('data-i', i);
    el.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    el.modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function copyCurrent() {
    var i = parseInt(el.paper.getAttribute('data-i'), 10);
    var row = D[S.scope][i];
    if (!row) return;
    var text = conv(row[1]) + '\n' + conv(row[0]) + '\n\n' + conv(row[2]);
    var done = function () { toast('已复制到剪贴板'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { toast('复制失败，请手动选择'); }
      document.body.removeChild(ta);
    }
  }

  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
  }

  function randomOne() {
    if (!S.result.length) return;
    var pick = S.result[Math.floor(Math.random() * S.result.length)];
    openDetail(pick);
  }

  /* ---------- 分卷懒加载 ---------- */

  function ensureLoaded(scope, cb) {
    if (scope !== 'song' || D.song) { cb(); return; }
    toast('正在载入宋词…');
    var s = document.createElement('script');
    s.src = 'data/song.js';
    s.onload = function () { D.song = window.POETRY_SONG || []; cb(); };
    s.onerror = function () { toast('宋词数据加载失败，请确认 data/song.js 存在'); };
    document.head.appendChild(s);
  }

  function switchScope(scope) {
    S.scope = scope;
    S.author = null;
    Array.prototype.forEach.call(el.scope.children, function (b) {
      b.classList.toggle('active', b.dataset.s === scope);
    });
    buildAuthors();
    runSearch();
  }

  /* ---------- 事件 ---------- */

  function bind() {
    el.scope.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-s]');
      if (!btn || btn.dataset.s === S.scope) return;
      var target = btn.dataset.s;
      ensureLoaded(target, function () { switchScope(target); });
    });

    var timer = null;
    el.q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        S.q = el.q.value;
        runSearch();
      }, 180);
    });

    el.q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        clearTimeout(timer);
        S.q = el.q.value;
        runSearch();
      }
    });

    el.authors.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-a]');
      if (!btn) return;
      var name = btn.dataset.a;
      S.author = S.author === name ? null : name;
      buildAuthors();
      runSearch();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    el.meta.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-clear]');
      if (!chip) return;
      if (chip.dataset.clear === 'author') S.author = null;
      if (chip.dataset.clear === 'q') { S.q = ''; el.q.value = ''; }
      buildAuthors();
      runSearch();
    });

    el.list.addEventListener('click', function (e) {
      var item = e.target.closest('.item');
      if (item) openDetail(parseInt(item.dataset.i, 10));
    });

    el.more.addEventListener('click', function (e) {
      if (e.target.closest('#moreBtn')) renderList(false);
    });

    el.btnRandom.addEventListener('click', randomOne);

    el.btnConv.addEventListener('click', function () {
      S.conv = S.conv === 'simp' ? 'trad' : 'simp';
      el.btnConv.textContent = S.conv === 'simp' ? '简体' : '繁体';
      el.btnConv.classList.toggle('on', S.conv === 'trad');
      buildAuthors();
      renderMeta();
      renderList(true);
      if (!el.modal.classList.contains('hidden')) {
        openDetail(parseInt(el.paper.getAttribute('data-i'), 10));
      }
    });

    el.modal.addEventListener('click', function (e) {
      if (e.target === el.modal) { closeDetail(); return; }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'close') closeDetail();
      if (act.dataset.act === 'copy') copyCurrent();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !el.modal.classList.contains('hidden')) closeDetail();
      if (e.key === '/' && document.activeElement !== el.q) {
        e.preventDefault();
        el.q.focus();
        el.q.select();
      }
    });

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var near = window.innerHeight + window.scrollY > document.body.offsetHeight - 600;
        if (near && S.shown < S.result.length) renderList(false);
        ticking = false;
      });
    });
  }

  function init() {
    var total = (D.tang || []).length + (D.song || []).length;
    if (!total) {
      el.boot.innerHTML = '<div class="seal">!</div><div>没有读到数据，请先运行 build_data.py</div>';
      return;
    }
    bind();
    buildAuthors();
    runSearch();
    requestAnimationFrame(function () {
      el.boot.classList.add('fade');
      setTimeout(function () { el.boot.style.display = 'none'; }, 500);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
