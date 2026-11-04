import { createContext, useContext, type ReactNode } from "react";

import { useTeamChat, type TeamChatController } from "@/hooks/use-team-chat";
import { useTeamChatEnabled, useTeamChatUnread } from "@/hooks/use-team-chat-queries";

const TeamChatContext = createContext<TeamChatController | null>(null);

/**
 * Mantém o socket do chat da equipe vivo no layout do app, acima das páginas. O botão de chat do cabeçalho é
 * desmontado e montado de novo ao entrar/sair do detalhe da campanha (cada tela traz o próprio topo); com o socket
 * aqui a conexão, o "visto" e o aviso em tempo real não caem nessa troca. Precisa estar dentro do
 * `WorkspaceProvider` e do `QueryClientProvider`.
 */
export function TeamChatProvider({ children }: { children: ReactNode }) {
  const enabled = useTeamChatEnabled();
  const unread = useTeamChatUnread(enabled);
  const chat = useTeamChat({ enabled: enabled && !unread.unavailable });
  return <TeamChatContext.Provider value={chat}>{children}</TeamChatContext.Provider>;
}

/** Controlador do socket compartilhado, ou `null` fora do provedor (quem consome liga o próprio socket). */
export function useSharedTeamChat(): TeamChatController | null {
  return useContext(TeamChatContext);
}
