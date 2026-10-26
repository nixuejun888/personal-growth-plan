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
        this.setData({
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
        this.setData({
            showModal: !1
        });
    },
    stopPropagation: function() {},
    onDateChange: function(e) {
        this.setData({
            "formData.date": e.detail.value
        });
    },
    onAchievementInput: function(e) {
        this.setData({
            "formData.achievement": e.detail.value
        });
    },
    onChallengeInput: function(e) {
        this.setData({
            "formData.challenge": e.detail.value
        });
    },
    onLearningInput: function(e) {
        this.setData({
            "formData.learning": e.detail.value
        });
    },
    onPlanInput: function(e) {
        this.setData({
            "formData.plan": e.detail.value
        });
    },
    onScoreChange: function(e) {
        this.setData({
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
            title: "保存失败，请重试",
            icon: "none"
        });
        this.loadReviews(), this.closeModal(), wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    },
    deleteReview: function(e) {
        var t = this, a = e.currentTarget.dataset.id;
        wx.showModal({
            title: "确认删除",
            content: "确定要删除这条复盘记录吗？",
            success: function(e) {
                if (e.confirm) {
                    var i = (n.getData().reviews || []).filter(function(e) {
                        return e.id !== a;
                    });
                    n.updateData("reviews", i), t.loadReviews();
                }
            }
        });
    }
});