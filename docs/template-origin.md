# 官方模板来源

- 上游：[Shopify/shopify-app-template-react-router](https://github.com/Shopify/shopify-app-template-react-router)
- 导入版本：[`32c5115cd0b48c91eac18759a322dc98aadf92a6`](https://github.com/Shopify/shopify-app-template-react-router/tree/32c5115cd0b48c91eac18759a322dc98aadf92a6)
- 导入日期：2026-09-08。
- 上游许可证：[Shopify 模板 MIT 许可原文](../LICENSES/shopify-template-MIT.txt)，保留原始版权声明。

Shopify CLI 4.7.1 的创建命令同时要求创建或关联远端应用。为配合用户在 Dev Dashboard 手动创建，本次直接导入同一个官方 TypeScript 模板，再关联用户已有的应用。

保留官方认证入口、App Bridge、Polaris Web Components、Prisma 会话模型和生命周期 Webhook。移除了演示商品创建与价格修改操作及额外示例页面，首页改为初始化状态说明，不宣称业务功能已经可用。

保留本项目已有 README、AGENTS.md 和公开仓库忽略规则。没有导入上游维护团队的自动化机器人、CODEOWNERS、贡献者协议工作流和 AI 工具配置。

本项目适配项包括项目内 CLI、依赖锁文件、Node.js 22、中文开发说明、配置示例、按环境指定的会话数据库路径、Docker 构建起点和基础持续集成。

模板的导航标签在当前依赖类型中不可用，已改用官方 App Bridge `NavMenu`。为修复依赖审计结果，升级 TypeScript ESLint 工具，并对 Lodash、qs 和 deepmerge-ts 使用修复版本；Prisma 迁移、代码检查和构建已验证通过。没有使用自动强制降级依赖的修复方式。

应用采用自定义分发的 SDK 设置，并使用 `2026-07` API 版本。SDK 设置不代表 Dev Dashboard 的分发方式、应用安装和真实登录已经完成，需分别验收。
