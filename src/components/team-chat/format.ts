import { ROLE_LABEL } from "@/components/workspace-settings/constants";
import type { WorkspaceRole } from "@/shared/types";
import type { TeamChatAttachment, TeamChatConversation } from "@/shared/services/team-chat";

export function isImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("image/");
}

/** "1,2 MB", "340 KB", "12 B" — como a pessoa lê o tamanho de um anexo. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0).replace(".", ",")} MB`;
}

/** Texto de uma mensagem/anexo para prévias: o corpo, ou o que foi anexado quando não há texto. */
export function attachmentSummary(attachments: Pick<TeamChatAttachment, "mime_type">[]): string {
  if (attachments.length === 0) return "";
  const images = attachments.filter((a) => isImageMime(a.mime_type)).length;
  if (images === attachments.length) return images === 1 ? "Imagem" : `${images} imagens`;
  return attachments.length === 1 ? "Anexo" : `${attachments.length} anexos`;
}

/** Prévia da lista: no canal leva o nome de quem falou; no 1 a 1 só marca as minhas ("Você: "). */
export function conversationPreview(conversation: TeamChatConversation, me: number | null): string {
  const last = conversation.last_message;
  if (!last) return conversation.kind === "channel" ? "Converse com toda a equipe" : "Nenhuma mensagem ainda";
  const text = last.body.trim() || (last.has_attachments ? "Anexo" : "");
  const mine = me != null && last.sender_id === me;
  if (mine) return `Você: ${text}`;
  if (conversation.kind === "channel") return `${last.sender_name.split(/\s+/)[0] || "Alguém"}: ${text}`;
  return text;
}

export function roleLabel(role: string): string {
  // `custom` (permissões personalizadas) vem da API mas não está em `WorkspaceRole`.
  return ROLE_LABEL[role as WorkspaceRole] ?? (role === "custom" ? "Personalizado" : role);
}
