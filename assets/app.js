/* 故似的工作台 —— 单页 PWA */
(function () {
  'use strict';
  const D = window.WB_DATA;
  const KEY = 'wb_state_v1';

  /* ============ 模块定义 ============ */
  const MODULES = [
    { id: 'home', icon: '🏠', label: '首页', name: '首页' },
    { id: 'todo', icon: '📝', label: '待办', name: '今日待办' },
    { id: 'diet', icon: '🍚', label: '饮食', name: '饮食' },
    { id: 'sport', icon: '🏃', label: '运动', name: '运动' },
    { id: 'finance', icon: '💰', label: '财务', name: '财务' },
    { id: 'media', icon: '📱', label: '自媒体', name: '自媒体' },
    { id: 'photo', icon: '📷', label: '拍照', name: '拍照打卡' },
    { id: 'shop', icon: '🛒', label: '购物', name: '想买清单' },
    { id: 'idea', icon: '💡', label: '灵感', name: '灵感记录' },
    { id: 'summary', icon: '📊', label: '总结', name: '总结' }
  ];
  const MODMAP = {}; MODULES.forEach(m => MODMAP[m.id] = m);

  const THEMES = [
    { k: 'sky', n: '天空蓝', a: '#3d9be9', b: '#7cc8f7' },
    { k: 'mint', n: '薄荷绿', a: '#28b795', b: '#7dddc0' },
    { k: 'sakura', n: '樱花粉', a: '#f2779d', b: '#ffb3c8' },
    { k: 'sun', n: '暖阳橙', a: '#f0913a', b: '#ffc078' },
    { k: 'lav', n: '薰衣草', a: '#8a7be8', b: '#b8aefa' }
  ];

  /* ============ 工具 ============ */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => (n < 10 ? '0' + n : '' + n);
  const fmtD = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const money = n => (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');

  /* 工作台日期：早 7:00 为分界，7 点前仍算前一天 */
  function wbToday() { const n = new Date(); if (n.getHours() < 7) n.setDate(n.getDate() - 1); return fmtD(n); }
  function dayIndex() {
    const n = new Date(wbToday() + 'T00:00:00');
    return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 86400000);
  }
  const ym = ds => ds.slice(0, 7);
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function cnDate(ds) {
    const d = new Date(ds + 'T00:00:00');
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + WEEK[d.getDay()];
  }
  function greetWord() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 23) return '晚上好';
    return '夜深了';
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1900);
  }

  function modal(title, opts) {
    opts = opts || {};
    return new Promise(res => {
      const m = $('#modal');
      m.innerHTML = '<h3>' + esc(title) + '</h3>' +
        (opts.html || '<input class="input" id="modal-in" placeholder="' + esc(opts.ph || '') + '" value="' + esc(opts.value || '') + '"' + (opts.type === 'number' ? ' inputmode="decimal"' : '') + '>') +
        '<div id="modal-btns"><button class="btn line" data-m="0">取消</button><button class="btn" data-m="1">' + esc(opts.ok || '确定') + '</button></div>';
      $('#modal-mask').classList.add('on');
      const inp = $('#modal-in'); if (inp) setTimeout(() => inp.focus(), 60);
      const close = v => { $('#modal-mask').classList.remove('on'); res(v); };
      m.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
        if (b.dataset.m === '0') return close(null);
        const el = $('#modal-in'); close(el ? el.value.trim() : true);
      });
      if (inp) inp.onkeydown = e => { if (e.key === 'Enter') { close(inp.value.trim()); } };
    });
  }

  /* ============ 状态 ============ */
  const DEFAULT = {
    version: 1,
    settings: { nickname: '故似', accountType: '生活记录', birthday: '', theme: 'sky', color: '', color2: '', font: 'system', fs: 15 },
    sidebar: MODULES.map(m => ({ id: m.id, icon: m.icon, label: m.label, name: m.name, on: true })),
    todo: { date: wbToday(), items: [{ id: uid(), text: '早晨一杯温水', done: false }, { id: uid(), text: '晨间唤醒身体', done: false }], tomorrow: [], history: {} },
    checkins: {},
    diet: { mealLog: {} },
    sport: { weights: [], logs: [] },
    finance: [],
    media: { topics: [] },
    photos: [],
    wishes: [],
    ideas: [],
    summary: { daily: {}, monthly: {} }
  };
  let S;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      S = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT));
    } catch (e) { S = JSON.parse(JSON.stringify(DEFAULT)); }
    normalize();
    return S;
  }
  function normalize() {
    const d = JSON.parse(JSON.stringify(DEFAULT));
    for (const k in d) if (S[k] === undefined) S[k] = d[k];
    if (!S.settings || typeof S.settings !== 'object') S.settings = d.settings;
    for (const k in d.settings) if (S.settings[k] === undefined) S.settings[k] = d.settings[k];
    if (!Array.isArray(S.sidebar) || !S.sidebar.length) S.sidebar = d.sidebar;
    if (!Array.isArray(S.finance)) S.finance = [];
    if (!Array.isArray(S.photos)) S.photos = [];
    if (!Array.isArray(S.ideas)) S.ideas = [];
    if (!Array.isArray(S.wishes)) S.wishes = [];
    if (!S.media || !Array.isArray(S.media.topics)) S.media = { topics: [] };
    if (!S.sport) S.sport = { weights: [], logs: [] };
    if (!Array.isArray(S.sport.weights)) S.sport.weights = [];
    if (!Array.isArray(S.sport.logs)) S.sport.logs = [];
    if (!S.summary || typeof S.summary !== 'object') S.summary = { daily: {}, monthly: {} };
    if (!S.summary.daily) S.summary.daily = {};
    if (!S.summary.monthly) S.summary.monthly = {};
    if (!S.todo || !Array.isArray(S.todo.items)) S.todo = JSON.parse(JSON.stringify(DEFAULT.todo));
    if (!Array.isArray(S.todo.tomorrow)) S.todo.tomorrow = [];
    if (!S.todo.history) S.todo.history = {};
    if (!S.checkins || typeof S.checkins !== 'object') S.checkins = {};
    if (!S.diet || typeof S.diet !== 'object') S.diet = { mealLog: {} };
  }
  let saveWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) {
      if (!saveWarned) { saveWarned = true; toast('存储空间不足，请在设置里导出备份后清理照片'); }
    }
  }

  /* ============ 日期翻转：次日 7:00 把「明日计划」并进今日 ============ */
  let TODAY = wbToday();
  function rollDay(force) {
    const t = wbToday();
    if (t === S.todo.date && !force) { TODAY = t; return false; }
    const old = S.todo.date;
    if (old && old !== t) {
      S.todo.history[old] = S.todo.items.map(i => ({ text: i.text, done: !!i.done }));
      if (Object.keys(S.todo.history).length > 120) {
        Object.keys(S.todo.history).sort().slice(0, 40).forEach(k => delete S.todo.history[k]);
      }
    }
    const carry = S.todo.items.filter(i => !i.done).map(i => ({ id: uid(), text: i.text, done: false }));
    const fresh = (S.todo.tomorrow || []).map(i => ({ id: uid(), text: i.text, done: false }));
    const seen = {};
    S.todo.items = fresh.concat(carry).filter(i => { const k = i.text; if (seen[k]) return false; seen[k] = 1; return true; });
    S.todo.tomorrow = [];
    S.todo.date = t;
    TODAY = t;
    save();
    return true;
  }

  /* ============ 打卡 / 统计 ============ */
  const activeModules = () => S.sidebar.filter(m => m.on && m.id !== 'home' && m.id !== 'summary');
  const ci = ds => (S.checkins[ds] = S.checkins[ds] || {});
  function allDone(ds) {
    const ms = S.sidebar.filter(m => m.on && m.id !== 'home' && m.id !== 'summary' && m.id !== 'custom');
    if (!ms.length) return false;
    const c = S.checkins[ds] || {};
    return ms.every(m => c[m.id]);
  }
  const dayDone = ds => { const c = S.checkins[ds] || {}; return !!c.day || allDone(ds); };
  function doneCount(ds) { const c = S.checkins[ds] || {}; return activeModules().filter(m => c[m.id]).length; }
  function autoDay() { if (allDone(TODAY)) ci(TODAY).day = true; }
  function streak() {
    let n = 0; const d = new Date(TODAY + 'T00:00:00');
    if (!dayDone(TODAY)) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 3660; i++) {
      if (!dayDone(fmtD(d))) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function monthStats(m) {
    const rows = S.finance.filter(f => ym(f.date) === m);
    const inn = rows.filter(r => r.type === 'in').reduce((a, b) => a + b.amount, 0);
    const out = rows.filter(r => r.type === 'out').reduce((a, b) => a + b.amount, 0);
    let days = 0; const last = new Date().getDate();
    for (let i = 1; i <= (ym(TODAY) === m ? last : 31); i++) {
      const ds = m + '-' + pad(i);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
      const d2 = new Date(ds + 'T00:00:00'); if (d2.getMonth() + 1 !== +m.slice(5)) break;
      if (dayDone(ds)) days++;
    }
    return { inn, out, balance: inn - out, days, count: rows.length };
  }

  /* ============ 主题 ============ */
  function applyTheme() {
    const st = S.settings;
    const th = THEMES.find(t => t.k === st.theme) || THEMES[0];
    const a = st.color || th.a, b = st.color2 || th.b;
    const r = document.documentElement.style;
    r.setProperty('--brand', a); r.setProperty('--brand2', b);
    r.setProperty('--bg', 'color-mix(in srgb, ' + a + ' 7%, #f7fbff)');
    r.setProperty('--line', 'color-mix(in srgb, ' + a + ' 14%, #f0f6fc)');
    document.documentElement.dataset.font = st.font;
    r.setProperty('--fs', st.fs + 'px');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', a);
  }

  /* ============ 侧边栏 / 顶栏 ============ */
  function renderSide() {
    const box = $('#side');
    let h = '<div class="side-logo">🌸</div>';
    S.sidebar.filter(m => m.on).forEach(m => {
      h += '<button class="side-item' + (m.id === page ? ' on' : '') + '" data-act="nav" data-id="' + m.id + '">' +
        '<span class="si">' + esc(m.icon) + '</span><span class="sl">' + esc(m.label) + '</span></button>';
    });
    box.innerHTML = h;
  }
  function renderTop() {
    const done = doneCount(TODAY), tot = activeModules().length;
    const isDay = dayDone(TODAY) && !!((S.checkins[TODAY] || {}).day);
    $('#tb-name').textContent = S.settings.nickname || '故似';
    $('#tb-date').textContent = cnDate(TODAY) + ' · 已完成 ' + done + '/' + tot;
    const b = $('#btn-day');
    b.textContent = isDay ? '✓ 已打卡' : '今日打卡';
    b.classList.toggle('done', isDay);
  }

  /* ============ 页面渲染 ============ */
  let page = 'home';
  const titleOf = id => { const m = S.sidebar.find(x => x.id === id); return m ? m.name : '页面'; };

  function pageHead(id, sub) {
    const m = S.sidebar.find(x => x.id === id);
    return '<div class="row between" style="margin:2px 2px 12px">' +
      '<div><div style="font-size:19px;font-weight:700">' + esc(m ? m.name : '') + '</div>' +
      '<div class="sub">' + esc(sub || '') + '</div></div>' +
      checkinBtn(id) + '</div>';
  }
  function checkinBtn(id) {
    const on = !!((S.checkins[TODAY] || {})[id]);
    return '<button class="btn ' + (on ? 'ghost' : '') + '" data-act="ci" data-id="' + id + '" style="' +
      (on ? 'background:#e6f7ee;color:#35b46a' : '') + '">' + (on ? '✓ 已打卡' : '打卡') + '</button>';
  }

  /* ---- 首页 ---- */
  function vHome() {
    const di = dayIndex();
    const quote = D.QUOTES[di % D.QUOTES.length];
    const done = doneCount(TODAY), tot = activeModules().length || 1;
    const pct = Math.round(done / tot * 100);
    const C = 2 * Math.PI * 32;
    const ms = activeModules();
    let h = '';
    h += '<div class="hero"><div class="hero-top"><div class="hero-left">' +
      '<span class="hero-chip">' + cnDate(TODAY) + '</span>' +
      '<div class="hero-greet">' + greetWord() + '，' + esc(S.settings.nickname || '故似') + '</div>' +
      '<div class="hero-quote">『' + esc(quote) + '』</div></div>' +
      '<div class="ring"><svg width="78" height="78"><circle cx="39" cy="39" r="32" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="7"/>' +
      '<circle cx="39" cy="39" r="32" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct / 100)) + '"/></svg>' +
      '<div class="ring-txt"><b>' + pct + '%</b>完成</div></div></div>' +
      '<div class="hero-foot"><div><b>' + done + '/' + tot + '</b><span>今日完成</span></div>' +
      '<div><b>' + streak() + ' 天</b><span>连续打卡</span></div></div></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>今日完成情况</div>' +
      '<span class="sub">' + done + '/' + tot + '</span></div>';
    if (!ms.length) h += '<div class="empty">左侧任务栏都被关掉了，去设置里打开几个吧</div>';
    else {
      h += '<div class="grid2">';
      ms.forEach(m => {
        const on = !!((S.checkins[TODAY] || {})[m.id]);
        h += '<div class="mod-card' + (on ? ' done' : '') + '" data-act="nav" data-id="' + m.id + '">' +
          '<div class="mc-mark">' + (on ? '✓' : '') + '</div>' +
          '<div class="mc-ic">' + esc(m.icon) + '</div>' +
          '<div class="mc-n">' + esc(m.name) + '</div>' +
          '<div class="mc-s">' + esc(modSub(m.id, on)) + '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';

    const fin = monthStats(ym(TODAY));
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>本月小结</div>' +
      '<span class="sub">' + ym(TODAY) + '</span></div>' +
      '<div class="row between"><div><div class="sub">结余</div><div style="font-size:18px;font-weight:700;color:' + (fin.balance >= 0 ? 'var(--ok)' : 'var(--danger)') + '">￥' + money(fin.balance) + '</div></div>' +
      '<div style="text-align:right"><div class="sub">打卡 ' + fin.days + ' 天 · 记录 ' + fin.count + ' 笔</div>' +
      '<div class="sub">收 ' + money(fin.inn) + ' / 支 ' + money(fin.out) + '</div></div></div></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>快捷入口</div></div>' +
      '<div class="quick">' +
      '<button data-act="q" data-id="finance"><span>✍️</span>记一笔</button>' +
      '<button data-act="q" data-id="idea"><span>💡</span>写灵感</button>' +
      '<button data-act="shot" data-tag="素材"><span>📸</span>拍素材</button>' +
      '<button data-act="q" data-id="summary"><span>📊</span>写总结</button>' +
      '</div></div>';
    return h;
  }
  function modSub(id, on) {
    if (on) return '已完成 ✓';
    const c = S.checkins[TODAY] || {};
    if (id === 'todo') { const t = S.todo.items.length, d = S.todo.items.filter(i => i.done).length; return t ? d + '/' + t + ' 项待办' : '暂无待办'; }
    if (id === 'finance') { const n = S.finance.filter(f => f.date === TODAY).length; return n ? '今日 ' + n + ' 笔' : '今日未记账'; }
    if (id === 'sport') { const n = (S.sport.logs || []).filter(l => l.date === TODAY).length; return n ? '练了 ' + n + ' 组' : '今天还没动'; }
    if (id === 'photo') { const n = S.photos.filter(p => p.date === TODAY).length; return n ? '今日 ' + n + ' 张' : '今日未拍'; }
    if (id === 'idea') { const n = S.ideas.filter(p => p.date === TODAY).length; return n ? '今日 ' + n + ' 条' : '今日无灵感'; }
    if (id === 'shop') { const n = S.wishes.filter(w => !w.done).length; return n + ' 件想买'; }
    if (id === 'diet') return '点开看今日食谱';
    if (id === 'media') return '看今日爆款选题';
    return '待完成';
  }

  /* ---- 今日待办 ---- */
  function vTodo() {
    const items = S.todo.items, d = items.filter(i => i.done).length;
    let h = pageHead('todo', '共 ' + items.length + ' 项，完成 ' + d + ' 项');
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>今日清单</div>' +
      '<span class="sub">' + (items.length ? Math.round(d / items.length * 100) + '%' : '0%') + '</span></div>' +
      '<div class="bar" style="margin-bottom:10px"><i style="width:' + (items.length ? d / items.length * 100 : 0) + '%"></i></div>';
    if (!items.length) h += '<div class="empty">还没有待办，下面加一条吧</div>';
    items.forEach(i => {
      h += '<div class="list-item"><button class="tick' + (i.done ? ' on' : '') + '" data-act="tg" data-id="' + i.id + '">' + (i.done ? '✓' : '') + '</button>' +
        '<div class="li-main" data-act="tg" data-id="' + i.id + '"><div class="li-t' + (i.done ? ' done-text' : '') + '">' + esc(i.text) + '</div></div>' +
        '<button class="x-btn" data-act="del" data-id="' + i.id + '">✕</button></div>';
    });
    h += '<div class="row" style="margin-top:12px"><input class="input grow" data-in="todo" placeholder="新增一项，比如「晚上泡脚」">' +
      '<button class="btn" data-act="add" data-id="todo">添加</button></div></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>明日计划</div>' +
      '<span class="chip">次日 7:00 自动转为今日待办</span></div>';
    if (!S.todo.tomorrow.length) h += '<div class="empty">还没写明天的计划</div>';
    S.todo.tomorrow.forEach(i => {
      h += '<div class="list-item"><span style="font-size:14px">🌤</span><div class="li-main"><div class="li-t">' + esc(i.text) + '</div></div>' +
        '<button class="x-btn" data-act="delt" data-id="' + i.id + '">✕</button></div>';
    });
    h += '<div class="row" style="margin-top:12px"><input class="input grow" data-in="tmr" placeholder="明天要做的事…">' +
      '<button class="btn" data-act="addt">添加</button></div>' +
      '<div class="sub" style="margin-top:8px">今日未完成的事项也会自动带到明天。</div></div>';

    const hist = Object.keys(S.todo.history).sort().reverse().slice(0, 5);
    if (hist.length) {
      h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>近几日回顾</div></div>';
      hist.forEach(k => {
        const arr = S.todo.history[k], ok = arr.filter(x => x.done).length;
        h += '<div class="list-item"><div class="li-main"><div class="li-t">' + k + '</div>' +
          '<div class="li-s">' + ok + '/' + arr.length + ' 完成</div></div>' +
          '<span class="chip ' + (ok === arr.length && arr.length ? 'ok' : 'gray') + '">' + (ok === arr.length && arr.length ? '全勤' : '部分') + '</span></div>';
      });
      h += '</div>';
    }
    return h;
  }

  /* ---- 饮食 ---- */
  function vDiet() {
    const dayI = dayIndex();
    const dm = S.diet.mealLog || {};
    const eaten = dm[TODAY] || [];
    let h = pageHead('diet', '一日三餐 + 食材科普');
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>今日饮食打卡</div>' + checkinBtn('diet') + '</div>' +
      '<div class="row wrap">' + ['早餐', '午餐', '晚餐', '加餐'].map(t =>
        '<button class="btn sm ' + (eaten.indexOf(t) > -1 ? '' : 'line') + '" data-act="meal" data-id="' + t + '">' + (eaten.indexOf(t) > -1 ? '✓ ' : '') + t + '</button>').join('') + '</div></div>';

    /* 爸爸妈妈篇 */
    const dayMenu = D.MENU_PARENTS[dayI % D.MENU_PARENTS.length];
    h += '<div class="section-title">爸爸妈妈篇 · ' + dayMenu.day + '食谱</div>';
    h += '<div class="card">';
    dayMenu.meals.forEach(m => {
      const tip = D.ING_TIPS[m.key] || D.genericTip;
      h += '<div class="meal"><div class="meal-h"><div class="meal-t">' + m.type + ' · ' + esc(m.name) + '</div>' +
        '<span class="meal-k">约 ' + m.kcal + ' kcal</span></div>' +
        '<div class="sub" style="margin-top:6px"><b>食材：</b>' + m.ing.map(esc).join('、') + '</div>' +
        '<div class="sub" style="margin-top:4px"><b>做法：</b></div><ul>' + m.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' +
        '<div class="hr"></div>' +
        '<div class="tipbox good"><b>🌟 ' + esc(m.key) + ' 的好处</b>' + tip.good.map(esc).join('；') + '。</div>' +
        '<div class="tipbox bad"><b>⚠️ 需要注意</b>' + tip.bad.map(esc).join('；') + '。</div></div>';
    });
    h += '</div>';

    /* 潼潼宝贝篇 */
    const bd = S.settings.birthday;
    h += '<div class="section-title">潼潼宝贝篇</div>';
    h += '<div class="card">';
    if (!bd) {
      h += '<div class="empty">设置潼潼的生日，就能算出成长天数并推荐当月龄的餐食</div>' +
        '<div class="row"><input class="input grow" type="date" data-bind="birthday"><button class="btn" data-act="bind">保存</button></div>';
    } else {
      const days = Math.floor((new Date(TODAY + 'T00:00:00') - new Date(bd + 'T00:00:00')) / 86400000);
      const b = new Date(bd + 'T00:00:00'), n = new Date(TODAY + 'T00:00:00');
      let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
      if (n.getDate() < b.getDate()) months--;
      if (months < 0) months = 0;
      const stage = D.MENU_BABY.find(s => { const a = parseInt(s.stage, 10); return months >= a && months < a + 3; }) || D.MENU_BABY[D.MENU_BABY.length - 1];
      h += '<div class="row between" style="margin-bottom:10px"><div><div class="sub">已陪伴</div>' +
        '<div style="font-size:24px;font-weight:700;color:var(--brand)">' + days + ' <span style="font-size:13px">天</span></div></div>' +
        '<div style="text-align:right"><div class="sub">月龄</div><div style="font-size:18px;font-weight:700">' + months + ' 个月</div>' +
        '<div class="sub">' + esc(stage.stage) + '</div></div></div>' +
        '<div class="chip">' + esc(stage.tag) + '</div>';
      stage.meals.forEach(m => {
        const tip = D.ING_TIPS[m.key] || D.genericTip;
        h += '<div class="meal" style="margin-top:10px"><div class="meal-h"><div class="meal-t">' + m.type + ' · ' + esc(m.name) + '</div>' +
          '<span class="meal-k">约 ' + m.kcal + ' kcal</span></div>' +
          '<div class="sub" style="margin-top:6px"><b>食材：</b>' + m.ing.map(esc).join('、') + '</div>' +
          '<div class="sub" style="margin-top:4px"><b>做法：</b></div><ul>' + m.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' +
          '<div class="tipbox good"><b>🌟 为什么适合</b>' + tip.good.join('；') + '。</div>' +
          '<div class="tipbox bad"><b>⚠️ 注意事项</b>' + tip.bad.join('；') + '。</div></div>';
      });
      h += '<div class="hr"></div><div class="sub"><b>育儿小提醒</b></div><ul style="padding-left:17px;margin:6px 0 0">' +
        D.BABY_TIPS.slice(0, 5).map(t => '<li class="sub" style="line-height:1.8">' + esc(t) + '</li>').join('') + '</ul>';
      h += '<button class="btn line sm" style="margin-top:10px" data-act="bind">修改生日</button>';
    }
    h += '</div>';
    return h;
  }

  /* ---- 运动 ---- */
  function vSport() {
    const di = dayIndex();
    const ws = (D.WORKOUTS.slice(di % 2 ? 0 : 1).concat(D.WORKOUTS)).slice(0, 4);
    const logs = (S.sport.logs || []).filter(l => l.date === TODAY);
    const ws2 = S.sport.weights || [];
    let h = pageHead('sport', '动一动，+1 天');
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>今日推荐练习</div>' +
      '<span class="chip">' + cnDate(TODAY) + '</span></div>';
    ws.forEach(w => {
      const on = logs.some(l => l.name === w.name);
      h += '<div class="list-item"><div class="li-main"><div class="li-t">' + esc(w.name) + ' <span class="chip gray">' + esc(w.part) + '</span></div>' +
        '<div class="li-s">' + esc(w.desc) + ' · ' + w.min + ' 分钟 ≈ ' + w.kcal + ' kcal</div></div>' +
        '<button class="btn sm ' + (on ? 'ghost' : '') + '" data-act="wlog" data-id="' + esc(w.name) + '">' + (on ? '✓ 已练' : '完成') + '</button>' +
        '<button class="btn sm line" data-act="keep" data-id="Keep" data-kw="' + esc(w.kw) + '">Keep</button></div>';
    });
    h += '<div class="sub" style="margin-top:8px">点 Keep 会尝试唤起 App，没装则打开网页版。</div></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>体重记录</div>' +
      (ws2.length >= 2 ? '<span class="chip ' + (ws2[ws2.length - 1].kg <= ws2[0].kg ? 'ok' : 'warn') + '">累计 ' + money(ws2[ws2.length - 1].kg - ws2[0].kg) + ' kg</span>' : '') + '</div>';
    if (ws2.length >= 2) {
      const arr = ws2.slice(-14), mn = Math.min.apply(null, arr.map(x => x.kg)), mx = Math.max.apply(null, arr.map(x => x.kg));
      const rg = (mx - mn) || 1;
      const pts = arr.map((x, i) => (i / (arr.length - 1) * 280 + 10) + ',' + (70 - (x.kg - mn) / rg * 52)).join(' ');
      h += '<svg viewBox="0 0 300 80" style="width:100%;height:80px"><polyline points="' + pts + '" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    h += '<div class="row" style="margin-top:6px"><input class="input grow" data-in="weight" inputmode="decimal" placeholder="今日体重 kg">' +
      '<button class="btn" data-act="addw">记录</button></div>';
    ws2.slice(-6).reverse().forEach((w, i) => {
      h += '<div class="list-item"><div class="li-main"><div class="li-t">' + w.kg + ' kg</div><div class="li-s">' + w.date + '</div></div>' +
        '<button class="x-btn" data-act="delw" data-id="' + (ws2.length - 1 - i) + '">✕</button></div>';
    });
    h += '</div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>饮食拍照记录</div>' +
      '<button class="btn sm" data-act="shot" data-tag="饮食">拍照</button></div>';
    const mp = S.photos.filter(p => p.tag === '饮食').slice(-9).reverse();
    h += mp.length ? '<div class="shots">' + mp.map(p => shotHTML(p)).join('') + '</div>'
      : '<div class="empty">吃饭前拍一张，一个月后你会感谢自己</div>';
    h += '</div>';

    const cnt = (S.sport.logs || []).filter(l => ym(l.date) === ym(TODAY)).length;
    h += '<div class="card"><div class="row between"><div><div class="sub">本月训练</div>' +
      '<div style="font-size:20px;font-weight:700">' + cnt + ' 次</div></div>' +
      '<div style="text-align:right"><div class="sub">今日</div><div style="font-size:20px;font-weight:700">' + logs.length + ' 次</div></div></div></div>';
    return h;
  }

  /* ---- 财务 ---- */
  function vFinance() {
    const today = S.finance.filter(f => f.date === TODAY);
    const inn = today.filter(f => f.type === 'in').reduce((a, b) => a + b.amount, 0);
    const out = today.filter(f => f.type === 'out').reduce((a, b) => a + b.amount, 0);
    const inDone = !!((S.checkins[TODAY] || {}).finance);
    let h = pageHead('finance', '记账 · 月度结余');
    h += '<div class="card"><div class="row between">' +
      '<div><div class="sub">今日收益</div><div style="font-size:20px;font-weight:700;color:var(--ok)">+￥' + money(inn) + '</div></div>' +
      '<div style="text-align:right"><div class="sub">今日支出</div><div style="font-size:20px;font-weight:700;color:var(--danger)">-￥' + money(out) + '</div></div></div>' +
      '<div class="hr"></div>' +
      '<div class="row between"><span class="sub">今日结余</span><b style="font-size:17px">￥' + money(inn - out) + '</b></div></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>记一笔</div>' +
      (inDone ? '<span class="chip ok">今日已打卡</span>' : '<button class="btn sm" data-act="ci" data-id="finance">打卡</button>') + '</div>' +
      '<div class="row" style="margin-bottom:8px"><button class="btn sm grow" id="ft-in" data-act="ftype" data-id="in">收益</button>' +
      '<button class="btn sm grow line" id="ft-out" data-act="ftype" data-id="out">支出</button></div>' +
      '<div class="row"><input class="input" style="max-width:34%" data-in="fin-amount" inputmode="decimal" placeholder="金额">' +
      '<input class="input grow" data-in="fin-note" placeholder="备注，如「午饭」">' +
      '<button class="btn" data-act="addfin">记账</button></div></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>今日明细</div></div>';
    if (!today.length) h += '<div class="empty">今天还没记账</div>';
    today.forEach(f => {
      h += '<div class="list-item"><span class="chip ' + (f.type === 'in' ? 'ok' : '') + '">' + (f.type === 'in' ? '收' : '支') + '</span>' +
        '<div class="li-main"><div class="li-t">' + esc(f.note || '未备注') + '</div><div class="li-s">' + f.time + '</div></div>' +
        '<b style="color:' + (f.type === 'in' ? 'var(--ok)' : 'var(--danger)') + '">' + (f.type === 'in' ? '+' : '-') + money(f.amount) + '</b>' +
        '<button class="x-btn" data-act="delfin" data-id="' + f.id + '">✕</button></div>';
    });
    h += '</div>';

    const months = Array.from(new Set(S.finance.map(f => ym(f.date)))).sort().reverse();
    const cur = ym(TODAY);
    if (months.indexOf(cur) < 0) months.unshift(cur);
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>月度结余</div></div>';
    months.slice(0, 12).forEach(m => {
      const s = monthStats(m);
      h += '<div class="list-item"><div class="li-main"><div class="li-t">' + m + (m === cur ? ' <span class="chip">本月</span>' : '') + '</div>' +
        '<div class="li-s">收 ' + money(s.inn) + ' · 支 ' + money(s.out) + ' · 打卡 ' + s.days + ' 天</div></div>' +
        '<b style="color:' + (s.balance >= 0 ? 'var(--ok)' : 'var(--danger)') + '">￥' + money(s.balance) + '</b></div>';
    });
    h += '</div>';
    return h;
  }

  /* ---- 自媒体 ---- */
  function vMedia() {
    const cat = S.settings.accountType || '生活记录';
    const pool = D.MEDIA_LIB[cat] || D.MEDIA_LIB['生活记录'];
    const di = dayIndex();
    const picks = [0, 1, 2].map(i => pool[(di + i) % pool.length]);
    const hh = new Date().getHours();
    let h = pageHead('media', '账号赛道：' + cat);
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>今日爆款选题</div>' +
      '<span class="chip ' + (hh >= 7 ? 'ok' : 'gray') + '">' + (hh >= 7 ? '今日 07:00 已更新' : '07:00 后更新') + '</span></div>';
    picks.forEach((p, i) => {
      h += '<div class="meal"><div class="meal-h"><div class="meal-t">' + (i + 1) + '. ' + esc(p.t) + '</div>' +
        '<span class="chip">' + p.tags.map(esc).join(' · ') + '</span></div>' +
        '<div class="tipbox good" style="margin-top:8px"><b>🎣 爆款开头</b>' + esc(p.hook) + '</div>' +
        '<div class="tipbox" style="background:#f6fafe;border:1px solid var(--line);margin-top:8px"><b>✍️ 拍摄 / 文案建议</b>' + esc(p.copy) + '</div>' +
        '<div class="row wrap" style="margin-top:10px"><button class="btn sm line" data-act="jump" data-id="抖音" data-kw="' + esc(p.t) + '">抖音看同类</button>' +
        '<button class="btn sm line" data-act="jump" data-id="小红书" data-kw="' + esc(p.t) + '">小红书</button>' +
        '<button class="btn sm line" data-act="jump" data-id="哔哩哔哩" data-kw="' + esc(p.t) + '">B 站</button>' +
        '<button class="btn sm line" data-act="jump" data-id="快手" data-kw="' + esc(p.t) + '">快手</button></div></div>';
    });
    h += '</div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>我的选题库</div>' +
      '<span class="sub">' + S.media.topics.length + ' 条</span></div>';
    if (!S.media.topics.length) h += '<div class="empty">刷到好的选题随手存进来</div>';
    S.media.topics.slice().reverse().forEach(t => {
      h += '<div class="list-item"><span class="chip gray">' + esc(t.date) + '</span>' +
        '<div class="li-main"><div class="li-t">' + esc(t.text) + '</div></div>' +
        '<button class="x-btn" data-act="delmt" data-id="' + t.id + '">✕</button></div>';
    });
    h += '<div class="row" style="margin-top:10px"><input class="input grow" data-in="mtopic" placeholder="记录一个选题…">' +
      '<button class="btn" data-act="addmt">存</button></div></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>其他赛道看看</div></div>' +
      '<div class="row wrap">' + D.CATEGORIES.map(c =>
        '<button class="btn sm ' + (c === cat ? '' : 'line') + '" data-act="cat" data-id="' + esc(c) + '">' + esc(c) + '</button>').join('') +
      '</div><div class="sub" style="margin-top:8px">切换赛道后，每日选题会换成对应领域；也可在设置里自定义。</div></div>';
    return h;
  }

  /* ---- 拍照 ---- */
  function shotHTML(p) {
    return '<div class="shot"><img src="' + p.data + '" alt=""><div class="cap">' + esc(p.date.slice(5)) + (p.note ? ' ' + esc(p.note) : '') + '</div>' +
      '<button class="del" data-act="delph" data-id="' + p.id + '">✕</button></div>';
  }
  function vPhoto() {
    const today = S.photos.filter(p => p.date === TODAY);
    let h = pageHead('photo', '共 ' + S.photos.length + ' 张素材');
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>拍照打卡</div>' + checkinBtn('photo') + '</div>' +
      '<div class="row"><button class="btn grow" data-act="shot" data-tag="打卡">📷 拍照打卡</button>' +
      '<button class="btn grow line" data-act="shot" data-tag="素材">🛍 买到新东西</button></div>' +
      '<div class="sub" style="margin-top:8px">今日已拍 ' + today.length + ' 张。图片会自动压缩后存在本机，不会上传。</div></div>';

    ['打卡', '素材', '饮食'].forEach(tag => {
      const arr = S.photos.filter(p => p.tag === tag).slice(-12).reverse();
      if (!arr.length) return;
      h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>' +
        (tag === '打卡' ? '打卡记录' : tag === '素材' ? '素材库 · 买到的宝贝' : '饮食记录') + '</div>' +
        '<span class="sub">' + S.photos.filter(p => p.tag === tag).length + ' 张</span></div>' +
        '<div class="shots">' + arr.map(shotHTML).join('') + '</div></div>';
    });
    if (!S.photos.length) h += '<div class="card"><div class="empty">还没有照片，点上面的按钮拍第一张吧</div></div>';
    return h;
  }

  /* ---- 购物 ---- */
  function vShop() {
    const open = S.wishes.filter(w => !w.done), got = S.wishes.filter(w => w.done);
    const sum = open.reduce((a, b) => a + (b.price || 0), 0);
    let h = pageHead('shop', '想买 ' + open.length + ' 件' + (sum ? ' · 预算 ￥' + money(sum) : ''));
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>想要清单</div></div>';
    if (!open.length) h += '<div class="empty">清单是空的，说明你最近很克制 👏</div>';
    open.forEach(w => {
      h += '<div class="list-item"><button class="tick" data-act="wtg" data-id="' + w.id + '"></button>' +
        '<div class="li-main"><div class="li-t">' + esc(w.text) + '</div>' +
        '<div class="li-s">' + (w.price ? '￥' + money(w.price) + ' · ' : '') + '加入于 ' + w.date + '</div></div>' +
        '<button class="x-btn" data-act="delwish" data-id="' + w.id + '">✕</button></div>';
    });
    h += '<div class="row" style="margin-top:12px"><input class="input grow" data-in="wish" placeholder="想买什么…">' +
      '<input class="input" style="max-width:30%" data-in="wish-price" inputmode="decimal" placeholder="价格">' +
      '<button class="btn" data-act="addwish">加</button></div>' +
      '<div class="sub" style="margin-top:8px">小技巧：放 72 小时再决定，还在想说明是真需要。</div></div>';
    if (got.length) {
      h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>已买到</div>' +
        '<span class="sub">' + got.length + ' 件</span></div>';
      got.slice(-10).reverse().forEach(w => {
        h += '<div class="list-item"><button class="tick on" data-act="wtg" data-id="' + w.id + '">✓</button>' +
          '<div class="li-main"><div class="li-t done-text">' + esc(w.text) + '</div><div class="li-s">' + w.date + '</div></div>' +
          '<button class="x-btn" data-act="delwish" data-id="' + w.id + '">✕</button></div>';
      });
      h += '</div>';
    }
    return h;
  }

  /* ---- 灵感 ---- */
  function adviceFor(text) {
    const rule = D.IDEA_RULES.find(r => r.keys.some(k => text.indexOf(k) > -1));
    if (rule) return rule;
    return {
      advice: '这条灵感已经记下来了。想让它变成内容，可以问自己三个问题：① 谁会在意？② 他能学到什么？③ 开头第一句说什么？把答案补在你的灵感下面，就是一个脚本了。',
      videos: [{ t: '自媒体新手入门', p: '哔哩哔哩', kw: '自媒体 新手 起号' }, { t: '短视频文案写法', p: '小红书', kw: '短视频 文案 开头' }]
    };
  }
  function vIdea() {
    let h = pageHead('idea', '共 ' + S.ideas.length + ' 条灵感');
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>记一条灵感</div>' +
      (S.ideas.filter(i => i.date === TODAY).length ? '<span class="chip ok">今日 ' + S.ideas.filter(i => i.date === TODAY).length + ' 条</span>' : '') + '</div>' +
      '<textarea class="input" data-in="idea" placeholder="想到什么就写什么，不用管通顺…"></textarea>' +
      '<button class="btn wide" style="margin-top:10px" data-act="addidea">保存并给我建议</button></div>';

    S.ideas.slice().reverse().slice(0, 20).forEach(it => {
      h += '<div class="card"><div class="row between"><span class="chip gray">' + it.date + '</span>' +
        '<button class="x-btn" data-act="delidea" data-id="' + it.id + '">✕</button></div>' +
        '<div style="font-size:14px;line-height:1.8;margin:8px 0">' + esc(it.text) + '</div>';
      const a = adviceFor(it.text);
      h += '<div class="tipbox good"><b>💡 给你的建议</b>' + esc(a.advice) + '</div>';
      h += '<div class="row wrap" style="margin-top:10px">' + a.videos.map(v =>
        '<button class="btn sm line" data-act="jump" data-id="' + esc(v.p) + '" data-kw="' + esc(v.kw) + '">▶ ' + esc(v.t) + '</button>').join('') + '</div>';
      h += '</div>';
    });
    if (!S.ideas.length) h += '<div class="card"><div class="empty">灵感不用宏大，一句话就够</div></div>';
    return h;
  }

  /* ---- 总结 ---- */
  function vSummary() {
    const m = ym(TODAY);
    const ms = monthStats(m);
    const ws = S.sport.weights || [];
    const mw = ws.filter(w => ym(w.date) === m);
    const di = S.summary.daily[TODAY] || '';
    const mo = S.summary.monthly[m] || '';
    let h = pageHead('summary', '每日 / 每月');
    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>' + TODAY + ' 日报</div>' +
      '<span class="chip ' + (dayDone(TODAY) ? 'ok' : 'gray') + '">' + (dayDone(TODAY) ? '已打卡' : '未打卡') + '</span></div>' +
      '<div class="grid2" style="margin-bottom:10px">' +
      statCard('待办', S.todo.items.filter(i => i.done).length + '/' + S.todo.items.length) +
      statCard('训练', ((S.sport.logs || []).filter(l => l.date === TODAY).length) + ' 次') +
      statCard('记账', money(S.finance.filter(f => f.date === TODAY && f.type === 'out').reduce((a, b) => a + b.amount, 0)) + ' 支出') +
      statCard('记录', S.photos.filter(p => p.date === TODAY).length + ' 张图') +
      '</div>' +
      '<textarea class="input" data-in="dsum" placeholder="今天过得怎么样？写两句…">' + esc(di) + '</textarea>' +
      '<button class="btn wide" style="margin-top:10px" data-act="saveday">保存今日总结</button></div>';

    h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>' + m + ' 月报</div>' +
      '<span class="chip">打卡 ' + ms.days + ' 天</span></div>' +
      '<div class="grid2" style="margin-bottom:10px">' +
      statCard('收入', '￥' + money(ms.inn)) +
      statCard('支出', '￥' + money(ms.out)) +
      statCard('结余', '￥' + money(ms.balance)) +
      statCard('体重', mw.length >= 2 ? money(mw[mw.length - 1].kg - mw[0].kg) + ' kg' : '—') +
      statCard('训练', (S.sport.logs || []).filter(l => ym(l.date) === m).length + ' 次') +
      statCard('灵感', S.ideas.filter(i => ym(i.date) === m).length + ' 条') +
      '</div>' +
      '<textarea class="input" data-in="msum" placeholder="这个月的收获和教训…">' + esc(mo) + '</textarea>' +
      '<button class="btn wide" style="margin-top:10px" data-act="savemonth">保存本月总结</button></div>';

    const past = Object.keys(S.summary.monthly).sort().reverse();
    if (past.length) {
      h += '<div class="card"><div class="card-h"><div class="card-t"><i class="dot"></i>往月总结</div></div>';
      past.forEach(k => h += '<div class="list-item"><div class="li-main"><div class="li-t">' + k + '</div>' +
        '<div class="li-s">' + esc(S.summary.monthly[k].slice(0, 40)) + '…</div></div></div>');
      h += '</div>';
    }
    return h;
  }
  function statCard(t, v) {
    return '<div class="mod-card"><div class="mc-s">' + esc(t) + '</div><div class="mc-n" style="font-size:16px">' + esc(v) + '</div></div>';
  }

  /* ---- 自定义入口 ---- */
  function vCustom(id) {
    const m = S.sidebar.find(x => x.id === id);
    const txt = (S.custom && S.custom[id] && S.custom[id].text) || '';
    return pageHead(id, '自定义入口') +
      '<div class="card"><textarea class="input" style="min-height:300px" data-in="custom" data-cid="' + id + '" placeholder="随便写点什么…">' + esc(txt) + '</textarea>' +
      '<button class="btn wide" style="margin-top:10px" data-act="savecustom" data-id="' + id + '">保存</button></div>';
  }

  const VIEWS = { home: vHome, todo: vTodo, diet: vDiet, sport: vSport, finance: vFinance, media: vMedia, photo: vPhoto, shop: vShop, idea: vIdea, summary: vSummary };
  function render() {
    rollDay();
    const v = VIEWS[page] || vCustom;
    $('#view').innerHTML = v(page);
    renderSide(); renderTop();
    if (page === 'finance') finType = finType || 'in';
    syncFinType();
  }
  function go(id) {
    if (!S.sidebar.some(m => m.id === id && m.on)) id = 'home';
    page = id; window.scrollTo(0, 0); render();
  }

  /* ============ 财务收/支切换 ============ */
  let finType = 'in';
  function syncFinType() {
    const a = $('#ft-in'), b = $('#ft-out'); if (!a || !b) return;
    a.className = 'btn sm grow' + (finType === 'in' ? '' : ' line');
    b.className = 'btn sm grow' + (finType === 'out' ? '' : ' line');
  }

  /* ============ 照片 ============ */
  let shotTag = '打卡';
  function shrink(file, max, q) {
    return new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const s = Math.min(1, (max || 720) / Math.max(w, h));
          const c = document.createElement('canvas');
          c.width = Math.round(w * s); c.height = Math.round(h * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q || 0.72));
        };
        img.onerror = () => res(null);
        img.src = fr.result;
      };
      fr.onerror = () => res(null);
      fr.readAsDataURL(file);
    });
  }
  async function onShotPick(e) {
    const files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    for (const f of files) {
      const data = await shrink(f);
      if (!data) continue;
      S.photos.push({ id: uid(), date: TODAY, tag: shotTag, note: '', data: data });
    }
    if (S.photos.length > 400) S.photos.splice(0, S.photos.length - 400);
    ci(TODAY)[shotTag === '饮食' ? 'sport' : 'photo'] = true;
    autoDay(); save(); render();
    toast('已保存 ' + files.length + ' 张');
  }

  /* ============ 设置面板 ============ */
  let stTab = 'base';
  function openSheet() { renderSheet(); $('#sheet').classList.add('on'); $('#sheet-mask').classList.add('on'); }
  function closeSheet() { $('#sheet').classList.remove('on'); $('#sheet-mask').classList.remove('on'); }
  function renderSheet() {
    const st = S.settings;
    let h = '<div class="sheet-h"><h2>设置</h2><button class="x-btn" data-act="closesheet">✕</button></div>' +
      '<div class="sheet-tabs">' +
      ['base|基础设置', 'look|个性化', 'data|数据'].map(x => { const [k, n] = x.split('|'); return '<button class="' + (stTab === k ? 'on' : '') + '" data-act="tab" data-id="' + k + '">' + n + '</button>'; }).join('') +
      '</div><div class="sheet-body">';

    if (stTab === 'base') {
      h += '<div class="field"><label>昵称</label><input class="input" data-bind="nickname" value="' + esc(st.nickname) + '"></div>' +
        '<div class="field"><label>自媒体赛道（决定每日选题推荐）</label><input class="input" data-bind="accountType" value="' + esc(st.accountType) + '" list="catlist">' +
        '<datalist id="catlist">' + D.CATEGORIES.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>' +
        '<div class="row wrap" style="margin-top:8px">' + D.CATEGORIES.map(c => '<button class="btn sm line" data-act="cat" data-id="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div></div>' +
        '<div class="field"><label>潼潼宝贝生日</label><input class="input" type="date" data-bind="birthday" value="' + esc(st.birthday) + '"></div>' +
        '<div class="field"><label>左侧任务栏（可改名 / 隐藏 / 排序 / 新增）</label>';
      S.sidebar.forEach((m, i) => {
        h += '<div class="side-row"><span class="ic">' + esc(m.icon) + '</span>' +
          '<span class="nm">' + esc(m.name) + '</span>' +
          (m.id === 'home' ? '<span class="sub">固定</span>' : '<div class="switch' + (m.on ? ' on' : '') + '" data-act="mtoggle" data-id="' + m.id + '"></div>') +
          '<button class="mini" data-act="mup" data-id="' + m.id + '">↑</button>' +
          '<button class="mini" data-act="mdown" data-id="' + m.id + '">↓</button>' +
          '<button class="mini" data-act="mren" data-id="' + m.id + '">✎</button>' +
          (m.custom ? '<button class="mini" data-act="mdel" data-id="' + m.id + '">✕</button>' : '') + '</div>';
      });
      h += '<button class="btn line wide" style="margin-top:10px" data-act="madd">＋ 新增自定义入口</button></div>';
    } else if (stTab === 'look') {
      h += '<div class="field"><label>主题色</label><div class="swatches">' +
        THEMES.map(t => '<button class="sw' + (!st.color && st.theme === t.k ? ' on' : '') + '" data-act="theme" data-id="' + t.k + '" title="' + t.n + '" style="background:linear-gradient(135deg,' + t.a + ',' + t.b + ')"></button>').join('') +
        '</div></div>' +
        '<div class="field"><label>自定义颜色</label><div class="row">' +
        '<input type="color" class="input" style="height:42px;padding:4px" data-bind="color" value="' + (st.color || '#3d9be9') + '">' +
        '<input type="color" class="input" style="height:42px;padding:4px" data-bind="color2" value="' + (st.color2 || '#7cc8f7') + '">' +
        '<button class="btn line" data-act="theme" data-id="reset">恢复默认</button></div>' +
        '<div class="sub" style="margin-top:6px">左边是主色，右边是渐变辅色</div></div>' +
        '<div class="field"><label>字体</label><select class="input" data-bind="font">' +
        [['system', '系统默认'], ['round', '圆润无衬线'], ['song', '宋体'], ['kai', '楷体']].map(f =>
          '<option value="' + f[0] + '"' + (st.font === f[0] ? ' selected' : '') + '>' + f[1] + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>字号：' + st.fs + ' px</label><input type="range" min="13" max="19" step="1" style="width:100%" data-bind="fs" value="' + st.fs + '"></div>' +
        '<div class="card" style="margin-top:16px"><div class="sub">预览：今天的任务已经完成一半了，继续保持 🌸</div>' +
        '<button class="btn" style="margin-top:10px">蓝色按钮</button></div>';
    } else {
      h += '<div class="field"><label>数据都保存在这台手机上，换手机请先导出备份</label>' +
        '<button class="btn wide" data-act="export">导出备份（JSON 文件）</button>' +
        '<button class="btn line wide" style="margin-top:8px" data-act="import">从备份导入</button>' +
        '<button class="btn line wide" style="margin-top:8px" data-act="install">添加到手机桌面</button>' +
        '<button class="btn danger wide" style="margin-top:8px" data-act="clear">清空全部数据</button></div>' +
        '<div class="card"><div class="sub">' +
        '· 打卡记录 ' + Object.keys(S.checkins).length + ' 天<br>' +
        '· 待办 ' + S.todo.items.length + ' 项 / 历史 ' + Object.keys(S.todo.history).length + ' 天<br>' +
        '· 记账 ' + S.finance.length + ' 笔<br>' +
        '· 照片 ' + S.photos.length + ' 张<br>' +
        '· 灵感 ' + S.ideas.length + ' 条 / 想买 ' + S.wishes.length + ' 件<br>' +
        '· 数据体积约 ' + Math.round(JSON.stringify(S).length / 1024) + ' KB</div></div>' +
        '<div class="sub" style="text-align:center;margin-top:14px">故似的工作台 v1.0</div>';
    }
    h += '</div>';
    $('#sheet').innerHTML = h;
  }

  /* ============ 事件 ============ */
  const findIn = k => document.querySelector('[data-in="' + k + '"]');
  const valOf = k => { const e = findIn(k); return e ? e.value.trim() : ''; };
  const clearIn = k => { const e = findIn(k); if (e) e.value = ''; };

  document.addEventListener('click', async function (e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act, id = t.dataset.id;
    switch (act) {
      case 'nav': go(id); break;
      case 'q': go(id); break;
      case 'ci': {
        const c = ci(TODAY); c[id] = !c[id]; autoDay(); save(); render();
        toast(c[id] ? '已打卡 ✓' : '已取消打卡'); break;
      }
      case 'day': {
        const c = ci(TODAY);
        if (c.day) { delete c.day; } else { c.day = true; }
        save(); render(); toast(c.day ? '今日打卡成功 🌸' : '已取消'); break;
      }
      case 'tg': {
        const it = S.todo.items.find(i => i.id === id);
        if (it) { it.done = !it.done; if (it.done && S.todo.items.every(x => x.done)) ci(TODAY).todo = true; save(); render(); }
        break;
      }
      case 'add': {
        const v = valOf('todo'); if (!v) return toast('先写点什么');
        S.todo.items.push({ id: uid(), text: v, done: false }); clearIn('todo'); save(); render(); break;
      }
      case 'del': S.todo.items = S.todo.items.filter(i => i.id !== id); save(); render(); break;
      case 'addt': {
        const v = valOf('tmr'); if (!v) return toast('先写点什么');
        S.todo.tomorrow.push({ id: uid(), text: v }); clearIn('tmr'); save(); render(); break;
      }
      case 'delt': S.todo.tomorrow = S.todo.tomorrow.filter(i => i.id !== id); save(); render(); break;
      case 'meal': {
        const dm = (S.diet.mealLog = S.diet.mealLog || {}); const arr = (dm[TODAY] = dm[TODAY] || []);
        const i = arr.indexOf(id);
        if (i > -1) arr.splice(i, 1); else arr.push(id);
        if (arr.length >= 3) ci(TODAY).diet = true;
        autoDay(); save(); render(); break;
      }
      case 'wlog': {
        const logs = (S.sport.logs = S.sport.logs || []);
        const i = logs.findIndex(l => l.date === TODAY && l.name === id);
        if (i > -1) logs.splice(i, 1); else { logs.push({ date: TODAY, name: id }); ci(TODAY).sport = true; }
        autoDay(); save(); render(); break;
      }
      case 'addw': {
        const v = parseFloat(valOf('weight'));
        if (!v || v < 20 || v > 300) return toast('请输入有效体重');
        const ws = (S.sport.weights = S.sport.weights || []);
        const i = ws.findIndex(w => w.date === TODAY);
        if (i > -1) ws[i].kg = v; else ws.push({ date: TODAY, kg: v });
        clearIn('weight'); ci(TODAY).sport = true; autoDay(); save(); render(); toast('已记录 ' + v + ' kg'); break;
      }
      case 'delw': S.sport.weights.splice(+id, 1); save(); render(); break;
      case 'keep': case 'jump': {
        const p = D.PLATFORMS[id] || D.PLATFORMS['哔哩哔哩'];
        const kw = t.dataset.kw || '';
        const web = p.web + encodeURIComponent(kw);
        const now = Date.now();
        const timer = setTimeout(() => { if (Date.now() - now < 2200) window.open(web, '_blank'); }, 1400);
        document.addEventListener('visibilitychange', function h() {
          if (document.hidden) { clearTimeout(timer); document.removeEventListener('visibilitychange', h); }
        });
        try { location.href = p.scheme + (p.scheme.indexOf('keep') > -1 ? 'search?keyword=' + encodeURIComponent(kw) : ''); } catch (err) { clearTimeout(timer); window.open(web, '_blank'); }
        break;
      }
      case 'ftype': finType = id; syncFinType(); break;
      case 'addfin': {
        const amt = parseFloat(valOf('fin-amount'));
        if (!amt || amt <= 0) return toast('请输入金额');
        S.finance.push({ id: uid(), date: TODAY, time: new Date().toTimeString().slice(0, 5), type: finType, amount: amt, note: valOf('fin-note') });
        clearIn('fin-amount'); clearIn('fin-note');
        ci(TODAY).finance = true; autoDay(); save(); render(); toast('记账成功'); break;
      }
      case 'delfin': S.finance = S.finance.filter(f => f.id !== id); save(); render(); break;
      case 'cat': S.settings.accountType = id; save(); applyTheme(); renderSheet(); if (page === 'media') render(); break;
      case 'addmt': {
        const v = valOf('mtopic'); if (!v) return;
        S.media.topics.push({ id: uid(), date: TODAY, text: v }); clearIn('mtopic'); save(); render(); break;
      }
      case 'delmt': S.media.topics = S.media.topics.filter(x => x.id !== id); save(); render(); break;
      case 'shot': shotTag = t.dataset.tag || '打卡'; $('#file').click(); break;
      case 'delph': S.photos = S.photos.filter(p => p.id !== id); save(); render(); break;
      case 'wtg': { const w = S.wishes.find(x => x.id === id); if (w) { w.done = !w.done; save(); render(); toast(w.done ? '恭喜买到 🎉' : '已移回想买'); } break; }
      case 'addwish': {
        const v = valOf('wish'); if (!v) return toast('想买什么？');
        const pr = parseFloat(valOf('wish-price')) || 0;
        S.wishes.push({ id: uid(), text: v, price: pr, done: false, date: TODAY });
        clearIn('wish'); clearIn('wish-price'); save(); render(); break;
      }
      case 'delwish': S.wishes = S.wishes.filter(w => w.id !== id); save(); render(); break;
      case 'addidea': {
        const v = valOf('idea'); if (!v) return toast('先写一句');
        S.ideas.push({ id: uid(), date: TODAY, text: v });
        clearIn('idea'); ci(TODAY).idea = true; autoDay(); save(); render(); toast('已保存，建议见下方'); break;
      }
      case 'delidea': S.ideas = S.ideas.filter(x => x.id !== id); save(); render(); break;
      case 'saveday': S.summary.daily[TODAY] = valOf('dsum'); save(); toast('今日总结已保存'); break;
      case 'savemonth': S.summary.monthly[ym(TODAY)] = valOf('msum'); save(); renderSheet(); toast('本月总结已保存'); break;
      case 'bind': save(); render(); toast('已保存'); break;
      case 'savecustom': {
        S.custom = S.custom || {}; S.custom[id] = { text: document.querySelector('[data-cid="' + id + '"]').value };
        save(); toast('已保存'); break;
      }
      case 'openSheet': openSheet(); break;
      case 'closesheet': closeSheet(); break;
      case 'tab': stTab = id; renderSheet(); break;
      case 'theme': {
        if (id === 'reset') { S.settings.theme = 'sky'; S.settings.color = ''; S.settings.color2 = ''; }
        else { S.settings.theme = id; S.settings.color = ''; S.settings.color2 = ''; }
        save(); applyTheme(); renderSheet(); render(); break;
      }
      case 'mtoggle': { const m = S.sidebar.find(x => x.id === id); m.on = !m.on; save(); renderSheet(); render(); break; }
      case 'mup': case 'mdown': {
        const i = S.sidebar.findIndex(x => x.id === id), j = act === 'mup' ? i - 1 : i + 1;
        if (j < 1 || j >= S.sidebar.length) break;
        const tmp = S.sidebar[i]; S.sidebar[i] = S.sidebar[j]; S.sidebar[j] = tmp;
        save(); renderSheet(); render(); break;
      }
      case 'mren': {
        const m = S.sidebar.find(x => x.id === id);
        const v = await modal('修改名称', { value: m.name, ph: '显示名称' });
        if (v) { m.name = v; if (!m.custom || m.label.length <= 4) m.label = v.slice(0, 4); save(); renderSheet(); render(); }
        break;
      }
      case 'mdel': S.sidebar = S.sidebar.filter(x => x.id !== id); save(); renderSheet(); if (page === id) go('home'); else render(); break;
      case 'madd': {
        const v = await modal('新增自定义入口', { ph: '名称，如「日记」' });
        if (!v) break;
        const ic = await modal('选个图标（emoji）', { value: '📌', ph: '粘贴一个 emoji' });
        const cid = 'custom_' + uid();
        S.sidebar.push({ id: cid, icon: ic || '📌', label: v.slice(0, 4), name: v, on: true, custom: true });
        save(); renderSheet(); render(); break;
      }
      case 'export': {
        const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '工作台备份_' + TODAY + '.json';
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('已导出'); break;
      }
      case 'import': $('#imp').click(); break;
      case 'clear': {
        const ok = await modal('确定清空全部数据？', { html: '<div class="sub" style="line-height:1.8">所有打卡、记账、照片、灵感都会被删除，且无法恢复。建议先导出备份。</div>', ok: '确定清空' });
        if (ok === null) break;
        localStorage.removeItem(KEY); S = JSON.parse(JSON.stringify(DEFAULT));
        applyTheme(); closeSheet(); go('home'); toast('已清空'); break;
      }
      case 'install': {
        if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
        else toast('iPhone：Safari 分享 → 添加到主屏幕');
        break;
      }
    }
  });

  /* 设置项绑定 */
  document.addEventListener('input', function (e) {
    const b = e.target.dataset.bind; if (!b) return;
    const v = e.target.value;
    if (b === 'fs') S.settings.fs = +v; else S.settings[b] = v;
    save(); applyTheme();
    const lbl = e.target.previousElementSibling;
    if (b === 'fs' && lbl) lbl.textContent = '字号：' + v + ' px';
  });
  document.addEventListener('change', function (e) {
    const b = e.target.dataset.bind;
    if (b === 'font' || b === 'color' || b === 'color2' || b === 'birthday' || b === 'nickname' || b === 'accountType') {
      S.settings[b] = e.target.value; save(); applyTheme();
      if (b === 'birthday' || b === 'font' || b === 'nickname' || b === 'accountType') { renderSheet(); render(); }
    }
  });

  /* 文件选择：照片 / 导入备份 */
  function bindFiles() {
    $('#file').addEventListener('change', onShotPick);
    $('#imp').addEventListener('change', function (e) {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const d = JSON.parse(fr.result);
          if (!d || typeof d !== 'object') throw 0;
          S = d; normalize(); save(); applyTheme(); closeSheet(); go('home'); toast('导入成功');
        } catch (err) { toast('文件格式不对'); }
      };
      fr.readAsText(f);
    });
  }

  /* ============ 开屏 ============ */
  function splash() {
    const di = dayIndex(), n = new Date();
    $('#sp-flower').textContent = ['🌸', '🌷', '🌼', '🌺', '💮'][di % 5];
    $('#sp-date').textContent = n.getFullYear() + ' 年 ' + (n.getMonth() + 1) + ' 月 ' + n.getDate() + ' 日 · 周' + WEEK[n.getDay()];
    $('#sp-word').textContent = D.ENCOURAGE[di % D.ENCOURAGE.length];
    $('#sp-name').textContent = '嗨，' + (S.settings.nickname || '故似');
    $('#splash-btn').onclick = function () {
      $('#splash').classList.add('hide');
      setTimeout(() => { const s = $('#splash'); if (s) s.style.display = 'none'; }, 520);
    };
  }

  /* ============ 安装提示 ============ */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });

  /* ============ 启动 ============ */
  function boot() {
    load(); applyTheme(); rollDay();
    page = 'home';
    render(); splash(); bindFiles();
    setInterval(() => { if (rollDay()) { render(); toast('新的一天，明日计划已转为今日待办'); } }, 30000);
    window.addEventListener('focus', () => { if (rollDay()) render(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && rollDay()) render(); });
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
