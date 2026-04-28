import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { MouseEvent } from "react";
import "./ContactFloatingBar.css";

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

function normalizeMeetUrl(raw: string) {
  const t = raw.trim();
  if (!t) return "";
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname) return "";
    return u.href;
  } catch {
    return "";
  }
}

/**
 * VITE_WHATSAPP_NUMBER — só dígitos, ex. 5521969323239
 * VITE_GOOGLE_MEET_URL — URL de agendamento (Calendar), sala Meet (meet.google.com/…), etc.
 */
export function ContactFloatingBar() {
  const waRaw = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? "").trim();
  const phone = digitsOnly(waRaw);
  const hasWa = phone.length >= 10;

  const meetUrl = normalizeMeetUrl(
    String(import.meta.env.VITE_GOOGLE_MEET_URL ?? "")
  );
  const hasMeet = meetUrl.length > 0;

  if (!hasWa && !hasMeet) return null;

  const text =
    String(import.meta.env.VITE_WHATSAPP_MESSAGE ?? "").trim() ||
    "Olá! Gostaria de saber mais sobre a consultoria.";
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  const q = params.toString();
  const waHref = `https://wa.me/${phone}${q ? `?${q}` : ""}`;

  function openMeetLink(e: MouseEvent<HTMLAnchorElement>) {
    if (!Capacitor.isNativePlatform() || !meetUrl) return;
    e.preventDefault();
    void Browser.open({ url: meetUrl }).catch(() => {
      window.open(meetUrl, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div
      className="contact-fab-group"
      role="navigation"
      aria-label="Contacto e reunião"
    >
      {hasWa && (
        <a
          className="contact-fab contact-fab--whatsapp"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Conversar no WhatsApp"
          aria-label="Abrir conversa no WhatsApp"
        >
          <span className="contact-fab__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="26" height="26" role="img">
              <path
                fill="currentColor"
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
              />
            </svg>
          </span>
          <span className="contact-fab__label">WhatsApp</span>
        </a>
      )}

      {hasMeet && (
        <a
          className="contact-fab contact-fab--meet"
          href={meetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openMeetLink}
          title="Agendar reunião (Google Meet)"
          aria-label="Abrir agendamento ou Google Meet"
        >
          <span className="contact-fab__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="28" height="28" role="img">
              <rect x="2" y="5" width="12" height="14" rx="2.2" fill="currentColor" />
              <path
                d="M15 8.5l4.5-2.3v11.6L15 15.5V8.5z"
                fill="currentColor"
                opacity="0.9"
              />
            </svg>
          </span>
          <span className="contact-fab__label">Reunião</span>
        </a>
      )}
    </div>
  );
}
