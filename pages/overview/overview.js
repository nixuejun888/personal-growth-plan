var t = require("../../@babel/runtime/helpers/toConsumableArray"), e = require("../../@babel/runtime/helpers/objectSpread2"), n = getApp(), s = require("../../utils/aiDB");

Page({
    data: {
        stats: {
            totalSkills: 0,
            activeGoals: 0,
            completedGoals: 0,
            reviewCount: 0
        },
        recentGoals: [],
        topSkills: [],
        insights: [],
        aiPanelOpen: !1
    },
    onShow: function() {
        this.loadData();
    },
    loadData: function() {
        var s = this, l = n.getData(), i = {
            totalSkills: l.skills ? l.skills.length : 0,
            /* 未完成（待开始/进行中）的目标都计入「进行中目标」，避免新建目标统计为 0 */
            activeGoals: l.goals ? l.goals.filter(function(t) {
                return "done" !== t.status;
            }).length : 0,
            completedGoals: l.goals ? l.goals.filter(function(t) {
                return "done" === t.status;
            }).length : 0,
            reviewCount: l.reviews ? l.reviews.length : 0
        }, a = (l.goals || []).filter(function(t) {
            return "done" !== t.status;
        }).slice(0, 3).map(function(t) {
            return e(e({}, t), {}, {
                termText: s.getTermText(t.term),
                statusText: s.getStatusText(t.status)
            });
        }), o = t(l.skills || []).sort(function(t, e) {
            return e.level - t.level;
        }).slice(0, 5), r = this.generateInsights(l);
        this.setData({
            stats: i,
            recentGoals: a,
            topSkills: o,
            insights: r
        });
    },
    getTermText: function(t) {
        return {
            short: "短期",
            mid: "中期",
            long: "长期"
        }[t] || t;
    },
    getStatusText: function(t) {
        return {
            pending: "待开始",
            progress: "进行中",
            done: "已完成"
        }[t] || t;
    },
    generateInsights: function(e) {
        var n = [];
        if (e.skills && e.skills.length > 0) {
            var s = Math.round(e.skills.reduce(function(t, e) {
                return t + e.level;
            }, 0) / e.skills.length), l = t(e.skills).sort(function(t, e) {
                return e.level - t.level;
            })[0], i = t(e.skills).sort(function(t, e) {
                return t.level - e.level;
            })[0];
            n.push({
                title: "📊 技能画像",
                content: "共 ".concat(e.skills.length, " 项技能，均值 ").concat(s, "%。最强：").concat(l.name, "（").concat(l.level, "%），待提升：").concat(i.name, "（").concat(i.level, "%）。").concat(s < 50 ? "建议选1-2项核心技能重点突破。" : "保持优势，持续深耕。")
            });
        }
        if (e.goals && e.goals.length > 0) {
            var a = e.goals.filter(function(t) {
                return "done" === t.status;
            }).length, o = Math.round(a / e.goals.length * 100);
            n.push({
                title: "🎯 目标达成",
                content: "".concat(e.goals.length, " 个目标中已完成 ").concat(a, " 个（").concat(o, "%）。").concat(o < 30 ? "建议聚焦短期目标，先拿到小胜利建立信心。" : o > 70 ? "完成率很高！可以挑战更有难度的目标了。" : "稳步推进中，注意定期检查进度。")
            });
        }
        if (e.reviews && e.reviews.length > 0) {
            var r = (e.reviews.reduce(function(t, e) {
                return t + parseInt(e.score);
            }, 0) / e.reviews.length).toFixed(1);
            n.push({
                title: "📝 复盘趋势",
                content: "已完成 ".concat(e.reviews.length, " 次复盘，均分 ").concat(r, "/10。").concat(e.reviews.length >= 4 ? "坚持得很好！建议每月对比一次复盘记录，发现成长趋势。" : "建议每周固定时间复盘，坚持4周以上就能形成习惯。")
            });
        }
        return 0 === n.length && n.push({
            title: "🚀 开始你的成长之旅",
            content: "点击顶部「AI 成长顾问」，让 AI 引导你完成第一步：盘点技能、设定目标、规划方向。"
        }), n;
    },
    generateInsight: function() {
        var e = {
            title: "✦ AI 建议",
            content: s.overviewInsights[Math.floor(Math.random() * s.overviewInsights.length)]
        };
        this.setData({
            insights: [ e ].concat(t(this.data.insights))
        });
    },
    openAiPanel: function() {
        this.setData({
            aiPanelOpen: !0
        });
    },
    closeAiPanel: function() {
        this.setData({
            aiPanelOpen: !1
        });
    },
    goToSkills: function() {
        wx.switchTab({
            url: "/pages/skills/skills"
        });
    },
    goToGoals: function() {
        wx.switchTab({
            url: "/pages/goals/goals"
        });
    },
    goToReview: function() {
        wx.switchTab({
            url: "/pages/review/review"
        });
    },
    goToDirection: function() {
        wx.switchTab({
            url: "/pages/direction/direction"
        });
    }
});