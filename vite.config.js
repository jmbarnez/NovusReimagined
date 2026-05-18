import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
