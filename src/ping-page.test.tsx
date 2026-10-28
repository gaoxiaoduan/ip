import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

const location = (
  city: string,
  asn: number,
  longitude: number,
  latitude: number,
  country = "CN",
) => ({
  continent: "AS",
  region: "Eastern Asia",
  country,
  state: null,
  city,
  asn,
  network:
    asn === 4134
      ? "China Telecom"
      : asn === 4837
        ? "China Unicom"
        : "China Mobile",
  longitude,
  latitude,
});
const locations = [
  location("Guangzhou", 4134, 113.26, 23.13),
  location("Wuhan", 4837, 114.3, 30.59),
  location("Shanghai", 9808, 121.47, 31.23),
];
const probes = locations.map((location) => ({
  location,
  tags: ["system:eyeball-network"],
  resolvers: ["private"],
}));
const result = (index: number, avg = 20, rcv = 5) => ({
  probe: {
    ...locations[index],
    tags: ["system:eyeball-network"],
    resolvers: ["private"],
  },
  result: {
    status: "finished",
    resolvedAddress: "8.8.8.8",
    resolvedHostname: "example.com",
    stats: {
      min: avg - 2,
      avg,
      max: avg + 2,
      total: 5,
      rcv,
      drop: 5 - rcv,
      loss: (5 - rcv) * 20,
    },
    timings: [],
    rawOutput: "",
  },
});
const measurement = (
  results: unknown[] = [result(0), result(1, 40), result(2, 60)],
  status = "finished",
) => ({
  id: "measurement-1",
  type: "ping",
  status,
  target: "example.com",
  probesCount: 3,
  createdAt: "2026-10-28T00:00:00Z",
  updatedAt: "2026-10-28T00:00:01Z",
  results,
});
const installApi = (
  read: () => unknown = () => measurement(),
  online: unknown = probes,
  create: () => Response | Promise<Response> = () =>
    Response.json({ id: "measurement-1", probesCount: 3 }, { status: 202 }),
  remaining = 250,
) => {
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/probes")) return Response.json(online);
    if (url.endsWith("/limits"))
      return Response.json({
        rateLimit: {
          measurements: {
            create: { type: "ip", limit: 250, remaining, reset: 0 },
          },
        },
      });
    if (url.endsWith("/measurements") && init?.method === "POST")
      return create();
    if (url.endsWith("/measurements/measurement-1"))
      return Response.json(await read());
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};
const openPage = () => {
  window.history.replaceState({}, "", "/ping");
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};
const submit = async (target = "example.com") => {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "测试目标" }), target);
  await user.click(screen.getByRole("button", { name: "开始测试" }));
  return user;
};

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("多地 Ping 独立页面", () => {
  it("只在明确提交后创建一次真实 ICMP 任务，并展示同一轮节点、地图和汇总", async () => {
    const fetcher = installApi();
    openPage();
    expect(
      await screen.findByRole("heading", { name: "多地 Ping" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/测量目标和结果公开/)).toBeInTheDocument();
    await screen.findByText(/3 个可选节点/);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
    await submit("https://Example.COM:8443/private?secret=value#fragment");
    expect(await screen.findByText("本轮已完成")).toBeInTheDocument();
    const posts = fetcher.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(posts).toHaveLength(1);
    expect(posts[0]?.[0]).toBe("https://api.globalping.io/v1/measurements");
    expect(JSON.parse(String(posts[0]?.[1]?.body))).toMatchObject({
      target: "example.com",
      type: "ping",
      inProgressUpdates: true,
      measurementOptions: { protocol: "ICMP", packets: 5, ipVersion: 4 },
    });
    expect(String(posts[0]?.[1]?.body)).not.toMatch(
      /private|secret|8443|fragment/,
    );
    const details = within(screen.getByRole("table", { name: "节点明细" }));
    expect(details.getAllByText("8.8.8.8")).toHaveLength(3);
    const summary = within(
      screen.getByRole("table", { name: "地区和运营商汇总" }),
    );
    expect(
      within(summary.getByRole("row", { name: /全部节点/ })).getByText(
        "40.00 ms",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /中国地区测量地图/ }),
    ).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe("/ping");
  });

  it("按响应包加权汇总，探针失败不算目标丢包，地图只给有证据的省份着色", async () => {
    installApi(() =>
      measurement([
        result(0, 20, 5),
        result(1, 60, 1),
        {
          probe: { ...locations[2], tags: [] },
          result: {
            status: "failed",
            failureSource: "internal",
            rawOutput: "internal error",
          },
        },
      ]),
    );
    openPage();
    await screen.findByText(/3 个可选节点/);
    await submit();
    await screen.findByText("本轮已完成");
    const all = within(screen.getByRole("row", { name: /^全部节点/ }));
    expect(all.getByText("26.67 ms")).toBeInTheDocument();
    expect(all.getByText("40.0%")).toBeInTheDocument();
    expect(all.getByText("0 / 1")).toBeInTheDocument();
    expect(screen.getByText("探针内部失败")).toBeInTheDocument();
    expect(
      screen.getByText("广东省：1 个节点，平均 20.00 ms"),
    ).toBeInTheDocument();
    expect(screen.getByText("北京市：未测，无数据")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /^广东省/ })).toBeInTheDocument();
  });

  it("不会把中国云节点冒充三网，缺少探针时明确说明且不创建测量", async () => {
    const fetcher = installApi(undefined, [
      {
        ...probes[0],
        location: { ...locations[0], asn: 45090, network: "Tencent Cloud" },
      },
    ]);
    openPage();
    await screen.findByText(/0 个可选节点/);
    expect(screen.getByText("电信：当前无可用节点")).toBeInTheDocument();
    await submit();
    expect(await screen.findByText(/所选范围无可用节点/)).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });

  it("节点数据损坏只让该节点无法判断，不吞掉其他成功证据", async () => {
    installApi(() =>
      measurement([
        result(0),
        { ...result(1), result: { status: "finished", stats: { avg: -5 } } },
        result(2),
      ]),
    );
    openPage();
    await screen.findByText(/3 个可选节点/);
    await submit();
    await screen.findByText("本轮已完成");
    const details = within(screen.getByRole("table", { name: "节点明细" }));
    expect(details.getAllByText("8.8.8.8")).toHaveLength(2);
    expect(details.getByText("节点数据无效，无法判断")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /^全部节点/ })).getByText("0 / 1"),
    ).toBeInTheDocument();
  });

  it("创建后立刻显示实际参与数，逐步展示结果且每次响应后才安排下一次读取", async () => {
    let release!: (value: unknown) => void;
    const read = vi
      .fn<() => unknown>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockImplementation(() => measurement());
    installApi(read);
    openPage();
    await screen.findByText(/3 个可选节点/);
    await submit();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("参与 3");
    vi.useFakeTimers();
    await act(async () => release(measurement([result(0)], "in-progress")));
    expect(
      within(screen.getByRole("table", { name: "节点明细" })).getByText(
        "8.8.8.8",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("本轮已完成")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(549));
    expect(read).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getByText("本轮已完成")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("IPv6 字面地址按自身地址族提交，不显示会误导为 IPv4 的域名选择器", async () => {
    const fetcher = installApi(() =>
      measurement([
        {
          ...result(0),
          result: {
            ...result(0).result,
            resolvedAddress: "2606:4700:4700::1111",
          },
        },
      ]),
    );
    openPage();
    await screen.findByText(/3 个可选节点/);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox", { name: "测试目标" }));
    await user.paste("https://[2606:4700:4700::1111]:8443/private?q=secret");
    expect(
      screen.queryByRole("combobox", { name: "域名地址族" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始测试" }));
    await screen.findByText("本轮已完成");
    const body = JSON.parse(
      String(
        fetcher.mock.calls.find(([, init]) => init?.method === "POST")?.[1]
          ?.body,
      ),
    );
    expect(body.target).toBe("2606:4700:4700::1111");
    expect(body.measurementOptions).not.toHaveProperty("ipVersion");
    expect(
      within(screen.getByRole("table", { name: "节点明细" })).getByText(
        "2606:4700:4700::1111",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    "localhost",
    "router.home.arpa",
    "192.168.1.1",
    "::1",
    "100.64.0.1",
    "https://user:secret@example.com/private",
    "not a host",
  ])("目标 %s 在本地拒绝，不会创建第三方测量", async (target) => {
    const fetcher = installApi();
    openPage();
    await screen.findByText(/3 个可选节点/);
    const user = userEvent.setup();
    await user.click(screen.getByRole("textbox", { name: "测试目标" }));
    await user.paste(target);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(
      /请输入|不支持远端测量/,
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
    expect(window.location.pathname + window.location.search).toBe("/ping");
  });

  it("429 只提示限额和恢复间隔，不自动重建任务或提供付费入口", async () => {
    const fetcher = installApi(undefined, probes, () =>
      Response.json(
        { error: { message: "limit" } },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    openPage();
    await screen.findByText(/3 个可选节点/);
    await submit();
    expect(await screen.findByText(/在 60 秒后重试/)).toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /充值|登录|付费/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("本轮已完成")).not.toBeInTheDocument();
  });

  it("离开页面中止本地等待，迟到结果不进入下一次页面会话", async () => {
    let release!: (value: unknown) => void;
    const fetcher = installApi(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const page = openPage();
    await screen.findByText(/3 个可选节点/);
    await submit();
    await waitFor(() => expect(release).toBeDefined());
    const oldSignal = fetcher.mock.calls.find(([url]) =>
      String(url).includes("/measurements/measurement-1"),
    )?.[1]?.signal;
    page.unmount();
    expect(oldSignal?.aborted).toBe(true);
    openPage();
    await screen.findByText(/3 个可选节点/);
    await act(async () => release(measurement()));
    expect(screen.getByText("等待开始测试")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table", { name: "节点明细" })).queryByText(
        "8.8.8.8",
      ),
    ).not.toBeInTheDocument();
  });

  it("勾选港澳台和海外后兼顾两个范围，整轮最多十二个且大陆每网最多三个城市", async () => {
    const domestic = [4134, 4837, 9808].flatMap((asn) =>
      ["Beijing", "Guangzhou", "Shanghai"].map((city) => ({
        ...probes[0],
        location: location(city, asn, 113, 23),
      })),
    );
    const foreign = ["HK", "TW", "AU", "DE", "FR"].map((country) => ({
      ...probes[0],
      location: location("Example City", 15169, 0, 0, country),
    }));
    const fetcher = installApi(undefined, [...domestic, ...foreign]);
    openPage();
    await screen.findByText(/9 个可选节点/);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "港澳台" }));
    await user.click(screen.getByRole("checkbox", { name: "海外" }));
    await submit();
    await screen.findByText("本轮已完成");
    const body = JSON.parse(
      String(
        fetcher.mock.calls.find(([, init]) => init?.method === "POST")?.[1]
          ?.body,
      ),
    );
    expect(body.locations).toHaveLength(12);
    expect(
      body.locations.filter((l: { country: string }) =>
        ["HK", "MO", "TW"].includes(l.country),
      ),
    ).toHaveLength(1);
    expect(body).not.toHaveProperty("limit");
    for (const asn of [4134, 4837, 9808]) {
      expect(
        body.locations.filter((l: { asn: number }) => l.asn === asn),
      ).toHaveLength(3);
    }
  });

  it("已知额度不足时在创建前阻止测量", async () => {
    const fetcher = installApi(undefined, probes, undefined, 2);
    openPage();
    await screen.findByText("免费节点额度 2 / 250");
    await submit();
    expect(
      await screen.findByText(/免费额度不足以完成所选节点/),
    ).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
  });

  it("快速重复点击只创建一次任务，退出后不会继续读取已创建的测量", async () => {
    let release!: (response: Response) => void;
    const fetcher = installApi(
      undefined,
      probes,
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const page = openPage();
    await screen.findByText(/3 个可选节点/);
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "测试目标" }),
      "example.com",
    );
    await user.dblClick(screen.getByRole("button", { name: "开始测试" }));
    await waitFor(() => expect(release).toBeDefined());
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
    page.unmount();
    await act(async () =>
      release(
        Response.json({ id: "measurement-1", probesCount: 3 }, { status: 202 }),
      ),
    );
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).endsWith("/measurements/measurement-1"),
      ),
    ).toBe(false);
  });

  it("无响应保留真实发包及丢包，不伪造 0 ms；解析和内部失败单列无法判断", async () => {
    installApi(() =>
      measurement([
        {
          ...result(0),
          result: {
            ...result(0).result,
            stats: {
              min: null,
              avg: null,
              max: null,
              total: 5,
              rcv: 0,
              drop: 5,
              loss: 100,
            },
          },
        },
        {
          ...result(1),
          result: {
            status: "failed",
            failureSource: "resolver",
            rawOutput: "error",
          },
        },
        {
          ...result(2),
          result: {
            status: "failed",
            failureSource: "internal",
            rawOutput: "error",
          },
        },
      ]),
    );
    openPage();
    await screen.findByText(/3 个可选节点/);
    await submit();
    await screen.findByText("本轮已完成");
    expect(screen.getByText("目标未响应")).toBeInTheDocument();
    expect(screen.getByText("解析失败（服务商判断）")).toBeInTheDocument();
    const all = within(screen.getByRole("row", { name: /^全部节点/ }));
    expect(all.getByText("100.0%")).toBeInTheDocument();
    expect(all.getByText("1 / 2")).toBeInTheDocument();
    expect(all.queryByText("0.00 ms")).not.toBeInTheDocument();
    expect(
      screen.getByText("广东省：1 个节点，目标未响应"),
    ).toBeInTheDocument();
  });
});
