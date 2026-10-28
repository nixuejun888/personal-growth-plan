/**
 * 总览页（2026-10-26 重构为可读版本）
 * 数据全部来自 app.globalData 的只读快照，不直接改写数据。
 * 成长洞察：由 utils/insight.js 的规则引擎基于当前数据生成，点击可跳转对应页面。
 */
var safePage = require("../../utils/safePage");
var app = getApp();
var aiDB = require('../../utils/aiDB');
var insight = require('../../utils/insight');

var TERM_TEXT = { short: '短期', mid: '中期', long: '长期' };
var STATUS_TEXT = { pending: '待开始', progress: '进行中', done: '已完成' };
var MAX_INSIGHTS = 6;

Page(safePage.wrapPage({
  data: {
    stats: { totalSkills: 0, activeGoals: 0, completedGoals: 0, reviewCount: 0 },
    recentGoals: [],
    topSkills: [],
    insights: [],
    aiPanelOpen: false
  },

  onShow: function () {
    this.loadData();
  },

  loadData: function () {
    var data = app.getData();
    var goals = data.goals || [];
    var skills = data.skills || [];
    var reviews = data.reviews || [];

    var stats = {
      totalSkills: skills.length,
      // 未完成（待开始/进行中）都计入「进行中目标」，与用户直觉一致
      activeGoals: goals.filter(function (goal) { return goal.status !== 'done'; }).length,
      completedGoals: goals.filter(function (goal) { return goal.status === 'done'; }).length,
      reviewCount: reviews.length
    };

    var recentGoals = goals.filter(function (goal) {
      return goal.status !== 'done';
    }).slice(0, 3).map(function (goal) {
      return {
        id: goal.id,
        title: goal.title,
        term: goal.term,
        status: goal.status,
        progress: goal.progress,
        termText: TERM_TEXT[goal.term] || goal.term,
        statusText: STATUS_TEXT[goal.status] || goal.status
      };
    });

    var topSkills = skills.slice().sort(function (a, b) {
      return b.level - a.level;
    }).slice(0, 5);

    this.setData({
      stats: stats,
      recentGoals: recentGoals,
      topSkills: topSkills,
      insights: insight.buildInsights(data)
    });
  },

  /** 手动插入一条 AI 小建议：去重、限长，避免无限累积。 */
  generateInsight: function () {
    var pool = aiDB.overviewInsights || [];
    if (!pool.length) return;
    var picked = pool[Math.floor(Math.random() * pool.length)];
    var exists = this.data.insights.some(function (item) { return item.content === picked; });
    if (exists) {
      wx.showToast({ title: '已经给过类似建议啦', icon: 'none' });
      return;
    }
    var next = [{ type: 'ai', title: '✦ 参考建议', content: picked, action: '' }].concat(this.data.insights);
    this.setData({ insights: next.slice(0, MAX_INSIGHTS) });
  },

  /** 点击洞察条目跳转到对应页面。 */
  onInsightTap: function (event) {
    var action = event.currentTarget.dataset.action;
    if (!action) return;
    var routes = {
      goals: this.goToGoals,
      skills: this.goToSkills,
      review: this.goToReview,
      direction: this.goToDirection
    };
    var handler = routes[action];
    if (handler) handler.call(this);
  },

  openAiPanel: function () {
    this.setData({ aiPanelOpen: true });
  },

  closeAiPanel: function () {
    this.setData({ aiPanelOpen: false });
  },

  goToSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  goToSkills: function () {
    wx.switchTab({ url: '/pages/skills/skills' });
  },

  goToGoals: function () {
    wx.switchTab({ url: '/pages/goals/goals' });
  },

  /** 总览页的「添加目标」：跳到目标页并自动打开新建弹窗，少点一步。 */
  addGoal: function () {
    getApp()._pendingGoalAdd = true;
    wx.switchTab({ url: '/pages/goals/goals' });
  },

  goToReview: function () {
    wx.switchTab({ url: '/pages/review/review' });
  },

  goToDirection: function () {
    wx.switchTab({ url: '/pages/direction/direction' });
  }
}));