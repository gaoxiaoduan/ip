# 使用 React SPA 与 Cloudflare Worker 一体部署

首版采用 React、TypeScript、Vite、shadcn/ui 和 Tailwind CSS，并通过 Cloudflare Vite 插件将 SPA 静态资源与自有检测接口作为同一个 Worker 部署到 `ip.33338888.xyz`。相比 Cloudflare Pages、独立 API 服务或 SSR，这一方案能以一次部署承载当前单页工具的静态界面和边缘接口，同时保留初始 HTML 中的 SEO 信息；访客专属检测结果仍由浏览器直接请求各检测端点，不引入数据库。
