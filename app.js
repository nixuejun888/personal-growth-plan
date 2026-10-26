var STORAGE_KEY = "growthPlannerData";

var TERM_VALUES = [ "short", "mid", "long" ];

var STATUS_VALUES = [ "pending", "progress", "done" ];

function isArray(e) {
    return Object.prototype.toString.call(e) === "[object Array]";
}

function isObject(e) {
    return e && typeof e === "object" && !isArray(e);
}

function num(e, a, i) {
    var n = parseInt(e, 10);
    return isNaN(n) ? a : Math.max(i[0], Math.min(i[1], n));
}

function str(e, a) {
    return typeof e === "string" ? e : a;
}

function genId() {
    return Date.now().toString() + Math.floor(Math.random() * 900 + 100).toString();
}

/* ---------- 数据规范化：只保留业务字段，剔除页面展示字段（termText/statusText/levelText 等） ---------- */

function normalizeGoal(e) {
    var a = isObject(e) ? e : {}, i = [];
    isArray(a.subtasks) && (i = a.subtasks.filter(function(e) {
        return isObject(e) && typeof e.text === "string" && e.text.trim();
    }).map(function(e) {
        return {
            text: e.text,
            done: !!e.done
        };
    }));
    return {
        id: a.id ? String(a.id) : genId(),
        title: str(a.title, ""),
        term: TERM_VALUES.indexOf(a.term) >= 0 ? a.term : "short",
        desc: str(a.desc, ""),
        progress: num(a.progress, 0, [ 0, 100 ]),
        status: STATUS_VALUES.indexOf(a.status) >= 0 ? a.status : "pending",
        subtasks: i
    };
}

function normalizeSkill(e) {
    var a = isObject(e) ? e : {};
    return {
        id: a.id ? String(a.id) : genId(),
        name: str(a.name, ""),
        category: str(a.category, ""),
        level: num(a.level, 50, [ 0, 100 ]),
        note: str(a.note, "")
    };
}

function normalizeReview(e) {
    var a = isObject(e) ? e : {};
    return {
        id: a.id ? String(a.id) : genId(),
        date: str(a.date, ""),
        achievement: str(a.achievement, ""),
        challenge: str(a.challenge, ""),
        learning: str(a.learning, ""),
        plan: str(a.plan, ""),
        score: num(a.score, 7, [ 1, 10 ])
    };
}

function normalizePath(e) {
    var a = isObject(e) ? e : {};
    return {
        title: str(a.title, ""),
        desc: str(a.desc, ""),
        current: !!a.current
    };
}

function normalizeAction(e) {
    var a = isObject(e) ? e : {};
    return {
        id: a.id ? String(a.id) : genId(),
        title: str(a.title, ""),
        deadline: str(a.deadline, ""),
        goalId: str(a.goalId, ""),
        done: !!a.done
    };
}

function normalizeVision(e) {
    var a = isObject(e) ? e : {};
    return {
        year1: str(a.year1, ""),
        year3: str(a.year3, ""),
        values: str(a.values, "")
    };
}

function normalizeList(e, normalizer) {
    return (isArray(e) ? e : []).map(normalizer);
}

function emptyData() {
    return {
        skills: [],
        goals: [],
        reviews: [],
        path: [],
        actions: [],
        vision: normalizeVision({})
    };
}

/* 把 globalData 整理成可持久化的纯数据（同时用于读取旧数据） */
function toPlainData(e) {
    var a = isObject(e) ? e : {};
    return {
        skills: normalizeList(a.skills, normalizeSkill),
        goals: normalizeList(a.goals, normalizeGoal),
        reviews: normalizeList(a.reviews, normalizeReview),
        path: normalizeList(a.path, normalizePath),
        actions: normalizeList(a.actions, normalizeAction),
        vision: normalizeVision(a.vision)
    };
}

App({
    onLaunch: function() {
        this.globalData = this.readData();
    },
    readData: function() {
        var e = emptyData();
        try {
            var a = wx.getStorageSync(STORAGE_KEY);
            isObject(a) && (e = toPlainData(a));
        } catch (t) {
            console.error("[growth-planner] 读取本地数据失败", t);
        }
        return e;
    },
    /* 写入前统一规范化，避免把 termText/statusText/levelText 等展示字段写进 storage */
    saveData: function() {
        try {
            return wx.setStorageSync(STORAGE_KEY, toPlainData(this.globalData)), true;
        } catch (e) {
            return console.error("[growth-planner] 保存本地数据失败", e), false;
        }
    },
    getData: function() {
        return this.globalData;
    },
    updateData: function(e, a) {
        return this.globalData[e] = a, this.saveData();
    },
    genId: function() {
        return genId();
    },
    getCurrentDate: function() {
        var e = new Date(), a = e.getFullYear(), t = String(e.getMonth() + 1).padStart(2, "0"), i = String(e.getDate()).padStart(2, "0");
        return "".concat(a, "-").concat(t, "-").concat(i);
    }
});
