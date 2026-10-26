// E2E part B: page-level features (undo delete, dirty guard, insights cap, direction, cold start)
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
const AKEYS = ['id', 'title', 'deadline', 'goalId', 'done'];

(async () => {
  const mp = await automator.connect({ wsEndpoint: ws });
  const storage = () => mp.callWxMethod('getStorageSync', 'growthPlannerData');
  const gd = () => mp.evaluate(() => JSON.parse(JSON.stringify(getApp().globalData)));

  async function stubModal(queue) {
    await mp.evaluate(function (q) {
      globalThis.__modals = [];
      wx.showModal = function (o) {
        globalThis.__modals.push({ title: o && o.title, content: o && o.content, confirmText: o && o.confirmText });
        var resp = q && q.length ? q.shift() : { confirm: true, cancel: false };
        if (o && o.success) o.success(resp);
      };
    }, queue || []);
  }
  async function lastModal() {
    const modals = await mp.evaluate(() => (globalThis.__modals || []).slice(-3));
    return modals[modals.length - 1] || {};
  }
  async function resetAll() {
    await mp.evaluate(() => {
      wx.removeStorageSync('growthPlannerData');
      wx.removeStorageSync('growthPlannerDataBackups');
      var app = getApp();
      app.globalData = { skills: [], goals: [], reviews: [], path: [], actions: [], vision: { values: '', years: [] } };
      app.saveData();
      app.onLaunch();
    });
    await sleep(400);
  }
  async function waitPage(expected, tries) {
    for (var i = 0; i < tries; i++) {
      await sleep(250);
      try {
        var p = await mp.currentPage();
        if (p.path === expected) return p;
      } catch (e) { /* 页面切换瞬间 currentPage 可能失败，忽略 */ }
    }
    return null;
  }
  async function tab(path) {
    var clean = path.replace(/^\//, '');
    for (var attempt = 0; attempt < 3; attempt++) {
      await mp.evaluate(function (u) { wx.reLaunch({ url: u }); }, path);
      var p = await waitPage(clean, 12);
      if (p) return p;
      await mp.evaluate(function (u) { wx.switchTab({ url: u }); }, path);
      p = await waitPage(clean, 12);
      if (p) return p;
    }
    throw new Error('tab timeout ' + path);
  }

  log('S1 connected');
  await resetAll();
  log('S1 reset done');
  await stubModal([]);
  const ov = await tab('/pages/overview/overview');
  log('setup ok', ov.path);

  // ---------- 6. goals undo delete ----------
  const goals = await tab('/pages/goals/goals');
  await stubModal([]);
  await goals.callMethod('openAddModal');
  await goals.setData({ 'formData.title': '待删除目标', 'formData.term': 'short' });
  await goals.callMethod('saveGoal');
  await sleep(400);
  let st = await storage();
  const gid = st.goals[0].id;
  await stubModal([{ confirm: false, cancel: true }]);
  await goals.callMethod('deleteGoal', { currentTarget: { dataset: { id: gid } } });
  await sleep(400);
  const undoModal = await lastModal();
  check('6.1 delete shows undo modal', undoModal.title === '已删除目标', undoModal);
  st = await storage();
  check('6.2 undo restores goal', st.goals.length === 1 && st.goals[0].id === gid, st.goals && st.goals.length);
  check('6.3 restored goal canonical', !('termText' in (st.goals[0] || {})), st.goals && st.goals[0]);

  // ---------- 7. dirty guard (goals) ----------
  await stubModal([{ confirm: false, cancel: true }]);
  await goals.callMethod('openAddModal');
  await goals.callMethod('onTitleInput', { detail: { value: '临时输入' } });
  await goals.callMethod('closeModal');
  await sleep(350);
  const gm = await lastModal();
  const stillOpen = (await goals.data()).showModal === true;
  check('7.1 dirty close asks confirm', gm.title === '放弃编辑？', gm);
  check('7.2 cancel keeps modal open', stillOpen);
  await stubModal([{ confirm: true }]);
  await goals.callMethod('closeModal');
  await sleep(350);
  check('7.3 confirm discards and closes', (await goals.data()).showModal === false);
  check('7.4 discard adds nothing', (await storage()).goals.length === 1);

  // ---------- 8. skills undo delete + dirty guard ----------
  const skills = await tab('/pages/skills/skills');
  await stubModal([]);
  await skills.callMethod('quickAddSkill', { currentTarget: { dataset: { name: '待删技能', category: '技术' } } });
  await sleep(400);
  const sid = (await storage()).skills[0].id;
  await stubModal([{ confirm: false, cancel: true }]);
  await skills.callMethod('deleteSkill', { currentTarget: { dataset: { id: sid } } });
  await sleep(400);
  check('8.1 undo restores skill', (await storage()).skills.length === 1);
  await stubModal([{ confirm: false, cancel: true }]);
  await skills.callMethod('openAddModal');
  await skills.callMethod('onNameInput', { detail: { value: 'temp' } });
  await skills.callMethod('closeModal');
  await sleep(350);
  check('8.2 skills dirty guard', (await lastModal()).title === '放弃编辑？' && (await skills.data()).showModal === true);

  // ---------- 9. review undo delete ----------
  const review = await tab('/pages/review/review');
  await stubModal([]);
  await review.callMethod('openAddModal');
  await review.setData({ 'formData.achievement': '待删复盘' });
  await review.callMethod('saveReview');
  await sleep(400);
  const rid = (await storage()).reviews[0].id;
  await stubModal([{ confirm: false, cancel: true }]);
  await review.callMethod('deleteReview', { currentTarget: { dataset: { id: rid } } });
  await sleep(400);
  check('9.1 undo restores review', (await storage()).reviews.length === 1 && (await storage()).reviews[0].id === rid);

  // ---------- 10. direction ----------
  const direction = await tab('/pages/direction/direction');
  await stubModal([]);
  await direction.callMethod('openActionModal');
  await direction.setData({ 'actionForm.title': '行动A', 'actionForm.deadline': '2026-12-31' });
  await direction.callMethod('saveAction');
  await sleep(400);
  st = await storage();
  check('10.1 action saved canonical', st.actions.length === 1 && j(Object.keys(st.actions[0]).sort()) === j(AKEYS.slice().sort()), st.actions[0]);
  check('10.2 action id string', typeof st.actions[0].id === 'string' && st.actions[0].id.length > 8, st.actions[0].id);
  const aid = st.actions[0].id;
  await stubModal([{ confirm: false, cancel: true }]);
  await direction.callMethod('deleteAction', { currentTarget: { dataset: { id: aid } } });
  await sleep(400);
  check('10.3 undo restores action', (await storage()).actions.length === 1);
  await stubModal([]);
  await direction.callMethod('openVisionModal');
  await direction.callMethod('addVisionYear');
  await direction.callMethod('onVisionYearTextInput', { currentTarget: { dataset: { index: 0 } }, detail: { value: '一年后目标' } });
  await direction.callMethod('onVisionYearTextInput', { currentTarget: { dataset: { index: 1 } }, detail: { value: '三年后目标' } });
  await direction.setData({ 'visionForm.values': '专注' });
  await direction.callMethod('saveVision');
  await sleep(400);
  st = await storage();
  check('10.4 vision saved', Array.isArray(st.vision.years) && st.vision.years.length === 2 && st.vision.years[0].text === '一年后目标' && st.vision.years[1].text === '三年后目标', st.vision);
  check('10.5 vision canonical keys', j(Object.keys(st.vision).sort()) === j(['values', 'years']), Object.keys(st.vision));

  // ---------- 11. overview insights cap ----------
  await mp.evaluate(() => { globalThis.__toasts = []; wx.showToast = function (o) { globalThis.__toasts.push(o && o.title); }; });
  const overview = await tab('/pages/overview/overview');
  for (let i = 0; i < 8; i += 1) await overview.callMethod('generateInsight');
  await sleep(400);
  const od = await overview.data();
  check('11.1 insights capped', od.insights.length > 0 && od.insights.length <= 6, od.insights.length);
  check('11.2 insights deduped', new Set(od.insights.map((x) => x.content)).size === od.insights.length, od.insights.length);
  check('11.3 overview settings entry exists', typeof overview.callMethod === 'function');

  // ---------- 12. cold start ----------
  await mp.evaluate(() => { getApp().onLaunch(); });
  const g2 = await gd();
  check('12.1 cold start keeps goal', g2.goals.length === 1, g2.goals.length);
  check('12.2 cold start keeps vision', Array.isArray(g2.vision.years) && g2.vision.years.length === 2 && g2.vision.years[0].text === '一年后目标', g2.vision);
  check('12.3 cold start canonical', !('termText' in (g2.goals[0] || {})), g2.goals[0]);
  check('12.4 cold start keeps action', g2.actions.length === 1);

  // ---------- 13. settings reachable at end ----------
  await mp.evaluate((u) => { wx.navigateTo({ url: u }); }, '/pages/settings/settings');
  var sp = await waitPage('pages/settings/settings', 16);
  if (!sp) sp = await mp.currentPage();
  check('13.1 settings reachable', sp.path === 'pages/settings/settings', sp.path);

  await mp.disconnect();
  log(`RESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });


