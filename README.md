# IP 出口检测

比较当前浏览器访问不同目的网络时，各检测端点实际观察到的公网出口与归属地。

页面会并行启动三类检测路径：

- 国内网站路径：主端点与兼容备用端点均来自 IPIP.net；兼容备用不构成独立冗余。
- 普通海外网站路径：优先使用同一 Cloudflare Worker 的 `/api/observe`，失败后使用独立第三方端点。
- 受限海外服务路径：使用可能受访问策略影响的海外第三方端点，并配置独立备用端点。

首页还支持手动输入单个完整 IPv4 或 IPv6，查询国家/地区、省州/城市、运营商或组织、ASN 与数据来源。点击“查询”或按回车后才发送请求；内网、回环及保留地址只在本地说明类型和“无公网归属地”。

手动 IP 查询与 WebRTC 公网地址的归属查询复用已接入的 IPWhois，由浏览器直接向其提交目标 IP。三条出口检测路径仍采用各检测端点自身返回的归属地，不将出口结果另交地理数据库统一。归属信息不是精确物理位置。

输入和结果只保留在当前页面内，刷新或关闭后清空。项目不建立账户、不保存检测或查询历史，不生成指定 IP 的分享链接，也不将目标 IP 写入本站 URL 或匿名优化事件。第三方查询服务的留存规则以其自身政策为准。

## 本地开发

需要 Node.js 20.19+ 或 22.12+，以及 pnpm 10。

```bash
pnpm install
pnpm run dev
```

常用检查：

```bash
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

`pnpm test` 会分别在 jsdom 中运行 React 测试，并通过 Cloudflare 官方测试池在 workerd 中运行 Worker 测试。

## Cloudflare Worker

Vite 开发服务器通过 Cloudflare Vite 插件同时运行 React SPA 与 Worker。Worker 配置位于 `wrangler.jsonc`，`/api/*` 优先交给 Worker，其他导航请求使用 SPA 回退。

修改 Worker 配置后重新生成类型：

```bash
pnpm run cf-typegen
```

部署前先构建：

```bash
pnpm run build
pnpm run deploy
```

生产自定义域名按 ADR 配置为 `ip.33338888.xyz`。部署命令会修改 Cloudflare 上的 Worker，因此请在已经登录正确账户并确认目标 Zone 后执行。

## 术语与边界

领域术语以 [`CONTEXT.md`](./CONTEXT.md) 为准，架构决策见 [`docs/adr/0001-react-spa-on-cloudflare-workers.md`](./docs/adr/0001-react-spa-on-cloudflare-workers.md)，视觉令牌见 [`DESIGN.md`](./DESIGN.md)。
