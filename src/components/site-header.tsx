import { useEffect, useState } from "react";

import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";

const NAVIGATION = [
  { href: "#results", label: "检测结果" },
  { href: "#method", label: "检测说明" },
  { href: "#privacy", label: "隐私边界" },
] as const;

const BRAND_MARK_CLIP = "[clip-path:polygon(50%_4%,97%_88%,3%_88%)]";

export const BRAND_CLASS =
  "inline-flex w-fit items-center gap-3 text-sm font-semibold tracking-[-0.28px]";

const Brand = ({ homeHref }: { homeHref: string }) => (
  <a className={BRAND_CLASS} href={homeHref} aria-label="IP 出口检测首页">
    <BrandMark />
    <span>IP 出口检测</span>
  </a>
);

const GithubLink = () => (
  <a
    className="grid size-9 place-items-center text-body transition-colors duration-[160ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
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
  "min-h-9 px-3 py-2 text-sm leading-5 text-body transition-colors duration-[160ms]";

type ThemePreference = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "ip-exit-observer-theme";

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const THEME_LABELS: Record<ThemePreference, string> = {
  system: "当前：跟随系统。点击切换为浅色",
  light: "当前：浅色。点击切换为深色",
  dark: "当前：深色。点击切换为跟随系统",
};

const initialThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
};

const ThemeControl = () => {
  const [theme, setTheme] = useState<ThemePreference>(initialThemePreference);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <Tooltip label={THEME_LABELS[theme]}>
      <button
        className="theme-control grid size-9 cursor-pointer place-items-center p-0 text-body transition-colors duration-[160ms] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
        type="button"
        aria-label={THEME_LABELS[theme]}
        onClick={() => setTheme(NEXT_THEME[theme])}
      >
        {theme === "system" ? (
          <svg
            className="size-[18px] fill-none stroke-current stroke-[1.7]"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <rect x="3" y="3.5" width="14" height="10" rx="1" />
            <path d="M7.5 16.5h5M10 13.5v3" />
          </svg>
        ) : theme === "light" ? (
          <svg
            className="size-[18px] fill-none stroke-current stroke-[1.7]"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.4 1.4M5.4 14.6 4 16M16 16l-1.4-1.4M5.4 5.4 4 4" />
          </svg>
        ) : (
          <svg
            className="size-[18px] fill-none stroke-current stroke-[1.7]"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M16.2 12.4A6.9 6.9 0 0 1 7.6 3.8 6.9 6.9 0 1 0 16.2 12.4Z" />
          </svg>
        )}
      </button>
    </Tooltip>
  );
};

export function SiteHeader({
  brandHref,
  homeHref,
  isDetecting,
}: {
  readonly brandHref: string;
  readonly homeHref: string;
  readonly isDetecting: boolean;
}) {
  const navigation = NAVIGATION.map((item) => ({
    ...item,
    href: `${homeHref}${item.href}`,
  }));

  return (
    <header className="sticky top-0 z-30 grid h-[60px] grid-cols-[1fr_auto] items-center border-b border-hairline bg-canvas px-4 sm:h-16 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <Brand homeHref={brandHref} />
        <nav
          className="hidden items-center gap-1 sm:flex sm:justify-self-center"
          aria-label="页面导航"
        >
          {navigation.map((item) => (
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
          <ThemeControl />
          <GithubLink />
          <a
            className={cn(
              navItemClassName,
              "hidden items-center gap-2 font-mono text-xs text-ink md:inline-flex",
            )}
            href={`${homeHref}#results`}
          >
            {isDetecting ? "检测进行中" : "查看本次结果"}
          </a>
        </div>
      </header>
  );
}
