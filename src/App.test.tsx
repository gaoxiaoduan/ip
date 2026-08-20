import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import type { NetworkToolAdapterOverrides } from "@/hooks/use-network-tools";

const responseFor = (input: RequestInfo | URL) => {
  const url = String(input);

  if (url.includes("myip.ipip.net")) {
    return Response.json({
      ret: "ok",
      data: {
        ip: "112.10.247.224",
        location: ["中国", "浙江", "杭州", "", "移动"],
      },
    });
  }

  if (url === "/api/observe") {
    return Response.json({
      ok: true,
      ip: "198.51.100.10",
      country: "US",
      countryCode: "US",
      region: "California",
      city: "Los Angeles",
      organization: "Example Network",
    });
  }

  if (url.includes("api.ip.sb")) {
    return Response.json({
      ip: "203.0.113.42",
      country: "日本",
      country_code: "JP",
      region: "Tokyo",
      city: "Tokyo",
      organization: "Example Transit",
    });
  }

  return Response.json({
    ip: "203.0.113.42",
    country_name: "日本",
    country_code: "JP",
    region: "Tokyo",
    city: "Tokyo",
    org: "Example Transit",
  });
};

const createNetworkAdapters = (): NetworkToolAdapterOverrides => ({
  connectivity: {
    supported: true,
    now: () => 100,
    loadResource: vi.fn(async () => true),
  },
  webrtc: {
    supported: false,
    now: () => 100,
    createConnection: () => {
      throw new Error("WebRTC is unsupported in this test");
    },
  },
  speed: {
    supported: true,
    now: () => 100,
    measureLatency: vi.fn(async () => 12),
    download: vi.fn(async (bytes, _signal, report) => {
      report({ phase: "download", percent: 1, sampleMbps: 80 });
      return { bytesTransferred: bytes };
    }),
    upload: vi.fn(async (bytes, _signal, report) => {
      report({ phase: "upload", percent: 1, sampleMbps: 40 });
      return { bytesTransferred: bytes };
    }),
  },
});

describe("App", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("自动展示三条检测路径，并允许访客重新检测", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "一次看清，网站看到你从哪里来。",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("112.10.247.224")).toBeInTheDocument();
    expect(screen.getByText("198.51.100.10")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.42")).toBeInTheDocument();
    expect(screen.getByText("观察到出口差异")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新检测" }));

    await waitFor(() => {
      expect(
        fetcher.mock.calls.filter(([input]) => input !== "/api/analytics"),
      ).toHaveLength(6);
    });
  });

  it("React 严格检查不会重复启动本次自动检测", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(await screen.findByText("112.10.247.224")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        fetcher.mock.calls.filter(([input]) => input !== "/api/analytics"),
      ).toHaveLength(3);
    });
  });

  it("检测会话只发送匿名的开始与完成聚合事件", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);

    render(<App />);

    await screen.findByText("观察到出口差异");

    const analyticsRequests = fetcher.mock.calls.filter(
      ([input]) => input === "/api/analytics",
    );

    expect(analyticsRequests).toHaveLength(2);
    expect(analyticsRequests.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      {
        event: "detection_started",
        pageType: "home",
        sourceCategory: "direct",
      },
      {
        event: "detection_completed",
        pageType: "home",
        sourceCategory: "direct",
        outcome: "comparable",
      },
    ]);
  });

  it("将 Google Referer 在浏览器本地归为搜索来源", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(document, "referrer", "get").mockReturnValue(
      "https://www.google.co.jp/search?q=ip",
    );

    render(<App />);

    await screen.findByText("观察到出口差异");

    const analyticsRequests = fetcher.mock.calls.filter(
      ([input]) => input === "/api/analytics",
    );
    expect(JSON.parse(String(analyticsRequests[0]?.[1]?.body))).toMatchObject({
      event: "detection_started",
      sourceCategory: "search",
    });
  });

  it("可通过移动端菜单访问所有页内入口", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "打开导航" }));

    const navigation = screen.getByRole("navigation", {
      name: "移动端导航",
    });
    expect(navigation).toBeInTheDocument();
    expect(navigation).toHaveTextContent("检测结果");
    expect(navigation).toHaveTextContent("检测说明");
    expect(navigation).toHaveTextContent("隐私边界");

    await user.click(
      within(navigation).getByRole("link", {
        name: "隐私边界",
      }),
    );
    expect(
      screen.queryByRole("navigation", {
        name: "移动端导航",
      }),
    ).not.toBeInTheDocument();
  });

  it("在页眉提供项目的 GitHub 链接", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);

    render(<App />);

    expect(
      screen.getByRole("link", { name: "在 GitHub 查看项目（在新标签页打开）" }),
    ).toHaveAttribute("href", "https://github.com/gaoxiaoduan/ip");
  });

  it("提供四个可发现说明页的入口", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);

    render(<App />);

    expect(
      screen.getByRole("link", {
        name: /为什么不同网站会看到不同的出口 IP？/,
      }),
    ).toHaveAttribute("href", "/guides/ip-differences");
    expect(
      screen.getByRole("link", {
        name: /国内和海外看到的 IP 不一致，该怎么理解？/,
      }),
    ).toHaveAttribute("href", "/guides/ip-mismatch");
    expect(
      screen.getByRole("link", { name: /三条检测路径，观察的是什么？/ }),
    ).toHaveAttribute("href", "/guides/traffic-split-observation");
    expect(
      screen.getByRole("link", { name: /检测方法与隐私边界/ }),
    ).toHaveAttribute("href", "/methodology");
  });

  it("首页新工具默认等待，开始全部只启动连通性和 WebRTC", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    const adapters = createNetworkAdapters();
    const user = userEvent.setup();

    render(<App networkAdapters={adapters} />);

    expect(screen.getByRole("heading", { name: "网络工具台" })).toBeInTheDocument();
    expect(screen.getByText(/尚未开始测速/)).toBeInTheDocument();
    expect(screen.getByText("网站清单固定，不提供临时添加的网站。")).toBeInTheDocument();
    expect(adapters.speed?.measureLatency).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "开始全部检测" }));

    await waitFor(() => {
      expect(adapters.connectivity?.loadResource).toHaveBeenCalledTimes(8);
    });
    expect(adapters.speed?.measureLatency).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.filter(([input]) => input === "/api/analytics")).toHaveLength(2);
  });

  it("连通性独立页面本身可以完成固定目标检查", async () => {
    window.history.pushState({}, "", "/connectivity");
    const adapters = createNetworkAdapters();
    const user = userEvent.setup();

    render(<App networkAdapters={adapters} />);

    expect(screen.getAllByRole("heading", { name: "网络连通性" })[0]).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "一次看清，网站看到你从哪里来。" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "开始检查" }));

    await waitFor(() => {
      expect(adapters.connectivity?.loadResource).toHaveBeenCalledTimes(8);
    });
    expect(screen.getAllByText("已加载").length).toBeGreaterThan(0);
  });

  it("测速页面提供档位、流量提示和本轮测量结果", async () => {
    window.history.pushState({}, "", "/speed-test");
    const adapters = createNetworkAdapters();
    const user = userEvent.setup();

    render(<App networkAdapters={adapters} />);

    expect(screen.getByText(/约 15 MB 流量/)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);

    await waitFor(() => {
      expect(adapters.speed?.download).toHaveBeenCalledWith(
        10_000_000,
        expect.any(AbortSignal),
        expect.any(Function),
      );
    });
    expect(await screen.findByText(/本轮测量完成/)).toBeInTheDocument();
    expect(screen.getByText("下载 / Mbps")).toBeInTheDocument();
    expect(screen.getByText("空闲延迟")).toBeInTheDocument();
  });

  it("测速停止后仍展示本轮已经收集的部分结果", async () => {
    window.history.pushState({}, "", "/speed-test");
    let time = 0;
    const speed = {
      supported: true,
      now: () => {
        time += 50;
        return time;
      },
      measureLatency: vi.fn(async () => 12),
      download: vi.fn((_bytes: number, signal: AbortSignal, report: (progress: { phase: "download"; percent: number; sampleMbps?: number }) => void) => {
        report({ phase: "download", percent: 0.25, sampleMbps: 72 });
        return new Promise<{ bytesTransferred: number }>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      }),
      upload: vi.fn(),
    };
    const user = userEvent.setup();

    render(<App networkAdapters={{ speed }} />);

    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);
    await waitFor(() => {
      expect(speed.download).toHaveBeenCalled();
    });
    await user.click(screen.getAllByRole("button", { name: "停止测速" })[0]!);

    expect(await screen.findByText(/本轮已停止/)).toBeInTheDocument();
    expect(screen.getByText("耗时")).toBeInTheDocument();
  });

  it("WebRTC 泄漏测试独立页面渲染 4 张卡片并支持测试触发", async () => {
    window.history.pushState({}, "", "/webrtc");
    const webrtc = {
      supported: true,
      now: () => 100,
      createConnection: vi.fn(() => ({
        onicecandidate: null,
        onicecandidateerror: null,
        onicegatheringstatechange: null,
        iceGatheringState: "new",
        localDescription: null,
        createDataChannel: vi.fn(() => ({})),
        createOffer: vi.fn(async () => ({ type: "offer", sdp: "v=0\no=test" })),
        setLocalDescription: vi.fn(async function (this: {
          iceGatheringState: string;
          onicecandidate: ((ev: { candidate: { candidate: string } | null }) => void) | null;
          onicegatheringstatechange: (() => void) | null;
        }) {
          this.iceGatheringState = "complete";
          this.onicecandidate?.({
            candidate: {
              candidate: "candidate:1 1 udp 1 183.158.4.83 54321 typ srflx",
            },
          });
          this.onicegatheringstatechange?.();
          this.onicecandidate?.({ candidate: null });
        }),
        close: vi.fn(),
      })),
      fetchIpGeo: vi.fn(async (ip: string) => ({
        ip,
        country: "中国",
        countryCode: "CN",
        flagEmoji: "🇨🇳",
        region: "浙江",
        city: "杭州",
        isp: "Chinanet",
      })),
    };
    const user = userEvent.setup();

    render(<App networkAdapters={{ webrtc }} />);

    expect(screen.getAllByRole("heading", { name: "WebRTC 泄漏测试" })[0]).toBeInTheDocument();
    expect(screen.getAllByText("WebRTC 连接")).toHaveLength(4);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "开始测试" }));

    await waitFor(() => {
      expect(webrtc.createConnection).toHaveBeenCalledTimes(4);
    });
    expect(await screen.findAllByText("183.158.4.83")).not.toHaveLength(0);
    expect(await screen.findAllByText("端口限制型或对称型")).not.toHaveLength(0);
    expect(await screen.findAllByText("Chinanet")).not.toHaveLength(0);
  });
});
