import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { ConversationRow } from "@/components/message-center/conversation-row";
import { FilterRow, ListSearch, ListSkeleton, StateBlock, type ListFilter } from "@/components/message-center/list-parts";
import { Av } from "@/components/prototype/ui";
import { useNotifications } from "@/hooks/use-notifications";
import { useWorkspaceQueryKey, withWorkspaceKey } from "@/hooks/use-workspace-query-key";
import { getCampaignUsers } from "@/shared/services/campaign-users";
import { fmtTime } from "@/shared/utils/chat-time";

import { CreatorThread } from "./creator-thread";
import { buildConversations, type Conversation, type OpenChatRequest } from "./creators-conversations";

interface CreatorsChatTabProps {
  /** Título e abas da gaveta, que ficam no topo da coluna da lista. */
  top: ReactNode;
  /** Pedido de `openChatDrawer`: abre a conversa do criador (mesmo objeto = mesmo pedido). */
  request: OpenChatRequest | null;
  /** Conversa aberta por pedido, guardada pela gaveta (sobrevive a fechar a gaveta e a trocar de aba). */
  extra: Conversation | null;
  onExtraChange: (conversation: Conversation) => void;
  /** Avisa a gaveta quando há conversa aberta (no celular a conversa ocupa a tela). */
  onThreadChange: (open: boolean) => void;
  onRequestClose: () => void;
}

/**
 * Aba Criadores da gaveta (protótipo `chHTML`): lista derivada das notificações `new_message`; mensagens e envio
 * reais por `useInfluencerMessages`/`useSendMessage` dentro da conversa.
 */
export function CreatorsChatTab({ top, request, extra, onExtraChange, onThreadChange, onRequestClose }: CreatorsChatTabProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const navigate = useNavigate();
  const { data: notifications = [], isLoading: loadingNotifications } = useNotifications();

  // Pedido de abertura (botão "Chat" de um criador na campanha): entra na lista mesmo sem notificação.
  useLayoutEffect(() => {
    if (!request) return;
    const id = `${request.campaignId}:${request.influencerId}`;
    onExtraChange({
      id,
      campaignId: request.campaignId,
      influencerId: request.influencerId,
      name: request.name,
      avatar: request.avatar,
      campaign: request.campaign ?? "",
      preview: "",
      unread: 0,
      at: new Date().toISOString(),
    });
    setSel(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const workspaceId = useWorkspaceQueryKey();
  const campaignIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of buildConversations(notifications)) ids.add(c.campaignId);
    return [...ids];
  }, [notifications]);
  const usersByCampaign = useQueries({
    queries: campaignIds.map((id) => ({
      queryKey: withWorkspaceKey(["campaigns", id, "users"], workspaceId),
      queryFn: () => getCampaignUsers(id),
      enabled: !!workspaceId,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const avatars = useMemo(() => {
    const map = new Map<string, string>();
    campaignIds.forEach((cid, i) => {
      for (const u of usersByCampaign[i]?.data ?? []) {
        if (u.user_id != null && u.avatar) map.set(`${cid}:${u.user_id}`, u.avatar);
      }
    });
    return map;
  }, [campaignIds, usersByCampaign]);

  const convs = useMemo(() => {
    const base = buildConversations(notifications);
    const withAv = (c: Conversation) => ({ ...c, avatar: c.avatar || avatars.get(c.id) });
    if (extra && !base.some((c) => c.id === extra.id)) return [extra, ...base].map(withAv);
    return base.map(withAv);
  }, [notifications, extra, avatars]);

  const current = convs.find((c) => c.id === sel) ?? null;
  useLayoutEffect(() => {
    onThreadChange(!!current);
  }, [current, onThreadChange]);

  const needle = q.trim().toLowerCase();
  const list = convs.filter(
    (c) =>
      (filter === "all" || c.unread > 0) &&
      (!needle || c.name.toLowerCase().includes(needle) || c.campaign.toLowerCase().includes(needle)),
  );

  const openCampaign = (c: Conversation) => {
    navigate({
      to: "/campaigns/$campaignId",
      params: { campaignId: c.campaignId },
      search: { tab: "management", openChat: c.influencerId },
    });
    onRequestClose();
  };

  const emptyAll = convs.length === 0;
  const unreadCount = convs.filter((c) => c.unread > 0).length;
  const goCampaigns = () => {
    navigate({ to: "/campaigns" });
    onRequestClose();
  };

  let body;
  if (loadingNotifications && emptyAll) {
    body = <ListSkeleton label="Carregando conversas..." />;
  } else if (emptyAll) {
    body = (
      <StateBlock
        icon="msg"
        title="Nenhuma conversa com criadores ainda"
        text="As conversas começam em Gerenciamento da campanha, ao abrir o chat de um criador."
        action={{ label: "Ir para as campanhas", icon: "mega", onClick: goCampaigns }}
      />
    );
  } else if (list.length === 0) {
    body =
      filter === "un" && !needle ? (
        <StateBlock
          icon="check"
          title="Nenhuma conversa não lida"
          text="Você está em dia com os criadores."
          action={{ label: "Ver todas as conversas", onClick: () => setFilter("all") }}
        />
      ) : (
        <StateBlock
          icon="search"
          title="Nenhuma conversa encontrada"
          text={needle ? `Nada com “${q.trim()}”. Tente outro nome ou campanha.` : "Tente outro filtro."}
          action={{ label: needle ? "Limpar busca" : "Ver todas as conversas", onClick: () => (needle ? setQ("") : setFilter("all")) }}
        />
      );
  } else {
    body = (
      <ul className="mc-ul" role="list" aria-label="Conversas com criadores">
        {list.map((c, i) => (
          <li key={c.id}>
            <ConversationRow
              index={i}
              selected={sel === c.id}
              unread={c.unread}
              avatar={<Av name={c.name} src={c.avatar} size={44} />}
              title={c.name}
              time={fmtTime(c.at)}
              preview={c.preview}
              tag={c.campaign || undefined}
              onSelect={() => setSel(c.id)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <div className="mc-list">
        {top}
        <ListSearch value={q} onChange={setQ} placeholder="Buscar criador ou campanha" />
        <FilterRow filter={filter} onFilter={setFilter} unread={unreadCount} />
        <div className="mc-items">{body}</div>
      </div>
      <div className="mc-thread">
        {current ? (
          <CreatorThread key={current.id} conv={current} onBack={() => setSel(null)} onOpenCampaign={() => openCampaign(current)} />
        ) : (
          <StateBlock
            fill
            icon="msg"
            title="Nenhuma conversa selecionada"
            text="Escolha uma conversa na lista para falar com o criador. Para começar uma nova, abra o chat dele em Gerenciamento da campanha."
          />
        )}
      </div>
    </>
  );
}
