import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import config from "./config.json";

// Helper function to get Authorization header
const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.PUDO_API_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "./",
  define: {
    "process.env.PUDO_API_KEY": JSON.stringify(getAuthHeaders().Authorization),
  },
  build: {
    outDir: "build",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: process.env.VITE_WEB_DEV === "1" ? 5180 : 3000,
    strictPort: true,
    cors: true,
    ...(process.env.VITE_WEB_DEV === "1"
      ? {
          hmr: {
            host: "localhost",
            port: 5180,
            clientPort: 5180,
          },
        }
      : {}),
    proxy: {
      // Proxy PUDO waybill/sticker label generation to avoid CORS in browser dev mode.
      // Electron uses IPC instead and never hits this proxy.
      "/pudo-generate": {
        target: "https://api-pudo.co.za",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pudo-generate/, "/generate"),
      },
    },
  },
});
