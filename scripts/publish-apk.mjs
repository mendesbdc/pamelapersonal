import { copyFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "releases", "pamela-mendes-personal.apk");
const dest = join(root, "dist", "downloads", "pamela-mendes-personal.apk");

if (!existsSync(src)) {
  process.exit(0);
}

try {
  mkdirSync(join(root, "dist", "downloads"), { recursive: true });
  if (existsSync(dest)) {
    try {
      unlinkSync(dest);
    } catch {
      // destino pode estar bloqueado
    }
  }
  copyFileSync(src, dest);
} catch (e) {
  console.error("[publish-apk]", e && e.message ? e.message : e);
  process.exit(1);
}
