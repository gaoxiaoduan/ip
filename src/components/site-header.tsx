import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const NAVIGATION = [
  { href: "#results", label: "检测结果" },
  { href: "#method", label: "检测说明" },
  { href: "#privacy", label: "隐私边界" },
] as const;

const BRAND_MARK_CLIP = "[clip-path:polygon(50%_4%,97%_88%,3%_88%)]";

export const BRAND_CLASS =
  "inline-flex w-fit items-center gap-3 text-sm font-semibold tracking-[-0.28px]";

const Brand = () => (
  <a className={BRAND_CLASS} href="#top" aria-label="IP 出口检测首页">
    <BrandMark />
    <span>IP 出口检测</span>
  </a>
);

const GithubLink = () => (
  <a
    className="grid size-9 place-items-center rounded-full text-body transition-colors duration-[160ms] hover:bg-canvas-soft-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
    href="https://github.com/gaoxiaoduan/ip"
    target="_blank"
    rel="noreferrer"
    aria-label="在 GitHub 查看项目（在新标签页打开）"
  >
    <svg
      className="size-[18px]"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.91-2.78.62-3.37-1.2-3.37-1.2-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.36a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.79-4.58 5.05.36.32.68.93.68 1.87 0 1.35-.01 2.44-.01 2.77 0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  </a>
);

export const BrandMark = () => (
  <span
    className={cn(
      "relative grid size-[22px] place-items-center bg-ink forced-colors:border forced-colors:border-[CanvasText]",
      BRAND_MARK_CLIP,
    )}
    aria-hidden="true"
  >
    <span className={cn("size-2.5 translate-y-[3px] bg-canvas", BRAND_MARK_CLIP)} />
  </span>
);

const navItemClassName =
  "min-h-9 rounded-full px-3 py-2 text-sm leading-5 text-body transition-colors duration-[160ms]";

export function SiteHeader({ isDetecting }: { isDetecting: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 grid h-[60px] grid-cols-[1fr_auto] items-center border-b border-[rgb(235_235_235/82%)] bg-[rgb(255_255_255/86%)] px-4 backdrop-blur-[18px] sm:h-16 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <Brand />
        <div className="flex items-center gap-1 sm:gap-2 md:col-span-2 md:grid md:grid-cols-[auto_1fr]">
          <nav
            className="hidden items-center gap-1 sm:flex md:justify-self-start"
            aria-label="页面导航"
          >
            {NAVIGATION.map((item) => (
              <a
                className={cn(
                  navItemClassName,
                  "hover:bg-canvas-soft-2 hover:text-ink",
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1 justify-self-end sm:gap-2">
            <GithubLink />
            <a
              className={cn(
                navItemClassName,
                "hidden items-center gap-2 font-mono text-xs text-ink md:inline-flex",
              )}
              href="#results"
            >
              <span
                className={cn(
                  "size-[7px] rounded-full bg-link shadow-[0_0_0_4px_rgb(0_112_243/9%)]",
                  isDetecting && "animate-status-pulse",
                )}
              />
              {isDetecting ? "检测进行中" : "查看本次结果"}
            </a>
            <button
              className="relative grid size-11 cursor-pointer place-items-center rounded-full hover:bg-canvas-soft-2 sm:hidden"
              type="button"
              aria-controls="mobile-navigation"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "关闭导航" : "打开导航"}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span
                className={cn(
                  "absolute h-[1.5px] w-[19px] bg-ink transition-transform duration-[160ms]",
                  mobileMenuOpen ? "rotate-45" : "-translate-y-1",
                )}
              />
              <span
                className={cn(
                  "absolute h-[1.5px] w-[19px] bg-ink transition-transform duration-[160ms]",
                  mobileMenuOpen ? "-rotate-45" : "translate-y-1",
                )}
              />
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div
          className="fixed inset-[60px_0_0] z-[29] flex flex-col justify-between bg-[rgb(255_255_255/98%)] px-5 pt-10 pb-6 backdrop-blur-[20px] sm:hidden"
          id="mobile-navigation"
        >
          <nav className="flex flex-col" aria-label="移动端导航">
            {NAVIGATION.map((item, index) => (
              <a
                className="grid min-h-[72px] grid-cols-[40px_1fr] items-center border-b border-hairline text-2xl leading-8 font-semibold tracking-[-0.96px] first:border-t"
                href={item.href}
                key={item.href}
                aria-label={item.label}
                onClick={closeMobileMenu}
              >
                <span className="font-mono text-[11px] font-normal tracking-normal text-mute">
                  0{index + 1}
                </span>
                {item.label}
              </a>
            ))}
          </nav>
          <p className="font-mono text-[11px] text-mute">
            当前页面 · 不持久保存检测会话
          </p>
        </div>
      ) : null}
    </>
  );
}
