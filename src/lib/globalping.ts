import { z } from "zod";
import { MAX_PING_PROBES, type PingCoverage } from "@/lib/ping-probes";

const API = "https://api.globalping.io/v1";
const count = z.number().int().nonnegative();
const rtt = z.number().nonnegative().nullable();
const locationSchema = z.object({
  country: z.string(),
  city: z.string(),
  asn: count,
  network: z.string(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});
const probeSchema = z.object({
  location: locationSchema,
  tags: z.array(z.string()),
});
const statsSchema = z
  .object({
    min: rtt,
    avg: rtt,
    max: rtt,
    total: count,
    rcv: count,
    drop: count,
    loss: z.number().min(0).max(100),
  })
  .refine(
    (s) =>
      s.rcv + s.drop === s.total &&
      (s.rcv === 0 || (s.min !== null && s.avg !== null && s.max !== null)),
    "Invalid packet statistics",
  );
const resultSchema = z.object({
  probe: locationSchema.extend({ tags: z.array(z.string()) }),
  result: z
    .object({
      status: z.enum(["in-progress", "finished", "failed", "offline"]),
      failureSource: z.string().optional(),
      resolvedAddress: z.string().nullable().optional(),
      rawOutput: z.string().optional(),
      stats: statsSchema.optional(),
    })
    .refine((r) => r.status !== "finished" || r.stats !== undefined),
});
const measurementSchema = z.object({
  id: z.string(),
  status: z.enum(["in-progress", "finished"]),
  probesCount: count.max(MAX_PING_PROBES),
  results: z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row): z.infer<typeof resultSchema>[] => {
      const parsed = resultSchema.safeParse(row);
      if (parsed.success) return [parsed.data];
      const location = resultSchema.pick({ probe: true }).safeParse(row);
      return location.success
        ? [
            {
              probe: location.data.probe,
              result: { status: "failed", failureSource: "invalid-data" },
            },
          ]
        : [];
    }),
  ),
});
const limitsSchema = z.object({
  rateLimit: z.object({
    measurements: z.object({
      create: z.object({ remaining: count, limit: count, reset: count }),
    }),
  }),
});
export type PingProbe = z.infer<typeof probeSchema>;
export type PingRow = z.infer<typeof resultSchema>;
export type PingMeasurement = z.infer<typeof measurementSchema>;
export type PingLimits = {
  remaining: number;
  limit: number;
  resetsAt: number | null;
};

export class GlobalpingError extends Error {}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (response.status === 429) {
    const retry = response.headers.get("Retry-After");
    throw new GlobalpingError(
      `免费额度或请求频率已受限，请${retry ? `在 ${retry} 秒后` : "稍后"}重试；不会自动重测。`,
    );
  }
  if (!response.ok)
    throw new GlobalpingError(
      `Globalping API 请求失败（${response.status}），请稍后手动重试。`,
    );
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new GlobalpingError("Globalping 返回的数据无效，无法判断本轮结果。");
  return parsed.data;
}

export const readPingProbes = (signal: AbortSignal) =>
  request("/probes", z.array(probeSchema), signal);
export async function readPingLimits(signal: AbortSignal): Promise<PingLimits> {
  const result = (await request("/limits", limitsSchema, signal)).rateLimit
    .measurements.create;
  return {
    remaining: result.remaining,
    limit: result.limit,
    resetsAt: result.reset > 0 ? Date.now() + result.reset * 1000 : null,
  };
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 550);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

export async function measurePing(
  target: string,
  ipVersion: 4 | 6 | null,
  locations: PingCoverage["locations"],
  signal: AbortSignal,
  update: (result: PingMeasurement) => void,
) {
  const created = await request(
    "/measurements",
    z.object({
      id: z.string().min(1).max(200),
      probesCount: count.max(MAX_PING_PROBES),
    }),
    signal,
    {
      type: "ping",
      target,
      locations,
      inProgressUpdates: true,
      measurementOptions: {
        protocol: "ICMP",
        packets: 5,
        ...(ipVersion ? { ipVersion } : {}),
      },
    },
  );
  if (signal.aborted) return;
  update({
    id: created.id,
    status: "in-progress",
    probesCount: created.probesCount,
    results: [],
  });
  const deadline = Date.now() + 45_000;
  while (!signal.aborted) {
    const result = await request(
      `/measurements/${encodeURIComponent(created.id)}`,
      measurementSchema,
      signal,
    );
    if (signal.aborted) return;
    update(result);
    if (result.status !== "in-progress") return;
    if (Date.now() >= deadline)
      throw new GlobalpingError(
        "等待测量结果超时；已返回结果保留，其余节点无法判断。可稍后手动重测。",
      );
    await pause(signal);
  }
}
