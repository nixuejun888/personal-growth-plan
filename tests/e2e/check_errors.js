/* 1.3.3 验收：版本号、页面异常捕获(事件处理)、错误日志展示与清空 */
const automator = require('miniprogram-automator');
const WS = 'ws://127.0.0.1:9420';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = 'growthPlannerErrorLog';
let pass = 0, fail = 0;
const check = (n, ok, extra) => { if (ok) { pass++; console.log('PASS ' + n + (extra ? ' | ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' | ' + extra : '')); } };

async function go(mp, url) {
  await mp.evaluate((u) => { wx.reLaunch({ url: u }); }, url);
  await sleep(900);
  return mp.currentPage();
}

(async () => {
  const mp = await automator.connect({ wsEndpoint: WS });
  await mp.evaluate(() => {
    wx.removeStorageSync('growthPlannerErrorLog');
    wx.removeStorageSync('growthPlannerData');
    getApp().onLaunch();
    wx.showModal = function (o) { if (o && o.success) o.success({ confirm: true, cancel: false }); };
    wx.showToast = function (o) { globalThis.__toasts = (globalThis.__toasts || []).concat([o && o.title]); };
  });

  // 版本 & 初始状态
  let page = await go(mp, '/pages/settings/settings');
  let data = await page.data();
  check('1.1 版本号 1.3.3', data.version.indexOf('1.3.') === 0, 'version=' + data.version);
  check('1.2 错误日志为空', Array.isArray(data.errorLog) && data.errorLog.length === 0, 'len=' + (data.errorLog || []).length);

  // 在真实事件处理函数中制造异常：把技能名改成数字，saveSkill 里 s.name.trim() 会抛错
  page = await go(mp, '/pages/skills/skills');
  await page.setData({ showModal: true, isEdit: false, formData: { name: 123, category: '技术', level: 50, note: '' } });
  await sleep(200);
  await page.callMethod('saveSkill');
  await sleep(600);
  let log = await mp.evaluate((k) => {
    const list = wx.getStorageSync(k);
    return Array.isArray(list) ? list : [];
  }, KEY);
  const toasts = await mp.evaluate(() => globalThis.__toasts || []);
  check('2.1 事件处理异常被捕获并记录', log.length >= 1, 'len=' + log.length);
  check('2.2 记录 scope 指向 saveSkill', log[0] && String(log[0].scope).indexOf('saveSkill') >= 0, log[0] && log[0].scope);
  check('2.3 记录包含异常原因', log[0] && /trim/.test(String(log[0].message)), log[0] && log[0].message);
  check('2.4 用户看到错误提示(非静默)', toasts.some((t) => t && String(t).indexOf('操作出错') === 0), JSON.stringify(toasts));

  // 设置页应展示
  page = await go(mp, '/pages/settings/settings');
  data = await page.data();
  check('3.1 设置页展示错误日志', Array.isArray(data.errorLog) && data.errorLog.length >= 1, 'len=' + (data.errorLog || []).length);

  // 清空
  await page.callMethod('onClearErrorLog');
  await sleep(600);
  log = await mp.evaluate((k) => wx.getStorageSync(k) || [], KEY);
  check('4.1 清空错误日志', !log || (Array.isArray(log) && log.length === 0), 'len=' + (Array.isArray(log) ? log.length : typeof log));

  console.log(`RESULT pass=${pass} fail=${fail}`);
  await mp.disconnect();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + ((e && e.stack) || e)); process.exit(1); });
