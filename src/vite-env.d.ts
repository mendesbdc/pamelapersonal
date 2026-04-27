/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Número internacional, só dígitos (ex. 5521999999999). Botão some se vazio. */
  readonly VITE_WHATSAPP_NUMBER?: string;
  /** Texto opcional pré-preenchido no WhatsApp */
  readonly VITE_WHATSAPP_MESSAGE?: string;
  /** Página de agendamento ou link Meet (https://). Botão "Reunião" some se vazio. */
  readonly VITE_GOOGLE_MEET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
