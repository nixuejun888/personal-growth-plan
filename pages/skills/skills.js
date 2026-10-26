var t = require("../../@babel/runtime/helpers/toConsumableArray"), e = require("../../@babel/runtime/helpers/objectSpread2"), a = getApp(), i = require("../../utils/aiDB");

/* 只保留技能的业务字段，避免把 levelText 等展示字段写回全局数据 */
function plainSkill(e) {
    return {
        id: e.id,
        name: e.name,
        category: e.category,
        level: e.level || 0,
        note: e.note || ""
    };
}

function plainSkills(e) {
    return (e || []).map(plainSkill);
}

Page({
    data: {
        skills: [],
        filteredSkills: [],
        filter: "",
        showModal: !1,
        isEdit: !1,
        editId: "",
        formData: {
            name: "",
            category: "",
            level: 50,
            note: ""
        },
        categoryIndex: 0,
        categories: [ "技术", "软技能", "语言", "管理", "其他" ],
        levelHint: "",
        showNoteSuggestions: !1,
        noteSuggestions: [],
        skillChips: [ {
            name: "沟通表达",
            category: "软技能"
        }, {
            name: "项目管理",
            category: "管理"
        }, {
            name: "Python",
            category: "技术"
        }, {
            name: "数据分析",
            category: "技术"
        }, {
            name: "英语",
            category: "语言"
        }, {
            name: "团队协作",
            category: "软技能"
        }, {
            name: "产品思维",
            category: "软技能"
        }, {
            name: "演讲演示",
            category: "软技能"
        }, {
            name: "JavaScript",
            category: "技术"
        }, {
            name: "SQL",
            category: "技术"
        }, {
            name: "设计思维",
            category: "软技能"
        }, {
            name: "写作",
            category: "软技能"
        } ]
    },
    onShow: function() {
        this.loadSkills();
    },
    loadSkills: function() {
        var t = this, i = (a.getData().skills || []).map(function(a) {
            return e(e({}, a), {}, {
                levelText: t.getLevelText(a.level)
            });
        });
        this.setData({
            skills: i
        }), this.filterSkills();
    },
    getLevelText: function(t) {
        return t <= 20 ? "入门" : t <= 40 ? "初级" : t <= 60 ? "中级" : t <= 80 ? "高级" : "专家";
    },
    setFilter: function(t) {
        this.setData({
            filter: t.currentTarget.dataset.filter
        }), this.filterSkills();
    },
    filterSkills: function() {
        var t = this.data, e = t.skills, a = t.filter, i = a ? e.filter(function(t) {
            return t.category === a;
        }) : e;
        this.setData({
            filteredSkills: i
        });
    },
    quickAddSkill: function(e) {
        var i = e.currentTarget.dataset, s = i.name, o = i.category;
        if (this.data.skills.find(function(t) {
            return t.name === s;
        })) wx.showToast({
            title: "".concat(s, " 已在列表中"),
            icon: "none"
        }); else {
            var l = {
                id: a.genId(),
                name: s,
                category: o,
                level: 30,
                note: ""
            }, n = plainSkills(this.data.skills);
            n.push(l), a.updateData("skills", n), this.loadSkills(), wx.showToast({
                title: "已添加 ".concat(s),
                icon: "success"
            });
        }
    },
    openAddModal: function() {
        this.setData({
            showModal: !0,
            isEdit: !1,
            editId: "",
            formData: {
                name: "",
                category: "",
                level: 50,
                note: ""
            },
            categoryIndex: 0,
            showNoteSuggestions: !1
        }), this.updateLevelHint(50);
    },
    editSkill: function(t) {
        var a = t.currentTarget.dataset.id, i = this.data.skills.find(function(t) {
            return t.id === a;
        });
        if (i) {
            var s = this.data.categories.indexOf(i.category);
            this.setData({
                showModal: !0,
                isEdit: !0,
                editId: a,
                formData: {
                    name: i.name,
                    category: i.category,
                    level: i.level,
                    note: i.note || ""
                },
                categoryIndex: s >= 0 ? s : 0,
                showNoteSuggestions: !1
            }), this.updateLevelHint(i.level);
        }
    },
    deleteSkill: function(t) {
        var e = this, i = t.currentTarget.dataset.id;
        wx.showModal({
            title: "确认删除",
            content: "确定要删除这个技能吗？",
            success: function(t) {
                if (t.confirm) {
                    var s = plainSkills(e.data.skills).filter(function(t) {
                        return t.id !== i;
                    });
                    a.updateData("skills", s), e.loadSkills();
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
    onNameInput: function(t) {
        this.setData({
            "formData.name": t.detail.value
        });
    },
    onCategoryChange: function(t) {
        var e = t.detail.value;
        this.setData({
            categoryIndex: e,
            "formData.category": this.data.categories[e]
        });
    },
    onLevelChange: function(t) {
        var e = t.detail.value;
        this.setData({
            "formData.level": e
        }), this.updateLevelHint(e);
    },
    updateLevelHint: function(t) {
        var e = "";
        e = t <= 20 ? i.skillLevels["0-20"] : t <= 40 ? i.skillLevels["21-40"] : t <= 60 ? i.skillLevels["41-60"] : t <= 80 ? i.skillLevels["61-80"] : i.skillLevels["81-100"], 
        this.setData({
            levelHint: e
        });
    },
    onNoteInput: function(t) {
        this.setData({
            "formData.note": t.detail.value
        });
    },
    showNoteHint: function() {
        var t = this.data.formData.category || "技术", e = i.skillNoteTemplates[t] || i.skillNoteTemplates["技术"];
        this.setData({
            showNoteSuggestions: !0,
            noteSuggestions: e
        });
    },
    fillNote: function(t) {
        this.setData({
            "formData.note": t.currentTarget.dataset.text,
            showNoteSuggestions: !1
        });
    },
    saveSkill: function() {
        var i = this.data, s = i.formData, o = i.isEdit, l = i.editId;
        if (!s.name.trim()) return void wx.showToast({
            title: "请输入技能名称",
            icon: "none"
        });
        if (!s.category) return void wx.showToast({
            title: "请选择技能分类",
            icon: "none"
        });
        var n = plainSkills(this.data.skills), r = plainSkill(s);
        if (o) {
            var u = n.findIndex(function(t) {
                return t.id === l;
            });
            if (u < 0) return void wx.showToast({
                title: "技能不存在，请刷新后重试",
                icon: "none"
            });
            r.id = l, n[u] = r;
        } else r.id = a.genId(), n.push(r);
        if (!a.updateData("skills", n)) return void wx.showToast({
            title: "保存失败，请重试",
            icon: "none"
        });
        this.loadSkills(), this.closeModal(), wx.showToast({
            title: "保存成功",
            icon: "success"
        });
    }
});