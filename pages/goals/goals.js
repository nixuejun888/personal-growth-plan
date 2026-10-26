var t = require("../../@babel/runtime/helpers/toConsumableArray");

require("../../@babel/runtime/helpers/Arrayincludes");

var e = require("../../@babel/runtime/helpers/objectSpread2"), s = getApp(), a = require("../../utils/aiDB");

Page({
    data: {
        goals: [],
        filteredGoals: [],
        filter: "",
        showModal: !1,
        isEdit: !1,
        editId: "",
        formData: {
            title: "",
            term: "short",
            desc: "",
            progress: 0,
            status: "pending",
            subtasks: []
        },
        termIndex: 0,
        termOptions: [ {
            value: "short",
            text: "短期（1-3个月）"
        }, {
            value: "mid",
            text: "中期（3-12个月）"
        }, {
            value: "long",
            text: "长期（1年以上）"
        } ],
        statusIndex: 0,
        statusOptions: [ {
            value: "pending",
            text: "待开始"
        }, {
            value: "progress",
            text: "进行中"
        }, {
            value: "done",
            text: "已完成"
        } ],
        showTitleSuggestions: !1,
        titleSuggestions: [],
        showDescFramework: !1,
        descFramework: a.goalDescFramework,
        goalChips: [ {
            text: "考取证书",
            title: "考取一个专业证书",
            term: "mid"
        }, {
            text: "学新技术",
            title: "掌握一门新技术栈",
            term: "short"
        }, {
            text: "做个项目",
            title: "完成一个个人项目",
            term: "short"
        }, {
            text: "职级晋升",
            title: "提升到下一个职级",
            term: "long"
        }, {
            text: "行业影响",
            title: "建立行业影响力",
            term: "long"
        }, {
            text: "深度阅读",
            title: "阅读20本专业书籍",
            term: "mid"
        }, {
            text: "英语提升",
            title: "英语达到流利水平",
            term: "mid"
        }, {
            text: "职业转型",
            title: "转行到新的领域",
            term: "long"
        } ]
    },
    onShow: function() {
        this.loadGoals();
    },
    loadGoals: function() {
        var t = this, a = (s.getData().goals || []).map(function(s) {
            return e(e({}, s), {}, {
                termText: t.getTermText(s.term),
                statusText: t.getStatusText(s.status)
            });
        });
        this.setData({
            goals: a
        }), this.filterGoals();
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
    setFilter: function(t) {
        this.setData({
            filter: t.currentTarget.dataset.filter
        }), this.filterGoals();
    },
    filterGoals: function() {
        var t = this.data, e = t.goals, s = t.filter, a = s ? e.filter(function(t) {
            return t.term === s;
        }) : e;
        this.setData({
            filteredGoals: a
        });
    },
    quickAddGoal: function(t) {
        var e = this, s = t.currentTarget.dataset, a = s.title, i = s.term;
        this.openAddModal(), setTimeout(function() {
            e.setData({
                "formData.title": a,
                termIndex: e.data.termOptions.findIndex(function(t) {
                    return t.value === i;
                })
            });
        }, 100);
    },
    openAddModal: function() {
        this.setData({
            showModal: !0,
            isEdit: !1,
            editId: "",
            formData: {
                title: "",
                term: "short",
                desc: "",
                progress: 0,
                status: "pending",
                subtasks: []
            },
            termIndex: 0,
            statusIndex: 0,
            showTitleSuggestions: !1,
            showDescFramework: !1
        });
    },
    editGoal: function(t) {
        var e = t.currentTarget.dataset.id, s = this.data.goals.find(function(t) {
            return t.id === e;
        });
        if (s) {
            var a = this.data.termOptions.findIndex(function(t) {
                return t.value === s.term;
            }), i = this.data.statusOptions.findIndex(function(t) {
                return t.value === s.status;
            });
            this.setData({
                showModal: !0,
                isEdit: !0,
                editId: e,
                formData: {
                    title: s.title,
                    term: s.term,
                    desc: s.desc || "",
                    progress: s.progress,
                    status: s.status,
                    subtasks: s.subtasks || []
                },
                termIndex: a >= 0 ? a : 0,
                statusIndex: i >= 0 ? i : 0,
                showTitleSuggestions: !1,
                showDescFramework: !1
            });
        }
    },
    deleteGoal: function(t) {
        var e = this, a = t.currentTarget.dataset.id;
        wx.showModal({
            title: "确认删除",
            content: "确定要删除这个目标吗？",
            success: function(t) {
                if (t.confirm) {
                    var i = e.data.goals.filter(function(t) {
                        return t.id !== a;
                    });
                    s.updateData("goals", i), e.loadGoals();
                }
            }
        });
    },
    closeModal: function() {
        this.setData({
            showModal: !1
        });
    },
    stopPropagation: function() {},
    onTitleInput: function(t) {
        this.setData({
            "formData.title": t.detail.value
        });
    },
    showTitleHint: function() {
        var t = this.data.formData.title;
        t ? this.setData({
            showTitleSuggestions: !0,
            titleSuggestions: [ "在3个月内".concat(t, "，达到可独立应用的水平"), "".concat(t, "，并产出一份可分享的学习报告"), "每周投入5小时，3个月后".concat(t) ]
        }) : this.setData({
            showTitleSuggestions: !0,
            titleSuggestions: [ "3个月内完成React Native项目上线", "Q2前通过PMP认证考试", "每周输出1篇技术博客，持续3个月" ]
        });
    },
    fillTitle: function(t) {
        this.setData({
            "formData.title": t.currentTarget.dataset.text,
            showTitleSuggestions: !1
        });
    },
    onTermChange: function(t) {
        var e = t.detail.value;
        this.setData({
            termIndex: e,
            "formData.term": this.data.termOptions[e].value
        });
    },
    onDescInput: function(t) {
        this.setData({
            "formData.desc": t.detail.value
        });
    },
    showDescHint: function() {
        this.setData({
            showDescFramework: !0
        });
    },
    fillDescTemplate: function() {
        this.setData({
            "formData.desc": "【目标结果】\n\n\n【衡量标准】\n\n\n【关键路径】\n1. \n2. \n3. \n\n【预期收获】\n",
            showDescFramework: !1
        });
    },
    onProgressChange: function(t) {
        this.setData({
            "formData.progress": t.detail.value
        });
    },
    onStatusChange: function(t) {
        var e = t.detail.value;
        this.setData({
            statusIndex: e,
            "formData.status": this.data.statusOptions[e].value
        });
    },
    generateSubtasks: function() {
        for (var t = this.data.formData.title, e = null, s = 0, i = Object.keys(a.subtaskTemplates); s < i.length; s++) {
            var n = i[s];
            if (t.includes(n) || n.includes(t)) {
                e = a.subtaskTemplates[n];
                break;
            }
        }
        e || (e = [ "调研和了解「".concat(t || "目标", "」的相关信息"), "制定详细的学习/执行计划", "执行第一阶段，完成基础内容", "中期检查，调整方向和节奏", "冲刺阶段，集中攻克难点", "总结复盘，输出成果" ]);
        var o = e.map(function(t) {
            return {
                text: t,
                done: !1
            };
        });
        this.setData({
            "formData.subtasks": o
        });
    },
    addSubtask: function() {
        var e = [].concat(t(this.data.formData.subtasks), [ {
            text: "",
            done: !1
        } ]);
        this.setData({
            "formData.subtasks": e
        });
    },
    removeSubtask: function(t) {
        var e = t.currentTarget.dataset.index, s = this.data.formData.subtasks.filter(function(t, s) {
            return s !== e;
        });
        this.setData({
            "formData.subtasks": s
        });
    },
    onSubtaskInput: function(e) {
        var s = e.currentTarget.dataset.index, a = t(this.data.formData.subtasks);
        a[s].text = e.detail.value, this.setData({
            "formData.subtasks": a
        });
    },
    toggleSubtask: function(e) {
        var a = e.currentTarget.dataset, i = a.goalId, n = a.subIndex, o = t(this.data.goals), r = o.find(function(t) {
            return t.id === i;
        });
        if (r && r.subtasks && r.subtasks[n]) {
            r.subtasks[n].done = !r.subtasks[n].done;
            var u = r.subtasks.filter(function(t) {
                return t.done;
            }).length;
            r.progress = Math.round(u / r.subtasks.length * 100), 100 === r.progress ? r.status = "done" : r.progress > 0 && (r.status = "progress"), 
            s.updateData("goals", o), this.loadGoals();
        }
    },
    saveGoal: function() {
        var a = this.data, i = a.formData, n = a.isEdit, o = a.editId;
        if (i.title.trim()) {
            var r = t(this.data.goals), u = e(e({}, i), {}, {
                subtasks: i.subtasks.filter(function(t) {
                    return t.text.trim();
                })
            });
            if (n) {
                var l = r.findIndex(function(t) {
                    return t.id === o;
                });
                l >= 0 && (r[l].subtasks && u.subtasks.length === r[l].subtasks.length && (u.subtasks = u.subtasks.map(function(t, s) {
                    var a;
                    return e(e({}, t), {}, {
                        done: (null === (a = r[l].subtasks[s]) || void 0 === a ? void 0 : a.done) || !1
                    });
                })), r[l] = e(e({}, u), {}, {
                    id: o
                }));
            } else r.push(e(e({}, u), {}, {
                id: Date.now().toString()
            }));
            s.updateData("goals", r), this.loadGoals(), this.closeModal(), wx.showToast({
                title: "保存成功",
                icon: "success"
            });
        } else wx.showToast({
            title: "请输入目标名称",
            icon: "none"
        });
    }
});