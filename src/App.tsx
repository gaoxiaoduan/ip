import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetectionCard } from "@/components/detection-card";
import { HeroMesh } from "@/components/hero-mesh";
import { MonoLabel } from "@/components/mono-label";
import {
  NetworkToolDesk,
  type NetworkToolView,
} from "@/components/network-tool-desk";
import { BRAND_CLASS, BrandMark, SiteHeader } from "@/components/site-header";
import { useDetectionSession } from "@/hooks/use-detection-session";
import type { NetworkToolAdapterOverrides } from "@/hooks/use-network-tools";
import { DETECTION_PATHS } from "@/lib/endpoints";
import { cn } from "@/lib/utils";

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

const GUIDE_LINKS = [
  {
    href: "/guides/ip-differences",
    label: "出口差异",
    title: "为什么不同网站会看到不同的出口 IP？",
    body: "从观测对象、可能原因和不能推出的结论开始读。",
  },
  {
    href: "/guides/ip-mismatch",
    label: "国内与海外",
    title: "国内和海外看到的 IP 不一致，该怎么理解？",
    body: "理解不一致、不可达和指定服务之间的边界。",
  },
  {
    href: "/guides/traffic-split-observation",
    label: "三条路径",
    title: "三条检测路径，观察的是什么？",
    body: "查看每类目的网络、主端点与备用规则。",
  },
  {
    href: "/methodology",
    label: "可复核方法",
    title: "检测方法与隐私边界",
    body: "核对端点、匿名度量、抓取政策和纠错渠道。",
  },
] as const;

const SECTION_TITLE_CLASS =
  "text-[clamp(30px,3.2vw,44px)] leading-[1.04] font-semibold tracking-[-0.04em]";

const SectionHeading = ({
  label,
  title,
  titleId,
  lede,
  className,
}: {
  label: string;
  title: string;
  titleId: string;
  lede: string;
  className?: string;
}) => (
  <div
    className={cn(
      "pt-4",
      className,
    )}
  >
    <div className="flex items-center gap-4">
      <MonoLabel className="tracking-[0.08em]">{label}</MonoLabel>
      <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
    </div>
    <div className="mt-5 grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] sm:items-end sm:gap-12">
      <h2 className={SECTION_TITLE_CLASS} id={titleId}>
        {title}
      </h2>
      <p className="max-w-[48ch] text-[15px] leading-6 text-body">{lede}</p>
    </div>
  </div>
);

const COMPARISON_MARK_CLASSES = {
  loading:
    "bg-link shadow-[0_0_0_7px_rgb(0_112_243/10%)] animate-status-pulse",
  same: "bg-cyan shadow-[0_0_0_7px_rgb(80_227_194/16%)]",
  different:
    "bg-violet shadow-[0_0_0_7px_rgb(121_40_202/12%),10px_0_0_-2px_var(--color-amber)]",
  insufficient: "bg-warning shadow-[0_0_0_7px_rgb(245_166_35/12%)]",
} as const;

const ComparisonMark = ({
  kind,
}: {
  kind: "loading" | "same" | "different" | "insufficient";
}) => (
  <span
    className="grid size-10 place-items-center rounded-full bg-canvas-soft-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/6%)] forced-colors:border forced-colors:border-[CanvasText] sm:size-12"
    aria-hidden="true"
  >
    <span
      className={cn("size-2.5 rounded-full", COMPARISON_MARK_CLASSES[kind])}
    />
  </span>
);

const RefreshIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20">
    <path d="M16.4 7A7 7 0 1 0 17 12" />
    <path d="M16.5 2.5V7h-4.6" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 18 18"
    className="size-4 fill-none stroke-current stroke-[1.4]"
  >
    <path d="M9 2.5v11M4.5 9l4.5 4.5L13.5 9" />
  </svg>
);

const PATH_SIGNAL_CLASSES = {
  domestic: "bg-link shadow-[0_0_0_5px_rgb(0_112_243/12%)]",
  "ordinary-overseas": "bg-cyan shadow-[0_0_0_5px_rgb(80_227_194/16%)]",
  "restricted-overseas":
    "bg-pink shadow-[0_0_0_5px_rgb(255_0_128/12%)]",
} as const;

const HeroPathList = () => (
  <aside className="w-full max-w-[430px] justify-self-end" aria-label="检测路径">
    <div className="rounded-2xl border border-[rgb(23_23_23/8%)] bg-[rgb(255_255_255/88%)] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <MonoLabel className="tracking-[0.08em] text-body">
          OBSERVATION ROUTES
        </MonoLabel>
        <span className="inline-flex items-center gap-2 font-mono text-[11px] text-body">
          <span className="size-1.5 rounded-full bg-cyan" aria-hidden="true" />
          LIVE
        </span>
      </div>

      <ul className="mt-5 divide-y divide-[rgb(23_23_23/8%)] border-y border-[rgb(23_23_23/8%)]">
        {DETECTION_PATHS.map((path) => (
          <li className="flex gap-3 py-4" key={path.id}>
            <span
              className={cn(
                "mt-1.5 size-2 flex-none rounded-full",
                PATH_SIGNAL_CLASSES[path.id],
              )}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium leading-5 text-ink">
                {path.label}
              </p>
              <p className="mt-1 text-xs leading-[18px] text-body">
                {path.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-5 text-body">
        三类请求从当前浏览器直接发出，结果只停留在本次页面会话里。
      </p>
    </div>
  </aside>
);

interface AppProps {
  readonly networkAdapters?: NetworkToolAdapterOverrides;
}

type IndependentToolView = Exclude<NetworkToolView, "all">;

const TOOL_ROUTES: Readonly<Record<string, IndependentToolView>> = {
  "/connectivity": "connectivity",
  "/webrtc": "webrtc",
  "/speed-test": "speed",
};

const currentToolRoute = (): IndependentToolView | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  return TOOL_ROUTES[pathname] ?? null;
};

const TOOL_PAGE_CONTENT: Record<
  Exclude<NetworkToolView, "all">,
  { title: string; description: string; note: string }
> = {
  connectivity: {
    title: "网络连通性",
    description:
      "用固定网站的 HTTPS favicon 资源请求，观察当前浏览器能否完成到常用国内外网站的资源加载。每个目标单独返回观测状态和耗时。",
    note: "目标清单固定维护，不接受临时网站、自定义地址或任意端口。",
  },
  webrtc: {
    title: "WebRTC 候选测试",
    description:
      "建立四个独立 STUN 连接，收集浏览器本轮提供的 ICE 候选地址。页面区分公网、私有、本地和 mDNS 证据，并保留 SDP / ICE 诊断日志。",
    note: "NAT 类型只作为参考；候选地址不被包装成泄露成功或代理配置结论。",
  },
  speed: {
    title: "网速测试",
    description:
      "通过 Cloudflare edge 直接测量下载、上传、空闲延迟和抖动。开始前会明确提示流量消耗，结果只属于本轮页面会话。",
    note: "低流量档约 15 MB，精测档约 65 MB；测速始终需要单独启动。",
  },
};

const ToolPage = ({
  networkAdapters,
  view,
}: AppProps & { view: Exclude<NetworkToolView, "all"> }) => {
  const content = TOOL_PAGE_CONTENT[view];

  return (
    <div className="min-h-screen overflow-x-clip">
      <SiteHeader brandHref="/" homeHref="/" isDetecting={false} />
      <main id="top">
        <section
          className="border-b border-hairline bg-canvas px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="tool-page-title"
        >
          <div className="mx-auto w-full max-w-[1200px]">
            <a
              className="inline-flex min-h-9 items-center rounded-full px-2 text-xs text-body underline-offset-4 hover:text-ink hover:underline"
              href="/#tools"
            >
              ← 返回网络工具台
            </a>
            <h1
              className="mt-9 max-w-[12ch] text-[clamp(44px,6vw,68px)] leading-[0.98] font-semibold tracking-[-0.04em] text-ink"
              id="tool-page-title"
            >
              {content.title}
            </h1>
            <p className="mt-7 max-w-[66ch] text-base leading-7 text-body sm:text-lg sm:leading-8">
              {content.description}
            </p>
            <p className="mt-5 font-mono text-xs leading-5 text-mute">{content.note}</p>
          </div>
        </section>
        <section className="bg-canvas-soft px-4 py-12 sm:px-6 sm:py-20">
          <div className="mx-auto w-full max-w-[1200px]">
            <NetworkToolDesk adapters={networkAdapters} view={view} />
          </div>
        </section>
      </main>
      <footer className="grid min-h-[148px] grid-cols-1 items-start gap-6 border-t border-hairline bg-canvas px-4 py-10 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:px-6 sm:py-8">
        <a className={BRAND_CLASS} href="/" aria-label="IP 出口检测首页">
          <BrandMark />
          <span>IP 出口检测</span>
        </a>
        <p className="max-w-[40ch] text-xs leading-5 text-mute">
          当前工具结果只存在本页，不保存个人检测历史。更新于 2026-07-29。
        </p>
        <a
          className="justify-self-start text-xs text-mute hover:text-ink sm:justify-self-end"
          href="#top"
        >
          回到顶部 ↑
        </a>
      </footer>
    </div>
  );
};

const HomePage = ({ networkAdapters }: AppProps) => {
  const {
    comparisonContent,
    copiedIp,
    copyIp,
    detect,
    isDetecting,
    pathStates,
  } = useDetectionSession();

  return (
    <div className="min-h-screen overflow-x-clip">
      <SiteHeader brandHref="#top" homeHref="" isDetecting={isDetecting} />

      <main id="top">
        <section
          className="isolate relative min-h-[620px] overflow-hidden border-b border-hairline bg-canvas sm:min-h-[660px]"
          aria-labelledby="hero-title"
        >
          <HeroMesh />
          <div className="relative z-10 mx-auto grid min-h-[620px] w-[min(1200px,calc(100%-32px))] items-center gap-12 py-16 sm:min-h-[660px] sm:py-20 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] lg:gap-24">
            <div className="max-w-[720px] animate-hero-enter">
              <Badge
                variant="secondary"
                className="h-7 rounded-full border-white/68 bg-[rgb(255_255_255/74%)] px-3 font-mono text-xs font-normal tracking-normal text-body shadow-[0_1px_1px_rgb(0_0_0/3%),0_2px_6px_rgb(0_0_0/4%)]"
              >
                BROWSER-DIRECT / SESSION-ONLY
              </Badge>
              <h1
                className="mt-6 max-w-[15ch] text-[clamp(48px,6.2vw,72px)] leading-[0.96] font-semibold tracking-[-0.04em] text-ink"
                id="hero-title"
              >
                一次看清，网站看到你从哪里来。
              </h1>
              <p className="mt-6 max-w-[55ch] text-base leading-7 text-[#3f3f3f] sm:text-lg sm:leading-8">
                同时比较国内网站路径、普通海外网站路径与受限海外服务路径实际观察到的公网出口。
                只描述出口差异，不替你判断网络配置。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  className="h-12 min-w-[142px] rounded-full bg-ink px-5 text-base leading-6 font-medium text-white shadow-[0_1px_1px_rgb(0_0_0/5%),0_4px_12px_rgb(0_0_0/14%)] hover:bg-black [&_svg]:size-[17px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.65] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&:disabled_svg]:animate-spin"
                  type="button"
                  onClick={() => void detect()}
                  disabled={isDetecting}
                >
                  <RefreshIcon />
                  {isDetecting ? "检测中…" : "重新检测"}
                </Button>
                <a
                  className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-body underline-offset-4 hover:text-ink hover:underline"
                  href="#results"
                >
                  查看本次结果
                  <ArrowDownIcon />
                </a>
              </div>
            </div>

            <HeroPathList />
          </div>
        </section>

        <section
          className="scroll-mt-16 bg-canvas-soft px-4 py-18 sm:px-6 sm:py-28"
          id="results"
          aria-labelledby="results-title"
        >
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading
              label="CURRENT SESSION"
              title="三条路径，一次对照。"
              titleId="results-title"
              lede="每张卡片都标明本次实际采用的数据来源和返回时间。"
              className="mb-10 sm:mb-12"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div
              className="mt-8 grid min-h-32 grid-cols-1 items-center gap-4 rounded-[16px] bg-ink px-5 py-5 text-white sm:grid-cols-[auto_1fr_auto] sm:gap-5 sm:px-7 sm:py-6"
              aria-live="polite"
            >
              <ComparisonMark kind={comparisonContent.kind} />
              <div>
                <MonoLabel className="text-hairline-strong">
                  {comparisonContent.label}
                </MonoLabel>
                <h3 className="my-1 text-xl font-semibold tracking-[-0.03em]">
                  {comparisonContent.title}
                </h3>
                <p className="max-w-[70ch] text-[13px] leading-5 text-[#c8c8c8]">
                  {comparisonContent.detail}
                </p>
              </div>
              <a
                className="inline-flex min-h-10 items-center gap-2 text-xs text-white underline-offset-4 hover:underline sm:justify-self-end"
                href="#method"
              >
                如何理解差异
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <p className="mt-4 text-center text-xs text-mute">
              本次检测会话只存在于当前页面，不形成账户历史，也不会持久保存个人检测结果。
            </p>
          </div>
        </section>

        <NetworkToolDesk adapters={networkAdapters} />

        <section
          className="bg-canvas px-4 py-18 sm:px-6 sm:py-28"
          aria-labelledby="guides-title"
        >
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading
              label="READING MAP"
              title="从一次观测，走到可核对的理解。"
              titleId="guides-title"
              lede="四个说明页只解释这项工具的观测边界：不提供网络配置诊断，也不扩展为泛 IP 查询。"
              className="mb-10 sm:mb-12"
            />
            <div className="grid grid-cols-1 border-y border-hairline sm:grid-cols-2 sm:divide-x sm:divide-hairline">
              {GUIDE_LINKS.map((guide, index) => (
                <a
                  className={cn(
                    "group flex min-h-[188px] flex-col border-b border-hairline px-1 py-6 transition-colors duration-[160ms] hover:bg-canvas-soft sm:px-7 sm:py-8",
                    index % 2 === 0 ? "sm:pr-8" : "sm:pl-8",
                    index > 1 && "sm:border-b-0",
                    index === 1 && "sm:border-b border-hairline",
                  )}
                  href={guide.href}
                  key={guide.href}
                >
                  <div className="flex items-center justify-between gap-4">
                    <MonoLabel>{guide.label}</MonoLabel>
                    <span
                      className="text-body transition-transform duration-[160ms] group-hover:translate-x-1 group-hover:text-ink"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </div>
                  <h3 className="mt-8 max-w-[21ch] text-xl font-semibold tracking-[-0.03em] group-hover:underline">
                    {guide.title}
                  </h3>
                  <p className="mt-3 max-w-[42ch] text-[13px] leading-5 text-body">
                    {guide.body}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section
          className="scroll-mt-16 bg-canvas-soft px-4 py-18 sm:px-6 sm:py-28"
          id="method"
          aria-labelledby="method-title"
        >
          <div className="mx-auto w-full max-w-[1200px]">
            <SectionHeading
              label="HOW TO READ"
              title="把观测和判断分开。"
              titleId="method-title"
              lede="不同目的网络可能触发不同的 DNS、路由或访问策略。本页展示检测端点真实收到的请求信息。"
              className="mb-10 sm:mb-12"
            />

            <div className="grid grid-cols-1 border-y border-hairline sm:grid-cols-2 lg:grid-cols-3">
              {PRINCIPLES.map((principle, index) => (
                <article
                  className={cn(
                    "border-b border-hairline py-7 sm:pr-8 sm:pb-9 lg:min-h-[250px] lg:border-b-0 lg:py-8",
                    index === 1 && "sm:border-l sm:pl-8",
                    index === 2 && "sm:col-span-full lg:col-span-1 lg:border-l lg:pl-8",
                    index === 2 && "sm:border-b-0",
                  )}
                  key={principle.label}
                >
                  <MonoLabel>{principle.label}</MonoLabel>
                  <h3 className="mt-8 mb-2 text-xl font-semibold tracking-[-0.03em]">
                    {principle.title}
                  </h3>
                  <p className="max-w-[34ch] text-[13px] leading-[21px] text-body">
                    {principle.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="relative min-h-[500px] scroll-mt-16 overflow-hidden bg-ink px-4 py-20 text-white sm:px-6 sm:py-28"
          id="privacy"
          aria-labelledby="privacy-title"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgb(255_255_255/14%)_1px,transparent_1px),linear-gradient(rgb(255_255_255/14%)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(circle_at_25%_50%,#000,transparent_60%)]"
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto grid min-h-[340px] w-full max-w-[1200px] items-end gap-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:gap-20">
            <div className="max-w-[650px]">
              <MonoLabel className="text-hairline-strong tracking-[0.08em]">
                PRIVACY BOUNDARY
              </MonoLabel>
              <h2 className={cn(SECTION_TITLE_CLASS, "mt-4")} id="privacy-title">
                出口信息不是精确位置。
              </h2>
              <p className="mt-6 max-w-[610px] text-[15px] leading-[25px] text-[#bdbdbd]">
                出口归属地来自各检测端点自己的 IP 地理数据库，可能存在差异。它不代表设备的精确物理位置，
                也不代表设备全部网络流量。
              </p>
            </div>
            <dl className="border-t border-white/16">
              <div className="flex justify-between border-b border-white/16 py-4">
                <dt className="text-xs text-hairline-strong">账户</dt>
                <dd className="font-mono text-[13px] text-white">不需要</dd>
              </div>
              <div className="flex justify-between border-b border-white/16 py-4">
                <dt className="text-xs text-hairline-strong">历史</dt>
                <dd className="font-mono text-[13px] text-white">不保存</dd>
              </div>
              <div className="flex justify-between border-b border-white/16 py-4">
                <dt className="text-xs text-hairline-strong">额外定位</dt>
                <dd className="font-mono text-[13px] text-white">不请求</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="grid min-h-[148px] grid-cols-1 items-start gap-6 border-t border-hairline bg-canvas px-4 py-10 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:px-6 sm:py-8">
        <div className={BRAND_CLASS}>
          <BrandMark />
          <span>IP 出口检测</span>
        </div>
        <p className="max-w-[40ch] text-xs leading-5 text-mute">
          一个只在当前页面比较公网出口的轻量工具。更新于 2026-07-29。
        </p>
        <a
          className="justify-self-start text-xs text-mute hover:text-ink sm:justify-self-end"
          href="#top"
        >
          回到顶部 ↑
        </a>
      </footer>
    </div>
  );
};

export default function App({ networkAdapters }: AppProps = {}) {
  const view = currentToolRoute();

  return view ? (
    <ToolPage networkAdapters={networkAdapters} view={view} />
  ) : (
    <HomePage networkAdapters={networkAdapters} />
  );
}
