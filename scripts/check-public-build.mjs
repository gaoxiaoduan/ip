import assert from "node:assert/strict";
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
];

for (const [relativePath, heading] of publicPages) {
  const html = await readBuiltFile(relativePath);

  assert.match(html, new RegExp(heading));
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
}

const sitemap = await readBuiltFile("sitemap.xml");
for (const [, , pathname] of publicPages) {
  assert.match(sitemap, new RegExp(`https://ip\\.33338888\\.xyz${pathname}`));
}

const robots = await readBuiltFile("robots.txt");
assert.match(robots, /User-agent: GPTBot\nDisallow: \//);
assert.match(robots, /Disallow: \/api\//);
