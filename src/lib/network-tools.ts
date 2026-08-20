export type ToolObservationStatus = "observed" | "unobserved" | "undetermined";
export type ToolRunStatus = "complete" | "stopped" | "undetermined";

export type ConnectivityGroup = "domestic" | "international";
export type ConnectivityRequestType = "image" | "page";

export interface ConnectivityTarget {
  readonly id: string;
  readonly label: string;
  readonly group: ConnectivityGroup;
  readonly resourceUrl: string;
  readonly requestType: ConnectivityRequestType;
}

export const CONNECTIVITY_TARGETS = [
  {
    id: "wechat",
    label: "微信",
    group: "domestic",
    resourceUrl: "https://weixin.qq.com/",
    requestType: "page",
  },
  {
    id: "bilibili",
    label: "哔哩哔哩",
    group: "domestic",
    resourceUrl: "https://www.bilibili.com/favicon.ico",
    requestType: "image",
  },
  {
    id: "douyin",
    label: "抖音",
    group: "domestic",
    resourceUrl: "https://www.douyin.com/favicon.ico",
    requestType: "image",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    group: "international",
    resourceUrl: "https://www.cloudflare.com/favicon.ico",
    requestType: "image",
  },
  {
    id: "github",
    label: "GitHub",
    group: "international",
    resourceUrl: "https://github.com/favicon.ico",
    requestType: "image",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    group: "international",
    resourceUrl: "https://chatgpt.com/favicon.ico",
    requestType: "image",
  },
  {
    id: "google",
    label: "Google",
    group: "international",
    resourceUrl: "https://www.google.com/favicon.ico",
    requestType: "image",
  },
  {
    id: "youtube",
    label: "YouTube",
    group: "international",
    resourceUrl: "https://www.youtube.com/favicon.ico",
    requestType: "image",
  },
] as const satisfies readonly ConnectivityTarget[];

export interface ConnectivityObservation {
  readonly target: ConnectivityTarget;
  readonly status: ToolObservationStatus;
  readonly latencyMs: number | null;
  readonly reason?: "load-error" | "timeout" | "cancelled" | "unsupported";
}

export interface ConnectivityAdapter {
  readonly supported: boolean;
  readonly now: () => number;
  readonly loadResource: (
    target: ConnectivityTarget,
    signal: AbortSignal,
  ) => Promise<boolean>;
}

export interface ConnectivityRunResult {
  readonly status: ToolRunStatus;
  readonly observations: readonly ConnectivityObservation[];
}

export interface ConnectivityRunOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly onObservation?: (observation: ConnectivityObservation) => void;
}

const DEFAULT_CONNECTIVITY_TIMEOUT_MS = 6_000;

class ToolAbortError extends Error {
  readonly reason: "timeout" | "cancelled";

  constructor(reason: "timeout" | "cancelled") {
    super(reason);
    this.name = "ToolAbortError";
    this.reason = reason;
  }
}

const abortError = (reason: "timeout" | "cancelled") =>
  new ToolAbortError(reason);

const isToolAbortError = (error: unknown): error is ToolAbortError =>
  error instanceof ToolAbortError;

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

const runAbortable = async <Value>(
  operation: (signal: AbortSignal) => Promise<Value>,
  options: {
    signal?: AbortSignal;
    timeoutMs: number;
  },
): Promise<Value> => {
  if (options.signal?.aborted) {
    throw abortError("cancelled");
  }

  const controller = new AbortController();
  let abortReason: "timeout" | "cancelled" | null = null;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

  const abort = (reason: "timeout" | "cancelled") => {
    if (abortReason) {
      return;
    }

    abortReason = reason;
    controller.abort();
  };
  const onParentAbort = () => abort("cancelled");

  options.signal?.addEventListener("abort", onParentAbort, { once: true });
  timeoutId = globalThis.setTimeout(
    () => abort("timeout"),
    options.timeoutMs,
  );

  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(abortError(abortReason ?? "cancelled")),
      { once: true },
    );
  });

  try {
    return await Promise.race([operation(controller.signal), aborted]);
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
    options.signal?.removeEventListener("abort", onParentAbort);
  }
};

const browserNow = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();

export const createBrowserConnectivityAdapter = (): ConnectivityAdapter => ({
  supported:
    typeof globalThis.Image === "function" &&
    typeof globalThis.fetch === "function",
  now: browserNow,
  loadResource: (target, signal) => {
    if (target.requestType === "page") {
      return globalThis
        .fetch(target.resourceUrl, {
          cache: "no-store",
          mode: "no-cors",
          referrerPolicy: "no-referrer",
          signal,
        })
        .then(() => true);
    }

    if (typeof globalThis.Image !== "function") {
      return Promise.reject(new Error("Image is not available"));
    }

    return new Promise<boolean>((resolve, reject) => {
      const image = new globalThis.Image();
      let settled = false;

      const cleanup = () => {
        image.onload = null;
        image.onerror = null;
        signal.removeEventListener("abort", onAbort);
      };
      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        callback();
      };
      const onAbort = () => {
        image.src = "";
        settle(() => reject(new DOMException("Aborted", "AbortError")));
      };

      image.onload = () => settle(() => resolve(true));
      image.onerror = () => settle(() => resolve(false));
      image.referrerPolicy = "no-referrer";
      image.decoding = "async";
      signal.addEventListener("abort", onAbort, { once: true });
      image.src = target.resourceUrl;
    });
  },
});

const connectivityObservation = (
  target: ConnectivityTarget,
  status: ToolObservationStatus,
  latencyMs: number | null,
  reason?: ConnectivityObservation["reason"],
): ConnectivityObservation => ({
  target,
  status,
  latencyMs,
  ...(reason ? { reason } : {}),
});

export async function runConnectivityTest(
  adapter: ConnectivityAdapter = createBrowserConnectivityAdapter(),
  options: ConnectivityRunOptions = {},
): Promise<ConnectivityRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECTIVITY_TIMEOUT_MS;

  if (!adapter.supported) {
    const observations = CONNECTIVITY_TARGETS.map((target) =>
      connectivityObservation(target, "undetermined", null, "unsupported"),
    );
    observations.forEach((observation) => options.onObservation?.(observation));
    return { status: "undetermined", observations };
  }

  const observations = await Promise.all(
    CONNECTIVITY_TARGETS.map(async (target) => {
      const startedAt = adapter.now();

      try {
        const loaded = await runAbortable(
          (signal) => adapter.loadResource(target, signal),
          { signal: options.signal, timeoutMs },
        );
        const observation = connectivityObservation(
          target,
          loaded ? "observed" : "unobserved",
          Math.max(0, Math.round(adapter.now() - startedAt)),
          loaded ? undefined : "load-error",
        );
        options.onObservation?.(observation);
        return observation;
      } catch (error) {
        const reason = isToolAbortError(error)
          ? error.reason
          : isAbortError(error) && options.signal?.aborted
            ? "cancelled"
            : "timeout";
        const observation = connectivityObservation(
          target,
          "undetermined",
          null,
          reason,
        );
        options.onObservation?.(observation);
        return observation;
      }
    }),
  );

  return {
    status: options.signal?.aborted ? "stopped" : "complete",
    observations,
  };
}

export interface WebRtcServer {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly host: string;
}

export const WEBRTC_SERVERS = [
  {
    id: "google",
    label: "Google STUN",
    url: "stun:stun.l.google.com:19302",
    host: "stun.l.google.com:19302",
  },
  {
    id: "blackberry",
    label: "BlackBerry STUN",
    url: "stun:stun.voip.blackberry.com:3478",
    host: "stun.voip.blackberry.com:3478",
  },
  {
    id: "twilio",
    label: "Twilio STUN",
    url: "stun:global.stun.twilio.com:3478",
    host: "global.stun.twilio.com:3478",
  },
  {
    id: "cloudflare",
    label: "Cloudflare STUN",
    url: "stun:stun.cloudflare.com:3478",
    host: "stun.cloudflare.com:3478",
  },
] as const satisfies readonly WebRtcServer[];

export type WebRtcAddressFamily = "IPv4" | "IPv6" | "mDNS" | "unknown";
export type WebRtcAddressScope =
  | "public"
  | "private"
  | "local"
  | "mdns"
  | "unknown";
export type WebRtcCandidateType = "host" | "srflx" | "relay" | "unknown";

export interface WebRtcCandidateEvidence {
  readonly address: string;
  readonly addressFamily: WebRtcAddressFamily;
  readonly scope: WebRtcAddressScope;
  readonly type: WebRtcCandidateType;
  readonly raw: string;
  readonly serverIds: readonly string[];
}

export interface WebRtcIpGeoInfo {
  readonly ip: string;
  readonly country: string;
  readonly countryCode?: string;
  readonly flagEmoji?: string;
  readonly region?: string;
  readonly city?: string;
  readonly isp?: string;
  readonly network?: string;
}

export const getFlagEmoji = (countryCode?: string): string => {
  if (!countryCode || countryCode.length !== 2) {
    return "";
  }
  const code = countryCode.toUpperCase();
  const codePoints = code
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const geoCache = new Map<string, Promise<WebRtcIpGeoInfo | null>>();

export function clearIpGeoCache(): void {
  geoCache.clear();
}

export async function fetchIpGeoInfo(
  ip: string,
  fetcher: typeof fetch = globalThis.fetch,
  signal?: AbortSignal,
): Promise<WebRtcIpGeoInfo | null> {
  const trimmed = ip.trim();
  if (!trimmed || !isIpv4Address(trimmed)) {
    return null;
  }
  if (geoCache.has(trimmed)) {
    return geoCache.get(trimmed)!;
  }

  const queryPromise = (async () => {
    try {
      const response = await fetcher(`https://ipwho.is/${trimmed}?lang=zh-CN`, {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
      });
      if (response.ok) {
        const data = (await response.json()) as {
          success?: boolean;
          country?: string;
          country_code?: string;
          region?: string;
          city?: string;
          connection?: { isp?: string; org?: string; asn?: number };
          flag?: { emoji?: string };
        };
        if (data.success !== false && data.country) {
          const countryCode = data.country_code;
          return {
            ip: trimmed,
            country: data.country,
            countryCode,
            flagEmoji: data.flag?.emoji || getFlagEmoji(countryCode),
            region: data.region,
            city: data.city,
            isp: data.connection?.isp || data.connection?.org,
            network: data.connection?.asn ? `AS${data.connection.asn}` : undefined,
          };
        }
      }
    } catch {
      // Fallback to secondary geo service
    }

    try {
      const fallbackResp = await fetcher(`https://api.ip.sb/geoip/${trimmed}`, {
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
      });
      if (fallbackResp.ok) {
        const data = (await fallbackResp.json()) as {
          country?: string;
          country_code?: string;
          region?: string;
          city?: string;
          organization?: string;
          asn?: number;
        };
        if (data.country) {
          const countryCode = data.country_code;
          return {
            ip: trimmed,
            country: data.country,
            countryCode,
            flagEmoji: getFlagEmoji(countryCode),
            region: data.region,
            city: data.city,
            isp: data.organization,
            network: data.asn ? `AS${data.asn}` : undefined,
          };
        }
      }
    } catch {
      // Ignore
    }

    return null;
  })();

  geoCache.set(trimmed, queryPromise);
  return queryPromise;
}

export interface WebRtcServerResult {
  readonly server: WebRtcServer;
  readonly status: ToolObservationStatus;
  readonly latencyMs: number | null;
  readonly ip: string | null;
  readonly natType: string | null;
  readonly isp: string | null;
  readonly country: string | null;
  readonly countryCode: string | null;
  readonly flagEmoji: string | null;
  readonly region: string | null;
  readonly city: string | null;
  readonly candidates: readonly WebRtcCandidateEvidence[];
  readonly logs: readonly string[];
  readonly sdp: string;
  readonly reason?:
    | "timeout"
    | "cancelled"
    | "unsupported"
    | "connection-error"
    | "no-candidates";
}

export interface WebRtcRunResult {
  readonly status: ToolRunStatus;
  readonly servers: readonly WebRtcServerResult[];
  readonly candidates: readonly WebRtcCandidateEvidence[];
  readonly natReference: string | null;
}

export interface WebRtcConnection {
  onicecandidate:
    | ((event: { candidate: { candidate: string } | null }) => void)
    | null;
  onicecandidateerror:
    | ((event: { errorText?: string; errorCode?: number }) => void)
    | null;
  onicegatheringstatechange: (() => void) | null;
  readonly iceGatheringState: string;
  readonly localDescription: { sdp?: string } | null;
  createDataChannel: (label: string) => unknown;
  createOffer: () => Promise<{ type: string; sdp?: string }>;
  setLocalDescription: (description: {
    type: string;
    sdp?: string;
  }) => Promise<void>;
  close: () => void;
}

export interface WebRtcAdapter {
  readonly supported: boolean;
  readonly now: () => number;
  readonly createConnection: (server: WebRtcServer) => WebRtcConnection;
  readonly fetchIpGeo?: (
    ip: string,
    signal?: AbortSignal,
  ) => Promise<WebRtcIpGeoInfo | null>;
}

export interface WebRtcRunOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly onServerResult?: (result: WebRtcServerResult) => void;
}

const DEFAULT_WEBRTC_TIMEOUT_MS = 8_000;

const isIpv4Address = (address: string) => {
  const parts = address.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }
      const value = Number(part);
      return value >= 0 && value <= 255;
    })
  );
};

const isPrivateIpv4 = (address: string) => {
  const [first = 0, second = 0] = address.split(".").map(Number);
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const isLocalIpv4 = (address: string) =>
  address.startsWith("169.254.") || address.startsWith("127.");

const classifyAddress = (
  address: string,
): Pick<WebRtcCandidateEvidence, "addressFamily" | "scope"> => {
  if (address.toLocaleLowerCase().endsWith(".local")) {
    return { addressFamily: "mDNS", scope: "mdns" };
  }

  if (isIpv4Address(address)) {
    if (isLocalIpv4(address)) {
      return { addressFamily: "IPv4", scope: "local" };
    }
    if (isPrivateIpv4(address)) {
      return { addressFamily: "IPv4", scope: "private" };
    }
    return { addressFamily: "IPv4", scope: "public" };
  }

  if (address.includes(":")) {
    const normalized = address.toLocaleLowerCase();
    if (normalized === "::1" || normalized.startsWith("fe80:")) {
      return { addressFamily: "IPv6", scope: "local" };
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return { addressFamily: "IPv6", scope: "private" };
    }
    return { addressFamily: "IPv6", scope: "public" };
  }

  return { addressFamily: "unknown", scope: "unknown" };
};

const parseCandidate = (
  raw: string,
  serverId: string,
): WebRtcCandidateEvidence | null => {
  const tokens = raw.trim().split(/\s+/);
  const address = tokens[4];
  if (!address) {
    return null;
  }

  const typeIndex = tokens.indexOf("typ");
  const typeToken = typeIndex >= 0 ? tokens[typeIndex + 1] : undefined;
  const type: WebRtcCandidateType =
    typeToken === "host" || typeToken === "srflx" || typeToken === "relay"
      ? typeToken
      : "unknown";

  return {
    address,
    ...classifyAddress(address),
    type,
    raw,
    serverIds: [serverId],
  };
};

const dedupeCandidates = (
  candidates: readonly WebRtcCandidateEvidence[],
) => {
  const unique = new Map<string, WebRtcCandidateEvidence>();
  candidates.forEach((candidate) => {
    const key = `${candidate.address}|${candidate.type}|${candidate.scope}`;
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, candidate);
      return;
    }

    unique.set(key, {
      ...existing,
      serverIds: Array.from(
        new Set([...existing.serverIds, ...candidate.serverIds]),
      ),
    });
  });
  return Array.from(unique.values());
};

const createUnsupportedWebRtcResult = (
  server: WebRtcServer,
): WebRtcServerResult => ({
  server,
  status: "undetermined",
  latencyMs: null,
  ip: null,
  natType: "无法获取 / 连接受限",
  isp: null,
  country: null,
  countryCode: null,
  flagEmoji: null,
  region: null,
  city: null,
  candidates: [],
  logs: ["RTCPeerConnection 不可用"],
  sdp: "",
  reason: "unsupported",
});

export const createBrowserWebRtcAdapter = (): WebRtcAdapter => ({
  supported: typeof globalThis.RTCPeerConnection === "function",
  now: browserNow,
  createConnection: (server) => {
    if (typeof globalThis.RTCPeerConnection !== "function") {
      throw new Error("RTCPeerConnection is not available");
    }

    return new globalThis.RTCPeerConnection({
      iceServers: [{ urls: server.url }],
    }) as unknown as WebRtcConnection;
  },
  fetchIpGeo: (ip, signal) => fetchIpGeoInfo(ip, globalThis.fetch, signal),
});

const inferNatType = (
  candidates: readonly WebRtcCandidateEvidence[],
  hasError: boolean,
): string => {
  if (hasError) {
    return "无法获取 / 连接受限";
  }
  const srflx = candidates.find((candidate) => candidate.type === "srflx");
  if (srflx) {
    return "端口限制型或对称型";
  }
  const publicHost = candidates.find(
    (candidate) => candidate.type === "host" && candidate.scope === "public",
  );
  if (publicHost) {
    return "公网直连 (无 NAT)";
  }
  if (candidates.length > 0) {
    return "无法获取 / 连接受限";
  }
  return "无法获取 / 连接受限";
};

const extractPublicIp = (
  candidates: readonly WebRtcCandidateEvidence[],
): string | null => {
  const srflx = candidates.find(
    (candidate) => candidate.type === "srflx" && candidate.scope === "public",
  );
  if (srflx) {
    return srflx.address;
  }
  const publicCand = candidates.find((candidate) => candidate.scope === "public");
  if (publicCand) {
    return publicCand.address;
  }
  return null;
};

const runWebRtcProbe = async (
  adapter: WebRtcAdapter,
  server: WebRtcServer,
  options: WebRtcRunOptions,
): Promise<WebRtcServerResult> => {
  if (!adapter.supported) {
    return createUnsupportedWebRtcResult(server);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_WEBRTC_TIMEOUT_MS;
  const startedAt = adapter.now();
  const logs: string[] = [];
  const candidates: WebRtcCandidateEvidence[] = [];
  let connection: WebRtcConnection | null = null;

  try {
    connection = adapter.createConnection(server);
    logs.push(`连接 ${server.url}`);

    let finishGathering: (() => void) | null = null;
    const gatheringComplete = new Promise<void>((resolve) => {
      finishGathering = resolve;
    });
    const finishIfComplete = () => {
      if (connection?.iceGatheringState === "complete") {
        finishGathering?.();
        finishGathering = null;
      }
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        logs.push("ICE gathering complete");
        finishGathering?.();
        finishGathering = null;
        return;
      }
      const raw = event.candidate.candidate;
      logs.push(`ICE candidate · ${raw}`);
      const candidate = parseCandidate(raw, server.id);
      if (candidate) {
        candidates.push(candidate);
      }
    };
    connection.onicecandidateerror = (event) => {
      logs.push(
        `ICE error · ${event.errorCode ?? "?"} ${event.errorText ?? "未知错误"}`,
      );
    };
    connection.onicegatheringstatechange = () => {
      logs.push(`ICE state · ${connection?.iceGatheringState ?? "unknown"}`);
      finishIfComplete();
    };

    connection.createDataChannel("ip-exit-observer");
    const offer = await runAbortable(
      () => connection!.createOffer(),
      { signal: options.signal, timeoutMs },
    );
    logs.push(`SDP offer\n${offer.sdp ?? "(empty)"}`);
    await runAbortable(
      () => connection!.setLocalDescription(offer),
      { signal: options.signal, timeoutMs },
    );
    logs.push("local description set");
    finishIfComplete();
    await runAbortable(() => gatheringComplete, {
      signal: options.signal,
      timeoutMs,
    });

    const uniqueCandidates = dedupeCandidates(candidates);
    const publicIp = extractPublicIp(uniqueCandidates);
    const natType = inferNatType(uniqueCandidates, false);

    let geoInfo: WebRtcIpGeoInfo | null = null;
    if (publicIp) {
      try {
        const geoFetcher = adapter.fetchIpGeo ?? ((ip, sig) => fetchIpGeoInfo(ip, globalThis.fetch, sig));
        geoInfo = await geoFetcher(publicIp, options.signal);
      } catch {
        // Geo lookup is non-blocking
      }
    }

    return {
      server,
      status: uniqueCandidates.length > 0 ? "observed" : "unobserved",
      latencyMs: Math.max(0, Math.round(adapter.now() - startedAt)),
      ip: publicIp,
      natType,
      isp: geoInfo?.isp ?? null,
      country: geoInfo?.country ?? null,
      countryCode: geoInfo?.countryCode ?? null,
      flagEmoji: geoInfo?.flagEmoji ?? null,
      region: geoInfo?.region ?? null,
      city: geoInfo?.city ?? null,
      candidates: uniqueCandidates,
      logs,
      sdp: connection.localDescription?.sdp ?? offer.sdp ?? "",
      ...(uniqueCandidates.length === 0 ? { reason: "no-candidates" } : {}),
    };
  } catch (error) {
    const reason = isToolAbortError(error)
      ? error.reason
      : isAbortError(error) && options.signal?.aborted
        ? "cancelled"
        : "connection-error";
    logs.push(
      reason === "timeout"
        ? "本次 STUN 连接超时"
        : reason === "cancelled"
          ? "本次 STUN 连接已停止"
          : `STUN 连接无法判断 · ${error instanceof Error ? error.message : "未知错误"}`,
    );
    const uniqueCandidates = dedupeCandidates(candidates);
    const publicIp = extractPublicIp(uniqueCandidates);

    return {
      server,
      status: "undetermined",
      latencyMs: null,
      ip: publicIp,
      natType: "无法获取 / 连接受限",
      isp: null,
      country: null,
      countryCode: null,
      flagEmoji: null,
      region: null,
      city: null,
      candidates: uniqueCandidates,
      logs,
      sdp: connection?.localDescription?.sdp ?? "",
      reason,
    };
  } finally {
    connection?.close();
  }
};

const deriveNatReference = (
  candidates: readonly WebRtcCandidateEvidence[],
) => {
  if (candidates.some((candidate) => candidate.type === "srflx")) {
    return "端口限制型或对称型（仅供参考）";
  }
  if (candidates.length > 0) {
    return "未观察到 srflx 候选（仅供参考）";
  }
  return null;
};

export async function runWebRtcTest(
  adapter: WebRtcAdapter = createBrowserWebRtcAdapter(),
  options: WebRtcRunOptions = {},
): Promise<WebRtcRunResult> {
  const servers = await Promise.all(
    WEBRTC_SERVERS.map(async (server) => {
      const result = await runWebRtcProbe(adapter, server, options);
      options.onServerResult?.(result);
      return result;
    }),
  );
  const candidates = dedupeCandidates(
    servers.flatMap((server) => server.candidates),
  );
  const hasCompletedProbe = servers.some(
    (server) => server.status === "observed" || server.status === "unobserved",
  );

  return {
    status: options.signal?.aborted
      ? "stopped"
      : hasCompletedProbe
        ? "complete"
        : "undetermined",
    servers,
    candidates,
    natReference: deriveNatReference(candidates),
  };
}

export const SPEED_PROFILES = {
  low: {
    id: "low",
    label: "低流量",
    downloadBytes: 10_000_000,
    uploadBytes: 5_000_000,
    warning: "约 15 MB 流量，适合快速获得参考值。",
  },
  precision: {
    id: "precision",
    label: "精测",
    downloadBytes: 50_000_000,
    uploadBytes: 15_000_000,
    warning: "约 65 MB 流量，结果可能更稳定。",
  },
} as const;

export type SpeedProfileId = keyof typeof SPEED_PROFILES;
export type SpeedProgressPhase = "latency" | "download" | "upload";

export interface SpeedProgress {
  readonly phase: SpeedProgressPhase;
  readonly percent: number;
  readonly sampleMbps?: number;
}

export interface SpeedTransferResult {
  readonly bytesTransferred: number;
}

export interface SpeedTestAdapter {
  readonly supported: boolean;
  readonly now: () => number;
  readonly measureLatency: (signal: AbortSignal) => Promise<number>;
  readonly download: (
    bytes: number,
    signal: AbortSignal,
    report: (progress: SpeedProgress) => void,
  ) => Promise<SpeedTransferResult>;
  readonly upload: (
    bytes: number,
    signal: AbortSignal,
    report: (progress: SpeedProgress) => void,
  ) => Promise<SpeedTransferResult>;
}

export interface SpeedTestResult {
  readonly status: ToolRunStatus;
  readonly profile: SpeedProfileId;
  readonly latencyMs: number | null;
  readonly jitterMs: number | null;
  readonly downloadMbps: number | null;
  readonly uploadMbps: number | null;
  readonly durationMs: number;
  readonly samples: readonly number[];
  readonly downloadSamples: readonly number[];
  readonly uploadSamples: readonly number[];
}

export function getBandwidthEquivalent(downloadMbps: number | null): string {
  if (downloadMbps === null || downloadMbps <= 0) {
    return "尚未测得有效带宽";
  }
  if (downloadMbps >= 1000) {
    return "千兆宽带 (1000M+)";
  }
  if (downloadMbps >= 500) {
    return "相当于 500M~1000M 宽带";
  }
  if (downloadMbps >= 200) {
    return "相当于 200M~500M 宽带";
  }
  if (downloadMbps >= 100) {
    return "相当于 100M~200M 宽带";
  }
  if (downloadMbps >= 50) {
    return "相当于 50M~100M 宽带";
  }
  if (downloadMbps >= 20) {
    return "相当于 20M~50M 宽带";
  }
  return "相当于 10M~20M 宽带";
}

export interface SpeedTestRunOptions {
  readonly profile?: SpeedProfileId;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly onProgress?: (progress: SpeedProgress) => void;
}

const DEFAULT_SPEED_TIMEOUT_MS = 60_000;
const LATENCY_SAMPLE_COUNT = 3;

const average = (values: readonly number[]) =>
  values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;

const calculateJitter = (values: readonly number[]) => {
  if (values.length < 2) {
    return null;
  }
  return (
    values
      .slice(1)
      .reduce(
        (total, value, index) =>
          total + Math.abs(value - (values[index] ?? value)),
        0,
      ) /
    (values.length - 1)
  );
};

const calculateMbps = (bytes: number, durationMs: number) =>
  bytes > 0 && durationMs > 0
    ? (bytes * 8) / (durationMs / 1_000) / 1_000_000
    : null;

const createSpeedResult = (
  profile: SpeedProfileId,
  status: ToolRunStatus,
  startedAt: number,
  now: () => number,
  latencies: readonly number[],
  downloadMbps: number | null,
  uploadMbps: number | null,
  samples: readonly number[],
  downloadSamples: readonly number[] = [],
  uploadSamples: readonly number[] = [],
): SpeedTestResult => ({
  status,
  profile,
  latencyMs:
    average(latencies) === null ? null : Math.round(average(latencies)!),
  jitterMs:
    calculateJitter(latencies) === null
      ? null
      : Math.round(calculateJitter(latencies)!),
  downloadMbps,
  uploadMbps,
  durationMs: Math.max(0, Math.round(now() - startedAt)),
  samples,
  downloadSamples,
  uploadSamples,
});

export const createBrowserSpeedAdapter = (): SpeedTestAdapter => {
  const downloadUrl = (bytes: number) =>
    `https://speed.cloudflare.com/__down?bytes=${bytes}`;
  const uploadUrl = "https://speed.cloudflare.com/__up";
  const now = browserNow;
  const supported =
    typeof globalThis.fetch === "function" &&
    typeof globalThis.AbortController === "function";

  const measureLatency = async (signal: AbortSignal) => {
    const startedAt = now();
    const response = await fetch(downloadUrl(0), {
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Latency request failed: ${response.status}`);
    }
    await response.arrayBuffer();
    return Math.max(0, Math.round(now() - startedAt));
  };

  const download = async (
    bytes: number,
    signal: AbortSignal,
    report: (progress: SpeedProgress) => void,
  ) => {
    const response = await fetch(downloadUrl(bytes), {
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) {
      throw new Error(`Download request failed: ${response.status}`);
    }

    let transferred = 0;
    const startedAt = now();
    let lastSampleTime = startedAt;
    let lastSampleBytes = 0;

    if (!response.body) {
      transferred = (await response.arrayBuffer()).byteLength;
      const duration = Math.max(1, now() - startedAt);
      report({
        phase: "download",
        percent: Math.min(1, transferred / bytes),
        sampleMbps: calculateMbps(transferred, duration) ?? undefined,
      });
      return { bytesTransferred: Math.min(bytes, transferred) };
    }

    const reader = response.body.getReader();
    try {
      while (transferred < bytes) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        transferred += chunk.value.byteLength;
        const currentTime = now();
        const timeDelta = currentTime - lastSampleTime;

        // Sample every 120ms or when reaching total bytes
        if (timeDelta >= 120 || transferred >= bytes) {
          const bytesDelta = transferred - lastSampleBytes;
          const intervalMbps = calculateMbps(bytesDelta, timeDelta) ?? 0;
          const overallMbps = calculateMbps(transferred, currentTime - startedAt) ?? 0;
          const currentSpeed = intervalMbps > 0 ? intervalMbps : overallMbps;

          lastSampleTime = currentTime;
          lastSampleBytes = transferred;

          report({
            phase: "download",
            percent: Math.min(1, transferred / bytes),
            sampleMbps: Number(currentSpeed.toFixed(2)),
          });
        }
      }
    } finally {
      await reader.cancel();
    }

    return { bytesTransferred: Math.min(bytes, transferred) };
  };

  const upload = async (
    bytes: number,
    signal: AbortSignal,
    report: (progress: SpeedProgress) => void,
  ) => {
    const chunkSize = bytes <= 5_000_000 ? 500_000 : 1_000_000;
    let transferred = 0;
    const startedAt = now();
    const chunkPayload = new Uint8Array(chunkSize);

    while (transferred < bytes) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const currentChunkSize = Math.min(chunkSize, bytes - transferred);
      const payload = currentChunkSize === chunkSize ? chunkPayload : new Uint8Array(currentChunkSize);
      const chunkStartedAt = now();

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: payload,
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal,
      });

      if (!response.ok) {
        throw new Error(`Upload request failed: ${response.status}`);
      }

      transferred += currentChunkSize;
      const chunkDuration = Math.max(1, now() - chunkStartedAt);
      const chunkMbps = calculateMbps(currentChunkSize, chunkDuration) ?? 0;
      const overallMbps = calculateMbps(transferred, now() - startedAt) ?? 0;
      const currentSpeed = chunkMbps > 0 ? chunkMbps : overallMbps;

      report({
        phase: "upload",
        percent: Math.min(1, transferred / bytes),
        sampleMbps: Number(currentSpeed.toFixed(2)),
      });
    }

    return { bytesTransferred: transferred };
  };

  return { supported, now, measureLatency, download, upload };
};

const reportProgress = (
  options: SpeedTestRunOptions,
  progress: SpeedProgress,
) => {
  options.onProgress?.({
    ...progress,
    percent: Math.min(1, Math.max(0, progress.percent)),
  });
};

export async function runSpeedTest(
  adapter: SpeedTestAdapter = createBrowserSpeedAdapter(),
  options: SpeedTestRunOptions = {},
): Promise<SpeedTestResult> {
  const profile = options.profile ?? "low";
  const profileConfig = SPEED_PROFILES[profile];
  const startedAt = adapter.now();
  const latencies: number[] = [];
  const samples: number[] = [];
  const downloadSamples: number[] = [];
  const uploadSamples: number[] = [];
  let downloadMbps: number | null = null;
  let uploadMbps: number | null = null;

  if (!adapter.supported) {
    return createSpeedResult(
      profile,
      "undetermined",
      startedAt,
      adapter.now,
      latencies,
      downloadMbps,
      uploadMbps,
      samples,
      downloadSamples,
      uploadSamples,
    );
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_SPEED_TIMEOUT_MS;
  const MAX_ROLLING_SAMPLES = 36;

  const collect = (progress: SpeedProgress) => {
    if (progress.sampleMbps !== undefined && progress.sampleMbps > 0) {
      samples.push(progress.sampleMbps);
      if (samples.length > MAX_ROLLING_SAMPLES * 2) {
        samples.splice(0, samples.length - MAX_ROLLING_SAMPLES * 2);
      }
      if (progress.phase === "download") {
        downloadSamples.push(progress.sampleMbps);
        if (downloadSamples.length > MAX_ROLLING_SAMPLES) {
          downloadSamples.splice(0, downloadSamples.length - MAX_ROLLING_SAMPLES);
        }
      } else if (progress.phase === "upload") {
        uploadSamples.push(progress.sampleMbps);
        if (uploadSamples.length > MAX_ROLLING_SAMPLES) {
          uploadSamples.splice(0, uploadSamples.length - MAX_ROLLING_SAMPLES);
        }
      }
    }
  };

  try {
    for (let index = 0; index < LATENCY_SAMPLE_COUNT; index += 1) {
      const latency = await runAbortable(
        (signal) => adapter.measureLatency(signal),
        { signal: options.signal, timeoutMs },
      );
      latencies.push(Math.max(0, latency));
      reportProgress(options, {
        phase: "latency",
        percent: ((index + 1) / LATENCY_SAMPLE_COUNT) * 0.15,
      });
    }

    const downloadStartedAt = adapter.now();
    const download = await runAbortable(
      (signal) =>
        adapter.download(profileConfig.downloadBytes, signal, (progress) => {
          collect(progress);
          reportProgress(options, {
            ...progress,
            percent: 0.15 + progress.percent * 0.45,
          });
        }),
      { signal: options.signal, timeoutMs },
    );
    downloadMbps = calculateMbps(
      download.bytesTransferred,
      adapter.now() - downloadStartedAt,
    );
    if (download.bytesTransferred < profileConfig.downloadBytes) {
      return createSpeedResult(
        profile,
        "undetermined",
        startedAt,
        adapter.now,
        latencies,
        downloadMbps,
        uploadMbps,
        samples,
        downloadSamples,
        uploadSamples,
      );
    }

    const uploadStartedAt = adapter.now();
    const upload = await runAbortable(
      (signal) =>
        adapter.upload(profileConfig.uploadBytes, signal, (progress) => {
          collect(progress);
          reportProgress(options, {
            ...progress,
            percent: 0.6 + progress.percent * 0.4,
          });
        }),
      { signal: options.signal, timeoutMs },
    );
    uploadMbps = calculateMbps(
      upload.bytesTransferred,
      adapter.now() - uploadStartedAt,
    );
    if (upload.bytesTransferred < profileConfig.uploadBytes) {
      return createSpeedResult(
        profile,
        "undetermined",
        startedAt,
        adapter.now,
        latencies,
        downloadMbps,
        uploadMbps,
        samples,
        downloadSamples,
        uploadSamples,
      );
    }
    reportProgress(options, { phase: "upload", percent: 1 });

    return createSpeedResult(
      profile,
      "complete",
      startedAt,
      adapter.now,
      latencies,
      downloadMbps,
      uploadMbps,
      samples,
      downloadSamples,
      uploadSamples,
    );
  } catch (error) {
    const status: ToolRunStatus = isToolAbortError(error)
      ? error.reason === "cancelled"
        ? "stopped"
        : "undetermined"
      : isAbortError(error) && options.signal?.aborted
        ? "stopped"
        : "undetermined";
    return createSpeedResult(
      profile,
      status,
      startedAt,
      adapter.now,
      latencies,
      downloadMbps,
      uploadMbps,
      samples,
      downloadSamples,
      uploadSamples,
    );
  }
}
