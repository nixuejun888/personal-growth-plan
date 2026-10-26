# 数据问题修复与优化记录（2026-10-26）

> 本文记录本次「数据保存 / 读取异常（保存不上、丢失、重复）」的定位、修复与验证，以及后续优化建议。
> 工程为 2026-10-26 从已发布代码包反编译恢复，恢复说明见 [RECOVERY.md](RECOVERY.md)。

## 1. 问题定位

因为没有源码时的原始截图和描述只有「保存不上、丢失、重复」，本次用 `miniprogram-automator` 驱动微信开发者工具模拟器，对数据层做了端到端复现，确认**不是代码包/存储损坏，而是 4 个真实的数据逻辑缺陷**：

| # | 现象 | 根因 |
| - | ---- | ---- |
| 1 | 复盘记录看着「重复 / 顺序乱 / 像丢了一条」 | `review.js` 的 `loadReviews` 用 `(getData().reviews \|\| []).reverse()` **原地反转**全局数组；每次 `onShow` 都反转一次，写回 storage 的顺序被反复翻转 |
| 2 | 编辑目标/技能，改了子任务再点「取消」，内容却「保存上了」 | `editGoal` 把 `formData.subtasks` 直接指向 `globalData` 里的数组；`onSubtaskInput` 只是浅拷贝数组、改的仍是共享对象。取消只关弹窗，不还原数据 |
| 3 | 数据里混入 `termText/statusText/levelText`，越存越大，不同版本迁移易出错 | `loadGoals/loadSkills` 给内存副本加了「展示用字段」，而 `saveGoal/saveSkill/deleteGoal/deleteSkill/toggleSubtask` 把这些带展示字段的数组整体写回 storage |
| 4 | 总览「进行中目标」永远是 0 | 统计只数 `status === "progress"`；新建目标默认 `pending`，除非手动切状态，否则永远不计入 |

此外还发现并修复了 3 个较小问题：

- 进度与状态不一致：滑块拖到 100% 但状态还停在「待开始」；
- `quickAddGoal` 用 `setTimeout(100)` 回填表单，存在输入竞态；
- 新建记录 ID 用 `Date.now().toString()`，连续添加可能撞 ID。

## 2. 修复内容

### 2.1 数据层（`app.js`）
- 增加存储层规范化：`readData()` 读 storage → 与默认结构合并（缺字段补默认值）→ 旧数据自动清洗；`saveData()` 写前再规范一遍。
- 统一字段：目标 `id/title/term/desc/progress/status/subtasks`；技能 `id/name/category/level/note`；复盘 `id/date/achievement/challenge/learning/plan/score`；方向 `path/actions/vision`。
- 写入前剥离展示字段（`termText/statusText/levelText`），storage 永远只存业务数据。
- `updateData()` 返回保存结果；`saveData()` 用 `try/catch` 包裹 `wx.setStorageSync`。
- 新增 `genId()`：时间戳 + 随机串，避免同毫秒 ID 冲突。

### 2.2 页面
- `pages/goals/goals.js`
  - 编辑时深拷贝子任务数组，取消不再泄漏；子任务输入改为不可变更新；
  - 勾选子任务时用「纯数据副本」保存，并按进度自动回写状态：100% → 已完成、>0 → 进行中、0 → 待开始；
  - 保存时自动纠正状态：进度 ≥100 一律「已完成」，有进度不再停留在「待开始」；
  - 删除/保存都用纯净数据，ID 用 `genId()`。
- `pages/skills/skills.js`
  - 编辑表单不再携带 `levelText`；保存/删除写纯净数据；ID 用 `genId()`。
- `pages/review/review.js`
  - `loadReviews` 改为 `slice().reverse()`（不改原数组）；保存记录显式构造字段并用 `genId()`。
- `pages/overview/overview.js`
  - 「进行中目标」改为统计所有未完成目标（`status !== "done"`），新建目标即可见。
- `pages/direction/direction.js`
  - 原实现已是深拷贝、数据本就干净，未改动。

## 3. 验证

- **官方编译器**：`wcc.exe` 编译 5 个页面 WXML 全部通过（exit 0）；`wcsc.exe -lc` 全部 WXSS 通过（exit 0）。
- **Node 模拟 wx 冒烟**：app 与 5 个页面的 onLoad/onShow 在空数据首次启动场景无异常。
- **E2E（miniprogram-automator，39 项检查，全部 PASS）**：
  - 目标：新建保存、页面即时更新、storage 无展示字段、ID 为字符串、取消编辑不泄漏、编辑保存、勾选子任务（50%→进行中 / 0%→待开始）、ID 唯一、删除；
  - 复盘：连续保存顺序稳定，且「最新在前」不随 tab 切换变化；
  - 技能：快速添加/编辑保存、无 `levelText` 残留、ID 为字符串；
  - 总览：进行中/已完成/复盘次数统计正确；
  - 冷启动：重开小程序后目标/复盘/技能数据仍在且结构规范；
  - 迁移：旧版本带 `termText/statusText/levelText` 的脏数据在读取后被自动清洗且不丢记录。
- 修复完成后已清空模拟器里的自动化测试数据，当前为首次打开的空状态。

## 4. 后续优化建议（按性价比排序）

1. **加数据备份/导出（最优先）**
   当前所有数据只在本机 storage：换手机、卸载重装、清缓存 = 全部丢失。建议加「导出我的数据」（生成 JSON 复制到剪贴板/保存为文件）和「导入数据」两个入口；数据量很小，成本低收益高。
2. **云开发/云同步（可选）**
   如果你有多设备需求，可开通微信云开发，把 `growthPlannerData` 存云数据库并加简单登录态；不开通也不影响单机使用。
3. **组件化 + 可读命名**
   反编译出的变量名是编译短名（`e/t/s/a`），长期维护吃力。可把「目标卡片、技能卡片、复盘卡片」抽成自定义组件，并逐步重命名业务变量；配合现有 git 提交逐步改，风险低。
4. **回归测试固化**
   本次用的 automator 脚本在恢复资料目录 `D:\AI\Code\personal-growth-plan_recovery\`（automator 工作目录在 `D:\AI\DeepChat\recover\automator`，入口 `baseline4.js`）。建议把核心数据用例迁入工程 `tests/`，以后改完先跑一遍。
5. **列表性能**
   目标/技能/复盘多起来时 `loadGoals/loadSkills/loadReviews` 每次都全量 `setData`。数据量到几百条前问题不大；要优化可加分页/虚拟列表或只更新变化项。
6. **Git 远端备份**
   目前只有本机 git。建议推一份到 GitHub/Gitee 私有仓库，并保留每日 zip 备份（如 `D:\AI\Code\_backup\`）。
7. **体验细节**
   可加「删除后撤销」（toast 里给撤销按钮）、表单未保存离开提醒、数据版本号（`_schemaVersion`）便于以后迁移。

## 5. 日常开发速查

```powershell
# 微信开发者工具已知路径
$cli = 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat'

# 打开项目
& $cli open --project D:\AI\Code\personal-growth-plan

# 打开项目并开启自动化端口（改完代码后强制重新编译的最稳方式）
& $cli close
& $cli auto --project D:\AI\Code\personal-growth-plan --auto-port 9420

# E2E 回归（需先执行上面的 auto）
& 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' D:\AI\DeepChat\recover\automator\baseline4.js
```

> 注意：开发者工具对外部文件的改动**不会可靠地自动编译**。改完源码若模拟器行为没变，先 `cli close` 再 `cli auto ...` 重启一次（或手动点「编译」）。
