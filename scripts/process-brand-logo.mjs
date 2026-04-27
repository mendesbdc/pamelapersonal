/**
 * Remove fundo claro, aplica cor da identidade (lavanda / texto do tema) e grava PNG com alpha.
 * Uso: node scripts/process-brand-logo.mjs [caminho/logo.png]
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outDir = join(projectRoot, "public-assets", "brand");
const outFile = join(outDir, "pamela-mendes-logo.png");

const localFallback = join(projectRoot, "scripts", "source-logo.png");
const cursorCacheSrc =
  process.platform === "win32"
    ? join(
        process.env.LOCALAPPDATA || "",
        "Cursor",
        "User",
        "workspaceStorage",
        "60e7a4e8559d6377dcc29b2364fad0b5",
        "images",
        "image-f7324376-78d7-4f77-aa9c-7ed5e9fcf06a.png"
      )
    : "";

const inputArg = process.argv[2];
let inputPath = inputArg;
if (!inputPath) {
  if (existsSync(localFallback)) inputPath = localFallback;
  else if (cursorCacheSrc && existsSync(cursorCacheSrc)) inputPath = cursorCacheSrc;
  else inputPath = localFallback;
}

if (!existsSync(inputPath)) {
  console.error("Falta o PNG de origem. Passe o caminho ou coloque o ficheiro em scripts/source-logo.png");
  process.exit(1);
}

/** Cor alinhada a --text / identidade: lavanda claro */
const BR = 0xed;
const BG = 0xe9;
const BB = 0xfe;

const buf = readFileSync(inputPath);
const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const ch = Math.min(channels, 4);
const out = Buffer.alloc(width * height * 4);

for (let i = 0; i < width * height; i++) {
  const o = i * 4;
  const r = data[i * ch + 0];
  const g = data[i * ch + 1];
  const b = data[i * ch + 2];
  const aIn = ch >= 4 ? data[i * ch + 3] : 255;
  const avg = (r + g + b) / 3;

  if (avg >= 250 && r > 242 && g > 242 && b > 242) {
    out[o] = 0;
    out[o + 1] = 0;
    out[o + 2] = 0;
    out[o + 3] = 0;
    continue;
  }

  const ink = Math.max(0, Math.min(1, 1 - avg / 255));
  const aOut = Math.min(255, Math.round(255 * ink * 1.02 * (aIn / 255)));
  if (aOut < 8) {
    out[o + 3] = 0;
    continue;
  }
  out[o] = BR;
  out[o + 1] = BG;
  out[o + 2] = BB;
  out[o + 3] = aOut;
}

mkdirSync(outDir, { recursive: true });
await sharp(out, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(outFile);

console.log("Logo processada:", outFile, `(${width}×${height})`);
