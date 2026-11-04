import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";

import { CreatorsChatTab } from "@/components/creators-chat/creators-chat-tab";
import {
  OPEN_CHAT_EVENT,
  countCreatorsUnread,
  type Conversation as CreatorConversation,
  type OpenChatRequest,
} from "@/components/creators-chat/creators-conversations";
import { I } from "@/components/prototype/ui";
import { installChatSoundUnlock, playMessageSound, useChatSoundPref } from "@/lib/chat-sound";
import { OPEN_TEAM_CHAT_EVENT, type OpenTeamChatRequest } from "@/components/team-chat/open-team-chat";
import { useSharedTeamChat } from "@/components/team-chat/team-chat-provider";
import { TeamChatTab } from "@/components/team-chat/team-chat-tab";
import { useNotifications } from "@/hooks/use-notifications";
import { useTeamChat } from "@/hooks/use-team-chat";
import { useTeamChatEnabled, useTeamChatUnread } from "@/hooks/use-team-chat-queries";

import "@/styles/message-center.css";
import { useWorkspaceQueryKey } from "@/hooks/use-workspace-query-key";

export { openChatDrawer, type OpenChatRequest } from "@/components/creators-chat/creators-conversations";
export { openTeamChat, type OpenTeamChatRequest } from "@/components/team-chat/open-team-chat";

const CLOSE_MS = 300;

type DrawerTab = "creators" | "team";

const TABS: { id: DrawerTab; label: string }[] = [
  { id: "creators", label: "Criadores" },
  { id: "team", label: "Equipe" },
];

/**
 * Botão de chat do topo + gaveta de mensagens (protótipo `chHTML`) com duas abas:
 * Criadores (cliente ↔ criador, por campanha) e Equipe (pessoas do mesmo workspace).
 * O contador do botão soma as duas; o socket da equipe (do `TeamChatProvider`, ou do próprio botão quando não há
 * provedor) fica ligado para o contador e o aviso chegarem com a gaveta fechada.
 */
export function ChatDrawerButton() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("creators");
  const [threadOpen, setThreadOpen] = useState(false);
  // Sentido da troca de aba (para a lista deslizar do lado certo) e som de mensagem recebida (liga/desliga).
  const [swap, setSwap] = useState<"" | "to-team" | "to-creators">("");
  const [soundOn, setSoundOn] = useChatSoundPref();
  const [creatorsRequest, setCreatorsRequest] = useState<OpenChatRequest | null>(null);
  const [teamRequest, setTeamRequest] = useState<OpenTeamChatRequest | null>(null);
  // Conversa aberta pelo botão "Chat" de um criador: fica na lista mesmo sem notificação (como antes das abas).
  const [creatorsExtra, setCreatorsExtra] = useState<CreatorConversation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const notificationsQuery = useNotifications();
  const notifications = notificationsQuery.data ?? [];
  const workspaceId = useWorkspaceQueryKey();
  const creatorsUnread = useMemo(() => countCreatorsUnread(notifications), [notifications]);
  const enabled = useTeamChatEnabled();
  const teamQuery = useTeamChatUnread(enabled);
  // Dentro do layout do app o socket é do `TeamChatProvider` (sobrevive à troca de topo entre as telas); fora dele,
  // o botão liga o próprio.
  const shared = useSharedTeamChat();
  const own = useTeamChat({ enabled: !shared && enabled && !teamQuery.unavailable });
  const chat = shared ?? own;
  const teamUnread = teamQuery.unavailable ? 0 : teamQuery.total;
  const totalUnread = creatorsUnread + teamUnread;

  // Som: o contador de não lidas subiu (mensagem nova, com a gaveta aberta ou fechada). O primeiro valor carregado e a
  // troca de workspace só definem o ponto de partida.
  useEffect(() => installChatSoundUnlock(), []);
  const unreadBase = useRef<{ ws: string | null | undefined; total: number } | null>(null);
  const unreadReady = !notificationsQuery.isLoading && !teamQuery.isLoading;
  useEffect(() => {
    if (!unreadReady) return;
    const base = unreadBase.current;
    if (base && base.ws === workspaceId && totalUnread > base.total) playMessageSound();
    unreadBase.current = { ws: workspaceId, total: totalUnread };
  }, [totalUnread, unreadReady, workspaceId]);

  const requestClose = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setOpen(false);
      setClosing(false);
      setThreadOpen(false);
      setCreatorsRequest(null);
      setTeamRequest(null);
    }, CLOSE_MS);
  }, []);

  // "Convidar pessoas" (workspace sem mais ninguém): fecha a gaveta e leva às configurações do workspace.
  const goInvite = useCallback(() => {
    void navigate({ to: "/workspace/settings" });
    requestClose();
  }, [navigate, requestClose]);

  useEffect(() => {
    const onOpenCreator = (e: Event) => {
      const r = (e as CustomEvent<OpenChatRequest>).detail;
      if (!r) return;
      setCreatorsRequest({ ...r });
      setTab("creators");
      setClosing(false);
      setOpen(true);
    };
    const onOpenTeam = (e: Event) => {
      const r = (e as CustomEvent<OpenTeamChatRequest | undefined>).detail ?? {};
      setTeamRequest({ ...r });
      setTab("team");
      setClosing(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpenCreator);
    window.addEventListener(OPEN_TEAM_CHAT_EVENT, onOpenTeam);
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, onOpenCreator);
      window.removeEventListener(OPEN_TEAM_CHAT_EVENT, onOpenTeam);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const openFromButton = () => {
    // Quem só tem mensagem da equipe pendente já abre na aba Equipe.
    setTab(teamUnread > 0 && creatorsUnread === 0 ? "team" : "creators");
    setOpen(true);
  };

  // Cada aba monta o próprio painel (e a barra de abas dentro dele): depois de trocar, o foco volta para a aba.
  const refocusTab = useRef(false);
  useLayoutEffect(() => {
    if (!refocusTab.current) return;
    refocusTab.current = false;
    document.getElementById(`chat-tab-${tab}`)?.focus();
  }, [tab]);

  const selectTab = (next: DrawerTab) => {
    if (next === tab) return;
    refocusTab.current = true;
    setSwap(next === "team" ? "to-team" : "to-creators");
    setThreadOpen(false);
    // O pedido de abertura já foi atendido: ao voltar para a aba, não reabre a mesma conversa por cima da escolha.
    setCreatorsRequest(null);
    setTeamRequest(null);
    setTab(next);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    selectTab(tab === "creators" ? "team" : "creators");
  };

  const cls = closing ? " out" : "";
  const unreadOf = (id: DrawerTab) => (id === "creators" ? creatorsUnread : teamUnread);

  const top = (
    <>
      <div className="mc-head">
        <div>
          <h2>Mensagens</h2>
          <small>{totalUnread ? `${totalUnread} não lida${totalUnread > 1 ? "s" : ""}` : "Tudo em dia"}</small>
        </div>
        <button
          type="button"
          className="round ch-snd"
          aria-pressed={soundOn}
          aria-label={soundOn ? "Desligar o som de mensagem recebida" : "Ligar o som de mensagem recebida"}
          title={soundOn ? "Som ligado" : "Som desligado"}
          onClick={() => {
            setSoundOn(!soundOn);
            // Ao ligar, toca uma vez para a pessoa ouvir como é.
            if (!soundOn) playMessageSound(Date.now(), true);
          }}
        >
          <I n={soundOn ? "volume" : "mute"} cls="sm" />
        </button>
      </div>
      <div className="mc-cats" role="tablist" aria-label="Tipo de conversa">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`chat-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={tab === t.id ? `chat-panel-${t.id}` : undefined}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? "on" : ""}
            onClick={() => selectTab(t.id)}
            onKeyDown={onTabKey}
          >
            {t.label}
            {unreadOf(t.id) > 0 && (
              <em aria-label={`${unreadOf(t.id)} não lida${unreadOf(t.id) > 1 ? "s" : ""}`}>{unreadOf(t.id)}</em>
            )}
          </button>
        ))}
      </div>
    </>
  );

  const drawer = (
    <div className="pv">
      <div className={`ovb on${cls}`} onClick={requestClose} />
      <aside className={`ovp mc on${threadOpen ? " th" : ""}${swap ? ` swap-${swap}` : ""}${cls}`} role="dialog" aria-label="Mensagens">
        {/* `display: contents`: o painel nomeia a aba para o leitor de tela sem virar uma caixa do layout (as colunas
            da lista e da conversa seguem como filhas diretas do flex da gaveta). */}
        <div key={tab} role="tabpanel" id={`chat-panel-${tab}`} aria-labelledby={`chat-tab-${tab}`} style={{ display: "contents" }}>
          {tab === "creators" ? (
            <CreatorsChatTab
              top={top}
              request={creatorsRequest}
              extra={creatorsExtra}
              onExtraChange={setCreatorsExtra}
              onThreadChange={setThreadOpen}
              onRequestClose={requestClose}
            />
          ) : (
            <TeamChatTab top={top} request={teamRequest} chat={chat} onThreadChange={setThreadOpen} onInvite={goInvite} />
          )}
        </div>
        <button type="button" className="round ch-x" onClick={requestClose} aria-label="Fechar">
          <I n="x" cls="sm" />
        </button>
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="round"
        aria-label={totalUnread > 0 ? `Chat, ${totalUnread} não lida${totalUnread > 1 ? "s" : ""}` : "Chat"}
        onClick={openFromButton}
      >
        <I n="msg" />
        {totalUnread > 0 && <i className="dot" />}
      </button>
      {open && createPortal(drawer, document.body)}
    </>
  );
}
