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
  getBandwidthEquivalent,
  type ConnectivityObservation,
  type ConnectivityTarget,
  type SpeedProfileId,
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

const ConnectivityIcon = () => (
  <svg
    aria-hidden="true"
    className="size-5 fill-none stroke-current stroke-[1.75]"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ToolHeader = ({
  icon,
  description,
  href,
  onStart,
  onStop,
  startLabel,
  stopLabel = "停止",
  status,
  title,
  titleId,
  running,
}: {
  readonly icon: React.ReactNode;
  readonly description: string;
  readonly href: string;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly startLabel: string;
  readonly stopLabel?: string;
  readonly status: NetworkToolSessionStatus;
  readonly title: string;
  readonly titleId: string;
  readonly running: boolean;
}) => (
  <header className="flex flex-col gap-5 border-b border-hairline px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-7 sm:py-6">
    <div className="max-w-[700px]">
      <div className="flex flex-wrap items-center gap-3 sm:gap-3.5">
        <span className="flex-none text-link" aria-hidden="true">
          {icon}
        </span>
        <h3
          className="text-[clamp(22px,3vw,30px)] leading-tight font-semibold tracking-[-0.035em] text-ink"
          id={titleId}
        >
          {title}
        </h3>
        <ToolStatus status={status} />
      </div>
      <p className="mt-2.5 max-w-[68ch] text-sm leading-6 text-body">
        {description}
      </p>
    </div>
    <div className="flex items-center justify-between gap-3 sm:justify-end">
      {running ? (
        <Button
          className="h-10 rounded-full border border-hairline bg-canvas px-4 text-sm text-body shadow-none hover:bg-canvas-soft-2 hover:text-ink cursor-pointer"
          type="button"
          onClick={onStop}
        >
          <StopIcon />
          {stopLabel}
        </Button>
      ) : (
        <Button
          className="h-10 rounded-full bg-ink px-4 text-sm text-white shadow-[0_1px_1px_rgb(0_0_0/5%),0_3px_8px_rgb(0_0_0/12%)] hover:bg-black cursor-pointer"
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
    <li className="group border-b border-hairline/80 py-3.5 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
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
        <div className="flex flex-none items-center gap-3.5">
          {status ? (
            <ObservationStatus status={status} />
          ) : (
            <span className="text-xs text-mute">{running ? "检测中" : "等待"}</span>
          )}
          <span className="w-[60px] text-right font-mono text-xs tabular-nums text-mute">
            {observation?.latencyMs === null || observation?.latencyMs === undefined
              ? "—"
              : `${observation.latencyMs} ms`}
          </span>
        </div>
      </div>
      <div
        className="mt-2.5 h-1 overflow-hidden rounded-full bg-canvas-soft-2"
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
      <p className="mt-1.5 text-xs leading-5 text-mute">
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
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-hairline/60">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <span className="font-mono text-xs text-mute">
          {CONNECTIVITY_TARGETS.filter((target) => target.group === group).length} 个网站
        </span>
      </div>
      <ul className="mt-2">
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
      className="overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[0_1px_3px_rgb(0_0_0/3%),0_6px_20px_rgb(0_0_0/4%)]"
      id="connectivity-tool"
      aria-labelledby="connectivity-title"
    >
      <ToolHeader
        icon={<ConnectivityIcon />}
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
      <div className="border-t border-hairline bg-canvas-soft/60 px-5 py-3.5 text-xs leading-5 text-body sm:px-7">
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

const SpeedGaugeIcon = () => (
  <svg
    aria-hidden="true"
    className="size-5 fill-none stroke-current stroke-[1.75]"
    viewBox="0 0 24 24"
  >
    <path d="M12 14v-4M3.34 19a10 10 0 1 1 17.32 0" />
    <path d="m14.5 9.5-2.5 4.5" />
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
                    ? "bg-cyan shadow-[0_0_0_3px_rgb(80_227_194/24%)]"
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
      className="overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[0_1px_3px_rgb(0_0_0/3%),0_6px_20px_rgb(0_0_0/4%)]"
      id="webrtc-tool"
      aria-labelledby="webrtc-title"
    >
      <ToolHeader
        icon={<WebRtcLeakIcon />}
        description="WebRTC 往往通过 UDP 直连进行建立，如果测试返回了真实 IP，则意味着你的代理设置没有覆盖这些连接。除了检测你连接 WebRTC 时所使用的 IP，我们还会检测你的 NAT 类型。然而，NAT 类型的检测并不是 100% 准确的，仅供参考。"
        href="/webrtc"
        onStart={onStart}
        onStop={onStop}
        running={running}
        startLabel={webrtc.status === "idle" ? "开始测试" : "重新测试"}
        stopLabel="停止"
        status={webrtc.status}
        title="WebRTC 泄漏测试"
        titleId="webrtc-title"
      />

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

      <p className="border-t border-hairline bg-canvas-soft/60 px-5 py-3.5 text-xs leading-5 text-mute sm:px-7">
        WebRTC 请求直接从当前浏览器发往对应 STUN 服务；测试结果只存在本轮会话中，不保存个人检测历史。
      </p>
    </section>
  );
};

const generateBezierPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M 0 ${first.y.toFixed(1)} L 300 ${first.y.toFixed(1)}`;
  let path = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    if (!current || !next) continue;
    const controlX1 = current.x + (next.x - current.x) / 2;
    const controlY1 = current.y;
    const controlX2 = current.x + (next.x - current.x) / 2;
    const controlY2 = next.y;
    path += ` C ${controlX1.toFixed(1)} ${controlY1.toFixed(1)}, ${controlX2.toFixed(1)} ${controlY2.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return path;
};

const SpeedWaveform = ({
  samples,
  currentValue,
  theme = "cyan",
  label,
  active = false,
}: {
  readonly samples: readonly number[];
  readonly currentValue: number | null;
  readonly theme?: "cyan" | "link";
  readonly label: string;
  readonly active?: boolean;
}) => {
  const isCyan = theme === "cyan";
  const strokeColor = isCyan ? "#50e3c2" : "#0070f3";
  const gradientId = isCyan ? "grad-cyan-speed" : "grad-link-speed";

  const points = (() => {
    if (samples.length === 0) {
      return [];
    }
    const maxVal = Math.max(...samples, 10);
    const allSamples = [0, ...samples];
    return allSamples.map((sample, idx) => ({
      x: (idx / (allSamples.length - 1)) * 300,
      y: 65 - (sample / maxVal) * 50,
    }));
  })();

  const linePath = generateBezierPath(points);
  const areaPath =
    points.length > 0 ? `${linePath} L 300 70 L 0 70 Z` : "";

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-hairline bg-canvas p-4 sm:p-5">
      <div className="relative z-10 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-xs font-semibold text-body">
          <span
            className={cn(
              "size-2 rounded-full",
              active
                ? isCyan
                  ? "animate-pulse bg-cyan shadow-[0_0_8px_rgb(80_227_194/60%)]"
                  : "animate-pulse bg-link shadow-[0_0_8px_rgb(0_112_243/60%)]"
                : "bg-mute/40",
            )}
          />
          {label}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-bold tracking-tight text-ink sm:text-3xl tabular-nums">
            {currentValue !== null && currentValue > 0
              ? currentValue.toFixed(2)
              : "0.00"}
          </span>
          <span className="font-mono text-xs text-mute">Mbps</span>
        </div>
      </div>

      <div className="relative z-10 mt-3 h-16 w-full">
        <svg
          className="h-full w-full overflow-visible"
          viewBox="0 0 300 70"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${label}波形图`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop
                offset="0%"
                stopColor={strokeColor}
                stopOpacity="0.25"
              />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1="0"
            y1="68"
            x2="300"
            y2="68"
            className="stroke-hairline"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="35"
            x2="300"
            y2="35"
            className="stroke-hairline"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}

          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <line
              x1="0"
              y1="68"
              x2="300"
              y2="68"
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.3"
            />
          )}
        </svg>
      </div>
    </div>
  );
};

const SpeedPulseButton = ({
  status,
  phase,
  progress,
  onClick,
}: {
  readonly status: NetworkToolSessionStatus;
  readonly phase: SpeedToolState["phase"];
  readonly progress: number;
  readonly onClick: () => void;
}) => {
  const running = status === "running";

  const statusText = (() => {
    if (running) {
      if (phase === "latency") return "测时延中";
      if (phase === "download") return "测下载中";
      if (phase === "upload") return "测上传中";
      return "测试中...";
    }
    if (status === "complete" || status === "stopped") {
      return "重新测速";
    }
    return "开始测速";
  })();

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div
        className={cn(
          "pointer-events-none absolute -inset-3 rounded-full transition-all duration-700",
          running
            ? "animate-status-pulse bg-cyan/20 opacity-60 blur-md"
            : "opacity-0 group-hover:opacity-40 bg-ink/5 blur-lg",
        )}
      />

      <button
        type="button"
        onClick={onClick}
        aria-label={running ? "停止测速" : status === "idle" ? "开始测速" : "重新测速"}
        className={cn(
          "group relative flex size-32 cursor-pointer flex-col items-center justify-center rounded-full bg-ink text-white transition-all duration-200 focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-4 active:scale-95 sm:size-36",
          running
            ? "shadow-[0_0_0_2px_rgb(23_23_23),0_0_0_5px_rgb(80_227_194/40%),0_8px_24px_rgb(0_0_0/20%)]"
            : "shadow-[0_1px_2px_rgb(0_0_0/6%),0_8px_20px_rgb(0_0_0/12%)] hover:bg-black hover:shadow-[0_2px_4px_rgb(0_0_0/8%),0_12px_28px_rgb(0_0_0/18%)]",
        )}
      >
        {running ? (
          <svg
            className="absolute inset-0 size-full -rotate-90 animate-spin [animation-duration:4s]"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgb(255 255 255 / 15%)"
              strokeWidth="3"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--color-cyan)"
              strokeWidth="3.5"
              strokeDasharray="60 120"
              strokeLinecap="round"
            />
          </svg>
        ) : null}

        <span className="relative z-10 text-lg font-bold tracking-tight text-white sm:text-xl">
          {statusText}
        </span>

        {running ? (
          <span className="relative z-10 mt-0.5 font-mono text-[11px] font-semibold text-hairline-strong tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        ) : (
          <span className="relative z-10 mt-0.5 text-[10px] font-medium text-hairline-strong">
            {status === "idle" ? "点击开始" : "再次测试"}
          </span>
        )}
      </button>
    </div>
  );
};

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

  const downloadSamples =
    speed.downloadSamples.length > 0
      ? speed.downloadSamples
      : result?.downloadSamples ?? [];
  const uploadSamples =
    speed.uploadSamples.length > 0
      ? speed.uploadSamples
      : result?.uploadSamples ?? [];

  const downloadCurrentValue =
    speed.phase === "download"
      ? speed.currentMbps
      : result?.downloadMbps ?? null;
  const uploadCurrentValue =
    speed.phase === "upload"
      ? speed.currentMbps
      : result?.uploadMbps ?? null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[0_1px_3px_rgb(0_0_0/3%),0_6px_20px_rgb(0_0_0/4%)]"
      id="speed-tool"
      aria-labelledby="speed-title"
    >
      <ToolHeader
        icon={<SpeedGaugeIcon />}
        description={`通过 Cloudflare edge 直接测量下载、上传、空闲延迟和抖动。测试会直接消耗流量，${SPEED_PROFILES[speed.profile].warning}`}
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

      <div className="p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
          {/* Left Column: Console */}
          <div className="flex flex-col items-center justify-between gap-6 rounded-xl border border-hairline bg-canvas-soft/60 p-6">
            <SpeedPulseButton
              status={speed.status}
              phase={speed.phase}
              progress={speed.progress}
              onClick={() => {
                if (running) {
                  onStop();
                } else {
                  onStart(speed.profile);
                }
              }}
            />

            {/* Node & IP metadata */}
            <div className="w-full space-y-3 border-t border-hairline pt-4 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-mute" aria-hidden="true">
                  <LocationIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-mute">当前网络</span>
                  <p className="truncate font-medium text-ink">本机网络 · 出口直连</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-mute" aria-hidden="true">
                  <NetworkIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-mute">测速节点</span>
                  <p className="truncate font-medium text-ink">Cloudflare Edge · 全球加速节点</p>
                </div>
              </div>
            </div>

            {/* Profile switchers */}
            <div className="w-full border-t border-hairline pt-4">
              <span className="block text-[11px] font-semibold text-mute">测速档位</span>
              <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="测速档位">
                {(Object.keys(SPEED_PROFILES) as SpeedProfileId[]).map((profileId) => {
                  const profile = SPEED_PROFILES[profileId];
                  const selected = speed.profile === profileId;
                  return (
                    <button
                      key={profileId}
                      type="button"
                      aria-pressed={selected}
                      disabled={running}
                      onClick={() => onSelect(profileId)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-link cursor-pointer",
                        selected
                          ? "border-ink bg-ink text-white"
                          : "border-hairline bg-canvas text-body hover:border-hairline-strong hover:text-ink",
                      )}
                    >
                      <span className="block text-xs font-semibold">{profile.label}</span>
                      <span className={cn("block font-mono text-[10px] mt-0.5", selected ? "text-canvas-soft-2" : "text-mute")}>
                        {formatBytes(profile.downloadBytes + profile.uploadBytes)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Dashboard */}
          <div className="flex flex-col justify-between gap-4">
            {/* Top Banner Summary */}
            <div className="flex min-h-12 items-center justify-between rounded-xl border border-hairline bg-canvas-soft/60 px-4 py-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">
                  {result?.status === "complete" ? "🎉" : running ? "🚀" : "💡"}
                </span>
                <span className="font-medium text-ink">
                  {result?.status === "complete"
                    ? `本轮测量完成 · 你的网速${getBandwidthEquivalent(result.downloadMbps)}`
                    : result?.status === "stopped"
                      ? "本轮已停止"
                      : running
                        ? speed.phase === "latency"
                          ? "正在测量空闲延迟与抖动..."
                          : speed.phase === "download"
                            ? "正在测量下行下载速率..."
                            : "正在测量上行上传速率..."
                        : "尚未开始测速，点击左侧按钮或右上角即可开始"}
                </span>
              </div>
              <span className="font-mono text-xs text-mute">
                {SPEED_PROFILES[speed.profile].label}
              </span>
            </div>

            {/* Realtime Waveforms */}
            <div className="grid grid-cols-1 gap-4">
              <SpeedWaveform
                label="下载 / Mbps"
                theme="cyan"
                samples={downloadSamples}
                currentValue={downloadCurrentValue}
                active={speed.phase === "download"}
              />
              <SpeedWaveform
                label="上传 / Mbps"
                theme="link"
                samples={uploadSamples}
                currentValue={uploadCurrentValue}
                active={speed.phase === "upload"}
              />
            </div>

            {/* Bottom Metrics Bar */}
            <dl className="grid grid-cols-3 gap-2 rounded-xl border border-hairline bg-canvas-soft/60 p-3 sm:p-4">
              <div className="px-2 text-center sm:text-left">
                <dt className="text-[11px] text-mute">空闲延迟</dt>
                <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-ink sm:text-lg">
                  {result?.latencyMs !== null && result?.latencyMs !== undefined
                    ? `${result.latencyMs} ms`
                    : "—"}
                </dd>
              </div>
              <div className="border-x border-hairline px-2 text-center sm:text-left">
                <dt className="text-[11px] text-mute">抖动</dt>
                <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-ink sm:text-lg">
                  {result?.jitterMs !== null && result?.jitterMs !== undefined
                    ? `${result.jitterMs} ms`
                    : "—"}
                </dd>
              </div>
              <div className="px-2 text-center sm:text-left">
                <dt className="text-[11px] text-mute">耗时</dt>
                <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-ink sm:text-lg">
                  {result?.durationMs
                    ? `${(result.durationMs / 1000).toFixed(1)} s`
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <p className="border-t border-hairline bg-canvas-soft/60 px-5 py-3.5 text-xs leading-5 text-mute sm:px-7">
        测速请求从当前浏览器直接发往 Cloudflare edge；结果只存在本轮工具测试会话中，不保存个人历史。
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
