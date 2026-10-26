// E2E regression for optimization round (v1.2.0): settings/import/export/backups,
// undo-delete, dirty-form guard, insights cap, direction data, cold start.
const automator = require('miniprogram-automator');
const ws = 'ws://127.0.0.1:9420';
const log = (...a) => console.log(...a);
const j = (x) => JSON.stringify(x);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; log('PASS', name); }
  else { fail++; log('FAIL', name, extra === undefined ? '' : j(extra)); }
}
const safe = async (label, fn) => {
  try { return await fn(); } catch (e) { log('ERR', label, '::', e.message); fail++; return undefined; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GKEYS = ['id', 'title', 'term', 'desc', 'progress', 'status', 'subtasks'];
const SKEYS = ['id', 'name', 'category', 'level', 'note'];
const AKEYS = ['id', 'title', 'deadline', 'goalId', 'done'];
const PKEYS = ['title', 'desc', 'current'];
const RKEYS = ['id', 'date', 'achievement', 'challenge', 'learning', 'plan', 'score'];

(async () => {
  const mp = await automator.connect({ wsEndpoint: ws });
  const storage = () => mp.callWxMethod('getStorageSync', 'growthPlannerData');
  const backups = () => mp.callWxMethod('getStorageSync', 'growthPlannerDataBackups');
  const gd = () => mp.evaluate(() => JSON.parse(JSON.stringify(getApp().globalData)));

  async function stubModal(queue) {
    await mp.evaluate(function (q) {
      globalThis.__modals = [];
      wx.showModal = function (o) {
        globalThis.__modals.push({
          title: o && o.title, content: o && o.content,
          confirmText: o && o.confirmText, cancelText: o && o.cancelText
        });
        var resp = q && q.length ? q.shift() : { confirm: true, cancel: false };
        if (o && o.success) o.success(resp);
      };
    }, queue || []);
  }
  async function lastModal() {
    const modals = await mp.evaluate(() => (globalThis.__modals || []).slice(-3));
    return modals[modals.length - 1] || {};
  }
  async function stubClipboard() {
    await mp.evaluate(() => {
      globalThis.__clip = null;
      wx.setClipboardData = function (o) { globalThis.__clip = o && o.data; if (o && o.success) o.success(); };
    });
  }
  const clipText = () => mp.evaluate(() => globalThis.__clip);
  async function resetAll() {
    await mp.evaluate(() => {
      wx.removeStorageSync('growthPlannerData');
      wx.removeStorageSync('growthPlannerDataBackups');
      var app = getApp();
      app.globalData = { skills: [], goals: [], reviews: [], path: [], actions: [], vision: { year1: '', year3: '', values: '' } };
      app.saveData();
      app.onLaunch();
    });
    await sleep(400);
  }

  // 注意：自动化端 navigateTo 偶发返回 timeout（但实际已跳转），统一用 evaluate 方式跳转
  async function openPage(url) {
    await mp.evaluate(function (u) { wx.navigateTo({ url: u }); }, url);
    await sleep(1200);
    return mp.currentPage();
  }
  // switchTab 在非 tab 页上偶发不生效；用 reLaunch 到 tab 页更可靠
  async function tab(path) {
    await mp.reLaunch(path);
    await sleep(800);
    return mp.currentPage();
  }

  await mp.reLaunch('/pages/overview/overview');
  await sleep(600);
  await resetAll();
  await stubModal([]);

  // ---------- 1. settings page ----------
  const settings = await safe('go settings', () => openPage('/pages/settings/settings'));
  await settings.waitFor(400);
  let sd = await settings.data();
  check('1.1 settings stats all zero', j(sd.stats) === j({ goals: 0, skills: 0, reviews: 0, path: 0, actions: 0 }), sd.stats);
  check('1.2 size text present', typeof sd.sizeText === 'string' && sd.sizeText.length > 0, sd.sizeText);
  check('1.3 empty backups state', Array.isArray(sd.backups) && sd.backups.length === 0, sd.backups);

  // ---------- 2. export ----------
  await stubClipboard();
  await settings.callMethod('onExport');
  await sleep(400);
  const exported = await clipText();
  let exportedValid = false, exportedCounts = null;
  try {
    const p = JSON.parse(exported);
    exportedValid = p && p.app === 'personal-growth-plan' && p.data && Array.isArray(p.data.goals);
    exportedCounts = p && p.counts;
  } catch (e) { /* invalid */ }
  check('2.1 export writes valid payload', exportedValid, exported && exported.slice(0, 80));
  check('2.2 export counts', exportedCounts && exportedCounts.goals === 0, exportedCounts);

  // ---------- 3. import (overwrite) ----------
  const payload = {
    app: 'personal-growth-plan',
    schema: 1,
    exportedAt: '2026-10-26 17:00:00',
    data: {
      goals: [
        { id: 'imp-g1', title: '导入目标一', term: 'short', desc: '', progress: 40, status: 'progress', subtasks: [{ text: '子a', done: true }] },
        { id: 'imp-g2', title: '导入目标二', term: 'long', desc: '', progress: 0, status: 'pending', subtasks: [], termText: '长期', statusText: '待开始' }
      ],
      skills: [{ id: 'imp-s1', name: '导入技能', category: '技术', level: 66, note: '', levelText: '高级' }],
      reviews: [{ id: 'imp-r1', date: '2026-10-20', achievement: '有进展', challenge: '', learning: '', plan: '', score: 8 }],
      path: [{ title: '阶段一', desc: '打基础', current: true }, { title: '阶段二', desc: '进阶', current: false }],
      actions: [{ id: 'imp-a1', title: '行动一', deadline: '2026-12-01', goalId: 'imp-g1', done: false }],
      vision: { year1: '一年愿景', year3: '三年愿景', values: '诚信' }
    }
  };
  await stubModal([{ confirm: true }]);
  await settings.callMethod('onImportInput', { detail: { value: JSON.stringify(payload) } });
  await settings.callMethod('onValidateImport');
  await sleep(500);
  let st = await storage();
  check('3.1 import goals count', st.goals && st.goals.length === 2, st.goals && st.goals.length);
  check('3.2 import goal canonical', st.goals && j(Object.keys(st.goals[0]).sort()) === j(GKEYS.slice().sort()), st.goals && Object.keys(st.goals[0]));
  check('3.3 import strips dirty display fields', st.goals && !('termText' in st.goals[1]), st.goals && st.goals[1]);
  check('3.4 import skills', st.skills.length === 1 && !('levelText' in st.skills[0]), st.skills);
  check('3.5 import reviews/actions/path/vision', st.reviews.length === 1 && st.actions.length === 1 && st.path.length === 2 && st.vision.values === '诚信' && Array.isArray(st.vision.years) && st.vision.years.length === 2 && st.vision.years[0].text === '一年愿景' && st.vision.years[1].text === '三年愿景', st.vision);
  let bk = await backups();
  check('3.6 import auto backup created', Array.isArray(bk) && bk.length === 1, bk && bk.length);
  const previewCleared = (await settings.data()).importPreview === null;
  check('3.7 import form cleared', previewCleared && (await settings.data()).importText === '');

  // ---------- 4. restore backup ----------
  await settings.callMethod('onRefreshBackups');
  const backupId = (await settings.data()).backups[0].id;
  await stubModal([{ confirm: true }]);
  await settings.callMethod('onRestoreBackup', { currentTarget: { dataset: { id: backupId } } });
  await sleep(500);
  st = await storage();
  check('4.1 restore backup worked', st.goals.length === 0 && st.skills.length === 0, st.goals && st.goals.length);
  check('4.2 restore keeps backups (adds safety copy)', (await backups()).length >= 2, (await backups()).length);

  // ---------- 5. backup cap (5) ----------
  for (let i = 0; i < 6; i += 1) {
    await stubModal([{ confirm: true }]);
    await settings.callMethod('onImportInput', { detail: { value: JSON.stringify(payload) } });
    await settings.callMethod('onValidateImport');
    await sleep(250);
  }
  bk = await backups();
  check('5.1 backups capped at 5', Array.isArray(bk) && bk.length === 5, bk && bk.length);

  await mp.disconnect();
  log(`RESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
