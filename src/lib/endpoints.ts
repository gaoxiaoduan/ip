import type {
  DetectionEndpoint,
  DetectionPath,
  OutletObservation,
} from "@/lib/detection";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;

const asString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;

type ObservationInput = {
  [Key in keyof OutletObservation]?: unknown;
};

const observation = (
  value: ObservationInput,
): OutletObservation | null => {
  const ip = asString(value.ip);
  const country = asString(value.country);

  if (!ip || !country) {
    return null;
  }

  return {
    ip,
    country,
    ...(asString(value.countryCode)
      ? { countryCode: asString(value.countryCode) }
      : {}),
    ...(asString(value.region) ? { region: asString(value.region) } : {}),
    ...(asString(value.city) ? { city: asString(value.city) } : {}),
    ...(asString(value.organization)
      ? { organization: asString(value.organization) }
      : {}),
    ...(asString(value.network)
      ? { network: asString(value.network) }
      : typeof value.network === "number"
        ? { network: String(value.network) }
        : {}),
  };
};

const parseIpipJson = (payload: unknown) => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const location = Array.isArray(data?.location) ? data.location : [];

  if (root?.ret !== "ok" || !data) {
    return null;
  }

  return observation({
    ip: data.ip,
    country: location[0],
    region: location[1],
    city: location[2],
    organization: location[4],
  });
};

const parseIpipText = (payload: unknown) => {
  if (typeof payload !== "string") {
    return null;
  }

  const ip = payload.match(
    /(?:IP|ip)\s*[：:]\s*([0-9a-f:.]+)/i,
  )?.[1];
  const locationText = payload.match(/来自于\s*[：:]\s*(.+)$/)?.[1]?.trim();
  const parts = locationText?.split(/\s+/).filter(Boolean) ?? [];

  return observation({
    ip,
    country: parts[0],
    region: parts[1],
    city: parts[2],
    organization: parts.at(-1),
  });
};

const parseWorkerObservation = (payload: unknown) => {
  const root = asRecord(payload);

  if (root?.ok !== true) {
    return null;
  }

  return observation({
    ip: root.ip,
    country: root.country,
    countryCode: root.countryCode,
    region: root.region,
    city: root.city,
    organization: root.organization,
    network: root.network,
  });
};

const parseIpWho = (payload: unknown) => {
  const root = asRecord(payload);
  const connection = asRecord(root?.connection);

  if (root?.success === false) {
    return null;
  }

  return observation({
    ip: root?.ip,
    country: root?.country,
    countryCode: root?.country_code,
    region: root?.region,
    city: root?.city,
    organization: connection?.isp ?? connection?.org,
    network: connection?.asn,
  });
};

const parseIpApi = (payload: unknown) => {
  const root = asRecord(payload);

  if (root?.error === true) {
    return null;
  }

  return observation({
    ip: root?.ip,
    country: root?.country_name ?? root?.country,
    countryCode: root?.country_code,
    region: root?.region,
    city: root?.city,
    organization: root?.org,
    network: root?.asn,
  });
};

const parseIpSb = (payload: unknown) => {
  const root = asRecord(payload);

  return observation({
    ip: root?.ip,
    country: root?.country,
    countryCode: root?.country_code,
    region: root?.region,
    city: root?.city,
    organization: root?.organization,
    network: root?.asn,
  });
};

const endpoint = (
  config: Omit<DetectionEndpoint, "source"> & {
    source: DetectionEndpoint["source"];
  },
): DetectionEndpoint => config;

export const DETECTION_PATHS = [
  {
    id: "domestic",
    label: "国内网站路径",
    description: "观察访问中国大陆常见网站时，对方看到的公网出口。",
    endpoints: [
      endpoint({
        id: "ipip-json",
        label: "IPIP JSON",
        url: "https://myip.ipip.net/json",
        source: {
          label: "IPIP.net",
          url: "https://www.ipip.net/",
        },
        redundancy: "primary",
        responseType: "json",
        parse: parseIpipJson,
      }),
      endpoint({
        id: "ipip-text",
        label: "IPIP 兼容接口",
        url: "https://myip.ipip.net",
        source: {
          label: "IPIP.net",
          url: "https://www.ipip.net/",
        },
        redundancy: "compatible-fallback",
        responseType: "text",
        parse: parseIpipText,
      }),
    ],
  },
  {
    id: "ordinary-overseas",
    label: "普通海外网站路径",
    description: "观察访问通常可以直接访问的海外网站时的公网出口。",
    endpoints: [
      endpoint({
        id: "cloudflare-worker",
        label: "本站检测端点",
        url: "/api/observe",
        source: {
          label: "Cloudflare",
          url: "https://www.cloudflare.com/",
        },
        redundancy: "primary",
        responseType: "json",
        parse: parseWorkerObservation,
      }),
      endpoint({
        id: "ipwho",
        label: "IPWhois",
        url: "https://ipwho.is/",
        source: {
          label: "IPWhois",
          url: "https://ipwhois.io/",
        },
        redundancy: "independent-fallback",
        responseType: "json",
        parse: parseIpWho,
      }),
    ],
  },
  {
    id: "restricted-overseas",
    label: "受限海外服务路径",
    description:
      "使用可能受访问策略影响的海外第三方端点，提供代表性出口结果。",
    endpoints: [
      endpoint({
        id: "ipapi",
        label: "IPapi",
        url: "https://ipapi.co/json/",
        source: {
          label: "IPapi",
          url: "https://ipapi.co/",
        },
        redundancy: "primary",
        responseType: "json",
        parse: parseIpApi,
      }),
      endpoint({
        id: "ip-sb",
        label: "IP.SB",
        url: "https://api.ip.sb/geoip",
        source: {
          label: "IP.SB",
          url: "https://ip.sb/",
        },
        redundancy: "independent-fallback",
        responseType: "json",
        parse: parseIpSb,
      }),
    ],
  },
] as const satisfies readonly DetectionPath[];
