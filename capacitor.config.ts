import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.pamelamendespersonal.app",
  appName: "Pâmela Mendes Personal",
  webDir: "dist",
  // "http" evita conteúdo misto; allowMixedContent cobre o caso de voltar a https no WebView
  // com API em http:// (IP/HTTP sem certificado).
  server: {
    androidScheme: "http"
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
