import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import { clearIpGeoCache } from "@/lib/ip-lookup";
import type { NetworkToolAdapterOverrides } from "@/lib/network-tool-session";

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

const dnsResponse = (hostname: string, type: "A" | "AAAA", addresses: string[] = [], status = 0) => {
  const code = type === "A" ? 1 : 28;
  return Response.json({
    Status: status,
    Question: [{ name: `${hostname}.`, type: code }],
    Answer: addresses.map((data) => ({ name: `${hostname}.`, type: code, data })),
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
    clearIpGeoCache();
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("提交域名后展示 DNS 地址并查询默认 IPv4 的归属", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        const type = url.searchParams.get("type") === "A" ? 1 : 28;
        return Response.json({
          Status: 0,
          Question: [{ name: "www.example.com.", type }],
          Answer: type === 1 ? [{ name: "www.example.com.", type: 1, data: "8.8.8.8" }] : [],
        });
      }
      if (url.origin === "https://ipwho.is") {
        return Response.json({ success: true, ip: "8.8.8.8", country: "美国", connection: { isp: "Google LLC", asn: 15169 } });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox"), "www.example.com");
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("cloudflare-dns.com"))).toBe(false);
    await user.click(lookup.getByRole("button", { name: "查询" }));

    expect(await lookup.findByText("Google LLC")).toBeInTheDocument();
    expect(lookup.getByRole("heading", { name: "www.example.com" })).toBeInTheDocument();
    expect(lookup.getByRole("button", { name: "8.8.8.8" })).toHaveAttribute("aria-pressed", "true");
    expect(lookup.getByText("无 IPv6 地址记录")).toBeInTheDocument();
    expect(lookup.getByRole("link", { name: "Cloudflare DNS" })).toHaveAttribute("href", "https://developers.cloudflare.com/1.1.1.1/");
    expect(lookup.getByText(/本轮查询时间/)).toBeInTheDocument();
    expect(lookup.getByText(/可能与本机 DNS 不同/)).toBeInTheDocument();
    expect(screen.getByText("112.10.247.224")).toBeInTheDocument();
  });

  it.each([
    ["  WWW.Example.COM.  ", "www.example.com"],
    ["example.com/path?q=private#secret", "example.com"],
    ["https://Sub.Example.com:8443/path?q=private#secret", "sub.example.com"],
    ["http://sub.example.com/path", "sub.example.com"],
    ["example.com:8443/path", "example.com"],
    ["例子.中国", "xn--fsqu00a.xn--fiqs8s"],
    ["https://例子.中国/path", "xn--fsqu00a.xn--fiqs8s"],
  ])("查询 %s 时仅提交规范化主机名 %s", async (value, hostname) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        return dnsResponse(hostname, url.searchParams.get("type") as "A" | "AAAA", url.searchParams.get("type") === "A" ? ["8.8.8.8"] : []);
      }
      if (url.origin === "https://ipwho.is") return Response.json({ success: true, ip: "8.8.8.8", country: "归属结果" });
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.click(lookup.getByRole("textbox"));
    await user.paste(value);
    await user.keyboard("{Enter}");
    expect(await lookup.findByText("归属结果")).toBeInTheDocument();
    expect(lookup.getByRole("heading", { name: hostname })).toBeInTheDocument();
    const requests = fetcher.mock.calls.filter(([input]) => String(input).startsWith("https://cloudflare-dns.com/"));
    expect(requests).toHaveLength(2);
    expect(requests.map(([input]) => String(input))).toEqual([
      `https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`,
      `https://cloudflare-dns.com/dns-query?name=${hostname}&type=AAAA`,
    ]);
    for (const [, init] of requests) {
      expect(init).toMatchObject({ headers: { Accept: "application/dns-json" }, referrerPolicy: "no-referrer", cache: "no-store" });
    }
    expect(fetcher.mock.calls.some(([input]) => String(input).includes("private") || String(input).includes("secret"))).toBe(false);
  });

  it.each([
    ["https://8.8.8.8:8443/path?q=private", "8.8.8.8"],
    ["http://[2606:4700:4700::1111]:8080/path", "2606:4700:4700::1111"],
  ])("网址 %s 中的 IP 直接查询，不经过 DNS", async (value, ip) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => String(input).startsWith("https://ipwho.is/")
      ? Response.json({ success: true, ip, country: "直接 IP 归属" }) : responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.click(lookup.getByRole("textbox"));
    await user.paste(value);
    await user.keyboard("{Enter}");
    expect(await lookup.findByText("直接 IP 归属")).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([input]) => String(input).includes("cloudflare-dns.com"))).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(`https://ipwho.is/${ip}?lang=zh-CN`, expect.anything());
  });

  it.each(["localhost", "app.localhost", "printer.local", "app.internal", "home.arpa", "router.home.arpa", "intranet", "https://APP.INTERNAL:8080/private", "https://打印机.local/path"])("内部名称 %s 仅在本地说明，不提交外部查询", async (value) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.click(lookup.getByRole("textbox"));
    await user.paste(value);
    await user.keyboard("{Enter}");
    expect(lookup.getByRole("status")).toHaveTextContent("内部名称不支持公共 DNS 查询");
    expect(fetcher.mock.calls.some(([url]) => /cloudflare-dns\.com|ipwho\.is/.test(String(url)))).toBe(false);
  });

  it("仅列出本域名 CNAME 链上的去重双栈地址，按选择查询并本地说明特殊 IP", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        const type = url.searchParams.get("type") === "A" ? 1 : 28;
        return Response.json({
          Status: 0, Question: [{ name: "www.example.com.", type }],
          Answer: [
            { name: "edge.example.net.", type, data: type === 1 ? "8.8.8.8" : "2606:4700:4700:0000:0000:0000:0000:1111" },
            { name: "www.example.com.", type: 5, data: "edge.example.net." },
            { name: "edge.example.net.", type, data: type === 1 ? "8.8.8.8" : "2606:4700:4700::1111" },
            ...(type === 1 ? [{ name: "edge.example.net.", type: 1, data: "192.168.1.1" }] : []),
            { name: "unrelated.example.org.", type, data: type === 1 ? "9.9.9.9" : "2001:4860:4860::8888" },
          ],
        });
      }
      if (url.origin === "https://ipwho.is") {
        const ip = url.pathname.slice(1);
        return Response.json({ success: true, ip, country: ip === "8.8.8.8" ? "IPv4 归属" : "IPv6 归属" });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox"), "www.example.com");
    await user.keyboard("{Enter}");
    expect(await lookup.findByText("IPv4 归属")).toBeInTheDocument();
    expect(lookup.getAllByRole("button", { name: "8.8.8.8" })).toHaveLength(1);
    expect(lookup.getAllByRole("button", { name: "2606:4700:4700::1111" })).toHaveLength(1);
    expect(within(lookup.getByRole("group", { name: "IPv6 解析地址" })).getAllByRole("button")).toHaveLength(1);
    expect(lookup.queryByRole("button", { name: "9.9.9.9" })).not.toBeInTheDocument();
    expect(lookup.queryByText("2001:4860:4860::8888")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith("https://ipwho.is/"))).toHaveLength(1);
    await user.click(lookup.getByRole("button", { name: "2606:4700:4700::1111" }));
    expect(await lookup.findByText("IPv6 归属")).toBeInTheDocument();
    expect(lookup.getByRole("button", { name: "2606:4700:4700::1111" })).toHaveAttribute("aria-pressed", "true");
    await user.click(lookup.getByRole("button", { name: "192.168.1.1" }));
    expect(lookup.getByRole("status")).toHaveTextContent("内网地址，无公网归属地");
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("ipwho.is/192.168"))).toBe(false);
    await user.click(lookup.getByRole("button", { name: "8.8.8.8" }));
    expect(await lookup.findByText("IPv4 归属")).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith("https://ipwho.is/"))).toHaveLength(2);
  });

  it("一类解析等待或失败时另一类可先选择，重试解析也不提交尚未提交的编辑内容", async () => {
    let finishIpv4!: (response: Response) => void;
    let attempts = 0;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        const type = url.searchParams.get("type") as "A" | "AAAA";
        if (type === "A" && attempts++ === 0) return new Promise<Response>((resolve) => { finishIpv4 = resolve; });
        return dnsResponse("example.com", type, type === "A" ? ["8.8.8.8"] : ["2606:4700:4700::1111"]);
      }
      if (url.origin === "https://ipwho.is") {
        const ip = url.pathname.slice(1);
        return Response.json({ success: true, ip, country: ip.includes(":") ? "IPv6 先到" : "IPv4 重试成功" });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    const input = lookup.getByRole("textbox");
    await user.type(input, "example.com");
    await user.keyboard("{Enter}");
    const ipv6 = await lookup.findByRole("button", { name: "2606:4700:4700::1111" });
    expect(lookup.getByText("正在解析 IPv4…")).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("https://ipwho.is/"))).toBe(false);
    await user.click(ipv6);
    expect(await lookup.findByText("IPv6 先到")).toBeInTheDocument();
    await act(async () => { finishIpv4(new Response(null, { status: 503 })); });
    expect(lookup.getByRole("alert")).toHaveTextContent("DNS 解析服务暂不可用");
    expect(lookup.getByText(/本轮解析结果可能不完整/)).toBeInTheDocument();
    expect(ipv6).toHaveAttribute("aria-pressed", "true");
    await user.clear(input);
    await user.type(input, "do-not-submit.example");
    expect(lookup.getByRole("heading", { name: "example.com" })).toBeInTheDocument();
    await user.click(lookup.getByRole("button", { name: "重新解析" }));
    expect(await lookup.findByText("IPv4 重试成功")).toBeInTheDocument();
    expect(lookup.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("cloudflare-dns.com"))).toHaveLength(4);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("do-not-submit"))).toBe(false);
  });

  it.each([
    ["域名不存在", () => dnsResponse("example.com", "A", [], 3), "域名不存在。"],
    ["DNS 失败", () => dnsResponse("example.com", "A", [], 2), "DNS 解析失败，请重试。"],
    ["HTTP 失败", () => new Response(null, { status: 503 }), "DNS 解析服务暂不可用，请重试。"],
    ["限流", () => new Response(null, { status: 429 }), "DNS 解析请求已达服务限额，请稍后重试。"],
    ["网络失败", () => Promise.reject(new TypeError("Failed to fetch")), "DNS 网络请求失败，请检查连接后重试。"],
    ["JSON 无效", () => new Response("{"), "DNS 解析服务返回的数据无效，请重试。"],
    ["查询目标不符", () => dnsResponse("wrong.example", "A", ["8.8.8.8"]), "DNS 解析服务返回的数据无效，请重试。"],
    ["查询类型不符", () => dnsResponse("example.com", "AAAA", ["2606:4700:4700::1111"]), "DNS 解析服务返回的数据无效，请重试。"],
    ["缺失查询目标", () => Response.json({ Status: 0, Answer: [] }), "DNS 解析服务返回的数据无效，请重试。"],
    ["地址格式无效", () => dnsResponse("example.com", "A", ["999.1.1.1"]), "DNS 解析服务返回的数据无效，请重试。"],
    ["地址家族不符", () => dnsResponse("example.com", "A", ["2606:4700:4700::1111"]), "DNS 解析服务返回的数据无效，请重试。"],
    ["截断回答", () => Response.json({ Status: 0, TC: true, Question: [{ name: "example.com.", type: 1 }], Answer: [] }), "DNS 解析服务返回的数据无效，请重试。"],
    ["CNAME 循环", () => Response.json({ Status: 0, Question: [{ name: "example.com.", type: 1 }], Answer: [
      { name: "example.com.", type: 5, data: "edge.example.com." },
      { name: "edge.example.com.", type: 5, data: "example.com." },
    ] }), "DNS 解析服务返回的数据无效，请重试。"],
    ["CNAME 冲突", () => Response.json({ Status: 0, Question: [{ name: "example.com.", type: 1 }], Answer: [
      { name: "example.com.", type: 5, data: "edge1.example.com." },
      { name: "example.com.", type: 5, data: "edge2.example.com." },
    ] }), "DNS 解析服务返回的数据无效，请重试。"],
  ] as const)("DNS %s 显示准确原因，且可重新解析", async (_label, failure, message) => {
    let shouldFail = true;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        const type = url.searchParams.get("type") as "A" | "AAAA";
        if (type === "A" && shouldFail) return failure();
        return dnsResponse("example.com", type, type === "A" ? ["8.8.8.8"] : []);
      }
      if (url.origin === "https://ipwho.is") return Response.json({ success: true, ip: "8.8.8.8", country: "恢复成功" });
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox"), "example.com");
    await user.keyboard("{Enter}");
    expect(await lookup.findByRole("alert")).toHaveTextContent(message);
    expect(lookup.getByRole("heading", { name: "example.com" })).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("https://ipwho.is/"))).toBe(false);
    shouldFail = false;
    await user.click(lookup.getByRole("button", { name: "重新解析" }));
    expect(await lookup.findByText("恢复成功")).toBeInTheDocument();
    expect(lookup.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["请求未完成", "响应体未完成"])("DNS %s 时 6 秒超时，保留另一类并隔离迟到结果", async (mode) => {
    let releaseOld!: (value: Response) => void;
    let releaseBody!: (value: unknown) => void;
    let oldSignal: AbortSignal | null | undefined;
    let attempts = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        const type = url.searchParams.get("type") as "A" | "AAAA";
        if (type === "A" && attempts++ === 0) {
          oldSignal = init?.signal;
          if (mode === "请求未完成") return new Promise<Response>((resolve) => { releaseOld = resolve; });
          const response = dnsResponse("example.com", "A", ["8.8.8.8"]);
          vi.spyOn(response, "json").mockImplementation(() => new Promise((resolve) => { releaseBody = resolve; }));
          return response;
        }
        return dnsResponse("example.com", type, type === "AAAA" ? ["2606:4700:4700::1111"] : ["1.1.1.1"]);
      }
      if (url.origin === "https://ipwho.is") return Response.json({ success: true, ip: url.pathname.slice(1), country: "可用归属" });
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("观察到出口差异");
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    const input = lookup.getByRole("textbox");
    await user.type(input, "example.com");
    vi.useFakeTimers();
    fireEvent.submit(input.closest("form")!);
    await act(async () => { await vi.advanceTimersByTimeAsync(5999); });
    expect(lookup.getByText("正在解析 IPv4…")).toBeInTheDocument();
    expect(lookup.getByRole("button", { name: "2606:4700:4700::1111" })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(lookup.getByRole("alert")).toHaveTextContent("DNS 解析超时，请重试。");
    expect(oldSignal?.aborted).toBe(true);
    expect(lookup.getByText("可用归属")).toBeInTheDocument();
    vi.useRealTimers();
    await user.click(lookup.getByRole("button", { name: "重新解析" }));
    expect(await lookup.findByRole("button", { name: "1.1.1.1" })).toHaveAttribute("aria-pressed", "true");
    await act(async () => {
      if (mode === "请求未完成") releaseOld(dnsResponse("example.com", "A", ["8.8.8.8"]));
      else releaseBody(await dnsResponse("example.com", "A", ["8.8.8.8"]).json());
    });
    expect(lookup.queryByRole("button", { name: "8.8.8.8" })).not.toBeInTheDocument();
    expect(lookup.getByRole("button", { name: "1.1.1.1" })).toHaveAttribute("aria-pressed", "true");
  });

  it("查询中可提交新域名，取消两类旧解析并阻止旧响应覆盖新结果", async () => {
    const old: { signal?: AbortSignal | null; finish: (response: Response) => void }[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        if (url.searchParams.get("name") === "old.example") {
          return new Promise<Response>((finish) => { old.push({ signal: init?.signal, finish }); });
        }
        const type = url.searchParams.get("type") as "A" | "AAAA";
        return dnsResponse("new.example", type, type === "A" ? ["1.1.1.1"] : []);
      }
      if (url.origin === "https://ipwho.is") return Response.json({ success: true, ip: "1.1.1.1", country: "新目标归属" });
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    const input = lookup.getByRole("textbox");
    await user.type(input, "old.example");
    await user.keyboard("{Enter}");
    expect(lookup.getByText("正在解析 IPv4…")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "https://new.example/path?secret=hidden");
    expect(lookup.getByRole("heading", { name: "old.example" })).toBeInTheDocument();
    await user.click(lookup.getByRole("button", { name: "查询" }));
    expect(await lookup.findByText("新目标归属")).toBeInTheDocument();
    expect(old).toHaveLength(2);
    expect(old.every((request) => request.signal?.aborted)).toBe(true);
    await act(async () => {
      old[0]!.finish(dnsResponse("old.example", "A", ["8.8.8.8"]));
      old[1]!.finish(new Response(null, { status: 503 }));
    });
    expect(lookup.getByRole("heading", { name: "new.example" })).toBeInTheDocument();
    expect(lookup.queryByRole("button", { name: "8.8.8.8" })).not.toBeInTheDocument();
    expect(lookup.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("ipwho.is/8.8.8.8"))).toBe(false);
  });

  it("切换 IP 取消旧归属请求；归属失败保留列表，可重试并不被迟到响应覆盖", async () => {
    let releaseOld!: (response: Response) => void;
    let oldSignal: AbortSignal | null | undefined;
    let failed = true;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        const type = url.searchParams.get("type") as "A" | "AAAA";
        return dnsResponse("example.com", type, type === "A" ? ["8.8.8.8", "1.1.1.1"] : []);
      }
      if (url.origin === "https://ipwho.is") {
        if (url.pathname === "/8.8.8.8") {
          oldSignal = init?.signal;
          return new Promise<Response>((resolve) => { releaseOld = resolve; });
        }
        if (failed) return new Response(null, { status: 503 });
        return Response.json({ success: true, ip: "1.1.1.1", country: "当前地址归属" });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox"), "example.com");
    await user.keyboard("{Enter}");
    expect(await lookup.findByText("正在查询 8.8.8.8…")).toBeInTheDocument();
    await user.click(lookup.getByRole("button", { name: "1.1.1.1" }));
    expect(oldSignal?.aborted).toBe(true);
    expect(await lookup.findByRole("alert")).toHaveTextContent("查询服务暂不可用");
    expect(lookup.getByRole("heading", { name: "example.com" })).toBeInTheDocument();
    expect(lookup.getByRole("button", { name: "1.1.1.1" })).toHaveAttribute("aria-pressed", "true");
    failed = false;
    await user.click(lookup.getByRole("button", { name: "重试归属查询" }));
    expect(await lookup.findByText("当前地址归属")).toBeInTheDocument();
    await act(async () => { releaseOld(Response.json({ success: true, ip: "8.8.8.8", country: "过期归属" })); });
    expect(lookup.queryByText("过期归属")).not.toBeInTheDocument();
    expect(lookup.getByText("当前地址归属")).toBeInTheDocument();
  });

  it.each([
    [[], ["2606:4700:4700::1111"], "2606:4700:4700::1111"],
    [[], [], null],
  ] as const)("没有 IPv4 时正常处理 IPv6 与空答案：%s / %s", async (ipv4, ipv6, expected) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), window.location.href);
      if (url.origin === "https://cloudflare-dns.com") {
        const type = url.searchParams.get("type") as "A" | "AAAA";
        return dnsResponse("example.com", type, [...(type === "A" ? ipv4 : ipv6)]);
      }
      if (url.origin === "https://ipwho.is") return Response.json({ success: true, ip: expected, country: "IPv6 默认归属" });
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox"), "example.com");
    await user.keyboard("{Enter}");
    expect(await lookup.findByText("无 IPv4 地址记录")).toBeInTheDocument();
    if (expected) expect(await lookup.findByText("IPv6 默认归属")).toBeInTheDocument();
    else {
      expect(lookup.getByText("无 IPv6 地址记录")).toBeInTheDocument();
      expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("https://ipwho.is/"))).toBe(false);
    }
    expect(lookup.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("离开页面取消所有 DNS 请求，重新进入不恢复输入或结果", async () => {
    const requests: { signal?: AbortSignal | null; finish: (response: Response) => void }[] = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).startsWith("https://cloudflare-dns.com/")) {
        return new Promise<Response>((finish) => { requests.push({ signal: init?.signal, finish }); });
      }
      return responseFor(input);
    }));
    const user = userEvent.setup();
    const rendered = render(<StrictMode><App /></StrictMode>);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox"), "example.com");
    await user.keyboard("{Enter}");
    rendered.unmount();
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.signal?.aborted)).toBe(true);
    await act(async () => { requests.forEach((request) => request.finish(dnsResponse("example.com", "A", ["8.8.8.8"]))); });
    render(<App />);
    const refreshed = within(screen.getByRole("region", { name: "IP 查询" }));
    expect(refreshed.getByRole("textbox")).toHaveValue("");
    expect(refreshed.queryByText("example.com")).not.toBeInTheDocument();
  });

  it("在首页提交指定 IPv4，原地展示归属信息及实际来源", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "https://ipwho.is/8.8.8.8?lang=zh-CN") {
        return Response.json({
          ip: "8.8.8.8",
          success: true,
          country: "美国",
          country_code: "US",
          region: "加利福尼亚州",
          city: "山景城",
          connection: { isp: "Google LLC", asn: 15169 },
        });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);

    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox", { name: "IP、域名或网址" }), "8.8.8.8");
    await user.click(lookup.getByRole("button", { name: "查询" }));

    expect(await lookup.findByText("Google LLC")).toBeInTheDocument();
    for (const value of ["8.8.8.8", "美国", "加利福尼亚州", "山景城", "AS15169"]) {
      expect(lookup.getByText(value)).toBeInTheDocument();
    }
    expect(lookup.getByRole("link", { name: "IPWhois" })).toHaveAttribute(
      "href", "https://ipwhois.io/",
    );
    expect(screen.getByText("112.10.247.224")).toBeInTheDocument();
    expect(screen.getByText("观察到出口差异")).toBeInTheDocument();
  });

  it.each([
    "", "bad_domain.com", "8.8.8", "256.1.1.1", "008.8.8.8", "0x08080808",
    "ftp://example.com", "https://user:secret@example.com", "*.example.com", "mailto:user@example.com", "https://0x08080808", "https://008.8.8.8", "https://8.8.8", "8.8.8.0/24", "8.8.8.8:53",
    "2606:::1111", "fe80::1%en0", "[2606:4700::1111]:443", "8.8.8.8 1.1.1.1",
  ])("拒绝不支持的查询输入：%s", async (value) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    const input = lookup.getByRole("textbox", { name: "IP、域名或网址" });
    await user.click(input);
    if (value) await user.paste(value);
    await user.click(lookup.getByRole("button", { name: "查询" }));

    expect(lookup.getByRole("alert")).toHaveTextContent("请输入一个完整的 IPv4、IPv6、域名或 HTTP/HTTPS 网址");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("https://ipwho.is/"))).toBe(false);
  });

  it.each([
    ["192.168.1.1", "内网地址"], ["10.1.2.3", "内网地址"], ["172.31.1.1", "内网地址"],
    ["127.0.0.1", "回环地址"], ["169.254.10.1", "链路本地地址"],
    ["100.64.0.1", "共享地址"], ["0.0.0.0", "未指定地址"],
    ["224.0.0.1", "组播地址"], ["255.255.255.255", "广播地址"],
    ["192.0.2.1", "保留地址"], ["198.51.100.1", "保留地址"], ["203.0.113.1", "保留地址"],
    ["::1", "回环地址"], ["::", "未指定地址"], ["fd12::1", "内网地址"],
    ["fe80::1", "链路本地地址"], ["ff02::1", "组播地址"],
    ["2001:db8::1", "保留地址"], ["::ffff:192.168.1.1", "内网地址"],
    ["fec0::1", "保留地址"], ["100::1", "保留地址"], ["100:0:0:1::1", "保留地址"],
    ["64:ff9b:1::1", "保留地址"], ["2001:2::1", "保留地址"], ["3fff::1", "保留地址"],
    ["5f00::1", "保留地址"], ["::2", "保留地址"], ["4000::1", "保留地址"],
  ])("在本地说明特殊地址 %s 的类型，不请求第三方", async (ip, type) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox", { name: "IP、域名或网址" }), ip);
    await user.click(lookup.getByRole("button", { name: "查询" }));

    expect(lookup.getByRole("status")).toHaveTextContent(type);
    expect(lookup.getByRole("status")).toHaveTextContent("无公网归属地");
    expect(lookup.getByText(ip)).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("https://ipwho.is/"))).toBe(false);
  });

  it.each([
    "  2606:4700:4700::1111  ",
    "2606:4700:4700:0000:0000:0000:0000:1111",
  ])("按回车提交 IPv6 %s，缺失的地理字段显示未知", async (value) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith("https://ipwho.is/")) {
        return Response.json({
          success: true, ip: "2606:4700:4700::1111",
          connection: { org: "Cloudflare, Inc.", asn: 13335 },
        });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.click(lookup.getByRole("textbox", { name: "IP、域名或网址" }));
    await user.paste(value);
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("https://ipwho.is/"))).toBe(false);
    await user.keyboard("{Enter}");

    expect(await lookup.findByText("Cloudflare, Inc.")).toBeInTheDocument();
    expect(lookup.getByText(value.trim())).toBeInTheDocument();
    expect(lookup.getByText("AS13335")).toBeInTheDocument();
    expect(lookup.getAllByText("未知")).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledWith(`https://ipwho.is/${value.trim()}?lang=zh-CN`, expect.anything());
  });

  it.each([
    ["限流", () => new Response(null, { status: 429 }), "查询请求已达服务限额，请稍后重试。"],
    ["服务失败", () => new Response(null, { status: 503 }), "查询服务暂不可用，请稍后重试。"],
    ["网络失败", () => Promise.reject(new TypeError("Failed to fetch")), "网络请求失败，请检查连接后重试。"],
    ["业务失败", () => Response.json({ success: false }), "未能取得该 IP 的归属信息，请稍后重试。"],
    ["空数据", () => Response.json(null), "查询服务返回的数据无效，请稍后重试。"],
    ["目标不符", () => Response.json({ success: true, ip: "1.1.1.1", country: "错误结果" }), "查询服务返回的数据无效，请稍后重试。"],
    ["缺失目标", () => Response.json({ success: true, country: "错误结果" }), "查询服务返回的数据无效，请稍后重试。"],
    ["字段无效", () => Response.json({ success: true, ip: "8.8.8.8", country: ["错误结果"] }), "查询服务返回的数据无效，请稍后重试。"],
    ["JSON 无效", () => new Response("{"), "查询服务返回的数据无效，请稍后重试。"],
  ] as const)("说明%s，且失败不会阻止重试同一地址", async (_label, failure, message) => {
    let shouldFail = true;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith("https://ipwho.is/")) {
        if (shouldFail) return failure();
        return Response.json({ success: true, ip: "8.8.8.8", country: "美国" });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox", { name: "IP、域名或网址" }), "8.8.8.8");
    await user.click(lookup.getByRole("button", { name: "查询" }));
    expect(await lookup.findByRole("alert")).toHaveTextContent(message);
    expect(lookup.getByText("8.8.8.8")).toBeInTheDocument();
    expect(lookup.queryByRole("link", { name: "IPWhois" })).not.toBeInTheDocument();

    shouldFail = false;
    await user.click(lookup.getByRole("button", { name: "查询" }));
    expect(await lookup.findByText("美国")).toBeInTheDocument();
    expect(lookup.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("查询在 6 秒超时后可重新提交，并隔离不响应取消的旧请求", async () => {
    let resolveOld!: (response: Response) => void;
    let oldSignal: AbortSignal | null | undefined;
    let firstQuery = true;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).startsWith("https://ipwho.is/")) {
        if (firstQuery) {
          firstQuery = false;
          oldSignal = init?.signal;
          return new Promise<Response>((resolve) => { resolveOld = resolve; });
        }
        return Response.json({ success: true, ip: "1.1.1.1", country: "新结果" });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("观察到出口差异");
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    const input = lookup.getByRole("textbox", { name: "IP、域名或网址" });
    await user.type(input, "8.8.8.8");
    vi.useFakeTimers();
    fireEvent.click(lookup.getByRole("button", { name: "查询" }));
    expect(lookup.getByRole("button", { name: "查询" })).toBeEnabled();
    expect(lookup.getByRole("status")).toHaveTextContent("正在查询 8.8.8.8");
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith("https://ipwho.is/"))).toHaveLength(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(lookup.getByRole("alert")).toHaveTextContent("查询超时，请重试。");
    expect(oldSignal?.aborted).toBe(true);
    vi.useRealTimers();
    await user.clear(input);
    await user.type(input, "1.1.1.1");
    await user.click(lookup.getByRole("button", { name: "查询" }));
    expect(lookup.getByText("新结果")).toBeInTheDocument();
    await act(async () => {
      resolveOld(Response.json({ success: true, ip: "8.8.8.8", country: "旧结果" }));
    });
    expect(lookup.getByText("新结果")).toBeInTheDocument();
    expect(lookup.queryByText("旧结果")).not.toBeInTheDocument();
  });

  it.each(["192.0.0.9", "192.0.0.10", "2001:1::1", "2001:1::2", "2001:1::3", "2001:20::1"])(
    "允许查询已注册的特殊公网地址 %s", async (ip) => {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
        if (String(input).startsWith("https://ipwho.is/")) {
          return Response.json({ success: true, ip, country: "公开归属资料" });
        }
        return responseFor(input);
      }));
      const user = userEvent.setup();
      render(<App />);
      const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
      await user.type(lookup.getByRole("textbox", { name: "IP、域名或网址" }), ip);
      await user.click(lookup.getByRole("button", { name: "查询" }));
      expect(await lookup.findByText("公开归属资料")).toBeInTheDocument();
    },
  );

  it.each(["8.8.8.8", "https://example.com/private?secret=hidden#fragment"])("手动查询 %s 独立于出口检测，不写入网址、持久存储或匿名事件，刷新后为空", async (value) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith("https://cloudflare-dns.com/")) {
        const type = new URL(String(input)).searchParams.get("type") as "A" | "AAAA";
        return dnsResponse("example.com", type, type === "A" ? ["8.8.8.8"] : []);
      }
      if (String(input).startsWith("https://ipwho.is/")) {
        return Response.json({ success: true, ip: "8.8.8.8", country: "美国" });
      }
      return responseFor(input);
    });
    vi.stubGlobal("fetch", fetcher);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const originalUrl = window.location.href;
    const user = userEvent.setup();
    const rendered = render(<StrictMode><App /></StrictMode>);
    await screen.findByText("观察到出口差异");
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox", { name: "IP、域名或网址" }), value);
    await user.click(lookup.getByRole("button", { name: "查询" }));
    expect(await lookup.findByText("美国")).toBeInTheDocument();
    expect(lookup.getByText(/目标 IP 会提交给 IPWhois/)).toBeInTheDocument();
    expect(lookup.getByText(/不代表设备的精确物理位置/)).toBeInTheDocument();
    expect(window.location.href).toBe(originalUrl);
    expect(JSON.stringify([storage.mock.calls, pushState.mock.calls, replaceState.mock.calls])).not.toContain("8.8.8.8");
    expect(JSON.stringify([storage.mock.calls, pushState.mock.calls, replaceState.mock.calls])).not.toContain("example.com");
    const analytics = fetcher.mock.calls.filter(([input]) => input === "/api/analytics");
    expect(analytics).toHaveLength(2);
    expect(JSON.stringify(analytics)).not.toContain("8.8.8.8");
    expect(JSON.stringify(analytics)).not.toContain("example.com");
    expect(fetcher.mock.calls.filter(([input]) => input === "/api/observe")).toHaveLength(1);
    expect(screen.getByText("112.10.247.224")).toBeInTheDocument();
    if (value.startsWith("https://")) {
      await user.click(lookup.getByRole("button", { name: "查询" }));
      expect(await lookup.findByText("美国")).toBeInTheDocument();
      expect(fetcher.mock.calls.filter(([input]) => String(input).startsWith("https://cloudflare-dns.com/"))).toHaveLength(4);
    }

    rendered.unmount();
    render(<App />);
    const refreshed = within(screen.getByRole("region", { name: "IP 查询" }));
    expect(refreshed.getByRole("textbox", { name: "IP、域名或网址" })).toHaveValue("");
    expect(refreshed.queryByText("8.8.8.8")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([input]) => String(input).startsWith("https://ipwho.is/"))).toHaveLength(1);
  });

  it("离开页面会取消查询，旧响应不会进入后续查询结果", async () => {
    let resolveOld!: (response: Response) => void;
    let oldSignal: AbortSignal | null | undefined;
    let firstQuery = true;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).startsWith("https://ipwho.is/")) {
        if (firstQuery) {
          firstQuery = false;
          oldSignal = init?.signal;
          return new Promise<Response>((resolve) => { resolveOld = resolve; });
        }
        return Response.json({ success: true, ip: "8.8.8.8", country: "新查询资料" });
      }
      return responseFor(input);
    }));
    const user = userEvent.setup();
    const rendered = render(<App />);
    const lookup = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(lookup.getByRole("textbox", { name: "IP、域名或网址" }), "8.8.8.8");
    await user.click(lookup.getByRole("button", { name: "查询" }));
    rendered.unmount();
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { resolveOld(Response.json({ success: true, ip: "8.8.8.8", country: "旧查询资料" })); });

    render(<App />);
    const refreshed = within(screen.getByRole("region", { name: "IP 查询" }));
    await user.type(refreshed.getByRole("textbox", { name: "IP、域名或网址" }), "8.8.8.8");
    await user.click(refreshed.getByRole("button", { name: "查询" }));
    expect(await refreshed.findByText("新查询资料")).toBeInTheDocument();
    expect(refreshed.queryByText("旧查询资料")).not.toBeInTheDocument();
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

  it("页眉提供图标主题切换且不再渲染菜单按钮", () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => responseFor(input));
    vi.stubGlobal("fetch", fetcher);

    render(<App />);

    expect(
      screen.getByRole("button", {
        name: "当前：跟随系统。点击切换为浅色",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "打开导航" }),
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
