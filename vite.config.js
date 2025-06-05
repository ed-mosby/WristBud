import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build",
    sourcemap: !1,
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: { vendor: ["react", "react-dom"], utils: ["axios"] },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: !1,
    allowedHosts: ["localhost", "all"],
    hmr: { host: "localhost", protocol: "ws" },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: !0,
        secure: !1,
        rewrite: (path) => path,
      },
    },
  },
  define: { global: "globalThis" },
  preview: { host: "0.0.0.0", port: 7860 },
});
