import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import type { ContractTemplate } from "@/shared/services/contract";

interface TemplatePreviewModalProps {
  templates: ContractTemplate[];
  onClose: () => void;
}

/**
 * Lista compacta dos templates de contrato cadastrados pela plataforma.
 * Cada item abre a URL do template em uma nova aba via `noopener` — evita
 * tabnabbing e mantém o histórico de visualização no provedor (DocuSign).
 */
export function TemplatePreviewModal({
  templates,
  onClose,
}: TemplatePreviewModalProps) {
  const handleOpen = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener");
  };

  return (
    <Modal
      title="Templates de contrato padrão"
      onClose={onClose}
      panelClassName="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-500">
          Modelos jurídicos disponíveis para envio. Abra para revisar o conteúdo
          antes de selecionar no modal de envio.
        </p>

        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-[28px] bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                  <Icon name="FileText" size={18} color="#7c3aed" />
                </div>
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {t.name}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => handleOpen(t.content)}
                disabled={!t.content}
                className="h-9 px-3 text-xs shrink-0"
                title={
                  t.content
                    ? "Abrir template em nova aba"
                    : "Template sem URL disponível"
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="ExternalLink" size={14} color="#404040" />
                  Abrir
                </span>
              </Button>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-2 border-t border-neutral-100">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
