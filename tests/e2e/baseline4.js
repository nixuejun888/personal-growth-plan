// E2E regression after data-layer fixes (v1.1.0)
const automator = require('miniprogram-automator');
const ws = 'ws://127.0.0.1:9420';
const log = (...a) => console.log(...a);
const j = (x) => JSON.stringify(x);
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; log('PASS', name); }
  else { fail++; log('FAIL', name, extra === undefined ? '' : j(extra)); }
}
const safe = async (label, fn) => { try { return await fn(); } catch (e) { log('ERR', label, '::', e.message); fail++; return undefined; } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const GKEYS = ['id', 'title', 'term', 'desc', 'progress', 'status', 'subtasks'];
const SKEYS = ['id', 'name', 'category', 'level', 'note'];

(async () => {
  const mp = await automator.connect({ wsEndpoint: ws });
  const storage = () => mp.callWxMethod('getStorageSync', 'growthPlannerData');
  const gd = () => mp.evaluate(() => JSON.parse(JSON.stringify(getApp().globalData)));

  // reset（清空数据 + 固定弹窗应答，确保套件独立）
  await mp.evaluate(() => {
    wx.removeStorageSync('growthPlannerData');
    wx.removeStorageSync('growthPlannerDataBackups');
    var app = getApp();
    app.globalData = { skills: [], goals: [], reviews: [], path: [], actions: [], vision: { values: '', years: [] } };
    app.saveData();
    app.onLaunch();
    wx.showModal = function (o) { if (o && o.success) o.success({ confirm: true, cancel: false }); };
    wx.showToast = function () {};
  });
  await sleep(600);

  // ---------- 1. add goal ----------
  await mp.evaluate(() => wx.reLaunch({ url: '/pages/overview/overview' }));
  await sleep(1500);
  let goals = await mp.currentPage();
  if (goals.path !== 'pages/goals/goals') {
    await mp.evaluate(() => wx.switchTab({ url: '/pages/goals/goals' }));
    await sleep(1200);
  }
  goals = await mp.currentPage();
  if (goals.path !== 'pages/goals/goals') throw new Error('cannot open goals page: ' + goals.path);
  await safe('openAddModal', () => goals.callMethod('openAddModal'));
  await goals.setData({ 'formData.title': '目标A', 'formData.term': 'short', 'formData.desc': 'desc', 'formData.subtasks': [{ text: '子1', done: false }, { text: '子2', done: false }] });
  await safe('saveGoal', () => goals.callMethod('saveGoal'));
  await sleep(500);
  let st = await storage();
  let gA = (st.goals || [])[0];
  check('1.1 goal saved', st.goals && st.goals.length === 1, st.goals);
  check('1.2 goal no display fields in storage', gA && !('termText' in gA) && !('statusText' in gA), gA);
  check('1.3 goal canonical keys', gA && j(Object.keys(gA).sort()) === j(GKEYS.slice().sort()), Object.keys(gA || {}));
  check('1.4 goal id is unique string', gA && typeof gA.id === 'string' && gA.id.length > 8, gA && gA.id);
  check('1.5 page data updated', (await goals.data()).goals.length === 1);

  // ---------- 2. edit + cancel must not leak ----------
  await safe('editGoal', () => goals.callMethod('editGoal', { currentTarget: { dataset: { id: gA.id } } }));
  await sleep(300);
  await safe('leak input', () => goals.callMethod('onSubtaskInput', { currentTarget: { dataset: { index: 0 } }, detail: { value: 'CANCEL_LEAK' } }));
  // dirty-form guard: closeModal 会先确认放弃编辑
  await mp.evaluate(() => { wx.showModal = function (o) { o && o.success && o.success({ confirm: true, cancel: false }); }; });
  await goals.callMethod('closeModal');
  await sleep(300);
  const gd1 = await gd();
  check('2.1 cancel does not mutate globalData', gd1.goals[0].subtasks[0].text === '子1', gd1.goals[0].subtasks);
  check('2.2 cancel does not change storage', (await storage()).goals[0].subtasks[0].text === '子1');

  // ---------- 3. edit + save ----------
  await safe('editGoal2', () => goals.callMethod('editGoal', { currentTarget: { dataset: { id: gA.id } } }));
  await sleep(300);
  await goals.setData({ 'formData.title': '目标A改' });
  await safe('saveGoal2', () => goals.callMethod('saveGoal'));
  await sleep(500);
  st = await storage();
  check('3.1 edit saved', st.goals[0].title === '目标A改', st.goals[0].title);
  check('3.2 edit keeps subtasks', st.goals[0].subtasks.length === 2, st.goals[0].subtasks);
  check('3.3 no display fields after edit', !('termText' in (st.goals[0] || {})), st.goals[0]);

  // ---------- 4. toggle subtask (correct dataset keys) ----------
  await safe('toggle1', () => goals.callMethod('toggleSubtask', { currentTarget: { dataset: { goalId: gA.id, subIndex: 0 } } }));
  await sleep(400);
  st = await storage();
  check('4.1 toggle progress 50', st.goals[0].progress === 50, st.goals[0].progress);
  check('4.2 toggle status progress', st.goals[0].status === 'progress', st.goals[0].status);
  check('4.3 toggle storage canonical', !('termText' in (st.goals[0] || {})), st.goals[0]);
  await safe('toggle1b', () => goals.callMethod('toggleSubtask', { currentTarget: { dataset: { goalId: gA.id, subIndex: 0 } } }));
  await sleep(400);
  st = await storage();
  check('4.4 untoggle progress 0', st.goals[0].progress === 0, st.goals[0].progress);
  check('4.5 untoggle status back to pending', st.goals[0].status === 'pending', st.goals[0].status);

  // ---------- 5. unique ids on rapid add ----------
  await goals.callMethod('openAddModal');
  await goals.setData({ 'formData.title': '目标B' });
  await goals.callMethod('saveGoal');
  await sleep(400);
  const idB = (await storage()).goals[1].id;
  check('5.1 ids unique', idB !== gA.id, [idB, gA.id]);
  check('5.2 ids are strings', typeof idB === 'string');

  // ---------- 6. delete with stubbed modal ----------
  await mp.evaluate(() => { wx.showModal = function (o) { o && o.success && o.success({ confirm: true, cancel: false }); }; });
  await safe('deleteB', () => goals.callMethod('deleteGoal', { currentTarget: { dataset: { id: idB } } }));
  await sleep(400);
  st = await storage();
  check('6.1 delete works', st.goals.length === 1 && st.goals[0].id === gA.id, st.goals.length);
  check('6.2 storage still canonical', !('termText' in (st.goals[0] || {})), st.goals[0]);

  // ---------- 7. review order stability ----------
  const review = await mp.switchTab('/pages/review/review');
  await review.waitFor(400);
  for (const t of ['复盘一', '复盘二', '复盘三']) {
    await review.callMethod('openAddModal');
    await review.setData({ 'formData.achievement': t });
    await review.callMethod('saveReview');
    await sleep(350);
  }
  const storageOrder = async () => ((await storage()).reviews || []).map(r => r.achievement);
  const pageOrder = async () => ((await review.data()).reviews || []).map(r => r.achievement);
  check('7.1 storage append order stable', j(await storageOrder()) === j(['复盘一', '复盘二', '复盘三']), await storageOrder());
  check('7.2 page shows newest first', j(await pageOrder()) === j(['复盘三', '复盘二', '复盘一']), await pageOrder());
  await mp.switchTab('/pages/overview/overview');
  const review2 = await mp.switchTab('/pages/review/review');
  await review2.waitFor(400);
  check('7.3 storage order after tab cycle unchanged', j(await storageOrder()) === j(['复盘一', '复盘二', '复盘三']), await storageOrder());
  check('7.4 page order after tab cycle unchanged', j(await pageOrder()) === j(['复盘三', '复盘二', '复盘一']), await pageOrder());

  // ---------- 8. skills ----------
  const skills = await mp.switchTab('/pages/skills/skills');
  await skills.waitFor(400);
  await safe('quickAdd', () => skills.callMethod('quickAddSkill', { currentTarget: { dataset: { name: '技能Q', category: '技术' } } }));
  await sleep(400);
  let sk = (await storage()).skills;
  check('8.1 quick add saved', sk.length === 1 && sk[0].name === '技能Q', sk);
  check('8.2 skill canonical keys', sk[0] && j(Object.keys(sk[0]).sort()) === j(SKEYS.slice().sort()), Object.keys(sk[0] || {}));
  await safe('editSkill', () => skills.callMethod('editSkill', { currentTarget: { dataset: { id: sk[0].id } } }));
  await sleep(300);
  await skills.setData({ 'formData.level': 88 });
  await safe('saveSkill', () => skills.callMethod('saveSkill'));
  await sleep(400);
  sk = (await storage()).skills;
  check('8.3 skill level updated', sk[0].level === 88, sk[0].level);
  check('8.4 no levelText persisted', !('levelText' in (sk[0] || {})), sk[0]);
  check('8.5 skill id string', typeof sk[0].id === 'string', sk[0].id);

  // ---------- 9. overview stats ----------
  const overview = await mp.switchTab('/pages/overview/overview');
  await overview.waitFor(400);
  const stats = (await overview.data()).stats;
  const plain = await storage();
  check('9.1 activeGoals counts unfinished', stats.activeGoals === plain.goals.filter(g => g.status !== 'done').length, [stats, plain.goals.length]);
  check('9.2 reviewCount correct', stats.reviewCount === 3, stats.reviewCount);
  check('9.3 totalSkills correct', stats.totalSkills === 1, stats.totalSkills);

  // ---------- 10. cold start keeps data ----------
  await mp.evaluate(() => getApp().onLaunch());
  const g2 = await (async () => mp.evaluate(() => JSON.parse(JSON.stringify(getApp().globalData))))();
  check('10.1 cold start keeps goals', g2.goals.length === 1, g2.goals.length);
  check('10.2 cold start keeps reviews', g2.reviews.length === 3, g2.reviews.length);
  check('10.3 cold start keeps skills', g2.skills.length === 1, g2.skills.length);
  check('10.4 cold start data canonical', !('termText' in (g2.goals[0] || {})) && !('levelText' in (g2.skills[0] || {})), g2.goals[0]);

  // ---------- 11. legacy polluted data migration ----------
  await mp.evaluate(() => {
    wx.setStorageSync('growthPlannerData', {
      goals: [{ id: '111', title: '旧目标', term: 'short', desc: '', progress: 0, status: 'pending', subtasks: [], termText: '短期', statusText: '待开始' }],
      skills: [{ id: '222', name: '旧技能', category: '技术', level: 30, note: '', levelText: '初级' }],
      reviews: [{ id: '333', date: '2026-04-30', achievement: 'a', challenge: '', learning: '', plan: '', score: 8 }],
      path: [], actions: [], vision: {}
    });
    getApp().onLaunch();
    getApp().saveData();
  });
  const migrated = await storage();
  check('11.1 migration strips goal display fields', !('termText' in (migrated.goals[0] || {})), migrated.goals[0]);
  check('11.2 migration strips skill display fields', !('levelText' in (migrated.skills[0] || {})), migrated.skills[0]);
  check('11.3 migration keeps records', migrated.goals.length === 1 && migrated.skills.length === 1 && migrated.reviews.length === 1);
  check('11.4 migration keeps legacy ids', migrated.goals[0].id === '111', migrated.goals[0].id);

  await mp.disconnect();
  log(`RESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
