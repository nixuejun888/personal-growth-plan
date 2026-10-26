# 源码恢复记录（2026-10-26）

## 结论

- 原目录 `D:\AI\Code\personal-growth-plan` 已被永久删除，回收站、盘扫描、git、编辑器历史均无完整备份。
- 已从**微信 PC 端缓存的「已发布代码包」**（AppID `wx57607a802e684006`，最后上传版本 v2：**2026-06-10 17:09**；前一版 v1：2026-04-29 16:31）中完整反编译出工程源码，并重新装配到原路径。
- 官方编译器验证：`wcc.exe` 编译 5 个页面 WXML 全部通过（exit 0），`wcsc.exe -lc` 检查全部 WXSS 通过（exit 0）。
- 运行时验证：Node 模拟 wx 环境执行 app 与 5 个页面的 onLoad/onShow，无异常（空数据首次启动场景）。
- 工程已初始化 git，首个提交 `chore: recover initial source from published package`。

## 这个项目是什么

一个纯本地存储的小程序（无云开发、无后端、无网络请求）：数据全部存在本机 storage，key 为 `growthPlannerData`；5 个 tab 页：总览 / 技能 / 目标 / 复盘 / 方向；所谓「AI 引导」是 `utils/aiDB.js` 内置的规则模板（技能等级描述、目标 SMART 提示、复盘提示等），**不调用任何 AI 接口**。

## 恢复链路（证据）

1. 微信开发者工具 `WeappLocalData` 的 `reduxPersist:projectList` 中留有项目卡片：名称 personal-growth-plan、路径 `D:\AI\Code\personal-growth-plan`、AppID wx57607a802e684006；`project` 设置里 libVersion 3.15.2、compileType weapp。
2. 原目录、回收站、全盘文件扫描均未找到源码；VS Code 本地历史（`%APPDATA%\Code\User\History`）只留下两个文件碎片：`app.wxss`（2026-04-23 11:07）和 `pages/goals/goals.wxml`（2026-04-30 17:21）——已另存到恢复资料目录作参考。
3. 微信 PC 端小程序缓存（`%APPDATA%\Tencent\xwechat\radium\users\<hash>\applet\packages\wx57607a802e684006\`）中存在两个版本的 `__APP__.wxapkg`：
   - v1：618672 B，时间 2026-04-29 16:31（4/29 上传的版本）
   - v2：618702 B，时间 2026-06-10 17:09（6/10 上传的版本，恢复基准）
4. wxapkg 为 PC 端加密格式（头 `V1MMWX`）：AES-256-CBC（key=PBKDF2-HMAC-SHA1(appid, "saltiest", 1000, 32)，iv="the iv: 16 bytes"）解密 1024 字节头，其余字节与 appid 倒数第 2 位字符 XOR。
5. 用 wxappUnpacker 反编译得到 app.js / app.json / 各页面 js+json+wxml+wxss / utils/aiDB.js / @babel/runtime helpers / 16 张 png；另外修复了：解包器绝对偏移兼容、app.json 缺 `"style": "v2"` 与最后一个 tab 项 `selectedIconData` 残留、tabBar 图标路径补齐。

## 可信度

| 内容 | 说明 |
| --- | --- |
| JS 业务逻辑 | 与线上版本一致（编译后 ES5，逻辑等价；变量名为编译短名） |
| WXML 结构/绑定 | 与线上一致（注释丢失、属性顺序不同） |
| WXSS 样式值 | 与线上一致（注释丢失、公共属性被合并为组合选择器） |
| app.json / 页面 json | 一致（已补 style v2） |
| 图片 | 原图 |
| @babel/runtime/helpers | 代码包自带，保留供 require |

## 版本线索（v1 → v2）

v1（4/29）与 v2（6/10）唯一差异在 `pages/goals/goals.wxml`：v2 在目标列表循环上补了 `wx:for-item="goal"`（+19 字节）。而 2026-04-30 的 VS Code 历史原件已经带该属性——说明这个小问题在 4/30 已修，v2 是修复后的版本。

## 局限

- 只能恢复到**最后一次上传（2026-06-10）**的代码。如果之后还在本地改过、但没有重新上传，那部分改动没有留存（请确认）。
- 手机端用户数据不在源码里，无法通过本恢复找回（数据在本机 storage，与代码包无关）。

## 维护

- 工作目录：`D:\AI\Code\personal-growth-plan`（微信开发者工具「导入项目」打开，AppID 填 wx57607a802e684006）。
- 备份：`D:\AI\Code\_backup\personal-growth-plan_2026-10-26.zip`；原始恢复证据在 `D:\AI\Code\personal-growth-plan_recovery\`。
- 修改后先在模拟器验证，再上传（上传需你本人微信登录开发者工具）。

## 后续修复（2026-10-26）

恢复出源码后，针对用户反馈的「数据保存 / 读取异常（保存不上、丢失、重复）」做了数据层 E2E 复现并修复了 4 类缺陷（复盘列表原地反转、取消编辑污染共享数据、展示字段写进 storage、总览进行中目标统计口径），另修复进度/状态不一致、quickAddGoal 竞态、Date.now 撞 ID 等问题，并给数据层加了规范化与迁移清洗。详见 [FIXES.md](FIXES.md)。

验证：wcc/wcsc 官方编译器通过；automator E2E 39/39 通过；测试数据已清空。

## 后续功能演进（2026-10-26）

- v1.2：数据导出/导入、本地备份（5 份）、删除撤销、未保存提醒、数据层模块化（`utils/store.js`）、页面 JS 可读化。
- v1.3：目标拆解步骤、分年愿景（旧 `vision.year1/year3` 自动迁移为 `vision.years`）、成长洞察引擎（`utils/insight.js`）。
- 全量 E2E 扩展到 113 项断言（5 个 automator 套件），全部通过。详见 [FIXES.md](FIXES.md) 与工程 `tests/e2e/`。
