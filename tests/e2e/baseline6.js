// 新功能 E2E：目标拆分步骤 / 愿景分年 / 成长洞察
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
  const gd = () => mp.evaluate(() => getApp().getData());
  const j = (x) => JSON.stringify(x);

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
      await mp.evaluate(function () { try { wx.navigateBack({ delta: 20 }); } catch (e) {} });
      await sleep(400);
      await mp.evaluate(function (u) { wx.reLaunch({ url: u }); }, path);
      var p = await waitPage(clean, 12);
      if (p) { await sleep(400); return await mp.currentPage(); }
      await mp.evaluate(function (u) { wx.switchTab({ url: u }); }, path);
      p = await waitPage(clean, 12);
      if (p) { await sleep(400); return await mp.currentPage(); }
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

  for (var w = 0; w < 20; w++) {
    await sleep(500);
    try { var p0 = await mp.currentPage(); var d0 = await p0.data(); if (d0 && d0.stats) break; } catch (e) {}
  }
  await resetAll();
  await stubModal([]);

  // ================= 1. 目标拆分步骤 =================
  const goals = await tab('/pages/goals/goals');
  await goals.callMethod('openAddModal');
  await goals.setData({ formData: { title: '步骤测试目标', term: 'short', desc: '', progress: 0, status: 'pending', subtasks: [] } });
  await goals.callMethod('saveGoal');
  await sleep(400);
  let st = await storage();
  check('1.1 goal created', st.goals.length === 1 && st.goals[0].title === '步骤测试目标', st.goals);
  const gid = st.goals[0].id;

  await goals.callMethod('openStepsModal', { currentTarget: { dataset: { id: gid } } });
  await sleep(300);
  let gp = await goals.data();
  check('1.2 steps modal opens empty', gp.showStepsModal === true && gp.stepsForm.subtasks.length === 0, gp.stepsForm);

  await goals.callMethod('addStep');
  await goals.callMethod('onStepInput', { currentTarget: { dataset: { index: 0 } }, detail: { value: '第一步' } });
  await goals.callMethod('addStep');
  await goals.callMethod('onStepInput', { currentTarget: { dataset: { index: 1 } }, detail: { value: '第二步' } });
  await goals.callMethod('toggleStepDone', { currentTarget: { dataset: { index: 0 } } });
  await goals.callMethod('saveSteps');
  await sleep(400);
  st = await storage();
  check('1.3 steps saved with texts', st.goals[0].subtasks.length === 2 && st.goals[0].subtasks[0].text === '第一步' && st.goals[0].subtasks[0].done === true, st.goals[0].subtasks);
  check('1.4 progress computed 50/progress', st.goals[0].progress === 50 && st.goals[0].status === 'progress', { p: st.goals[0].progress, s: st.goals[0].status });

  await goals.callMethod('openStepsModal', { currentTarget: { dataset: { id: gid } } });
  await sleep(300);
  gp = await goals.data();
  check('1.5 reopen shows steps', gp.stepsForm.subtasks.length === 2 && gp.stepsForm.subtasks[0].done === true);

  // AI 拆解需确认替换
  await stubModal([{ confirm: true }]);
  await goals.callMethod('generateSteps');
  await sleep(300);
  gp = await goals.data();
  check('1.6 generateSteps adds template', gp.stepsForm.subtasks.length >= 3, gp.stepsForm.subtasks.length);
  // 取消关闭不保存
  await stubModal([{ confirm: false, cancel: true }]);
  await goals.callMethod('closeStepsModal');
  await sleep(300);
  check('1.7 dirty close guard keeps modal', (await goals.data()).showStepsModal === true);
  await stubModal([{ confirm: true }]);
  await goals.callMethod('closeStepsModal');
  await sleep(300);
  check('1.8 discard closes without saving', (await goals.data()).showStepsModal === false && (await storage()).goals[0].subtasks.length === 2);

  // 全部完成 -> done；清空步骤 -> pending
  await goals.callMethod('openStepsModal', { currentTarget: { dataset: { id: gid } } });
  await goals.callMethod('toggleStepDone', { currentTarget: { dataset: { index: 1 } } });
  await goals.callMethod('saveSteps');
  await sleep(400);
  st = await storage();
  check('1.9 all done -> 100/done', st.goals[0].progress === 100 && st.goals[0].status === 'done', { p: st.goals[0].progress, s: st.goals[0].status });
  await goals.callMethod('openStepsModal', { currentTarget: { dataset: { id: gid } } });
  await goals.callMethod('removeStep', { currentTarget: { dataset: { index: 1 } } });
  await goals.callMethod('removeStep', { currentTarget: { dataset: { index: 0 } } });
  await goals.callMethod('saveSteps');
  await sleep(400);
  st = await storage();
  check('1.10 clear steps resets pending', st.goals[0].subtasks.length === 0 && st.goals[0].progress === 0 && st.goals[0].status === 'pending', { p: st.goals[0].progress, s: st.goals[0].status });

  // ================= 2. 愿景分年 =================
  const direction = await tab('/pages/direction/direction');
  await direction.callMethod('openVisionModal');
  await sleep(300);
  let dd = await direction.data();
  const curYear = new Date().getFullYear();
  check('2.1 default one year', dd.visionForm.years.length === 1 && dd.visionForm.years[0].year === curYear + 1, dd.visionForm);

  await direction.callMethod('addVisionYear');
  await sleep(200);
  dd = await direction.data();
  check('2.2 add year', dd.visionForm.years.length === 2 && dd.visionForm.years[1].year === curYear + 2, dd.visionForm.years);

  await direction.callMethod('onVisionYearInput', { currentTarget: { dataset: { index: 1 } }, detail: { value: String(curYear + 1) } });
  await direction.callMethod('onVisionYearTextInput', { currentTarget: { dataset: { index: 0 } }, detail: { value: '第一年愿景' } });
  await direction.callMethod('onVisionYearTextInput', { currentTarget: { dataset: { index: 1 } }, detail: { value: '第二年愿景' } });
  await stubToast();
  await direction.callMethod('saveVision');
  await sleep(300);
  check('2.3 duplicate year rejected', (await lastToast()).indexOf('重复') >= 0, await lastToast());

  await direction.callMethod('onVisionYearInput', { currentTarget: { dataset: { index: 1 } }, detail: { value: String(curYear + 3) } });
  await direction.callMethod('onVisionYearTextInput', { currentTarget: { dataset: { index: 0 } }, detail: { value: `${curYear + 1} 年愿景` } });
  await direction.callMethod('onVisionYearTextInput', { currentTarget: { dataset: { index: 1 } }, detail: { value: `${curYear + 3} 年愿景` } });
  await direction.callMethod('saveVision');
  await sleep(400);
  st = await storage();
  check('2.4 vision years saved sorted', st.vision.years.length === 2 && st.vision.years[0].year === curYear + 1 && st.vision.years[1].year === curYear + 3, st.vision.years);
  check('2.5 vision texts saved', st.vision.years[0].text.indexOf('年愿景') >= 0 && st.vision.years[1].text.indexOf('年愿景') >= 0, st.vision.years);
  check('2.6 vision canonical', j(Object.keys(st.vision).sort()) === j(['values', 'years']), Object.keys(st.vision));

  // 空文案行保存时丢弃
  await direction.callMethod('openVisionModal');
  dd = await direction.data();
  check('2.7 reopen keeps years', dd.visionForm.years.length === 2, dd.visionForm.years);

  // ================= 3. 成长洞察 =================
  const yesterday = new Date(Date.now() - 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  await mp.evaluate((overdue) => {
    var app = getApp();
    app.replaceData({
      goals: [{ id: 'ins-g1', title: '没有步骤的目标', term: 'long', desc: '', progress: 0, status: 'pending', subtasks: [] }],
      skills: [{ id: 'ins-s1', name: '技能一', category: '技术', level: 30, note: '' }],
      reviews: [],
      path: [],
      actions: [{ id: 'ins-a1', title: '超期行动', deadline: overdue, goalId: 'ins-g1', done: false }],
      vision: { values: '', years: [] }
    });
  }, dstr);
  await sleep(300);
  const overview = await tab('/pages/overview/overview');
  await sleep(500);
  let od = await overview.data();
  const titles = (od.insights || []).map((x) => x.type + ':' + x.title);
  check('3.1 insights generated', od.insights.length > 0 && od.insights.length <= 6, titles);
  check('3.2 insight fields complete', od.insights.every((x) => x.title && x.content && x.type), od.insights[0]);
  check('3.3 overdue action insight present', titles.join('|').indexOf('focus') >= 0, titles);
  check('3.4 no-steps goal insight present', titles.join('|').indexOf('goals') >= 0, titles);
  check('3.5 insights deduped', new Set(od.insights.map((x) => x.content)).size === od.insights.length, od.insights.length);

  // 生成 AI 洞察并回到目标页
  await overview.callMethod('generateInsight');
  await sleep(300);
  od = await overview.data();
  check('3.6 AI insight added & cap', od.insights.length <= 6 && od.insights[0].type === 'ai', od.insights[0]);
  await overview.callMethod('onInsightTap', { currentTarget: { dataset: { action: 'goals' } } });
  await sleep(800);
  const cur = await mp.currentPage();
  check('3.7 insight tap navigates', cur.path === 'pages/goals/goals', cur.path);

  await mp.disconnect();
  log(`RESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
