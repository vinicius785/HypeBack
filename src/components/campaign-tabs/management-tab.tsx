import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/text-area";
import type { CampaignManagementParticipant } from "@/shared/services/campaign-management";
import { mapUserStatusToKanbanColumn } from "./management-status-map";
import { I } from "@/components/prototype/ui";
import {
  DragOverlayCard,
  SortableInfluencerCard,
  idleDaysOf,
  type CardHandlers,
} from "./kanban/influencer-card";
import { ManagementPanel } from "./kanban/management-panel";
import { ManagementSummary } from "./kanban/management-summary";
import { nextPanelId, revealDelta } from "./kanban/panel-nav";
import "@/styles/management-board.css";
import {
  ACTION_TARGET,
  COLUMN_LABEL,
  HOT_COLUMNS,
  LATE_AFTER_DAYS,
  LATE_COLUMNS,
  NEEDME,
  STAGES,
  STAGE_SHORT,
  stageOf,
  type FlowId,
  type StageKey,
} from "./campaign-flow";
import {
  getVisibleKanbanColumns,
  idToString,
  participantToExtended,
  type ExtendedInfluencer,
  type KanbanColumn,
  type StatusHistory,
} from "./management-kanban-config";
import {
  validateStatusTransition,
  validateUserStatusTransition,
  getTransitionNote,
} from "./management-status-transitions";
import { useUpdateInfluencerStatus } from "@/hooks/use-campaign-influencers";
import { openChatDrawer } from "@/components/chat-drawer";
import { useNiches } from "@/hooks/use-niches";
import { resolveNicheDisplayName } from "@/shared/utils/niche-display";
import { getNetworkLabel } from "@/shared/constants/network-labels";
import { reconcileSelectedById } from "./shared/reconcile-selected";
import { PriceNegotiationSection } from "./shared/price-negotiation-section";
import { isContentColumn } from "./shared/content-panel-actions";
import { isShipmentColumn } from "./shared/shipment-panel-actions";
import { isScriptColumn } from "./shared/script-panel-actions";
import { isSelectionColumn } from "./shared/selection-panel-actions";
import type { CampaignPhaseForCost } from "./shared/prices-utils";

/** Ancestral que rola a página (o conteúdo do app rola num contêiner próprio); `null` = a janela. */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Folga (px) entre a borda do quadro e a coluna revelada. */
const BOARD_PAD = 8;

interface ManagementTabProps {
  participants: CampaignManagementParticipant[];
  isLoading?: boolean;
  error?: unknown;
  openChatInfluencerId?: string;
  /** Chamado após tentar abrir o chat (sucesso ou usuário não encontrado). */
  onOpenChatConsumed?: () => void;
  /**
   * Modalidade de pagamento da campanha (`payment_method` do backend).
   * Usado para ocultar colunas de envio em modalidades que não são permuta.
   */
  paymentType?: string | null;
  /** Pedido da visão geral: rolar até a etapa e filtrar. */
  focus?: { stage: StageKey; filter: "me" | "all"; nonce: number };
  /** Abre a tela de trabalho correspondente à ação do card. */
  onOpenFlow?: (target: FlowId | "contracts") => void;
  /** Progresso geral (0–100) e fases, para o resumo lateral. */
  progress?: number;
  phases?: Array<{ contentSubmissionDeadline?: string; postDate: string }>;
  /** Fases com formatos/preços, para calcular o custo de aprovação no painel. */
  phasesWithFormats?: ReadonlyArray<CampaignPhaseForCost>;
  /** Criador vindo de notificação/link: abre o painel lateral dele. */
  focusCampaignUserId?: string | null;
  onFocusUserConsumed?: () => void;
  /** Conteúdo vindo de notificação: aparece primeiro no painel do criador. */
  highlightContentId?: string | null;
  onHighlightContentConsumed?: () => void;
}

// StatusHistory, ExtendedInfluencer, kanbanColumns, idToString e participantToExtended
// foram extraídos para management-kanban-config.ts

// Componente de Coluna do Kanban (`.kcol`)
function KanbanColumn({
  column,
  influencers,
  influencerIds,
  getCurrentStatus,
  selectedId,
  movingId,
  dropState,
  isDimmed,
  handlers,
}: {
  column: KanbanColumn;
  influencers: ExtendedInfluencer[];
  influencerIds: string[];
  getCurrentStatus: (inf: ExtendedInfluencer) => string;
  selectedId: string | null;
  movingId: string | null;
  /** Durante o arrasto: `ok` = o cartão pode ser solto aqui, `no` = movimento não permitido. */
  dropState?: "ok" | "no";
  isDimmed: (inf: ExtendedInfluencer, column: string) => boolean;
  handlers: CardHandlers;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      data-col={column.id}
      aria-label={`${COLUMN_LABEL[column.id] ?? column.label}: ${influencers.length}`}
      className={`kcol ${HOT_COLUMNS.includes(column.id) ? "hot" : ""} ${isOver ? "over" : ""} ${dropState ? `drop-${dropState}` : ""}`}
    >
      <header>
        <h4>{COLUMN_LABEL[column.id] ?? column.label}</h4>
        <span>{influencers.length}</span>
      </header>
      <SortableContext items={influencerIds} strategy={verticalListSortingStrategy}>
        <div className="kl">
          {influencers.map((influencer) => (
            <SortableInfluencerCard
              key={influencer.id}
              influencer={influencer}
              column={getCurrentStatus(influencer)}
              dim={isDimmed(influencer, column.id)}
              selected={selectedId === idToString(influencer.id)}
              moving={movingId === idToString(influencer.id)}
              handlers={handlers}
            />
          ))}
          {influencers.length === 0 && (
            <div className={`kz ${dropState ?? ""}`}>
              {dropState === "ok"
                ? "Solte aqui"
                : dropState === "no"
                  ? "Movimento não permitido"
                  : "Nenhum criador nesta etapa"}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export function ManagementTab({
  participants,
  isLoading = false,
  error = null,
  openChatInfluencerId,
  onOpenChatConsumed,
  paymentType,
  focus,
  onOpenFlow,
  progress = 0,
  phases = [],
  phasesWithFormats = [],
  focusCampaignUserId = null,
  onFocusUserConsumed,
  highlightContentId = null,
  onHighlightContentConsumed,
}: ManagementTabProps) {
  const [panelHighlight, setPanelHighlight] = useState<string | null>(null);
  // Colunas aplicáveis: campanhas que não são permuta omitem etapas de envio,
  // MAS qualquer coluna com participante é re-incluída para nenhum card sumir.
  const kanbanColumns = useMemo(
    () => getVisibleKanbanColumns(paymentType, participants),
    [paymentType, participants],
  );
  const { campaignId } = useParams({
    from: "/(private)/(app)/campaigns/$campaignId",
  });
  const navigate = useNavigate();
  const { data: niches = [] } = useNiches();
  const [influencersState, setInfluencersState] = useState<
    ExtendedInfluencer[]
  >([]);
  const [selectedInfluencer, setSelectedInfluencer] =
    useState<ExtendedInfluencer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openChatHandledKeyRef = useRef<string | null>(null);

  /** Abre a gaveta de mensagens do topo já na conversa deste criador. */
  const openChat = (inf: ExtendedInfluencer) => {
    if (inf.user_id == null || String(inf.user_id).trim() === "") {
      toast.error("Este criador ainda não tem conversa disponível.");
      return;
    }
    openChatDrawer({
      campaignId: String(campaignId),
      influencerId: String(inf.user_id),
      name: inf.name,
      avatar: inf.avatar || undefined,
    });
  };

  // Abrir chat automaticamente quando openChatInfluencerId for fornecido (vindo de notificação)
  useEffect(() => {
    openChatHandledKeyRef.current = null;
  }, [openChatInfluencerId]);

  useEffect(() => {
    if (!openChatInfluencerId) return;
    if (openChatHandledKeyRef.current === openChatInfluencerId) return;
    if (isLoading) return;

    const finish = () => {
      openChatHandledKeyRef.current = openChatInfluencerId;
      onOpenChatConsumed?.();
    };

    if (influencersState.length === 0) {
      // Corrida de efeitos (#3): quando os dados chegam, `isLoading` vira false
      // e `participants` popula, mas `influencersState` (sincronizado por outro
      // effect) ainda pode estar vazio neste render. Só consumimos o deep-link
      // quando NÃO há participantes de verdade; caso contrário aguardamos o
      // próximo render (o effect re-roda quando `influencersState` popular),
      // senão o chat nunca abria sozinho e exigia um segundo clique manual.
      if (!participants || participants.length === 0) {
        finish();
      }
      return;
    }

    const influencerIdStr = String(openChatInfluencerId);
    const influencerIdNum = parseInt(influencerIdStr, 10);

    let influencerToOpen: ExtendedInfluencer | undefined;

    if (!Number.isNaN(influencerIdNum)) {
      influencerToOpen = influencersState.find((inf) => {
        if (inf.user_id == null || String(inf.user_id).trim() === "")
          return false;
        const uid =
          typeof inf.user_id === "string"
            ? parseInt(inf.user_id, 10)
            : Number(inf.user_id);
        return uid === influencerIdNum;
      });
      if (!influencerToOpen) {
        influencerToOpen = influencersState.find((inf) => {
          const infId =
            typeof inf.id === "string" ? parseInt(inf.id, 10) : Number(inf.id);
          return (
            infId === influencerIdNum || String(inf.id) === influencerIdStr
          );
        });
      }
    } else {
      influencerToOpen = influencersState.find(
        (inf) => String(inf.id) === influencerIdStr,
      );
    }

    if (influencerToOpen) {
      openChat(influencerToOpen);
    }
    finish();
  }, [openChatInfluencerId, influencersState, participants, isLoading, onOpenChatConsumed]);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flt, setFlt] = useState<"all" | "me" | "late" | "ext">("all");
  const [fpopOpen, setFpopOpen] = useState(false);
  const [q, setQ] = useState("");
  const [net, setNet] = useState<string>("all");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  // Painel de detalhes: normal (cabe no conteúdo, até ~42% da altura) ou expandido.
  const [panelExpanded, setPanelExpanded] = useState(false);
  // Anterior/próximo e deep-links rolam o quadro até o cartão; o clique no cartão não precisa (ele já está à vista).
  const scrollToCardRef = useRef(false);
  const [stage, setStage] = useState<StageKey>("sel");
  const kbxRef = useRef<HTMLDivElement>(null);
  const kbwRef = useRef<HTMLDivElement>(null);
  // Topo do quadro medido ANTES de abrir/fechar o painel, para o quadro não "pular" sob o cursor.
  const anchorTopRef = useRef<number | null>(null);
  const captureBoardTop = () => {
    anchorTopRef.current = kbwRef.current?.getBoundingClientRect().top ?? null;
  };
  const fpopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fpopOpen) return;
    const onDown = (e: MouseEvent) => {
      if (fpopRef.current && !fpopRef.current.contains(e.target as Node)) {
        setFpopOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [fpopOpen]);

  const jumpStage = (k: StageKey) => {
    const x = kbxRef.current;
    const g = x?.querySelector<HTMLElement>(`[data-grp="${k}"]`);
    if (!x || !g) return;
    setStage(k);
    x.scrollTo({ left: g.offsetLeft - x.offsetLeft - 4, behavior: "smooth" });
  };

  // Pedido vindo da visão geral ("Revisar roteiros", "Curar"…).
  useEffect(() => {
    if (!focus) return;
    setFlt(focus.filter);
    setPanelId(null);
    const t = window.setTimeout(() => jumpStage(focus.stage), 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // Vindo de notificação/link: abre o painel lateral do criador.
  useEffect(() => {
    if (!focusCampaignUserId || influencersState.length === 0) return;
    const match = influencersState.find(
      (i) =>
        idToString(i.id) === focusCampaignUserId ||
        String(i.user_id ?? "") === focusCampaignUserId,
    );
    if (match) {
      setPanelId(idToString(match.id));
      const st = stageOf(getCurrentStatus(match));
      if (st) setStage(st[0]);
    }
    if (highlightContentId) {
      setPanelHighlight(highlightContentId);
      onHighlightContentConsumed?.();
    }
    onFocusUserConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCampaignUserId, influencersState]);

  // Hooks para mutations
  const { mutate: updateStatus, isPending: isUpdatingStatus } =
    useUpdateInfluencerStatus(campaignId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const isCampaignUser = (_id: string) => true;

  useEffect(() => {
    if (!participants?.length) {
      setInfluencersState([]);
      return;
    }
    setInfluencersState(participants.map(participantToExtended));
  }, [participants]);

  // Mantém o influenciador aberto no modal em sincronia com a lista recém-buscada.
  // Sem isso, ações que refetcham a lista (ex.: responder à negociação de preço)
  // não refletiam no modal — os valores só atualizavam ao fechar e reabrir, pois
  // `selectedInfluencer` era um snapshot congelado. Ver `reconcileSelectedById`.
  useEffect(() => {
    setSelectedInfluencer((prev) => reconcileSelectedById(prev, influencersState));
  }, [influencersState]);

  const extendedInfluencers = influencersState;

  const getCurrentStatus = (inf: ExtendedInfluencer): string => {
    // Priorizar o status direto do objeto (mais confiável e atualizado)
    if (inf.status) {
      const mappedStatus = mapUserStatusToKanbanColumn(inf.status);
      if (
        mappedStatus !== "applications" ||
        !inf.statusHistory ||
        inf.statusHistory.length === 0
      ) {
        return mappedStatus;
      }
    }

    // Se não houver status ou for "applications", verificar o statusHistory
    if (inf.statusHistory && inf.statusHistory.length > 0) {
      // Get the most recent status from history
      const sortedHistory = [...inf.statusHistory].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      return sortedHistory[0].status;
    }

    // Fallback final
    return "applications";
  };

  const getInfluencersByStatus = (status: string) => {
    return extendedInfluencers.filter((inf) => {
      const currentStatus = getCurrentStatus(inf);
      return currentStatus === status;
    });
  };

  const updateInfluencerStatus = (
    influencerId: string,
    newStatus: string,
    notes?: string,
  ) => {
    setInfluencersState((prev) =>
      prev.map((inf) => {
        if (inf.id === influencerId) {
          const newHistoryEntry: StatusHistory = {
            id: Date.now().toString(),
            status: newStatus,
            timestamp: new Date().toISOString(),
            notes,
          };
          return {
            ...inf,
            statusHistory: [...(inf.statusHistory || []), newHistoryEntry],
          };
        }
        return inf;
      }),
    );
  };

  const handleApprove = (
    influencer: ExtendedInfluencer,
    targetStatus: string,
  ) => {
    // Se o influenciador tiver apenas uma rede social, usar o network_id dela
    const networkId =
      influencer.social_networks && influencer.social_networks.length === 1
        ? typeof influencer.social_networks[0].id === "string"
          ? Number(influencer.social_networks[0].id)
          : influencer.social_networks[0].id
        : undefined;

    updateStatus(
      {
        influencer_id: idToString(influencer.id),
        status: targetStatus,
        feedback: "Aprovado pelo usuário",
        network_id: networkId,
      },
      {
        onSuccess: () => {
          updateInfluencerStatus(
            idToString(influencer.id),
            targetStatus,
            "Aprovado pelo usuário",
          );
          toast.success("Influenciador aprovado com sucesso!");
          setIsModalOpen(false);
          setSelectedInfluencer(null);
        },
        onError: (error: Error) => {
          toast.error(error?.message || "Erro ao aprovar influenciador");
        },
      },
    );
  };

  const handleReject = (influencer: ExtendedInfluencer, feedback: string) => {
    if (!feedback.trim()) {
      toast.error("Feedback é obrigatório ao recusar influenciador");
      return;
    }

    // Se o influenciador tiver apenas uma rede social, usar o network_id dela
    const networkId =
      influencer.social_networks && influencer.social_networks.length === 1
        ? typeof influencer.social_networks[0].id === "string"
          ? Number(influencer.social_networks[0].id)
          : influencer.social_networks[0].id
        : undefined;

    updateStatus(
      {
        influencer_id: idToString(influencer.id),
        status: "rejected",
        feedback,
        network_id: networkId,
      },
      {
        onSuccess: () => {
          updateInfluencerStatus(
            idToString(influencer.id),
            "rejected",
            feedback,
          );
          toast.success("Influenciador recusado");
          setIsRejectModalOpen(false);
          setRejectFeedback("");
          setIsModalOpen(false);
          setSelectedInfluencer(null);
        },
        onError: (error: Error) => {
          toast.error(error?.message || "Erro ao recusar influenciador");
        },
      },
    );
  };

  const getStatusLabel = (status: string) => {
    const column = kanbanColumns.find((col) => col.id === status);
    return column?.label || status;
  };

  const getSocialNetworkIcon = (network?: string) => {
    const icons: { [key: string]: keyof typeof import("lucide-react").icons } =
    {
      instagram: "Instagram",
      youtube: "Youtube",
      tiktok: "Music",
      facebook: "Facebook",
      twitter: "Twitter",
    };
    return icons[network || ""] || "Share2";
  };

  const getSocialNetworkLabel = (network?: string) => getNetworkLabel(network, network || "N/A");

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Se está arrastando sobre uma coluna
    if (kanbanColumns.some((col) => col.id === overId)) {
      return;
    }

    // Se está arrastando sobre outro card
    const activeInfluencer = extendedInfluencers.find(
      (inf) => inf.id === activeId,
    );
    const overInfluencer = extendedInfluencers.find((inf) => inf.id === overId);

    if (!activeInfluencer || !overInfluencer) return;

    const activeStatus = getCurrentStatus(activeInfluencer);
    const overStatus = getCurrentStatus(overInfluencer);

    if (activeStatus !== overStatus) {
      // Não permite reordenar entre colunas diferentes via drag over
      return;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Encontra o influenciador sendo arrastado
    const draggedInfluencer = extendedInfluencers.find(
      (inf) => inf.id === activeId,
    );
    if (!draggedInfluencer) return;

    // Verifica se foi solto sobre uma coluna
    const targetColumn = kanbanColumns.find((col) => col.id === overId);
    if (targetColumn) {
      const currentStatus = getCurrentStatus(draggedInfluencer);
      const targetStatus = targetColumn.id;

      // Verifica se é um usuário da campanha
      const isUser = isCampaignUser(idToString(draggedInfluencer.id));

      if (isUser) {
        // Para usuários da campanha, validar transição
        const canMove = validateUserStatusTransition(
          currentStatus,
          targetStatus,
        );

        if (!canMove) {
          toast.error(
            `Não é possível mover de "${getStatusLabel(currentStatus)}" para "${getStatusLabel(targetStatus)}"`,
          );
          return;
        }

        // Atualizar status do influenciador via API usando a rota correta
        const notes = getTransitionNote(currentStatus, targetStatus);
        // Se o influenciador tiver apenas uma rede social, usar o network_id dela
        const networkId =
          draggedInfluencer.social_networks &&
            draggedInfluencer.social_networks.length === 1
            ? typeof draggedInfluencer.social_networks[0].id === "string"
              ? Number(draggedInfluencer.social_networks[0].id)
              : draggedInfluencer.social_networks[0].id
            : undefined;

        setMovingId(idToString(draggedInfluencer.id));
        updateStatus(
          {
            influencer_id: idToString(draggedInfluencer.id),
            status: targetStatus,
            feedback: notes,
            network_id: networkId,
          },
          {
            onSettled: () => setMovingId(null),
            onSuccess: () => {
              updateInfluencerStatus(
                idToString(draggedInfluencer.id),
                targetStatus,
                notes,
              );
              toast.success(`Movido para "${getStatusLabel(targetStatus)}"`);
            },
            onError: (error: Error) => {
              toast.error(
                error?.message || "Erro ao atualizar status do usuário",
              );
            },
          },
        );
        return;
      }

      // Para influenciadores normais, usar validação e atualização existente
      const canMove = validateStatusTransition(currentStatus, targetStatus);

      if (!canMove) {
        toast.error(
          `Não é possível mover de "${getStatusLabel(currentStatus)}" para "${getStatusLabel(targetStatus)}"`,
        );
        return;
      }
      const apiStatus =
        targetStatus === "curation"
          ? "curation"
          : targetStatus === "pre_selection"
            ? "pre_selection"
            : targetStatus === "pre_selection_curation"
              ? "pre_selection_curation"
              : targetStatus === "approved"
                ? "approved"
                : targetStatus === "rejected"
                  ? "rejected"
                  : targetStatus === "applications"
                    ? "applications"
                    : targetStatus === "invited"
                      ? "invited"
                      : targetStatus === "contract_pending"
                        ? "contract_pending"
                        : targetStatus === "script_pending"
                          ? "script_pending"
                          : targetStatus === "content_pending"
                            ? "content_pending"
                            : targetStatus === "pending_approval"
                              ? "pending_approval"
                              : targetStatus === "in_correction"
                                ? "in_correction"
                                : targetStatus === "content_approved"
                                  ? "content_approved"
                                  : targetStatus === "payment_pending"
                                    ? "payment_pending"
                                    : targetStatus === "published"
                                      ? "published"
                                      : targetStatus;

      // Atualiza o status do influenciador via API
      const notes = getTransitionNote(currentStatus, targetStatus);
      // Se o influenciador tiver apenas uma rede social, usar o network_id dela
      const networkId =
        draggedInfluencer.social_networks &&
          draggedInfluencer.social_networks.length === 1
          ? typeof draggedInfluencer.social_networks[0].id === "string"
            ? Number(draggedInfluencer.social_networks[0].id)
            : draggedInfluencer.social_networks[0].id
          : undefined;

      updateStatus(
        {
          influencer_id: idToString(draggedInfluencer.id),
          status: apiStatus,
          feedback: notes,
          network_id: networkId,
        },
        {
          onSuccess: () => {
            updateInfluencerStatus(
              idToString(draggedInfluencer.id),
              targetStatus,
              notes,
            );
            toast.success("Status atualizado com sucesso!");
          },
          onError: (error: Error) => {
            toast.error(error?.message || "Erro ao atualizar status");
          },
        },
      );
      return;
    }

    // Se foi solto sobre outro card, verifica se pode reordenar
    const overInfluencer = extendedInfluencers.find((inf) => inf.id === overId);
    if (overInfluencer) {
      const activeStatus = getCurrentStatus(draggedInfluencer);
      const overStatus = getCurrentStatus(overInfluencer);

      if (activeStatus === overStatus) {
        // Permite reordenar dentro da mesma coluna (opcional)
        // Por enquanto, não fazemos nada, mas podemos implementar reordenação se necessário
      }
    }
  };

  // validateStatusTransition, validateUserStatusTransition e getTransitionNote
  // foram extraídos para management-status-transitions.ts

  const panelInfluencer =
    panelId != null
      ? (extendedInfluencers.find((i) => idToString(i.id) === panelId) ?? null)
      : null;

  const isLateInf = (inf: ExtendedInfluencer) =>
    LATE_COLUMNS.includes(getCurrentStatus(inf)) &&
    (idleDaysOf(inf) ?? 0) >= LATE_AFTER_DAYS;
  const normalized = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matchesQuery = (inf: ExtendedInfluencer) => {
    const t = normalized(q.trim().replace(/^@/, ""));
    return !t || normalized(inf.name).includes(t) || normalized(inf.username ?? "").includes(t);
  };
  const networkOf = (inf: ExtendedInfluencer) =>
    new Set(
      [inf.socialNetwork, ...(inf.social_networks ?? []).map((n) => n.type)]
        .filter(Boolean)
        .map((t) => getNetworkLabel(t as string, t as string)),
    );
  const matchesNetwork = (inf: ExtendedInfluencer) => net === "all" || networkOf(inf).has(net);
  const passes = (inf: ExtendedInfluencer, f: typeof flt) =>
    matchesQuery(inf) &&
    matchesNetwork(inf) &&
    (f === "all" ||
      (f === "me" && NEEDME.includes(getCurrentStatus(inf))) ||
      (f === "late" && isLateInf(inf)) ||
      (f === "ext" && !!inf.isExternal));
  const isDimmed = (inf: ExtendedInfluencer) => !passes(inf, flt);
  const nfl = (f: typeof flt) =>
    extendedInfluencers.filter((i) => passes(i, f)).length;
  const networksInUse = Array.from(
    new Set(extendedInfluencers.flatMap((i) => [...networkOf(i)])),
  ).sort();
  const activeFilters = (flt !== "all" ? 1 : 0) + (net !== "all" ? 1 : 0) + (q.trim() ? 1 : 0);
  const clearFilters = () => {
    setFlt("all");
    setNet("all");
    setQ("");
  };

  const FLT: Array<[typeof flt, string, string]> = [
    ["all", "Todos", "Todos"],
    ["me", "Precisa da minha ação", "Minha ação"],
    ["late", "Atrasados", "Atrasados"],
    ["ext", "Externos", "Externos"],
  ];

  const visibleColumnIds = new Set(kanbanColumns.map((c) => c.id));
  const groups = STAGES.map(([k, , cols], n) => ({
    k,
    n,
    cols: cols.filter((c) => visibleColumnIds.has(c)),
  })).filter((g) => g.cols.length > 0);
  const columnById = new Map(kanbanColumns.map((c) => [c.id, c]));

  const handleCardAction = (inf: ExtendedInfluencer, column: string) => {
    // Etapa Seleção: a ação acontece no painel lateral do card.
    if (isSelectionColumn(column) || isScriptColumn(column) || isShipmentColumn(column) || isContentColumn(column)) {
      setPanelId(idToString(inf.id));
      return;
    }
    const target = ACTION_TARGET[column];
    if (target && onOpenFlow) onOpenFlow(target);
    else {
      setSelectedInfluencer(inf);
      setIsModalOpen(true);
    }
  };

  const openProfile = (inf: ExtendedInfluencer) => {
    const userId =
      inf.user_id != null && String(inf.user_id).trim() !== ""
        ? String(inf.user_id)
        : null;
    if (!userId) {
      toast.error("Não foi possível abrir o perfil: usuário sem user_id.");
      return;
    }
    navigate({ to: "/influencer/$influencerId", params: { influencerId: userId } });
  };

  const attention = [
    { n: extendedInfluencers.filter((i) => getCurrentStatus(i) === "script_pending").length, label: "Roteiros para aprovar", stage: "rot" as StageKey },
    { n: extendedInfluencers.filter((i) => getCurrentStatus(i) === "pending_approval").length, label: "Conteúdos para aprovar", stage: "cont" as StageKey },
    { n: extendedInfluencers.filter((i) => getCurrentStatus(i) === "price_countered").length, label: "Contraproposta", stage: "con" as StageKey },
    { n: extendedInfluencers.filter((i) => getCurrentStatus(i) === "payment_pending").length, label: "Pagamento para liberar", stage: "pag" as StageKey },
    { n: extendedInfluencers.filter((i) => ["curation", "pre_selection_curation"].includes(getCurrentStatus(i))).length, label: "Para curar", stage: "sel" as StageKey },
    { n: extendedInfluencers.filter((i) => getCurrentStatus(i) === "awaiting_shipment").length, label: "Produto para enviar", stage: "env" as StageKey },
    { n: extendedInfluencers.filter((i) => getCurrentStatus(i) === "applications").length, label: "Inscrições novas", stage: "sel" as StageKey },
  ].filter((a) => a.n > 0);
  const attentionTotal = attention.reduce((acc, a) => acc + a.n, 0);
  const lateList = extendedInfluencers.filter(isLateInf);

  const fmtShort = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const deadlines = [
    ["Conteúdos", fmtShort(phases[0]?.contentSubmissionDeadline)],
    ["Publicação", fmtShort(phases[phases.length - 1]?.postDate)],
  ].filter((x): x is [string, Date] => x[1] != null);
  const inDays = (d: Date) => {
    const n = Math.round((d.getTime() - Date.now()) / 86_400_000);
    return n === 0 ? "hoje" : n > 0 ? `em ${n} ${n === 1 ? "dia" : "dias"}` : `há ${-n} ${n === -1 ? "dia" : "dias"}`;
  };

  // Ordem do quadro (etapa por etapa, coluna por coluna); com filtro ativo, anterior/próximo só passam pelos que aparecem.
  const navIds = groups
    .flatMap((g) => g.cols.flatMap((colId) => getInfluencersByStatus(colId)))
    .filter((inf) => !isDimmed(inf) || idToString(inf.id) === panelId)
    .map((inf) => idToString(inf.id));
  const selectFromPanel = (id: string) => {
    scrollToCardRef.current = true;
    setPanelId(id);
  };
  // Mostra o cartão aberto SEM deixar a coluna cortada: ajusta só a rolagem horizontal do quadro até a coluna caber
  // inteira (com folga) e deixa o cartão à vista dentro da coluna. Só roda em anterior/próximo e deep-links.
  useEffect(() => {
    if (panelId == null || !scrollToCardRef.current) return;
    scrollToCardRef.current = false;
    const board = kbxRef.current;
    const card = board?.querySelector<HTMLElement>(`[data-inf="${CSS.escape(panelId)}"]`);
    const col = card?.closest<HTMLElement>(".kcol");
    if (!board || !card || !col) return;
    const delta = revealDelta(col.getBoundingClientRect(), board.getBoundingClientRect(), BOARD_PAD);
    if (delta !== 0) board.scrollBy?.({ left: delta, behavior: "smooth" });
    const list = card.closest<HTMLElement>(".kl");
    if (list) {
      const c = card.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      if (c.top < l.top) list.scrollBy?.({ top: c.top - l.top - 8 });
      else if (c.bottom > l.bottom) list.scrollBy?.({ top: c.bottom - l.bottom + 8 });
    }
  }, [panelId]);

  // Abrir ou fechar o painel muda a altura acima do quadro: compensa a rolagem para o quadro (e o cartão clicado) ficarem
  // exatamente onde estavam na tela.
  const panelOpen = panelId != null;
  useLayoutEffect(() => {
    const before = anchorTopRef.current;
    anchorTopRef.current = null;
    const board = kbwRef.current;
    if (before == null || !board) return;
    const delta = board.getBoundingClientRect().top - before;
    if (Math.abs(delta) < 1) return;
    const sp = scrollParentOf(board);
    if (sp) sp.scrollTop += delta;
    else window.scrollBy(0, delta);
  }, [panelOpen]);

  /** Setas do quadro: rolam quase uma tela, parando no começo de uma coluna. */
  const scrollBoard = (dir: -1 | 1) => {
    const board = kbxRef.current;
    if (!board) return;
    board.scrollBy?.({ left: dir * Math.round(board.clientWidth * 0.8), behavior: "smooth" });
  };

  const draggedInf = activeId
    ? extendedInfluencers.find((inf) => idToString(inf.id) === activeId)
    : undefined;
  const dropStateFor = (colId: string): "ok" | "no" | undefined => {
    if (!draggedInf) return undefined;
    const from = getCurrentStatus(draggedInf);
    if (from === colId) return undefined;
    return validateUserStatusTransition(from, colId) ? "ok" : "no";
  };

  const cardHandlers: CardHandlers = {
    onSelect: (inf) => {
      captureBoardTop();
      setPanelId((cur) => nextPanelId(cur, idToString(inf.id)));
    },
    onAction: handleCardAction,
    onChat: openChat,
    onProfile: openProfile,
    onReject: (inf) => {
      setSelectedInfluencer(inf);
      setIsRejectModalOpen(true);
    },
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {error != null && (
          <div className="rounded-[22px] bg-danger-50 px-4 py-3 text-sm text-danger-900">
            {error instanceof Error
              ? error.message
              : "Não foi possível carregar o gerenciamento da campanha."}
          </div>
        )}

        <div className="pv">
          {isLoading ? (
            <div className="kbw">
              <div className="kbx">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="kcol sk" style={{ minHeight: 280 }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mg mgv">
              {panelInfluencer ? (
                <ManagementPanel
                  inf={panelInfluencer}
                  column={getCurrentStatus(panelInfluencer)}
                  late={isLateInf(panelInfluencer)}
                  idle={idleDaysOf(panelInfluencer)}
                  orderedIds={navIds}
                  expanded={panelExpanded}
                  onToggleExpanded={() => setPanelExpanded((v) => !v)}
                  onSelect={selectFromPanel}
                  onClose={() => {
                    captureBoardTop();
                    setPanelId(null);
                  }}
                  campaignId={campaignId}
                  paymentType={paymentType}
                  phasesWithFormats={phasesWithFormats}
                  highlightContentId={panelHighlight}
                  onChat={() => openChat(panelInfluencer)}
                  onProfile={() => openProfile(panelInfluencer)}
                  onStageAction={() => handleCardAction(panelInfluencer, getCurrentStatus(panelInfluencer))}
                  onReject={() => {
                    setSelectedInfluencer(panelInfluencer);
                    setIsRejectModalOpen(true);
                  }}
                  onReconsider={() => handleApprove(panelInfluencer, "applications")}
                />
              ) : (
                <ManagementSummary
                  progress={progress}
                  attention={attention}
                  attentionTotal={attentionTotal}
                  late={lateList}
                  deadlines={deadlines}
                  inDays={inDays}
                  onAttention={(st) => {
                    setFlt("me");
                    jumpStage(st);
                  }}
                  onCharge={openChat}
                />
              )}
              <div className="kbw" ref={kbwRef}>
                <div className="kbt">
                  <div className="jumps">
                    {groups.map((g) => (
                      <button
                        key={g.k}
                        type="button"
                        className={stage === g.k ? "on" : ""}
                        onClick={() => jumpStage(g.k)}
                      >
                        {STAGE_SHORT[g.k]}
                      </button>
                    ))}
                  </div>
                  <div className="kbt-r">
                  <div className="kbt-arr" role="group" aria-label="Rolar o quadro">
                    <button type="button" className="round" aria-label="Rolar o quadro para a esquerda" onClick={() => scrollBoard(-1)}>
                      <I n="chevl" cls="sm" />
                    </button>
                    <button type="button" className="round" aria-label="Rolar o quadro para a direita" onClick={() => scrollBoard(1)}>
                      <I n="chev" cls="sm" />
                    </button>
                  </div>
                  <div className={`pop fpop ${fpopOpen ? "open" : ""}`} ref={fpopRef}>
                    <button
                      type="button"
                      className={`fbtn ${activeFilters > 0 ? "act" : ""}`}
                      aria-label={activeFilters > 0 ? `Filtros (${activeFilters} ativos)` : "Filtros"}
                      aria-expanded={fpopOpen}
                      onClick={() => setFpopOpen((v) => !v)}
                    >
                      <I n="funnel" cls="sm" />
                      <span id="fpl">Filtros</span>
                      {activeFilters > 0 ? <em className="fcnt">{activeFilters}</em> : null}
                    </button>
                    <div className="popm fpm" role="dialog" aria-label="Filtros do quadro">
                      <label className="fp-q">
                        <I n="search" cls="sm" />
                        <input
                          type="search"
                          value={q}
                          placeholder="Buscar por nome ou @usuário"
                          aria-label="Buscar criador"
                          onChange={(e) => setQ(e.target.value)}
                        />
                      </label>
                      <div className="fp-g" role="group" aria-label="Situação">
                        <small>Situação</small>
                        {FLT.filter(([k]) => k !== "ext").map(([k, l]) => (
                          <button key={k} type="button" className={flt === k ? "on" : ""} onClick={() => setFlt(k)}>
                            <span>{l}</span>
                            <em>{nfl(k)}</em>
                            <I n="check" cls="sm" />
                          </button>
                        ))}
                      </div>
                      <div className="fp-g" role="group" aria-label="Origem">
                        <small>Origem</small>
                        <button type="button" className={flt === "ext" ? "on" : ""} onClick={() => setFlt(flt === "ext" ? "all" : "ext")}>
                          <span>Criadores externos</span>
                          <em>{nfl("ext")}</em>
                          <I n="check" cls="sm" />
                        </button>
                      </div>
                      {networksInUse.length > 1 ? (
                        <div className="fp-g" role="group" aria-label="Rede social">
                          <small>Rede social</small>
                          <div className="fp-chips">
                            {["all", ...networksInUse].map((n) => (
                              <button key={n} type="button" className={net === n ? "on" : ""} onClick={() => setNet(n)}>
                                {n === "all" ? "Todas" : n}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="fp-f">
                        <button type="button" className="lnk" disabled={activeFilters === 0} onClick={clearFilters}>
                          Limpar filtros
                        </button>
                        <button type="button" className="btn" onClick={() => setFpopOpen(false)}>
                          Ver {extendedInfluencers.filter((i) => passes(i, flt)).length} criadores
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    className="kbx"
                    ref={kbxRef}
                    onScroll={(e) => {
                      const x = e.currentTarget;
                      let cur = groups[0]?.k;
                      x.querySelectorAll<HTMLElement>(".kg").forEach((g) => {
                        if (g.offsetLeft - x.offsetLeft - 40 <= x.scrollLeft) {
                          cur = g.dataset.grp as StageKey;
                        }
                      });
                      if (cur && cur !== stage) setStage(cur);
                    }}
                  >
                    {groups.map((g) => {
                      const tot = extendedInfluencers.filter((i) =>
                        g.cols.includes(getCurrentStatus(i)),
                      ).length;
                      return (
                        <div
                          key={g.k}
                          className={`kg ${g.k === "rec" ? "rec" : ""}`}
                          data-grp={g.k}
                          style={{ ["--n" as string]: g.cols.length }}
                        >
                          <div className="kgh">
                            <span>{g.k === "rec" ? "" : g.n + 1}</span>
                            <b>{STAGE_SHORT[g.k]}</b>
                            <em>{tot}</em>
                          </div>
                          <div className="kgc">
                            {g.cols.map((colId) => {
                              const column = columnById.get(colId)!;
                              const list = getInfluencersByStatus(colId);
                              return (
                                <KanbanColumn
                                  key={colId}
                                  column={column}
                                  influencers={list}
                                  influencerIds={list.map((i) => idToString(i.id))}
                                  getCurrentStatus={getCurrentStatus}
                                  selectedId={panelId}
                                  movingId={movingId}
                                  dropState={dropStateFor(colId)}
                                  isDimmed={isDimmed}
                                  handlers={cardHandlers}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <DragOverlay>
                    {activeId && draggedInf ? (
                      <DragOverlayCard
                        influencer={draggedInf!}
                        column={getCurrentStatus(draggedInf!)}
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Modal do influenciador */}
      {isModalOpen && selectedInfluencer && (
        <Modal
          title={`${selectedInfluencer.name} - Detalhes`}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedInfluencer(null);
          }}
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={selectedInfluencer.avatar}
                alt={selectedInfluencer.name}
                size="2xl"
              />
              <div>
                <h3 className="text-xl font-semibold text-neutral-950">
                  {selectedInfluencer.name}
                </h3>
                <p className="text-neutral-600">
                  @{selectedInfluencer.username}
                </p>
                {/* Mostrar todas as redes sociais */}
                {selectedInfluencer.social_networks &&
                  selectedInfluencer.social_networks.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {selectedInfluencer.social_networks.map((network) => (
                      <Badge
                        key={network.id}
                        text={getSocialNetworkLabel(network.type)}
                        backgroundColor="bg-primary-50"
                        textColor="text-primary-900"
                      />
                    ))}
                  </div>
                ) : selectedInfluencer.socialNetwork ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Icon
                      name={getSocialNetworkIcon(
                        selectedInfluencer.socialNetwork,
                      )}
                      color="#404040"
                      size={16}
                    />
                    <span className="text-sm text-neutral-600">
                      {getSocialNetworkLabel(selectedInfluencer.socialNetwork)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-600 mb-1">Seguidores</p>
                <p className="text-lg font-semibold text-neutral-950">
                  {selectedInfluencer.followers.toLocaleString("pt-BR")}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Engajamento</p>
                <p className="text-lg font-semibold text-neutral-950">
                  {selectedInfluencer.engagement}%
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Nicho</p>
                <p className="text-lg font-semibold text-neutral-950">
                  {resolveNicheDisplayName(
                    selectedInfluencer.niche,
                    niches,
                    selectedInfluencer.nicheName,
                  ) ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Status</p>
                <Badge
                  text={getStatusLabel(getCurrentStatus(selectedInfluencer))}
                  backgroundColor="bg-primary-50"
                  textColor="text-primary-900"
                />
              </div>
            </div>

            {/* Redes Sociais */}
            {selectedInfluencer.social_networks &&
              selectedInfluencer.social_networks.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-neutral-950 mb-3">
                    Redes Sociais Utilizadas
                  </p>
                  <div className="bg-neutral-50 rounded-2xl p-4">
                    <div className="flex flex-col gap-3">
                      {selectedInfluencer.social_networks.map((network) => (
                        <div
                          key={network.id}
                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-200"
                        >
                          <div className="flex items-center gap-3">
                            <Icon
                              name={getSocialNetworkIcon(network.type)}
                              color="#404040"
                              size={20}
                            />
                            <div>
                              <p className="text-sm font-semibold text-neutral-950">
                                {getSocialNetworkLabel(network.type)}
                              </p>
                              {network.username && (
                                <p className="text-xs text-neutral-600">
                                  @{network.username}
                                </p>
                              )}
                              {network.name &&
                                network.name !== network.username && (
                                  <p className="text-xs text-neutral-600">
                                    {network.name}
                                  </p>
                                )}
                            </div>
                          </div>
                          {network.members !== undefined &&
                            network.members > 0 && (
                              <div className="text-right">
                                <p className="text-sm font-semibold text-neutral-950">
                                  {network.members.toLocaleString("pt-BR")}
                                </p>
                                <p className="text-xs text-neutral-600">
                                  seguidores
                                </p>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            {/* Log Histórico Completo */}
            {selectedInfluencer.statusHistory &&
              selectedInfluencer.statusHistory.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-neutral-950 mb-3">
                    Log Histórico Completo
                  </p>
                  <div className="bg-neutral-50 rounded-2xl p-4 max-h-64 overflow-y-auto">
                    <div className="flex flex-col gap-3">
                      {selectedInfluencer.statusHistory
                        .sort(
                          (a, b) =>
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime(),
                        )
                        .map((history) => (
                          <div
                            key={history.id}
                            className="border-l-2 border-primary-600 pl-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-neutral-950">
                                {getStatusLabel(history.status)}
                              </span>
                              <span className="text-xs text-neutral-600">
                                {new Date(history.timestamp).toLocaleDateString(
                                  "pt-BR",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  },
                                )}
                                {" às "}
                                {new Date(history.timestamp).toLocaleTimeString(
                                  "pt-BR",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>
                            {history.notes && (
                              <p className="text-xs text-neutral-600">
                                {history.notes}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

            <PriceNegotiationSection
              campaignId={campaignId}
              userId={selectedInfluencer.user_id}
              status={selectedInfluencer.status}
              negotiation={selectedInfluencer.price_negotiation}
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsModalOpen(false);
                  if (selectedInfluencer) openChat(selectedInfluencer);
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon name="MessageCircle" color="#404040" size={16} />
                  <span>Abrir chat</span>
                </div>
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                type="button"
                onClick={() => {
                  const userId =
                    selectedInfluencer.user_id != null &&
                      String(selectedInfluencer.user_id).trim() !== ""
                      ? String(selectedInfluencer.user_id)
                      : null;
                  if (!userId) {
                    toast.error(
                      "Não foi possível abrir o perfil: usuário sem user_id.",
                    );
                    return;
                  }
                  setIsModalOpen(false);
                  setSelectedInfluencer(null);
                  navigate({
                    to: "/influencer/$influencerId",
                    params: { influencerId: userId },
                  });
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon name="User" color="#404040" size={16} />
                  <span>Ver perfil completo</span>
                </div>
              </Button>
            </div>
          </div>
        </Modal>
      )}


      {/* Modal de Rejeição */}
      {selectedInfluencer && isRejectModalOpen && (
        <Modal
          title="Recusar influenciador"
          onClose={() => {
            setIsRejectModalOpen(false);
            setRejectFeedback("");
            setSelectedInfluencer(null);
          }}
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={selectedInfluencer.avatar}
                alt={selectedInfluencer.name}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-neutral-950">
                  {selectedInfluencer.name}
                </h3>
                <p className="text-neutral-600">
                  @{selectedInfluencer.username}
                </p>
              </div>
            </div>

            <div className="bg-danger-50 rounded-2xl p-4">
              <p className="text-sm text-danger-900">
                O feedback é obrigatório ao recusar um influenciador. Ele será
                enviado ao influenciador para que possa entender o motivo da
                recusa.
              </p>
            </div>

            <Textarea
              label="Feedback de recusa"
              placeholder="Explique o motivo da recusa..."
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              error={
                !rejectFeedback.trim() ? "Este campo é obrigatório" : undefined
              }
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectFeedback("");
                  setSelectedInfluencer(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (rejectFeedback.trim()) {
                    handleReject(selectedInfluencer, rejectFeedback);
                  }
                }}
                disabled={!rejectFeedback.trim() || isUpdatingStatus}
                className="flex-1"
              >
                {isUpdatingStatus ? "Processando..." : "Confirmar recusa"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
