import { describe, expect, it, vi } from "vitest";

import {
  CONNECTIVITY_TARGETS,
  createBrowserConnectivityAdapter,
  SPEED_PROFILES,
  WEBRTC_SERVERS,
  runConnectivityTest,
  runSpeedTest,
  runWebRtcTest,
  type ConnectivityAdapter,
  type SpeedTestAdapter,
  type WebRtcAdapter,
  type WebRtcConnection,
} from "@/lib/network-tools";

const abortError = () => new DOMException("The operation was aborted", "AbortError");

describe("网络工具 runner", () => {
  it("固定维护八个网站资源请求目标，并按国内与国外分组", () => {
    expect(CONNECTIVITY_TARGETS).toHaveLength(8);
    expect(CONNECTIVITY_TARGETS.filter((target) => target.group === "domestic")).toHaveLength(3);
    expect(CONNECTIVITY_TARGETS.filter((target) => target.group === "international")).toHaveLength(5);
    expect(CONNECTIVITY_TARGETS.every((target) => target.resourceUrl.startsWith("https://"))).toBe(true);
    expect(CONNECTIVITY_TARGETS[0]).toMatchObject({
      resourceUrl: "https://weixin.qq.com/",
      requestType: "page",
    });
    expect(CONNECTIVITY_TARGETS.slice(1).every((target) => target.requestType === "image")).toBe(true);
    expect(CONNECTIVITY_TARGETS.map((target) => target.label)).toEqual([
      "微信",
      "哔哩哔哩",
      "抖音",
      "Cloudflare",
      "GitHub",
      "ChatGPT",
      "Google",
      "YouTube",
    ]);
  });

  it("微信使用稳定首页请求，不依赖可能变化的 ico 地址", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const adapter = createBrowserConnectivityAdapter();
    const signal = new AbortController().signal;

    await expect(adapter.loadResource(CONNECTIVITY_TARGETS[0], signal)).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith("https://weixin.qq.com/", {
      cache: "no-store",
      mode: "no-cors",
      referrerPolicy: "no-referrer",
      signal,
    });
  });

  it("连通性逐目标呈现加载状态，不让单个失败吞掉其他结果", async () => {
    const adapter: ConnectivityAdapter = {
      supported: true,
      now: vi.fn(() => 100),
      loadResource: vi.fn(async (target) => target.id !== "bilibili"),
    };
    const observed: string[] = [];

    const result = await runConnectivityTest(adapter, {
      onObservation: (observation) => observed.push(observation.target.id),
    });

    expect(result.status).toBe("complete");
    expect(result.observations).toHaveLength(8);
    expect(result.observations.find((item) => item.target.id === "wechat")?.status).toBe("observed");
    expect(result.observations.find((item) => item.target.id === "bilibili")?.status).toBe("unobserved");
    expect(observed).toContain("wechat");
    expect(observed).toContain("bilibili");
    expect(adapter.loadResource).toHaveBeenCalledTimes(8);
  });

  it("把资源请求超时和取消保守地表达为无法判断", async () => {
    const timeoutAdapter: ConnectivityAdapter = {
      supported: true,
      now: vi.fn(() => 0),
      loadResource: vi.fn((_target, signal) =>
        new Promise<boolean>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(abortError()), { once: true });
        }),
      ),
    };

    const timedOut = await runConnectivityTest(timeoutAdapter, { timeoutMs: 1 });
    expect(timedOut.observations.every((item) => item.status === "undetermined")).toBe(true);
    expect(timedOut.observations.every((item) => item.reason === "timeout")).toBe(true);

    const controller = new AbortController();
    controller.abort();
    const cancelled = await runConnectivityTest(timeoutAdapter, { signal: controller.signal });
    expect(cancelled.status).toBe("stopped");
    expect(cancelled.observations.every((item) => item.reason === "cancelled")).toBe(true);
  });

  it("四个 STUN 服务独立收集并去重候选，保留地址族、范围和候选类型", async () => {
    class FakeConnection implements WebRtcConnection {
      onicecandidate: ((event: { candidate: { candidate: string } | null }) => void) | null = null;
      onicecandidateerror: ((event: { errorText?: string; errorCode?: number }) => void) | null = null;
      onicegatheringstatechange: (() => void) | null = null;
      iceGatheringState = "new";
      localDescription: { sdp?: string } | null = null;
      closed = false;
      private readonly serverId: string;

      constructor(serverId: string) {
        this.serverId = serverId;
      }

      createDataChannel() {
        return {};
      }

      async createOffer() {
        return { type: "offer", sdp: `v=0\\no=${this.serverId}` };
      }

      async setLocalDescription(description: { type: string; sdp?: string }) {
        this.localDescription = description;
        this.iceGatheringState = "gathering";
        queueMicrotask(() => {
          const candidate =
            this.serverId === "google"
              ? "candidate:1 1 udp 1 203.0.113.8 5000 typ srflx"
              : this.serverId === "blackberry"
                ? "candidate:2 1 udp 1 192.168.1.3 5001 typ host"
                : this.serverId === "twilio"
                  ? "candidate:3 1 udp 1 2001:db8::8 5002 typ relay"
                  : "candidate:4 1 udp 1 abcdef.local 5003 typ host";
          this.onicecandidate?.({ candidate: { candidate } });
          this.onicecandidate?.({ candidate: { candidate } });
          this.iceGatheringState = "complete";
          this.onicegatheringstatechange?.();
          this.onicecandidate?.({ candidate: null });
        });
      }

      close() {
        this.closed = true;
      }
    }

    const connections: FakeConnection[] = [];
    const adapter: WebRtcAdapter = {
      supported: true,
      now: vi.fn(() => 100),
      createConnection: (server) => {
        const connection = new FakeConnection(server.id);
        connections.push(connection);
        return connection;
      },
    };

    const result = await runWebRtcTest(adapter);

    expect(result.status).toBe("complete");
    expect(result.servers).toHaveLength(WEBRTC_SERVERS.length);
    expect(result.candidates).toHaveLength(4);
    expect(result.candidates.map((candidate) => candidate.address)).toEqual([
      "203.0.113.8",
      "192.168.1.3",
      "2001:db8::8",
      "abcdef.local",
    ]);
    expect(result.candidates.map((candidate) => candidate.type)).toEqual([
      "srflx",
      "host",
      "relay",
      "host",
    ]);
    expect(result.candidates.map((candidate) => candidate.addressFamily)).toEqual([
      "IPv4",
      "IPv4",
      "IPv6",
      "mDNS",
    ]);
    expect(result.natReference).toContain("srflx");
    expect(connections.every((connection) => connection.closed)).toBe(true);
    expect(result.servers.every((server) => server.logs.some((log) => log.includes("SDP")))).toBe(true);
  });

  it("缺少 RTCPeerConnection 时不伪造 WebRTC 结果", async () => {
    const adapter: WebRtcAdapter = {
      supported: false,
      now: () => 0,
      createConnection: () => {
        throw new Error("unsupported");
      },
    };

    const result = await runWebRtcTest(adapter);

    expect(result.status).toBe("undetermined");
    expect(result.servers.every((server) => server.status === "undetermined")).toBe(true);
    expect(result.candidates).toEqual([]);
  });

  it("测速使用明确的低流量/精测档位，计算吞吐量、延迟和抖动", async () => {
    const now = vi.fn();
    let tick = 0;
    now.mockImplementation(() => {
      tick += 100;
      return tick;
    });
    const downloads: number[] = [];
    const uploads: number[] = [];
    const adapter: SpeedTestAdapter = {
      supported: true,
      now,
      measureLatency: vi.fn(async (_signal) => 10 + uploads.length * 4),
      download: vi.fn(async (bytes, _signal, report) => {
        downloads.push(bytes);
        report({ phase: "download", percent: 0.5, sampleMbps: 80 });
        return { bytesTransferred: bytes };
      }),
      upload: vi.fn(async (bytes, _signal, report) => {
        uploads.push(bytes);
        report({ phase: "upload", percent: 1, sampleMbps: 40 });
        return { bytesTransferred: bytes };
      }),
    };

    const result = await runSpeedTest(adapter, { profile: "precision" });

    expect(downloads).toEqual([SPEED_PROFILES.precision.downloadBytes]);
    expect(uploads).toEqual([SPEED_PROFILES.precision.uploadBytes]);
    expect(result.status).toBe("complete");
    expect(result.latencyMs).toBe(10);
    expect(result.jitterMs).toBe(0);
    expect(result.downloadMbps).toBeGreaterThan(0);
    expect(result.uploadMbps).toBeGreaterThan(0);
    expect(result.samples).toEqual([80, 40]);
  });

  it("下载未收到档位要求的完整字节数时保持无法判断并跳过上传", async () => {
    let time = 0;
    const upload = vi.fn();
    const adapter: SpeedTestAdapter = {
      supported: true,
      now: () => {
        time += 100;
        return time;
      },
      measureLatency: vi.fn(async () => 10),
      download: vi.fn(async (bytes, _signal, report) => {
        report({ phase: "download", percent: 0.5, sampleMbps: 60 });
        return { bytesTransferred: bytes - 1 };
      }),
      upload,
    };

    const result = await runSpeedTest(adapter);

    expect(result.status).toBe("undetermined");
    expect(result.downloadMbps).toBeGreaterThan(0);
    expect(result.uploadMbps).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("上传未收到档位要求的完整字节数时保持无法判断", async () => {
    let time = 0;
    const adapter: SpeedTestAdapter = {
      supported: true,
      now: () => {
        time += 100;
        return time;
      },
      measureLatency: vi.fn(async () => 10),
      download: vi.fn(async (bytes, _signal, report) => {
        report({ phase: "download", percent: 1, sampleMbps: 60 });
        return { bytesTransferred: bytes };
      }),
      upload: vi.fn(async (bytes, _signal, report) => {
        report({ phase: "upload", percent: 0.5, sampleMbps: 30 });
        return { bytesTransferred: bytes - 1 };
      }),
    };

    const result = await runSpeedTest(adapter);

    expect(result.status).toBe("undetermined");
    expect(result.downloadMbps).toBeGreaterThan(0);
    expect(result.uploadMbps).toBeGreaterThan(0);
  });

  it("测速在取消后停止并保留已经得到的部分结果", async () => {
    const controller = new AbortController();
    let downloadStarted = false;
    const adapter: SpeedTestAdapter = {
      supported: true,
      now: () => 0,
      measureLatency: vi.fn(async () => 15),
      download: vi.fn((_bytes, signal, report) => {
        downloadStarted = true;
        report({ phase: "download", percent: 0.25, sampleMbps: 72 });
        return new Promise<{ bytesTransferred: number }>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(abortError()), { once: true });
        });
      }),
      upload: vi.fn(),
    };

    const run = runSpeedTest(adapter, { signal: controller.signal });
    await vi.waitFor(() => expect(downloadStarted).toBe(true));
    controller.abort();
    const result = await run;

    expect(result.status).toBe("stopped");
    expect(result.uploadMbps).toBeNull();
    expect(result.samples).toEqual([72]);
    expect(adapter.upload).not.toHaveBeenCalled();
  });
});
