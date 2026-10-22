// Builds the reader bundle. scripts/build_web.mjs runs this first and then assembles build/web
// (pages, data, fonts, icons, service worker) around the bundle listed in the Vite manifest.
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    outDir: "build/vite",
    emptyOutDir: true,
    manifest: true,
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      input: { reader: "src/reader/main.ts" },
      output: {
        // one file per page: the preview build inlines it and the service worker precaches it
        inlineDynamicImports: true,
        entryFileNames: "assets/[name]-[hash].js"
      }
    }
  }
});
