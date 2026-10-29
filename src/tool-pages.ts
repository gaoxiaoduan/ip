export const TOOL_PAGES = {
  connectivity: {
    path: "/connectivity", view: "connectivity", title: "网络连通性",
    description: "检查八个常用网站的资源请求是否成功，并显示每次请求的耗时。",
    note: "网站清单固定，不提供临时添加的网站。",
  },
  webrtc: {
    path: "/webrtc", view: "webrtc", title: "WebRTC 泄漏测试",
    description: "建立四个独立 STUN 连接，检测浏览器 WebRTC 是否暴露真实公网 IP 及 NAT 类型。展示真实出口 IP、NAT 类型、运营商网络与所属地区，并保留 SDP 诊断日志。",
    note: "WebRTC 往往通过 UDP 直连建立；若测试返回真实 IP 说明代理未覆盖此类连接。NAT 类型仅供参考。",
  },
  speed: {
    path: "/speed-test", view: "speed", title: "网速测试",
    description: "通过 Cloudflare edge 直接测量下载、上传、空闲延迟和抖动。开始前会明确提示流量消耗，结果只属于本轮页面会话。",
    note: "低流量档约 15 MB，精测档约 65 MB；测速始终需要单独启动。",
  },
  ping: {
    path: "/ping", view: "ping", title: "多地 Ping",
  },
} as const;

export type ToolPage = (typeof TOOL_PAGES)[keyof typeof TOOL_PAGES];

export function findToolPage(pathname: string): ToolPage | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  return Object.values(TOOL_PAGES).find((page) => page.path === path);
}
