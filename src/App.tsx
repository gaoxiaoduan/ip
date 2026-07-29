import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetectionCard } from "@/components/detection-card";
import { HeroMesh } from "@/components/hero-mesh";
import { MonoLabel } from "@/components/mono-label";
import { BRAND_CLASS, BrandMark, SiteHeader } from "@/components/site-header";
import { useDetectionSession } from "@/hooks/use-detection-session";
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
  "mt-2 text-[32px] leading-10 font-semibold tracking-[-1.28px]";

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
      "mb-8 grid grid-cols-1 items-start gap-4 sm:mb-10 sm:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] sm:items-end sm:gap-12",
      className,
    )}
  >
    <div>
      <MonoLabel>{label}</MonoLabel>
      <h2 className={SECTION_TITLE_CLASS} id={titleId}>
        {title}
      </h2>
    </div>
    <p className="text-[15px] leading-6 text-body">{lede}</p>
  </div>
);

const PRINCIPLE_ARTICLE_CLASSES = [
  "",
  "border-t border-hairline sm:border-t-0 sm:border-l sm:pl-8",
  "border-t border-hairline sm:col-span-full lg:col-span-1 lg:border-t-0 lg:border-l lg:pl-8",
] as const;

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
    <div className="min-h-screen overflow-x-clip">
      <SiteHeader isDetecting={isDetecting} />

      <main id="top">
        <section
          className="isolate relative flex min-h-[630px] flex-col border-b border-hairline bg-canvas sm:min-h-[680px]"
          aria-labelledby="hero-title"
        >
          <HeroMesh />
          <div className="mx-auto flex w-[min(860px,calc(100%-32px))] flex-1 animate-hero-enter flex-col items-center pt-24 pb-18 text-center sm:pt-29 sm:pb-19">
            <Badge
              variant="secondary"
              className="h-7 rounded-full border-white/68 bg-white/68 px-3 font-mono text-xs font-normal tracking-normal text-body shadow-[0_1px_1px_rgb(0_0_0/3%),0_2px_6px_rgb(0_0_0/4%)] backdrop-blur-[12px]"
            >
              BROWSER-DIRECT / SESSION-ONLY
            </Badge>
            <h1
              className="mt-6 mb-5 max-w-[760px] text-[48px] leading-[48px] font-semibold tracking-[-2.4px] text-ink"
              id="hero-title"
            >
              一次看清，网站看到你从哪里来。
            </h1>
            <p className="max-w-[510px] text-base leading-[25px] text-[#3f3f3f] sm:max-w-[660px] sm:text-lg sm:leading-7">
              同时比较国内网站路径、普通海外网站路径与受限海外服务路径实际观察到的公网出口。
              只描述出口差异，不替你判断网络配置。
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 min-w-[142px] rounded-full bg-ink px-5 text-base leading-6 font-medium text-white shadow-[0_1px_1px_rgb(0_0_0/5%),0_4px_12px_rgb(0_0_0/14%)] hover:bg-black [&_svg]:size-[17px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.65] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&:disabled_svg]:animate-spin"
              type="button"
              onClick={() => void detect()}
              disabled={isDetecting}
            >
              <RefreshIcon />
              {isDetecting ? "检测中…" : "重新检测"}
            </Button>
          </div>

          <div
            className="mx-auto mb-9 grid w-[calc(100%-32px)] grid-cols-3 border-t border-[rgb(23_23_23/16%)] sm:w-[min(1120px,calc(100%-48px))]"
            aria-label="本次检测包含三类检测路径"
          >
            {DETECTION_PATHS.map((path) => (
              <div
                className="relative flex justify-center px-1 pt-4 text-center font-mono text-[9px] leading-[14px] text-body sm:px-0 sm:text-xs sm:leading-normal"
                key={path.id}
              >
                <span className="absolute -top-[5px] left-1/2 size-[9px] -translate-x-1/2 rounded-full border-2 border-canvas bg-ink shadow-[0_0_0_1px_rgb(23_23_23/22%)]" />
                <span>{path.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mx-auto w-[calc(100%-32px)] border-t border-hairline py-18 sm:w-[min(1200px,calc(100%-48px))] sm:py-24"
          aria-labelledby="guides-title"
        >
          <SectionHeading
            label="READING MAP"
            title="从一次观测，走到可核对的理解。"
            titleId="guides-title"
            lede="四个说明页只解释这项工具的观测边界：不提供网络配置诊断，也不扩展为泛 IP 查询。"
          />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
            {GUIDE_LINKS.map((guide) => (
              <a
                className="group min-h-48 bg-canvas p-6 transition-colors duration-[160ms] hover:bg-canvas-soft sm:p-8"
                href={guide.href}
                key={guide.href}
              >
                <span className="font-mono text-[11px] text-body">
                  {guide.label}
                </span>
                <h3 className="mt-8 max-w-[19ch] text-xl font-semibold tracking-[-0.6px] group-hover:underline">
                  {guide.title}
                </h3>
                <p className="mt-3 max-w-[36ch] text-[13px] leading-5 text-body">
                  {guide.body}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section
          className="mx-auto w-[calc(100%-32px)] scroll-mt-16 py-18 sm:w-[min(1200px,calc(100%-48px))] sm:py-24"
          id="results"
          aria-labelledby="results-title"
        >
          <SectionHeading
            label="CURRENT SESSION"
            title="三条路径，一次对照。"
            titleId="results-title"
            lede="每张卡片都标明本次实际采用的数据来源和返回时间。"
          />

          <div
            className="mb-5 grid min-h-28 grid-cols-1 items-center gap-4 rounded-xl border border-hairline bg-canvas p-6 shadow-[0_1px_1px_rgb(0_0_0/2%),0_2px_2px_rgb(0_0_0/3%)] sm:grid-cols-[auto_1fr]"
            aria-live="polite"
          >
            <ComparisonMark kind={comparisonContent.kind} />
            <div>
              <MonoLabel>{comparisonContent.label}</MonoLabel>
              <h3 className="my-1 text-xl font-semibold tracking-[-0.6px]">
                {comparisonContent.title}
              </h3>
              <p className="text-[13px] leading-5 text-body">
                {comparisonContent.detail}
              </p>
            </div>
          </div>

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
          <p className="mt-4 text-center text-xs text-mute">
            本次检测会话只存在于当前页面，不形成账户历史，也不会持久保存个人检测结果。
          </p>
        </section>

        <section
          className="mx-auto w-[calc(100%-32px)] scroll-mt-16 pt-18 pb-18 sm:w-[min(1200px,calc(100%-48px))] sm:pt-14 sm:pb-28"
          id="method"
          aria-labelledby="method-title"
        >
          <SectionHeading
            label="HOW TO READ"
            title="把观测和判断分开。"
            titleId="method-title"
            lede="不同目的网络可能触发不同的 DNS、路由或访问策略。本页展示检测端点真实收到的请求信息。"
            className="border-t border-hairline pt-12"
          />

          <div className="grid grid-cols-1 border-y border-hairline sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <article
                className={cn(
                  "pt-6 pb-8 sm:pt-7 sm:pr-8 sm:pb-9 lg:min-h-[250px]",
                  PRINCIPLE_ARTICLE_CLASSES[index],
                )}
                key={principle.label}
              >
                <span className="inline-flex h-[26px] items-center rounded-full bg-canvas px-2 text-[11px] text-body shadow-[inset_0_0_0_1px_var(--color-hairline)]">
                  {principle.label}
                </span>
                <h3 className="mt-8 mb-2 text-xl font-semibold tracking-[-0.6px] lg:mt-14">
                  {principle.title}
                </h3>
                <p className="text-[13px] leading-[21px] text-body">
                  {principle.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="relative grid min-h-[540px] scroll-mt-16 grid-cols-1 items-end gap-14 overflow-hidden bg-ink px-[max(24px,calc((100vw-1200px)/2))] py-20 text-white sm:min-h-[470px] sm:py-26 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)] lg:gap-20"
          id="privacy"
          aria-labelledby="privacy-title"
        >
          <div
            className="absolute inset-0 bg-[linear-gradient(90deg,rgb(255_255_255/11%)_1px,transparent_1px),linear-gradient(rgb(255_255_255/11%)_1px,transparent_1px)] bg-[size:56px_56px] opacity-16 [mask-image:radial-gradient(circle_at_25%_50%,#000,transparent_54%)]"
            aria-hidden="true"
          >
            {["left-[14%]", "left-[28%]", "left-[42%]"].map((left) => (
              <span
                className={cn(
                  "absolute top-[20%] bottom-[15%] w-px bg-[linear-gradient(to_bottom,transparent,rgb(255_255_255/65%),transparent)]",
                  left,
                )}
                key={left}
              />
            ))}
          </div>
          <div className="relative z-[1] max-w-[650px]">
            <MonoLabel className="text-hairline-strong">
              PRIVACY BOUNDARY
            </MonoLabel>
            <h2 className={SECTION_TITLE_CLASS} id="privacy-title">
              出口信息不是精确位置。
            </h2>
            <p className="mt-5 max-w-[610px] text-[15px] leading-[25px] text-[#bdbdbd]">
              出口归属地来自各检测端点自己的 IP 地理数据库，可能存在差异。它不代表设备的精确物理位置，
              也不代表设备全部网络流量。
            </p>
          </div>
          <dl className="relative z-[1] border-t border-white/16">
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
        </section>
      </main>

      <footer className="grid min-h-[124px] grid-cols-1 items-center gap-3 border-t border-hairline bg-canvas px-[max(24px,calc((100vw-1200px)/2))] py-10 sm:grid-cols-[1fr_auto_1fr] sm:gap-6 sm:py-6">
        <div className={BRAND_CLASS}>
          <BrandMark />
          <span>IP 出口检测</span>
        </div>
        <p className="text-xs text-mute">
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
}
