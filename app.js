/**
 * 小程序入口（2026-10-26 数据层重构；2026-10-28 保存失败诊断增强 v1.3.1）
 *
 * 数据流：页面只读写 globalData；所有持久化统一经过 utils/store.js 规范化，
 * 保证 storage 里只有业务字段，且旧版本脏数据在读取时自动清洗。
 *
 * 保存失败处理：保存失败时记录具体原因（便于页面提示与实时日志排查），
 * 并自动重试一次，尽量规避偶发的存储写入异常。
 */
var store = require('./utils/store');
var safePage = require('./utils/safePage');

/** 尽力上报到微信实时日志（未开启统计上报服务时会静默失败，不影响主流程）。 */
function reportByRealtimeLog(scope, message) {
  try {
    var manager = typeof wx.getRealtimeLogManager === 'function' ? wx.getRealtimeLogManager() : null;
    if (manager && typeof manager.error === 'function') {
      manager.error('[growth-planner]', scope, message);
    }
  } catch (e) {
    /* 实时日志不可用时忽略 */
  }
}

/** 提取错误文案：优先 errMsg，其次 message/toString。 */
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

/** 从错误堆栈里取第一条含 .js 的栈帧，便于定位（如 pages/skills/skills.js:12:34）。 */
function pickStackFrame(err) {
  try {
    var stack = err && err.stack ? String(err.stack) : '';
    if (!stack) return '';
    var lines = stack.split('\n');
    var i;
    for (i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      if (line.indexOf('.js:') !== -1) {
        var match = line.match(/([A-Za-z0-9_\-./]+\.js:\d+:\d+)/);
        if (match) return match[1];
        return line.replace(/^\s+|\s+$/g, '').slice(0, 120);
      }
    }
  } catch (e) {
    /* 忽略 */
  }
  return '';
}

/** 完整错误详情（message + 栈帧 + 堆栈前几行），写入本地供设置页排查。 */
function describeErrorDetail(err) {
  var message = describeError(err);
  var frame = pickStackFrame(err);
  var stack = '';
  try {
    if (err && err.stack) stack = String(err.stack).split('\n').slice(0, 4).join('\n');
  } catch (e) {
    stack = '';
  }
  return {
    message: message,
    frame: frame,
    detail: message + (frame ? ' @' + frame : ''),
    stack: stack
  };
}

var LAST_ERROR_KEY = 'growthPlannerLastSaveError';

/** 记录最近一次保存失败（尽力而为；存储本身不可用时静默失败）。 */
function rememberSaveError(errorInfo) {
  try {
    wx.setStorageSync(LAST_ERROR_KEY, {
      time: Date.now(),
      message: errorInfo.message,
      frame: errorInfo.frame,
      detail: errorInfo.detail,
      stack: errorInfo.stack
    });
  } catch (e) {
    /* 忽略 */
  }
}

App({
  onLaunch: function () {
    this._lastSaveError = '';
    this._lastSaveDetail = '';
    this.globalData = this.readData();
  },

  /** 全局脚本错误：写入本地错误日志，设置页可查看/复制。 */
  onError: function (err) {
    safePage.recordError('app:onError', err);
  },

  /** 未处理的 Promise 异常同样记录。 */
  onUnhandledRejection: function (res) {
    safePage.recordError('app:onUnhandledRejection', (res && res.reason) || res || '未知 Promise 异常');
  },

  /** 从本地 storage 读取数据（失败/为空时返回空数据结构，并做一次规范化迁移）。 */
  readData: function () {
    try {
      var raw = wx.getStorageSync(store.STORAGE_KEY);
      return raw && typeof raw === 'object' ? store.normalizeData(raw) : store.emptyData();
    } catch (e) {
      console.error('[growth-planner] 读取本地数据失败', e);
      reportByRealtimeLog('readData', describeError(e));
      return store.emptyData();
    }
  },

  /**
   * 全量保存：返回是否成功，便于页面做失败提示。
   * 失败时会记录原因、写实时日志，并自动重试一次。
   */
  saveData: function () {
    var payload = null;
    var firstError = null;
    try {
      payload = store.toPlainData(this.globalData);
    } catch (e) {
      firstError = e;
      var info = describeErrorDetail(e);
      this._lastSaveError = info.message;
      this._lastSaveDetail = info.detail;
      console.error('[growth-planner] 序列化数据失败', e);
      reportByRealtimeLog('serialize', info.detail + (info.stack ? '\n' + info.stack : ''));
      rememberSaveError(info);
      // 兜底：直接用 JSON 深拷贝尝试保存，避免个别对象异常导致完全无法保存
      try {
        payload = JSON.parse(JSON.stringify(this.globalData || {}));
      } catch (e2) {
        payload = null;
      }
      if (!payload) return false;
    }

    var attempt;
    for (attempt = 0; attempt < 2; attempt += 1) {
      try {
        wx.setStorageSync(store.STORAGE_KEY, payload);
        this._lastSaveError = '';
        this._lastSaveDetail = '';
        return true;
      } catch (e) {
        if (!firstError) firstError = e;
        console.error('[growth-planner] 保存本地数据失败（第 ' + (attempt + 1) + ' 次）', e);
      }
    }

    var failed = describeErrorDetail(firstError);
    this._lastSaveError = failed.message;
    this._lastSaveDetail = failed.detail;
    reportByRealtimeLog('saveData', failed.detail + (failed.stack ? '\n' + failed.stack : ''));
    rememberSaveError(failed);
    return false;
  },

  getData: function () {
    return this.globalData;
  },

  /** 更新某个数据分区并立即持久化，返回保存结果。 */
  updateData: function (key, value) {
    this.globalData[key] = value;
    return this.saveData();
  },

  /** 整体替换数据（导入/恢复备份用），返回保存结果。 */
  replaceData: function (data) {
    this.globalData = store.normalizeData(data);
    return this.saveData();
  },

  /** 最近一次保存失败的具体原因（成功时为空字符串），用于页面提示排查。 */
  getLastSaveError: function () {
    return this._lastSaveError || '';
  },

  /** 最近一次保存失败的详细信息（含栈帧/堆栈，成功时为空）。 */
  getLastSaveDetail: function () {
    return this._lastSaveDetail || '';
  },

  /** 页面可用的简短失败提示：无原因时退化为通用文案。 */
  saveErrorText: function () {
    var reason = this.getLastSaveError();
    if (!reason) return '保存失败，请重试';
    var short = reason.length > 22 ? reason.slice(0, 22) + '…' : reason;
    return '保存失败：' + short;
  },

  genId: function () {
    return store.genId();
  },

  getCurrentDate: function () {
    var d = new Date();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
  }
});
