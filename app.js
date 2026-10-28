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

App({
  onLaunch: function () {
    this._lastSaveError = '';
    this.globalData = this.readData();
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
    var payload;
    try {
      payload = store.toPlainData(this.globalData);
    } catch (e) {
      this._lastSaveError = describeError(e);
      console.error('[growth-planner] 序列化数据失败', e);
      reportByRealtimeLog('serialize', this._lastSaveError);
      return false;
    }

    var firstError = null;
    var attempt;
    for (attempt = 0; attempt < 2; attempt += 1) {
      try {
        wx.setStorageSync(store.STORAGE_KEY, payload);
        this._lastSaveError = '';
        return true;
      } catch (e) {
        if (!firstError) firstError = e;
        console.error('[growth-planner] 保存本地数据失败（第 ' + (attempt + 1) + ' 次）', e);
      }
    }

    this._lastSaveError = describeError(firstError);
    reportByRealtimeLog('saveData', this._lastSaveError);
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
