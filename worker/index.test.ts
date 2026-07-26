import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

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
