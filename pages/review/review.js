var e = require("../../@babel/runtime/helpers/toConsumableArray"), t = require("../../@babel/runtime/helpers/objectSpread2"), a = require("../../@babel/runtime/helpers/defineProperty"), n = getApp(), i = require("../../utils/aiDB");

Page({
    data: {
        reviews: [],
        showModal: !1,
        formData: {
            date: "",
            achievement: "",
            challenge: "",
            learning: "",
            plan: "",
            score: 7
        },
        hints: {
            achievement: "",
            challenge: "",
            learning: "",
            plan: ""
        }
    },
    onShow: function() {
        this.loadReviews();
    },
    loadReviews: function() {
        /* 用 slice() 复制后再反转，避免 onShow 反复把全局数组原地倒序 */
        var e = (n.getData().reviews || []).slice().reverse();
        this.setData({
            reviews: e
        });
    },
    openAddModal: function() {
        var e = n.getCurrentDate();
        this._dirty = !1, this.setData({
            showModal: !0,
            formData: {
                date: e,
                achievement: "",
                challenge: "",
                learning: "",
                plan: "",
                score: 7
            },
            hints: {
                achievement: "",
                challenge: "",
                learning: "",
                plan: ""
            }
        });
    },
    closeModal: function() {
        var e = this;
        if (this.data.showModal && this._dirty) return void wx.showModal({
            title: "放弃编辑？",
            content: "当前修改还没有保存，关闭后会丢失。",
            confirmText: "放弃修改",
            cancelText: "继续编辑",
            success: function(t) {
                t.confirm && (e._dirty = !1, e.setData({
                    showModal: !1
                }));
            }
        });
        this._dirty = !1, this.setData({
            showModal: !1
        });
    },
    stopPropagation: function() {},
    onDateChange: function(e) {
        this._dirty = !0, this.setData({
            "formData.date": e.detail.value
        });
    },
    onAchievementInput: function(e) {
        this._dirty = !0, this.setData({
            "formData.achievement": e.detail.value
        });
    },
    onChallengeInput: function(e) {
        this._dirty = !0, this.setData({
            "formData.challenge": e.detail.value
        });
    },
    onLearningInput: function(e) {
        this._dirty = !0, this.setData({
            "formData.learning": e.detail.value
        });
    },
    onPlanInput: function(e) {
        this._dirty = !0, this.setData({
            "formData.plan": e.detail.value
        });
    },
    onScoreChange: function(e) {
        this._dirty = !0, this.setData({
            "formData.score": e.detail.value
        });
    },
    showHint: function(e) {
        var t = e.currentTarget.dataset.field, n = i.reviewQuestions[t], o = n[Math.floor(Math.random() * n.length)];
        this.setData(a({}, "hints.".concat(t), o));
    },
    saveReview: function() {
        var a = this.data.formData;
        if (!a.date) return void wx.showToast({
            title: "请选择复盘日期",
            icon: "none"
        });
        var i = {
            date: a.date,
            achievement: a.achievement,
            challenge: a.challenge,
            learning: a.learning,
            plan: a.plan,
            score: a.score,
            id: n.genId()
        }, o = n.getData(), s = [].concat(e(o.reviews || []), [ i ]);
        if (!n.updateData("reviews", s)) return void wx.showToast({
            title: n.saveErrorText ? n.saveErrorText() : "保存失败，请重试",
            icon: "none"
        });
        this._dirty = !1, this.loadReviews(), this.closeModal(), wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    },
    deleteReview: function(e) {
        var t = this, a = e.currentTarget.dataset.id, i = n.getData().reviews || [], s = i.findIndex(function(t) {
            return t.id === a;
        });
        if (s < 0) return void wx.showToast({
            title: "记录不存在，请刷新后重试",
            icon: "none"
        });
        var o = i[s], r = i.filter(function(t) {
            return t.id !== a;
        });
        if (!n.updateData("reviews", r)) return void wx.showToast({
            title: "删除失败，请重试",
            icon: "none"
        });
        this.loadReviews(), wx.showModal({
            title: "已删除复盘",
            content: "「".concat(o.date || "这条记录", "」已删除，可撤销。"),
            confirmText: "知道了",
            cancelText: "撤销",
            success: function(e) {
                if (e.cancel) {
                    var a = (n.getData().reviews || []).slice();
                    a.splice(s, 0, o), n.updateData("reviews", a) && (t.loadReviews(), wx.showToast({
                        title: "已撤销删除",
                        icon: "none"
                    }));
                }
            }
        });
    }
});
