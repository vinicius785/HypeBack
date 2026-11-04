import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import {
  TEAM_CHAT_MAX_ATTACHMENTS,
  TEAM_CHAT_MAX_BODY,
  TEAM_CHAT_MAX_FILE_BYTES,
  uploadTeamChatAttachment,
  type TeamChatAttachment,
} from "@/shared/services/team-chat";

import { formatFileSize, isImageMime } from "./format";

interface DraftAttachment {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  attachment?: TeamChatAttachment;
  /** Miniatura local (imagem) enquanto sobe; liberada ao remover ou enviar. */
  previewUrl?: string;
}

interface ComposerProps {
  conversationId: string;
  /** Motivo de a escrita estar barrada (workspace arquivado/suspenso/excluído); `null` = livre. */
  blockedReason: string | null;
  onSend: (input: { body: string; attachments: TeamChatAttachment[] }) => void;
}

let draftCounter = 0;

function makePreview(file: File): string | undefined {
  if (!isImageMime(file.type) || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return undefined;
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

function revoke(url?: string) {
  if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
}

/** Campo de texto (Enter envia, Shift+Enter quebra linha) com anexos que sobem assim que são escolhidos. */
export function Composer({ conversationId, blockedReason, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<DraftAttachment[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const disabled = blockedReason !== null;

  // Foco no campo ao abrir a conversa.
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  // Sair da conversa solta as miniaturas locais.
  useEffect(
    () => () => {
      for (const d of draftsRef.current) revoke(d.previewUrl);
    },
    [],
  );

  const resize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const uploading = drafts.some((d) => d.status === "uploading");
  const ready = drafts.filter((d) => d.status === "done" && d.attachment);
  const canSend = !disabled && !uploading && (text.trim() !== "" || ready.length > 0);

  const submit = () => {
    if (!canSend) return;
    onSend({ body: text.trim(), attachments: ready.map((d) => d.attachment as TeamChatAttachment) });
    for (const d of drafts) revoke(d.previewUrl);
    setDrafts([]);
    setText("");
    requestAnimationFrame(() => {
      resize();
      inputRef.current?.focus();
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    submit();
  };

  const addFiles = (files: FileList | null) => {
    if (!files || disabled) return;
    const room = TEAM_CHAT_MAX_ATTACHMENTS - draftsRef.current.length;
    const picked = Array.from(files);
    if (picked.length > room) toast.error(`Você pode anexar até ${TEAM_CHAT_MAX_ATTACHMENTS} arquivos por mensagem.`);
    for (const file of picked.slice(0, Math.max(0, room))) {
      if (file.size > TEAM_CHAT_MAX_FILE_BYTES) {
        toast.error(`${file.name} passa de ${formatFileSize(TEAM_CHAT_MAX_FILE_BYTES)}.`);
        continue;
      }
      const id = `d${++draftCounter}`;
      setDrafts((cur) => [...cur, { id, name: file.name, size: file.size, status: "uploading", previewUrl: makePreview(file) }]);
      uploadTeamChatAttachment(conversationId, file)
        .then((attachment) =>
          setDrafts((cur) => cur.map((d) => (d.id === id ? { ...d, status: "done", attachment } : d))),
        )
        .catch((error: unknown) => {
          setDrafts((cur) => cur.map((d) => (d.id === id ? { ...d, status: "error" } : d)));
          toast.error(error instanceof Error && error.message ? error.message : "Não foi possível enviar o anexo.");
        });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeDraft = (id: string) => {
    const d = draftsRef.current.find((x) => x.id === id);
    revoke(d?.previewUrl);
    setDrafts((cur) => cur.filter((x) => x.id !== id));
  };

  const nearLimit = text.length >= TEAM_CHAT_MAX_BODY * 0.9;

  return (
    <div className="ch-f tc-f">
      {blockedReason && (
        <p className="tc-block" role="status">
          <I n="lock" cls="sm" />
          {blockedReason}
        </p>
      )}
      {drafts.length > 0 && (
        <ul className="tc-drafts" role="list" aria-label="Anexos da mensagem">
          {drafts.map((d) => (
            <li key={d.id} className={`tc-draft ${d.status}`}>
              {d.previewUrl ? <img src={d.previewUrl} alt="" /> : <I n="file" cls="sm" />}
              <span>
                <b>{d.name}</b>
                <small>
                  {d.status === "uploading" ? "Enviando..." : d.status === "error" ? "Falhou" : formatFileSize(d.size)}
                </small>
              </span>
              <button type="button" onClick={() => removeDraft(d.id)} aria-label={`Remover ${d.name}`}>
                <I n="x" cls="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="tc-in">
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/x-msvideo,application/pdf,.doc,.docx"
          onChange={(e) => addFiles(e.target.files)}
          data-testid="team-chat-file"
        />
        <button
          type="button"
          className="round tc-clip"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || drafts.length >= TEAM_CHAT_MAX_ATTACHMENTS}
          aria-label="Anexar arquivo"
        >
          <I n="paperclip" cls="sm" />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          maxLength={TEAM_CHAT_MAX_BODY}
          placeholder={disabled ? "Envio indisponível" : "Escreva uma mensagem"}
          aria-label="Mensagem"
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="ch-send" onClick={submit} aria-label="Enviar mensagem" disabled={!canSend}>
          <I n="send" cls="sm" />
        </button>
      </div>
      {nearLimit && (
        <small className="tc-count" aria-live="polite">
          {text.length}/{TEAM_CHAT_MAX_BODY}
        </small>
      )}
    </div>
  );
}
