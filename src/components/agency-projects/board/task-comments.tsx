import { useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Av, I } from "@/components/prototype/ui";
import { AGENCY_PROJECT_LIMITS, agencyProjectErrorMessage, type TaskComment, type TaskEvent } from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { formatDateTime } from "../project-ui";
import { SectionSkeleton, TaskSection } from "./task-section";
import { describeEvent, sortComments, sortEvents, validateComment } from "./task-logic";

interface CommentsSectionProps {
  /** `undefined` enquanto o detalhe da tarefa carrega. */
  comments: readonly TaskComment[] | undefined;
  canWrite: boolean;
  /** O comentário pode ser apagado por quem está vendo (o autor ou quem tem `campaigns_delete`). */
  canRemove: (comment: TaskComment) => boolean;
  onAdd: (body: string) => Promise<unknown>;
  onRemove: (comment: TaskComment) => Promise<unknown>;
  /** Onde o campo de novo comentário é desenhado (rodapé fixo do painel). Sem isso, fica no fim da lista. */
  composerHost?: HTMLElement | null;
}

/** Comentários em ordem de conversa (mais antigo no alto) e o campo de novo comentário; Ctrl/Cmd + Enter envia. */
export function CommentsSection({ comments, canWrite, canRemove, onAdd, onRemove, composerHost }: CommentsSectionProps) {
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const { confirm, dialog } = useProjectConfirm();

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const problem = validateComment(body);
    setFieldError(problem);
    if (problem) return;
    setSending(true);
    setError(null);
    try {
      await onAdd(body.trim());
      setBody("");
    } catch (e) {
      setError(agencyProjectErrorMessage(e, "Não foi possível enviar o comentário."));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: TaskComment) => {
    const ok = await confirm({ title: "Excluir comentário?", description: "O comentário será apagado da tarefa.", confirmLabel: "Excluir comentário", tone: "danger" });
    if (!ok) return;
    setRemoving(comment.id);
    setError(null);
    try {
      await onRemove(comment);
    } catch (e) {
      setError(agencyProjectErrorMessage(e, "Não foi possível excluir o comentário."));
    } finally {
      setRemoving(null);
    }
  };

  const composer: ReactNode = (
<form className="apj-tm-new" onSubmit={(e) => void submit(e)} noValidate>
              <textarea
                className="ni ta"
                rows={3}
                aria-label="Novo comentário"
                aria-invalid={fieldError ? true : undefined}
                maxLength={AGENCY_PROJECT_LIMITS.comment}
                placeholder="Escreva um comentário (Ctrl + Enter envia)"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setFieldError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <div className="apj-tm-newf">
                <small className="nfh">
                  {body.length}/{AGENCY_PROJECT_LIMITS.comment}
                </small>
                <button type="submit" className="btn" disabled={sending}>
                  {sending ? "Enviando…" : "Comentar"}
                </button>
              </div>
            </form>
  );

  return (
    <TaskSection title="Comentários" count={comments?.length}>
      {!comments ? (
        <SectionSkeleton label="Carregando comentários" />
      ) : (
        <>
          {comments.length === 0 ? <p className="apj-tm-none">Nenhum comentário ainda.</p> : null}
          <ul className="apj-tm-comments" role="list">
            {sortComments(comments).map((c) => (
              <li key={c.id} className="apj-tm-comment">
                <Av name={c.author.name} src={c.author.avatar ?? undefined} size={28} />
                <div>
                  <p className="apj-tm-cm">
                    <b>{c.author.name}</b>
                    <time dateTime={c.created_at}>{formatDateTime(c.created_at)}</time>
                  </p>
                  <p className="apj-tm-cb">{c.body}</p>
                </div>
                {canRemove(c) ? (
                  <button type="button" className="apj-tm-x" aria-label={`Excluir comentário de ${c.author.name}`} disabled={removing === c.id} onClick={() => void remove(c)}>
                    <I n="trash" cls="sm" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canWrite ? (composerHost ? createPortal(composer, composerHost) : composer) : null}
          {fieldError ? (
            <small className="nfe" role="alert">
              {fieldError}
            </small>
          ) : null}
          {error ? (
            <div className="apj-err" role="alert">
              {error}
            </div>
          ) : null}
        </>
      )}
      {dialog}
    </TaskSection>
  );
}

const ACTIVITY_PREVIEW = 6;

/** Atividade da tarefa (mais recente primeiro) com o texto de cada tipo de evento em português. */
export function ActivitySection({ events }: { events: readonly TaskEvent[] | undefined }) {
  const [all, setAll] = useState(false);
  const sorted = events ? sortEvents(events) : [];
  const shown = all ? sorted : sorted.slice(0, ACTIVITY_PREVIEW);

  return (
    <TaskSection title="Atividade" count={events?.length}>
      {!events ? (
        <SectionSkeleton label="Carregando atividade" />
      ) : sorted.length === 0 ? (
        <p className="apj-tm-none">Nada registrado ainda.</p>
      ) : (
        <>
          <ul className="apj-tm-act" role="list">
            {shown.map((event) => {
              const d = describeEvent(event);
              return (
                <li key={event.id}>
                  <span>
                    <b>{d.actor}</b> {d.action}
                    {d.detail ? ` (${d.detail})` : ""}
                  </span>
                  <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
                </li>
              );
            })}
          </ul>
          {sorted.length > ACTIVITY_PREVIEW ? (
            <button type="button" className="apj-link" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? "Ver menos" : `Ver tudo (${sorted.length})`}
            </button>
          ) : null}
        </>
      )}
    </TaskSection>
  );
}
