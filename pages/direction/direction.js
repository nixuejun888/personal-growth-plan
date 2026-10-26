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
            year1: "",
            year3: "",
            values: ""
        },
        visionHints: {
            year1: "",
            year3: "",
            values: ""
        }
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
        this.setData({
            showPathModal: !0,
            pathNodes: t
        });
    },
    closePathModal: function() {
        this.setData({
            showPathModal: !1
        });
    },
    addPathNode: function() {
        var t = [].concat(i(this.data.pathNodes), [ {
            title: "",
            desc: "",
            current: !1
        } ]);
        this.setData({
            pathNodes: t
        });
    },
    removePathNode: function(t) {
        var a = t.currentTarget.dataset.index, i = this.data.pathNodes.filter(function(t, i) {
            return i !== a;
        });
        this.setData({
            pathNodes: i
        });
    },
    togglePathCurrent: function(t) {
        var i = t.currentTarget.dataset.index, e = this.data.pathNodes.map(function(t, e) {
            return a(a({}, t), {}, {
                current: e === i
            });
        });
        this.setData({
            pathNodes: e
        });
    },
    onPathTitleInput: function(t) {
        var a = t.currentTarget.dataset.index, e = i(this.data.pathNodes);
        e[a].title = t.detail.value, this.setData({
            pathNodes: e
        });
    },
    onPathDescInput: function(t) {
        var a = t.currentTarget.dataset.index, e = i(this.data.pathNodes);
        e[a].desc = t.detail.value, this.setData({
            pathNodes: e
        });
    },
    savePath: function() {
        var t = this.data.pathNodes.filter(function(t) {
            return t.title.trim() || t.desc.trim();
        });
        e.updateData("path", t), this.loadData(), this.closePathModal(), wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    },
    loadPathTemplate: function(t) {
        var a = t.currentTarget.dataset.type, i = o.pathTemplates[a];
        if (i) {
            var n = JSON.parse(JSON.stringify(i));
            e.updateData("path", n), this.loadData(), wx.showToast({
                title: "已加载路径模板",
                icon: "success"
            });
        }
    },
    openActionModal: function() {
        this.setData({
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
        this.setData({
            showActionModal: !1
        });
    },
    onActionTitleInput: function(t) {
        this.setData({
            "actionForm.title": t.detail.value
        });
    },
    onActionDeadlineChange: function(t) {
        this.setData({
            "actionForm.deadline": t.detail.value
        });
    },
    onGoalChange: function(t) {
        var a = t.detail.value;
        this.setData({
            goalIndex: a,
            "actionForm.goalId": this.data.goalOptions[a].id
        });
    },
    saveAction: function() {
        var t = this.data.actionForm;
        if (t.title.trim()) {
            var o = a(a({}, t), {}, {
                id: Date.now().toString(),
                done: !1
            }), n = e.getData(), s = [].concat(i(n.actions || []), [ o ]);
            e.updateData("actions", s), this.loadData(), this.closeActionModal(), wx.showToast({
                title: "添加成功",
                icon: "success"
            });
        } else wx.showToast({
            title: "请输入行动项",
            icon: "none"
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
        var a = this, i = t.currentTarget.dataset.id;
        wx.showModal({
            title: "确认删除",
            content: "确定要删除这个行动计划吗？",
            success: function(t) {
                if (t.confirm) {
                    var o = (e.getData().actions || []).filter(function(t) {
                        return t.id !== i;
                    });
                    e.updateData("actions", o), a.loadData();
                }
            }
        });
    },
    openVisionModal: function() {
        var t = this.data.vision || {};
        this.setData({
            showVisionModal: !0,
            visionForm: {
                year1: t.year1 || "",
                year3: t.year3 || "",
                values: t.values || ""
            },
            visionHints: {
                year1: "",
                year3: "",
                values: ""
            }
        });
    },
    closeVisionModal: function() {
        this.setData({
            showVisionModal: !1
        });
    },
    onVisionYear1Input: function(t) {
        this.setData({
            "visionForm.year1": t.detail.value
        });
    },
    onVisionYear3Input: function(t) {
        this.setData({
            "visionForm.year3": t.detail.value
        });
    },
    onVisionValuesInput: function(t) {
        this.setData({
            "visionForm.values": t.detail.value
        });
    },
    showVisionHint: function(a) {
        var i = a.currentTarget.dataset.field, e = o.visionPrompts[i], n = e[Math.floor(Math.random() * e.length)];
        this.setData(t({}, "visionHints.".concat(i), n));
    },
    saveVision: function() {
        e.updateData("vision", this.data.visionForm), this.loadData(), this.closeVisionModal(), 
        wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    },
    stopPropagation: function() {}
});