import { useRef, useState } from "react";

import { formatFileSize } from "@/components/team-chat/format";
import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import { AGENCY_PROJECT_LIMITS, TASK_ATTACHMENT_ACCEPT, agencyProjectErrorMessage, type TaskAttachment } from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { formatDateTime } from "../project-ui";
import { SectionSkeleton, TaskSection } from "./task-section";
import { validateAttachment } from "./task-logic";

const MAX_MB = Math.round(AGENCY_PROJECT_LIMITS.attachmentBytes / 1024 / 1024);

interface AttachmentsSectionProps {
  /** `undefined` enquanto o detalhe da tarefa carrega. */
  attachments: readonly TaskAttachment[] | undefined;
  canWrite: boolean;
  onUpload: (file: File) => Promise<unknown>;
  onRemove: (attachment: TaskAttachment) => Promise<unknown>;
}

/** Anexos: enviar (até 10, com o limite de tamanho do chat da equipe), abrir e remover (com confirmação). */
export function AttachmentsSection({ attachments, canWrite, onUpload, onRemove }: AttachmentsSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const { confirm, dialog } = useProjectConfirm();
  const count = attachments?.length ?? 0;
  const atLimit = count >= AGENCY_PROJECT_LIMITS.taskAttachments;

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const problems: string[] = [];
    let sent = 0;
    for (const file of Array.from(files)) {
      const invalid = validateAttachment(file, count + sent);
      if (invalid) {
        problems.push(invalid);
        // No limite, o resto da seleção também não cabe: não adianta repetir o mesmo aviso para cada arquivo.
        if (count + sent >= AGENCY_PROJECT_LIMITS.taskAttachments) break;
        continue;
      }
      setUploading(file.name);
      try {
        await onUpload(file);
        sent += 1;
      } catch (e) {
        problems.push(`${file.name}: ${agencyProjectErrorMessage(e, "não foi possível enviar.")}`);
      }
    }
    setUploading(null);
    setErrors(problems);
  };

  const remove = async (attachment: TaskAttachment) => {
    const ok = await confirm({
      title: "Remover anexo?",
      description: `“${attachment.name}” será apagado da tarefa.`,
      confirmLabel: "Remover anexo",
      tone: "danger",
    });
    if (!ok) return;
    setRemoving(attachment.id);
    setErrors([]);
    try {
      await onRemove(attachment);
    } catch (e) {
      setErrors([agencyProjectErrorMessage(e, "Não foi possível remover o anexo.")]);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <TaskSection
      title="Anexos"
      collapsible
      count={attachments ? `${count}/${AGENCY_PROJECT_LIMITS.taskAttachments}` : undefined}
      action={
        canWrite ? (
          <button type="button" className="apj-link" disabled={!!uploading || atLimit} onClick={() => fileRef.current?.click()}>
            + Adicionar
          </button>
        ) : null
      }
    >
      {!attachments ? (
        <SectionSkeleton label="Carregando anexos" />
      ) : (
        <>
          {count === 0 ? <p className="apj-tm-none">Nenhum anexo.</p> : null}
          <ul className="apj-tm-list" role="list">
            {attachments.map((a) => (
              <li key={a.id} className="apj-tm-row">
                <span className="apj-tm-ico" aria-hidden="true">
                  <I n={a.mime_type.startsWith("image/") ? "image" : "paperclip"} cls="sm" />
                </span>
                <a className="apj-tm-rowt" href={getUploadUrl(a.url)} target="_blank" rel="noopener noreferrer">
                  {a.name}
                </a>
                <small>{[formatFileSize(a.size), formatDateTime(a.created_at)].filter(Boolean).join(" · ")}</small>
                {canWrite ? (
                  <button type="button" className="apj-tm-x" aria-label={`Remover anexo ${a.name}`} disabled={removing === a.id} onClick={() => void remove(a)}>
                    <I n="trash" cls="sm" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div
              className="apj-dz"
              data-over={over || undefined}
              onDragOver={(e) => {
                if (atLimit || uploading) return;
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                if (!atLimit && !uploading) void pick(e.dataTransfer.files);
              }}
            >
              <I n="paperclip" cls="sm" />
              <span>
                Arraste arquivos ou{" "}
                <button type="button" className="apj-link" disabled={!!uploading || atLimit} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Enviando…" : "Anexar arquivo"}
                </button>
              </span>
              <input
                ref={fileRef}
                type="file"
                accept={TASK_ATTACHMENT_ACCEPT}
                multiple
                hidden
                aria-label="Arquivos para anexar"
                onChange={(e) => {
                  void pick(e.target.files);
                  e.target.value = "";
                }}
              />
              <small className="nfh" role="status">
                {uploading ? `Enviando ${uploading}…` : atLimit ? `Limite de ${AGENCY_PROJECT_LIMITS.taskAttachments} anexos por tarefa.` : `Até ${MAX_MB} MB por arquivo.`}
              </small>
            </div>
          ) : null}
          {errors.length > 0 ? (
            <div className="apj-err" role="alert">
              {errors.map((message) => (
                <div key={message}>{message}</div>
              ))}
            </div>
          ) : null}
        </>
      )}
      {dialog}
    </TaskSection>
  );
}
