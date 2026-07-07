import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-syntax": ["react-syntax-highlighter", "refractor"],
          "vendor-xterm": ["@xterm/xterm", "@xterm/addon-fit"],
          "vendor-diff": ["diff"],
          "vendor-konva": ["konva", "react-konva"],
        },
      },
    },
  },
  server: {
    // Keep in sync with electron main's loadURL (PILOT_DEV_PORT overrides both)
    port: Number(process.env.PILOT_DEV_PORT) || 5173,
    // Native file watching (fsevents/kqueue) silently dies on this machine when
    // fd limits are exhausted — VITE_USE_POLLING=1 opts into polling instead.
    ...(process.env.VITE_USE_POLLING
      ? { watch: { usePolling: true, interval: 300 } }
      : {}),
  },
});
