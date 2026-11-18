import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Av, I } from "@/components/prototype/ui";
import { useModalBehavior } from "@/hooks/admin/use-modal-behavior";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ROSTER_CHAT_POLL_MS, rosterErrorMessage, useRosterChat, useRosterChatMutations } from "@/hooks/use-agency-roster";
import { getUploadUrl } from "@/lib/utils/api";
import type { RosterChatAttachment, RosterChatMessage, RosterMember } from "@/shared/services/agency-roster";

import "@/styles/agency-roster.css";

const TEXT_MAX = 2000;

const mediaUrl = (url: string): string => (url.startsWith("/") ? (getUploadUrl(url) ?? url) : url);
const timeOf = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const attachmentOf = (item: string | RosterChatAttachment, index: number): { url: string; name: string } =>
  typeof item === "string" ? { url: item, name: `Documento ${index + 1}` } : { url: item.url, name: item.name || `Documento ${index + 1}` };

function Bubble({ message, own, onDelete, busy }: { message: RosterChatMessage; own: boolean; onDelete: () => void; busy: boolean }) {
  const files = (message.attachments ?? []).map(attachmentOf);
  return (
    <li className="rsc-m" data-own={own || undefined}>
      <div className="rsc-b">
        {message.image_url ? (
          <a href={mediaUrl(message.image_url)} target="_blank" rel="noopener noreferrer" aria-label="Abrir foto">
            <img src={mediaUrl(message.image_url)} alt="Foto enviada" loading="lazy" />
          </a>
        ) : null}
        {message.video_url ? <video src={mediaUrl(message.video_url)} poster={message.video_thumbnail_url ? mediaUrl(message.video_thumbnail_url) : undefined} controls preload="metadata" aria-label="Vídeo enviado" /> : null}
        {files.map((file) => (
          <a key={file.url} className="rsc-f" href={mediaUrl(file.url)} target="_blank" rel="noopener noreferrer">
            <I n="file" cls="sm" />
            {file.name}
          </a>
        ))}
        {message.text ? <p>{message.text}</p> : null}
      </div>
      <small>
        {own ? "Você" : message.author.name} · {timeOf(message.created_at)}
        {own ? (
          <button type="button" className="rsc-x" disabled={busy} onClick={onDelete} aria-label="Apagar mensagem">
            Apagar
          </button>
        ) : null}
      </small>
    </li>
  );
}

/**
 * Conversa da agência com um criador do elenco (`/agency/roster/:id/chat/messages`): ler e enviar texto, e apagar a própria
 * mensagem. Sem tempo real: enquanto a tela está aberta, consulta a cada ~8 s. Foto, vídeo e PDF aparecem para ler; o envio
 * deles espera uma rota de upload da API para o painel.
 */
export function RosterChatDialog({ member, canWrite, onClose }: { member: RosterMember; canWrite: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const feedRef = useRef<HTMLUListElement>(null);
  const titleId = useId();
  const query = useRosterChat(member.id);
  const { send, remove } = useRosterChatMutations(member.id);
  const { user } = useCurrentUser();
  const [draft, setDraft] = useState("");
  const me = user ? String(user.id) : null;
  const c = member.creator;

  useModalBehavior({ open: true, containerRef: dialogRef, onEscape: onClose });

  // A API devolve da mais nova para a mais antiga; a conversa lê de cima para baixo, com a última embaixo.
  const messages = useMemo(() => [...(query.data ?? [])].reverse(), [query.data]);
  useEffect(() => {
    feedRef.current?.scrollTo?.({ top: feedRef.current.scrollHeight });
  }, [messages.length]);

  const text = draft.trim();
  const submit = () => {
    if (!text || send.isPending) return;
    send.mutate(
      { text },
      {
        onSuccess: () => setDraft(""),
        onError: (failure) => toast.error(rosterErrorMessage(failure, "Não foi possível enviar a mensagem.")),
      },
    );
  };

  return createPortal(
    <div className="pv">
      <div className="ovb on" aria-hidden="true" onClick={onClose} />
      <div className="ovw">
        <section ref={dialogRef} className="ovd on rsc" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
          <div className="sh-h cm-h rsc-h">
            <span className="rsc-who">
              <Av name={c.name} src={c.photo ?? undefined} size={44} />
              <span>
                <small>Conversa com o criador</small>
                <h2 id={titleId}>{c.name}</h2>
              </span>
            </span>
            <button type="button" className="round" onClick={onClose} aria-label="Fechar">
              <I n="x" cls="sm" />
            </button>
          </div>

          {query.isLoading ? (
            <p className="rsc-st" role="status">
              Carregando a conversa…
            </p>
          ) : query.error && !query.data ? (
            <div className="rsc-st" role="alert">
              <p>{rosterErrorMessage(query.error, "Não foi possível carregar a conversa.")}</p>
              <button type="button" className="btn out" onClick={() => void query.refetch()}>
                Tentar de novo
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="rsc-st">
              <b>Nenhuma mensagem ainda</b>
              <p>Escreva abaixo para começar a conversa com {c.name}.</p>
            </div>
          ) : (
            <ul className="rsc-feed" ref={feedRef} aria-label="Mensagens" aria-live="polite">
              {messages.map((message) => (
                <Bubble
                  key={message.id}
                  message={message}
                  own={me !== null && message.author.id === me}
                  busy={remove.isPending}
                  onDelete={() => remove.mutate(message.id, { onError: (failure) => toast.error(rosterErrorMessage(failure, "Não foi possível apagar a mensagem.")) })}
                />
              ))}
            </ul>
          )}

          {canWrite ? (
            <form
              className="rsc-c"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <textarea
                rows={1}
                maxLength={TEXT_MAX}
                value={draft}
                aria-label={`Mensagem para ${c.name}`}
                placeholder="Escreva uma mensagem…"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <button type="submit" className="btn" disabled={!text || send.isPending} aria-label="Enviar mensagem">
                <I n="send" cls="sm" />
              </button>
            </form>
          ) : (
            <p className="rsc-ro">Só quem gerencia o elenco envia mensagens.</p>
          )}
          <small className="rsc-poll" aria-hidden="true">
            Atualiza sozinha a cada {ROSTER_CHAT_POLL_MS / 1000} segundos.
          </small>
        </section>
      </div>
    </div>,
    document.body,
  );
}
