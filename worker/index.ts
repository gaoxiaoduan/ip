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

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      ...API_HEADERS,
      ...init.headers,
    },
  });

const observeRequest = (request: Request) => {
  const cf = request.cf;
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Real-IP") ??
    "";
  const countryCode = cf?.country ?? "";

  return json({
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
  });
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
