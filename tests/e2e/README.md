# E2E 测试（miniprogram-automator）

基于微信开发者工具自动化端口，对数据层与页面交互做端到端验证。**测试脚本不参与小程序打包**（`project.config.json` 的 `packOptions.ignore` 已排除 `tests`）。

## 前置

```powershell
cd tests\e2e
npm install          # 安装 miniprogram-automator
```

启动带自动化端口的开发者工具（改过代码后建议每次用这条命令重启，确保重新编译）：

```powershell
$cli = 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat'
& $cli close
& $cli auto --project D:\AI\Code\personal-growth-plan --auto-port 9420 --disable-gpu
```

等工具项目窗口出现、模拟器加载完成后再跑测试（脚本连的是 `ws://127.0.0.1:9420`）。

## 套件

| 文件 | 覆盖 | 期望 |
| ---- | ---- | ---- |
| `baseline4.js` | v1.1 数据修复回归：目标/复盘/技能/总览/冷启动/旧数据迁移 | 39 PASS |
| `baseline5.js` | v1.2 设置页：导出 payload、覆盖导入校验、自动备份、备份上限 | 15 PASS |
| `baseline5b.js` | v1.2 页面交互：删除撤销、未保存提醒、导入后跳转、冷启动 | 23 PASS |
| `edge.js` | 边界：复盘未保存提醒、重复技能、筛选下撤销、进度 100→done、非法导入 | 12 PASS |
| `baseline6.js` | v1.3 新功能：步骤拆解全流程、分年愿景校验、洞察生成/去重/跳转 | 24 PASS |
| `tap_save.js` | 真实点击（element.tap）验证技能/目标保存按钮、总览「添加目标」直达弹窗 | 8 PASS |
| `check_errors.js` | v1.3.3 页面异常捕获：异常记录、用户可见提示、设置页展示与清空 | 8 PASS |

共 129 项断言。单个套件运行：

```powershell
node baseline4.js
```

## 注意

- 每个套件开头会清空模拟器数据并固定弹窗应答，可以单独跑；但**套件之间建议重启一次开发者工具**（自动化导航偶尔会在设置页停留后失效，属工具限制，不是小程序 bug）。
- 脚本内 `stubModal` 会替换 `wx.showModal`，所以套件依赖的确认框都是自动应答的；真实交互请手动验证。
- 日志里的 `RESULT pass=N fail=M` 为最终结果；退出码非 0 表示有失败。
