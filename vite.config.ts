// Builds the site in build/web: Vite bundles the reader JavaScript and the interlinear-site plugin
// (vite/interlinear-plugin.ts) assembles pages, data, fonts, icons and the service worker around it.
import { defineConfig } from "vite";
import { interlinearSite } from "./vite/interlinear-plugin";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [interlinearSite()],
  build: {
    outDir: "build/web",
    emptyOutDir: true,
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
