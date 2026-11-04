import { ChatComposer } from "@/components/chat/composer";
import { TEAM_CHAT_MAX_BODY, uploadTeamChatAttachment, type TeamChatAttachment } from "@/shared/services/team-chat";

interface ComposerProps {
  conversationId: string;
  /** Motivo de a escrita estar barrada (workspace arquivado/suspenso/excluído); `null` = livre. */
  blockedReason: string | null;
  onSend: (input: { body: string; attachments: TeamChatAttachment[] }) => void;
}

/** Campo de envio do chat da equipe: anexos sobem para a conversa. */
export function Composer({ conversationId, blockedReason, onSend }: ComposerProps) {
  return (
    <ChatComposer
      conversationId={conversationId}
      blockedReason={blockedReason}
      onSend={onSend}
      maxBody={TEAM_CHAT_MAX_BODY}
      upload={(file) => uploadTeamChatAttachment(conversationId, file)}
    />
  );
}
