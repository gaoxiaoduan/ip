import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { publicPagesPlugin } from "./scripts/public-pages";

export default defineConfig({
  plugins: [react(), tailwindcss(), publicPagesPlugin(), cloudflare()],
  build: { manifest: true },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
