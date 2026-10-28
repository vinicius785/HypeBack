import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ShareCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignTitle: string;
}

export function ShareCampaignModal({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
}: ShareCampaignModalProps) {
  const [copied, setCopied] = useState(false);

  // Link da tela pública de convite (rota da SPA). É esta rota que renderiza o
  // convite e busca `GET /public/campaigns/:id/invite`. Apontar direto para ela
  // garante que colar o link no navegador abra a página de convite.
  const campaignUrl = `${window.location.origin}/campaigns/${campaignId}/invite`;
  const shareText = `Convite para a campanha: ${campaignTitle}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(campaignUrl);
      setCopied(true);
      toast.success("Link copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  /**
   * Abre uma URL externa resiliente a bloqueio de pop-up. Se o navegador
   * bloquear o `window.open`, copia o link para o usuário colar manualmente —
   * evita o clique "que não faz nada".
   */
  const openExternal = (url: string) => {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      void navigator.clipboard?.writeText(campaignUrl).catch(() => {});
      toast.error("Não foi possível abrir o app. Link copiado — cole no destino.");
    }
  };

  // Web Share API: caminho mais confiável p/ compartilhar externamente — delega
  // à folha de compartilhamento do sistema (cada destino abre corretamente).
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: campaignTitle,
        text: shareText,
        url: campaignUrl,
      });
    } catch {
      // Usuário cancelou ou navegador recusou — silencioso (sem erro).
    }
  };

  const shareOnWhatsApp = () =>
    openExternal(
      `https://wa.me/?text=${encodeURIComponent(`${shareText} ${campaignUrl}`)}`,
    );

  const shareOnLinkedIn = () =>
    openExternal(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(campaignUrl)}`,
    );

  const shareOnTelegram = () =>
    openExternal(
      `https://t.me/share/url?url=${encodeURIComponent(campaignUrl)}&text=${encodeURIComponent(shareText)}`,
    );

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Convite — ${campaignTitle}`);
    const body = encodeURIComponent(`${shareText}\n\n${campaignUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Facebook (sharer) e X/Twitter (intent) foram removidos: dependem de scrape
  // de prévia/intent de uma URL de convite AUTENTICADA do backoffice, então não
  // abrem corretamente. Mantidos apenas os canais por link direto (deep-link),
  // que pré-preenchem texto+URL sem depender de scraping.
  const shareChannels = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: "MessageCircle" as const,
      color: "#25D366",
      onClick: shareOnWhatsApp,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      icon: "Share2" as const,
      color: "#0077B5",
      onClick: shareOnLinkedIn,
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: "Send" as const,
      color: "#0088CC",
      onClick: shareOnTelegram,
    },
    {
      key: "email",
      label: "E-mail",
      icon: "Mail" as const,
      color: "#404040",
      onClick: shareViaEmail,
    },
  ];

  if (!isOpen) return null;

  return (
    <Modal
      onClose={onClose}
      title="Compartilhar convite da campanha"
      panelClassName="max-w-3xl"
    >
      <div className="flex flex-col gap-6">
        <div className="min-w-0 flex flex-col gap-2 text-sm text-neutral-700 leading-relaxed">
          <p>
            Envie esse link para convidar influenciadores externos. Eles poderão visualizar os detalhes da campanha e confirmar a participação diretamente pelo link.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-950">Link do convite</label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
            <div className="flex-1 min-w-0">
              <Input value={campaignUrl} readOnly />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyLink}
              className="shrink-0 w-full sm:w-auto"
            >
              <span className="flex items-center justify-center gap-2">
                <Icon
                  name={copied ? "Check" : "Copy"}
                  size={16}
                  color={copied ? "#10B981" : "#404040"}
                />
                {copied ? "Copiado!" : "Copiar"}
              </span>
            </Button>
          </div>
        </div>

        {canNativeShare && (
          <Button
            type="button"
            onClick={handleNativeShare}
            className="w-full"
          >
            <span className="flex items-center justify-center gap-2">
              <Icon name="Share2" size={16} color="#fff" />
              Compartilhar…
            </span>
          </Button>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-950">
              {canNativeShare ? "Ou compartilhar em" : "Compartilhar em"}
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {shareChannels.map((ch) => (
              <Button
                key={ch.key}
                type="button"
                variant="outline"
                onClick={ch.onClick}
                className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 h-auto min-h-12 py-2.5 px-2 sm:px-3 w-full min-w-full"
              >
                <Icon name={ch.icon} size={20} color={ch.color} className="shrink-0" />
                <span className="font-medium text-xs sm:text-sm text-center leading-tight">
                  {ch.label}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
