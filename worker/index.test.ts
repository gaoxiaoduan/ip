import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import worker from "./index";

describe("GET /api/observe", () => {
  it("返回请求出口与 Cloudflare 归属地，并禁止缓存", async () => {
    const request = new Request("https://ip.33338888.xyz/api/observe", {
      headers: {
        "CF-Connecting-IP": "203.0.113.42",
      },
    });
    Object.defineProperty(request, "cf", {
      value: {
        asn: 64500,
        asOrganization: "Example Network",
        city: "Tokyo",
        colo: "NRT",
        country: "JP",
        region: "Tokyo",
      },
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(await response.json()).toMatchObject({
      ok: true,
      ip: "203.0.113.42",
      country: "JP",
      countryCode: "JP",
      region: "Tokyo",
      city: "Tokyo",
      organization: "Example Network",
      network: "AS64500",
    });
  });
});

describe("POST /api/analytics", () => {
  it("仅聚合允许的检测完成事件", async () => {
    const writeDataPoint = vi.fn();
    const analyticsEnv = {
      OPTIMIZATION_EVENTS: {
        writeDataPoint,
      },
      VITE_POSTHOG_KEY: "",
      VITE_POSTHOG_HOST: "",
    } satisfies Env;
    const request = new Request("https://ip.33338888.xyz/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "detection_completed",
        pageType: "home",
        sourceCategory: "search",
        outcome: "comparable",
      }),
    });
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, analyticsEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ["detection_completed", "home", "search", "comparable"],
      doubles: [1],
    });
  });

  it("拒绝包含敏感字段的匿名优化事件", async () => {
    const writeDataPoint = vi.fn();
    const analyticsEnv = {
      OPTIMIZATION_EVENTS: {
        writeDataPoint,
      },
      VITE_POSTHOG_KEY: "",
      VITE_POSTHOG_HOST: "",
    } satisfies Env;
    const request = new Request("https://ip.33338888.xyz/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "detection_started",
        pageType: "home",
        sourceCategory: "direct",
        ip: "203.0.113.42",
      }),
    });
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, analyticsEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
