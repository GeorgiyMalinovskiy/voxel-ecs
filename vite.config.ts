import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  server: {
    port: 9000,
    strictPort: true,
    host: true,
    open: true,
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  base: "",
  publicDir: "public",
});
