import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3000",
      "/content": "http://localhost:3000",
      "/telegram": "http://localhost:3000"
    }
  },
  test: {
    environment: "jsdom"
  }
});
