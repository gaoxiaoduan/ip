import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  let command: "build" | "serve" = "serve";

  const normalizePathname = (pathname: string) =>
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  return {
    name: "prerender-public-content",
    configResolved(config) {
      command = config.command;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") {
          next();
          return;
        }

        const pathname = normalizePathname(
          new URL(request.url ?? "/", "http://localhost").pathname,
        );
        const page = PUBLIC_PAGES.find(
          (candidate) => candidate.path === pathname,
        );

        if (!page) {
          next();
          return;
        }

        try {
          const html = await server.transformIndexHtml(
            pathname,
            renderPublicPage(page),
          );
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(request.method === "HEAD" ? undefined : html);
        } catch (error) {
          next(error);
        }
      });
    },
    transformIndexHtml(html, context) {
      if (!["/", "/index.html"].includes(context.path)) return html;
      return html
        .replace(
          "</head>",
          `<script type="application/ld+json">${renderHomeJsonLd()}</script></head>`,
        )
        .replace(
          '<div id="root"></div>',
          `<div id="root">${renderHomeFallback()}</div>`,
        );
    },
    async closeBundle() {
      if (command !== "build") {
        return;
      }
      if (this.environment && this.environment.name !== "client") {
        return;
      }

      const clientOutDir =
        this.environment?.config?.build?.outDir ??
        path.resolve(
          import.meta.dirname,
          ".cloudflare/output/v0/workers/default/assets",
        );
      const indexHtml = await readFile(
        path.join(clientOutDir, "index.html"),
        "utf8",
      );
      const appScriptMatch = indexHtml.match(
        /<script type="module" crossorigin src="([^"]+)"><\/script>/,
      );
      if (!appScriptMatch?.[1]) {
        throw new Error(
          "Unable to locate the client entry script in index.html",
        );
      }
      const appScript = appScriptMatch[1];
      const appStylesheets = [...indexHtml.matchAll(
        /<link\b[^>]*rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/g,
      )].map((match) => match[1]);
      if (appStylesheets.length === 0) {
        throw new Error("Unable to locate the client entry CSS in index.html");
      }

      await Promise.all(
        PUBLIC_PAGES.map(async (page) => {
          const outputPath = path.join(clientOutDir, page.path, "index.html");
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(
            outputPath,
            renderPublicPage(page, appScript, appStylesheets),
            "utf8",
          );
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
