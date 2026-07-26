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
        <nav
          className="hidden items-center gap-1 justify-self-end sm:flex md:justify-self-auto"
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
        <a
          className={cn(
            navItemClassName,
            "hidden items-center gap-2 justify-self-end font-mono text-xs text-ink md:inline-flex",
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
