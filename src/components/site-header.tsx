import { useEffect, useState } from "react";

const NAVIGATION = [
  { href: "#results", label: "检测结果" },
  { href: "#method", label: "检测说明" },
  { href: "#privacy", label: "隐私边界" },
] as const;

const Brand = () => (
  <a className="brand" href="#top" aria-label="IP 出口检测首页">
    <span className="brand-mark" aria-hidden="true">
      <span />
    </span>
    <span>IP 出口检测</span>
  </a>
);

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
      <header className="site-header">
        <Brand />
        <nav className="desktop-navigation" aria-label="页面导航">
          {NAVIGATION.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="header-status" href="#results">
          <span className={isDetecting ? "is-running" : ""} />
          {isDetecting ? "检测进行中" : "查看本次结果"}
        </a>
        <button
          className="mobile-menu-button"
          type="button"
          aria-controls="mobile-navigation"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "关闭导航" : "打开导航"}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </header>

      {mobileMenuOpen ? (
        <div className="mobile-menu" id="mobile-navigation">
          <nav aria-label="移动端导航">
            {NAVIGATION.map((item, index) => (
              <a
                href={item.href}
                key={item.href}
                aria-label={item.label}
                onClick={closeMobileMenu}
              >
                <span>0{index + 1}</span>
                {item.label}
              </a>
            ))}
          </nav>
          <p>当前页面 · 不持久保存检测会话</p>
        </div>
      ) : null}
    </>
  );
}
