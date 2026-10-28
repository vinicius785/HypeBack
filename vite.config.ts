import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/screens",
      routeToken: "_layout",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // O Vite já faz fallback automático para index.html em desenvolvimento
  // Esta configuração garante que funcione corretamente
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
