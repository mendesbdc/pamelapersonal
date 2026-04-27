import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (process.env.SKIP_APK_API_URL_CHECK === "1") {
  console.warn("[APK] SKIP_APK_API_URL_CHECK: a URL da API nao foi gravada em .env.production.local.");
  process.exit(0);
}

let url = String(process.env.VITE_API_URL ?? "").trim();

if (!url && existsSync("api-url-for-apk.txt")) {
  const lines = readFileSync("api-url-for-apk.txt", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    url = t;
    break;
  }
}

if (!url) {
  console.error(`
[APK] Falta a URL onde a API Node esta acessivel a partir do telemovel (api/server.mjs).

1) Crie o ficheiro na raiz do projeto (mesma pasta que package.json):

   api-url-for-apk.txt

2) Uma unica linha, sem barra no fim, por exemplo:

   http://192.168.1.50:3334

   Use o IP LAN do PC onde corre a API (mesma rede Wi-Fi que o telemovel).
   Emulador Android: http://10.0.2.2:3334
   Site em HTTPS com /api no mesmo dominio: https://seu-dominio.com

3) Volte a correr build-apk.bat

Alternativa: definir a variavel VITE_API_URL antes do npm run android:sync
`);
  process.exit(1);
}

if (!/^https?:\/\//i.test(url)) {
  console.error("[APK] A URL deve comecar com http:// ou https://");
  process.exit(1);
}

url = url.replace(/\/$/, "");

let meetUrl = String(process.env.VITE_GOOGLE_MEET_URL ?? "").trim();
if (!meetUrl && existsSync("google-meet-url-for-apk.txt")) {
  const lines = readFileSync("google-meet-url-for-apk.txt", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    meetUrl = t;
    break;
  }
}
if (meetUrl && !/^https?:\/\//i.test(meetUrl)) {
  console.error("[APK] VITE_GOOGLE_MEET_URL / google-meet-url-for-apk.txt tem de comecar com http:// ou https://");
  process.exit(1);
}
meetUrl = meetUrl.replace(/\/$/, "");
const meetLine = meetUrl ? `VITE_GOOGLE_MEET_URL=${meetUrl}\n` : "";

const outPath = ".env.production.local";
let other = "";
if (existsSync(outPath)) {
  const keep = readFileSync(outPath, "utf8")
    .split(/\r?\n/)
    .filter(
      (l) =>
        l.length > 0 &&
        !/^VITE_API_URL\s*=/.test(l) &&
        !/^VITE_GOOGLE_MEET_URL\s*=/.test(l)
    );
  if (keep.length) other = keep.join("\n") + "\n";
}
const merged = `VITE_API_URL=${url}\n${meetLine}${other}`;
writeFileSync(outPath, merged);
console.log("[APK] Build com VITE_API_URL =", url);
if (meetLine) {
  console.log("[APK] VITE_GOOGLE_MEET_URL =", meetUrl);
}
