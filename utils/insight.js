/**
 * 成长洞察引擎（本地规则，无需联网）
 *
 * buildInsights(data) 基于当前数据生成一组可读、可执行的洞察，
 * 返回 [{ type, title, content, action }]，action 用于在总览页跳转对应页面：
 *   'goals' | 'skills' | 'review' | 'direction' | ''
 *
 * 设计目标：
 *  1. 有数据时给出「统计 + 一句建议」，避免只罗列数字；
 *  2. 数据不足时也给出引导性洞察（而不是空白卡片）；
 *  3. 纯函数、无 wx / getApp 依赖，方便单测与在其它页面复用。
 */

var DAY_MS = 24 * 60 * 60 * 1000;
var MAX_INSIGHTS = 6;
var ACTION_TEXT = {
  goals: '去目标页',
  skills: '去技能页',
  review: '去复盘页',
  direction: '去方向页'
};

function isArray(value) {
  return Object.prototype.toString.call(value) === '[object Array]';
}

function num(value) {
  var n = Number(value);
  return isFinite(n) ? n : 0;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round(part / total * 100);
}

/** 解析 'YYYY-MM-DD'（不依赖各端 Date 字符串解析差异）。 */
function parseDate(text) {
  if (typeof text !== 'string') return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function dayStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 该日期所在自然周的周一 00:00 时间戳，用于计算连续复盘周数。 */
function weekStart(d) {
  var offset = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
}

function skillInsight(skills) {
  var levels = skills.map(function (skill) { return num(skill.level); });
  var sum = levels.reduce(function (total, level) { return total + level; }, 0);
  var avg = Math.round(sum / levels.length);
  var sorted = skills.slice().sort(function (a, b) { return num(b.level) - num(a.level); });
  var strongest = sorted[0];
  var weakest = sorted[sorted.length - 1];
  var lowCount = levels.filter(function (level) { return level < 40; }).length;
  var suggestion;
  if (avg < 50) {
    suggestion = '整体熟练度偏低，建议选 1-2 项核心技能集中突破，比平均用力更有效。';
  } else if (lowCount > 0) {
    suggestion = '有 ' + lowCount + ' 项技能在 40% 以下，可以作为下一阶段的重点补强。';
  } else {
    suggestion = '整体水平不错，保持优势，同时关注技能之间的组合效应。';
  }
  return {
    type: 'skills',
    title: '📊 技能画像',
    content: '共 ' + skills.length + ' 项技能，均值 ' + avg + '%；最强：' + strongest.name +
      '（' + num(strongest.level) + '%），待提升：' + weakest.name + '（' + num(weakest.level) + '%）。' + suggestion,
    action: 'skills'
  };
}

function goalInsight(goals) {
  var done = goals.filter(function (goal) { return goal.status === 'done'; }).length;
  var rate = pct(done, goals.length);
  var progresses = goals.map(function (goal) { return num(goal.progress); });
  var avgProgress = Math.round(progresses.reduce(function (total, value) { return total + value; }, 0) / goals.length);
  var terms = { short: 0, mid: 0, long: 0 };
  goals.forEach(function (goal) { if (terms[goal.term] !== undefined) terms[goal.term]++; });
  var suggestion;
  if (rate === 100) {
    suggestion = '所有目标都已完成，可以挑战更高难度的目标了。';
  } else if (rate < 34) {
    suggestion = '目标偏多或难度偏高，建议先聚焦 1-2 个短期目标，拿到小胜利建立信心。';
  } else {
    suggestion = '稳步推进中，建议每周检查一次进度，避免目标停在 80% 附近。';
  }
  return {
    type: 'goals',
    title: '🎯 目标达成',
    content: '共 ' + goals.length + ' 个目标（短期 ' + terms.short + ' / 中期 ' + terms.mid + ' / 长期 ' + terms.long +
      '）；已完成 ' + done + ' 个（' + rate + '%），平均进度 ' + avgProgress + '%。' + suggestion,
    action: 'goals'
  };
}

function stepInsight(goals) {
  var noSteps = goals.filter(function (goal) {
    return goal.status !== 'done' && (!isArray(goal.subtasks) || goal.subtasks.length === 0);
  }).length;
  var notStarted = goals.filter(function (goal) {
    return goal.status !== 'done' && isArray(goal.subtasks) && goal.subtasks.length > 0 && num(goal.progress) === 0;
  }).length;
  var content;
  if (noSteps > 0 && notStarted > 0) {
    content = '有 ' + noSteps + ' 个目标还没拆分步骤，另有 ' + notStarted + ' 个目标拆了步骤但还没开始。' +
      '建议先挑一个目标做「拆解步骤」，从第一步开始推进。';
  } else if (noSteps > 0) {
    content = '有 ' + noSteps + ' 个目标还没拆分步骤。大目标容易拖延，试着把它拆成 3-6 个可勾选的小步骤。';
  } else if (notStarted > 0) {
    content = '有 ' + notStarted + ' 个目标已经拆好步骤，但进度还是 0%。今天先完成第一步，让进度动起来。';
  } else {
    content = '所有目标都已完成步骤拆解，保持按步骤推进的节奏。完成后记得定期复盘，沉淀经验。';
  }
  return {
    type: 'goals',
    title: '🧩 目标拆解',
    content: content,
    action: 'goals'
  };
}

function reviewInsight(reviews) {
  var dates = [];
  var scoreSum = 0;
  reviews.forEach(function (review) {
    var d = parseDate(review.date);
    if (d) dates.push(d);
    scoreSum += num(review.score);
  });
  var avgScore = (scoreSum / reviews.length).toFixed(1);
  var today = dayStart(new Date());
  var lastDays = null;
  var streak = 0;
  if (dates.length) {
    dates.sort(function (a, b) { return b.getTime() - a.getTime(); });
    lastDays = Math.max(0, Math.round((today - dayStart(dates[0])) / DAY_MS));
    var weeks = [];
    var seen = {};
    dates.forEach(function (d) {
      var key = weekStart(d);
      if (!seen[key]) {
        seen[key] = true;
        weeks.push(key);
      }
    });
    weeks.sort(function (a, b) { return b - a; });
    streak = 1;
    for (var i = 1; i < weeks.length; i++) {
      if (weeks[i - 1] - weeks[i] === 7 * DAY_MS) streak++;
      else break;
    }
  }
  var suggestion;
  if (lastDays !== null && lastDays > 14) {
    suggestion = '已经 ' + lastDays + ' 天没有复盘了，建议今晚花 10 分钟做一次，把最近的经验写下来。';
  } else if (streak >= 4) {
    suggestion = '已经连续 ' + streak + ' 周复盘，节奏很稳，建议每月做一次月度对比，看见自己的成长曲线。';
  } else {
    suggestion = '建议每周固定一个时间复盘（比如周日晚上），坚持 4 周以上就能形成习惯。';
  }
  var content = '已完成 ' + reviews.length + ' 次复盘，均分 ' + avgScore + '/10';
  if (lastDays !== null) content += '；最近一次在 ' + lastDays + ' 天前';
  if (streak > 1) content += '，连续复盘 ' + streak + ' 周';
  return {
    type: 'review',
    title: '📝 复盘节奏',
    content: content + '。' + suggestion,
    action: 'review'
  };
}

function actionInsight(actions) {
  var done = actions.filter(function (action) { return action.done; }).length;
  var today = new Date();
  var todayKey = today.getFullYear() + '-' + (today.getMonth() < 9 ? '0' : '') + (today.getMonth() + 1) +
    '-' + (today.getDate() < 10 ? '0' : '') + today.getDate();
  var overdue = actions.filter(function (action) {
    return !action.done && action.deadline && /^\d{4}-\d{2}-\d{2}$/.test(action.deadline) && action.deadline < todayKey;
  }).length;
  var suggestion;
  if (overdue > 0) {
    suggestion = '有 ' + overdue + ' 项行动计划已过截止日期，建议今天先清理掉，恢复执行节奏。';
  } else if (pct(done, actions.length) < 30) {
    suggestion = '行动计划完成率偏低，可以把行动拆得更小，先从 10 分钟能完成的动作开始。';
  } else {
    suggestion = '行动计划在稳步推进，完成一项就及时勾选，保持正反馈。';
  }
  return {
    type: 'direction',
    title: '📋 行动力',
    content: '共 ' + actions.length + ' 项行动计划，已完成 ' + done + ' 项（' + pct(done, actions.length) + '%）' +
      (overdue > 0 ? '，其中 ' + overdue + ' 项已逾期' : '') + '。' + suggestion,
    action: 'direction'
  };
}

function directionInsight(path, vision) {
  var years = isArray(vision.years) ? vision.years : [];
  var values = vision.values || '';
  var current = null;
  (path || []).forEach(function (node) { if (node.current) current = node; });
  var parts = [];
  if (years.length) {
    parts.push('分年愿景已规划 ' + years.length + ' 个年份（' + years.map(function (item) { return item.year; }).join('、') + '）');
  }
  if (values) parts.push('核心价值观已填写');
  if (path.length) {
    parts.push('发展路径 ' + path.length + ' 个阶段' + (current ? '，当前处于「' + current.title + '」' : ''));
  }
  var suggestion;
  if (years.length < 2) {
    suggestion = '建议补齐多个年份的愿景（比如 1 年、3 年、5 年），让长期方向和年度目标对齐。';
  } else if (!current) {
    suggestion = '建议在发展路径中标记「当前所处阶段」，这样更容易判断下一步该往哪走。';
  } else {
    suggestion = '方向清晰，记得每季度回看一次愿景，环境变化时及时调整。';
  }
  return {
    type: 'direction',
    title: '🧭 愿景与方向',
    content: (parts.length ? parts.join('；') + '。' : '还没有填写愿景和发展路径。') + suggestion,
    action: 'direction'
  };
}

/** 本周聚焦：从所有洞察里挑一件最值得先做的事。 */
function focusInsight(data, metrics) {
  var focus;
  if (metrics.overdue > 0) {
    focus = { content: '先清理 ' + metrics.overdue + ' 项逾期的行动计划，把节奏找回来。', action: 'direction' };
  } else if (metrics.goalCount === 0) {
    focus = { content: '设定一个 1-3 个月的短期目标，让成长有明确的起点。', action: 'goals' };
  } else if (metrics.noStepGoals > 0) {
    focus = { content: '挑一个目标点「拆解步骤」，把它拆成 3-6 个可勾选的小步骤。', action: 'goals' };
  } else if (metrics.lastReviewDays === null || metrics.lastReviewDays > 14) {
    focus = { content: '安排一次 10 分钟复盘，记录最近的进展、卡点和下一步计划。', action: 'review' };
  } else if (metrics.skillCount < 3) {
    focus = { content: '补充技能盘点（至少 3 项），让洞察更准确地发现你的优势和短板。', action: 'skills' };
  } else if (metrics.visionYears < 2) {
    focus = { content: '补充分年愿景，把「想去哪里」写清楚，行动会更有方向。', action: 'direction' };
  } else {
    focus = { content: '整体节奏不错，今天挑一个进度最快的目标，完成它的下一步。', action: 'goals' };
  }
  return {
    type: 'focus',
    title: '✦ 本周聚焦',
    content: focus.content,
    action: focus.action
  };
}

/**
 * @param {Object} data 已规范化的业务数据（goals/skills/reviews/actions/path/vision）
 * @returns {Array<{type:string,title:string,content:string,action:string}>}
 */
function buildInsights(data) {
  var source = data || {};
  var goals = isArray(source.goals) ? source.goals : [];
  var skills = isArray(source.skills) ? source.skills : [];
  var reviews = isArray(source.reviews) ? source.reviews : [];
  var actions = isArray(source.actions) ? source.actions : [];
  var path = isArray(source.path) ? source.path : [];
  var vision = source.vision && typeof source.vision === 'object' ? source.vision : {};
  var insights = [];

  if (goals.length) insights.push(goalInsight(goals));
  if (goals.length) insights.push(stepInsight(goals));
  if (skills.length) insights.push(skillInsight(skills));
  if (reviews.length) insights.push(reviewInsight(reviews));
  if (actions.length) insights.push(actionInsight(actions));
  if ((vision.years && vision.years.length) || vision.values || path.length) {
    insights.push(directionInsight(path, vision));
  }

  if (!insights.length) {
    insights.push({
      type: 'focus',
      title: '🚀 开始你的成长之旅',
      content: '先做第一步：盘点 1-3 项技能、设定一个短期目标，或者写下你对未来的愿景。',
      action: 'skills'
    });
  }

  // 计算「本周聚焦」所需的指标
  var overdue = 0;
  var today = new Date();
  var todayKey = today.getFullYear() + '-' + (today.getMonth() < 9 ? '0' : '') + (today.getMonth() + 1) +
    '-' + (today.getDate() < 10 ? '0' : '') + today.getDate();
  actions.forEach(function (action) {
    if (!action.done && action.deadline && /^\d{4}-\d{2}-\d{2}$/.test(action.deadline) && action.deadline < todayKey) overdue++;
  });
  var lastReviewDays = null;
  if (reviews.length) {
    var latest = null;
    reviews.forEach(function (review) {
      var d = parseDate(review.date);
      if (d && (!latest || d.getTime() > latest.getTime())) latest = d;
    });
    if (latest) lastReviewDays = Math.max(0, Math.round((dayStart(today) - dayStart(latest)) / DAY_MS));
  }
  var noStepGoals = goals.filter(function (goal) {
    return goal.status !== 'done' && (!isArray(goal.subtasks) || goal.subtasks.length === 0);
  }).length;

  insights.unshift(focusInsight(source, {
    overdue: overdue,
    goalCount: goals.length,
    noStepGoals: noStepGoals,
    lastReviewDays: lastReviewDays,
    skillCount: skills.length,
    visionYears: (vision.years && vision.years.length) || 0
  }));

  return insights.slice(0, MAX_INSIGHTS);
}

module.exports = {
  buildInsights: buildInsights,
  ACTION_TEXT: ACTION_TEXT
};
