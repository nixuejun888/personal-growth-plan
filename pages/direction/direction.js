var t = require("../../@babel/runtime/helpers/defineProperty"), a = require("../../@babel/runtime/helpers/objectSpread2"), i = require("../../@babel/runtime/helpers/toConsumableArray"), e = getApp(), o = require("../../utils/aiDB");

Page({
    data: {
        path: [],
        actions: [],
        vision: {},
        showPathModal: !1,
        pathNodes: [],
        showActionModal: !1,
        actionForm: {
            title: "",
            deadline: "",
            goalId: ""
        },
        goalOptions: [ {
            id: "",
            title: "无"
        } ],
        goalIndex: 0,
        showVisionModal: !1,
        visionForm: {
            values: "",
            years: []
        },
        visionHints: [],
        visionValuesHint: ""
    },
    onShow: function() {
        this.loadData();
    },
    loadData: function() {
        var t = e.getData(), a = t.path || [], o = t.actions || [], n = t.vision || {}, s = [ {
            id: "",
            title: "无"
        } ].concat(i((t.goals || []).map(function(t) {
            return {
                id: t.id,
                title: t.title
            };
        })));
        this.setData({
            path: a,
            actions: o,
            vision: n,
            goalOptions: s
        });
    },
    openPathModal: function() {
        var t = this.data.path.length > 0 ? JSON.parse(JSON.stringify(this.data.path)) : [ {
            title: "",
            desc: "",
            current: !1
        }, {
            title: "",
            desc: "",
            current: !0
        }, {
            title: "",
            desc: "",
            current: !1
        } ];
        this._dirty = !1, this.setData({
            showPathModal: !0,
            pathNodes: t
        });
    },
    closePathModal: function() {
        var t = this;
        if (this.data.showPathModal && this._dirty) return void wx.showModal({
            title: "放弃编辑？",
            content: "路径修改还没有保存，关闭后会丢失。",
            confirmText: "放弃修改",
            cancelText: "继续编辑",
            success: function(a) {
                a.confirm && (t._dirty = !1, t.setData({
                    showPathModal: !1
                }));
            }
        });
        this._dirty = !1, this.setData({
            showPathModal: !1
        });
    },
    addPathNode: function() {
        var t = [].concat(i(this.data.pathNodes), [ {
            title: "",
            desc: "",
            current: !1
        } ]);
        this._dirty = !0, this.setData({
            pathNodes: t
        });
    },
    removePathNode: function(t) {
        var a = t.currentTarget.dataset.index, i = this.data.pathNodes.filter(function(t, i) {
            return i !== a;
        });
        this._dirty = !0, this.setData({
            pathNodes: i
        });
    },
    togglePathCurrent: function(t) {
        var i = t.currentTarget.dataset.index, e = this.data.pathNodes.map(function(t, e) {
            return a(a({}, t), {}, {
                current: e === i
            });
        });
        this._dirty = !0, this.setData({
            pathNodes: e
        });
    },
    onPathTitleInput: function(t) {
        var a = t.currentTarget.dataset.index, e = i(this.data.pathNodes);
        e[a].title = t.detail.value, this._dirty = !0, this.setData({
            pathNodes: e
        });
    },
    onPathDescInput: function(t) {
        var a = t.currentTarget.dataset.index, e = i(this.data.pathNodes);
        e[a].desc = t.detail.value, this._dirty = !0, this.setData({
            pathNodes: e
        });
    },
    savePath: function() {
        var t = this.data.pathNodes.filter(function(t) {
            return t.title.trim() || t.desc.trim();
        });
        if (!e.updateData("path", t)) return void wx.showToast({
            title: "保存失败，请重试",
            icon: "none"
        });
        this._dirty = !1, this.loadData(), this.closePathModal(), wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    },
    loadPathTemplate: function(t) {
        var a = t.currentTarget.dataset.type, i = o.pathTemplates[a];
        if (!i) return;
        var n = this, s = function() {
            var t = JSON.parse(JSON.stringify(i));
            if (!e.updateData("path", t)) return void wx.showToast({
                title: "保存失败，请重试",
                icon: "none"
            });
            n.loadData(), wx.showToast({
                title: "已加载路径模板",
                icon: "success"
            });
        }, l = (this.data.path || []).some(function(t) {
            return t.title || t.desc;
        });
        l ? wx.showModal({
            title: "覆盖当前路径？",
            content: "加载模板会替换你已填写的路径节点。",
            confirmText: "覆盖",
            cancelText: "取消",
            success: function(t) {
                t.confirm && s();
            }
        }) : s();
    },
    openActionModal: function() {
        this._dirty = !1, this.setData({
            showActionModal: !0,
            actionForm: {
                title: "",
                deadline: "",
                goalId: ""
            },
            goalIndex: 0
        });
    },
    closeActionModal: function() {
        var t = this;
        if (this.data.showActionModal && this._dirty) return void wx.showModal({
            title: "放弃编辑？",
            content: "行动项还没有保存，关闭后会丢失。",
            confirmText: "放弃修改",
            cancelText: "继续编辑",
            success: function(a) {
                a.confirm && (t._dirty = !1, t.setData({
                    showActionModal: !1
                }));
            }
        });
        this._dirty = !1, this.setData({
            showActionModal: !1
        });
    },
    onActionTitleInput: function(t) {
        this._dirty = !0, this.setData({
            "actionForm.title": t.detail.value
        });
    },
    onActionDeadlineChange: function(t) {
        this._dirty = !0, this.setData({
            "actionForm.deadline": t.detail.value
        });
    },
    onGoalChange: function(t) {
        var a = t.detail.value;
        this._dirty = !0, this.setData({
            goalIndex: a,
            "actionForm.goalId": this.data.goalOptions[a].id
        });
    },
    saveAction: function() {
        var t = this.data.actionForm;
        if (!t.title.trim()) return void wx.showToast({
            title: "请输入行动项",
            icon: "none"
        });
        var o = {
            title: t.title.trim(),
            deadline: t.deadline,
            goalId: t.goalId,
            id: e.genId(),
            done: !1
        }, n = e.getData(), s = [].concat(i(n.actions || []), [ o ]);
        if (!e.updateData("actions", s)) return void wx.showToast({
            title: "添加失败，请重试",
            icon: "none"
        });
        this._dirty = !1, this.loadData(), this.closeActionModal(), wx.showToast({
            title: "添加成功",
            icon: "success"
        });
    },
    toggleAction: function(t) {
        var i = t.currentTarget.dataset.id, o = (e.getData().actions || []).map(function(t) {
            return t.id === i ? a(a({}, t), {}, {
                done: !t.done
            }) : t;
        });
        e.updateData("actions", o), this.loadData();
    },
    deleteAction: function(t) {
        var a = this, i = t.currentTarget.dataset.id, o = e.getData().actions || [], n = o.findIndex(function(t) {
            return t.id === i;
        });
        if (n < 0) return void wx.showToast({
            title: "行动项不存在，请刷新后重试",
            icon: "none"
        });
        var s = o[n], l = o.filter(function(t) {
            return t.id !== i;
        });
        if (!e.updateData("actions", l)) return void wx.showToast({
            title: "删除失败，请重试",
            icon: "none"
        });
        this.loadData(), wx.showModal({
            title: "已删除行动项",
            content: "「".concat(s.title, "」已删除，可撤销。"),
            confirmText: "知道了",
            cancelText: "撤销",
            success: function(t) {
                if (t.cancel) {
                    var i = (e.getData().actions || []).slice();
                    i.splice(n, 0, s), e.updateData("actions", i) && (a.loadData(), wx.showToast({
                        title: "已撤销删除",
                        icon: "none"
                    }));
                }
            }
        });
    },
    openVisionModal: function() {
        var t = this.data.vision || {}, a = (t.years || []).length ? (t.years || []).map(function(t) {
            return {
                year: t.year,
                text: t.text || ""
            };
        }) : [ {
            year: new Date().getFullYear() + 1,
            text: ""
        } ];
        this._dirty = !1, this.setData({
            showVisionModal: !0,
            visionForm: {
                values: t.values || "",
                years: a
            },
            visionHints: a.map(function() {
                return "";
            }),
            visionValuesHint: ""
        });
    },
    closeVisionModal: function() {
        var t = this;
        if (this.data.showVisionModal && this._dirty) return void wx.showModal({
            title: "放弃编辑？",
            content: "愿景修改还没有保存，关闭后会丢失。",
            confirmText: "放弃修改",
            cancelText: "继续编辑",
            success: function(a) {
                a.confirm && (t._dirty = !1, t.setData({
                    showVisionModal: !1
                }));
            }
        });
        this._dirty = !1, this.setData({
            showVisionModal: !1
        });
    },
    onVisionValuesInput: function(t) {
        this._dirty = !0, this.setData({
            "visionForm.values": t.detail.value
        });
    },
    onVisionYearInput: function(t) {
        var a = t.currentTarget.dataset.index, e = parseInt(t.detail.value, 10);
        if (isNaN(e)) return;
        var s = this.data.visionForm.years.map(function(t, s) {
            return s === a ? {
                year: e,
                text: t.text
            } : t;
        });
        this._dirty = !0, this.setData({
            "visionForm.years": s
        });
    },
    onVisionYearTextInput: function(t) {
        var a = t.currentTarget.dataset.index, e = t.detail.value, s = this.data.visionForm.years.map(function(t, s) {
            return s === a ? {
                year: t.year,
                text: e
            } : t;
        });
        this._dirty = !0, this.setData({
            "visionForm.years": s
        });
    },
    addVisionYear: function() {
        var t = this.data.visionForm.years, a = t.length ? Math.max.apply(null, t.map(function(t) {
            return parseInt(t.year, 10) || 0;
        })) + 1 : new Date().getFullYear() + 1, e = [].concat(i(t), [ {
            year: a,
            text: ""
        } ]);
        this._dirty = !0, this.setData({
            "visionForm.years": e,
            visionHints: [].concat(i(this.data.visionHints), [ "" ])
        });
    },
    removeVisionYear: function(t) {
        var a = t.currentTarget.dataset.index, e = this.data.visionForm.years.filter(function(t, e) {
            return e !== a;
        }), s = this.data.visionHints.filter(function(t, e) {
            return e !== a;
        });
        this._dirty = !0, this.setData({
            "visionForm.years": e,
            visionHints: s
        });
    },
    showVisionHint: function(t) {
        var a = t.currentTarget.dataset.index, e = o.visionYearPrompts, s = e[Math.floor(Math.random() * e.length)],
            n = this.data.visionForm.years[a] && this.data.visionForm.years[a].year || new Date().getFullYear() + 1,
            l = {};
        l["visionHints.".concat(a)] = s.replace("{year}", n), this.setData(l);
    },
    showValuesHint: function() {
        var t = o.visionPrompts.values, a = t[Math.floor(Math.random() * t.length)];
        this.setData({
            visionValuesHint: a
        });
    },
    saveVision: function() {
        var t = this.data.visionForm, a = [], i = {}, n = 0, s = t.years || [];
        for (; n < s.length; n++) {
            var l = s[n], u = parseInt(l.year, 10), c = (l.text || "").trim();
            if (!c) continue;
            if (isNaN(u) || u < 1900 || u > 2200) return void wx.showToast({
                title: "愿景年份需在 1900-2200 之间",
                icon: "none"
            });
            if (i[u]) return void wx.showToast({
                title: "年份 " + u + " 重复了",
                icon: "none"
            });
            i[u] = !0, a.push({
                year: u,
                text: c
            });
        }
        a.sort(function(t, e) {
            return t.year - e.year;
        });
        var c = {
            values: (t.values || "").trim(),
            years: a
        };
        if (!e.updateData("vision", c)) return void wx.showToast({
            title: "保存失败，请重试",
            icon: "none"
        });
        this._dirty = !1, this.loadData(), this.closeVisionModal(), wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    },
    stopPropagation: function() {}
});