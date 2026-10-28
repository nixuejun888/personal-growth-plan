/* 用真实点击（element.tap）验证 技能/目标/总览 的保存按钮是否可点、是否能保存 */
const automator = require('miniprogram-automator');
const WS = 'ws://127.0.0.1:9420';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok, extra) => { if (ok) { pass++; console.log('PASS ' + n + (extra ? ' | ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' | ' + extra : '')); } };

async function tapText(page, text, cls) {
  const els = await page.$$(cls || 'view');
  for (const el of els) {
    let t = '';
    try { t = (await el.text()) || ''; } catch (e) { continue; }
    if (String(t).trim() === text) { await el.tap(); return true; }
  }
  return false;
}

(async () => {
  const mp = await automator.connect({ wsEndpoint: WS });
  await mp.evaluate(() => { wx.removeStorageSync('growthPlannerData'); wx.removeStorageSync('growthPlannerLastSaveError'); getApp().onLaunch(); });

  // ---- 技能页 ----
  await mp.switchTab('/pages/skills/skills');
  await sleep(700);
  let page = await mp.currentPage();
  await page.callMethod('openAddModal');
  await sleep(400);
  await page.setData({ formData: { name: '点击技能A', category: '软技能', level: 55, note: '' } });
  await sleep(200);
  const tapped1 = await tapText(page, '保存', 'view');
  await sleep(600);
  let st = await mp.evaluate(() => JSON.parse(JSON.stringify(wx.getStorageSync('growthPlannerData') || {})).skills || []);
  check('A1 技能保存按钮可点击', tapped1);
  check('A2 技能真实点击保存成功', st.length === 1 && st[0].name === '点击技能A', JSON.stringify(st));

  // ---- 目标页 ----
  await mp.switchTab('/pages/goals/goals');
  await sleep(700);
  page = await mp.currentPage();
  await page.callMethod('openAddModal');
  await sleep(400);
  await page.setData({ formData: { title: '点击目标A', term: 'short', desc: '', deadline: '', progress: 0, status: 'pending', subtasks: [] } });
  await sleep(200);
  const tapped2 = await tapText(page, '保存', 'view');
  await sleep(600);
  st = await mp.evaluate(() => JSON.parse(JSON.stringify(wx.getStorageSync('growthPlannerData') || {})).goals || []);
  check('B1 目标保存按钮可点击', tapped2);
  check('B2 目标真实点击保存成功', st.length === 1 && st[0].title === '点击目标A', JSON.stringify(st.map(g => g.title)));

  // ---- 总览页 ----
  await mp.switchTab('/pages/overview/overview');
  await sleep(700);
  page = await mp.currentPage();
  const tapped3 = await tapText(page, '添加目标', 'view');
  await sleep(900);
  st = await mp.evaluate(() => JSON.parse(JSON.stringify(wx.getStorageSync('growthPlannerData') || {})).skills || []);
  const cur = await mp.currentPage();
  const data = await cur.data();
  check('C1 总览添加目标可点击', tapped3, 'current=' + cur.path);
  check('C2 打开目标弹窗', !!data.showModal, 'showModal=' + data.showModal);

  // 在目标页弹窗中真实点击保存
  if (data.showModal) {
    await cur.setData({ formData: { title: '总览进入目标B', term: 'short', desc: '', deadline: '', progress: 0, status: 'pending', subtasks: [] } });
    await sleep(200);
    const tapped4 = await tapText(cur, '保存', 'view');
    await sleep(600);
    const goals = await mp.evaluate(() => JSON.parse(JSON.stringify(wx.getStorageSync('growthPlannerData') || {})).goals || []);
    check('C3 总览→目标弹窗保存可点击', tapped4);
    check('C4 保存成功', goals.some(g => g.title === '总览进入目标B'), JSON.stringify(goals.map(g => g.title)));
  }

  console.log(`RESULT pass=${pass} fail=${fail}`);
  await mp.disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + ((e && e.stack) || e)); process.exit(1); });
