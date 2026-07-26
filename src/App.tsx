import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  compareOutletObservations,
  runDetectionPath,
  type DetectionPathId,
  type DetectionResult,
  type SuccessfulDetection,
} from "@/lib/detection";
import { DETECTION_PATHS } from "@/lib/endpoints";

type PendingState = {
  status: "idle" | "loading";
};

type PathState = PendingState | DetectionResult;

type PathStateMap = Record<DetectionPathId, PathState>;

const PATH_MARKS: Record<
  DetectionPathId,
  {
    mono: string;
    shortLabel: string;
  }
> = {
  domestic: {
    mono: "PATH.DOMESTIC",
    shortLabel: "国内",
  },
  "ordinary-overseas": {
    mono: "PATH.GLOBAL",
    shortLabel: "海外",
  },
  "restricted-overseas": {
    mono: "PATH.RESTRICTED",
    shortLabel: "受限服务",
  },
};

const PRINCIPLES = [
  {
    label: "浏览器直连",
    title: "结果来自目的端点。",
    body: "每条请求都从当前浏览器直接发往对应检测端点，本站不会代替你转发请求。",
  },
  {
    label: "一次会话",
    title: "检测停留在这一页。",
    body: "刷新或关闭页面后结果即消失；项目不建立账户，也不保存个人检测历史。",
  },
  {
    label: "如实呈现",
    title: "差异不是诊断结论。",
    body: "页面只比较各端点看到的出口，不据此判断代理配置正常、异常或是否生效。",
  },
] as const;

const createPathStates = (status: PendingState["status"]): PathStateMap => ({
  domestic: { status },
  "ordinary-overseas": { status },
  "restricted-overseas": { status },
});

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

const ComparisonMark = ({
  kind,
}: {
  kind: "loading" | "same" | "different" | "insufficient";
}) => (
  <span className={`comparison-mark comparison-mark--${kind}`} aria-hidden="true">
    <span />
  </span>
);

const CopyIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20">
    <rect x="6.5" y="6.5" width="9" height="9" rx="1.5" />
    <path d="M4 13.5H3.5A1.5 1.5 0 0 1 2 12V3.5A1.5 1.5 0 0 1 3.5 2H12a1.5 1.5 0 0 1 1.5 1.5V4" />
  </svg>
);

const RefreshIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20">
    <path d="M16.4 7A7 7 0 1 0 17 12" />
    <path d="M16.5 2.5V7h-4.6" />
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

const DetectionCard = ({
  path,
  state,
  copiedIp,
  onCopy,
}: DetectionCardProps) => {
  const titleId = `${path.id}-title`;
  const mark = PATH_MARKS[path.id];

  return (
    <article className="result-card" aria-labelledby={titleId}>
      <header className="result-card__header">
        <div>
          <span className="mono-label">{mark.mono}</span>
          <h3 id={titleId}>{path.label}</h3>
        </div>
        <span className={`state-dot state-dot--${state.status}`}>
          {state.status === "success"
            ? "已返回"
            : state.status === "unreachable"
              ? "不可达"
              : state.status === "loading"
                ? "检测中"
                : "等待"}
        </span>
      </header>

      <p className="result-card__description">{path.description}</p>

      {state.status === "loading" || state.status === "idle" ? (
        <div className="result-card__loading" aria-live="polite">
          <span className="sr-only">
            {state.status === "loading" ? "正在检测" : "等待检测"}
          </span>
          <span className="skeleton skeleton--ip" aria-hidden="true" />
          <span className="skeleton skeleton--location" aria-hidden="true" />
          <span className="skeleton skeleton--meta" aria-hidden="true" />
        </div>
      ) : null}

      {state.status === "success" ? (
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
            <p className="fallback-note">主检测端点未返回有效结果，已使用独立备用端点。</p>
          ) : null}
        </>
      ) : null}

      {state.status === "unreachable" ? (
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
      ) : null}
    </article>
  );
};

export default function App() {
  const [pathStates, setPathStates] = useState<PathStateMap>(() =>
    createPathStates("idle"),
  );
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const sessionRef = useRef(0);
  const mountedRef = useRef(false);
  const autoDetectionStartedRef = useRef(false);

  const detect = useCallback(async () => {
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setCopiedIp(null);
    setPathStates(createPathStates("loading"));

    await Promise.all(
      DETECTION_PATHS.map(async (path) => {
        const result = await runDetectionPath(path);

        if (!mountedRef.current || sessionRef.current !== session) {
          return;
        }

        setPathStates((current) => ({
          ...current,
          [path.id]: result,
        }));
      }),
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!autoDetectionStartedRef.current) {
      autoDetectionStartedRef.current = true;
      void detect();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [detect]);

  const successfulResults = useMemo(
    () =>
      Object.values(pathStates).filter(
        (state): state is SuccessfulDetection => state.status === "success",
      ),
    [pathStates],
  );
  const comparison = compareOutletObservations(
    successfulResults.map((result) => result.observation),
  );
  const isDetecting = Object.values(pathStates).some(
    (state) => state.status === "loading",
  );
  const unreachableCount = Object.values(pathStates).filter(
    (state) => state.status === "unreachable",
  ).length;

  const comparisonContent = isDetecting
    ? {
        kind: "loading" as const,
        label: "正在检测",
        title: "正在等待各路径返回",
        detail: "三条检测路径并行进行；同类路径只会在主端点失败后尝试备用端点。",
      }
    : comparison.kind === "different"
      ? {
          kind: "different" as const,
          label: "出口差异",
          title: "观察到出口差异",
          detail: `${comparison.successfulPathCount} 条成功路径返回了不同的公网 IP。这只是本次访问路径的观测事实。`,
        }
      : comparison.kind === "same"
        ? {
            kind: "same" as const,
            label: "结果一致",
            title: "成功路径观察到相同出口",
            detail: `${comparison.successfulPathCount} 条成功路径返回了相同的公网 IP；归属地文字仍可能因端点数据库而略有不同。`,
          }
        : {
            kind: "insufficient" as const,
            label: "数据不足",
            title: "暂时无法比较出口",
            detail:
              unreachableCount > 0
                ? `仅 ${comparison.successfulPathCount} 条路径成功，另有 ${unreachableCount} 条路径不可达。`
                : "至少需要两条成功路径，才能比较是否存在出口差异。",
          };

  const copyIp = useCallback(async (ip: string) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedIp(ip);
    } catch {
      setCopiedIp(null);
    }
  }, []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="IP 出口检测首页">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>IP 出口检测</span>
        </a>
        <nav aria-label="页面导航">
          <a href="#results">检测结果</a>
          <a href="#method">检测说明</a>
          <a href="#privacy">隐私边界</a>
        </nav>
        <a className="header-status" href="#results">
          <span className={isDetecting ? "is-running" : ""} />
          {isDetecting ? "检测进行中" : "查看本次结果"}
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-mesh" aria-hidden="true" />
          <div className="hero-content">
            <Badge variant="secondary" className="hero-badge">
              BROWSER-DIRECT / SESSION-ONLY
            </Badge>
            <h1 id="hero-title">一次看清，网站看到你从哪里来。</h1>
            <p>
              同时比较国内网站、普通海外网站与受限海外服务三类访问路径实际观察到的公网出口。
              只描述差异，不替你判断网络配置。
            </p>
            <Button
              size="lg"
              className="detect-button"
              type="button"
              onClick={() => void detect()}
              disabled={isDetecting}
            >
              <RefreshIcon />
              {isDetecting ? "检测中…" : "重新检测"}
            </Button>
          </div>

          <div className="path-rail" aria-label="本次检测包含三类访问路径">
            {DETECTION_PATHS.map((path) => (
              <div className="path-rail__item" key={path.id}>
                <span className={`path-node path-node--${path.id}`} />
                <span>{PATH_MARKS[path.id].shortLabel}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="results-section" id="results" aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <span className="mono-label">CURRENT SESSION</span>
              <h2 id="results-title">三条路径，一次对照。</h2>
            </div>
            <p>每张卡片都标明本次实际采用的数据来源和返回时间。</p>
          </div>

          <div className="comparison-banner" aria-live="polite">
            <ComparisonMark kind={comparisonContent.kind} />
            <div>
              <span className="mono-label">{comparisonContent.label}</span>
              <h3>{comparisonContent.title}</h3>
              <p>{comparisonContent.detail}</p>
            </div>
          </div>

          <div className="results-grid">
            {DETECTION_PATHS.map((path) => (
              <DetectionCard
                key={path.id}
                path={path}
                state={pathStates[path.id]}
                copiedIp={copiedIp}
                onCopy={copyIp}
              />
            ))}
          </div>
          <p className="session-note">
            本次检测结果只存在于当前页面，不形成账户历史，也不会持久保存。
          </p>
        </section>

        <section className="method-section" id="method" aria-labelledby="method-title">
          <div className="section-heading section-heading--method">
            <div>
              <span className="mono-label">HOW TO READ</span>
              <h2 id="method-title">把观测和判断分开。</h2>
            </div>
            <p>
              不同目的网络可能触发不同的 DNS、路由或访问策略。本页展示目的端点真实收到的请求信息。
            </p>
          </div>

          <div className="principle-grid">
            {PRINCIPLES.map((principle) => (
              <article key={principle.label}>
                <span className="principle-label">{principle.label}</span>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="privacy-section" id="privacy" aria-labelledby="privacy-title">
          <div className="privacy-grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="privacy-copy">
            <span className="mono-label">PRIVACY BOUNDARY</span>
            <h2 id="privacy-title">出口信息不是精确位置。</h2>
            <p>
              归属地来自各检测端点自己的 IP 地理数据库，可能存在差异。它不代表设备的精确物理位置，
              也不代表设备全部网络流量。
            </p>
          </div>
          <dl>
            <div>
              <dt>账户</dt>
              <dd>不需要</dd>
            </div>
            <div>
              <dt>历史</dt>
              <dd>不保存</dd>
            </div>
            <div>
              <dt>额外定位</dt>
              <dd>不请求</dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="site-footer">
        <div className="brand brand--footer">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>IP 出口检测</span>
        </div>
        <p>一个只在当前页面比较公网出口的轻量工具。</p>
        <a href="#top">回到顶部 ↑</a>
      </footer>
    </div>
  );
}
