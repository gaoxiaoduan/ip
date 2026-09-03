import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { NetworkToolDesk } from "@/components/network-tool-desk";
import type { NetworkToolAdapterOverrides } from "@/lib/network-tool-session";
import type {
  SpeedProgress,
  WebRtcAdapter,
  WebRtcConnection,
} from "@/lib/network-tools";

class FakeWebRtcConnection implements WebRtcConnection {
  onicecandidate: WebRtcConnection["onicecandidate"] = null;
  onicecandidateerror: WebRtcConnection["onicecandidateerror"] = null;
  onicegatheringstatechange: WebRtcConnection["onicegatheringstatechange"] = null;
  iceGatheringState = "new";
  localDescription: WebRtcConnection["localDescription"] = null;

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
    this.iceGatheringState = "complete";
    queueMicrotask(() => {
      this.onicecandidate?.({
        candidate: {
          candidate: `candidate:1 1 udp 1 203.0.113.8 54321 typ srflx`,
        },
      });
      this.onicegatheringstatechange?.();
      this.onicecandidate?.({ candidate: null });
    });
  }

  close() {}
}

class PendingWebRtcConnection implements WebRtcConnection {
  onicecandidate: WebRtcConnection["onicecandidate"] = null;
  onicecandidateerror: WebRtcConnection["onicecandidateerror"] = null;
  onicegatheringstatechange: WebRtcConnection["onicegatheringstatechange"] = null;
  iceGatheringState = "new";
  localDescription: WebRtcConnection["localDescription"] = null;
  closed = false;

  createDataChannel() {
    return {};
  }

  async createOffer() {
    return { type: "offer", sdp: "v=0\\no=pending" };
  }

  async setLocalDescription(description: { type: string; sdp?: string }) {
    this.localDescription = description;
    this.onicecandidate?.({
      candidate: {
        candidate: "candidate:1 1 udp 1 203.0.113.8 54321 typ srflx",
      },
    });
  }

  close() {
    this.closed = true;
  }
}

describe("网络工具台", () => {
  it("测速停止后保留部分事实，并忽略旧运行晚到的进度", async () => {
    let reportLateProgress: ((progress: SpeedProgress) => void) | undefined;
    const speed = {
      supported: true,
      now: () => 100,
      measureLatency: vi.fn(async () => 12),
      download: vi.fn((_bytes: number, _signal: AbortSignal, report: (progress: SpeedProgress) => void) => {
        reportLateProgress = report;
        return new Promise<{ bytesTransferred: number }>(() => undefined);
      }),
      upload: vi.fn(),
    };
    const adapters: NetworkToolAdapterOverrides = { speed };
    const user = userEvent.setup();

    render(<NetworkToolDesk adapters={adapters} view="speed" />);

    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);
    await waitFor(() => expect(speed.download).toHaveBeenCalled());

    reportLateProgress?.({
      phase: "download",
      percent: 0.25,
      sampleMbps: 72,
    });
    expect(await screen.findByText("72.00")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "停止测速" })[0]!);
    expect(await screen.findByText("本轮已停止")).toBeInTheDocument();
    expect(screen.getByText("72.00")).toBeInTheDocument();

    reportLateProgress?.({
      phase: "download",
      percent: 1,
      sampleMbps: 999,
    });

    await waitFor(() => {
      expect(screen.getByText("72.00")).toBeInTheDocument();
      expect(screen.queryByText("999.00")).not.toBeInTheDocument();
    });
  });

  it("连通性按目标增量呈现，单个失败不会吞掉其他结果", async () => {
    const connectivity = {
      supported: true,
      now: () => 100,
      loadResource: vi.fn(async (target: { id: string }) => target.id !== "bilibili"),
    };
    const user = userEvent.setup();

    render(
      <NetworkToolDesk
        adapters={{ connectivity }}
        view="connectivity"
      />,
    );

    await user.click(screen.getByRole("button", { name: "开始检查" }));

    expect(
      await screen.findByText("已检查 8 / 8 个网站，7 个资源请求成功。"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("已加载")).toHaveLength(7);
    expect(screen.getByText(/资源未加载/)).toBeInTheDocument();
  });

  it("连通性停止后保留当前会话边界，并允许下一轮重新开始", async () => {
    const signals: AbortSignal[] = [];
    const connectivity = {
      supported: true,
      now: () => 100,
      loadResource: vi.fn((_target: { id: string }, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<boolean>(() => undefined);
      }),
    };
    const user = userEvent.setup();
    const rendered = render(
      <NetworkToolDesk adapters={{ connectivity }} view="connectivity" />,
    );

    await user.click(screen.getByRole("button", { name: "开始检查" }));
    await waitFor(() => expect(connectivity.loadResource).toHaveBeenCalledTimes(8));
    expect(screen.getByLabelText("工具状态：检测中")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "停止" }));
    expect(screen.getByLabelText("工具状态：已停止")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新检查" }));
    await waitFor(() => expect(connectivity.loadResource).toHaveBeenCalledTimes(16));
    rendered.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("连通性能力不支持时逐目标显示无法判断", async () => {
    const connectivity = {
      supported: false,
      now: () => 100,
      loadResource: vi.fn(),
    };
    const user = userEvent.setup();

    render(
      <NetworkToolDesk adapters={{ connectivity }} view="connectivity" />,
    );

    await user.click(screen.getByRole("button", { name: "开始检查" }));
    expect((await screen.findAllByText("暂时无法判断")).length).toBeGreaterThan(0);
    expect(connectivity.loadResource).not.toHaveBeenCalled();
  });

  it("WebRTC 为每个 STUN 连接保留当前运行的公网证据", async () => {
    const webrtc: WebRtcAdapter = {
      supported: true,
      now: () => 100,
      createConnection: vi.fn((server) => new FakeWebRtcConnection(server.id)),
      fetchIpGeo: vi.fn(async (ip) => ({
        ip,
        country: "中国",
        countryCode: "CN",
        flagEmoji: "🇨🇳",
        region: "浙江",
        city: "杭州",
        isp: "Chinanet",
      })),
    };
    const user = userEvent.setup();

    render(<NetworkToolDesk adapters={{ webrtc }} view="webrtc" />);

    await user.click(screen.getByRole("button", { name: "开始测试" }));

    await waitFor(() => {
      expect(webrtc.createConnection).toHaveBeenCalledTimes(4);
    });
    expect(await screen.findAllByText("203.0.113.8")).not.toHaveLength(0);
    expect(await screen.findAllByText("端口限制型或对称型")).not.toHaveLength(0);
    expect(await screen.findAllByText("Chinanet")).not.toHaveLength(0);
    await user.click(screen.getAllByText(/SDP 日志/)[0]!);
    expect(await screen.findAllByText(/SDP offer/)).not.toHaveLength(0);
  });

  it("WebRTC 停止会保留停止状态，重跑和卸载都会隔离旧连接", async () => {
    const connections: PendingWebRtcConnection[] = [];
    const webrtc: WebRtcAdapter = {
      supported: true,
      now: () => 100,
      createConnection: vi.fn(() => {
        const connection = new PendingWebRtcConnection();
        connections.push(connection);
        return connection;
      }),
    };
    const user = userEvent.setup();
    const rendered = render(<NetworkToolDesk adapters={{ webrtc }} view="webrtc" />);

    await user.click(screen.getByRole("button", { name: "开始测试" }));
    await waitFor(() => expect(webrtc.createConnection).toHaveBeenCalledTimes(4));
    expect(screen.getByLabelText("工具状态：检测中")).toBeInTheDocument();
    expect(await screen.findAllByText("203.0.113.8")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "停止" }));
    expect(screen.getByLabelText("工具状态：已停止")).toBeInTheDocument();
    expect(screen.getAllByText("203.0.113.8")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "重新测试" }));
    await waitFor(() => expect(webrtc.createConnection).toHaveBeenCalledTimes(8));
    rendered.unmount();
    await waitFor(() => expect(connections.every((connection) => connection.closed)).toBe(true));
  });

  it("测速运行中锁定档位，卸载时取消底层适配器", async () => {
    let downloadSignal: AbortSignal | undefined;
    const speed = {
      supported: true,
      now: () => 100,
      measureLatency: vi.fn(async () => 12),
      download: vi.fn((_bytes: number, signal: AbortSignal) => {
        downloadSignal = signal;
        return new Promise<{ bytesTransferred: number }>(() => undefined);
      }),
      upload: vi.fn(),
    };
    const user = userEvent.setup();
    const rendered = render(<NetworkToolDesk adapters={{ speed }} view="speed" />);

    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);
    await waitFor(() => expect(speed.download).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: /^精测/ })).toBeDisabled();
    rendered.unmount();
    expect(downloadSignal?.aborted).toBe(true);
  });

  it("测速重跑会清除上一轮样本，并从新档位重新开始", async () => {
    let downloadRun = 0;
    const speed = {
      supported: true,
      now: () => 100,
      measureLatency: vi.fn(async () => 12),
      download: vi.fn(async (bytes: number, _signal: AbortSignal, report: (progress: SpeedProgress) => void) => {
        downloadRun += 1;
        if (downloadRun === 1) {
          report({ phase: "download", percent: 1, sampleMbps: 72 });
          return { bytesTransferred: bytes };
        }
        return new Promise<{ bytesTransferred: number }>(() => undefined);
      }),
      upload: vi.fn(async (bytes: number, _signal: AbortSignal, report: (progress: SpeedProgress) => void) => {
        report({ phase: "upload", percent: 1, sampleMbps: 40 });
        return { bytesTransferred: bytes };
      }),
    };
    const user = userEvent.setup();

    render(<NetworkToolDesk adapters={{ speed }} view="speed" />);

    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);
    expect(await screen.findByText(/本轮测量完成/)).toBeInTheDocument();
    expect(screen.getByText("72.00")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "重新测速" })[0]!);
    await waitFor(() => expect(speed.download).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("72.00")).not.toBeInTheDocument();
  });

  it("React StrictMode 不会因为 effect 重放而重复启动工具", async () => {
    const speed = {
      supported: true,
      now: () => 100,
      measureLatency: vi.fn(async () => 12),
      download: vi.fn(
        (_bytes: number, _signal: AbortSignal) =>
          new Promise<{ bytesTransferred: number }>(() => undefined),
      ),
      upload: vi.fn(),
    };
    const user = userEvent.setup();

    render(
      <StrictMode>
        <NetworkToolDesk adapters={{ speed }} view="speed" />
      </StrictMode>,
    );

    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);
    await waitFor(() => expect(speed.download).toHaveBeenCalled());
    expect(speed.measureLatency).toHaveBeenCalledTimes(3);
  });

  it("浏览器能力不支持时保持无法判断，不伪造测速结果", async () => {
    const speed = {
      supported: false,
      now: () => 100,
      measureLatency: vi.fn(async () => 12),
      download: vi.fn(),
      upload: vi.fn(),
    };
    const user = userEvent.setup();

    render(<NetworkToolDesk adapters={{ speed }} view="speed" />);

    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);

    expect(
      await screen.findByLabelText("工具状态：暂时无法判断"),
    ).toBeInTheDocument();
    expect(speed.measureLatency).not.toHaveBeenCalled();
  });

  it("开始全部只启动连通性和 WebRTC，测速仍可独立启动", async () => {
    const connectivity = {
      supported: true,
      now: () => 100,
      loadResource: vi.fn(async () => true),
    };
    const speed = {
      supported: true,
      now: () => 100,
      measureLatency: vi.fn(() => new Promise<number>(() => undefined)),
      download: vi.fn(),
      upload: vi.fn(),
    };
    const user = userEvent.setup();

    render(
      <NetworkToolDesk
        adapters={{
          connectivity,
          speed,
          webrtc: {
            supported: false,
            now: () => 100,
            createConnection: () => {
              throw new Error("unsupported");
            },
          },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "开始全部检测" }));
    await waitFor(() => expect(connectivity.loadResource).toHaveBeenCalledTimes(8));
    expect(speed.measureLatency).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "开始测速" })[0]!);
    await waitFor(() => expect(speed.measureLatency).toHaveBeenCalled());
  });

  it("渲染下载与上传波形图，且图形具备自适应视图属性与安全留白", () => {
    render(<NetworkToolDesk view="speed" />);

    const downloadSvg = screen.getByRole("img", { name: "下载 / Mbps波形图" });
    const uploadSvg = screen.getByRole("img", { name: "上传 / Mbps波形图" });

    expect(downloadSvg).toBeInTheDocument();
    expect(uploadSvg).toBeInTheDocument();

    expect(downloadSvg).toHaveAttribute("viewBox", "0 0 300 72");
    expect(downloadSvg).toHaveAttribute("preserveAspectRatio", "none");
    expect(downloadSvg.classList.contains("h-full")).toBe(true);
    expect(downloadSvg.classList.contains("w-full")).toBe(true);
  });
});
