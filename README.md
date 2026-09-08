# UMX Configurator App

UMX 自研 Shopify 配置器管理 App，独立于店铺主题与客户配置器维护。目标是在 Shopify 后台集中管理模块模型、分类、用户可见范围和渠道价格，并向配置器提供经过服务端身份校验的目录与价格接口。

**当前状态：应用框架检查通过，已完成店铺安装及首次嵌入式登录验证，可以开始业务功能开发。** 使用 Shopify 官方 React Router + TypeScript 模板，包含 Shopify 登录、嵌入式页面、Prisma 会话存储和生命周期 Webhook 处理入口。用户安装后，浏览器已在 Shopify 后台的应用页面显示“配置器管理”首页。模型、分类、渠道价格和客户身份接口尚未实现，PVE 尚未部署。详见 [本次验证记录](docs/scaffold-validation-20260908.md)。

应用显示名称：`Configurator Dashboard`。模板来源与许可证见 [模板来源](docs/template-origin.md)。

## 项目分工

| 项目 | 职责 |
| --- | --- |
| [umx-module-configurator](https://github.com/umx-system/umx-module-configurator) | Shopify 主题、客户使用的配置器、2D / 3D 展示、读取 App 接口 |
| 本仓库 `umx-configurator-app` | Shopify 后台管理页面、模型与分类管理、渠道价格、服务端身份校验、持久化与部署配置 |
| Shopify | 客户登录、商品、SKU、库存、订单与结账 |

App 和配置器通过接口连接，分别开发、部署和回退。后续接入 App 时，在配置器仓库建立功能分支。

## 需求范围

以下是启动讨论整理出的功能范围，均待实现；实现顺序和具体技术方案在后续开发时确认。

| 功能 | 预期能力 |
| --- | --- |
| 模型管理 | 上传 GLB、预览模型、上传或生成缩略图、管理模型版本 |
| 模块参数 | 配置尺寸、占格、颜色、放置位置、承托与堆叠规则 |
| 分类管理 | 维护模块分类及排序 |
| 展示与购买范围 | 分别设置零售客户、企业客户、内部员工可见与可购买的模块 |
| 渠道价格 | 管理零售价、企业价、内部价，支持币种和待报价状态 |
| 发布管理 | 保存草稿、预览、发布目录、回退版本 |
| 商品关联 | 关联 Shopify 商品、规格、SKU 与库存 |

首期建议优先完成模型上传、分类、三类用户展示、渠道价管理和发布预览，再迁移现有模块并验证渠道价格的真实结账流程。迁移前核对模型、参数和商品映射；缺失价格不自行补写。

已有模块类型可以复用配置规则；新增特殊机械动作或交互仍可能需要配置器开发。

## 用户分类与权限

沿用现有 Shopify 客户标签约定，标签按小写完整名称匹配：

| 客户状态 | 分类 | 展示版本 |
| --- | --- | --- |
| 未登录，或没有 `tob` / `nb` 标签 | `consumer` | To C 零售版 |
| 有 `tob` 标签且没有 `nb` 标签 | `business` | To B 企业版 |
| 有 `nb` 标签 | `internal` | 内部员工版 |

优先级为 `nb` > `tob` > 默认零售。前端分类只用于展示和按需加载，不能作为授权依据。后端必须核验可信身份，只返回当前客户有权查看的模型目录、价格和操作权限；后台管理访问也需独立核验 Shopify 员工会话与权限。

**渠道显示价与 Shopify 成交价必须一致。** 不能依赖浏览器提交任意金额改变结账价格。采用何种客户目录、价格表、折扣或报价订单方案，需要结合店铺套餐与业务流程确定并完成真实结账验证。

## 部署方向

计划在 PVE 的独立虚拟机中通过 Docker 运行 App，由 Cloudflare Tunnel 提供公网 HTTPS 入口。此处描述目标方案，不代表已部署。

- App 服务和数据库在后端运行；PVE 管理界面保留在内网。
- 公开模型与缩略图优先使用 Shopify 文件存储或对象存储/CDN；大文件上传考虑直传。
- 限制访问的模型需另行设计存储访问策略，不能仅靠前端隐藏下载链接。
- 身份、专属价格及其他客户专属接口不得被共享缓存；公开资源可以缓存。
- 后端不可用时，专属权限核验失败应阻止对应受限操作，并明确提示用户。
- 正式部署前确定持久化、备份、恢复和健康检查方案。

## 开发流程

1. 阅读本文件和 [AGENTS.md](AGENTS.md)，确认当前任务的范围。
2. 从 `main` 建立 `codex/功能名称` 分支；只修改当前任务相关文件。
3. 先本地实现和验证，再进行 Shopify 开发环境及 PVE 部署验收。按下方命令操作，记录每一步实际结果。
4. 每次完成代码修改都执行 `git commit`，使用中文说明变动和验证结果；只提交本次任务文件。
5. 推送分支后通过 Pull Request 说明问题、修改结果、验证证据和未完成项。

本仓库为公开仓库。只提交代码、文档和不含真实值的配置示例；密钥、店铺令牌、客户数据、真实渠道价格、模型原始资产、数据库备份和运行日志不提交到 Git。

## 本地开发

使用 Node.js 22 LTS（本项目 `.nvmrc` 固定为 `22.22.0`）。Shopify CLI `4.7.1` 安装在项目内，无需全局安装。

```sh
nvm use
npm ci
cp .env.example .env
npm run setup
npm run check
```

只有第一次初始化且不存在 `.env` 时才复制示例文件，避免覆盖已有凭据。`setup` 生成 Prisma 客户端并创建本地 SQLite 会话数据库；`check` 依次执行代码规范、类型检查和生产构建，不会创建 Shopify App 或修改店铺数据。

用户已在 Dev Dashboard 创建应用。关联时选择这个现有应用，不能重复创建：

```sh
npm run config:link -- --client-id <现有应用的客户端ID> --file-name shopify.app.development.toml --force
npm run dev -- --config development
```

此命令会覆盖本地 `shopify.app.development.toml`，仅在需要同步远端配置时使用，先保留尚未发布的本地配置调整。关联后检查该文件的应用名称、客户端 ID、嵌入设置、权限、Webhook 和回调地址，再启动开发。`shopify.app.toml` 是公开的占位配置；真实开发和生产配置、凭据、会话库均已加入 Git 忽略规则。

如需单独获取凭据，运行 `npm exec -- shopify app env pull --config development`。当前 CLI 将命名配置的凭据写入 `.env.development`，并可能把值输出到终端；不要将输出复制到聊天或 Git。独立运行构建产物时，需要把相应运行变量放入进程环境，或妥善维护被忽略的 `.env`，不能误把示例空值当作真实凭据。

`dev` 使用开发店铺和临时 HTTPS 隧道；登录授权与安装必须在浏览器完成。开发地址会随隧道变化，不应作为 PVE 的正式地址。当前不申请商品或客户数据权限，也没有模板的“创建演示商品”操作。

| 命令 | 用途 |
| --- | --- |
| `npm run setup` | 生成会话存储客户端并执行迁移 |
| `npm run check` | 代码规范、类型检查和生产构建 |
| `npm run dev` | 启动 Shopify 开发环境，需要关联应用 |
| `npm run config:link` | 关联 Dev Dashboard 中的现有 App |
| `npm exec -- shopify --help` | 使用项目内 Shopify CLI |
| `npm run start` | 启动已构建的服务，需要运行环境与凭据 |
| `npm run deploy` | 发布 Shopify 配置和扩展；不会部署 PVE 后端 |

GitHub Actions 自动执行安装、数据库初始化和 `check`，不持有店铺凭据，也不自动发布应用。

本次浏览器配置联调使用构建后的服务配合 Cloudflare 临时隧道。独立启动本地构建产物可用：

```sh
node --env-file=.env node_modules/@react-router/serve/bin.js ./build/server/index.js
```

若隧道地址改变，必须同步本地 `SHOPIFY_APP_URL` 和 Shopify 中的应用 URL、登录回调。不能将已停止服务的临时地址当作有效部署。

## 运行与部署边界

`Dockerfile` 使用 Node.js 22，构建时安装完整依赖，运行时移除开发依赖并以非 root 用户运行。它是部署起点；PVE、Cloudflare 正式域名和生产数据库仍待配置及验收。

SQLite 当前只用于会话存储。容器默认数据库路径为 `/app/data/app.sqlite`，运行时必须给 `/app/data` 挂载可写持久化卷。生产环境的备份、令牌存储保护、数据库选型和正式域名应在部署前落实。

## 后续待确定

- 模型管理业务数据库及文件存储；当前 SQLite 会话库不等于业务数据库已设计。
- 管理会话续期与操作权限、客户身份核验方式和业务所需最小 API 权限。
- 渠道价格在 Shopify 结账中的具体实现方式。
- 部署域名、运行环境和目录接口契约。

公开仓库与 Shopify App 的分发方式是两回事；建立公开仓库不表示已上架 Shopify App Store。
