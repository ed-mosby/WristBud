import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build",
    sourcemap: false,
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            if (id.includes('axios')) {
              return 'utils';
            }
            if (id.includes('brain')) {
              return 'ml';
            }
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: ["localhost", "all"],
    hmr: { host: "localhost", protocol: "ws" },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
  define: { 
    global: "globalThis",
    'process.env': {}
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      util: 'util',
    },
  },
  optimizeDeps: {
    include: ['brainjs'],
    exclude: ['stream']
  },
  preview: { host: "0.0.0.0", port: 7860 },
});
