import { Pencil, Pin, Trash2 } from "lucide-react";

import { AdminActionMenu } from "@/components/admin/platform/admin-action-menu";
import type { ProjectDocument } from "@/shared/services/agency-projects";

import { DOCUMENT_SOURCE_ICON, DOCUMENT_SOURCE_LABEL, detectDocumentSource, documentNameFromUrl, safeHttpUrl } from "../project-ui";

interface DocumentRowProps {
  document: ProjectDocument;
  canWrite: boolean;
  /** Gravando este item (fixar): os controles ficam desabilitados. */
  pending: boolean;
  onTogglePin: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** Um link do projeto: ícone e tipo pela URL, nome que abre em outra aba, fixar e o menu Editar/Remover. */
export function DocumentRow({ document, canWrite, pending, onTogglePin, onEdit, onRemove }: DocumentRowProps) {
  const source = detectDocumentSource(document.url);
  const Icon = DOCUMENT_SOURCE_ICON[source];

  return (
    <li className="apj-dc-row" data-source={source}>
      <span className="apj-dc-ico" aria-hidden="true">
        <Icon className="ico" />
      </span>
      <div className="apj-dc-tx">
        <a href={safeHttpUrl(document.url)} target="_blank" rel="noopener noreferrer" title={document.url}>
          {document.name}
          <span className="sr-only"> (abre em outra aba)</span>
        </a>
        <small>
          {DOCUMENT_SOURCE_LABEL[source]} · {documentNameFromUrl(document.url)}
        </small>
      </div>
      {canWrite ? (
        <>
          <button
            type="button"
            className={`apj-dc-pin${document.pinned ? " on" : ""}`}
            aria-pressed={document.pinned}
            aria-label={document.pinned ? `Desafixar ${document.name}` : `Fixar ${document.name}`}
            title={document.pinned ? "Desafixar" : "Fixar no alto"}
            disabled={pending}
            onClick={onTogglePin}
          >
            <Pin className="ico sm" aria-hidden />
          </button>
          <AdminActionMenu
            iconOnly
            variant="ghost"
            ariaLabel={`Mais ações de ${document.name}`}
            items={[
              { id: "edit", label: "Editar", icon: <Pencil className="ico sm" aria-hidden />, onSelect: onEdit },
              { id: "remove", label: "Remover", icon: <Trash2 className="ico sm" aria-hidden />, tone: "danger", onSelect: onRemove },
            ]}
          />
        </>
      ) : document.pinned ? (
        <span className="apj-dc-pin on static" title="Fixado">
          <Pin className="ico sm" aria-hidden />
          <span className="sr-only">Fixado</span>
        </span>
      ) : null}
    </li>
  );
}
