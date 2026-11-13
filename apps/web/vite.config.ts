import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4180,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4181",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three-core";
          if (
            id.includes("node_modules/@react-three/") ||
            id.includes("node_modules/three-stdlib/") ||
            id.includes("node_modules/maath/") ||
            id.includes("node_modules/meshline/")
          ) {
            return "three-ecosystem";
          }
          return undefined;
        },
      },
    },
  },
});
