import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Manifest, Plugin } from "vite";

import {
  PUBLIC_PAGES,
  renderHomeFallback,
  renderHomeJsonLd,
  renderPublicPage,
  renderSitemap,
} from "../src/public-content";

async function readClientAssets(outDir: string) {
  const manifest: Manifest = JSON.parse(await readFile(path.join(outDir, ".vite/manifest.json"), "utf8"));
  const entry = manifest["index.html"];
  if (!entry?.isEntry) throw new Error("Missing client index.html entry in Vite manifest");
  const stylesheets = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing Vite manifest chunk: ${key}`);
    chunk.css?.forEach((file) => stylesheets.add(`/${file}`));
    chunk.imports?.forEach(visit);
  };
  visit("index.html");
  if (!stylesheets.size) throw new Error("Missing client CSS in Vite manifest");
  return { scriptSrc: `/${entry.file}`, stylesheetHrefs: [...stylesheets] };
}

export function publicPagesPlugin(): Plugin {
  let command: "build" | "serve" = "serve";
  return {
    name: "prerender-public-content",
    configResolved(config) {
      command = config.command;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") return next();
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname.replace(/\/+$/, "") || "/";
        const page = PUBLIC_PAGES.find((page) => page.path === pathname);
        if (!page && pathname !== "/sitemap.xml") return next();
        try {
          const html = page
            ? await server.transformIndexHtml(pathname, renderPublicPage(page, {
                scriptSrc: "/src/main.tsx", stylesheetHrefs: [],
              }))
            : renderSitemap();
          response.statusCode = 200;
          response.setHeader("Content-Type", page ? "text/html; charset=utf-8" : "application/xml; charset=utf-8");
          response.end(request.method === "HEAD" ? undefined : html);
        } catch (error) {
          next(error);
        }
      });
    },
    transformIndexHtml(html, context) {
      if (!["/", "/index.html"].includes(context.path)) return html;
      return html
        .replace("</head>", `<script type="application/ld+json">${renderHomeJsonLd()}</script></head>`)
        .replace('<div id="root"></div>', `<div id="root">${renderHomeFallback()}</div>`);
    },
    async closeBundle() {
      if (command !== "build" || this.environment.name !== "client") return;
      const outDir = path.resolve(this.environment.config.root, this.environment.config.build.outDir);
      const assets = await readClientAssets(outDir);
      await Promise.all([
        ...PUBLIC_PAGES.map(async (page) => {
          const outputPath = path.join(outDir, page.path, "index.html");
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, renderPublicPage(page, assets), "utf8");
        }),
        writeFile(path.join(outDir, "sitemap.xml"), renderSitemap(), "utf8"),
      ]);
    },
  };
}
