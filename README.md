# 个人成长规划系统（personal-growth-plan）

> 本目录是 2026-10-26 从**已发布的小程序代码包**（wxapkg v2，微信 PC 端缓存，上传时间 2026-06-10 17:09）反编译恢复出来的源码工程。
> 小程序 AppID：wx57607a802e684006。原始源码目录（D:\AI\Code\personal-growth-plan）已被删除且无备份。

## 恢复来源与可信度

| 文件 | 来源 | 可信度 |
| --- | --- | --- |
| app.js / pages/*/*.js / utils/aiDB.js | app-service.js 反编译（ES5 输出，逻辑与线上一致） | 逻辑一致，变量名为编译后短名 |
| app.wxss / pages/*/*.wxss | page-frame.html 中编译后的 CSS 还原 | 样式值一致，注释丢失，公共属性可能被合并 |
| pages/*/*.wxml | app-service.js 中 wcc 编译产物还原 | 结构与绑定一致，注释丢失、属性顺序变化 |
| app.json / pages/*/*.json | app-config.json 还原 | 一致 |
| images/*.png | 代码包原图 | 完全一致（原图） |
| @babel/runtime/helpers/* | 代码包内编译辅助函数 | 保留，供 require 使用 |

已知差异：恢复出的 WXML 中原本的注释（例如 `<!-- AI 引导 -->`）不存在；WXSS 中的注释也不存在；部分公共 CSS 属性被编译合并为组合选择器。这些不影响运行。

## 运行

用微信开发者工具「导入项目」，目录选本目录，AppID 填 wx57607a802e684006。
