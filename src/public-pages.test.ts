import { describe, expect, it } from "vitest";

import { renderSitemap } from "./public-content";

describe("公开页面产物", () => {
  it("站点地图列出既有公开页面与独立工具，并保留稳定路径和更新时间", () => {
    const document = new DOMParser().parseFromString(renderSitemap(), "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect([...document.querySelectorAll("loc")].map((node) => node.textContent)).toEqual([
      "https://ip.33338888.xyz/",
      "https://ip.33338888.xyz/guides/ip-differences",
      "https://ip.33338888.xyz/guides/ip-mismatch",
      "https://ip.33338888.xyz/guides/traffic-split-observation",
      "https://ip.33338888.xyz/methodology",
      "https://ip.33338888.xyz/connectivity",
      "https://ip.33338888.xyz/webrtc",
      "https://ip.33338888.xyz/speed-test",
      "https://ip.33338888.xyz/ping",
      "https://ip.33338888.xyz/developers/",
    ]);
    const ping = [...document.querySelectorAll("url")].find((node) => node.querySelector("loc")?.textContent?.endsWith("/ping"));
    expect(ping?.querySelector("lastmod")?.textContent).toBe("2026-10-28");
  });
});
