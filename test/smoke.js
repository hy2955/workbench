/* 冒烟测试：用假 DOM 把工作台真跑起来，把每个页面都渲染一遍，看会不会炸。运行：node test/smoke.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, '..');

function el(id) {
  const e = {
    id, textContent: '', value: '', _html: '', style: {}, dataset: {}, onclick: null,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } },
    querySelectorAll: () => [], querySelector: () => null,
    addEventListener: () => {}, removeEventListener: () => {}, focus: () => {}, click: () => {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, appendChild() {}, remove() {},
    closest: () => null
  };
  Object.defineProperty(e, 'innerHTML', { get() { return e._html; }, set(v) { e._html = String(v); } });
  return e;
}
const els = {};
const store = {};
const listeners = {};
const sandbox = {
  console,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  location: { protocol: 'file:', href: '', origin: 'null' },
  navigator: {},
  setTimeout: (fn) => { try { fn(); } catch (e) {} return 0; },
  clearTimeout: () => {},
  setInterval: () => 0,
  URL, Blob: class {}, FileReader: class {},
  alert: () => {}
};
sandbox.window = sandbox;
sandbox.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
sandbox.removeEventListener = () => {};
sandbox.scrollTo = () => {};
sandbox.document = {
  readyState: 'complete',
  getElementById: id => (els[id] = els[id] || el(id)),
  querySelector: s => (els[s] = els[s] || el(s)),
  querySelectorAll: () => [],
  createElement: () => el('tmp'),
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener: () => {},
  hidden: false,
  documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {} },
  body: { style: {}, classList: { add() {}, remove() {} }, appendChild() {} }
};
sandbox.self = sandbox;

const ctx = vm.createContext(sandbox);
for (const f of ['assets/data.js', 'assets/app.js']) {
  vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f });
}

let fails = 0;
// 顺序执行：这些用例共用一份 store/els，并发跑会互相踩
const queue = [];
const check = (name, fn) => queue.push([name, fn]);
const drain = async () => {
  for (const [name, fn] of queue.splice(0)) {
    try { await fn(); console.log('  ok   ' + name); }
    catch (e) { fails++; console.log('  FAIL ' + name + ' :: ' + e.message); }
  }
};

// 模拟点击：把 data-act 直接伪造出来
const click = async (act, extra) => {
  const t = { dataset: Object.assign({ act }, extra || {}), closest: () => t, isConnected: true };
  for (const fn of listeners.click || []) await fn({ target: t, preventDefault() {} });
};

(async () => {
  console.log('boot + 各页面渲染');
  const pages = ['home', 'todo', 'diet', 'sport', 'finance', 'media', 'photo', 'shop', 'idea', 'summary'];
  for (const p of pages) check('页面 ' + p, async () => {
    await click('nav', { id: p });
    const h = els['#view']._html;
    if (!h || h.length < 200) throw new Error('渲染结果为空');
    const bad = h.match(/undefined|NaN|\[object Object\]/);
    if (bad) throw new Error('渲染里漏出了 ' + bad[0] + '：' + h.slice(Math.max(0, bad.index - 60), bad.index + 40));
  });

  console.log('\n交互');
  check('今日打卡', () => click('day'));
  check('模块打卡', () => click('ci', { id: 'sport' }));
  check('设置抽屉', () => click('openSheet'));
  check('新增自定义入口渲染', () => click('nav', { id: 'home' }));

  await drain();
  console.log('\n状态与迁移');
  const raw = store['wb_state_v1'];
  check('状态已写入 localStorage', () => { if (!raw) throw new Error('没有写入'); });
  check('状态是合法 JSON 且有 checkins', () => {
    const s = JSON.parse(raw);
    if (!s.checkins || !Array.isArray(s.sidebar)) throw new Error('结构不对');
  });

  // 脏数据：账目缺 date（之前会让首页渲染崩掉 → 开屏卡死）
  console.log('\n脏数据 + 空间不足');
  const dirty = JSON.parse(raw);
  dirty.finance = [{ amount: 20, type: 'out' }, { date: '不是日期', amount: '5', type: 'x' }, null, 'garbage'];
  store['wb_state_v1'] = JSON.stringify(dirty);
  check('脏账目数据能正常启动', () => {
    const s2 = vm.createContext(Object.assign({}, sandbox, {}));
    for (const f of ['assets/data.js', 'assets/app.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), s2, { filename: f });
  });

  // 空间不足：setItem 前 N 次抛 QuotaExceededError
  let calls = 0;
  const boom = JSON.parse(raw);
  boom.photos = Array.from({ length: 60 }, (_, i) => ({ id: 'p' + i, date: '2026-09-01', tag: '打卡', data: 'x'.repeat(500) }));
  store['wb_state_v1'] = JSON.stringify(boom);
  const s3 = vm.createContext(Object.assign({}, sandbox, {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { calls++; if (calls <= 2) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  }));
  check('空间不足时能自愈（瘦身重试)', async () => {
    for (const f of ['assets/data.js', 'assets/app.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), s3, { filename: f });
    await click('day');   // 触发一次写入，前两次 setItem 会抛 QuotaExceeded
    const saved = JSON.parse(store['wb_state_v1']);
    if (saved.photos.length >= 60) throw new Error('照片没被清理，还剩 ' + saved.photos.length);
    if (!saved.checkins) throw new Error('状态被写坏了');
  });

  // 不到 6 月龄的宝宝：以前会 fallback 到最后一段（3 岁以上同餐），是错的
  console.log('\n潼潼宝贝篇月龄分档');
  const baby = JSON.parse(raw);
  const d4 = new Date(Date.now() - 120 * 86400000);
  baby.settings.birthday = d4.toISOString().slice(0, 10);
  store['wb_state_v1'] = JSON.stringify(baby);
  check('4 月龄落到 0-5 月纯奶期', async () => {
    const s4 = vm.createContext(Object.assign({}, sandbox, {}));
    for (const f of ['assets/data.js', 'assets/app.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), s4, { filename: f });
    await click('nav', { id: 'diet' });
    const h = els['#view']._html;
    if (!h.includes('0-5 月')) { const i = h.indexOf('潼潼宝贝篇'); throw new Error('没有显示 0-5 月阶段；该段渲染为：' + h.slice(i, i + 900)); }
    if (h.includes('3 岁以上')) throw new Error('串到了 3 岁以上的餐食');
  });

  await drain();
  // 各月龄该落到哪一段（把整个分档表钉住）
  // 分界点：6 / 9 / 12（满 1 岁）/ 24 / 36 个月
  const bands = [[1, '0-5 月'], [5, '0-5 月'], [6, '6-8 月'], [8, '6-8 月'], [9, '9-12 月'], [11, '9-12 月'],
                 [12, '1-2 岁'], [23, '1-2 岁'], [24, '2-3 岁'], [35, '2-3 岁'], [36, '3 岁以上'], [60, '3 岁以上']];
  for (const [mo, want] of bands) {
    try { await (async () => {
      const b = JSON.parse(raw);
      const d = new Date();
      d.setMonth(d.getMonth() - mo);
      d.setDate(d.getDate() - 2);   // 躲开「日期不够就减一个月」的边界
      b.settings.birthday = d.toISOString().slice(0, 10);
      store['wb_state_v1'] = JSON.stringify(b);
      const sc = vm.createContext(Object.assign({}, sandbox, {}));
      for (const f of ['assets/data.js', 'assets/app.js']) vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), sc, { filename: f });
      await click('nav', { id: 'diet' });
      const h = els['#view']._html;
      const want2 = want.replace(' ', '');
      if (!h.replace(/ /g, '').includes(want2)) {
        const m = h.match(/月龄<\/div><div[^>]*>(\d+) 个月/);
        throw new Error('实际月龄 ' + (m ? m[1] : '?') + '，没落到 ' + want);
      }
      })(); console.log('  ok   ' + mo + ' 月龄 → ' + want); }
    catch (e) { fails++; console.log('  FAIL ' + mo + ' 月龄 → ' + want + ' :: ' + e.message); }
  }

  await drain();
  console.log(fails ? '\n失败 ' + fails + ' 项' : '\n全部通过');
  process.exit(fails ? 1 : 0);
})();
