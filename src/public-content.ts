export const SITE_ORIGIN = "https://ip.33338888.xyz";
export const PUBLIC_CONTENT_UPDATED_AT = "2026-07-29";

type Source = {
  label: string;
  href: string;
};

export type PublicPage = {
  path: "/guides/ip-differences" | "/guides/ip-mismatch" | "/guides/traffic-split-observation" | "/methodology";
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  sections: ReadonlyArray<{
    title: string;
    paragraphs: readonly string[];
  }>;
  sources: readonly Source[];
};

export const PUBLIC_PAGES: readonly PublicPage[] = [
  {
    path: "/guides/ip-differences",
    title: "为什么不同网站会看到不同的出口 IP？",
    description: "解释不同目的网络可能观察到不同出口信息的边界，并说明一次检测能与不能证明什么。",
    eyebrow: "出口差异 / 观测边界",
    intro:
      "同一台设备访问不同目的网络时，请求不一定经过同一条网络路径。本站只展示各检测端点在本次请求中观察到的出口信息；不同结果是观测事实，不是对网络配置的诊断。",
    sections: [
      {
        title: "先区分：谁在观察、观察到什么",
        paragraphs: [
          "出口结果是某个检测端点收到浏览器请求后看到的公网 IP 及其归属地。它代表这一次访问该端点的路径，不代表设备的全部流量，也不是设备的精确物理位置。",
          "因此，“不同网站看到不同 IP”首先说明至少两次请求被观察到的出口信息不同。它本身不能证明某个代理规则、DNS、路由或访问策略一定正确或一定失效。",
        ],
      },
      {
        title: "为什么会出现差异",
        paragraphs: [
          "不同目的网络可能经过不同的域名解析、路由、网络出口或访问策略。任何一个环节的差异，都可能让终点观察到不同的公网出口。没有针对当前网络和完整路径的额外证据时，这些只能是可能性，而不是本站给出的原因判断。",
          "归属地也可能不同：检测端点使用各自的 IP 地理数据库，数据库更新节奏和粒度并不完全相同。相同 IP 的归属地表述存在差别，不等于用户位置发生变化。",
        ],
      },
      {
        title: "怎样读本页的检测结果",
        paragraphs: [
          "至少两条成功的检测路径才可以比较。若成功路径返回不同的公网 IP 或出口归属地，页面会显示“观察到出口差异”；若成功路径不足两条，页面会显示“数据不足”。",
          "想继续核对时，请在同一时段重新检测，并查看每张路径卡片标出的实际端点与返回时间。不要把单次结果延伸成对所有网站或任何指定服务的结论。",
        ],
      },
    ],
    sources: [
      {
        label: "Cloudflare：CF-Connecting-IP 请求头参考",
        href: "https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip",
      },
      {
        label: "MDN：Fetch API 的请求与响应",
        href: "https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API/Using_Fetch",
      },
    ],
  },
  {
    path: "/guides/ip-mismatch",
    title: "国内和海外看到的 IP 不一致，该怎么理解？",
    description: "说明国内网站路径与海外网站路径出现不同出口结果时，哪些解释是合理边界，哪些结论不能推出。",
    eyebrow: "国内 / 海外 / 谨慎解读",
    intro:
      "国内网站路径、普通海外网站路径与受限海外服务路径分别代表不同目的网络类别。它们的出口结果不一致，表示本次请求的观察结果不同；这不是对任意特定网站可达性或网络配置的判定。",
    sections: [
      {
        title: "不一致意味着什么",
        paragraphs: [
          "当两个或更多成功路径给出不同出口信息时，可以如实说：不同目的网络在这次访问中观察到不同出口。这个结论只覆盖参与检测的路径和时间点。",
          "如果结果一致，也只表示成功路径在本次观察中返回了相同出口信息。它不能保证未来访问、所有域名或所有应用都会走相同路径。",
        ],
      },
      {
        title: "受限海外服务路径并不等于某个指定网站",
        paragraphs: [
          "该路径使用经过筛选、可能受访问策略影响的第三方端点，用来提供一种受限海外服务的代表性观测。它不等同于 Google 或任何指定服务的官方观测，也不用于测试其可访问性。",
          "如果某条路径不可达，页面只会标记本次配置的端点均未及时返回有效结果。它不证明设备没有公网出口，也不证明服务被封锁。",
        ],
      },
      {
        title: "下一步应如何做",
        paragraphs: [
          "先确认有至少两条成功路径，再阅读路径名称、端点来源和返回时间。需要排查网络设置时，应以自己的网络配置、服务提供方文档和受控测试为准；本站不输出配置建议或故障诊断。",
        ],
      },
    ],
    sources: [
      {
        label: "Cloudflare：请求的地理与网络属性",
        href: "https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties",
      },
      {
        label: "MDN：同源策略概览",
        href: "https://developer.mozilla.org/zh-CN/docs/Web/Security/Same-origin_policy",
      },
    ],
  },
  {
    path: "/guides/traffic-split-observation",
    title: "三条检测路径，观察的是什么？",
    description: "介绍国内网站、普通海外网站和受限海外服务三类检测路径的观察范围、端点与备用规则。",
    eyebrow: "三条检测路径 / 方法说明",
    intro:
      "三条检测路径不是三条网络线路，也不用于配置诊断。它们是浏览器直接访问不同目的网络类别中的检测端点所形成的独立观测；页面比较的是这些端点看到的结果。",
    sections: [
      {
        title: "国内网站路径",
        paragraphs: [
          "这条路径以中国大陆常见网站为目的网络类别，用于观察访问国内网站时的出口结果。浏览器直接请求主检测端点；只有主端点未返回有效结果时，才会尝试同类备用端点。",
        ],
      },
      {
        title: "普通海外网站路径与受限海外服务路径",
        paragraphs: [
          "普通海外网站路径用于观察通常可以直接访问的海外网站类别。受限海外服务路径使用可能受访问策略影响的海外第三方端点，提供代表性观测，但不等同于任何指定服务。",
          "备用端点用于处理主端点的不可用或返回格式问题。备用端点来自独立服务时，才构成独立冗余；同一服务的兼容接口只能应对接口或路径故障。页面会如实标出实际采用的端点。",
        ],
      },
      {
        title: "为什么“数据不足”是正常结果",
        paragraphs: [
          "所有路径都会完成主/备用尝试。若少于两条路径成功，无法进行出口比较，页面会显示数据不足。这个状态比把不可达解释成无出口或已断网更准确。",
        ],
      },
    ],
    sources: [
      {
        label: "MDN：使用 AbortController 取消请求",
        href: "https://developer.mozilla.org/en-US/docs/Web/API/AbortController",
      },
      {
        label: "MDN：Fetch API",
        href: "https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API",
      },
    ],
  },
  {
    path: "/methodology",
    title: "检测方法与隐私边界",
    description: "公开检测路径、备用规则、匿名度量、爬虫政策和技术来源，说明本项目如何保持可复核。",
    eyebrow: "可复核方法 / 隐私边界",
    intro:
      "本页公开工具的观测方法和隐私承诺，便于复核页面文字是否与实际行为一致。项目不建立账户、不保存个人检测结果，也不把出口结果作为用户行为数据。",
    sections: [
      {
        title: "检测方法",
        paragraphs: [
          "浏览器直接向每条检测路径的端点发出请求。本站的自有接口只读取本次请求的 Cloudflare 元数据；第三方端点的返回由浏览器直接取得。每条路径先使用主检测端点，只有主端点未返回有效结果时才使用备用检测端点。",
          "检测会话只存在于当前页面。关闭或刷新页面后，页面不会保存个人检测结果，也不会建立可查询的检测历史。",
        ],
      },
      {
        title: "匿名优化事件",
        paragraphs: [
          "为了判断说明页是否促成自然发现完成检测，项目仅聚合检测开始和检测完成事件。完成事件只在三条路径的主/备用尝试全部结束后产生，并只区分可比较或数据不足。",
          "事件只包含有限的页面类型、来源类别和聚合计数。来源类别由浏览器实际提供的 Referer 主机名在本地粗分为搜索、回答引擎、外部引用、直接访问或未知；无法确认时一律为未知。",
          "项目不写入 IP、出口结果、原始 Referer、完整 URL 参数、Cookie、设备指纹或用户标识，不使用这些事件跨页追踪。",
        ],
      },
      {
        title: "公开内容、抓取与纠错",
        paragraphs: [
          "首页、说明页、方法页和站点地图可供搜索与回答引擎发现；检测 API 不参与抓取或索引。Google、Bing、ChatGPT Search 与 Gemini 的相关爬虫可访问公开内容；GPTBot 被禁止。Google-Extended 保持允许，因为 Gemini grounding 与训练用途无法拆分控制。",
          "如发现页面陈述、端点说明或隐私承诺不准确，请通过 GitHub Issue 提交可复现的纠正信息。检测端点、备用规则或隐私承诺变化时，相关页面会同步更新；无变化时也至少每 90 天复核来源和表述。",
        ],
      },
    ],
    sources: [
      {
        label: "Cloudflare：Web Analytics",
        href: "https://developers.cloudflare.com/web-analytics/",
      },
      {
        label: "Cloudflare：Analytics Engine",
        href: "https://developers.cloudflare.com/analytics/analytics-engine/",
      },
      {
        label: "Google：AI features 与抓取控制",
        href: "https://developers.google.com/search/docs/appearance/ai-features",
      },
      {
        label: "OpenAI：ChatGPT Search 与 GPTBot",
        href: "https://developers.openai.com/api/docs/bots",
      },
    ],
  },
];

const sourceList = (sources: readonly Source[]) =>
  sources
    .map(
      (source) =>
        `<li><a href="${source.href}" rel="noreferrer">${source.label}</a></li>`,
    )
    .join("");

const pageSections = (page: PublicPage) =>
  page.sections
    .map(
      (section) => `<section class="public-section"><h2>${section.title}</h2><div>${section.paragraphs
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join("")}</div></section>`,
    )
    .join("");

const relatedReading = (page: PublicPage) =>
  PUBLIC_PAGES.filter((otherPage) => otherPage.path !== page.path)
    .map(
      (otherPage) =>
        `<li><a href="${otherPage.path}">${otherPage.title}</a></li>`,
    )
    .join("");

const jsonLd = (page: PublicPage) =>
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    inLanguage: "zh-CN",
    url: `${SITE_ORIGIN}${page.path}`,
    dateModified: PUBLIC_CONTENT_UPDATED_AT,
    isPartOf: {
      "@type": "WebSite",
      name: "IP 出口检测",
      url: `${SITE_ORIGIN}/`,
    },
  }).replace(/</g, "\\u003c");

const footer = () =>
  `<footer class="public-footer"><div class="public-footer-inner"><span>IP 出口检测 · 只比较当前页面的出口观测 · 更新于 ${PUBLIC_CONTENT_UPDATED_AT}</span><a href="https://github.com/gaoxiaoduan/ip/issues/new">通过 GitHub Issue 纠正内容</a></div></footer>`;

export const renderPublicPage = (page: PublicPage) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${page.description}" />
    <meta name="theme-color" content="#f7f8fa" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:title" content="${page.title}｜IP 出口检测" />
    <meta property="og:description" content="${page.description}" />
    <link rel="canonical" href="${SITE_ORIGIN}${page.path}" />
    <link rel="stylesheet" href="/public-content.css" />
    <script type="application/ld+json">${jsonLd(page)}</script>
    <title>${page.title}｜IP 出口检测</title>
  </head>
  <body>
    <div class="public-shell">
      <nav class="public-nav" aria-label="站点导航"><a class="public-brand" href="/">IP 出口检测</a><a href="/methodology">检测方法与隐私边界</a></nav>
      <main>
        <header class="public-hero"><div class="public-hero-inner"><span class="public-label">${page.eyebrow}</span><h1>${page.title}</h1><p>${page.intro}</p><div class="public-actions"><a class="public-action" href="/#results">开始本次检测</a><a class="public-action public-action--quiet" href="/guides/ip-differences">阅读相关说明</a></div></div></header>
        <article class="public-article">${pageSections(page)}<section class="public-sources"><h2>继续阅读</h2><ul>${relatedReading(page)}</ul></section><section class="public-sources"><h2>技术来源</h2><ul>${sourceList(page.sources)}</ul></section></article>
      </main>
      ${footer()}
    </div>
  </body>
</html>`;

const homeJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "IP 出口检测",
  url: `${SITE_ORIGIN}/`,
  inLanguage: "zh-CN",
  description: "比较不同目的网络实际观察到的公网出口，不保存个人检测结果。",
}).replace(/</g, "\\u003c");

export const renderHomeFallback = () => `<div class="public-shell">
  <main>
    <header class="public-hero"><div class="public-hero-inner"><span class="public-label">BROWSER-DIRECT / SESSION-ONLY</span><h1>一次看清，网站看到你从哪里来。</h1><p>同时比较国内网站路径、普通海外网站路径与受限海外服务路径实际观察到的公网出口。只描述出口差异，不替你判断网络配置。</p><div class="public-actions"><a class="public-action" href="#results">开始本次检测</a></div></div></header>
    <article class="public-article"><section class="public-section" id="results"><h2>三条路径，一次对照</h2><div><p>浏览器直接访问不同目的网络类别的检测端点。每张路径卡片都会标明本次实际采用的数据来源和返回时间。</p><p>国内网站路径用于观察访问中国大陆常见网站时的出口结果；普通海外网站路径用于观察一般跨境访问；受限海外服务路径只提供可能受访问策略影响的代表性观测，不等同于任何指定服务。</p></div></section><section class="public-section"><h2>结果如何比较</h2><div><p>至少两条成功路径才可以比较。若成功路径观察到不同的公网 IP 或出口归属地，页面会显示出口差异；成功路径不足两条时，页面会显示数据不足。</p><p>每条路径只会在主检测端点失败后尝试备用端点。不可达不证明没有公网出口，也不证明服务被封锁。</p></div></section><section class="public-section"><h2>把观测和判断分开</h2><div><p>浏览器直连：出口结果来自检测端点，本站不会代替访客转发请求。检测会话只停留在当前页面，刷新或关闭后结果消失，不形成账户历史。</p><p>出口差异不是诊断结论。页面只比较各检测端点看到的出口结果，不据此判断代理配置正常、异常或是否生效。</p></div></section><section class="public-section"><h2>隐私边界</h2><div><p>出口归属地来自各检测端点自己的 IP 地理数据库，可能存在差异。它不代表设备的精确物理位置，也不代表设备全部网络流量。</p><p>项目不需要账户、不保存个人检测结果，也不请求额外定位。</p></div></section><section class="public-section"><h2>继续了解</h2><div><p><a href="/guides/ip-differences">为什么不同网站会看到不同的出口 IP？</a></p><p><a href="/guides/ip-mismatch">国内和海外看到的 IP 不一致，该怎么理解？</a></p><p><a href="/guides/traffic-split-observation">三条检测路径，观察的是什么？</a></p><p><a href="/methodology">检测方法与隐私边界</a></p></div></section></article>
  </main>
  ${footer()}
</div>`;

export const renderHomeJsonLd = () => homeJsonLd;
