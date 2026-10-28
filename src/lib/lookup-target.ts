import { z } from "zod";

import { inspectIpAddress } from "@/lib/ip-lookup";

export type LookupTarget =
  | { kind: "ip"; ip: string; localType?: string }
  | { kind: "internal"; hostname: string }
  | { kind: "domain"; hostname: string };

const hostnameSchema = z.hostname();

export function parseLookupTarget(input: string): LookupTarget | null {
  const value = input.trim();
  const address = inspectIpAddress(value);
  if (address) return { kind: "ip", ...address };
  if (!value || /[\s\\]/u.test(value)) return null;
  const hasScheme = /^https?:\/\//i.test(value);
  if (!hasScheme && /^[a-z][a-z\d+.-]*:\/\//i.test(value)) return null;
  const authority = (hasScheme ? value.replace(/^https?:\/\//i, "") : value).split(/[/?#]/, 1)[0] || "";
  // Check the original authority before URL normalizes shorthand/hex/octal IPv4.
  const hostMatch = authority.match(/^(\[[^\]]+\]|[^:@%*]+)(?::\d+)?$/);
  if (!hostMatch) return null;
  const rawHost = hostMatch[1]!.replace(/^\[|\]$/g, "");
  try {
    const url = new URL(hasScheme ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    const normalizedIp = inspectIpAddress(url.hostname.replace(/^\[|\]$/g, ""));
    if (normalizedIp) {
      const originalIp = inspectIpAddress(rawHost);
      if (!originalIp || (!hasScheme && (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(value) || authority !== rawHost))) return null;
      return { kind: "ip", ...originalIp };
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostnameSchema.safeParse(hostname).success) return null;
    if (!hostname.includes(".") || ["localhost", "local", "internal", "home.arpa"].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
      return { kind: "internal", hostname };
    }
    return { kind: "domain", hostname };
  } catch {
    return null;
  }
}
