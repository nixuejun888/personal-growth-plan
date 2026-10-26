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
        var e = (n.getData().reviews || []).reverse();
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
        if (a.date) {
            var i = t(t({}, a), {}, {
                id: Date.now().toString()
            }), o = n.getData(), s = [].concat(e(o.reviews || []), [ i ]);
            n.updateData("reviews", s), this.loadReviews(), this.closeModal(), wx.showToast({
                title: "保存成功",
                icon: "success"
            });
        } else wx.showToast({
            title: "请选择复盘日期",
            icon: "none"
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