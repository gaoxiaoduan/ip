import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const distPath = path.resolve(import.meta.dirname, "../dist/client");
const readBuiltFile = (relativePath) =>
  readFile(path.join(distPath, relativePath), "utf8");

const publicPages = [
  ["index.html", "一次看清，网站看到你从哪里来。", "/"],
  [
    "guides/ip-differences/index.html",
    "为什么不同网站会看到不同的出口 IP？",
    "/guides/ip-differences",
  ],
  [
    "guides/ip-mismatch/index.html",
    "国内和海外看到的 IP 不一致，该怎么理解？",
    "/guides/ip-mismatch",
  ],
  [
    "guides/traffic-split-observation/index.html",
    "三条检测路径，观察的是什么？",
    "/guides/traffic-split-observation",
  ],
  ["methodology/index.html", "检测方法与隐私边界", "/methodology"],
  ["connectivity/index.html", "网络连通性：固定网站 favicon 观测", "/connectivity"],
  ["webrtc/index.html", "WebRTC 候选测试：查看浏览器连接证据", "/webrtc"],
  ["speed-test/index.html", "网速测试：下载、上传与延迟", "/speed-test"],
];

const builtHeaders = await readBuiltFile("_headers");
const contentSecurityPolicy = builtHeaders.match(
  /Content-Security-Policy: (.+)/,
)?.[1];

assert.ok(contentSecurityPolicy, "Content-Security-Policy header is required");
assert.match(
  contentSecurityPolicy,
  /connect-src[^;]*https:\/\/cloudflareinsights\.com/,
);
assert.match(contentSecurityPolicy, /font-src 'self' data:/);
assert.match(
  contentSecurityPolicy,
  /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/,
);

for (const [relativePath, heading, pathname] of publicPages) {
  const html = await readBuiltFile(relativePath);

  assert.match(html, new RegExp(heading));
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /更新于 2026-07-29/);
  assert.doesNotMatch(html, /<style>/);

  if (pathname !== "/") {
    assert.match(html, /<link rel="stylesheet" href="\/public-content\.css" \/>/);
  }

  if (["/connectivity", "/webrtc", "/speed-test"].includes(pathname)) {
    assert.match(html, /<script type="module" src="\/assets\//);
  }

  for (const script of html.matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    const hash = createHash("sha256").update(script[1]).digest("base64");
    assert.ok(
      contentSecurityPolicy.includes(`'sha256-${hash}'`),
      `${relativePath} contains an inline script not allowed by CSP`,
    );
  }

  for (const [, , linkedPath] of publicPages) {
    if (linkedPath !== pathname) {
      assert.match(html, new RegExp(`href="${linkedPath}"`));
    }
  }
}

const publicContentCss = await readBuiltFile("public-content.css");
assert.match(publicContentCss, /\.public-hero/);

const sitemap = await readBuiltFile("sitemap.xml");
for (const [, , pathname] of publicPages) {
  assert.match(sitemap, new RegExp(`https://ip\\.33338888\\.xyz${pathname}`));
}

const robots = await readBuiltFile("robots.txt");
assert.match(robots, /User-agent: GPTBot\nDisallow: \//);
assert.match(robots, /Disallow: \/api\//);
