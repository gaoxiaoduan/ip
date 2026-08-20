import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useNetworkTools,
  type ConnectivityToolState,
  type NetworkToolAdapterOverrides,
  type NetworkToolSessionStatus,
  type SpeedToolState,
  type WebRtcToolState,
} from "@/hooks/use-network-tools";
import {
  CONNECTIVITY_TARGETS,
  SPEED_PROFILES,
  WEBRTC_SERVERS,
  type ConnectivityObservation,
  type ConnectivityTarget,
  type SpeedProfileId,
  type SpeedTestResult,
  type ToolObservationStatus,
  type WebRtcServerResult,
} from "@/lib/network-tools";
import { cn } from "@/lib/utils";

export type NetworkToolView = "all" | "connectivity" | "webrtc" | "speed";

interface NetworkToolDeskProps {
  readonly adapters?: NetworkToolAdapterOverrides;
  readonly view?: NetworkToolView;
}

const STATUS_LABELS: Record<NetworkToolSessionStatus, string> = {
  idle: "等待",
  running: "检测中",
  complete: "已完成",
  stopped: "已停止",
  undetermined: "暂时无法判断",
};

const OBSERVATION_LABELS: Record<ToolObservationStatus, string> = {
  observed: "已加载",
  unobserved: "未加载",
  undetermined: "暂时无法判断",
};

const STATUS_DOT_CLASSES: Record<NetworkToolSessionStatus, string> = {
  idle: "bg-hairline-strong",
  running: "bg-link animate-status-pulse",
  complete: "bg-cyan",
  stopped: "bg-warning",
  undetermined: "bg-violet",
};

const OBSERVATION_DOT_CLASSES: Record<ToolObservationStatus, string> = {
  observed: "bg-cyan",
  unobserved: "bg-warning",
  undetermined: "bg-violet",
};

const OBSERVATION_TEXT_CLASSES: Record<ToolObservationStatus, string> = {
  observed: "text-body",
  unobserved: "text-body",
  undetermined: "text-violet",
};

const STATUS_TEXT_CLASSES: Record<NetworkToolSessionStatus, string> = {
  idle: "text-body",
  running: "text-link",
  complete: "text-body",
  stopped: "text-body",
  undetermined: "text-violet",
};

const formatBytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

const PlayIcon = () => (
  <svg
    aria-hidden="true"
    className="size-4 fill-current"
    viewBox="0 0 16 16"
  >
    <path d="m5 3.25 6.25 4.75L5 12.75v-9.5Z" />
  </svg>
);

const StopIcon = () => (
  <svg
    aria-hidden="true"
    className="size-4 fill-current"
    viewBox="0 0 16 16"
  >
    <rect x="4" y="4" width="8" height="8" rx="1" />
  </svg>
);

const ExternalIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3.5 fill-none stroke-current stroke-[1.4]"
    viewBox="0 0 16 16"
  >
    <path d="M4 12 12 4M7 4h5v5" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    aria-hidden="true"
    className="size-4 fill-none stroke-current stroke-[1.5]"
    viewBox="0 0 16 16"
  >
    <path d="m4 6 4 4 4-4" />
  </svg>
);

const ToolStatus = ({ status }: { status: NetworkToolSessionStatus }) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 text-xs",
      STATUS_TEXT_CLASSES[status],
    )}
    aria-label={`工具状态：${STATUS_LABELS[status]}`}
  >
    <span
      className={cn("size-1.5 rounded-full", STATUS_DOT_CLASSES[status])}
      aria-hidden="true"
    />
    {STATUS_LABELS[status]}
  </span>
);

const ObservationStatus = ({
  status,
}: {
  status: ToolObservationStatus;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 text-xs",
      OBSERVATION_TEXT_CLASSES[status],
    )}
  >
    <span
      className={cn("size-1.5 rounded-full", OBSERVATION_DOT_CLASSES[status])}
      aria-hidden="true"
    />
    {OBSERVATION_LABELS[status]}
  </span>
);

const ToolHeader = ({
  description,
  href,
  onStart,
  onStop,
  startLabel,
  stopLabel,
  status,
  title,
  titleId,
  running,
}: {
  readonly description: string;
  readonly href: string;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly startLabel: string;
  readonly stopLabel: string;
  readonly status: NetworkToolSessionStatus;
  readonly title: string;
  readonly titleId: string;
  readonly running: boolean;
}) => (
  <header className="flex flex-col gap-6 border-b border-hairline px-5 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-7 sm:py-7">
    <div className="max-w-[680px]">
      <div className="flex items-center gap-4">
        <h3
          className="text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-ink"
          id={titleId}
        >
          {title}
        </h3>
        <ToolStatus status={status} />
      </div>
      <p className="mt-3 max-w-[68ch] text-sm leading-5 text-body">
        {description}
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
      {running ? (
        <Button
          className="h-10 rounded-full border border-hairline bg-canvas px-4 text-sm text-body shadow-none hover:bg-canvas-soft-2 hover:text-ink"
          type="button"
          onClick={onStop}
        >
          <StopIcon />
          {stopLabel}
        </Button>
      ) : (
        <Button
          className="h-10 rounded-full bg-ink px-4 text-sm text-white shadow-[0_1px_1px_rgb(0_0_0/5%),0_3px_8px_rgb(0_0_0/12%)] hover:bg-black"
          type="button"
          onClick={onStart}
        >
          <PlayIcon />
          {startLabel}
        </Button>
      )}
      <a
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-xs text-body underline-offset-4 hover:text-ink hover:underline"
        href={href}
      >
        独立页面
        <ExternalIcon />
      </a>
    </div>
  </header>
);

const ConnectivityRow = ({
  observation,
  running,
  target,
}: {
  readonly observation?: ConnectivityObservation;
  readonly running: boolean;
  readonly target: ConnectivityTarget;
}) => {
  const status = observation?.status;
  const timingWidth = observation?.latencyMs
    ? Math.min(100, Math.max(7, observation.latencyMs / 12))
    : 0;

  return (
    <li className="group border-b border-hairline py-4 last:border-b-0 sm:py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "size-2 flex-none rounded-full",
              status
                ? OBSERVATION_DOT_CLASSES[status]
                : running
                  ? "animate-status-pulse bg-link"
                  : "bg-hairline-strong",
            )}
            aria-hidden="true"
          />
          <span className="truncate text-sm font-medium text-ink">
            {target.label}
          </span>
        </div>
        <div className="flex flex-none items-center gap-4">
          {status ? (
            <ObservationStatus status={status} />
          ) : (
            <span className="text-xs text-mute">{running ? "检测中" : "等待"}</span>
          )}
          <span className="w-[62px] text-right font-mono text-xs tabular-nums text-mute">
            {observation?.latencyMs === null || observation?.latencyMs === undefined
              ? "—"
              : `${observation.latencyMs} ms`}
          </span>
        </div>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-canvas-soft-2"
        aria-hidden="true"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300",
            status === "observed"
              ? "bg-link"
              : status === "unobserved"
                ? "bg-warning"
                : status === "undetermined"
                  ? "bg-violet"
                  : "bg-hairline-strong",
          )}
          style={{ width: `${timingWidth}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-mute">
        资源请求
        {observation?.reason === "load-error" ? " · 资源未加载" : ""}
        {observation?.reason === "timeout" ? " · 请求超时" : ""}
        {observation?.reason === "cancelled" ? " · 已停止" : ""}
        {observation?.reason === "unsupported" ? " · 暂时无法判断" : ""}
      </p>
    </li>
  );
};

const ConnectivityGroup = ({
  group,
  observations,
  running,
  title,
}: {
  readonly group: ConnectivityTarget["group"];
  readonly observations: readonly ConnectivityObservation[];
  readonly running: boolean;
  readonly title: string;
}) => {
  const observationById = new Map(
    observations.map((observation) => [observation.target.id, observation]),
  );

  return (
    <div className="px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <span className="font-mono text-xs text-mute">
          {CONNECTIVITY_TARGETS.filter((target) => target.group === group).length} 个网站
        </span>
      </div>
      <ul className="mt-3">
        {CONNECTIVITY_TARGETS.filter((target) => target.group === group).map(
          (target) => (
            <ConnectivityRow
              key={target.id}
              observation={observationById.get(target.id)}
              running={running}
              target={target}
            />
          ),
        )}
      </ul>
    </div>
  );
};

const ConnectivityTool = ({
  connectivity,
  onStart,
  onStop,
}: {
  readonly connectivity: ConnectivityToolState;
  readonly onStart: () => void;
  readonly onStop: () => void;
}) => {
  const running = connectivity.status === "running";
  const observedCount = connectivity.observations.filter(
    (observation) => observation.status === "observed",
  ).length;
  const judgedCount = connectivity.observations.length;

  return (
    <section
      className="overflow-hidden border-y border-hairline bg-canvas"
      id="connectivity-tool"
      aria-labelledby="connectivity-title"
    >
      <ToolHeader
        description="检查八个常用网站的资源请求是否成功，并显示每次请求的耗时。"
        href="/connectivity"
        onStart={onStart}
        onStop={onStop}
        running={running}
        startLabel={connectivity.status === "idle" ? "开始检查" : "重新检查"}
        stopLabel="停止"
        status={connectivity.status}
        title="网络连通性"
        titleId="connectivity-title"
      />
      <div className="grid grid-cols-1 divide-y divide-hairline md:grid-cols-2 md:divide-x md:divide-y-0">
        <ConnectivityGroup
          group="domestic"
          observations={connectivity.observations}
          running={running}
          title="国内"
        />
        <ConnectivityGroup
          group="international"
          observations={connectivity.observations}
          running={running}
          title="国外"
        />
      </div>
      <div className="border-t border-hairline bg-canvas-soft px-5 py-4 text-xs leading-5 text-body sm:px-7">
        <p aria-live="polite">
          {connectivity.status === "idle"
            ? "网站清单固定，不提供临时添加的网站。"
            : `已检查 ${judgedCount} / ${CONNECTIVITY_TARGETS.length} 个网站，${observedCount} 个资源请求成功。`}
        </p>
      </div>
    </section>
  );
};

const WebRtcLeakIcon = () => (
  <svg
    aria-hidden="true"
    className="size-5 fill-none stroke-current stroke-[1.75]"
    viewBox="0 0 24 24"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m4.5 4.5 15 15" />
  </svg>
);

const WebRtcCardIcon = () => (
  <svg
    aria-hidden="true"
    className="size-4 fill-none stroke-current stroke-[1.6]"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="3" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <path d="M10.5 10.5 6.5 6.5M13.5 10.5l4-4M10.5 13.5l-4 4M13.5 13.5l4 4" />
  </svg>
);

const NatIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3.5 flex-none fill-none stroke-current stroke-[1.5]"
    viewBox="0 0 16 16"
  >
    <circle cx="4" cy="4" r="2" />
    <circle cx="12" cy="4" r="2" />
    <circle cx="4" cy="12" r="2" />
    <path d="M4 6v4M4 8h5a3 3 0 0 0 3-3V6" />
  </svg>
);

const NetworkIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3.5 flex-none fill-none stroke-current stroke-[1.5]"
    viewBox="0 0 16 16"
  >
    <rect x="2" y="3" width="12" height="8" rx="1.5" />
    <path d="M8 11v3M5 14h6" />
  </svg>
);

const LocationIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3.5 flex-none fill-none stroke-current stroke-[1.5]"
    viewBox="0 0 16 16"
  >
    <path d="M8 14s4-4.5 4-7.5A4 4 0 0 0 4 6.5C4 9.5 8 14 8 14z" />
    <circle cx="8" cy="6.5" r="1.5" />
  </svg>
);

const DocIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3.5 flex-none fill-none stroke-current stroke-[1.4]"
    viewBox="0 0 16 16"
  >
    <path d="M3.5 2.5h6l3 3v8h-9v-11z" />
    <path d="M9.5 2.5v3h3M6 8h4M6 10.5h4" />
  </svg>
);

const CopyIconSmall = () => (
  <svg
    aria-hidden="true"
    className="size-3 fill-none stroke-current stroke-[1.5]"
    viewBox="0 0 16 16"
  >
    <rect x="5" y="5" width="8" height="8" rx="1" />
    <path d="M3 11H2.5A1.5 1.5 0 0 1 1 9.5V2.5A1.5 1.5 0 0 1 2.5 1H9.5A1.5 1.5 0 0 1 11 2.5V3" />
  </svg>
);

interface WebRtcCardProps {
  readonly index: number;
  readonly server: (typeof WEBRTC_SERVERS)[number];
  readonly result?: WebRtcServerResult;
  readonly running: boolean;
  readonly copiedIp: string | null;
  readonly onCopy: (ip: string) => void;
}

const WebRtcCard = ({
  index,
  server,
  result,
  running,
  copiedIp,
  onCopy,
}: WebRtcCardProps) => {
  const hasIp = Boolean(result?.ip);
  const logCount = result?.logs.length ?? 0;
  const isCopied = copiedIp === result?.ip;

  return (
    <article className="flex flex-col justify-between rounded-xl border border-hairline bg-canvas p-5 transition-shadow hover:shadow-md sm:p-5">
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-hairline pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex-none text-link" aria-hidden="true">
              <WebRtcCardIcon />
            </span>
            <h4 className="truncate text-sm font-semibold text-ink">WebRTC 连接</h4>
          </div>
          <span className="flex-none font-mono text-xs font-medium text-mute">
            #{index + 1}
          </span>
        </div>

        <p className="mt-2.5 truncate font-mono text-[11px] text-mute" title={server.host}>
          {server.host}
        </p>

        <div className="my-4 flex items-center justify-between gap-2 rounded-lg bg-canvas-soft p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "size-2.5 flex-none rounded-full transition-colors",
                running
                  ? "animate-status-pulse bg-link"
                  : hasIp
                    ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                    : result
                      ? "bg-warning"
                      : "bg-hairline-strong",
              )}
              aria-hidden="true"
            />
            {running && !result ? (
              <span className="animate-pulse text-xs text-mute">正在检测...</span>
            ) : hasIp ? (
              <code className="truncate font-mono text-[17px] font-semibold tracking-tight text-ink">
                {result!.ip}
              </code>
            ) : result ? (
              <span className="text-xs text-mute">未发现公网 IP</span>
            ) : (
              <span className="text-xs text-mute">等待检测</span>
            )}
          </div>

          {hasIp ? (
            <button
              className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded border border-hairline bg-canvas px-2 text-[11px] text-body hover:bg-canvas-soft-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-link"
              type="button"
              onClick={() => onCopy(result!.ip!)}
              aria-label={`复制 IP ${result!.ip}`}
              title="复制 IP"
            >
              <CopyIconSmall />
              <span>{isCopied ? "已复制" : "复制"}</span>
            </button>
          ) : null}
        </div>

        <dl className="space-y-3 pt-1 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-mute" aria-hidden="true">
              <NatIcon />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] text-mute">NAT</dt>
              <dd className="mt-0.5 truncate font-medium text-ink">
                {result?.natType || (running ? "检测中..." : "—")}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-mute" aria-hidden="true">
              <NetworkIcon />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] text-mute">网络</dt>
              <dd className="mt-0.5 truncate font-medium text-ink" title={result?.isp ?? undefined}>
                {result?.isp || (running ? "检测中..." : "—")}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-mute" aria-hidden="true">
              <LocationIcon />
            </span>
            <div className="min-w-0 flex-1">
              <dt className="text-[11px] text-mute">地区</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 truncate font-medium text-ink">
                {result?.flagEmoji ? <span aria-hidden="true">{result.flagEmoji}</span> : null}
                <span className="truncate">
                  {result?.country
                    ? result.city
                      ? `${result.country} · ${result.city}`
                      : result.country
                    : running
                      ? "检测中..."
                      : "—"}
                </span>
              </dd>
            </div>
          </div>
        </dl>
      </div>

      <details className="group mt-5 border-t border-hairline pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs text-mute hover:text-ink focus-visible:outline-2 focus-visible:outline-link [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <DocIcon />
            SDP 日志 ({logCount})
          </span>
          <span className="transition-transform duration-200 group-open:rotate-180">
            <ChevronIcon />
          </span>
        </summary>
        <pre className="mt-2.5 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-ink p-3 font-mono text-[10px] leading-relaxed text-canvas-soft-2">
          {result?.logs.join("\n") || "本轮没有诊断日志。"}
        </pre>
      </details>
    </article>
  );
};

const WebRtcTool = ({
  onStart,
  onStop,
  webrtc,
}: {
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly webrtc: WebRtcToolState;
}) => {
  const running = webrtc.status === "running";
  const resultsById = new Map(
    webrtc.servers.map((result) => [result.server.id, result]),
  );
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const handleCopy = (ip: string) => {
    void navigator.clipboard?.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  return (
    <section
      className="overflow-hidden border-y border-hairline bg-canvas"
      id="webrtc-tool"
      aria-labelledby="webrtc-title"
    >
      <header className="flex flex-col gap-6 border-b border-hairline px-5 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-7 sm:py-7">
        <div className="max-w-[720px]">
          <div className="flex items-center gap-3">
            <span className="flex-none text-warning" aria-hidden="true">
              <WebRtcLeakIcon />
            </span>
            <h3
              className="text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-ink"
              id="webrtc-title"
            >
              WebRTC 泄漏测试
            </h3>
            <ToolStatus status={webrtc.status} />
          </div>
          <p className="mt-3 max-w-[68ch] text-sm leading-6 text-body">
            WebRTC 往往通过 UDP 直连进行建立，如果测试返回了真实 IP，则意味着你的代理设置没有覆盖这些连接。除了检测你连接 WebRTC 时所使用的 IP，我们还会检测你的 NAT 类型。然而，NAT 类型的检测并不是 100% 准确的，仅供参考。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {running ? (
            <Button
              className="h-10 rounded-full border border-hairline bg-canvas px-4 text-sm text-body shadow-none hover:bg-canvas-soft-2 hover:text-ink"
              type="button"
              onClick={onStop}
            >
              <StopIcon />
              停止
            </Button>
          ) : (
            <Button
              className="h-10 rounded-full bg-ink px-4 text-sm text-white shadow-[0_1px_1px_rgb(0_0_0/5%),0_3px_8px_rgb(0_0_0/12%)] hover:bg-black"
              type="button"
              onClick={onStart}
            >
              <PlayIcon />
              {webrtc.status === "idle" ? "开始测试" : "重新测试"}
            </Button>
          )}
          <a
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-xs text-body underline-offset-4 hover:text-ink hover:underline"
            href="/webrtc"
          >
            独立页面
            <ExternalIcon />
          </a>
        </div>
      </header>

      <div className="p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WEBRTC_SERVERS.map((server, index) => (
            <WebRtcCard
              key={server.id}
              index={index}
              server={server}
              result={resultsById.get(server.id)}
              running={running}
              copiedIp={copiedIp}
              onCopy={handleCopy}
            />
          ))}
        </div>
      </div>

      <p className="border-t border-hairline bg-canvas-soft px-5 py-4 text-xs leading-5 text-mute sm:px-7">
        WebRTC 请求直接从当前浏览器发往对应 STUN 服务；测试结果只存在本轮会话中，不保存个人检测历史。
      </p>
    </section>
  );
};

const formatMetric = (value: number | null, unit: string) =>
  value === null ? "—" : `${value} ${unit}`;

const SpeedTrace = ({ samples }: { samples: readonly number[] }) => {
  if (samples.length < 2) {
    return null;
  }
  const max = Math.max(...samples, 1);
  const points = samples
    .map((sample, index) => {
      const x = (index / (samples.length - 1)) * 300;
      const y = 72 - (sample / max) * 56;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="mt-7 border-t border-hairline pt-5">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-xs font-medium text-body">测量轨迹</h4>
        <span className="font-mono text-xs text-mute">Mbps / sample</span>
      </div>
      <svg
        className="mt-4 h-20 w-full overflow-visible"
        viewBox="0 0 300 80"
        preserveAspectRatio="none"
        role="img"
        aria-label="测速过程曲线"
      >
        <path d="M0 72H300" className="fill-none stroke-hairline" strokeWidth="1" />
        <polyline
          points={points}
          className="fill-none stroke-link"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </div>
  );
};

const SpeedMetrics = ({ result }: { result: SpeedTestResult }) => (
  <dl className="grid grid-cols-2 border-y border-hairline sm:grid-cols-5">
    {[
      ["下载", formatMetric(result.downloadMbps, "Mb/s")],
      ["上传", formatMetric(result.uploadMbps, "Mb/s")],
      ["空闲延迟", formatMetric(result.latencyMs, "ms")],
      ["抖动", formatMetric(result.jitterMs, "ms")],
      ["耗时", formatMetric(result.durationMs, "ms")],
    ].map(([label, value], index) => (
      <div
        className={cn(
          "border-b border-hairline px-3 py-4 first:pl-0 sm:border-b-0 sm:border-r sm:py-5 sm:last:border-r-0",
          index > 1 && "sm:border-t-0",
        )}
        key={label}
      >
        <dt className="text-xs text-mute">{label}</dt>
        <dd className="mt-2 font-mono text-[15px] tabular-nums tracking-[-0.02em] text-ink">
          {value}
        </dd>
      </div>
    ))}
  </dl>
);

const SpeedTool = ({
  onStart,
  onSelect,
  onStop,
  speed,
}: {
  readonly onStart: (profile?: SpeedProfileId) => void;
  readonly onSelect: (profile: SpeedProfileId) => void;
  readonly onStop: () => void;
  readonly speed: SpeedToolState;
}) => {
  const running = speed.status === "running";
  const result = speed.result;

  return (
    <section
      className="overflow-hidden border-y border-hairline bg-canvas"
      id="speed-tool"
      aria-labelledby="speed-title"
    >
      <ToolHeader
        description="通过 Cloudflare edge 直接测量下载、上传、空闲延迟和抖动。速度只呈现本轮测量结果，不把数字转换成网络好坏或代理正常异常的评分。"
        href="/speed-test"
        onStart={() => onStart(speed.profile)}
        onStop={onStop}
        running={running}
        startLabel={speed.status === "idle" ? "开始测速" : "重新测速"}
        stopLabel="停止测速"
        status={speed.status}
        title="网速测试"
        titleId="speed-title"
      />
      <div className="grid grid-cols-1 gap-8 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
        <div>
          <div className="rounded-md bg-warning-soft px-4 py-3 text-xs leading-5 text-body">
            测试会直接消耗流量。{SPEED_PROFILES[speed.profile].warning}
          </div>
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-ink">测速档位</legend>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="测速档位">
              {(Object.keys(SPEED_PROFILES) as SpeedProfileId[]).map((profileId) => {
                const profile = SPEED_PROFILES[profileId];
                const selected = speed.profile === profileId;
                return (
                  <button
                    className={cn(
                      "min-h-[72px] cursor-pointer rounded-md border px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link",
                      selected
                        ? "border-ink bg-ink text-white"
                        : "border-hairline bg-canvas text-body hover:border-hairline-strong hover:text-ink",
                    )}
                    key={profileId}
                    type="button"
                    aria-pressed={selected}
                    disabled={running}
                    onClick={() => onSelect(profileId)}
                  >
                    <span className="block text-xs font-medium">{profile.label}</span>
                    <span className={cn("mt-1 block font-mono text-xs", selected ? "text-canvas-soft-2" : "text-mute")}>
                      {formatBytes(profile.downloadBytes)} ↓ / {formatBytes(profile.uploadBytes)} ↑
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div aria-live="polite" className="min-w-0">
          {running ? (
            <div className="border-y border-hairline py-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-ink">
                  {speed.phase === "latency"
                    ? "正在测量空闲延迟"
                    : speed.phase === "download"
                      ? "正在测量下载"
                      : "正在测量上传"}
                </span>
                <span className="font-mono text-xs tabular-nums text-body">
                  {Math.round(speed.progress * 100)}%
                </span>
              </div>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-canvas-soft-2">
                <span
                  className="block h-full rounded-full bg-link transition-[width] duration-200"
                  style={{ width: `${speed.progress * 100}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-body">
                当前页面正在产生流量；可以随时停止，本次数据不会被保存。
              </p>
            </div>
          ) : result ? (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <p className="text-sm text-body">
                  {result.status === "complete"
                    ? "本轮测量完成"
                    : result.status === "stopped"
                      ? "本轮已停止"
                      : "本轮无法判断"}
                </p>
                <span className="font-mono text-xs text-mute">
                  {SPEED_PROFILES[result.profile].label}
                </span>
              </div>
              <SpeedMetrics result={result} />
              <SpeedTrace samples={result.samples} />
            </>
          ) : (
            <div className="grid min-h-[226px] place-items-center border-y border-hairline px-8 text-center">
              <div>
                <p className="text-sm font-medium text-ink">尚未开始测速</p>
                <p className="mt-2 max-w-[34ch] text-xs leading-5 text-body">
                  选择档位后开始；“开始全部检测”不会触发这里的流量测试。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-hairline bg-canvas-soft px-5 py-4 text-xs leading-5 text-body sm:px-7">
        测速请求从当前浏览器直接发往 Cloudflare edge；结果只存在本轮工具测试会话中。
      </p>
    </section>
  );
};

export function NetworkToolDesk({
  adapters,
  view = "all",
}: NetworkToolDeskProps) {
  const showConnectivity = view === "all" || view === "connectivity";
  const showWebrtc = view === "all" || view === "webrtc";
  const showSpeed = view === "all" || view === "speed";
  const {
    startAll,
    connectivity,
    speed,
    webrtc,
    startConnectivity,
    startSpeed,
    startWebrtc,
    selectSpeedProfile,
    stopConnectivity,
    stopSpeed,
    stopWebrtc,
  } = useNetworkTools(adapters);

  if (view !== "all") {
    return (
      <div className="space-y-12">
        {showConnectivity ? (
          <ConnectivityTool
            connectivity={connectivity}
            onStart={startConnectivity}
            onStop={stopConnectivity}
          />
        ) : null}
        {showWebrtc ? (
          <WebRtcTool
            onStart={startWebrtc}
            onStop={stopWebrtc}
            webrtc={webrtc}
          />
        ) : null}
        {showSpeed ? (
          <SpeedTool
            onStart={startSpeed}
            onSelect={selectSpeedProfile}
            onStop={stopSpeed}
            speed={speed}
          />
        ) : null}
      </div>
    );
  }

  const allRunning =
    connectivity.status === "running" || webrtc.status === "running";

  return (
    <section
      className="scroll-mt-16 bg-canvas-soft px-4 py-18 sm:px-6 sm:py-28"
      id="tools"
      aria-labelledby="tools-title"
    >
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="flex flex-col gap-6 border-b border-hairline pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-12">
          <div className="max-w-[720px]">
            <h2
              className="text-[clamp(30px,3.2vw,44px)] leading-[1.04] font-semibold tracking-[-0.04em]"
              id="tools-title"
            >
              网络工具台
            </h2>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-6 text-body">
              在同一个页面里分别观察网站资源请求、WebRTC 候选和当前网络的测量数据。每个工具都默认等待，由你决定何时开始。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="h-11 rounded-full bg-ink px-5 text-sm text-white shadow-[0_1px_1px_rgb(0_0_0/5%),0_3px_8px_rgb(0_0_0/12%)] hover:bg-black"
              type="button"
              disabled={allRunning}
              onClick={startAll}
            >
              <PlayIcon />
              开始全部检测
            </Button>
            <span className="font-mono text-xs text-mute">不含测速</span>
          </div>
        </div>
        <div className="mt-12 space-y-12">
          {showConnectivity ? (
            <ConnectivityTool
              connectivity={connectivity}
              onStart={startConnectivity}
              onStop={stopConnectivity}
            />
          ) : null}
          {showWebrtc ? (
            <WebRtcTool
              onStart={startWebrtc}
              onStop={stopWebrtc}
              webrtc={webrtc}
            />
          ) : null}
          {showSpeed ? (
            <SpeedTool
              onStart={startSpeed}
              onSelect={selectSpeedProfile}
              onStop={stopSpeed}
              speed={speed}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
