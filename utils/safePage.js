/**
 * 页面级错误捕获（2026-10-28 v1.3.3 新增）
 *
 * 目的：真机上如果事件处理函数内部抛错，小程序默认不会给用户任何反馈，
 * 表现为「点了没反应」。这里给每个页面方法的执行包一层 try/catch：
 *   1. 捕获异常 → 写入本地错误日志（设置页可查看/复制）；
 *   2. 给用户一个可见的错误提示（避免“点不了”的观感）；
 *   3. 主流程不再被单个异常打断。
 */

var ERROR_KEY = 'growthPlannerErrorLog';
var MAX_ERRORS = 20;

/** 把任意错误转成可读文案。 */
function describeError(err) {
  if (!err) return '未知错误';
  if (typeof err === 'string') return err;
  if (err.errMsg) return String(err.errMsg);
  if (err.message) return String(err.message);
  try {
    return String(err);
  } catch (e) {
    return '未知错误';
  }
}

/** 取错误堆栈（最多 6 行），便于设置页复制后定位。 */
function describeStack(err) {
  try {
    if (!err || !err.stack) return '';
    return String(err.stack).split('\n').slice(0, 6).join('\n');
  } catch (e) {
    return '';
  }
}

function nowText() {
  var d = new Date();
  function p2(n) {
    n = String(n);
    return n.length < 2 ? '0' + n : n;
  }
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
    p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
}

function readErrorLog() {
  try {
    var list = wx.getStorageSync(ERROR_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/** 追加一条错误日志（保留最近 MAX_ERRORS 条）。 */
function recordError(scope, err) {
  var entry = {
    time: nowText(),
    scope: String(scope || 'unknown'),
    message: describeError(err),
    stack: describeStack(err)
  };
  try {
    var list = readErrorLog();
    list.unshift(entry);
    wx.setStorageSync(ERROR_KEY, list.slice(0, MAX_ERRORS));
  } catch (e) {
    /* 存储不可用时忽略：至少控制台/实时日志还有记录 */
  }
  try {
    console.error('[growth-planner] 页面异常 @' + entry.scope, err);
  } catch (e2) {
    /* 忽略 */
  }
  try {
    if (typeof wx.getRealtimeLogManager === 'function') {
      var manager = wx.getRealtimeLogManager();
      if (manager && typeof manager.error === 'function') {
        manager.error('[growth-planner]', entry.scope, entry.message, entry.stack);
      }
    }
  } catch (e3) {
    /* 忽略 */
  }
  return entry;
}

function getErrorLog() {
  return readErrorLog();
}

function clearErrorLog() {
  try {
    wx.removeStorageSync(ERROR_KEY);
  } catch (e) {
    /* 忽略 */
  }
  return true;
}

/** 给事件提示一个可见反馈。 */
function notifyError(err) {
  try {
    var message = describeError(err);
    if (message.length > 24) message = message.slice(0, 24) + '…';
    wx.showToast({ title: '操作出错：' + message, icon: 'none', duration: 3000 });
  } catch (e) {
    /* 忽略 */
  }
}

/**
 * 包装页面配置：所有函数属性（生命周期/事件处理）都加 try/catch。
 * 只捕获错误，不改变正常返回值与 this。
 */
function wrapPage(options) {
  var opts = options || {};
  Object.keys(opts).forEach(function (key) {
    if (key === 'data') return;
    var value = opts[key];
    if (typeof value !== 'function') return;
    if (value.__gpSafeWrapped) return;
    var wrapped = function () {
      try {
        return value.apply(this, arguments);
      } catch (err) {
        var route = (this && this.route) || '';
        recordError('page:' + route + ':' + key, err);
        notifyError(err);
        return undefined;
      }
    };
    wrapped.__gpSafeWrapped = true;
    opts[key] = wrapped;
  });
  return opts;
}

module.exports = {
  ERROR_KEY: ERROR_KEY,
  wrapPage: wrapPage,
  recordError: recordError,
  getErrorLog: getErrorLog,
  clearErrorLog: clearErrorLog,
  describeError: describeError,
  describeStack: describeStack
};
