App({
    onLaunch: function() {
        this.globalData = {
            skills: [],
            goals: [],
            reviews: [],
            path: [],
            actions: [],
            vision: {}
        };
        var t = wx.getStorageSync("growthPlannerData");
        t && (this.globalData = t);
    },
    saveData: function() {
        wx.setStorageSync("growthPlannerData", this.globalData);
    },
    getData: function() {
        return this.globalData;
    },
    updateData: function(t, a) {
        this.globalData[t] = a, this.saveData();
    },
    getCurrentDate: function() {
        var t = new Date(), a = t.getFullYear(), n = String(t.getMonth() + 1).padStart(2, "0"), e = String(t.getDate()).padStart(2, "0");
        return "".concat(a, "-").concat(n, "-").concat(e);
    }
});