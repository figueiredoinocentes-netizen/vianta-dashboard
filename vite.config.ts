import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Só em desenvolvimento local: as Netlify Functions não correm aqui, por isso
    // as leituras vão à API de produção. Escritas (POST/PUT/DELETE) são bloqueadas
    // para nunca alterarem dados reais a partir do localhost.
    proxy: {
      "/.netlify/functions": {
        target: "https://vianta-dashboard.netlify.app",
        changeOrigin: true,
        bypass(req, res) {
          if (req.method !== "GET" && res) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Escrita desativada em local (proxy só de leitura)" }));
            return false;
          }
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
