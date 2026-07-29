# SEO / GEO 上线与维护操作

本说明只覆盖“IP 出口检测”的增长边界：帮助目标访客理解出口观测并完成一次检测。它不设排名或流量承诺，不用于泛 IP 查询、VPN 导购或用户行为画像。

## 部署前

1. 运行 `pnpm run check`。该检查会验证五个公开页面的静态 HTML、规范链接、忠实结构化数据、站点地图和 robots 规则。
2. 部署 Worker 后，确认 Analytics Engine 数据集 `ip_exit_optimization_events` 已创建。它只写入：事件种类、入口页面类型、保守来源类别、完成结果和计数。
3. 在 Cloudflare Dashboard 为 `ip.33338888.xyz` 启用 Web Analytics 的自动注入。站点已经由 Cloudflare 代理时不需要额外 Beacon Token，也不要同时加入第二个 Beacon 或其他行为分析脚本。
4. 检查 `/robots.txt` 和 `/sitemap.xml` 可公开访问；`/api/` 必须保持不参与抓取与索引。

## Google 与 Bing

1. 在 Google Search Console 添加并验证 `https://ip.33338888.xyz/` 的网站资源，提交 `https://ip.33338888.xyz/sitemap.xml`。
2. 在 Bing Webmaster Tools 添加并验证同一网站资源，提交同一份站点地图。
3. 在首个 7 天周期内只记录实际索引状态、已发现页面和真实查询；不根据预测设置排名或流量 KPI。
4. 百度只验证基础抓取兼容：公开 HTML、站点地图和 robots 可访问。首阶段不接入百度专项站长工具，也不做专项内容或外链策略。

## Cloudflare 匿名度量

- Web Analytics 用于查看页面流量、来源汇总和核心性能。它不承载自定义事件。
- Analytics Engine 的 `ip_exit_optimization_events` 用于查询匿名优化事件。字段顺序为：
  1. `blob1`：`detection_started` 或 `detection_completed`
  2. `blob2`：入口页面类型
  3. `blob3`：`search`、`answer-engine`、`external`、`direct` 或 `unknown`
  4. `blob4`：完成事件的 `comparable` 或 `insufficient`；开始事件为空
  5. `double1`：计数（始终为 1）
- 不查询、导出或补写 IP、出口结果、原始 Referer、完整 URL 参数、Cookie、设备指纹或用户标识。无法确认来源时保持 `unknown`。

7 天复盘时，按入口页面类型与来源类别聚合检测开始和检测完成数量，并结合 Web Analytics 的自然发现访问与核心性能查看。连续四个周期的趋势才用于判断说明页是否长期有效。

## 内容与抓取维护

- `GPTBot` 被禁止；通配规则允许 Google、Bing、ChatGPT Search 与 Gemini 的相关爬虫访问公开内容。Google-Extended 保持允许，因为 Gemini grounding 与训练用途不能拆分控制。
- 检测端点、备用规则或隐私承诺改变时，同步更新受影响说明页与方法页的可见更新时间和站点地图 `lastmod`。
- 即使没有功能变更，也至少每 90 天复核一次技术来源和表述。引用只使用相关一手资料；无法证实的原因只能写为可能性。
- 内容纠错通过 GitHub Issue 接收。自然引用可以接受；不购买链接、不交换锚文本、不批量投稿。
