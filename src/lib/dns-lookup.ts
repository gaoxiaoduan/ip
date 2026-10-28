import ipaddr from "ipaddr.js";
import { z } from "zod";

export const DNS_SOURCE = {
  label: "Cloudflare DNS",
  url: "https://developers.cloudflare.com/1.1.1.1/",
} as const;

export type DnsRecordType = "A" | "AAAA";

const errorMessages = {
  "not-found": "域名不存在。",
  failed: "DNS 解析失败，请重试。",
  unavailable: "DNS 解析服务暂不可用，请重试。",
  limited: "DNS 解析请求已达服务限额，请稍后重试。",
  network: "DNS 网络请求失败，请检查连接后重试。",
  "invalid-response": "DNS 解析服务返回的数据无效，请重试。",
  timeout: "DNS 解析超时，请重试。",
} as const;

export class DnsLookupError extends Error {
  readonly reason: keyof typeof errorMessages;

  constructor(reason: keyof typeof errorMessages) {
    super(errorMessages[reason]);
    this.name = "DnsLookupError";
    this.reason = reason;
  }
}

const responseSchema = z.object({
  Status: z.number().int().nonnegative(),
  TC: z.boolean().optional(),
  Question: z.array(z.object({ name: z.string(), type: z.number() })).length(1),
  Answer: z.array(z.object({ name: z.string(), type: z.number(), data: z.string() })).optional(),
});

const normalizeName = (name: string) => name.toLowerCase().replace(/\.$/, "");

async function requestDnsAddresses(
  hostname: string,
  type: DnsRecordType,
  signal: AbortSignal,
): Promise<string[]> {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", type);
  let response: Response;
  try {
    response = await fetch(url.href, {
      headers: { Accept: "application/dns-json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch {
    signal.throwIfAborted();
    throw new DnsLookupError("network");
  }
  if (response.status === 429) throw new DnsLookupError("limited");
  if (!response.ok) throw new DnsLookupError("unavailable");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    signal.throwIfAborted();
    throw new DnsLookupError("invalid-response");
  }
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.TC) throw new DnsLookupError("invalid-response");
  const data = parsed.data;
  const recordType = type === "A" ? 1 : 28;
  const question = data.Question[0]!;
  if (normalizeName(question.name) !== hostname || question.type !== recordType) throw new DnsLookupError("invalid-response");
  if (data.Status === 3) throw new DnsLookupError("not-found");
  if (data.Status !== 0) throw new DnsLookupError("failed");
  const addressSchema = type === "A" ? z.ipv4() : z.ipv6();
  const records = data.Answer || [];
  const owners = new Set<string>();
  let owner = hostname;
  while (!owners.has(owner)) {
    owners.add(owner);
    const aliases = new Set(records.filter((record) => record.type === 5 && normalizeName(record.name) === owner).map((record) => normalizeName(record.data)));
    if (aliases.size === 0) break;
    const next = [...aliases][0]!;
    if (aliases.size !== 1 || owners.has(next) || !z.hostname().safeParse(next).success) throw new DnsLookupError("invalid-response");
    owner = next;
  }
  const addresses = records.filter((record) => record.type === recordType && normalizeName(record.name) === owner);
  if (addresses.some((record) => !addressSchema.safeParse(record.data).success)) throw new DnsLookupError("invalid-response");
  return [...new Set(addresses.map((record) => ipaddr.parse(record.data).toString()))];
}

export async function resolveDnsAddresses(
  hostname: string,
  type: DnsRecordType,
  signal: AbortSignal,
): Promise<string[]> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const onCancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", onCancel, { once: true });
  let onAbort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  const timer = setTimeout(() => controller.abort(new DnsLookupError("timeout")), 6000);
  try {
    return await Promise.race([requestDnsAddresses(hostname, type, controller.signal), cancelled]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onCancel);
    controller.signal.removeEventListener("abort", onAbort);
  }
}
