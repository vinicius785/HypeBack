import { useId, useState } from "react";
import { toast } from "sonner";

import { AdminDialog } from "@/components/admin/platform/admin-dialog";
import { useCreateProjectDocument, useUpdateProjectDocument } from "@/hooks/use-agency-projects";
import {
  AGENCY_PROJECT_LIMITS,
  PROJECT_DOCUMENT_CATEGORIES,
  agencyProjectErrorMessage,
  type ProjectDocument,
  type ProjectDocumentCategory,
} from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { DOCUMENT_CATEGORY_LABEL, documentNameFromUrl, normalizeDocumentUrl } from "../project-ui";

import "@/styles/agency-projects.css";

interface DocumentFormProps {
  projectId: string;
  /** Sem `document`: adicionar. Com: editar. */
  document?: ProjectDocument;
  onClose: () => void;
}

/**
 * Adicionar ou editar um link do projeto: endereço (http/https; sem esquema vira https), nome (vazio usa o domínio) e
 * categoria. Fechar com alterações pede confirmação de descarte.
 */
export function DocumentForm({ projectId, document, onClose }: DocumentFormProps) {
  const editing = !!document;
  const [url, setUrl] = useState(document?.url ?? "");
  const [name, setName] = useState(document?.name ?? "");
  const [category, setCategory] = useState<ProjectDocumentCategory>(document?.category ?? "outro");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { url: useId(), name: useId(), category: useId() };
  const create = useCreateProjectDocument(projectId);
  const update = useUpdateProjectDocument(projectId);
  const { confirm, dialog } = useProjectConfirm();
  const busy = create.isPending || update.isPending;

  const normalized = normalizeDocumentUrl(url);
  const urlError = tried ? (url.trim() === "" ? "Informe o endereço do link" : normalized ? null : "Use um endereço http ou https válido (ex.: https://docs.google.com/…)") : null;
  const nameError = name.trim().length > AGENCY_PROJECT_LIMITS.documentName ? `O nome passa de ${AGENCY_PROJECT_LIMITS.documentName} caracteres` : null;
  const dirty = url !== (document?.url ?? "") || name !== (document?.name ?? "") || category !== (document?.category ?? "outro");

  const requestClose = async () => {
    if (busy) return;
    if (dirty) {
      const discard = await confirm({
        title: "Descartar as alterações?",
        description: "O que foi preenchido neste link será perdido.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        tone: "danger",
      });
      if (!discard) return;
    }
    onClose();
  };

  const submit = async () => {
    setTried(true);
    setError(null);
    if (!normalized || nameError) return;
    const input = { url: normalized, name: name.trim() || documentNameFromUrl(normalized), category };
    try {
      if (document) await update.mutateAsync({ documentId: document.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? "Link atualizado" : "Link adicionado");
      onClose();
    } catch (e) {
      setError(agencyProjectErrorMessage(e, "Não foi possível salvar o link."));
    }
  };

  return (
    <>
      <AdminDialog
        open
        title={editing ? "Editar link" : "Adicionar link"}
        description="Google Docs, Drive, Figma, Miro, Notion, Canva ou qualquer endereço http/https."
        size="md"
        busy={busy}
        dirty={dirty}
        onClose={() => void requestClose()}
        footer={
          <>
            <button type="button" className="btn out" disabled={busy} onClick={() => void requestClose()}>
              Cancelar
            </button>
            <button type="submit" form="apj-doc-form" className="btn" disabled={busy}>
              {busy ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar link"}
            </button>
          </>
        }
      >
        <form
          id="apj-doc-form"
          className="apj-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className={`nf${urlError ? " err" : ""}`}>
            <label htmlFor={ids.url}>Endereço do link</label>
            <input
              id={ids.url}
              className="ni"
              type="url"
              inputMode="url"
              data-adm-autofocus
              maxLength={AGENCY_PROJECT_LIMITS.documentUrl}
              placeholder="https://"
              value={url}
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? `${ids.url}-e` : undefined}
              onChange={(e) => setUrl(e.target.value)}
            />
            {urlError ? (
              <small className="nfe" id={`${ids.url}-e`}>
                {urlError}
              </small>
            ) : null}
          </div>

          <div className={`nf${nameError ? " err" : ""}`}>
            <label htmlFor={ids.name}>
              Nome <em className="apj-opt">· opcional</em>
            </label>
            <input
              id={ids.name}
              className="ni"
              maxLength={AGENCY_PROJECT_LIMITS.documentName + 20}
              placeholder={normalized ? documentNameFromUrl(normalized) : "Ex.: Briefing da campanha"}
              value={name}
              aria-invalid={nameError ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError ? <small className="nfe">{nameError}</small> : null}
          </div>

          <div className="nf">
            <label htmlFor={ids.category}>Categoria</label>
            <select id={ids.category} className="ni apj-select" value={category} onChange={(e) => setCategory(e.target.value as ProjectDocumentCategory)}>
              {PROJECT_DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {DOCUMENT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="apj-err" role="alert">
              {error}
            </div>
          ) : null}
        </form>
      </AdminDialog>
      {dialog}
    </>
  );
}
