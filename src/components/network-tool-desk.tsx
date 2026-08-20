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
  undetermined: "无法判断",
};

const OBSERVATION_LABELS: Record<ToolObservationStatus, string> = {
  observed: "已观察",
  unobserved: "未观察",
  undetermined: "无法判断",
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
        HTTPS favicon 资源请求
        {observation?.reason === "load-error" ? " · 资源未加载" : ""}
        {observation?.reason === "timeout" ? " · 超时" : ""}
        {observation?.reason === "cancelled" ? " · 已停止" : ""}
        {observation?.reason === "unsupported" ? " · 浏览器能力不可用" : ""}
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
          {CONNECTIVITY_TARGETS.filter((target) => target.group === group).length} 个目标
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
        description="固定观察八个常用网站的 HTTPS favicon 资源请求。结果只描述本次浏览器是否观察到资源加载及其耗时，不把失败解释成 DNS、TCP、TLS 或代理配置原因。"
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
      <div className="flex flex-col gap-2 border-t border-hairline bg-canvas-soft px-5 py-4 text-xs leading-5 text-body sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p aria-live="polite">
          {connectivity.status === "idle"
            ? "目标清单固定维护，不提供临时网站或自定义地址。"
            : `${judgedCount} / ${CONNECTIVITY_TARGETS.length} 个目标已返回观测；已观察 ${observedCount} 个。`}
        </p>
        <p className="font-mono text-xs text-mute">BROWSER → FAVICON / NO PROXY</p>
      </div>
    </section>
  );
};

const serverStatus = (
  result: WebRtcServerResult | undefined,
): ToolObservationStatus | null => result?.status ?? null;

const WebRtcServerRow = ({
  result,
  running,
  server,
}: {
  readonly result?: WebRtcServerResult;
  readonly running: boolean;
  readonly server: (typeof WEBRTC_SERVERS)[number];
}) => {
  const status = serverStatus(result);
  return (
    <li className="grid grid-cols-1 gap-3 border-b border-hairline py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
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
          <span className="text-sm font-medium text-ink">{server.label}</span>
          {status ? (
            <ObservationStatus status={status} />
          ) : (
            <span className="text-xs text-mute">{running ? "检测中" : "等待"}</span>
          )}
        </div>
        <code className="mt-1 block truncate font-mono text-xs text-mute">
          {server.url}
        </code>
      </div>
      <span className="font-mono text-xs tabular-nums text-body">
        {result?.latencyMs === null || result?.latencyMs === undefined
          ? "—"
          : `${result.latencyMs} ms`}
      </span>
      <span className="font-mono text-xs tabular-nums text-mute">
        {result ? `${result.candidates.length} 候选` : "尚未收集"}
      </span>
    </li>
  );
};

const CandidateTable = ({
  candidates,
}: {
  readonly candidates: ReturnType<typeof useNetworkTools>["webrtc"]["candidates"];
}) => {
  if (candidates.length === 0) {
    return (
      <div className="border-t border-hairline py-7 text-sm text-body">
        尚未观察到候选地址。开始测试后，浏览器会在这里呈现本轮收集到的证据。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-t border-hairline">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <caption className="sr-only">WebRTC 候选地址证据</caption>
        <thead>
          <tr className="border-b border-hairline text-xs text-mute">
            <th className="py-3 pr-4 font-normal">地址</th>
            <th className="px-4 py-3 font-normal">地址族</th>
            <th className="px-4 py-3 font-normal">范围</th>
            <th className="px-4 py-3 font-normal">候选类型</th>
            <th className="py-3 pl-4 font-normal">来源</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr className="border-b border-hairline last:border-b-0" key={`${candidate.address}-${candidate.type}`}>
              <td className="py-3 pr-4 font-mono text-[12px] text-ink">{candidate.address}</td>
              <td className="px-4 py-3 text-xs text-body">{candidate.addressFamily}</td>
              <td className="px-4 py-3 text-xs text-body">{candidate.scope}</td>
              <td className="px-4 py-3 font-mono text-xs text-body">{candidate.type}</td>
              <td className="py-3 pl-4 font-mono text-xs text-mute">{candidate.serverIds.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Diagnostics = ({ result }: { result: WebRtcServerResult }) => (
  <details className="group border-t border-hairline py-4">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xs text-body outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden">
      <span>SDP / ICE 诊断日志 · {result.server.label}</span>
      <span className="transition-transform duration-200 group-open:rotate-180">
        <ChevronIcon />
      </span>
    </summary>
    <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-ink p-4 font-mono text-xs leading-5 text-canvas-soft-2">
      {result.logs.join("\n") || "本轮没有诊断日志。"}
    </pre>
  </details>
);

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
  const summary = running
    ? "正在收集 ICE 候选"
    : webrtc.status === "idle"
      ? "尚未开始"
      : webrtc.candidates.length > 0
        ? "观察到候选地址"
        : webrtc.status === "stopped"
          ? "本轮已停止"
          : "无法判断";

  return (
    <section
      className="overflow-hidden border-y border-hairline bg-canvas"
      id="webrtc-tool"
      aria-labelledby="webrtc-title"
    >
      <ToolHeader
        description="四个 STUN 服务各自建立一个 WebRTC 数据通道，展示浏览器本轮提供的候选地址、地址族、范围与候选类型。NAT 只作为参考信息，不输出泄露成功或代理失效结论。"
        href="/webrtc"
        onStart={onStart}
        onStop={onStop}
        running={running}
        startLabel={webrtc.status === "idle" ? "开始收集" : "重新收集"}
        stopLabel="停止"
        status={webrtc.status}
        title="WebRTC 候选测试"
        titleId="webrtc-title"
      />
      <div className="grid grid-cols-1 gap-8 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-12">
        <div>
          <div className="flex items-end justify-between gap-4 border-b border-hairline pb-3">
            <h4 className="text-sm font-semibold text-ink">STUN 服务</h4>
            <span className="font-mono text-xs text-mute">4 独立连接</span>
          </div>
          <ul aria-live="polite">
            {WEBRTC_SERVERS.map((server) => (
              <WebRtcServerRow
                key={server.id}
                result={resultsById.get(server.id)}
                running={running}
                server={server}
              />
            ))}
          </ul>
          <div className="mt-5 rounded-md bg-canvas-soft-2 px-4 py-3 text-xs leading-5 text-body">
            {webrtc.natReference ?? "NAT 参考：完成收集后根据候选类型显示。"}
          </div>
        </div>
        <div aria-live="polite">
          <div className="flex items-end justify-between gap-4 border-b border-hairline pb-3">
            <div>
              <h4 className="text-sm font-semibold text-ink">候选地址证据</h4>
              <p className="mt-1 text-xs text-body">{summary}</p>
            </div>
            <span className="font-mono text-xs text-mute">
              {webrtc.candidates.length} 条去重
            </span>
          </div>
          <CandidateTable candidates={webrtc.candidates} />
        </div>
      </div>
      {webrtc.servers.length > 0 ? (
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          {webrtc.servers.map((result) => (
            <Diagnostics key={result.server.id} result={result} />
          ))}
        </div>
      ) : null}
      <p className="border-t border-hairline bg-canvas-soft px-5 py-4 text-xs leading-5 text-body sm:px-7">
        候选地址只说明本轮浏览器与 STUN 服务提供了哪些连接证据；它不等同于安全、泄露或网络配置结论。
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
