# 个人成长规划系统（personal-growth-plan）

微信小程序源码工程。2026-10-26 从**已发布代码包**（AppID `wx57607a802e684006`，最后上传 2026-06-10）完整反编译恢复。

- 恢复过程、可信度说明、已知差异：见 [docs/RECOVERY.md](docs/RECOVERY.md)
- 运行：微信开发者工具 → 导入项目 → 选择本目录，AppID 填 `wx57607a802e684006`
- 数据全部存本机 storage（key `growthPlannerData`），无后端、无云开发、无网络请求
- 「AI 引导」是 `utils/aiDB.js` 里的内置规则模板，不是真的 AI 接口

## 首次使用前

```bash
git log --oneline          # 恢复提交已在
```
