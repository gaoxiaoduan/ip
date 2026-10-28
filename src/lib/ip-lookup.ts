import ipaddr from "ipaddr.js";
import { z } from "zod";

const ipAddressSchema = z.union([z.ipv4(), z.ipv6()]);
const localAddressTypes: Readonly<Record<string, string>> = {
  private: "内网地址",
  uniqueLocal: "内网地址",
  loopback: "回环地址",
  linkLocal: "链路本地地址",
  carrierGradeNat: "共享地址",
  unspecified: "未指定地址",
  multicast: "组播地址",
  broadcast: "广播地址",
  reserved: "保留地址",
  benchmarking: "保留地址",
  deprecatedSiteLocal: "保留地址",
  deprecatedOrchid: "保留地址",
  discard: "保留地址",
  rfc6145: "保留地址",
  segmentRouting: "保留地址",
};

// IANA lists these globally reachable exceptions inside protocol-assignment blocks.
// https://www.iana.org/assignments/iana-ipv4-special-registry/
// https://www.iana.org/assignments/iana-ipv6-special-registry/
const publicProtocolAddresses = new Set([
  "192.0.0.9", "192.0.0.10", "2001:1::1", "2001:1::2", "2001:1::3",
]);
const globalIpv6Range = ipaddr.IPv6.parseCIDR("2000::/3");
const localTranslationRange = ipaddr.IPv6.parseCIDR("64:ff9b:1::/48");

export function inspectIpAddress(input: string): { ip: string; localType?: string } | null {
  const ip = input.trim();
  if (ip.includes("%") || !ipAddressSchema.safeParse(ip).success) return null;
  const address = ipaddr.process(ip);
  if (publicProtocolAddresses.has(address.toString())) return { ip };
  const range = address.range();
  let localType = localAddressTypes[range];
  // Unassigned IPv6 unicast space is reserved; NAT64 has a separate local-use range.
  // https://www.iana.org/assignments/ipv6-address-space/
  if (address instanceof ipaddr.IPv6 && (
    (range === "unicast" && !address.match(globalIpv6Range)) || address.match(localTranslationRange)
  )) {
    localType = "保留地址";
  }
  return { ip, localType };
}

export const IP_GEO_SOURCE = {
  label: "IPWhois",
  url: "https://ipwhois.io/",
} as const;

export interface IpGeoInfo {
  readonly ip: string;
  readonly country?: string;
  readonly countryCode?: string;
  readonly flagEmoji?: string;
  readonly region?: string;
  readonly city?: string;
  readonly isp?: string;
  readonly network?: string;
}

export const getFlagEmoji = (countryCode?: string): string => {
  if (!countryCode || !/^[a-z]{2}$/i.test(countryCode)) return "";
  return String.fromCodePoint(
    ...countryCode.toUpperCase().split("").map((char) => 127397 + char.charCodeAt(0)),
  );
};

const geoCache = new Map<string, IpGeoInfo>();

const failureMessages = {
  invalid: "请输入一个完整的 IPv4 或 IPv6 地址。",
  local: "无公网归属地。",
  limited: "查询请求已达服务限额，请稍后重试。",
  unavailable: "查询服务暂不可用，请稍后重试。",
  network: "网络请求失败，请检查连接后重试。",
  "not-found": "未能取得该 IP 的归属信息，请稍后重试。",
  "invalid-response": "查询服务返回的数据无效，请稍后重试。",
  timeout: "查询超时，请重试。",
} as const;

export class IpLookupError extends Error {
  readonly reason: keyof typeof failureMessages;

  constructor(reason: keyof typeof failureMessages) {
    super(failureMessages[reason]);
    this.name = "IpLookupError";
    this.reason = reason;
  }
}

const optionalText = z.string().trim().nullish().transform((value) => value || undefined);
const geoResponseSchema = z.object({
  success: z.literal(true),
  ip: ipAddressSchema,
  country: optionalText,
  country_code: optionalText,
  region: optionalText,
  city: optionalText,
  connection: z.object({
    isp: optionalText,
    org: optionalText,
    asn: z.number().int().nonnegative().nullish(),
  }).nullish(),
});

export function clearIpGeoCache(): void {
  geoCache.clear();
}

async function requestIpGeoInfo(
  trimmed: string,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<IpGeoInfo> {
  let response: Response;
  try {
    response = await fetcher(`https://ipwho.is/${trimmed}?lang=zh-CN`, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch {
    signal.throwIfAborted();
    throw new IpLookupError("network");
  }
  if (response.status === 429) throw new IpLookupError("limited");
  if (!response.ok) throw new IpLookupError("unavailable");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    signal.throwIfAborted();
    throw new IpLookupError("invalid-response");
  }
  if (typeof payload === "object" && payload !== null && "success" in payload && payload.success === false) {
    throw new IpLookupError("not-found");
  }
  const parsed = geoResponseSchema.safeParse(payload);
  if (!parsed.success || ipaddr.process(parsed.data.ip).toNormalizedString() !== ipaddr.process(trimmed).toNormalizedString()) {
    throw new IpLookupError("invalid-response");
  }
  const data = parsed.data;
  const info: IpGeoInfo = {
    ip: trimmed,
    country: data.country,
    countryCode: data.country_code,
    flagEmoji: getFlagEmoji(data.country_code),
    region: data.region,
    city: data.city,
    isp: data.connection?.isp || data.connection?.org,
    network: data.connection?.asn ? `AS${data.connection.asn}` : undefined,
  };
  return info;
}

export async function fetchIpGeoInfo(
  ip: string,
  fetcher: typeof fetch = globalThis.fetch,
  signal?: AbortSignal,
): Promise<IpGeoInfo> {
  signal?.throwIfAborted();
  const address = inspectIpAddress(ip);
  if (!address) throw new IpLookupError("invalid");
  if (address.localType) throw new IpLookupError("local");
  const cached = geoCache.get(address.ip);
  if (cached) return cached;

  const controller = new AbortController();
  const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let onAbort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(requestSignal.reason);
    requestSignal.addEventListener("abort", onAbort, { once: true });
  });
  const timer = setTimeout(() => controller.abort(new IpLookupError("timeout")), 6000);
  try {
    const info = await Promise.race([
      requestIpGeoInfo(address.ip, fetcher, requestSignal),
      cancelled,
    ]);
    requestSignal.throwIfAborted();
    geoCache.set(address.ip, info);
    return info;
  } finally {
    clearTimeout(timer);
    requestSignal.removeEventListener("abort", onAbort);
  }
}

