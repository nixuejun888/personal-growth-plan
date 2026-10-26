/**
 * 数据层工具（2026-10-26 重构）
 *
 * 职责：
 *  1. 统一数据 schema：只保留业务字段，自动清洗历史脏数据（版本迁移）。
 *  2. 导出 / 导入（设置页使用），导入前校验格式并做数量统计。
 *  3. 本地备份列表：每次导入/恢复前自动备份当前数据，最多保留 5 份。
 *
 * 注意：本文件同时被 app.js 与页面 require，保持无副作用（不要在这里调用 getApp/wx）。
 */

var STORAGE_KEY = 'growthPlannerData';
var BACKUP_KEY = 'growthPlannerDataBackups';
var MAX_BACKUPS = 5;
var SCHEMA_VERSION = 2;
var APP_NAME = 'personal-growth-plan';

var TERM_VALUES = ['short', 'mid', 'long'];
var STATUS_VALUES = ['pending', 'progress', 'done'];

/* ---------------- 基础工具 ---------------- */

function isArray(value) {
  return Object.prototype.toString.call(value) === '[object Array]';
}

function isObject(value) {
  return !!value && typeof value === 'object' && !isArray(value);
}

function toStr(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function clampInt(value, fallback, min, max) {
  var n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** 生成不重复的业务 ID：时间戳 + 随机数，可读且按时间递增。 */
function genId() {
  return Date.now().toString() + Math.floor(Math.random() * 9000 + 1000).toString();
}

function pad2(n) {
  n = String(n);
  return n.length < 2 ? '0' + n : n;
}

/** 本地时间字符串：2026-10-26 16:30:00 */
function nowText() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

/* ---------------- 数据规范化 ---------------- */

function normalizeGoal(raw) {
  var item = isObject(raw) ? raw : {};
  var subtasks = [];
  if (isArray(item.subtasks)) {
    subtasks = item.subtasks.filter(function (s) {
      return isObject(s) && typeof s.text === 'string' && s.text.trim();
    }).map(function (s) {
      return { text: s.text, done: !!s.done };
    });
  }
  return {
    id: item.id ? String(item.id) : genId(),
    title: toStr(item.title, ''),
    term: TERM_VALUES.indexOf(item.term) >= 0 ? item.term : 'short',
    desc: toStr(item.desc, ''),
    progress: clampInt(item.progress, 0, 0, 100),
    status: STATUS_VALUES.indexOf(item.status) >= 0 ? item.status : 'pending',
    subtasks: subtasks
  };
}

function normalizeSkill(raw) {
  var item = isObject(raw) ? raw : {};
  return {
    id: item.id ? String(item.id) : genId(),
    name: toStr(item.name, ''),
    category: toStr(item.category, ''),
    level: clampInt(item.level, 50, 0, 100),
    note: toStr(item.note, '')
  };
}

function normalizeReview(raw) {
  var item = isObject(raw) ? raw : {};
  return {
    id: item.id ? String(item.id) : genId(),
    date: toStr(item.date, ''),
    achievement: toStr(item.achievement, ''),
    challenge: toStr(item.challenge, ''),
    learning: toStr(item.learning, ''),
    plan: toStr(item.plan, ''),
    score: clampInt(item.score, 7, 1, 10)
  };
}

function normalizePath(raw) {
  var item = isObject(raw) ? raw : {};
  return {
    title: toStr(item.title, ''),
    desc: toStr(item.desc, ''),
    current: !!item.current
  };
}

function normalizeAction(raw) {
  var item = isObject(raw) ? raw : {};
  return {
    id: item.id ? String(item.id) : genId(),
    title: toStr(item.title, ''),
    deadline: toStr(item.deadline, ''),
    goalId: toStr(item.goalId, ''),
    done: !!item.done
  };
}

function normalizeVision(raw) {
  var item = isObject(raw) ? raw : {};
  var years = [];
  var seen = {};
  if (isArray(item.years)) {
    item.years.forEach(function (entry) {
      if (!isObject(entry)) return;
      var year = clampInt(entry.year, 0, 1900, 2200);
      var text = toStr(entry.text, '').trim();
      if (!year || !text || seen[year]) return;
      seen[year] = true;
      years.push({ year: year, text: text });
    });
  } else {
    // 旧数据兼容：把固定的 1 年 / 3 年愿景迁移为「当前年份 + N」的分年愿景
    var base = new Date().getFullYear();
    var year1 = toStr(item.year1, '').trim();
    var year3 = toStr(item.year3, '').trim();
    if (year1) years.push({ year: base + 1, text: year1 });
    if (year3) years.push({ year: base + 3, text: year3 });
  }
  years.sort(function (a, b) {
    return a.year - b.year;
  });
  return {
    values: toStr(item.values, '').trim(),
    years: years
  };
}

function normalizeList(rawList, normalizer) {
  return (isArray(rawList) ? rawList : []).map(normalizer);
}

/** 把任意来源的数据整理成标准结构（旧数据迁移也走这里）。 */
function normalizeData(raw) {
  var data = isObject(raw) ? raw : {};
  return {
    skills: normalizeList(data.skills, normalizeSkill),
    goals: normalizeList(data.goals, normalizeGoal),
    reviews: normalizeList(data.reviews, normalizeReview),
    path: normalizeList(data.path, normalizePath),
    actions: normalizeList(data.actions, normalizeAction),
    vision: normalizeVision(data.vision)
  };
}

function emptyData() {
  return {
    skills: [],
    goals: [],
    reviews: [],
    path: [],
    actions: [],
    vision: { values: '', years: [] }
  };
}

/** 与 normalizeData 等价；语义上表示「可持久化的纯业务数据」。 */
function toPlainData(data) {
  return normalizeData(data);
}

/* ---------------- 统计 / 导出 / 导入 ---------------- */

function countData(data) {
  var d = isObject(data) ? data : {};
  return {
    goals: isArray(d.goals) ? d.goals.length : 0,
    skills: isArray(d.skills) ? d.skills.length : 0,
    reviews: isArray(d.reviews) ? d.reviews.length : 0,
    path: isArray(d.path) ? d.path.length : 0,
    actions: isArray(d.actions) ? d.actions.length : 0
  };
}

/** 组装导出文件内容（JSON 字符串由调用方序列化）。 */
function buildExportPayload(data) {
  var plain = normalizeData(data);
  return {
    app: APP_NAME,
    schema: SCHEMA_VERSION,
    exportedAt: nowText(),
    counts: countData(plain),
    data: plain
  };
}

/**
 * 解析导入文本。
 * 兼容两种格式：完整导出文件（含 app/schema/data）或裸数据对象 {goals,skills,...}。
 * @returns {{ok:boolean, error?:string, data?:Object, counts?:Object, exportedAt?:string}}
 */
function parseImport(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: '请粘贴要导入的 JSON 内容' };
  }
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'JSON 解析失败，请检查内容是否完整（可能被聊天工具截断）' };
  }
  if (!isObject(parsed)) {
    return { ok: false, error: '数据格式不对：应为一个 JSON 对象' };
  }
  var raw = isObject(parsed.data) ? parsed.data : parsed;
  var known = ['goals', 'skills', 'reviews', 'path', 'actions'];
  var recognized = known.some(function (key) {
    return isArray(raw[key]);
  }) || isObject(raw.vision);
  if (!recognized) {
    return { ok: false, error: '这不像是本小程序的数据（缺少 goals/skills/reviews 等字段）' };
  }
  var data = normalizeData(raw);
  return {
    ok: true,
    data: data,
    counts: countData(data),
    exportedAt: toStr(parsed.exportedAt, '')
  };
}

/* ---------------- 本地备份 ---------------- */

function readBackupList() {
  try {
    var list = wx.getStorageSync(BACKUP_KEY);
    if (!isArray(list)) return [];
    return list.filter(function (item) {
      return isObject(item) && item.id && isObject(item.data);
    });
  } catch (e) {
    console.error('[growth-planner] 读取备份失败', e);
    return [];
  }
}

function writeBackupList(list) {
  try {
    wx.setStorageSync(BACKUP_KEY, list);
    return true;
  } catch (e) {
    // 存储超限时丢掉最旧的一份再试一次
    console.error('[growth-planner] 写入备份失败，尝试清理旧备份', e);
    try {
      wx.setStorageSync(BACKUP_KEY, list.slice(0, 1));
      return true;
    } catch (e2) {
      console.error('[growth-planner] 备份写入失败', e2);
      return false;
    }
  }
}

/** 备份当前数据（导入/恢复覆盖前调用）。返回备份记录；失败返回 null。 */
function saveBackup(data, label) {
  var plain = normalizeData(data);
  var record = {
    id: genId(),
    createdAt: nowText(),
    label: toStr(label, '自动备份'),
    counts: countData(plain),
    data: plain
  };
  var list = readBackupList();
  list.unshift(record);
  return writeBackupList(list.slice(0, MAX_BACKUPS)) ? record : null;
}

function listBackups() {
  return readBackupList();
}

function getBackup(id) {
  var list = readBackupList();
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function removeBackup(id) {
  var list = readBackupList().filter(function (item) {
    return item.id !== id;
  });
  return writeBackupList(list);
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  BACKUP_KEY: BACKUP_KEY,
  SCHEMA_VERSION: SCHEMA_VERSION,
  APP_NAME: APP_NAME,
  genId: genId,
  nowText: nowText,
  normalizeGoal: normalizeGoal,
  normalizeSkill: normalizeSkill,
  normalizeReview: normalizeReview,
  normalizePath: normalizePath,
  normalizeAction: normalizeAction,
  normalizeVision: normalizeVision,
  normalizeData: normalizeData,
  emptyData: emptyData,
  toPlainData: toPlainData,
  countData: countData,
  buildExportPayload: buildExportPayload,
  parseImport: parseImport,
  saveBackup: saveBackup,
  listBackups: listBackups,
  getBackup: getBackup,
  removeBackup: removeBackup
};
