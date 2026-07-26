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

const CopyIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20">
    <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" />
    <path d="M4 13.5H3.5A1.5 1.5 0 0 1 2 12V3.5A1.5 1.5 0 0 1 3.5 2H12a1.5 1.5 0 0 1 1.5 1.5V4" />
  </svg>
);

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16">
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
        <div className="result-card__loading" aria-live="polite">
          <span className="sr-only">
            {state.status === "loading" ? "正在检测" : "等待检测"}
          </span>
          <span className="skeleton skeleton--ip" aria-hidden="true" />
          <span className="skeleton skeleton--location" aria-hidden="true" />
          <span className="skeleton skeleton--meta" aria-hidden="true" />
        </div>
      );

    case "success":
      return (
        <>
          <div className="result-card__observation">
            <span className="field-label">公网出口</span>
            <div className="ip-row">
              <code>{state.observation.ip}</code>
              <button
                className="copy-button"
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
            <p className="location-line">{locationText(state)}</p>
            {state.observation.organization ? (
              <p className="network-line">
                {state.observation.network
                  ? `${state.observation.network} · `
                  : ""}
                {state.observation.organization}
              </p>
            ) : null}
          </div>

          <footer className="result-card__footer">
            <div>
              <span className="field-label">数据来源</span>
              <a
                href={state.endpoint.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {state.endpoint.source.label}
                <ArrowIcon />
              </a>
            </div>
            <div className="result-card__timing">
              <span>{state.latencyMs} ms</span>
              <time dateTime={state.observedAt}>
                {timeFormatter.format(new Date(state.observedAt))}
              </time>
            </div>
          </footer>

          {state.endpoint.redundancy === "compatible-fallback" ? (
            <p className="fallback-note">
              本次使用同一服务的兼容接口，不构成独立冗余。
            </p>
          ) : null}

          {state.endpoint.redundancy === "independent-fallback" ? (
            <p className="fallback-note">
              主检测端点未返回有效结果，已使用独立备用检测端点。
            </p>
          ) : null}
        </>
      );

    case "unreachable":
      return (
        <div className="unreachable-state">
          <span className="unreachable-state__glyph" aria-hidden="true">
            !
          </span>
          <div>
            <h4>本次检测不可达</h4>
            <p>
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
    <article className="result-card" aria-labelledby={titleId}>
      <header className="result-card__header">
        <div>
          <span className="mono-label">{PATH_MARKS[path.id]}</span>
          <h3 id={titleId}>{path.label}</h3>
        </div>
        <span className={`state-dot state-dot--${state.status}`}>
          {STATE_LABELS[state.status]}
        </span>
      </header>

      <p className="result-card__description">{path.description}</p>
      <DetectionStateBody
        state={state}
        copiedIp={copiedIp}
        onCopy={onCopy}
      />
    </article>
  );
}
