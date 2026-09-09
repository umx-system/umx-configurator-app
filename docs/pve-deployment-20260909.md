# PVE App 部署验收 · 2026-09-09

## 当前运行位置

- VM 141 `docker-host`，独立容器 `umx-configurator-app`。
- 发布代码：`cadf1c8ae20c26450afad5285c28dffe7b00ac11`；目录 `/opt/umx-configurator-app/releases/<commit>`，`current` 与 `previous` 保存切换位置。
- 固定入口：`https://umx-configurator.fredy.cc`；VM 回环健康接口 `http://127.0.0.1:3188/health`。
- Cloudflare 复用 PVE 中现有 `umx-shopify-image` 通道，新增主机名路由到 `http://umx-configurator-app:3000`。没有重建通道或修改图片服务路由。
- Shopify 配置已发布为 `configurator-dashboard-4`，应用 URL、回调 `/auth/callback`、App Proxy `/proxy` 均使用新域名；权限仍为 `read_customers,write_app_proxy`。
- Mac 的旧 App 服务和临时隧道均已停止，不再承载请求。

## 数据与验证

- 从停止写入后的本机 SQLite 制作一致快照，连同 18 个模型、35 个图片／HDR 资源迁移到服务器持久目录。
- 53 个资产文件的 SHA-256 全部与本机一致；SQLite `integrity_check=ok`。
- 容器重建后数据保留，健康接口返回 JSON `status=ok`。
- Shopify 后台真实加载固定域名；列表显示 18 模型。XC-01 企业受众关闭、保存，再开启、刷新确认仍开启；测试未发布，已有发布目录未变，修订号正常增加。
- 匿名店铺代理返回 HTTP 200 JSON、`consumer`、12 项公共模型／配件／独立产品。公开签名 GLB 来自固定域名，其内容与迁移文件哈希一致。
- 新开发模板 `189705290039` 的真实企业浏览器预览正常加载 3D 双抽屉、438 × 400 × 525 mm 和 $998 组合显示。正式模板 `189572088119` 未切换。
- 后端 15 项测试、类型检查、lint、构建通过；PVE Docker 构建与健康等待通过。原有 25 个容器的 ID 全部保留。

## 备份与运行

`restart: unless-stopped` 使容器随 Docker 恢复。systemd 备份定时器已启用，每日服务器时间 04:10 加最多 15 分钟随机延迟（服务器使用 UTC），保留最近七份。备份脚本暂时暂停 App，复制数据库与资产后立即恢复；归档在隔离临时目录实际解压，逐个验证文件哈希和 SQLite 完整性。首次手动备份恢复检查通过，定时服务也已执行验收。

备份路径为 `/opt/umx-configurator-app/backups`，环境文件为受保护的 `/opt/umx-configurator-app/.env`。它们均不在镜像或 Git 中。当前备份同机，尚未配置异地备份；共享通道与单台 PVE 不是高可用架构。

更新使用 `scripts/deploy.sh`。失败可重新运行 `previous` 中的 Compose；如果数据库迁移不向后兼容，则需要停 App 后恢复配套数据备份，不能仅切旧镜像。不要以主题目录名推断发布目标，也不要重新开启 Mac 旧副本进行后台写入。

App 部署完成不代表正式店铺模板已发布，也不替代三类真实账户及结账链路的最终验收。
