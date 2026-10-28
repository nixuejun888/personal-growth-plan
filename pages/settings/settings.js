var store = require('../../utils/store');
var safePage = require("../../utils/safePage");
var app = getApp();

var LAST_ERROR_KEY = 'growthPlannerLastSaveError';

/** 时间戳 → 2026-10-28 12:30 文本。 */
function formatTime(timestamp) {
  try {
    var d = new Date(timestamp);
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  } catch (e) {
    return '';
  }
}

Page(safePage.wrapPage({
  data: {
    version: '1.3.3',
    schemaVersion: store.SCHEMA_VERSION,
    storageKey: store.STORAGE_KEY,
    stats: { goals: 0, skills: 0, reviews: 0, path: 0, actions: 0 },
    sizeText: '-',
    importText: '',
    importPreview: null,
    backups: [],
    lastSaveError: null,
    errorLog: []
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    var counts = store.countData(app.getData());
    var sizeText = '-';
    try {
      var info = wx.getStorageInfoSync();
      sizeText = info.currentSize + ' KB / ' + info.limitSize + ' KB';
    } catch (e) {
      console.error('[growth-planner] 读取存储信息失败', e);
    }
    this.setData({
      stats: counts,
      sizeText: sizeText,
      lastSaveError: this.readLastSaveError(),
      errorLog: safePage.getErrorLog(),
      backups: store.listBackups().map(function (item) {
        return {
          id: item.id,
          createdAt: item.createdAt,
          label: item.label || '自动备份',
          counts: item.counts
        };
      })
    });
  },

  /** 读取最近一次保存失败记录（本地缓存 + 当前运行期内存）。 */
  readLastSaveError: function () {
    try {
      var cached = wx.getStorageSync(LAST_ERROR_KEY);
      if (cached && cached.time) {
        return {
          timeText: formatTime(cached.time),
          detail: cached.detail || cached.message || '',
          stack: cached.stack || ''
        };
      }
    } catch (e) {
      console.error('[growth-planner] 读取保存失败记录异常', e);
    }
    var live = app.getLastSaveDetail ? app.getLastSaveDetail() : '';
    if (live) return { timeText: '刚刚（本次运行）', detail: live, stack: '' };
    return null;
  },

  onCopyLastError: function () {
    var current = this.data.lastSaveError;
    if (!current) return;
    var text = '时间：' + current.timeText + '\n原因：' + current.detail +
      (current.stack ? '\n堆栈：' + current.stack : '');
    wx.setClipboardData({
      data: text,
      success: function () {
        wx.showToast({ title: '已复制，请发给开发者', icon: 'none' });
      },
      fail: function () {
        wx.showToast({ title: '复制失败，请截图本页', icon: 'none' });
      }
    });
  },

  onClearLastError: function () {
    try {
      wx.removeStorageSync(LAST_ERROR_KEY);
    } catch (e) {
      console.error('[growth-planner] 清除保存失败记录异常', e);
    }
    this.setData({ lastSaveError: null });
    wx.showToast({ title: '已清除', icon: 'none' });
  },

  /* ---------------- 错误日志（页面异常，诊断用） ---------------- */

  onRefreshErrorLog: function () {
    this.setData({ errorLog: safePage.getErrorLog() });
    wx.showToast({ title: '已刷新', icon: 'none' });
  },

  onCopyErrorLog: function () {
    var list = safePage.getErrorLog();
    if (!list.length) {
      wx.showToast({ title: '暂无错误记录', icon: 'none' });
      return;
    }
    var lines = ['小程序版本：' + this.data.version, '错误记录（' + list.length + ' 条）：'];
    list.forEach(function (item, index) {
      lines.push('');
      lines.push((index + 1) + '. [' + item.time + '] ' + item.scope);
      lines.push('   原因：' + item.message);
      if (item.stack) lines.push('   堆栈：' + item.stack);
    });
    var text = lines.join('\n');
    wx.setClipboardData({
      data: text,
      success: function () {
        wx.showToast({ title: '已复制，请发给开发者', icon: 'none' });
      },
      fail: function () {
        wx.showToast({ title: '复制失败，请截图本页', icon: 'none' });
      }
    });
  },

  onClearErrorLog: function () {
    var self = this;
    wx.showModal({
      title: '清空错误日志？',
      content: '清空后无法恢复，不影响你的数据。',
      confirmText: '清空',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) return;
        safePage.clearErrorLog();
        self.setData({ errorLog: [] });
        wx.showToast({ title: '已清空', icon: 'none' });
      }
    });
  },

  /* ---------------- 导出 ---------------- */

  onExport: function () {
    var payload = store.buildExportPayload(app.getData());
    var text = JSON.stringify(payload, null, 2);
    var self = this;
    this._lastExportText = text;
    wx.setClipboardData({
      data: text,
      success: function () {
        wx.showModal({
          title: '已导出到剪贴板',
          content: '共 ' + text.length + ' 字符。可粘贴到「文件传输助手」或备忘录保存；恢复时粘贴回本页下方即可。',
          showCancel: false,
          confirmText: '好'
        });
      },
      fail: function (err) {
        console.error('[growth-planner] 剪贴板不可用，尝试写文件', err);
        self.exportToFile(text);
      }
    });
  },

  exportToFile: function (text) {
    try {
      var filePath = wx.env.USER_DATA_PATH + '/growth-plan-export.json';
      wx.getFileSystemManager().writeFileSync(filePath, text, 'utf8');
      wx.showModal({
        title: '已生成备份文件',
        content: '数据已写入：' + filePath,
        showCancel: false,
        confirmText: '好'
      });
    } catch (e) {
      console.error('[growth-planner] 写文件失败', e);
      wx.showToast({ title: '导出失败，请重试', icon: 'none' });
    }
  },

  /* ---------------- 导入 ---------------- */

  onImportInput: function (e) {
    this._pendingImport = null;
    this.setData({
      importText: e.detail.value,
      importPreview: null
    });
  },

  onValidateImport: function () {
    var text = (this.data.importText || '').trim();
    if (!text) {
      wx.showToast({ title: '请先粘贴导出的 JSON', icon: 'none' });
      return;
    }
    var result = store.parseImport(text);
    if (!result.ok) {
      wx.showToast({ title: result.error, icon: 'none' });
      return;
    }
    this._pendingImport = result;
    this.setData({ importPreview: result.counts });
    var self = this;
    var counts = result.counts;
    wx.showModal({
      title: '确认导入？',
      content: '将覆盖当前数据（导入：目标 ' + counts.goals + '、技能 ' + counts.skills +
        '、复盘 ' + counts.reviews + '、方向 ' + counts.path + '、行动 ' + counts.actions +
        '）。导入前会自动备份当前数据。',
      confirmText: '覆盖导入',
      cancelText: '取消',
      success: function (res) {
        if (res.confirm) self.applyImport();
      }
    });
  },

  applyImport: function () {
    var result = this._pendingImport;
    if (!result) {
      wx.showToast({ title: '请先校验导入内容', icon: 'none' });
      return;
    }
    var backup = store.saveBackup(app.getData(), '导入前自动备份');
    var saved = app.replaceData(result.data);
    if (!saved) {
      wx.showToast({ title: app.saveErrorText ? app.saveErrorText() : '保存失败，请重试', icon: 'none' });
      return;
    }
    this._pendingImport = null;
    this.setData({ importText: '', importPreview: null });
    this.refresh();
    wx.showToast({ title: backup ? '导入成功（已备份旧数据）' : '导入成功', icon: 'success' });
  },

  /* ---------------- 备份列表 ---------------- */

  onRefreshBackups: function () {
    this.refresh();
    wx.showToast({ title: '已刷新', icon: 'none' });
  },

  onRestoreBackup: function (e) {
    var id = e.currentTarget.dataset.id;
    var record = store.getBackup(id);
    if (!record) {
      wx.showToast({ title: '备份不存在或已删除', icon: 'none' });
      this.refresh();
      return;
    }
    var self = this;
    var counts = record.counts || store.countData(record.data);
    wx.showModal({
      title: '恢复这份备份？',
      content: '备份时间：' + record.createdAt + '（目标 ' + counts.goals + '、技能 ' + counts.skills +
        '、复盘 ' + counts.reviews + '）。当前数据会先自动备份，可再次恢复。',
      confirmText: '恢复',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) return;
        store.saveBackup(app.getData(), '恢复备份前自动备份');
        var saved = app.replaceData(record.data);
        if (!saved) {
          wx.showToast({ title: '恢复失败，请重试', icon: 'none' });
          return;
        }
        self.refresh();
        wx.showToast({ title: '已恢复', icon: 'success' });
      }
    });
  },

  onDeleteBackup: function (e) {
    var id = e.currentTarget.dataset.id;
    var self = this;
    wx.showModal({
      title: '删除这份备份？',
      content: '删除后无法恢复该备份。',
      confirmText: '删除',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) return;
        store.removeBackup(id);
        self.refresh();
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  }
}));