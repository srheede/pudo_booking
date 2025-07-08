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
