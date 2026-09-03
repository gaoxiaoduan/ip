# IP 出口检测

IP 出口检测提供无需认证的当前请求出口观测。它返回 Cloudflare 在本次请求中观察到的公网 IP、国家/地区、城市、网络组织、ASN 与边缘机房；结果不代表精确物理位置、所有流量路径或代理配置诊断。

## API

- [GET /api/observe](https://ip.33338888.xyz/api/observe) 返回本次请求的 JSON 观测结果。
- [OpenAPI 3.1 规范](https://ip.33338888.xyz/openapi.json) 描述 API 的输入和响应。
- 认证：不需要。

## Agent 接口

- [MCP Server](https://ip.33338888.xyz/mcp) 使用 Streamable HTTP，提供只读 `observe_ip` 工具。
- [A2A Agent Card](https://ip.33338888.xyz/.well-known/agent-card.json) 及其只读 [A2A endpoint](https://ip.33338888.xyz/a2a) 提供当前请求出口观测。
- [Agent Skills index](https://ip.33338888.xyz/.well-known/agent-skills/index.json) 列出可加载的使用说明。
- [Agent mode](https://ip.33338888.xyz/?mode=agent) 返回 API、认证和能力的机器可读 JSON。

## 边界

浏览器侧连通性、WebRTC 和测速功能需要用户在页面中明确启动。服务不保存个人检测结果。
