import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetectionCard } from "@/components/detection-card";
import { HeroMesh } from "@/components/hero-mesh";
import { SiteHeader } from "@/components/site-header";
import { useDetectionSession } from "@/hooks/use-detection-session";
import { DETECTION_PATHS } from "@/lib/endpoints";

const PRINCIPLES = [
  {
    label: "浏览器直连",
    title: "出口结果来自检测端点。",
    body: "每条请求都从当前浏览器直接发往对应检测端点，本站不会代替你转发请求。",
  },
  {
    label: "检测会话",
    title: "检测停留在这一页。",
    body: "刷新或关闭页面后结果即消失；项目不建立账户，也不保存个人检测历史。",
  },
  {
    label: "如实呈现",
    title: "出口差异不是诊断结论。",
    body: "页面只比较各检测端点看到的出口结果，不据此判断代理配置正常、异常或是否生效。",
  },
] as const;

const ComparisonMark = ({
  kind,
}: {
  kind: "loading" | "same" | "different" | "insufficient";
}) => (
  <span className={`comparison-mark comparison-mark--${kind}`} aria-hidden="true">
    <span />
  </span>
);

const RefreshIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20">
    <path d="M16.4 7A7 7 0 1 0 17 12" />
    <path d="M16.5 2.5V7h-4.6" />
  </svg>
);

export default function App() {
  const {
    comparisonContent,
    copiedIp,
    copyIp,
    detect,
    isDetecting,
    pathStates,
  } = useDetectionSession();

  return (
    <div className="app-shell">
      <SiteHeader isDetecting={isDetecting} />

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <HeroMesh />
          <div className="hero-content">
            <Badge variant="secondary" className="hero-badge">
              BROWSER-DIRECT / SESSION-ONLY
            </Badge>
            <h1 id="hero-title">一次看清，网站看到你从哪里来。</h1>
            <p>
              同时比较国内网站路径、普通海外网站路径与受限海外服务路径实际观察到的公网出口。
              只描述出口差异，不替你判断网络配置。
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

          <div className="path-rail" aria-label="本次检测包含三类检测路径">
            {DETECTION_PATHS.map((path) => (
              <div className="path-rail__item" key={path.id}>
                <span className={`path-node path-node--${path.id}`} />
                <span>{path.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="results-section"
          id="results"
          aria-labelledby="results-title"
        >
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
            本次检测会话只存在于当前页面，不形成账户历史，也不会持久保存个人检测结果。
          </p>
        </section>

        <section
          className="method-section"
          id="method"
          aria-labelledby="method-title"
        >
          <div className="section-heading section-heading--method">
            <div>
              <span className="mono-label">HOW TO READ</span>
              <h2 id="method-title">把观测和判断分开。</h2>
            </div>
            <p>
              不同目的网络可能触发不同的 DNS、路由或访问策略。本页展示检测端点真实收到的请求信息。
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

        <section
          className="privacy-section"
          id="privacy"
          aria-labelledby="privacy-title"
        >
          <div className="privacy-grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="privacy-copy">
            <span className="mono-label">PRIVACY BOUNDARY</span>
            <h2 id="privacy-title">出口信息不是精确位置。</h2>
            <p>
              出口归属地来自各检测端点自己的 IP 地理数据库，可能存在差异。它不代表设备的精确物理位置，
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
