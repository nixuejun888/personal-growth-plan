// 边界情况补充验证：复盘未保存提醒、技能重复添加、目标筛选下删除撤销、进度状态一致性、
// 设置页非法导入（放在最后，避免 settings 页停留后导航偶发失效影响其他用例）
const automator = require('miniprogram-automator');
const ws = 'ws://127.0.0.1:9420';
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; log('PASS', name); }
  else { fail++; log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); }
}

(async () => {
  const mp = await automator.connect({ wsEndpoint: ws });
  const storage = () => mp.callWxMethod('getStorageSync', 'growthPlannerData');

  async function stubModal(queue) {
    await mp.evaluate(function (q) {
      globalThis.__modals = [];
      wx.showModal = function (o) {
        globalThis.__modals.push({ title: o && o.title, content: o && o.content });
        var resp = q && q.length ? q.shift() : { confirm: true, cancel: false };
        if (o && o.success) o.success(resp);
      };
    }, queue || []);
  }
  async function lastModal() {
    const modals = await mp.evaluate(() => (globalThis.__modals || []).slice(-3));
    return modals[modals.length - 1] || {};
  }
  async function stubToast() {
    await mp.evaluate(function () {
      globalThis.__toasts = [];
      wx.showToast = function (o) { globalThis.__toasts.push((o && o.title) || ''); };
    });
  }
  async function lastToast() {
    const t = await mp.evaluate(() => (globalThis.__toasts || []).slice(-3));
    return t[t.length - 1] || '';
  }
  async function waitPage(expected, tries) {
    for (var i = 0; i < tries; i++) {
      await sleep(250);
      try { var p = await mp.currentPage(); if (p.path === expected) return p; } catch (e) {}
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
  async function resetAll() {
    await mp.evaluate(() => {
      wx.removeStorageSync('growthPlannerData');
      wx.removeStorageSync('growthPlannerDataBackups');
      var app = getApp();
      app.globalData = { skills: [], goals: [], reviews: [], path: [], actions: [], vision: { values: '', years: [] } };
      app.saveData(); app.onLaunch();
    });
    await sleep(300);
  }

  // 等待首屏就绪（冷启动后自动化可能早于页面 onShow）
  for (var w = 0; w < 20; w++) {
    await sleep(500);
    try { var p0 = await mp.currentPage(); var d0 = await p0.data(); if (d0 && d0.stats) break; } catch (e) {}
  }
  await resetAll();
  await stubModal([]);
  log('ready');

  // 1. 复盘页未保存提醒
  const review = await tab('/pages/review/review');
  await stubModal([{ confirm: false, cancel: true }]);
  await review.callMethod('openAddModal');
  await review.callMethod('onAchievementInput', { detail: { value: '临时内容' } });
  await review.callMethod('closeModal');
  await sleep(300);
  const rm = await lastModal();
  check('E1.1 review dirty guard', rm.title === '放弃编辑？' && (await review.data()).showModal === true, rm);
  await stubModal([{ confirm: true }]);
  await review.callMethod('closeModal');
  await sleep(250);
  check('E1.2 review discard closes', (await review.data()).showModal === false);

  // 2. 技能重复添加提示
  const skills = await tab('/pages/skills/skills');
  await stubToast();
  await skills.callMethod('quickAddSkill', { currentTarget: { dataset: { name: '重复技能', category: '技术' } } });
  await sleep(350);
  await skills.callMethod('quickAddSkill', { currentTarget: { dataset: { name: '重复技能', category: '技术' } } });
  await sleep(350);
  check('E2.1 duplicate skill toast', (await lastToast()).indexOf('已在列表中') >= 0, await lastToast());
  check('E2.2 duplicate not added', (await storage()).skills.length === 1);

  // 3. 筛选状态下删除目标 + 撤销，全量数据应恢复
  const goals = await tab('/pages/goals/goals');
  await stubModal([]);
  await goals.callMethod('openAddModal');
  await goals.setData({ 'formData.title': '筛选目标A', 'formData.term': 'short' });
  await goals.callMethod('saveGoal');
  await sleep(300);
  await goals.callMethod('openAddModal');
  await goals.setData({ 'formData.title': '筛选目标B', 'formData.term': 'long' });
  await goals.callMethod('saveGoal');
  await sleep(300);
  await goals.callMethod('setFilter', { currentTarget: { dataset: { filter: 'short' } } });
  await sleep(200);
  const filtered = await goals.data();
  check('E3.1 filter works', filtered.filteredGoals.length === 1, filtered.filteredGoals.length);
  const hid = filtered.filteredGoals[0].id;
  await stubModal([{ confirm: false, cancel: true }]);
  await goals.callMethod('deleteGoal', { currentTarget: { dataset: { id: hid } } });
  await sleep(400);
  check('E3.2 undo restores in full list', (await storage()).goals.length === 2, (await storage()).goals.length);
  check('E3.3 undo keeps filter view consistent', (await goals.data()).filteredGoals.length === 1);

  // 4. 目标进度与状态一致性：编辑时把进度改成 100，状态应自动 done
  await stubModal([]);
  const gid2 = (await storage()).goals.find((g) => g.title === '筛选目标B').id;
  await goals.callMethod('editGoal', { currentTarget: { dataset: { id: gid2 } } });
  await goals.callMethod('onProgressChange', { detail: { value: 100 } });
  await goals.callMethod('saveGoal');
  await sleep(400);
  const g2 = (await storage()).goals.find((g) => g.title === '筛选目标B');
  check('E4.1 progress 100 => done', g2 && g2.status === 'done' && g2.progress === 100, g2);

  // 5. 设置页非法导入（最后执行，不再离开设置页）
  await mp.evaluate((u) => { wx.navigateTo({ url: u }); }, '/pages/settings/settings');
  const settings = await waitPage('pages/settings/settings', 20);
  check('E5.1 settings opened', !!settings, settings && settings.path);
  if (settings) {
    await stubToast();
    await settings.callMethod('onImportInput', { detail: { value: '{bad json}' } });
    await settings.callMethod('onValidateImport');
    await sleep(250);
    const d1 = await settings.data();
    check('E5.2 invalid json rejected', (await lastToast()).indexOf('JSON') >= 0, await lastToast());
    check('E5.3 invalid json no preview', d1.importPreview === null || d1.importPreview === undefined, d1.importPreview);
    await settings.callMethod('onImportInput', { detail: { value: JSON.stringify({ app: 'personal-growth-plan', schema: 1, data: {} }) } });
    await settings.callMethod('onValidateImport');
    await sleep(250);
    const d2 = await settings.data();
    check('E5.4 empty payload rejected safely', (await lastToast()).indexOf('不像是') >= 0 && !d2.importPreview, await lastToast());
  }

  await resetAll();
  await mp.disconnect();
  log(`RESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
