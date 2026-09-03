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
  ["connectivity/index.html", "网络连通性：固定网站资源请求", "/connectivity"],
  ["webrtc/index.html", "WebRTC 泄漏测试：检测真实 IP 与 NAT 类型", "/webrtc"],
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
assert.match(
  builtHeaders,
  /\/.well-known\/ard\.json\n  Access-Control-Allow-Origin: \*/,
);
assert.match(
  builtHeaders,
  /\/.well-known\/ai-catalog\.json\n  Access-Control-Allow-Origin: \*/,
);
assert.match(
  builtHeaders,
  /\/.well-known\/agent-skills\/index\.json\n  Access-Control-Allow-Origin: \*/,
);
assert.match(
  builtHeaders,
  /\/.well-known\/agent-skills\/observe-current-ip\/SKILL\.md\n  Access-Control-Allow-Origin: \*\n  Content-Type: text\/markdown; charset=utf-8/,
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

const homePage = await readBuiltFile("index.html");
assert.match(homePage, /<title>IP\.33338888\.xyz｜IP 出口检测<\/title>/);
assert.match(homePage, /<meta name="application-name" content="IP\.33338888\.xyz"/);
assert.match(homePage, /property="og:site_name" content="IP\.33338888\.xyz"/);
assert.match(homePage, /"@type":"WebSite"/);
assert.match(homePage, /"name":"IP\.33338888\.xyz"/);

const sitemap = await readBuiltFile("sitemap.xml");
for (const [, , pathname] of publicPages) {
  assert.match(sitemap, new RegExp(`https://ip\\.33338888\\.xyz${pathname}`));
}

const robots = await readBuiltFile("robots.txt");
assert.match(robots, /User-agent: GPTBot\nDisallow: \//);
assert.match(robots, /Disallow: \/api\//);

const llms = await readBuiltFile("llms.txt");
assert.match(llms, /^# IP 出口检测/m);
assert.match(llms, /\[OpenAPI specification\]\(https:\/\/ip\.33338888\.xyz\/openapi\.json\)/);
assert.match(llms, /\[Agent Skills index\]\(https:\/\/ip\.33338888\.xyz\/\.well-known\/agent-skills\/index\.json\)/);

const markdownAgentDocs = await readBuiltFile("llms.md");
assert.match(markdownAgentDocs, /^# IP 出口检测/m);
assert.match(markdownAgentDocs, /\[GET \/api\/observe\]/);

const openApi = JSON.parse(await readBuiltFile("openapi.json"));
assert.equal(openApi.openapi, "3.1.0");
assert.equal(openApi.info.title, "IP 出口检测 API");
assert.ok(openApi.paths["/api/observe"].get);

const developerHub = await readBuiltFile("developers/index.html");
assert.match(developerHub, /IP 出口检测（ip\.33338888\.xyz）开发者资源/);
assert.match(developerHub, /href="\/openapi\.json"/);
assert.match(developerHub, /href="\/mcp"/);
assert.match(developerHub, /href="\/\.well-known\/mcp\/manifest\.json"/);

const mcpManifest = JSON.parse(
  await readBuiltFile(".well-known/mcp/manifest.json"),
);
assert.equal(mcpManifest.manifest_version, "1.0");
assert.equal(mcpManifest.transport.type, "streamable-http");
assert.equal(mcpManifest.transport.url, "https://ip.33338888.xyz/mcp");
assert.equal(
  mcpManifest.transport.http.base_url,
  "https://ip.33338888.xyz/mcp",
);
assert.equal(mcpManifest.tools[0].name, "observe_ip");

const agentCard = JSON.parse(
  await readBuiltFile(".well-known/agent-card.json"),
);
assert.equal(agentCard.name, "IP 出口检测 Agent");
assert.equal(agentCard.url, "https://ip.33338888.xyz/a2a");
assert.equal(agentCard.supportedInterfaces[0].protocolBinding, "JSONRPC");
assert.equal(agentCard.skills[0].id, "observe-current-ip");

const skill = await readBuiltFile(
  ".well-known/agent-skills/observe-current-ip/SKILL.md",
);
assert.match(skill, /^---\nname: observe-current-ip\ndescription: /);
const skillIndex = JSON.parse(
  await readBuiltFile(".well-known/agent-skills/index.json"),
);
assert.equal(
  skillIndex.$schema,
  "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
);
assert.equal(skillIndex.skills[0].name, "observe-current-ip");
assert.equal(
  skillIndex.skills[0].digest,
  `sha256:${createHash("sha256").update(skill).digest("hex")}`,
);

for (const catalogPath of [
  ".well-known/ard.json",
  ".well-known/ai-catalog.json",
]) {
  const catalog = JSON.parse(await readBuiltFile(catalogPath));
  assert.equal(catalog.specVersion, "1.0");
  assert.equal(catalog.entries.length, 1);

  const [entry] = catalog.entries;
  assert.equal(entry.identifier, "urn:air:ip.33338888.xyz:server:ip-exit-observer");
  assert.equal(entry.displayName, "IP 出口检测 MCP Server");
  assert.equal(entry.type, "application/mcp-server-card+json");
  assert.equal(entry.url, "https://ip.33338888.xyz/.well-known/mcp/server-card.json");
  assert.equal("data" in entry, false);
  assert.ok(entry.representativeQueries.length >= 2);
  assert.ok(entry.representativeQueries.length <= 5);
}
