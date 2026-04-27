import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const apkFile = "pamela-mendes-personal.apk";
const apkSrc = join(root, "releases", apkFile);

function serveApkDownload() {
  return {
    name: "serve-apk-download",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0] ?? "";
        if (path !== `/downloads/${apkFile}` || req.method !== "GET") {
          next();
          return;
        }
        if (!existsSync(apkSrc)) {
          res.statusCode = 404;
          res.end("APK ainda não foi gerado. Rode build-apk.bat primeiro.");
          return;
        }
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", `attachment; filename="${apkFile}"`);
        createReadStream(apkSrc).pipe(res);
      });
    }
  };
}

export default defineConfig({
  // Imagens, manifest, etc. vão para public-assets/ — a pasta "public/" não entra no build.
  publicDir: "public-assets",
  plugins: [react(), serveApkDownload()],
  // No Windows, apagar dist/ antes do build costuma dar EPERM (ficheiros bloqueados).
  // Com false o Vite sobrescreve os ficheiros sem esvaziar a pasta primeiro.
  build: {
    emptyOutDir: false
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3334",
        changeOrigin: true
      }
    }
  }
});
