/* 假期华文冲刺营 — app logic (vanilla JS, progress saved in this browser) */
(function () {
  'use strict';
  var D = window.DATA;
  var KEY = 'p4cn_holiday_v1';
  var view = document.getElementById('view');

  /* ================= state ================= */
  function blank() {
    return {
      name: '', points: 0, streak: 0, best: 0, lastLogin: '', loginDays: [], startDate: '',
      lvl: {}, skill: {}, wrong: [], essays: [], daily: {}, badges: [], log: [], correctTotal: 0
    };
  }
  var S = load();
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); var b = blank(); for (var k in b) if (!(k in s)) s[k] = b[k]; return s; }
    } catch (e) { /* storage unavailable */ }
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ================= helpers ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, n) { return shuffle(a).slice(0, n); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dstr(new Date()); }
  function addDays(s, n) { var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return dstr(d); }
  function dayNum(s) { var p = s.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
  function hanCount(t) { var m = t.match(/[一-鿿]/g); return m ? m.length : 0; }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return 'q' + (h >>> 0).toString(36); }
  function pct(o) { return o && o.t ? Math.round(o.c / o.t * 100) : null; }

  var toastBox = document.getElementById('toasts');
  function toast(msg) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    toastBox.appendChild(el); setTimeout(function () { el.classList.add('out'); }, 2200); setTimeout(function () { el.remove(); }, 2700);
  }
  function addPoints(n, why) {
    if (!n) return;
    S.points += n; S.log.unshift({ d: today(), n: n, w: why }); S.log = S.log.slice(0, 60);
    save(); toast('+' + n + ' 积分 · ' + why); checkBadges(); renderTop();
  }

  /* ================= speech ================= */
  var zhVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    var vs = speechSynthesis.getVoices();
    zhVoice = vs.filter(function (v) { return /zh[-_]CN/i.test(v.lang); })[0] || vs.filter(function (v) { return /^zh/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, rate) {
    if (!('speechSynthesis' in window)) { toast('这个浏览器不支持朗读功能'); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = rate || 0.85; if (zhVoice) u.voice = zhVoice;
    speechSynthesis.speak(u);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-say]'); if (b) { e.preventDefault(); speak(b.getAttribute('data-say'), +(b.getAttribute('data-rate') || 0.85)); }
  });

  /* ================= levels & badges ================= */
  var RANKS = [[0, '🌱 汉字小芽'], [200, '📘 学习小兵'], [500, '⭐ 语文小达人'], [1000, '✍️ 写作小作家'], [2000, '👑 华文小状元']];
  function rank() { var r = RANKS[0], next = null; for (var i = 0; i < RANKS.length; i++) { if (S.points >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } } return { r: r, next: next }; }
  var BADGES = [
    ['first', '🎉', '第一次签到', function () { return S.loginDays.length >= 1; }],
    ['s3', '🔥', '连续签到 3 天', function () { return S.best >= 3; }],
    ['s7', '🏆', '连续签到 7 天', function () { return S.best >= 7; }],
    ['s14', '💎', '连续签到 14 天', function () { return S.best >= 14; }],
    ['c100', '💯', '累计答对 100 题', function () { return S.correctTotal >= 100; }],
    ['c300', '🚀', '累计答对 300 题', function () { return S.correctTotal >= 300; }],
    ['essay1', '✍️', '完成第一篇作文', function () { return S.essays.length >= 1; }],
    ['essay5', '📚', '完成 5 篇作文', function () { return S.essays.length >= 5; }],
    ['mission5', '🎯', '完成 5 天每日任务', function () { return missionDays() >= 5; }],
    ['allLv', '🧗', 'P1–P4 每级正确率 ≥ 80%', function () { return ['P1', 'P2', 'P3', 'P4'].every(function (l) { var o = S.lvl[l]; return o && o.t >= 20 && o.c / o.t >= 0.8; }); }]
  ];
  function missionDays() { var n = 0; for (var k in S.daily) { var d = S.daily[k]; if (d.vocab && d.wa && d.write) n++; } return n; }
  function checkBadges() {
    BADGES.forEach(function (b) { if (S.badges.indexOf(b[0]) < 0 && b[3]()) { S.badges.push(b[0]); save(); toast('获得奖章 ' + b[1] + ' ' + b[2]); } });
  }

  /* ================= check-in ================= */
  function checkIn() {
    var t = today();
    if (!S.name || S.lastLogin === t) return;
    S.streak = S.lastLogin === addDays(t, -1) ? S.streak + 1 : 1;
    S.best = Math.max(S.best, S.streak);
    S.lastLogin = t; if (S.loginDays.indexOf(t) < 0) S.loginDays.push(t);
    if (!S.startDate) S.startDate = t;
    save();
    addPoints(10, '每日签到');
    if (S.streak > 1 && S.streak % 7 === 0) addPoints(30, '连续 ' + S.streak + ' 天签到奖励');
    else if (S.streak >= 3) addPoints(5, '连续签到 ' + S.streak + ' 天');
  }

  /* ================= mission ================= */
  var WA_ROT = [['yuyan', '语文应用'], ['cloze', '短文填空'], ['dialog', '完成对话'], ['reading', '阅读理解'], ['oral', '口试练习']];
  var WR_ROT = [['expand', '扩句练习'], ['mood', '心情描写'], ['opening', '好开头练习'], ['plan', '看图审题 + 写一段'], ['essay', '写一篇完整作文']];
  function mission() { var n = dayNum(today()); return { wa: WA_ROT[n % 5], wr: WR_ROT[n % 5] }; }
  function todayDone() { var t = today(); if (!S.daily[t]) S.daily[t] = {}; return S.daily[t]; }
  function markDone(part) {
    var d = todayDone(); if (d[part]) return; d[part] = true; save();
    if (d.vocab && d.wa && d.write) addPoints(20, '完成今日全部任务 🎯');
  }

  /* ================= stats ================= */
  function record(level, skill, ok) {
    if (level) { var a = S.lvl[level] || (S.lvl[level] = { c: 0, t: 0 }); a.t++; if (ok) a.c++; }
    if (skill) { var b = S.skill[skill] || (S.skill[skill] = { c: 0, t: 0 }); b.t++; if (ok) b.c++; }
    if (ok) S.correctTotal++;
  }
  var SKILLS = { pinyin: '汉语拼音', word: '看拼音认字', fill: '词语选择', measure: '量词', p5: '关联词/成语/修辞', order: '重组句子', cloze: '短文填空', dialog: '完成对话', readmcq: '阅读理解（选择）', readopen: '阅读理解（问答）' };
  // Weakest level gets picked more often so practice targets gaps.
  function weightedLevel() {
    var ls = ['P1', 'P2', 'P3', 'P4'], w = ls.map(function (l) { var o = S.lvl[l]; var acc = o && o.t >= 5 ? o.c / o.t : 0.6; return 0.4 + (1 - acc) * 2 + (l === 'P4' ? 0.3 : 0); });
    var sum = w.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * sum;
    for (var i = 0; i < ls.length; i++) { r -= w[i]; if (r <= 0) return ls[i]; }
    return 'P4';
  }

  /* ================= question generators ================= */
  var MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
  function sylInfo(s) {
    for (var v in MARKS) { for (var t = 0; t < 4; t++) { var i = s.indexOf(MARKS[v][t]); if (i >= 0) return { plain: s.slice(0, i) + v + s.slice(i + 1), tone: t + 1 }; } }
    return { plain: s, tone: 0 };
  }
  function setTone(s, tone) {
    var p = sylInfo(s).plain; if (!tone) return p;
    var idx = p.indexOf('a'); if (idx < 0) idx = p.indexOf('e'); if (idx < 0 && p.indexOf('ou') >= 0) idx = p.indexOf('o');
    if (idx < 0) { for (var i = p.length - 1; i >= 0; i--) if ('iouü'.indexOf(p[i]) >= 0) { idx = i; break; } }
    if (idx < 0) return p;
    return p.slice(0, idx) + MARKS[p[idx]][tone - 1] + p.slice(idx + 1);
  }
  function pinyinVariants(py) {
    var syl = py.split(' '), out = {};
    syl.forEach(function (s, i) {
      var cur = sylInfo(s).tone;
      for (var t = 0; t <= 4; t++) if (t !== cur) { var c = syl.slice(); c[i] = setTone(s, t); out[c.join(' ')] = 1; }
    });
    // nasal swap distractor (-n / -ng) for variety
    syl.forEach(function (s, i) {
      var c = syl.slice();
      if (/ng$/.test(s)) c[i] = s.replace(/ng$/, 'n'); else if (/[aeiu]n$/.test(sylInfo(s).plain) && !/ün$/.test(s)) c[i] = s + 'g'; else return;
      out[c.join(' ')] = 1;
    });
    delete out[py];
    return Object.keys(out);
  }
  function qPinyin(level, w) {
    var opts = [w[1]].concat(pick(pinyinVariants(w[1]), 3));
    return { type: 'mcq', level: level, skill: 'pinyin', stem: '选出<b class="big">' + w[0] + '</b>正确的汉语拼音。', options: opts, answer: 0, say: w[0] };
  }
  function qWord(level, w) {
    var others = pick(D.words[level].filter(function (x) { return x[0] !== w[0] && x[0].length === w[0].length; }), 3);
    if (others.length < 3) others = pick(D.words[level].filter(function (x) { return x[0] !== w[0]; }), 3);
    return { type: 'mcq', level: level, skill: 'word', stem: '看拼音，选出正确的词语：<b class="big py">' + w[1] + '</b>', options: [w[0]].concat(others.map(function (x) { return x[0]; })), answer: 0, say: w[0] };
  }
  function qFill(level, f) {
    return { type: 'mcq', level: level, skill: level === 'P5' ? 'p5' : 'fill', stem: esc(f[0]).replace('（　）', '<span class="blank">（　　）</span>'), options: f[1].slice(), answer: 0, explain: f[2] || '', say: f[1][0].indexOf('……') >= 0 || f[0].indexOf('"') === 0 ? '' : f[0].replace('（　）', f[1][0]) };
  }
  function qMeasure() {
    var m = D.measure[Math.floor(Math.random() * D.measure.length)];
    var bad = [m[1]].concat(m[2] || []);
    var opts = [m[1]].concat(pick(D.measurePool.filter(function (x) { return bad.indexOf(x) < 0; }), 3));
    return { type: 'mcq', level: 'P2', skill: 'measure', stem: '选出正确的量词：一<span class="blank">（　）</span>' + m[0], options: opts, answer: 0, say: '一' + m[1] + m[0] };
  }
  function qOrder(r) { return { type: 'order', level: r.level, skill: 'order', stem: '重组句子：把词语排成一个通顺的句子。', chunks: r.chunks, answers: r.answers }; }
  function clozeQs(c) {
    return c.answers.map(function (a, i) {
      var text = esc(c.text).replace(/\{(\d)\}/g, function (_, n) { return +n === i + 1 ? '<span class="blank hot">（' + n + '）</span>' : '<span class="blank">（' + n + '）</span>'; });
      return { type: 'mcq', level: c.level, skill: 'cloze', passageTitle: c.title, passage: '<p>' + text + '</p><p class="box">词语框：' + c.box.join('　') + '<br><small>每个词语只能用一次</small></p>', stem: '第（' + (i + 1) + '）空应该填：', options: c.box.slice(), answer: c.box.indexOf(a), say: '' };
    });
  }
  function qDialog(d) {
    var html = d.lines.map(function (l) { return '<div class="dl"><b>' + esc(l[0]) + '：</b>' + (l[1] === '?' ? '<span class="blank hot">（　　　　）</span>' : esc(l[1])) + '</div>'; }).join('');
    return { type: 'mcq', level: d.level, skill: 'dialog', passage: html, stem: '选出最适合放在空格里的句子。', options: d.options.slice(), answer: 0 };
  }
  function readingQs(r) {
    var passage = r.text.map(function (p, i) { return '<p><sup>' + (i + 1) + '</sup>' + esc(p) + '</p>'; }).join('');
    return r.qs.map(function (q) {
      if (q.t === 'mcq') return { type: 'mcq', level: r.level, skill: 'readmcq', passageTitle: r.title, passage: passage, stem: esc(q.q), options: q.o.slice(), answer: 0, sayPassage: r.text.join('') };
      return { type: 'open', level: r.level, skill: 'readopen', passageTitle: r.title, passage: passage, stem: esc(q.q), ref: q.ref, keys: q.keys, sayPassage: r.text.join('') };
    });
  }
  function vocabQ(L) {
    var r = Math.random();
    if (L === 'P5') return r < 0.7 ? qFill('P5', D.fill.P5[Math.floor(Math.random() * D.fill.P5.length)]) : qPinyin('P5', D.words.P5[Math.floor(Math.random() * D.words.P5.length)]);
    if (r < 0.3) return qPinyin(L, D.words[L][Math.floor(Math.random() * D.words[L].length)]);
    if (r < 0.5) return qWord(L, D.words[L][Math.floor(Math.random() * D.words[L].length)]);
    if (r < 0.88 || L === 'P4') return qFill(L, D.fill[L][Math.floor(Math.random() * D.fill[L].length)]);
    return qMeasure();
  }
  function vocabSet(level, n) {
    var qs = [], seen = {};
    for (var tries = 0; qs.length < n && tries < n * 20; tries++) {
      var q = vocabQ(level === 'mix' ? weightedLevel() : level), k = q.stem + q.options[0];
      if (!seen[k]) { seen[k] = 1; qs.push(q); }
    }
    return qs;
  }
  function yuyanSet() {
    var qs = [];
    ['P3', 'P4', 'P4'].forEach(function (L) { qs.push(qPinyin(L, D.words[L][Math.floor(Math.random() * D.words[L].length)])); });
    pick(D.fill.P3, 2).forEach(function (f) { qs.push(qFill('P3', f)); });
    pick(D.fill.P4, 3).forEach(function (f) { qs.push(qFill('P4', f)); });
    qs.push(qMeasure());
    pick(D.reorder, 2).forEach(function (r) { qs.push(qOrder(r)); });
    pick(D.fill.P5.slice(0, 6), 1).forEach(function (f) { qs.push(qFill('P5', f)); });
    return qs;
  }

  /* ================= quiz engine ================= */
  function runQuiz(opts) {
    var qs = opts.questions, i = 0, right = 0, earned = 0, total = qs.length, startT = Date.now();
    function finish() {
      var perfect = right === total && total >= 5;
      if (perfect) { earned += 10; }
      if (earned) addPoints(earned, opts.title + (perfect ? '（全对 +10）' : ''));
      save();
      var secs = Math.round((Date.now() - startT) / 1000);
      view.innerHTML = '<div class="card center"><div class="huge">' + (right / total >= 0.8 ? '🎉' : right / total >= 0.5 ? '💪' : '🌱') + '</div>' +
        '<h2>' + esc(opts.title) + ' 完成！</h2><p class="score">' + right + ' / ' + total + '</p>' +
        '<p>用时 ' + Math.floor(secs / 60) + ' 分 ' + (secs % 60) + ' 秒 · 获得 ' + earned + ' 积分</p>' +
        (right < total ? '<p class="muted">答错的题目已放进「错题本」，记得回去再练一次！</p>' : '') +
        '<div class="row"><button class="btn" id="again">再练一次</button><a class="btn ghost" href="#home">回首页</a></div></div>';
      if (opts.onFinish) opts.onFinish(right, total);
      $('#again').onclick = function () { runQuiz(Object.assign({}, opts, { questions: opts.regen ? opts.regen() : qs })); };
    }
    function show() {
      if (i >= total) return finish();
      var q = qs[i];
      var head = '<div class="qbar"><span>' + esc(opts.title) + '</span><span>' + (i + 1) + ' / ' + total + '</span></div><div class="prog"><i style="width:' + (i / total * 100) + '%"></i></div>';
      var passage = q.passage ? '<div class="passage">' + (q.passageTitle ? '<h3>' + esc(q.passageTitle) + (q.sayPassage ? ' <button class="say" data-say="' + esc(q.sayPassage) + '">🔊</button>' : '') + '</h3>' : '') + q.passage + '</div>' : '';
      var body = '';
      if (q.type === 'mcq') {
        var order = shuffle(q.options.map(function (_, k) { return k; }));
        body = '<div class="opts">' + order.map(function (k, n) { return '<button class="opt" data-k="' + k + '"><b>' + (n + 1) + '</b> ' + esc(q.options[k]) + '</button>'; }).join('') + '</div>';
      } else if (q.type === 'order') {
        body = '<div class="built" id="built"></div><div class="chips" id="pool">' + shuffle(q.chunks.map(function (c, k) { return k; })).map(function (k) { return '<button class="chip" data-k="' + k + '">' + esc(q.chunks[k]) + '</button>'; }).join('') + '</div><div class="row"><button class="btn ghost" id="reset">重来</button><button class="btn" id="check">检查</button></div>';
      } else {
        body = '<textarea id="ans" rows="4" placeholder="用完整的句子回答……"></textarea><div class="row"><button class="btn" id="check">看参考答案</button></div>';
      }
      view.innerHTML = head + passage + '<div class="card q"><p class="stem">' + q.stem + (q.say ? ' <button class="say" data-say="' + esc(q.say) + '">🔊</button>' : '') + '</p>' + body + '<div id="fb"></div></div>';
      if (q.type === 'mcq') $$('.opt').forEach(function (b) { b.onclick = function () { answer(+b.getAttribute('data-k') === q.answer, b); }; });
      if (q.type === 'order') {
        var built = [];
        var draw = function () { $('#built').innerHTML = built.map(function (k) { return '<span class="chip on">' + esc(q.chunks[k]) + '</span>'; }).join('') || '<span class="muted">点击下面的词语……</span>'; $$('#pool .chip').forEach(function (c) { c.disabled = built.indexOf(+c.getAttribute('data-k')) >= 0; }); };
        $$('#pool .chip').forEach(function (c) { c.onclick = function () { built.push(+c.getAttribute('data-k')); draw(); }; });
        $('#reset').onclick = function () { built = []; draw(); };
        $('#check').onclick = function () {
          if (built.length < q.chunks.length) { toast('还有词语没有用完哦'); return; }
          var s = built.map(function (k) { return q.chunks[k]; }).join('');
          $('#reset').disabled = true; this.disabled = true;
          answer(q.answers.indexOf(s) >= 0, null, '正确答案：' + q.answers[0] + '。');
        };
        draw();
      }
      if (q.type === 'open') {
        $('#check').onclick = function () {
          var a = $('#ans').value.trim(); if (hanCount(a) < 4) { toast('先写下你的答案吧！'); return; }
          this.style.display = 'none';
          var hit = (q.keys || []).filter(function (k) { return a.indexOf(k) >= 0; });
          $('#fb').innerHTML = '<div class="fb info"><b>参考答案：</b>' + esc(q.ref) + '<br><small>关键词：' + q.keys.map(function (k) { return (hit.indexOf(k) >= 0 ? '✅' : '⬜') + k; }).join('　') + '</small><p>跟参考答案比一比，你答对了吗？</p><div class="row"><button class="btn" id="self-ok">✅ 答对了</button><button class="btn warn" id="self-no">🔁 还要加油</button></div></div>';
          $('#self-ok').onclick = function () { answer(true, null, ''); };
          $('#self-no').onclick = function () { answer(false, null, ''); };
        };
      }
      function answer(ok, btn, extra) {
        if (q.type === 'mcq') $$('.opt').forEach(function (b) { b.disabled = true; if (+b.getAttribute('data-k') === q.answer) b.classList.add('right'); });
        if (btn && !ok) btn.classList.add('wrong');
        record(q.level, q.skill, ok);
        var id = hash(q.stem + (q.options ? q.options[q.answer] : '') + (q.answers ? q.answers[0] : '') + (q.ref || ''));
        var wi = -1; S.wrong.forEach(function (w, n) { if (w.id === id) wi = n; });
        if (ok) { right++; earned += 2; if (wi >= 0 && opts.fromWrongBook) S.wrong.splice(wi, 1); }
        else if (wi < 0) { var c = JSON.parse(JSON.stringify(q)); c.id = id; c.date = today(); S.wrong.unshift(c); S.wrong = S.wrong.slice(0, 150); }
        save();
        var msg = ok ? ['答对了！👍', '太棒了！🌟', '真厉害！💯'][Math.floor(Math.random() * 3)] : '没关系，记住正确答案 💡';
        var fb = '<div class="fb ' + (ok ? 'ok' : 'no') + '">' + msg + (extra ? '<br>' + esc(extra) : '') + (q.explain ? '<br><small>' + esc(q.explain) + '</small>' : '') + '</div>';
        $('#fb').innerHTML = fb;
        $('#fb').insertAdjacentHTML('beforeend', '<div class="row"><button class="btn" id="next">' + (i + 1 < total ? '下一题 →' : '看成绩') + '</button></div>');
        $('#next').onclick = function () { i++; show(); window.scrollTo(0, 0); };
        $('#next').focus();
      }
    }
    show();
  }

  /* ================= top bar ================= */
  function renderTop() {
    var r = rank();
    $('#top-pts').textContent = S.points;
    $('#top-streak').textContent = S.streak;
    $('#top-rank').textContent = r.r[1];
  }

  /* ================= pages ================= */
  function pageLogin() {
    view.innerHTML = '<div class="card center hero"><div class="huge">🏮</div><h1>假期华文冲刺营</h1><p>P1–P4 每日复习 · WA 题型练习 · 作文工作坊 · P5 预习</p>' +
      '<label class="lbl">你的名字 / 昵称</label><input id="nm" maxlength="12" placeholder="例如：小明">' +
      '<button class="btn big" id="go">开始签到 ✨</button><p class="muted small">进度保存在这台设备的浏览器里。换设备时，可以在「我的」页面导出/导入进度。</p></div>';
    $('#go').onclick = function () { var n = $('#nm').value.trim(); if (!n) { toast('请写下你的名字'); return; } S.name = n; save(); checkIn(); location.hash = '#home'; route(); };
  }

  function pageHome() {
    var r = rank(), m = mission(), d = todayDone();
    var nextTxt = r.next ? '再得 ' + (r.next[0] - S.points) + ' 分升级为 ' + r.next[1] : '你已经是最高级了！';
    var prog = r.next ? (S.points - r.r[0]) / (r.next[0] - r.r[0]) * 100 : 100;
    var tasks = [
      ['vocab', '📝 字词热身（10 题，P1–P4 智能混合）', '#vocab/mix/daily'],
      ['wa', '📋 WA 题型：' + m.wa[1], '#wa/' + m.wa[0] + '/daily'],
      ['write', '✍️ 作文练习：' + m.wr[1], '#write/' + m.wr[0] + '/daily']
    ];
    var doneN = tasks.filter(function (t) { return d[t[0]]; }).length;
    view.innerHTML =
      '<div class="card hello"><div><h2>你好，' + esc(S.name) + '！</h2><p>' + r.r[1] + '</p><div class="prog"><i style="width:' + prog + '%"></i></div><small>' + nextTxt + '</small></div>' +
      '<div class="streak"><b>🔥 ' + S.streak + '</b><small>连续签到</small></div></div>' +
      '<div class="card"><h3>🎯 今日任务 <span class="pill">' + doneN + ' / 3</span></h3><p class="muted small">每天 30–40 分钟。全部完成额外 +20 积分！</p>' +
      tasks.map(function (t) { return '<a class="task ' + (d[t[0]] ? 'done' : '') + '" href="' + t[2] + '"><span>' + (d[t[0]] ? '✅' : '⬜') + '</span>' + t[1] + '</a>'; }).join('') + '</div>' +
      '<div class="card"><h3>📅 假期打卡日历</h3>' + calendar() + '<p class="muted small">🟢 已签到　⭐ 完成全部任务</p></div>' +
      '<div class="grid">' +
      tile('#vocab', '📝', '字词复习', 'P1–P4 + P5 预习') + tile('#wa', '📋', 'WA 题型', '语文应用·填空·对话·阅读') +
      tile('#write', '✍️', '作文工作坊', '五步写作法') + tile('#oral', '🎤', '口试练习', '朗读·会话') +
      tile('#wrong', '📕', '错题本', S.wrong.length + ' 题待复习') + tile('#me', '📊', '我的进度', '积分·奖章·家长报告') + '</div>';
  }
  function tile(h, ic, t, s) { return '<a class="tile" href="' + h + '"><span class="ic">' + ic + '</span><b>' + t + '</b><small>' + s + '</small></a>'; }

  function calendar() {
    var t = today(), start = S.startDate || t, p = start.split('-');
    var sd = new Date(+p[0], +p[1] - 1, +p[2]); sd.setDate(sd.getDate() - ((sd.getDay() + 6) % 7)); // Monday
    var s = dstr(sd), cells = ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<div class="cw">' + w + '</div>'; });
    for (var k = 0; k < 42; k++) {
      var day = addDays(s, k), dd = S.daily[day], full = dd && dd.vocab && dd.wa && dd.write, inn = S.loginDays.indexOf(day) >= 0;
      cells.push('<div class="cd' + (day === t ? ' now' : '') + (day > t ? ' fut' : '') + '"><small>' + (+day.split('-')[2]) + '</small>' + (full ? '⭐' : inn ? '🟢' : '') + '</div>');
    }
    return '<div class="cal">' + cells.join('') + '</div>';
  }

  function pageVocab(level, daily) {
    if (level) {
      var L = level, n = 10;
      runQuiz({
        title: L === 'mix' ? '字词热身（智能混合）' : D.levelNames[L] + ' 字词', questions: vocabSet(L, n), regen: function () { return vocabSet(L, n); },
        onFinish: function () { if (daily) markDone('vocab'); }
      });
      return;
    }
    view.innerHTML = '<h2 class="ph">📝 字词复习</h2><div class="card"><p>系统会记录每个年级的正确率。<b>智能混合</b>会多出你比较弱的年级的题目。</p>' +
      '<a class="btn big block" href="#vocab/mix">🧠 智能混合（10 题）</a></div><div class="grid">' +
      D.levels.map(function (L) { var a = pct(S.lvl[L]); return tile('#vocab/' + L, L === 'P5' ? '🚀' : '📗', D.levelNames[L], a === null ? '还没练习' : '正确率 ' + a + '%'); }).join('') +
      '</div><div class="card"><h3>💡 答题技巧</h3><ul>' + D.tips.yuyan.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>' +
      '<div class="card"><h3>📖 词语表（点击听发音）</h3>' + D.levels.map(function (L) { return '<details><summary>' + D.levelNames[L] + '</summary><div class="wl">' + D.words[L].map(function (w) { return '<button class="w" data-say="' + w[0] + '"><b>' + w[0] + '</b><small>' + w[1] + '</small></button>'; }).join('') + '</div></details>'; }).join('') + '</div>';
  }

  function pageWA(sec, extra) {
    var done = function () { if (extra === 'daily') markDone('wa'); };
    if (sec === 'yuyan') return runQuiz({ title: '语文应用', questions: yuyanSet(), regen: yuyanSet, onFinish: done });
    if (sec === 'cloze') {
      var c = extra && extra !== 'daily' ? D.cloze[+extra] : D.cloze[dayNum(today()) % D.cloze.length];
      return runQuiz({ title: '短文填空：' + c.title, questions: clozeQs(c), onFinish: done });
    }
    if (sec === 'dialog') { var ds = function () { return pick(D.dialogue, 5).map(qDialog); }; return runQuiz({ title: '完成对话', questions: ds(), regen: ds, onFinish: done }); }
    if (sec === 'reading') {
      var r = extra && extra !== 'daily' ? D.reading[+extra] : D.reading[dayNum(today()) % 2];
      return runQuiz({ title: '阅读理解：' + r.title, questions: readingQs(r), onFinish: done });
    }
    if (sec === 'oral') { location.hash = '#oral/daily'; return; }
    if (sec === 'mock') {
      var mk = function () {
        var qs = yuyanSet().slice(0, 8);
        qs = qs.concat(clozeQs(D.cloze[Math.floor(Math.random() * D.cloze.length)]));
        qs = qs.concat(pick(D.dialogue, 2).map(qDialog));
        return qs.concat(readingQs(D.reading[Math.floor(Math.random() * 2)]));
      };
      return runQuiz({ title: 'WA 模拟小测', questions: mk(), regen: mk });
    }
    var sk = function (k) { var a = pct(S.skill[k]); return a === null ? '' : '<span class="pill">' + a + '%</span>'; };
    view.innerHTML = '<h2 class="ph">📋 WA 题型练习</h2>' +
      '<div class="card"><a class="btn big block" href="#wa/mock">⏱️ WA 模拟小测（约 25 分钟）</a><p class="muted small">语文应用 + 短文填空 + 完成对话 + 阅读理解，一次练完整套。</p></div>' +
      sectionCard('一、语文应用', '汉语拼音 · 词语选择 · 量词 · 重组句子 · 关联词', '#wa/yuyan', D.tips.yuyan, sk('fill') + sk('pinyin') + sk('order')) +
      sectionCard('二、短文填空', '从词语框里选出合适的词语', null, D.tips.cloze, sk('cloze'), D.cloze.map(function (c, k) { return '<a class="btn ghost" href="#wa/cloze/' + k + '">' + c.title + '（' + c.level + '）</a>'; }).join('')) +
      sectionCard('三、完成对话', '选出最适合的句子，让对话通顺', '#wa/dialog', D.tips.dialog, sk('dialog')) +
      sectionCard('四、阅读理解', '选择题 + 问答题（附参考答案和关键词）', null, D.tips.reading, sk('readmcq') + sk('readopen'), D.reading.map(function (r, k) { return '<a class="btn ghost" href="#wa/reading/' + k + '">' + r.title + '（' + r.level + '）</a>'; }).join('')) +
      sectionCard('五、作文', '看图作文 · 命题作文', '#write', ['使用「五步写作法」，先计划，再写作，最后自我检查。'], '') +
      sectionCard('六、口试', '朗读 · 会话（看图/视频会话）', '#oral', D.tips.oral, '');
  }
  function sectionCard(t, sub, href, tips, badge, links) {
    return '<div class="card"><h3>' + t + ' ' + (badge || '') + '</h3><p class="muted">' + sub + '</p>' +
      (links ? '<div class="row wrap">' + links + '</div>' : '<a class="btn" href="' + href + '">开始练习</a>') +
      '<details><summary>💡 答题技巧</summary><ul>' + tips.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></details></div>';
  }

  /* ---------- 作文 ---------- */
  function pageWrite(sub, extra) {
    var daily = extra === 'daily';
    var done = function () { if (daily) markDone('write'); };
    if (sub === 'expand') return drill('扩句练习', '把简单的句子写得更具体、更生动。', D.expand.map(function (x) { return { q: x.base, hint: x.hint, model: x.model, min: hanCount(x.base) + 12 }; }), done);
    if (sub === 'mood') return drill('心情描写：不要说，要"写出来"', '不直接写"我很……"，用动作、表情、身体反应让读者感受到。', D.mood.map(function (x) { return { q: '改写：' + x.tell, hint: x.tip, model: x.model, min: 15, ban: x.tell.replace('我很', '').replace('妈妈很', '').replace('。', '') }; }), done);
    if (sub === 'opening') return pageOpening(done);
    if (sub === 'plan' || sub === 'essay') {
      if (extra && extra !== 'daily') return workshop(extra, sub === 'plan', done);
      var p = D.plans[dayNum(today()) % D.plans.length];
      return workshop(p.id, sub === 'plan', done);
    }
    if (sub === 'topic') return workshop('topic' + extra, false, done);
    if (sub === 'model') return pageModel();
    if (sub === 'bank') return pageBank();
    if (sub === 'book') return pageBook(extra);
    view.innerHTML = '<h2 class="ph">✍️ 作文工作坊</h2>' +
      '<div class="card steps"><h3>五步写作法（每篇作文都这样做）</h3><ol>' +
      '<li><b>看图审题</b>：每幅图问自己——时间？地点？人物？发生什么事？心情？</li>' +
      '<li><b>列提纲</b>：开头 → 经过 → <u>高潮</u>（写得最详细）→ 结尾（感受 + 道理）。</li>' +
      '<li><b>选好词</b>：先挑 3–5 个好词好句，写的时候用进去。</li>' +
      '<li><b>写作</b>：一边写，系统一边帮你检查字数、段落、感受、好词。</li>' +
      '<li><b>自评修改</b>：用评分表检查，改一改再提交。</li></ol>' +
      '<p class="muted small">为什么有效？先想后写，把"想内容"和"写句子"分开，孩子不会对着白纸发呆；每天只练一个小技巧（扩句、心情、开头），一个假期就能积累起来。</p></div>' +
      '<div class="card"><h3>🖼️ 看图作文（4 幅图）</h3><div class="plist">' + D.plans.map(function (p) { return '<a class="pcard" href="#write/essay/' + p.id + '"><span>' + p.panels.map(function (x) { return x[0]; }).join(' ') + '</span><b>' + p.title + '</b><small>' + p.theme + '</small></a>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>📝 命题作文</h3>' + D.topics.map(function (t, k) { return '<a class="task" href="#write/topic/' + k + '"><span>📄</span>《' + t.title + '》</a>'; }).join('') + '</div>' +
      '<div class="card"><h3>🏋️ 每日小练习（10 分钟）</h3><div class="row wrap"><a class="btn ghost" href="#write/expand">扩句</a><a class="btn ghost" href="#write/mood">心情描写</a><a class="btn ghost" href="#write/opening">好开头</a></div></div>' +
      '<div class="grid">' + tile('#write/model', '📖', '范文赏析', '看看高分作文怎么写') + tile('#write/bank', '💎', '好词好句宝库', '心情·天气·动作·结尾') + tile('#write/book', '📒', '我的作文本', S.essays.length + ' 篇') + '</div>';
  }

  function drill(title, intro, items, done) {
    var k = 0, earned = 0;
    function show() {
      if (k >= items.length) {
        if (earned) addPoints(earned, title);
        done();
        view.innerHTML = '<div class="card center"><div class="huge">🎉</div><h2>' + title + ' 完成！</h2><p>多读几遍范句，下次写作文就能用上。</p><div class="row"><a class="btn" href="#write">回作文工作坊</a><a class="btn ghost" href="#home">回首页</a></div></div>';
        return;
      }
      var it = items[k];
      view.innerHTML = '<div class="qbar"><span>' + title + '</span><span>' + (k + 1) + ' / ' + items.length + '</span></div><div class="card"><p class="muted">' + intro + '</p><p class="stem big">' + esc(it.q) + '</p><p class="hint">💡 ' + esc(it.hint) + '</p>' +
        '<textarea id="t" rows="4" placeholder="写在这里……"></textarea><div class="meter" id="m"></div><div class="row"><button class="btn" id="c">完成，看范句</button></div><div id="fb"></div></div>';
      var ta = $('#t'), m = $('#m');
      ta.oninput = function () { var n = hanCount(ta.value); m.textContent = n + ' 字' + (n < it.min ? '（至少写 ' + it.min + ' 字）' : ' ✅'); };
      ta.oninput();
      $('#c').onclick = function () {
        var v = ta.value.trim(), n = hanCount(v);
        if (n < it.min) { toast('再多写一点，至少 ' + it.min + ' 字'); return; }
        var warn = it.ban && v.indexOf(it.ban) >= 0 ? '<p class="warnt">⚠️ 你还是用了"' + esc(it.ban) + '"这个词，试试完全用动作和表情来表现！</p>' : '';
        earned += 5; this.style.display = 'none';
        $('#fb').innerHTML = '<div class="fb info"><b>范句：</b>' + esc(it.model) + ' <button class="say" data-say="' + esc(it.model) + '">🔊</button>' + warn + '<p class="small">比一比：你的句子有没有写出 <b>时间/地点/动作/表情/感受</b>？</p></div><div class="row"><button class="btn" id="n">下一题 →</button></div>';
        $('#n').onclick = function () { k++; show(); };
      };
    }
    show();
  }

  function pageOpening(done) {
    var p = D.plans[dayNum(today()) % D.plans.length];
    view.innerHTML = '<h2 class="ph">🌟 好开头练习</h2><div class="card"><p>好的开头能马上吸引读者。下面是 4 种常用方法：</p>' +
      D.openings.map(function (o) { return '<div class="ex"><b>' + o.name + '</b><p>' + esc(o.ex) + ' <button class="say" data-say="' + esc(o.ex) + '">🔊</button></p><small>' + o.tip + '</small></div>'; }).join('') + '</div>' +
      '<div class="card"><h3>轮到你了！</h3><p>题目：《' + p.title + '》　' + p.panels.map(function (x) { return x[0]; }).join(' ') + '</p><p class="muted small">图 1：' + esc(p.panels[0][1]) + '</p>' +
      '<label class="lbl">选一种方法</label><select id="way">' + D.openings.map(function (o) { return '<option>' + o.name + '</option>'; }).join('') + '</select>' +
      '<textarea id="t" rows="4" placeholder="写一个开头（2–3 句）"></textarea><div class="row"><button class="btn" id="c">完成 +10</button></div></div>' +
      '<div class="card"><h3>🔚 好结尾</h3>' + D.endings.map(function (o) { return '<div class="ex"><b>' + o.name + '</b><p>' + esc(o.ex) + '</p></div>'; }).join('') + '</div>';
    $('#c').onclick = function () {
      if (hanCount($('#t').value) < 20) { toast('至少写 20 个字哦'); return; }
      this.disabled = true; addPoints(10, '好开头练习'); done(); toast('写得好！试着把它用在完整作文里');
    };
  }

  function workshop(id, planOnly, done) {
    var p, isTopic = id.indexOf('topic') === 0;
    if (isTopic) { var t = D.topics[+id.slice(5)]; p = { id: id, title: t.title, theme: t.hint, panels: null, guide: ['这件事发生在什么时候、什么地方？有谁？', '事情是怎么开始的？', '最紧张/最精彩的部分是什么？（高潮）', '结果怎样？你有什么感受？明白了什么？'], words: [] }; }
    else p = D.plans.filter(function (x) { return x.id === id; })[0] || D.plans[0];
    var draftKey = 'draft_' + p.id;
    var draft = (function () { try { return JSON.parse(localStorage.getItem(KEY + draftKey) || '{}'); } catch (e) { return {}; } })();
    function keep() { try { localStorage.setItem(KEY + draftKey, JSON.stringify(draft)); } catch (e) { /* ignore */ } }
    var fields = [['when', '时间'], ['where', '地点'], ['who', '人物'], ['start', '起因（事情怎么开始）'], ['climax', '经过 / 高潮（最详细）'], ['end', '结果'], ['feel', '感受'], ['lesson', '道理 / 决心']];
    var step = draft.step || 1;
    function render() {
      var steps = ['看图审题', '列提纲', '选好词', '写作', '自评'];
      var nav = '<div class="stepper">' + steps.map(function (s, k) { return '<button class="' + (k + 1 === step ? 'on' : k + 1 < step ? 'past' : '') + '" data-s="' + (k + 1) + '">' + (k + 1) + '. ' + s + '</button>'; }).join('') + '</div>';
      var pics = p.panels ? '<div class="panels">' + p.panels.map(function (x, k) { return '<div class="panel"><div class="em">' + x[0] + '</div><small>图' + (k + 1) + '</small><p>' + esc(x[1]) + '</p></div>'; }).join('') + '</div>' : '<p class="hint">💡 ' + esc(p.theme) + '</p>';
      var html = '<h2 class="ph">《' + esc(p.title) + '》</h2>' + nav;
      if (step === 1) {
        html += '<div class="card">' + pics + '<h3>🔍 一边看图，一边回答</h3><ol class="guide">' + p.guide.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ol>' +
          fields.map(function (f) { return '<label class="lbl">' + f[1] + '</label><input data-f="' + f[0] + '" value="' + esc(draft[f[0]] || '') + '">'; }).join('') +
          '<div class="row"><button class="btn" data-go="2">下一步：列提纲 →</button></div></div>';
      } else if (step === 2) {
        var g = function (k) { return draft[k] ? esc(draft[k]) : '<span class="muted">（还没写）</span>'; };
        html += '<div class="card"><h3>📋 我的提纲（4–5 段）</h3><div class="outline">' +
          '<div><b>第1段 开头</b>：' + g('when') + '，' + g('where') + '，' + g('who') + '。<small>用一种好开头方法（声音/对话/天气）。</small></div>' +
          '<div><b>第2段 起因</b>：' + g('start') + '</div>' +
          '<div class="hot"><b>第3段 经过·高潮 ⭐</b>：' + g('climax') + '<small>写得最详细！加上对话、动作、心理活动。</small></div>' +
          '<div><b>第4段 结果</b>：' + g('end') + '</div>' +
          '<div><b>第5段 结尾</b>：' + g('feel') + '；' + g('lesson') + '<small>感受 + 道理 / 决心。</small></div></div>' +
          '<p class="muted small">高潮段大约占全文的一半，开头和结尾各 2–3 句就够了。</p>' +
          '<div class="row"><button class="btn ghost" data-go="1">← 修改</button><button class="btn" data-go="3">下一步：选好词 →</button></div></div>';
      } else if (step === 3) {
        draft.picked = draft.picked || [];
        var bank = (p.words || []).concat([]);
        html += '<div class="card"><h3>💎 挑 3–5 个好词好句（写作时会帮你检查有没有用上）</h3>' +
          (bank.length ? '<p class="lbl">本题推荐</p><div class="chips">' + bank.map(chipW).join('') + '</div>' : '') +
          Object.keys(D.goodWords).map(function (k) { return '<details><summary>' + k + '</summary><div class="chips">' + D.goodWords[k].map(chipW).join('') + '</div></details>'; }).join('') +
          '<p>已选：<b id="pk">' + (draft.picked.join('、') || '—') + '</b></p>' +
          '<div class="row"><button class="btn ghost" data-go="2">← 上一步</button><button class="btn" data-go="4">' + (planOnly ? '下一步：写一段 →' : '下一步：开始写作 →') + '</button></div></div>';
      } else if (step === 4) {
        html += '<div class="card"><h3>✍️ ' + (planOnly ? '今天只写高潮段（第3段）' : '写全文') + '</h3>' +
          '<details><summary>看我的提纲</summary><div class="outline small">' + fields.map(function (f) { return '<div><b>' + f[1] + '</b>：' + esc(draft[f[0]] || '—') + '</div>'; }).join('') + '</div></details>' +
          '<div class="chips small">' + (draft.picked || []).map(function (w) { return '<button class="chip ins" data-w="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div>' +
          '<textarea id="essay" rows="14" placeholder="' + (planOnly ? '写第3段：发生了什么？人物说了什么？心里怎么想？' : '每段之间空一行。') + '">' + esc(draft.text || '') + '</textarea>' +
          '<div id="live" class="live"></div><div class="row"><button class="btn ghost" data-go="3">← 上一步</button><button class="btn" data-go="5">完成，去自评 →</button></div></div>';
      } else {
        var res = analyse(draft.text || '', planOnly);
        html += '<div class="card"><h3>✅ 自我检查</h3>' + res.html +
          '<h3>📏 评分表（诚实地勾选）</h3><div class="rub">' +
          rubric().map(function (r, k) { return '<label><input type="checkbox" data-r="' + k + '"' + ((draft.rub || [])[k] ? ' checked' : '') + '> ' + r + '</label>'; }).join('') + '</div>' +
          '<div class="row"><button class="btn ghost" data-go="4">← 回去修改</button><button class="btn" id="submit">提交作文 🎉</button></div></div>';
        if (p.model) html += '<div class="card"><a class="btn ghost block" href="#write/model">📖 看这题的范文和批注</a></div>';
      }
      view.innerHTML = html;
      $$('[data-s]').forEach(function (b) { b.onclick = function () { go(+b.getAttribute('data-s')); }; });
      $$('[data-go]').forEach(function (b) { b.onclick = function () { go(+b.getAttribute('data-go')); }; });
      $$('[data-f]').forEach(function (inp) { inp.oninput = function () { draft[inp.getAttribute('data-f')] = inp.value; keep(); }; });
      $$('.chip.pk').forEach(function (c) {
        c.onclick = function () { var w = c.getAttribute('data-w'), i = draft.picked.indexOf(w); if (i >= 0) draft.picked.splice(i, 1); else draft.picked.push(w); c.classList.toggle('on'); $('#pk').textContent = draft.picked.join('、') || '—'; keep(); };
      });
      var ta = $('#essay');
      if (ta) {
        var upd = function () { draft.text = ta.value; keep(); $('#live').innerHTML = analyse(ta.value, planOnly).short; };
        ta.oninput = upd; upd();
        $$('.chip.ins').forEach(function (c) { c.onclick = function () { var w = c.getAttribute('data-w'), s = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, s) + w + ta.value.slice(s); ta.focus(); upd(); }; });
      }
      $$('[data-r]').forEach(function (c) { c.onchange = function () { draft.rub = draft.rub || []; draft.rub[+c.getAttribute('data-r')] = c.checked; keep(); }; });
      var sb = $('#submit');
      if (sb) sb.onclick = function () {
        var res = analyse(draft.text || '', planOnly);
        if (res.n < (planOnly ? 50 : 120)) { toast('还太短了，至少写 ' + (planOnly ? 50 : 120) + ' 字'); return; }
        var ticks = (draft.rub || []).filter(Boolean).length;
        S.essays.unshift({ id: Date.now(), title: p.title + (planOnly ? '（高潮段）' : ''), text: draft.text, date: today(), n: res.n, stars: res.stars, rub: ticks });
        save();
        var pts = (planOnly ? 15 : 30) + res.stars * 2 + ticks;
        addPoints(pts, (planOnly ? '写作片段：' : '作文：') + p.title);
        done();
        try { localStorage.removeItem(KEY + draftKey); } catch (e) { /* ignore */ }
        view.innerHTML = '<div class="card center"><div class="huge">🏅</div><h2>作文已保存！</h2><p>' + '⭐'.repeat(res.stars) + '　' + res.n + ' 字　+' + pts + ' 积分</p><p class="muted">请爸爸妈妈在「我的作文本」里看一看，写一句鼓励的话吧！</p><div class="row"><a class="btn" href="#write/book">我的作文本</a><a class="btn ghost" href="#home">回首页</a></div></div>';
      };
      function chipW(w) { return '<button class="chip pk' + ((draft.picked || []).indexOf(w) >= 0 ? ' on' : '') + '" data-w="' + esc(w) + '">' + esc(w) + '</button>'; }
    }
    function go(s) { step = s; draft.step = s; keep(); render(); window.scrollTo(0, 0); }
    function analyse(text, part) {
      var C = D.checker, n = hanCount(text), paras = text.split(/\n+/).filter(function (x) { return hanCount(x) > 0; }).length;
      var has = function (list) { return list.filter(function (w, i) { return list.indexOf(w) === i && text.indexOf(w) >= 0; }); };
      var feel = has(C.feel), sense = has(C.senses), links = has(C.links), order = has(C.order), lesson = has(C.lesson);
      var allGood = []; Object.keys(D.goodWords).forEach(function (k) { allGood = allGood.concat(D.goodWords[k]); });
      var good = has(allGood.concat(draft.picked || [], p.words || []));
      var talk = /[“"「][^”"」]{2,}[”"」]/.test(text) || /：\s*[“"「]/.test(text);
      var target = part ? 80 : 250;
      var checks = [
        [n >= target, '字数 ' + n + ' / ' + target + (part ? '' : '（P4 建议 250 字以上，P5 目标 300+）')],
        [part || paras >= 4, '分段：' + paras + ' 段' + (part ? '' : '（建议 4–5 段）')],
        [good.length >= 3, '好词好句 ' + good.length + ' 个' + (good.length ? '：' + good.slice(0, 6).join('、') : '')],
        [feel.length >= 2, '感受/心情词 ' + feel.length + ' 个' + (feel.length ? '：' + feel.join('、') : '')],
        [talk, '有人物对话（用引号）'],
        [sense.length >= 1, '五感描写（看到/听到/闻到…）'],
        [links.length + order.length >= 3, '连接词/关联词 ' + (links.length + order.length) + ' 个'],
        [part || lesson.length >= 1, '结尾有感受、道理或决心']
      ];
      var ok = checks.filter(function (c) { return c[0]; }).length;
      var stars = Math.max(1, Math.min(5, Math.round(ok / checks.length * 5)));
      var tips = [];
      if (!talk) tips.push('加一两句人物对话，例如：妈妈笑着说："……"');
      if (feel.length < 2) tips.push('多写心情变化：一开始……后来……最后……');
      if (good.length < 3) tips.push('把你选的好词用进去（点上面的词可以直接插入）。');
      if (!part && lesson.length < 1) tips.push('结尾写"这件事让我明白了……"或"我下定决心……"。');
      var list = '<ul class="checks">' + checks.map(function (c) { return '<li class="' + (c[0] ? 'y' : 'n') + '">' + (c[0] ? '✅' : '⬜') + ' ' + esc(c[1]) + '</li>'; }).join('') + '</ul>';
      return { n: n, stars: stars, short: '<div class="stars">' + '⭐'.repeat(stars) + '</div>' + list,
        html: '<div class="stars big">' + '⭐'.repeat(stars) + '</div>' + list + (tips.length ? '<div class="fb info"><b>修改建议：</b><ul>' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>' : '<div class="fb ok">很完整！再读一遍，检查错别字和标点。</div>') };
    }
    function rubric() {
      return ['内容：写出了图意/题意，没有离题', '内容：高潮部分写得最详细', '表达：用了好词好句，句子通顺', '表达：写出了人物的心情（不只是"很开心"）', '组织：有开头、经过、结尾，分段清楚', '组织：结尾写出了感受或道理', '我检查了错别字和标点符号'];
    }
    render();
  }

  function pageModel() {
    var m = D.modelEssay;
    view.innerHTML = '<h2 class="ph">📖 范文赏析：《' + m.title + '》</h2><div class="card"><p class="muted small">点击每段右边的 💬 看老师批注，学习这篇作文"好在哪里"。</p>' +
      m.paras.map(function (pr, k) { return '<div class="mp"><p>' + esc(pr[0]) + ' <button class="say" data-say="' + esc(pr[0]) + '">🔊</button></p><details><summary>💬 批注 ' + (k + 1) + '</summary><p class="note">' + esc(pr[1]) + '</p></details></div>'; }).join('') +
      '</div><div class="card"><h3>学到了什么？</h3><ul><li>开头 2 句，结尾 2 句，<b>高潮最长</b>。</li><li>心情不是直接说"害怕"，而是写"心怦怦直跳，双腿不停地发抖"。</li><li>对话让故事更生动。</li><li>结尾点出主题（诚实）。</li></ul><a class="btn block" href="#write/essay/honest">我也来写这一题 →</a></div>';
  }
  function pageBank() {
    view.innerHTML = '<h2 class="ph">💎 好词好句宝库</h2>' + Object.keys(D.goodWords).map(function (k) { return '<div class="card"><h3>' + k + '</h3><div class="chips">' + D.goodWords[k].map(function (w) { return '<button class="chip" data-say="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="card"><h3>扩句范例</h3>' + D.expand.map(function (x) { return '<div class="ex"><b>' + esc(x.base) + '</b> → ' + esc(x.model) + '</div>'; }).join('') + '</div>' +
      '<div class="card"><h3>心情描写范例</h3>' + D.mood.map(function (x) { return '<div class="ex"><b>' + esc(x.tell) + '</b> → ' + esc(x.model) + '</div>'; }).join('') + '</div>';
  }
  function pageBook(id) {
    if (id) {
      var e = S.essays.filter(function (x) { return String(x.id) === id; })[0];
      if (!e) { location.hash = '#write/book'; return; }
      view.innerHTML = '<h2 class="ph">《' + esc(e.title) + '》</h2><div class="card"><p class="muted">' + e.date + ' · ' + e.n + ' 字 · ' + '⭐'.repeat(e.stars) + '</p><div class="essay">' + esc(e.text).replace(/\n/g, '<br>') + '</div>' +
        '<label class="lbl">家长/老师评语</label><textarea id="cm" rows="3" placeholder="写一句鼓励或建议……">' + esc(e.comment || '') + '</textarea>' +
        '<div class="row"><button class="btn" id="sv">保存评语</button><button class="btn ghost" onclick="window.print()">打印</button><button class="btn warn" id="del">删除</button></div></div>';
      $('#sv').onclick = function () { e.comment = $('#cm').value; save(); toast('评语已保存'); };
      $('#del').onclick = function () { if (confirm('确定删除这篇作文吗？')) { S.essays = S.essays.filter(function (x) { return x !== e; }); save(); location.hash = '#write/book'; } };
      return;
    }
    view.innerHTML = '<h2 class="ph">📒 我的作文本</h2>' + (S.essays.length ? S.essays.map(function (e) { return '<a class="task" href="#write/book/' + e.id + '"><span>' + '⭐'.repeat(e.stars) + '</span>' + esc(e.title) + ' <small class="muted">' + e.date + ' · ' + e.n + ' 字' + (e.comment ? ' · 💬' : '') + '</small></a>'; }).join('') : '<div class="card center"><p>还没有作文，去作文工作坊写第一篇吧！</p><a class="btn" href="#write">去写作</a></div>');
  }

  /* ---------- 口试 ---------- */
  var rec = null, chunks = [];
  function pageOral(extra) {
    var daily = extra === 'daily';
    view.innerHTML = '<h2 class="ph">🎤 口试练习</h2>' +
      '<div class="card"><h3>📢 朗读</h3><p class="muted small">先听一遍示范，再自己大声读，然后录音听听自己的声音。</p>' +
      D.oralRead.map(function (r) { return '<div class="ex"><b>' + r.title + '</b><p class="read">' + esc(r.text) + '</p><div class="row wrap"><button class="btn ghost" data-say="' + esc(r.text) + '" data-rate="0.75">🔊 慢速</button><button class="btn ghost" data-say="' + esc(r.text) + '" data-rate="0.95">🔊 正常</button></div></div>'; }).join('') + '</div>' +
      '<div class="card"><h3>💬 会话（看图/视频会话）</h3><div class="formula"><span>① 我的看法</span><span>② 原因：因为……</span><span>③ 例子：例如/有一次……</span><span>④ 总结：所以……</span></div>' +
      D.oralTalk.map(function (t, k) { return '<details><summary>' + esc(t.q) + '</summary>' + (t.sample ? '<p class="note">示范：' + esc(t.sample) + ' <button class="say" data-say="' + esc(t.sample) + '">🔊</button></p>' : '<p class="note">用上面的 4 步公式回答，说 4–6 句。</p>') + '</details>'; }).join('') + '</div>' +
      '<div class="card"><h3>🎙️ 录音，听听自己</h3><p class="muted small">录音只在这台设备上播放，不会上传。</p><div class="row"><button class="btn" id="rec">● 开始录音</button></div><audio id="au" controls style="display:none;width:100%"></audio>' +
      '<label class="lbl">自评（说完后勾选）</label><div class="rub"><label><input type="checkbox" class="oc"> 声音响亮、清楚</label><label><input type="checkbox" class="oc"> 字音准确，没有读错</label><label><input type="checkbox" class="oc"> 会话有看法、原因、例子</label><label><input type="checkbox" class="oc"> 说了完整的句子</label></div>' +
      '<div class="row"><button class="btn" id="odone">完成口试练习 +10</button></div></div>' +
      '<div class="card"><h3>💡 技巧</h3><ul>' + D.tips.oral.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>';
    $('#rec').onclick = function () {
      var b = this;
      if (rec && rec.state === 'recording') { rec.stop(); b.textContent = '● 开始录音'; return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { toast('这个浏览器不支持录音'); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
        chunks = []; rec = new MediaRecorder(st);
        rec.ondataavailable = function (e) { chunks.push(e.data); };
        rec.onstop = function () { st.getTracks().forEach(function (t) { t.stop(); }); var au = $('#au'); if (!au) return; au.src = URL.createObjectURL(new Blob(chunks)); au.style.display = 'block'; };
        rec.start(); b.textContent = '■ 停止录音';
      }).catch(function () { toast('没有麦克风权限'); });
    };
    $('#odone').onclick = function () {
      if ($$('.oc:checked').length < 2) { toast('先练习，再勾选自评哦'); return; }
      this.disabled = true; addPoints(10, '口试练习'); if (daily) markDone('wa');
    };
  }

  /* ---------- 错题本 ---------- */
  function pageWrong(go) {
    if (go && S.wrong.length) {
      var qs = pick(S.wrong, Math.min(10, S.wrong.length)).map(function (w) { return JSON.parse(JSON.stringify(w)); });
      return runQuiz({ title: '错题复习', questions: qs, fromWrongBook: true, onFinish: function () { if (!S.wrong.length) toast('错题本清空了！🎉'); } });
    }
    var by = {}; S.wrong.forEach(function (w) { by[w.skill] = (by[w.skill] || 0) + 1; });
    view.innerHTML = '<h2 class="ph">📕 错题本</h2><div class="card"><p>答错的题目会自动放进这里。<b>再答对一次</b>就会从错题本移除。</p>' +
      (S.wrong.length ? '<p>' + Object.keys(by).map(function (k) { return '<span class="pill">' + (SKILLS[k] || k) + ' ' + by[k] + '</span>'; }).join(' ') + '</p><a class="btn big block" href="#wrong/go">开始复习（最多 10 题）</a>' : '<p class="center huge">🎉</p><p class="center">目前没有错题，继续保持！</p>') + '</div>';
  }

  /* ---------- 我的 / 家长 ---------- */
  function bar(label, o) {
    var a = pct(o); return '<div class="bar"><span>' + label + '</span><div><i style="width:' + (a || 0) + '%;background:' + (a === null ? '#ddd' : a >= 80 ? 'var(--ok)' : a >= 60 ? 'var(--amber)' : 'var(--bad)') + '"></i></div><b>' + (a === null ? '—' : a + '%') + '</b><small>' + (o ? o.t : 0) + '题</small></div>';
  }
  function pageMe() {
    var r = rank();
    var weak = ['P1', 'P2', 'P3', 'P4'].filter(function (l) { var o = S.lvl[l]; return o && o.t >= 10 && o.c / o.t < 0.7; });
    var weakSk = Object.keys(S.skill).filter(function (k) { var o = S.skill[k]; return o.t >= 5 && o.c / o.t < 0.7; });
    view.innerHTML = '<h2 class="ph">📊 ' + esc(S.name) + ' 的进度</h2>' +
      '<div class="card stats"><div><b>' + S.points + '</b><small>总积分</small></div><div><b>' + S.streak + '</b><small>连续签到</small></div><div><b>' + S.loginDays.length + '</b><small>签到天数</small></div><div><b>' + missionDays() + '</b><small>完成任务天数</small></div><div><b>' + S.correctTotal + '</b><small>答对题数</small></div><div><b>' + S.essays.length + '</b><small>作文篇数</small></div></div>' +
      '<div class="card"><h3>' + r.r[1] + '</h3><div class="ranks">' + RANKS.map(function (x) { return '<span class="' + (S.points >= x[0] ? 'on' : '') + '">' + x[1] + '<small>' + x[0] + '</small></span>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>🏅 奖章</h3><div class="badges">' + BADGES.map(function (b) { var on = S.badges.indexOf(b[0]) >= 0; return '<div class="badge ' + (on ? 'on' : '') + '"><span>' + b[1] + '</span><small>' + b[2] + '</small></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>👨‍👩‍👦 家长报告：各年级掌握程度</h3>' + ['P1', 'P2', 'P3', 'P4', 'P5'].map(function (l) { return bar(D.levelNames[l], S.lvl[l]); }).join('') +
      '<h3>各题型正确率</h3>' + Object.keys(SKILLS).map(function (k) { return bar(SKILLS[k], S.skill[k]); }).join('') +
      '<div class="fb info"><b>建议：</b>' + (weak.length || weakSk.length ? '多练习 ' + weak.map(function (l) { return D.levelNames[l]; }).concat(weakSk.map(function (k) { return SKILLS[k]; })).join('、') + '（正确率低于 70%）。「智能混合」会自动多出这些题。' : '继续每天完成三项任务。数据越多，建议越准确。') + '</div></div>' +
      '<div class="card"><h3>🧾 最近积分</h3><div class="log">' + (S.log.slice(0, 15).map(function (l) { return '<div><span>' + l.d.slice(5) + '</span>' + esc(l.w) + '<b>+' + l.n + '</b></div>'; }).join('') || '<p class="muted">暂无</p>') + '</div></div>' +
      '<div class="card"><h3>💾 备份 / 换设备</h3><p class="muted small">进度只保存在这个浏览器。换手机/电脑前，先导出，在新设备上导入。</p>' +
      '<div class="row wrap"><button class="btn ghost" id="exp">导出进度</button><button class="btn ghost" id="imp">导入进度</button><button class="btn ghost" id="ren">改名字</button><button class="btn warn" id="rst">全部重置</button></div><textarea id="bk" rows="3" style="display:none"></textarea></div>';
    $('#exp').onclick = function () { var t = $('#bk'); t.style.display = 'block'; t.value = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); t.select(); try { document.execCommand('copy'); toast('已复制，请保存到备忘录'); } catch (e) { toast('请复制方框里的文字'); } };
    $('#imp').onclick = function () {
      var t = $('#bk'); if (t.style.display === 'none' || !t.value.trim()) { t.style.display = 'block'; t.value = ''; t.placeholder = '把导出的文字贴在这里，再按一次「导入进度」'; return; }
      try { var s = JSON.parse(decodeURIComponent(escape(atob(t.value.trim())))); if (!('points' in s)) throw 0; S = s; var b = blank(); for (var k in b) if (!(k in S)) S[k] = b[k]; save(); toast('导入成功！'); renderTop(); pageMe(); } catch (e) { toast('导入失败，请检查文字是否完整'); }
    };
    $('#ren').onclick = function () { var n = prompt('新名字：', S.name); if (n && n.trim()) { S.name = n.trim().slice(0, 12); save(); pageMe(); } };
    $('#rst').onclick = function () { if (confirm('确定要清除所有积分和进度吗？这不能恢复！')) { S = blank(); save(); location.hash = ''; route(); } };
  }

  /* ================= router ================= */
  function route() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    var h = (location.hash || '#home').slice(1).split('/');
    if (!S.name) { $('#nav').style.display = 'none'; $('#top').style.display = 'none'; pageLogin(); return; }
    $('#nav').style.display = ''; $('#top').style.display = '';
    checkIn(); renderTop();
    $$('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href').slice(1) === h[0]); });
    switch (h[0]) {
      case 'vocab': pageVocab(h[1], h[2] === 'daily'); break;
      case 'wa': pageWA(h[1], h[2]); break;
      case 'write': pageWrite(h[1], h[2]); break;
      case 'oral': pageOral(h[1]); break;
      case 'wrong': pageWrong(h[1] === 'go'); break;
      case 'me': pageMe(); break;
      default: pageHome();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
