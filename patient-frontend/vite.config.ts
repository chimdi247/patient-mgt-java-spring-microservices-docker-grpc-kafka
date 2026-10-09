import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run dev` proxies /api to the api-gateway published by docker compose (localhost:4004),
// so the browser always talks to a single origin (no CORS needed).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4004", changeOrigin: true },
      "/auth": { target: "http://localhost:4004", changeOrigin: true },
      "/api-docs": { target: "http://localhost:4004", changeOrigin: true },
    },
  },
});
