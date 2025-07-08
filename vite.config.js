import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { config, getAuthHeaders } from "./src/config.js";

export default defineConfig({
  plugins: [react()],
  base: "./",
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
    port: 3000,
    strictPort: true,
  },
});
