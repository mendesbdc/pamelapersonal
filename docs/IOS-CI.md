# iOS com GitHub Actions (sem Mac local)

Foi adicionado o workflow `.github/workflows/ios-capacitor.yml`. Em cada _push_ para `main`/`master` (e em _Pull Requests_ e execução manual), o GitHub corre uma **VM macOS** que:

1. Cria `.env.production.local` a partir de **segredos** (URL da API, opcionalmente link do agendamento).
2. Faz `npm ci`, `npm run build`, `npx cap sync ios`.
3. Tenta compilar o projeto **para simulador** (sem assinatura de dispositivo real).

Isto prova que o projeto iOS compila. **Ainda não gera ficheiro `.ipa` para instalar no iPhone** (isso exige assinatura Apple e costuma usar _Fastlane_, `xcodebuild archive` e segredos extra).

## Configurar o repositório

1. Coloque o código no **GitHub** (novo repositório ou _push_ do `pamelapersonal`).
2. No repositório: **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_API_URL` — URL pública `https://...` da API (ou `http://` se aceitarem o risco; em produção prefira HTTPS).
   - (Opcional) `VITE_GOOGLE_MEET_URL` — link `https://calendar.app.google/...` ou outro.

3. A _Actions_ tab mostra o estado do workflow. **Run workflow** permite correr sem novo _push_.

## De aqui a TestFlight / App Store

- Conta **Apple Developer** (custo anual) e criação de **certificados** + **provisioning profile** para a `bundle id` (ex. `br.com.pamelamendespersonal.app` no `capacitor.config.ts`).
- Extensão comum: **Fastlane** (`match` ou `gym`) no mesmo workflow, com segredos em base64 (`.p12`, perfil) ou **API key** do App Store Connect.

O fluxo de **instalação no telemóvel** continua a passar, em última análise, por assinatura Apple; o workflow atual cobre a parte “**build e sync a partir do Git, sem Mac**”.

## Minutos do GitHub

Repositórios **públicos** têm cota de minutos (macOS gasta mais que Linux). **Privado** consome a cota da conta. Consulte a documentação actual da [GitHub sobre Actions](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions).
