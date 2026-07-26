import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

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

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
      expect(fetcher).toHaveBeenCalledTimes(6);
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
      expect(fetcher).toHaveBeenCalledTimes(3);
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
});
