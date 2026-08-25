import {
  ANALYTICS_EVENT_NAMES,
  DETECTION_OUTCOMES,
  PAGE_TYPES,
  SOURCE_CATEGORIES,
  type AnalyticsEventName,
  type DetectionOutcome,
  type PageType,
  type SourceCategory,
} from "../src/lib/optimization-event-schema";
import {
  EXTENSION_ID,
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MCP_APP_HTML, MCP_APP_RESOURCE_URI } from "./mcp-app";

const API_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

type OptimizationEvent = {
  event: AnalyticsEventName;
  pageType: PageType;
  sourceCategory: SourceCategory;
  outcome?: DetectionOutcome;
};

type Observation = {
  ok: true;
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  organization: string;
  network: string;
  colo: string;
  source: string;
};

type AppsServerOptions = ServerOptions & {
  capabilities: NonNullable<ServerOptions["capabilities"]> & {
    extensions: Record<string, { mimeTypes: string[] }>;
  };
};

const MCP_HEADERS = {
  "Access-Control-Allow-Headers":
    "Accept, Content-Type, Mcp-Method, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Cache-Control": "no-store, max-age=0",
} as const;

const MCP_SERVER_INSTRUCTIONS =
  "Use this server when you need the public IP and Cloudflare network metadata observed for the current MCP request. Call observe_ip with no arguments. The result describes this request only and is not a precise location or a diagnosis of all traffic.";

const observe = (request: Request): Observation => {
  const cf = request.cf as
    | {
        asn?: number;
        asOrganization?: string;
        city?: string;
        colo?: string;
        country?: string;
        region?: string;
      }
    | undefined;
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Real-IP") ??
    "";
  const countryCode = cf?.country ?? "";

  return {
    ok: true,
    ip,
    country: countryCode || "未知",
    countryCode,
    region: cf?.region ?? "",
    city: cf?.city ?? "",
    organization: cf?.asOrganization ?? "",
    network: typeof cf?.asn === "number" ? `AS${String(cf.asn)}` : "",
    colo: cf?.colo ?? "",
    source: "Cloudflare request metadata",
  };
};

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      ...API_HEADERS,
      ...init.headers,
    },
  });

const observeRequest = (request: Request) => json(observe(request));

const createMcpServer = (request: Request) => {
  const serverOptions: AppsServerOptions = {
    instructions: MCP_SERVER_INSTRUCTIONS,
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      extensions: {
        [EXTENSION_ID]: {
          mimeTypes: [RESOURCE_MIME_TYPE],
        },
      },
    },
  };
  const server = new McpServer(
    {
      name: "ip-exit-observer",
      version: "0.1.0",
    },
    serverOptions,
  );

  registerAppTool(
    server,
    "observe_ip",
    {
      title: "读取当前 IP 出口",
      description:
        "读取当前 MCP 请求被 Cloudflare 观察到的公网 IP、国家/地区、城市、网络组织、ASN 和边缘机房。只描述本次请求，不代表精确物理位置或全部流量。",
      inputSchema: {
        detail: z
          .enum(["summary", "full"])
          .optional()
          .describe("返回摘要或完整的当前请求观测；默认返回完整观测。"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: MCP_APP_RESOURCE_URI,
          visibility: ["model", "app"],
        },
      },
    },
    async (): Promise<CallToolResult> => {
      const result = observe(request);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  registerAppResource(
    server,
    "IP 出口检测交互视图",
    MCP_APP_RESOURCE_URI,
    {
      description: "显示当前 MCP 请求出口观测的交互式 MCP App。",
      _meta: {
        ui: {
          csp: {
            resourceDomains: ["https://esm.sh"],
          },
          prefersBorder: true,
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: MCP_APP_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: MCP_APP_HTML,
          _meta: {
            ui: {
              csp: {
                resourceDomains: ["https://esm.sh"],
              },
              prefersBorder: true,
            },
          },
        },
      ],
    }),
  );

  return server;
};

const addMcpHeaders = (response: Response) => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(MCP_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const mcpError = (status: number, code: number, message: string) =>
  addMcpHeaders(
    Response.json(
      {
        jsonrpc: "2.0",
        error: { code, message },
        id: null,
      },
      { status },
    ),
  );

const handleMcpRequest = async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: MCP_HEADERS });
  }

  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return mcpError(413, -32000, "MCP request body is too large");
  }

  const server = createMcpServer(request);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return addMcpHeaders(await transport.handleRequest(request));
};

const isOneOf = <Value extends string>(
  value: unknown,
  allowedValues: readonly Value[],
): value is Value =>
  typeof value === "string" && allowedValues.includes(value as Value);

const parseOptimizationEvent = (payload: unknown): OptimizationEvent | null => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (
    !isOneOf(record.event, ANALYTICS_EVENT_NAMES) ||
    !isOneOf(record.pageType, PAGE_TYPES) ||
    !isOneOf(record.sourceCategory, SOURCE_CATEGORIES)
  ) {
    return null;
  }

  if (record.event === "detection_completed") {
    if (
      Object.keys(record).some(
        (key) => !["event", "pageType", "sourceCategory", "outcome"].includes(key),
      ) ||
      !isOneOf(record.outcome, DETECTION_OUTCOMES)
    ) {
      return null;
    }

    return {
      event: record.event,
      pageType: record.pageType,
      sourceCategory: record.sourceCategory,
      outcome: record.outcome,
    };
  }

  if (
    Object.keys(record).some(
      (key) => !["event", "pageType", "sourceCategory"].includes(key),
    ) ||
    "outcome" in record
  ) {
    return null;
  }

  return {
    event: record.event,
    pageType: record.pageType,
    sourceCategory: record.sourceCategory,
  };
};

const collectOptimizationEvent = (event: OptimizationEvent, env: Env) => {
  env.OPTIMIZATION_EVENTS.writeDataPoint({
    blobs: [
      event.event,
      event.pageType,
      event.sourceCategory,
      event.outcome ?? "",
    ],
    doubles: [1],
  });
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return new Response(null, {
          status: 204,
          headers: API_HEADERS,
        });
      }

      if (url.pathname === "/mcp") {
        return await handleMcpRequest(request);
      }

      if (url.pathname === "/api/observe") {
        if (request.method !== "GET") {
          return json(
            {
              error: "Method not allowed",
            },
            {
              status: 405,
              headers: {
                Allow: "GET, OPTIONS",
              },
            },
          );
        }

        return observeRequest(request);
      }

      if (url.pathname === "/api/analytics") {
        if (request.method !== "POST") {
          return json(
            {
              error: "Method not allowed",
            },
            {
              status: 405,
              headers: {
                Allow: "POST, OPTIONS",
              },
            },
          );
        }

        const contentLength = Number(request.headers.get("Content-Length"));
        if (Number.isFinite(contentLength) && contentLength > 1024) {
          return json({ error: "Invalid analytics event" }, { status: 400 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid analytics event" }, { status: 400 });
        }

        const event = parseOptimizationEvent(payload);
        if (!event) {
          return json({ error: "Invalid analytics event" }, { status: 400 });
        }

        collectOptimizationEvent(event, env);
        return new Response(null, {
          status: 204,
          headers: API_HEADERS,
        });
      }

      return json(
        {
          error: "Not found",
        },
        {
          status: 404,
        },
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "request failed",
          error: error instanceof Error ? error.message : String(error),
          path: url.pathname,
        }),
      );

      return json(
        {
          error: "Internal server error",
        },
        {
          status: 500,
        },
      );
    }
  },
} satisfies ExportedHandler<Env>;
