import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { AdminDrawer } from "@/components/admin/platform/admin-dialog";
import { I } from "@/components/prototype/ui";
import { useCreateAgencyProject, useUpdateAgencyProject, useUploadAgencyProjectCover } from "@/hooks/use-agency-projects";
import { getUploadUrl } from "@/lib/utils/api";
import {
  AGENCY_PROJECT_LIMITS,
  PROJECT_COVER_ACCEPT,
  PROJECT_STATUSES,
  agencyProjectErrorMessage,
  type Project,
  type ProjectStatus,
} from "@/shared/services/agency-projects";

import { resizeCoverImage } from "./project-cover";
import { useProjectConfirm } from "./project-confirm";
import { PROJECT_STATUS_LABEL, projectInitials } from "./project-ui";

import "@/styles/agency-projects.css";

interface ProjectFormProps {
  /** Sem `project`: criar. Com: editar (aparece o campo de status). */
  project?: Project;
  onClose: () => void;
  /** Projeto gravado (a lista leva ao detalhe do novo projeto). */
  onSaved?: (project: Project, created: boolean) => void;
}

/**
 * Formulário de projeto em painel lateral: nome (obrigatório), descrição (texto simples), capa (escolher ou arrastar; a
 * imagem é reduzida para no máximo 1600x900 JPEG no navegador e enviada antes de gravar) e, só na edição, o status.
 * Fechar com alterações pendentes pede confirmação de descarte.
 */
export function ProjectForm({ project, onClose, onSaved }: ProjectFormProps) {
  const editing = !!project;
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "ativo");
  /** Capa nova, já reduzida; a existente só some/troca quando a pessoa pede. */
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), description: useId(), status: useId() };
  const { confirm, dialog } = useProjectConfirm();

  const create = useCreateAgencyProject();
  const update = useUpdateAgencyProject();
  const uploadCover = useUploadAgencyProjectCover();
  const busy = create.isPending || update.isPending || uploadCover.isPending;

  // Pré-visualização da capa escolhida (liberada ao trocar ou fechar).
  // (Criada e liberada no mesmo efeito: o `useMemo` com `createObjectURL` deixava uma URL sem liberar no modo estrito.)
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!coverFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);
  const existingCover = !removeCover ? getUploadUrl(project?.cover_url) : undefined;
  const shownCover = preview ?? existingCover;

  const dirty =
    name !== (project?.name ?? "") ||
    description !== (project?.description ?? "") ||
    status !== (project?.status ?? "ativo") ||
    !!coverFile ||
    removeCover;

  const requestClose = async () => {
    if (busy) return;
    if (dirty) {
      const discard = await confirm({
        title: "Descartar as alterações?",
        description: "As alterações não salvas neste projeto serão perdidas.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        tone: "danger",
      });
      if (!discard) return;
    }
    onClose();
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!PROJECT_COVER_ACCEPT.split(",").includes(file.type)) {
      setCoverError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    setCoverError(null);
    setPreparing(true);
    try {
      const resized = await resizeCoverImage(file);
      if (resized.size > AGENCY_PROJECT_LIMITS.coverBytes) {
        setCoverError("A imagem passa de 5 MB mesmo reduzida. Escolha outra.");
        return;
      }
      setRemoveCover(false);
      setCoverFile(resized);
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : "Não foi possível ler essa imagem.");
    } finally {
      setPreparing(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!busy) void pickFile(event.dataTransfer.files?.[0]);
  };

  const nameError = tried && !name.trim() ? "Informe o nome do projeto" : undefined;

  const submit = async () => {
    setTried(true);
    setError(null);
    if (!name.trim()) return;
    try {
      let coverUrl: string | null | undefined;
      if (coverFile) coverUrl = (await uploadCover.mutateAsync(coverFile)).url;
      else if (removeCover) coverUrl = null;

      const base = { name: name.trim(), description: description.trim() === "" ? null : description.trim(), ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}) };
      const saved = project
        ? await update.mutateAsync({ projectId: project.id, input: { ...base, status } })
        : await create.mutateAsync(base);
      toast.success(project ? "Projeto atualizado" : "Projeto criado");
      onSaved?.(saved, !project);
      onClose();
    } catch (e) {
      setError(agencyProjectErrorMessage(e, "Não foi possível salvar o projeto."));
    }
  };

  const nameValue = name.trim() || project?.name || "";

  return (
    <>
      <AdminDrawer
        open
        title={editing ? "Editar projeto" : "Novo projeto"}
        description={editing ? "Nome, descrição, capa e status." : "Dê um nome e, se quiser, uma descrição e uma capa. As tarefas vêm depois."}
        size="md"
        busy={busy}
        dirty={dirty}
        onClose={() => void requestClose()}
        footer={
          <>
            <button type="button" className="btn out" disabled={busy} onClick={() => void requestClose()}>
              Cancelar
            </button>
            <button type="submit" form="apj-form" className="btn" disabled={busy || preparing}>
              {busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar projeto"}
            </button>
          </>
        }
      >
        <form
          id="apj-form"
          className="apj-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className={`nf${nameError ? " err" : ""}`}>
            <label htmlFor={ids.name}>Nome do projeto</label>
            <input
              id={ids.name}
              className="ni"
              data-adm-autofocus
              maxLength={AGENCY_PROJECT_LIMITS.projectName}
              placeholder="Ex.: Lançamento coleção verão"
              value={name}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${ids.name}-e` : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError ? (
              <small className="nfe" id={`${ids.name}-e`}>
                {nameError}
              </small>
            ) : null}
          </div>

          <div className="nf">
            <label htmlFor={ids.description}>
              Descrição <em className="apj-opt">· opcional</em>
            </label>
            <textarea
              id={ids.description}
              className="ni ta"
              rows={4}
              maxLength={AGENCY_PROJECT_LIMITS.projectDescription}
              placeholder="Objetivo, escopo e observações para o time"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <small className="nfh apj-count">
              {description.length}/{AGENCY_PROJECT_LIMITS.projectDescription}
            </small>
          </div>

          <div className="nf">
            <span className="apj-lbl" id={`${ids.name}-cover`}>
              Capa <em className="apj-opt">· opcional</em>
            </span>
            <div
              className={`apj-drop${dragging ? " over" : ""}${coverError ? " bad" : ""}`}
              role="group"
              aria-labelledby={`${ids.name}-cover`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="apj-drop-v" aria-hidden={shownCover ? undefined : true}>
                {shownCover ? <img src={shownCover} alt="Capa do projeto" /> : <span>{projectInitials(nameValue) || <I n="image" />}</span>}
              </span>
              <div className="apj-drop-a">
                <button type="button" className="btn out" disabled={busy || preparing} onClick={() => fileRef.current?.click()}>
                  <I n="image" cls="sm" />
                  {preparing ? "Preparando…" : shownCover ? "Trocar capa" : "Escolher capa"}
                </button>
                {shownCover ? (
                  <button
                    type="button"
                    className="apj-link"
                    disabled={busy}
                    onClick={() => {
                      setCoverFile(null);
                      if (project?.cover_url) setRemoveCover(true);
                    }}
                  >
                    Remover capa
                  </button>
                ) : null}
                <small className={`nfh${coverError ? " apj-bad" : ""}`} role={coverError ? "alert" : undefined}>
                  {coverError ?? "Arraste uma imagem aqui ou escolha uma. JPG, PNG ou WebP; ela é reduzida para 1600x900."}
                </small>
              </div>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept={PROJECT_COVER_ACCEPT}
                aria-label="Arquivo da capa"
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {editing ? (
            <div className="nf">
              <label htmlFor={ids.status}>Status</label>
              <select id={ids.status} className="ni apj-select" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <div className="apj-err" role="alert">
              {error}
            </div>
          ) : null}
        </form>
      </AdminDrawer>
      {dialog}
    </>
  );
}
