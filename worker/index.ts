const API_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

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

export default {
  async fetch(request: Request): Promise<Response> {
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
