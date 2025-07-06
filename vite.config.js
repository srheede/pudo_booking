import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    "process.env.PUDO_API_KEY": JSON.stringify(process.env.PUDO_API_KEY),
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
