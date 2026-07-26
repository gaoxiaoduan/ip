# IP 出口检测

比较当前浏览器访问不同目的网络时，各检测端点实际观察到的公网出口与归属地。

页面会并行启动三类检测路径：

- 国内网站路径：主端点与兼容备用端点均来自 IPIP.net；兼容备用不构成独立冗余。
- 普通海外网站路径：优先使用同一 Cloudflare Worker 的 `/api/observe`，失败后使用独立第三方端点。
- 受限海外服务路径：使用可能受访问策略影响的海外第三方端点，并配置独立备用端点。

结果只保留在当前页面内。项目不建立账户、不保存检测历史，也不会把一个端点返回的 IP 再提交给额外的地理数据库。

## 本地开发

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

常用检查：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` 会分别在 jsdom 中运行 React 测试，并通过 Cloudflare 官方测试池在 workerd 中运行 Worker 测试。

## Cloudflare Worker

Vite 开发服务器通过 Cloudflare Vite 插件同时运行 React SPA 与 Worker。Worker 配置位于 `wrangler.jsonc`，`/api/*` 优先交给 Worker，其他导航请求使用 SPA 回退。

修改 Worker 配置后重新生成类型：

```bash
npm run cf-typegen
```

部署前先构建：

```bash
npm run build
npm run deploy
```

生产自定义域名按 ADR 配置为 `ip.33338888.xyz`。部署命令会修改 Cloudflare 上的 Worker，因此请在已经登录正确账户并确认目标 Zone 后执行。

## 术语与边界

领域术语以 [`CONTEXT.md`](./CONTEXT.md) 为准，架构决策见 [`docs/adr/0001-react-spa-on-cloudflare-workers.md`](./docs/adr/0001-react-spa-on-cloudflare-workers.md)，视觉令牌见 [`DESIGN.md`](./DESIGN.md)。
