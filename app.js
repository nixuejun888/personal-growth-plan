/**
 * 小程序入口（2026-10-26 数据层重构）
 *
 * 数据流：页面只读写 globalData；所有持久化统一经过 utils/store.js 规范化，
 * 保证 storage 里只有业务字段，且旧版本脏数据在读取时自动清洗。
 */
var store = require('./utils/store');

App({
  onLaunch: function () {
    this.globalData = this.readData();
  },

  /** 从本地 storage 读取数据（失败/为空时返回空数据结构，并做一次规范化迁移）。 */
  readData: function () {
    try {
      var raw = wx.getStorageSync(store.STORAGE_KEY);
      return raw && typeof raw === 'object' ? store.normalizeData(raw) : store.emptyData();
    } catch (e) {
      console.error('[growth-planner] 读取本地数据失败', e);
      return store.emptyData();
    }
  },

  /** 全量保存：返回是否成功，便于页面做失败提示。 */
  saveData: function () {
    try {
      wx.setStorageSync(store.STORAGE_KEY, store.toPlainData(this.globalData));
      return true;
    } catch (e) {
      console.error('[growth-planner] 保存本地数据失败', e);
      return false;
    }
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
