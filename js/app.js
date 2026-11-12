/* EASY NOOR — offline mushaf reader */
(function () {
'use strict';

var M = window.QM, AY = window.QA, I18 = window.I18N;
var $ = function (s) { return document.querySelector(s); };
var ARD = '٠١٢٣٤٥٦٧٨٩';
var TRS = ['ru', 'en', 'fr', 'es', 'tr', 'ur', 'id', 'zh', 'bn', 'sv'];
var RTL = ['ar', 'ur'];

function num(n) { return String(n).replace(/\d/g, function (d) { return ARD[+d]; }); }
function safeJson(v, d) { try { var x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } }

var K = { lang: 'noor.lang', theme: 'noor.theme', fs: 'noor.fs', font: 'noor.font', mode: 'noor.mode', tr: 'noor.tr', page: 'noor.page', bm: 'noor.bm', read: 'noor.read' };

var state = {
  lang: localStorage.getItem(K.lang) || 'ar',
  theme: localStorage.getItem(K.theme) || 'night',
  fs: +(localStorage.getItem(K.fs) || 30),
  font: localStorage.getItem(K.font) || 'amiri',
  mode: localStorage.getItem(K.mode) || 'page',
  tr: localStorage.getItem(K.tr) || 'off',
  bm: safeJson(localStorage.getItem(K.bm), []),
  read: {},
  page: +(localStorage.getItem(K.page) || 1)
};
(safeJson(localStorage.getItem(K.read), [])).forEach(function (p) { state.read[p] = 1; });

if (!I18[state.lang]) state.lang = 'ar';
if (TRS.indexOf(state.tr) < 0) state.tr = 'off';

/* ---------- page index ---------- */
var PAGES = [], SURAH_START = {};
for (var p = 0; p <= M.pages; p++) PAGES[p] = [];
AY.forEach(function (a, i) {
  PAGES[a[3]].push(i);
  if (a[1] === 1) SURAH_START[a[0]] = a[3];
});
function pageJuz(pg) { var a = AY[PAGES[pg][0]]; return a ? a[4] : 1; }
function pageSurah(pg) { var a = AY[PAGES[pg][0]]; return a ? a[0] : 1; }
function surahName(n) { return M.surahs[n - 1] ? M.surahs[n - 1].ar : ''; }
function trName(n) { var N = window.QTN && window.QTN[state.tr]; return (N && N[n - 1]) ? N[n - 1] : (M.surahs[n - 1] ? M.surahs[n - 1].en : ''); }

/* ---------- i18n ---------- */
function t(key) { var L = I18[state.lang] || I18.ar; return L[key] || I18.ar[key] || key; }
function applyI18n() {
  var L = I18[state.lang] || I18.ar;
  document.documentElement.lang = state.lang;
  document.documentElement.dir = L.dir;
  document.body.dir = L.dir;
  var nodes = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < nodes.length; i++) {
    var k = nodes[i].getAttribute('data-i18n');
    if (L[k]) nodes[i].textContent = L[k];
  }
  var ip = $('#idxSearch'); if (ip) ip.placeholder = t('search_idx_ph');
  var sp = $('#srch'); if (sp) sp.placeholder = t('search_ph');
  document.title = t('app') + ' · ' + (state.lang === 'ar' ? 'القرآن الكريم' : 'Qur’an');
  var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0a1422');
}

/* ---------- theme / font ---------- */
function applyTheme() {
  document.body.className = 'theme-' + state.theme;
  document.body.dataset.view = document.body.dataset.view || 'home';
  document.documentElement.style.setProperty('--fs', state.fs + 'px');
  document.documentElement.style.setProperty('--font-ar', state.font === 'amiri' ? '"Amiri",serif' : '"Noto Naskh Arabic","Amiri",serif');
  var chips = document.querySelectorAll('#themeChips .chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('on', chips[i].getAttribute('data-theme') === state.theme);
  var m = document.querySelector('meta[name=theme-color]');
  if (m) {
    var c = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    if (c) m.setAttribute('content', c);
  }
}

/* ---------- toast ---------- */
var toastTm;
function toast(msg) {
  var el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTm); toastTm = setTimeout(function () { el.classList.remove('show'); }, 1700);
}

/* ---------- views ---------- */
function show(view) {
  document.body.dataset.view = view;
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-go') === view);
  if (view === 'home') { renderHome(); var sc = $('#homeScroll'); if (sc) sc.scrollTop = 0; }
  if (view === 'index') { var s1 = $('#idxSearch'); $('#surahList2') && renderSurahList($('#surahList2'), ''); if (s1) setTimeout(function(){s1.focus()},120); }
  if (view === 'juz') renderJuz();
  if (view === 'saved') renderSaved();
  if (view === 'search') { setTimeout(function () { var el = $('#srch'); if (el) el.focus(); }, 120); }
  if (view === 'settings') renderSettings();
}

/* ---------- home ---------- */
function pctRead() { return Math.round((Object.keys(state.read).length / M.pages) * 100); }

function renderHome() {
  var pg = state.page || 1;
  $('#contSub').textContent = surahName(pageSurah(pg)) + ' · ' + t('page_of') + ' ' + num(pg) + ' · ' + t('juz_of') + ' ' + num(pageJuz(pg));
  var pct = pctRead();
  $('#ringTxt').textContent = pct + '%';
  var ring = $('#ringFg');
  if (ring) ring.style.strokeDashoffset = String(113 - (113 * pct / 100));
  renderSurahList($('#surahList'), '');
}

function renderSurahList(host, filter) {
  if (!host) return;
  var L = I18[state.lang] || I18.ar;
  var rows = [], f = (filter || '').trim().toLowerCase();
  M.surahs.forEach(function (s) {
    var nm = s.ar, en = s.en;
    var tn = (state.tr !== 'off' && window.QTN && window.QTN[state.tr]) ? window.QTN[state.tr][s.n - 1] : '';
    var hay = (nm + ' ' + en + ' ' + (tn || '') + ' ' + s.n).toLowerCase();
    if (f && hay.indexOf(f) < 0) return;
    rows.push(
      '<button class="srow" data-pg="' + s.pg + '">' +
        '<span class="snum">' + num(s.n) + '</span>' +
        '<span class="smain">' +
          '<span class="sname">سُورَةُ ' + nm + '</span>' +
          '<span class="smeta">' + (state.lang !== 'ar' ? en + ' · ' : '') + num(s.c) + ' ' + (state.lang === 'ar' ? 'آية' : (I18[state.lang] || I18.ar).ayah_word) + ' · ' + (s.type === 'M' ? t('medinan') : t('meccan')) + ' · ' + t('page_of') + ' ' + num(s.pg) + '</span>' +
        '</span>' +
        '<span class="sarrow">›</span>' +
      '</button>');
  });
  host.innerHTML = rows.join('') || '<div class="empty">' + t('search_none') + '</div>';
}

function renderJuz() {
  var h = '';
  M.juz.forEach(function (j) {
    h += '<button class="juz" data-pg="' + j.pg + '"><b>' + num(j.n) + '</b><span>' + t('page_of') + ' ' + num(j.pg) + '</span></button>';
  });
  $('#juzGrid').innerHTML = h;
}

function renderSaved() {
  var host = $('#savedList');
  if (!state.bm.length) { host.innerHTML = '<div class="empty">' + t('saved_empty') + '</div>'; return; }
  var h = '';
  state.bm.slice().reverse().forEach(function (b) {
    h += '<div class="saved-item" data-pg="' + b.p + '" data-s="' + b.s + '" data-a="' + b.a + '">' +
      '<div class="saved-txt"><div class="saved-meta">سورة ' + surahName(b.s) + ' · ' + t('ayah_word') + ' ' + num(b.a) + '</div>' + b.t + '</div>' +
      '<button class="del" data-del="' + b.s + ':' + b.a + '">✕</button>' +
    '</div>';
  });
  host.innerHTML = h;
}

/* ---------- translation loading ---------- */
var trPromise = {};
function loadTr(lang) {
  if (lang === 'off' || lang === 'ar') return Promise.resolve(true);
  if (window.QT && window.QT[lang]) return Promise.resolve(true);
  if (trPromise[lang]) return trPromise[lang];
  trPromise[lang] = new Promise(function (res) {
    var s = document.createElement('script');
    s.src = 'data/tr/' + lang + '.js';
    s.onload = function () { res(true); };
    s.onerror = function () { res(false); };
    document.head.appendChild(s);
  });
  return trPromise[lang];
}

/* ---------- reader ---------- */
var readTimer;

function openPage(pg, anim) {
  if (!pg || pg < 1) pg = 1;
  if (pg > M.pages) pg = M.pages;
  state.page = pg;
  localStorage.setItem(K.page, String(pg));
  show('read');
  renderRead(anim);
}

function renderRead(anim) {
  var pg = state.page;
  var idxs = PAGES[pg] || [];
  var host = $('#reader');
  var wrap = document.querySelector('.reader-wrap');
  var sFirst = pageSurah(pg), jz = pageJuz(pg);

  $('#rSurah').textContent = 'سُورَةُ ' + surahName(sFirst);
  $('#rSub').textContent = t('juz_of') + ' ' + num(jz) + ' · ' + t('page_of') + ' ' + num(pg) + ' ' + t('of') + ' ' + num(M.pages);
  $('#rRange').value = pg;
  $('#rNum').textContent = num(pg) + ' / ' + num(M.pages);
  $('#rPrev').disabled = pg <= 1;
  $('#rNext').disabled = pg >= M.pages;

  var L = I18[state.lang] || I18.ar;
  var trLang = state.tr;

  if (state.mode === 'ayah' && trLang !== 'off' && !(window.QT && window.QT[trLang])) {
    host.innerHTML = '<div class="loading"><div class="spin"></div>' + t('tr_loading') + '</div>';
    loadTr(trLang).then(function (ok) {
      if (!ok) { state.tr = 'off'; localStorage.setItem(K.tr, 'off'); }
      renderRead(false);
    });
    return;
  }

  var html = '<div class="paper">';
  html += '<div class="pg-head"><span>' + t('juz_of') + ' ' + num(jz) + '</span><span>' + num(pg) + '</span></div>';

  if (state.mode === 'ayah') {
    html += ayahModeHTML(idxs, trLang);
  } else {
    html += mushafPageHTML(idxs);
  }
  html += '<div class="pg-foot"><span class="line"></span><span>' + num(pg) + '</span><span class="line"></span></div>';
  html += '</div>';
  host.innerHTML = html;
  host.classList.remove('flip', 'flip-l', 'flip-r');
  if (anim) { void host.offsetWidth; host.classList.add(anim > 0 ? 'flip-l' : 'flip-r'); }
  if (wrap) wrap.scrollTop = 0;

  // bookmark button state
  var firstBm = idxs.some(function (i) { return isBm(AY[i][0], AY[i][1]); });
  $('#rBm').classList.toggle('on', firstBm);
  $('#rTrBtn').classList.toggle('on', state.tr !== 'off' && state.mode === 'ayah');

  clearTimeout(readTimer);
  var cur = pg;
  readTimer = setTimeout(function () { if (state.page === cur) markRead(pg); }, 3200);
}

function bandHTML(sn) {
  return '<div class="surah-band"><i>❁</i><b>سُورَةُ ' + surahName(sn) + '</b><i>❁</i></div>';
}

function mushafPageHTML(idxs) {
  var parts = [], buf = [];
  function flush() {
    if (buf.length) { parts.push('<div class="mushaf">' + buf.join(' ') + '</div>'); buf = []; }
  }
  idxs.forEach(function (i) {
    var a = AY[i], sn = a[0], an = a[1];
    if (an === 1) {
      flush();
      parts.push(bandHTML(sn));
      var sm = M.surahs[sn - 1];
      if (sm && sm.bism && sn !== 1) parts.push('<div class="bism">' + M.bism + '</div>');
    }
    var mark = '<span class="am">' + num(an) + '</span>';
    var sj = a[5] ? '<span class="sajda" title="sajda">۩</span>' : '';
    buf.push('<span class="ay" data-s="' + sn + '" data-a="' + an + '" data-p="' + a[3] + '">' + a[2] + ' ' + mark + sj + '</span>');
  });
  flush();
  return parts.join('');
}

function ayahModeHTML(idxs, trLang) {
  var out = '';
  idxs.forEach(function (i) {
    var a = AY[i], sn = a[0], an = a[1];
    var tr = '';
    if (trLang !== 'off' && window.QT && window.QT[trLang]) {
      var x = window.QT[trLang][i] || '';
      if (x) tr = '<div class="ayah-tr" dir="' + (RTL.indexOf(trLang) >= 0 ? 'rtl' : 'ltr') + '">' + esc(x) + '</div>';
    }
    var bm = isBm(sn, an) ? ' tap' : '';
    out += '<div class="ayah' + bm + '" data-s="' + sn + '" data-a="' + an + '" data-p="' + a[3] + '">' +
      '<span class="ayah-no">' + num(sn) + ':' + num(an) + '</span>' +
      '<div class="ayah-txt">' + a[2] + ' <span class="am">' + num(an) + '</span></div>' + tr + '</div>';
  });
  return out;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- bookmarks / khatma ---------- */
function bmKey(s, a) { return s + ':' + a; }
function isBm(s, a) {
  for (var i = 0; i < state.bm.length; i++) if (state.bm[i].s === s && state.bm[i].a === a) return true;
  return false;
}
function toggleBm(s, a, pg) {
  var k = bmKey(s, a), found = -1;
  for (var i = 0; i < state.bm.length; i++) if (bmKey(state.bm[i].s, state.bm[i].a) === k) found = i;
  if (found >= 0) { state.bm.splice(found, 1); toast(t('bookmark_remove')); }
  else {
    var idx = null;
    for (var j = 0; j < AY.length; j++) if (AY[j][0] === s && AY[j][1] === a) { idx = j; break; }
    state.bm.push({ s: s, a: a, p: pg || (idx != null ? AY[idx][3] : state.page), t: idx != null ? AY[idx][2] : '' });
    toast(t('bookmark_add'));
  }
  localStorage.setItem(K.bm, JSON.stringify(state.bm));
  if (document.body.dataset.view === 'saved') renderSaved();
  if (document.body.dataset.view === 'read') renderRead(false);
}

function markRead(pg) {
  if (state.read[pg]) return;
  state.read[pg] = 1;
  localStorage.setItem(K.read, JSON.stringify(Object.keys(state.read).map(Number)));
}

/* ---------- settings ---------- */
function renderSettings() {
  var tch = document.querySelectorAll('#themeChips .chip');
  for (var i = 0; i < tch.length; i++) tch[i].classList.toggle('on', tch[i].getAttribute('data-theme') === state.theme);
  $('#fsRange').value = state.fs;
  $('#fontSel').value = state.font;
  var mb = document.querySelectorAll('#modeSeg .seg-b');
  for (var j = 0; j < mb.length; j++) mb[j].classList.toggle('on', mb[j].getAttribute('data-mode') === state.mode);
  $('#khatmaPct').textContent = pctRead() + '%';
  var ui = $('#uiLangSel');
  if (!ui.options.length) {
    Object.keys(I18).forEach(function (l) {
      var o = document.createElement('option'); o.value = l; o.textContent = I18[l].name; ui.appendChild(o);
    });
  }
  ui.value = state.lang;
  var ts = $('#trLangSel');
  if (!ts.options.length) {
    var o0 = document.createElement('option'); o0.value = 'off'; o0.setAttribute('data-i18n', 'tr_off'); o0.textContent = t('tr_off'); ts.appendChild(o0);
    TRS.forEach(function (l) {
      var o = document.createElement('option'); o.value = l; o.textContent = (window.TR_NAMES && window.TR_NAMES[l]) || l; ts.appendChild(o);
    });
  }
  ts.options[0].textContent = t('tr_off');
  ts.value = state.tr;
}

/* ---------- search ---------- */
var NORM = null;
function stripChars(s) {
  var out = '', map = [];
  for (var i = 0; i < s.length; i++) {
    var c = s[i], code = s.charCodeAt(i);
    if ((code >= 0x0610 && code <= 0x061A) || (code >= 0x064B && code <= 0x065F) ||
        code === 0x0670 || (code >= 0x06D6 && code <= 0x06ED) || code === 0x0640 || code === 0x200C || code === 0x200D) continue;
    if (c === 'أ' || c === 'إ' || c === 'آ' || c === 'ٱ' || c === 'ٲ' || c === 'ٳ') c = 'ا';
    else if (c === 'ى' || c === 'ي' || c === 'ئ') c = 'ي';
    else if (c === 'ؤ') c = 'و';
    else if (c === 'ة') c = 'ه';
    out += c.toLowerCase();
    map.push(i);
  }
  return { s: out, map: map };
}
function buildNorm() {
  if (NORM) return NORM;
  NORM = AY.map(function (a) { return stripChars(a[2]); });
  return NORM;
}
function normQuery(q) { return stripChars(q).s; }

function hlAyah(i, qn) {
  var A = AY[i], st = stripChars(A[2], true);
  var idx = st.s.indexOf(qn);
  if (idx < 0) return esc(A[2]);
  var start = st.map[idx];
  var end = idx + qn.length < st.map.length ? st.map[idx + qn.length] : A[2].length;
  var from = Math.max(0, start - 60), to = Math.min(A[2].length, end + 90);
  return (from > 0 ? '… ' : '') + esc(A[2].slice(from, start)) + '<mark>' + esc(A[2].slice(start, end)) + '</mark>' + esc(A[2].slice(end, to)) + (to < A[2].length ? ' …' : '');
}
function hlTr(i, qn) {
  var T = window.QT[state.tr]; if (!T || !T[i]) return '';
  var s = T[i], low = s.toLowerCase(), k = low.indexOf(qn);
  if (k < 0) return '';
  var from = Math.max(0, k - 70), to = Math.min(s.length, k + qn.length + 90);
  return (from > 0 ? '… ' : '') + esc(s.slice(from, k)) + '<mark>' + esc(s.slice(k, k + qn.length)) + '</mark>' + esc(s.slice(k + qn.length, to)) + (to < s.length ? ' …' : '');
}

var srchTimer;
function runSearch() {
  var q = $('#srch').value.trim();
  var res = $('#srchRes'), hint = $('#srchHint');
  if (q.length < 2) { res.innerHTML = ''; hint.style.display = ''; return; }
  hint.style.display = 'none';
  var qn = normQuery(q);
  var found = [], limit = 120;
  if (/[\u0600-\u06FF]/.test(q)) {
    var N = buildNorm();
    for (var i = 0; i < N.length && found.length < limit; i++) {
      if (N[i].s.indexOf(qn) >= 0) found.push({ i: i, kind: 'ar' });
    }
  }
  if (state.tr !== 'off' && window.QT && window.QT[state.tr]) {
    var T = window.QT[state.tr], lq = q.toLowerCase();
    for (var j = 0; j < T.length && found.length < limit; j++) {
      if (found.some(function (f) { return f.i === j; })) continue;
      if ((T[j] || '').toLowerCase().indexOf(lq) >= 0) found.push({ i: j, kind: 'tr' });
    }
  }
  if (!found.length) { res.innerHTML = '<div class="empty">' + t('search_none') + '</div>'; return; }
  var h = '';
  found.forEach(function (f) {
    var a = AY[f.i];
    var body = f.kind === 'ar' ? hlAyah(f.i, qn) : esc(a[2]);
    var tr = f.kind === 'tr' ? hlTr(f.i, q.toLowerCase()) : '';
    h += '<button class="res" data-pg="' + a[3] + '">' +
      '<div class="res-t">' + body + '</div>' +
      (tr ? '<div class="ayah-tr" style="border:none;padding-top:6px;margin-top:6px">' + tr + '</div>' : '') +
      '<div class="res-m">سورة ' + surahName(a[0]) + ' · ' + t('ayah_word') + ' ' + num(a[1]) + ' · ' + t('page_of') + ' ' + num(a[3]) + '</div>' +
    '</button>';
  });
  res.innerHTML = h;
}

/* ---------- wiring ---------- */
function go(delta) { openPage(state.page + delta, delta); }

document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-go],[data-pg],[data-theme],[data-mode],[data-del],[data-ayah]') : null;
  if (!el) return;
  if (el.hasAttribute('data-go')) { var v = el.getAttribute('data-go'); show(v === 'juz' ? 'juz' : v); return; }
  if (el.hasAttribute('data-del')) {
    var k = el.getAttribute('data-del').split(':');
    toggleBm(+k[0], +k[1]);
    e.stopPropagation(); return;
  }
  if (el.hasAttribute('data-pg')) {
    var pg = +el.getAttribute('data-pg');
    var s = el.getAttribute('data-s'), a = el.getAttribute('data-a');
    openPage(pg, 0);
    if (s && a && state.mode === 'ayah') {
      setTimeout(function () {
        var node = document.querySelector('.ayah[data-s="' + s + '"][data-a="' + a + '"]');
        if (node) node.scrollIntoView({ block: 'center' });
      }, 60);
    }
    return;
  }
});

$('#btnContinue').addEventListener('click', function () { openPage(state.page, 0); });
$('#rBack').addEventListener('click', function () { show('home'); });
$('#rPrev').addEventListener('click', function () { go(-1); });
$('#rNext').addEventListener('click', function () { go(1); });
$('#rRange').addEventListener('input', function () { openPage(+this.value, 0); });
$('#rBm').addEventListener('click', function () {
  var idxs = PAGES[state.page] || [];
  if (!idxs.length) return;
  var a = AY[idxs[0]];
  toggleBm(a[0], a[1], state.page);
});
$('#rTrBtn').addEventListener('click', function () {
  if (state.mode !== 'ayah') { state.mode = 'ayah'; localStorage.setItem(K.mode, 'ayah'); renderSettings(); }
  if (state.tr === 'off') {
    state.tr = TRS.indexOf(state.lang) >= 0 ? state.lang : 'ru';
    localStorage.setItem(K.tr, state.tr);
    loadTr(state.tr).then(function () { renderRead(false); });
    toast((window.TR_NAMES[state.tr] || state.tr));
  } else {
    state.tr = 'off'; localStorage.setItem(K.tr, 'off'); renderRead(false);
  }
});
$('#btnThemeHome').addEventListener('click', function () {
  var order = ['night', 'day', 'sepia', 'emerald'];
  state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
  localStorage.setItem(K.theme, state.theme); applyTheme();
});
$('#btnLangHome').addEventListener('click', function () { show('settings'); setTimeout(function(){ $('#uiLangSel').focus(); }, 150); });

// tap an ayah in the mushaf page to bookmark it
document.addEventListener('click', function (e) {
  var ay = e.target.closest ? e.target.closest('.mushaf .ay') : null;
  if (ay) { toggleBm(+ay.getAttribute('data-s'), +ay.getAttribute('data-a'), +ay.getAttribute('data-p')); return; }
  var card = e.target.closest ? e.target.closest('.ayah') : null;
  if (card && document.body.dataset.view === 'read') {
    toggleBm(+card.getAttribute('data-s'), +card.getAttribute('data-a'), +card.getAttribute('data-p'));
  }
});

$('#idxSearch').addEventListener('input', function () { renderSurahList($('#surahList2'), this.value); });
$('#srch').addEventListener('input', function () {
  clearTimeout(srchTimer);
  var v = this.value;
  srchTimer = setTimeout(runSearch, 180);
});

var tch = document.querySelectorAll('#themeChips .chip');
for (var ti = 0; ti < tch.length; ti++) {
  tch[ti].addEventListener('click', function () {
    state.theme = this.getAttribute('data-theme'); localStorage.setItem(K.theme, state.theme); applyTheme();
  });
}
var mb = document.querySelectorAll('#modeSeg .seg-b');
for (var mi = 0; mi < mb.length; mi++) {
  mb[mi].addEventListener('click', function () {
    state.mode = this.getAttribute('data-mode'); localStorage.setItem(K.mode, state.mode); renderSettings();
    if (state.mode === 'ayah' && state.tr !== 'off') loadTr(state.tr).then(function () { renderRead(false); });
  });
}
$('#fsRange').addEventListener('input', function () {
  state.fs = +this.value; localStorage.setItem(K.fs, String(state.fs));
  document.documentElement.style.setProperty('--fs', state.fs + 'px');
});
$('#fontSel').addEventListener('change', function () {
  state.font = this.value; localStorage.setItem(K.font, state.font); applyTheme();
});
$('#uiLangSel').addEventListener('change', function () {
  state.lang = this.value; localStorage.setItem(K.lang, state.lang);
  applyI18n(); renderSettings(); renderHome();
  if (window.QTN && window.QTN[state.lang] && state.tr === 'off') { /* names only */ }
});
$('#trLangSel').addEventListener('change', function () {
  state.tr = this.value; localStorage.setItem(K.tr, state.tr);
  if (state.tr !== 'off') loadTr(state.tr).then(function () { if (document.body.dataset.view === 'read') renderRead(false); });
  renderRead(false);
});
$('#resetKhatma').addEventListener('click', function () {
  state.read = {}; localStorage.setItem(K.read, '[]'); $('#khatmaPct').textContent = '0%';
  renderHome(); toast(t('reset_done'));
});

// swipe
(function () {
  var x0 = null, y0 = null, host = document.querySelector('.reader-wrap');
  host.addEventListener('touchstart', function (e) {
    if (!e.touches[0]) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  host.addEventListener('touchend', function (e) {
    if (x0 == null || !e.changedTouches[0]) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 55 || Math.abs(dy) > Math.abs(dx)) return;
    go(dx < 0 ? 1 : -1);
  });
})();

// keyboard
document.addEventListener('keydown', function (e) {
  if (document.body.dataset.view !== 'read') return;
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select') return;
  if (e.key === 'ArrowLeft') go(1);
  else if (e.key === 'ArrowRight') go(-1);
  else if (e.key === 'Escape') show('home');
});

// boot
applyTheme();
applyI18n();
show('home');
document.body.classList.add('ready');
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
})();
