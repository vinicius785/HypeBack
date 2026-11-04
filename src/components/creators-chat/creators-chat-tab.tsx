import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";

import { Av, I } from "@/components/prototype/ui";
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
  const [filter, setFilter] = useState<"all" | "un">("all");
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();

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

  return (
    <>
      <div className="ch-l">
        {top}
        <label className="find ch-s">
          <I n="search" cls="sm" />
          <input placeholder="Buscar conversa" aria-label="Buscar conversa" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>
        <div className="gtabs ch-f2">
          {([["all", "Todas"], ["un", "Não lidas"]] as const).map(([k, l]) => (
            <button key={k} type="button" className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="ch-ls">
          {emptyAll ? (
            <div className="ov-empty">
              <span><I n="msg" /></span>
              <b>Nenhuma conversa recente</b>
              <small>As conversas começam em Gerenciamento da campanha, ao abrir o chat de um criador.</small>
            </div>
          ) : list.length === 0 ? (
            <div className="ov-empty">
              <span><I n="search" /></span>
              <b>Nada encontrado</b>
              <small>Tente outro nome ou filtro.</small>
            </div>
          ) : (
            list.map((c, i) => (
              <button
                key={c.id}
                style={{ ["--i" as string]: Math.min(i, 8) }}
                type="button"
                className={`ch-c${sel === c.id ? " on" : ""}${c.unread ? " un" : ""}`}
                onClick={() => setSel(c.id)}
              >
                <Av name={c.name} src={c.avatar} size={44} />
                <div>
                  <div className="ch-nr">
                    <b>{c.name}</b>
                    {c.campaign && (
                      <span className="ch-tg" style={{ ["--c" as string]: "#9e2cfa" }}>
                        <i />
                        {c.campaign}
                      </span>
                    )}
                  </div>
                  <small>{c.preview}</small>
                </div>
                <span className="ch-m">
                  <em>{fmtTime(c.at)}</em>
                  {c.unread > 0 && <i>{c.unread}</i>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="ch-r">
        {current ? (
          <CreatorThread key={current.id} conv={current} onBack={() => setSel(null)} onOpenCampaign={() => openCampaign(current)} />
        ) : (
          <div className="ov-empty big">
            <span><I n="msg" /></span>
            <b>Selecione uma conversa</b>
            <small>Converse com os criadores das suas campanhas.</small>
          </div>
        )}
      </div>
    </>
  );
}
