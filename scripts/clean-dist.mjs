import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const dist = join(process.cwd(), "dist");

async function main() {
  if (!existsSync(dist)) {
    return;
  }
  let lastErr;
  for (let i = 0; i < 10; i++) {
    try {
      rmSync(dist, { recursive: true, force: true });
      console.log("Pasta dist/ removida (build limpo).");
      return;
    } catch (err) {
      lastErr = err;
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      if (code !== "EPERM" && code !== "EBUSY" && code !== "ENOENT") {
        throw err;
      }
      console.warn(
        `dist/ em uso (tentativa ${i + 1}/10). Feche o preview do Vite, o navegador na pasta dist e o antivirus sobre o projeto.`
      );
      await delay(600);
    }
  }
  throw lastErr ?? new Error("Nao foi possivel apagar dist/");
}

await main();
