var t = require("../../@babel/runtime/helpers/toConsumableArray");
var safePage = require("../../utils/safePage");

require("../../@babel/runtime/helpers/Arrayincludes");

var e = require("../../@babel/runtime/helpers/objectSpread2"), s = getApp(), a = require("../../utils/aiDB");

/* 深拷贝，避免弹窗表单与 globalData 共享子任务对象（取消编辑时污染数据） */
function cloneData(e) {
    return JSON.parse(JSON.stringify(e));
}

/* 剥离页面展示字段，只保留目标的业务字段后再写回全局数据 */
function plainGoal(e) {
    return {
        id: e.id,
        title: e.title,
        term: e.term,
        desc: e.desc || "",
        progress: e.progress || 0,
        status: e.status || "pending",
        subtasks: cloneData(e.subtasks || [])
    };
}

function plainGoals(e) {
    return (e || []).map(plainGoal);
}

/* 按步骤完成情况计算目标进度与状态：全部完成→done，有进展→progress，全未开始→pending */
function computeProgress(e) {
    var t = e || [], a = t.length;
    if (!a) return {
        progress: 0,
        status: "pending",
        done: 0,
        total: 0
    };
    var i = t.filter(function(t) {
        return t.done;
    }).length, n = Math.round(i / a * 100);
    return {
        progress: n,
        status: 100 === n ? "done" : n > 0 ? "progress" : "pending",
        done: i,
        total: a
    };
}

/* 一键拆解步骤：优先匹配内置模板，匹配不到时给通用模板 */
function buildStepTemplate(e) {
    for (var t = a.subtaskTemplates, i = e || "", n = null, s = Object.keys(t), o = 0; o < s.length; o++) {
        var r = s[o];
        if (i.includes(r) || r.includes(i)) {
            n = t[r];
            break;
        }
    }
    return (n || [ "调研和了解「".concat(i || "目标", "」的相关信息"), "制定详细的学习/执行计划", "执行第一阶段，完成基础内容", "中期检查，调整方向和节奏", "冲刺阶段，集中攻克难点", "总结复盘，输出成果" ]).map(function(t) {
        return {
            text: t,
            done: !1
        };
    });
}

Page(safePage.wrapPage({
    data: {
        goals: [],
        filteredGoals: [],
        filter: "",
        showModal: !1,
        isEdit: !1,
        editId: "",
        showStepsModal: !1,
        stepsGoalId: "",
        stepsGoalTitle: "",
        stepsForm: {
            subtasks: []
        },
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
        /* 从总览页点「添加目标」跳转过来时，自动打开新建弹窗 */
        if (s._pendingGoalAdd) {
            s._pendingGoalAdd = false;
            this.openAddModal();
        }
    },
    loadGoals: function() {
        var t = this, a = (s.getData().goals || []).map(function(s) {
            var a = s.subtasks || [];
            return e(e({}, s), {}, {
                termText: t.getTermText(s.term),
                statusText: t.getStatusText(s.status),
                subtaskTotal: a.length,
                subtaskDone: a.filter(function(t) {
                    return t.done;
                }).length
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
        var e = t.currentTarget.dataset, s = e.title, a = e.term, i = this.data.termOptions.findIndex(function(t) {
            return t.value === a;
        });
        /* 直接用一次 setData 填好表单，避免 setTimeout 延迟覆盖用户输入 */
        this.openAddModal(), this.setData({
            "formData.title": s,
            "formData.term": a,
            termIndex: i >= 0 ? i : 0
        }), this._dirty = !0;
    },
    openAddModal: function() {
        this._dirty = !1, this.setData({
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
            this._dirty = !1, this.setData({
                showModal: !0,
                isEdit: !0,
                editId: e,
                formData: {
                    title: s.title,
                    term: s.term,
                    desc: s.desc || "",
                    progress: s.progress,
                    status: s.status,
                    subtasks: cloneData(s.subtasks || [])
                },
                termIndex: a >= 0 ? a : 0,
                statusIndex: i >= 0 ? i : 0,
                showTitleSuggestions: !1,
                showDescFramework: !1
            });
        }
    },
    deleteGoal: function(t) {
        var e = this, a = t.currentTarget.dataset.id, i = plainGoals(this.data.goals), n = i.findIndex(function(t) {
            return t.id === a;
        });
        if (n < 0) return void wx.showToast({
            title: "目标不存在，请刷新后重试",
            icon: "none"
        });
        var o = i[n], r = i.filter(function(t) {
            return t.id !== a;
        });
        if (!s.updateData("goals", r)) return void wx.showToast({
            title: "删除失败，请重试",
            icon: "none"
        });
        this.loadGoals(), wx.showModal({
            title: "已删除目标",
            content: "「".concat(o.title, "」已删除，可撤销。"),
            confirmText: "知道了",
            cancelText: "撤销",
            success: function(t) {
                if (t.cancel) {
                    var a = plainGoals(e.data.goals);
                    a.splice(n, 0, o), s.updateData("goals", a) && (e.loadGoals(), wx.showToast({
                        title: "已撤销删除",
                        icon: "none"
                    }));
                }
            }
        });
    },
    openStepsModal: function(t) {
        var e = t.currentTarget.dataset.id, s = this.data.goals.find(function(t) {
            return t.id === e;
        });
        s && (this._dirty = !1, this.setData({
            showStepsModal: !0,
            stepsGoalId: e,
            stepsGoalTitle: s.title,
            stepsForm: {
                subtasks: cloneData(s.subtasks || [])
            }
        }));
    },
    closeStepsModal: function() {
        var t = this;
        if (this.data.showStepsModal && this._dirty) return void wx.showModal({
            title: "放弃编辑？",
            content: "步骤修改还没有保存，关闭后会丢失。",
            confirmText: "放弃修改",
            cancelText: "继续编辑",
            success: function(e) {
                e.confirm && (t._dirty = !1, t.setData({
                    showStepsModal: !1
                }));
            }
        });
        this._dirty = !1, this.setData({
            showStepsModal: !1
        });
    },
    addStep: function() {
        var e = [].concat(t(this.data.stepsForm.subtasks), [ {
            text: "",
            done: !1
        } ]);
        this._dirty = !0, this.setData({
            "stepsForm.subtasks": e
        });
    },
    removeStep: function(t) {
        var e = t.currentTarget.dataset.index, s = this.data.stepsForm.subtasks.filter(function(t, s) {
            return s !== e;
        });
        this._dirty = !0, this.setData({
            "stepsForm.subtasks": s
        });
    },
    onStepInput: function(t) {
        var e = t.currentTarget.dataset.index, s = t.detail.value, a = (this.data.stepsForm.subtasks || []).map(function(t, a) {
            return a === e ? {
                text: s,
                done: t.done
            } : t;
        });
        this._dirty = !0, this.setData({
            "stepsForm.subtasks": a
        });
    },
    toggleStepDone: function(t) {
        var e = t.currentTarget.dataset.index, s = this.data.stepsForm.subtasks.map(function(t, s) {
            return s === e ? {
                text: t.text,
                done: !t.done
            } : t;
        });
        this._dirty = !0, this.setData({
            "stepsForm.subtasks": s
        });
    },
    moveStep: function(t) {
        var e = t.currentTarget.dataset.index, s = parseInt(t.currentTarget.dataset.dir, 10), a = this.data.stepsForm.subtasks.slice(), i = e + s;
        if (!(i < 0 || i >= a.length)) {
            var n = a[e];
            a[e] = a[i], a[i] = n, this._dirty = !0, this.setData({
                "stepsForm.subtasks": a
            });
        }
    },
    generateSteps: function() {
        var t = this, e = buildStepTemplate(this.data.stepsGoalTitle), s = function() {
            t._dirty = !0, t.setData({
                "stepsForm.subtasks": e
            }), wx.showToast({
                title: "已生成步骤，可上下调整顺序",
                icon: "none"
            });
        };
        this.data.stepsForm.subtasks.length > 0 ? wx.showModal({
            title: "重新生成步骤？",
            content: "一键拆解会替换当前步骤列表，已有内容会被覆盖。",
            confirmText: "重新生成",
            cancelText: "取消",
            success: function(t) {
                t.confirm && s();
            }
        }) : s();
    },
    saveSteps: function() {
        var t = this.data.stepsGoalId, e = (this.data.stepsForm.subtasks || []).filter(function(t) {
            return t.text.trim();
        }).map(function(t) {
            return {
                text: t.text.trim(),
                done: !!t.done
            };
        }), a = plainGoals(this.data.goals), i = a.findIndex(function(e) {
            return e.id === t;
        });
        if (i < 0) return void wx.showToast({
            title: "目标不存在，请刷新后重试",
            icon: "none"
        });
        a[i].subtasks = e;
        var n = computeProgress(e);
        if (n && (a[i].progress = n.progress, a[i].status = n.status), !s.updateData("goals", a)) return void wx.showToast({
            title: s.saveErrorText ? s.saveErrorText() : "保存失败，请重试",
            icon: "none"
        });
        this._dirty = !1, this.loadGoals(), this.closeStepsModal(), wx.showToast({
            title: e.length ? "步骤已保存" : "已清空步骤",
            icon: "success"
        });
    },
    closeModal: function() {
        var t = this;
        if (this.data.showModal && this._dirty) return void wx.showModal({
            title: "放弃编辑？",
            content: "当前修改还没有保存，关闭后会丢失。",
            confirmText: "放弃修改",
            cancelText: "继续编辑",
            success: function(e) {
                e.confirm && (t._dirty = !1, t.setData({
                    showModal: !1
                }));
            }
        });
        this._dirty = !1, this.setData({
            showModal: !1
        });
    },
    stopPropagation: function() {},
    onTitleInput: function(t) {
        this._dirty = !0, this.setData({
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
        this._dirty = !0, this.setData({
            "formData.title": t.currentTarget.dataset.text,
            showTitleSuggestions: !1
        });
    },
    onTermChange: function(t) {
        var e = t.detail.value;
        this._dirty = !0, this.setData({
            termIndex: e,
            "formData.term": this.data.termOptions[e].value
        });
    },
    onDescInput: function(t) {
        this._dirty = !0, this.setData({
            "formData.desc": t.detail.value
        });
    },
    showDescHint: function() {
        this.setData({
            showDescFramework: !0
        });
    },
    fillDescTemplate: function() {
        this._dirty = !0, this.setData({
            "formData.desc": "【目标结果】\n\n\n【衡量标准】\n\n\n【关键路径】\n1. \n2. \n3. \n\n【预期收获】\n",
            showDescFramework: !1
        });
    },
    onProgressChange: function(t) {
        this._dirty = !0, this.setData({
            "formData.progress": t.detail.value
        });
    },
    onStatusChange: function(t) {
        var e = t.detail.value;
        this._dirty = !0, this.setData({
            statusIndex: e,
            "formData.status": this.data.statusOptions[e].value
        });
    },
    generateSubtasks: function() {
        this._dirty = !0, this.setData({
            "formData.subtasks": buildStepTemplate(this.data.formData.title)
        });
    },
    addSubtask: function() {
        var e = [].concat(t(this.data.formData.subtasks), [ {
            text: "",
            done: !1
        } ]);
        this._dirty = !0, this.setData({
            "formData.subtasks": e
        });
    },
    removeSubtask: function(t) {
        var e = t.currentTarget.dataset.index, s = this.data.formData.subtasks.filter(function(t, s) {
            return s !== e;
        });
        this._dirty = !0, this.setData({
            "formData.subtasks": s
        });
    },
    onSubtaskInput: function(e) {
        var s = e.currentTarget.dataset.index, a = e.detail.value, i = (this.data.formData.subtasks || []).map(function(t, e) {
            return e === s ? {
                text: a,
                done: t.done
            } : t;
        });
        this._dirty = !0, this.setData({
            "formData.subtasks": i
        });
    },
    toggleSubtask: function(e) {
        var a = e.currentTarget.dataset, i = a.goalId, n = a.subIndex, o = plainGoals(this.data.goals), r = o.find(function(t) {
            return t.id === i;
        });
        if (r && r.subtasks && r.subtasks[n]) {
            r.subtasks[n].done = !r.subtasks[n].done;
            var u = r.subtasks.filter(function(t) {
                return t.done;
            }).length;
            /* 进度为 0 时回到「待开始」，100 时标记「已完成」，其余为「进行中」 */
            r.progress = Math.round(u / r.subtasks.length * 100), 100 === r.progress ? r.status = "done" : r.progress > 0 ? r.status = "progress" : r.status = "pending", 
            s.updateData("goals", o), this.loadGoals();
        }
    },
    saveGoal: function() {
        var a = this.data, i = a.formData, n = a.isEdit, o = a.editId;
        if (!i.title.trim()) return void wx.showToast({
            title: "请输入目标名称",
            icon: "none"
        });
        var r = plainGoals(this.data.goals), u = plainGoal({
            title: i.title.trim(),
            term: i.term,
            desc: i.desc,
            progress: i.progress,
            status: i.status,
            subtasks: (i.subtasks || []).filter(function(t) {
                return t.text.trim();
            })
        });
        if (u.progress >= 100) u.status = "done";
        else if (u.progress > 0 && "pending" === u.status) u.status = "progress";
        if (n) {
            var l = r.findIndex(function(t) {
                return t.id === o;
            });
            if (l < 0) return void wx.showToast({
                title: "目标不存在，请刷新后重试",
                icon: "none"
            });
            r[l].subtasks && u.subtasks.length === r[l].subtasks.length && (u.subtasks = u.subtasks.map(function(t, e) {
                return {
                    text: t.text,
                    done: !!(r[l].subtasks[e] && r[l].subtasks[e].done)
                };
            })), r[l] = e(e({}, u), {}, {
                id: o
            });
        } else u.id = s.genId(), r.push(u);
        if (!s.updateData("goals", r)) return void wx.showToast({
            title: s.saveErrorText ? s.saveErrorText() : "保存失败，请重试",
            icon: "none",
            duration: 3000
        });
        this._dirty = !1, this.loadGoals(), this.closeModal(), wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    }
}));