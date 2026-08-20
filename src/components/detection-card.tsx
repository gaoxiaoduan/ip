import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/mono-label";
import type { PathState } from "@/hooks/use-detection-session";
import type { DetectionPathId, SuccessfulDetection } from "@/lib/detection";
import { DETECTION_PATHS } from "@/lib/endpoints";

const PATH_MARKS: Record<DetectionPathId, string> = {
  domestic: "PATH.DOMESTIC_WEBSITE",
  "ordinary-overseas": "PATH.ORDINARY_OVERSEAS_WEBSITE",
  "restricted-overseas": "PATH.RESTRICTED_OVERSEAS_SERVICE",
};

const countryNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["zh-CN"], { type: "region" })
    : null;

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const displayCountry = (country: string, countryCode?: string) => {
  const code =
    countryCode?.trim().toUpperCase() ??
    (/^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined);

  return (code ? countryNames?.of(code) : undefined) ?? country;
};

const locationText = (result: SuccessfulDetection) => {
  const country = displayCountry(
    result.observation.country,
    result.observation.countryCode,
  );
  const parts = [
    country,
    result.observation.region,
    result.observation.city,
  ].filter(
    (part, index, values): part is string =>
      Boolean(part) && values.indexOf(part) === index,
  );

  return parts.join(" · ");
};

const SKELETON_CLASS =
  "block h-3.5 animate-skeleton rounded-sm bg-[linear-gradient(90deg,var(--color-canvas-soft-2)_0%,#ececec_48%,var(--color-canvas-soft-2)_100%)] bg-[size:220%_100%]";

const FALLBACK_NOTE_CLASS =
  "mt-3 rounded-md bg-[#fff8e8] px-3 py-2 text-[11px] leading-[17px] text-[#6b4a0b]";

const CopyIcon = () => (
  <svg
    className="size-3.5 fill-none stroke-current stroke-[1.4]"
    aria-hidden="true"
    viewBox="0 0 20 20"
  >
    <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" />
    <path d="M4 13.5H3.5A1.5 1.5 0 0 1 2 12V3.5A1.5 1.5 0 0 1 3.5 2H12a1.5 1.5 0 0 1 1.5 1.5V4" />
  </svg>
);

const ArrowIcon = () => (
  <svg
    className="size-3 fill-none stroke-current stroke-[1.3]"
    aria-hidden="true"
    viewBox="0 0 16 16"
  >
    <path d="M3 13 13 3M6 3h7v7" />
  </svg>
);

interface DetectionCardProps {
  path: (typeof DETECTION_PATHS)[number];
  state: PathState;
  copiedIp: string | null;
  onCopy: (ip: string) => Promise<void>;
}

const STATE_LABELS: Record<PathState["status"], string> = {
  idle: "等待",
  loading: "检测中",
  success: "已返回",
  unreachable: "不可达",
};

const STATE_DOT_CLASSES: Record<PathState["status"], string> = {
  idle: "before:bg-hairline-strong",
  loading: "before:animate-status-pulse before:bg-link",
  success: "before:bg-cyan",
  unreachable: "before:bg-warning",
};

const PATH_SIGNAL_CLASSES: Record<DetectionPathId, string> = {
  domestic: "bg-link",
  "ordinary-overseas": "bg-cyan",
  "restricted-overseas": "bg-pink",
};

type DetectionStateBodyProps = Pick<
  DetectionCardProps,
  "state" | "copiedIp" | "onCopy"
>;

const DetectionStateBody = ({
  state,
  copiedIp,
  onCopy,
}: DetectionStateBodyProps) => {
  switch (state.status) {
    case "idle":
    case "loading":
      return (
        <div className="flex flex-col gap-3 py-3 sm:py-4" aria-live="polite">
          <span className="sr-only">
            {state.status === "loading" ? "正在检测" : "等待检测"}
          </span>
          <span
            className={cn(SKELETON_CLASS, "h-[32px] w-[72%]")}
            aria-hidden="true"
          />
          <span className={cn(SKELETON_CLASS, "w-[54%]")} aria-hidden="true" />
          <span className={cn(SKELETON_CLASS, "w-[38%]")} aria-hidden="true" />
        </div>
      );

    case "success":
      return (
        <>
          <div className="border-t border-hairline pt-3.5 pb-4 sm:pt-4 sm:pb-5">
            <MonoLabel>公网出口</MonoLabel>
            <div className="mt-2 flex items-center justify-between gap-3">
              <code className="min-w-0 overflow-hidden break-all font-mono text-[clamp(20px,2.2vw,28px)] font-semibold leading-8 tracking-[-0.03em] text-ellipsis text-ink">
                {state.observation.ip}
              </code>
              <button
                className="inline-flex min-h-9 min-w-[58px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-hairline bg-canvas px-2 text-xs text-body transition-colors hover:bg-canvas-soft hover:text-ink active:bg-canvas-soft-2 focus-visible:outline-2 focus-visible:outline-ink"
                type="button"
                onClick={() => void onCopy(state.observation.ip)}
                aria-label={`复制 ${state.observation.ip}`}
              >
                <CopyIcon />
                <span>
                  {copiedIp === state.observation.ip ? "已复制" : "复制"}
                </span>
              </button>
            </div>
            <p className="mt-2 text-sm leading-[21px] text-ink">
              {locationText(state)}
            </p>
            {state.observation.organization ? (
              <p className="mt-1 text-xs leading-[18px] text-mute">
                {state.observation.network
                  ? `${state.observation.network} · `
                  : ""}
                {state.observation.organization}
              </p>
            ) : null}

            {state.endpoint.redundancy === "compatible-fallback" ? (
              <p className={FALLBACK_NOTE_CLASS}>
                本次使用同一服务的兼容接口，不构成独立冗余。
              </p>
            ) : null}

            {state.endpoint.redundancy === "independent-fallback" ? (
              <p className={FALLBACK_NOTE_CLASS}>
                主检测端点未返回有效结果，已使用独立备用检测端点。
              </p>
            ) : null}
          </div>

          <footer className="mt-auto flex items-end justify-between border-t border-hairline pt-3.5 sm:pt-4">
            <div className="flex flex-col gap-1">
              <MonoLabel>数据来源</MonoLabel>
              <a
                className="inline-flex items-center gap-1 text-xs text-link underline-offset-[3px] hover:underline"
                href={state.endpoint.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {state.endpoint.source.label}
                <ArrowIcon />
              </a>
            </div>
            <div className="flex flex-col items-end gap-1 font-mono text-[10px] text-mute">
              <span>{state.latencyMs} ms</span>
              <time dateTime={state.observedAt}>
                {timeFormatter.format(new Date(state.observedAt))}
              </time>
            </div>
          </footer>

        </>
      );

    case "unreachable":
      return (
        <div className="mt-1 grid grid-cols-[40px_1fr] gap-4 border-t border-hairline py-4 sm:py-5">
          <span
            className="grid size-10 place-items-center rounded-full bg-warning-soft font-mono text-[#8a5500] forced-colors:border forced-colors:border-[CanvasText]"
            aria-hidden="true"
          >
            !
          </span>
          <div>
            <h4 className="mb-2 text-sm font-semibold">本次检测不可达</h4>
            <p className="text-xs leading-[19px] text-body">
              已尝试 {state.attempts.length} 个检测端点，均未及时返回有效结果。
              这不证明该路径不存在公网出口。
            </p>
          </div>
        </div>
      );
  }
};

export function DetectionCard({
  path,
  state,
  copiedIp,
  onCopy,
}: DetectionCardProps) {
  const titleId = `${path.id}-title`;

  return (
    <article
      className="flex min-h-[360px] flex-col rounded-[14px] border border-hairline bg-canvas p-4 sm:min-h-[420px] sm:p-6"
      aria-labelledby={titleId}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn("size-2 rounded-full", PATH_SIGNAL_CLASSES[path.id])}
              aria-hidden="true"
            />
            <MonoLabel>{PATH_MARKS[path.id]}</MonoLabel>
          </div>
          <h3
            className="mt-2 text-xl font-semibold tracking-[-0.03em]"
            id={titleId}
          >
            {path.label}
          </h3>
        </div>
        <span
          className={cn(
            "inline-flex flex-none items-center gap-2 font-mono text-[11px] leading-5 text-body before:size-1.5 before:rounded-full before:content-['']",
            STATE_DOT_CLASSES[state.status],
          )}
        >
          {STATE_LABELS[state.status]}
        </span>
      </header>

      <p className="mt-2.5 mb-4 min-h-[40px] max-w-[38ch] text-[13px] leading-5 text-body sm:mt-3 sm:mb-5">
        {path.description}
      </p>
      <DetectionStateBody
        state={state}
        copiedIp={copiedIp}
        onCopy={onCopy}
      />
    </article>
  );
}
