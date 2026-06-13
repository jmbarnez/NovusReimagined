import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  root: ".",
  plugins: [preact()],
  worker: {
    format: "es",
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
