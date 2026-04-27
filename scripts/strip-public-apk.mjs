import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const dirs = [join(process.cwd(), "public", "downloads"), join(process.cwd(), "public-assets", "downloads")];

for (const dir of dirs) {
  if (!existsSync(dir)) {
    continue;
  }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".apk")) {
      continue;
    }
    try {
      unlinkSync(join(dir, name));
    } catch {
      console.warn(
        `Nao foi possivel apagar ${dir.replace(process.cwd() + "\\", "")}\\${name}. Feche o navegador/antivirus e apague manualmente.`
      );
    }
  }
}
