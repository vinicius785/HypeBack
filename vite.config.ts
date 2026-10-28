import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";

// Identifica o build: o app em execução compara com /version.json do servidor
// para avisar quando há uma versão nova disponível.
const APP_VERSION = String(Date.now());

function emitVersionFile(): Plugin {
  return {
    name: "emit-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: APP_VERSION }),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    emitVersionFile(),
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
