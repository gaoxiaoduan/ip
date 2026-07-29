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

  return {
    name: "prerender-public-content",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
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
