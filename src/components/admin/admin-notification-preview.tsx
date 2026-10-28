import type { AdminNotificationChannel } from "@/shared/types";

interface AdminNotificationPreviewProps {
  title: string;
  body: string;
  ctaUrl?: string;
  channels: AdminNotificationChannel[];
  /** Texto do alcance (ex.: "1.200 criadores") ou null. */
  reach: string | null;
  /** Texto de quando será enviado. */
  when: string;
}

export const CHANNEL_LABEL: Record<AdminNotificationChannel, string> = {
  push: "Push no app",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

/** Prévia no celular + resumo (`nPvHTML` do protótipo). */
export function AdminNotificationPreview({
  title,
  body,
  ctaUrl,
  channels,
  reach,
  when,
}: AdminNotificationPreviewProps) {
  const now = new Date();
  const clock = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <small className="ntw-pl">Prévia no celular</small>
      <div className="ntp-ph">
        <div className="ntp-t">
          <b>{clock}</b>
          <span>{day}</span>
        </div>
        <div className="ntp-n">
          <span className="ntp-lg">h</span>
          <div>
            <b>{title || "Título da notificação"}</b>
            <p>{body || "A mensagem aparece aqui enquanto você escreve."}</p>
          </div>
          <em>agora</em>
        </div>
      </div>
      <ul className="ntw-sm">
        <li>
          <span>Canais</span>
          <b>{channels.map((c) => CHANNEL_LABEL[c]).join(", ") || "—"}</b>
        </li>
        <li>
          <span>Alcance</span>
          <b>{reach ?? "—"}</b>
        </li>
        {ctaUrl ? (
          <li>
            <span>Link</span>
            <b style={{ wordBreak: "break-all" }}>{ctaUrl}</b>
          </li>
        ) : null}
        <li>
          <span>Envio</span>
          <b>{when}</b>
        </li>
      </ul>
    </>
  );
}
