import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["amjt2.com.br", "api.amjt2.com.br"],
    hmr: {
      host: "amjt2.com.br",
      protocol: "ws",
      clientPort: 80
    }
  }
});
