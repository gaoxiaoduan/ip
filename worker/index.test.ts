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

const MCP_HEADERS = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
};

const mcpRequest = (
  method: string,
  id: number,
  params: Record<string, unknown> = {},
) =>
  new Request("https://ip.33338888.xyz/mcp", {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });

const mcpResponse = async (request: Request) => {
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
  return response;
};

describe("MCP Apps", () => {
  it("advertises the MCP Apps extension during initialization", async () => {
    const response = await mcpResponse(
      mcpRequest("initialize", 1, {
        protocolVersion: "2025-06-18",
        capabilities: {
          extensions: {
            "io.modelcontextprotocol/ui": {
              mimeTypes: ["text/html;profile=mcp-app"],
            },
          },
        },
        clientInfo: {
          name: "orank-test",
          version: "1.0.0",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      result: {
        capabilities: {
          extensions: {
            "io.modelcontextprotocol/ui": {
              mimeTypes: ["text/html;profile=mcp-app"],
            },
          },
        },
      },
    });
  });

  it("exposes an app-linked tool and ui resource", async () => {
    const toolsResponse = await mcpResponse(mcpRequest("tools/list", 2));
    const resourcesResponse = await mcpResponse(
      mcpRequest("resources/list", 3),
    );
    const toolsBody = (await toolsResponse.json()) as {
      result: { tools: Array<{ name: string; _meta?: { ui?: { resourceUri?: string } } }> };
    };
    const resourcesBody = (await resourcesResponse.json()) as {
      result: { resources: Array<{ uri: string; mimeType?: string }> };
    };

    expect(toolsResponse.status).toBe(200);
    expect(toolsBody.result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "observe_ip",
          _meta: expect.objectContaining({
            ui: expect.objectContaining({
              resourceUri: "ui://ip-exit-observer/observe.html",
            }),
          }),
        }),
      ]),
    );
    expect(resourcesResponse.status).toBe(200);
    expect(resourcesBody.result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: "ui://ip-exit-observer/observe.html",
          mimeType: "text/html;profile=mcp-app",
        }),
      ]),
    );
  });

  it("returns the interactive ui resource with CSP metadata", async () => {
    const response = await mcpResponse(
      mcpRequest("resources/read", 4, {
        uri: "ui://ip-exit-observer/observe.html",
      }),
    );
    const body = (await response.json()) as {
      result: {
        contents: Array<{
          uri: string;
          mimeType: string;
          text: string;
          _meta?: { ui?: { csp?: { resourceDomains?: string[] } } };
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.result.contents[0]).toMatchObject({
      uri: "ui://ip-exit-observer/observe.html",
      mimeType: "text/html;profile=mcp-app",
      text: expect.stringContaining('name="color-scheme"'),
      _meta: {
        ui: {
          csp: {
            resourceDomains: ["https://esm.sh"],
          },
        },
      },
    });
    expect(body.result.contents[0]?.text).toContain(
      "http-equiv=\"Content-Security-Policy\"",
    );
  });
});
