import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import {
  PUBLIC_PAGES,
  renderHomeFallback,
  renderHomeJsonLd,
  renderPublicPage,
} from "./src/public-content";

const prerenderPublicContent = (): Plugin => {
  let outDir = "";
  let command: "build" | "serve" = "serve";

  const normalizePathname = (pathname: string) =>
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  return {
    name: "prerender-public-content",
    configResolved(config) {
      outDir = config.build.outDir;
      command = config.command;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") {
          next();
          return;
        }

        const pathname = normalizePathname(
          new URL(request.url ?? "/", "http://localhost").pathname,
        );
        const page = PUBLIC_PAGES.find((candidate) => candidate.path === pathname);

        if (!page) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(request.method === "HEAD" ? undefined : renderPublicPage(page));
      });
    },
    transformIndexHtml(html) {
      return html
        .replace(
          "</head>",
          `<script type="application/ld+json">${renderHomeJsonLd()}</script></head>`,
        )
        .replace('<div id="root"></div>', `<div id="root">${renderHomeFallback()}</div>`);
    },
    async closeBundle() {
      if (command !== "build") {
        return;
      }

      await Promise.all(
        PUBLIC_PAGES.map(async (page) => {
          const outputPath = path.join(outDir, page.path, "index.html");
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, renderPublicPage(page), "utf8");
        }),
      );
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), prerenderPublicContent(), cloudflare()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
