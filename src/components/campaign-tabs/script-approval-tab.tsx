import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import type { CampaignScript, RawCampaignScriptResponse, CampaignPhase } from "@/shared/types";
import { useCampaignScripts } from "@/hooks/use-campaign-scripts";
import { useApproveScript, useRejectScript } from "@/hooks/use-campaign-scripts";
import { useBulkScriptActions } from "@/hooks/use-bulk-script-actions";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import {
  getSocialNetworkDisplayLabel,
  SocialNetworkIcon,
} from "@/components/social-network-icon";
import { RejectionModal } from "./shared/rejection-modal";
import { BulkActionModal } from "./shared/bulk-action-modal";
import { FilterPanel } from "./shared/filter-panel";
import { formatDateOrInstantPtBr } from "@/shared/utils/civil-date";

interface ScriptApprovalTabProps {
  campaignPhases?: CampaignPhase[];
}

export function ScriptApprovalTab({ campaignPhases = [] }: ScriptApprovalTabProps) {
  const { campaignId } = useParams({ from: "/(private)/(app)/campaigns/$campaignId" });

  // Estados de filtros
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("pending");
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>("all");
  const [searchInfluencer, setSearchInfluencer] = useState("");
  const debouncedSearch = useDebounce(searchInfluencer, 350);

  // Estados de UI
  const [selectedScript, setSelectedScript] = useState<CampaignScript | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CampaignScript | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"approve" | "reject" | null>(null);
  const [bulkRejectionFeedback, setBulkRejectionFeedback] = useState("");

  // Buscar roteiros com filtros dinâmicos
  // Nota: A API aceita apenas 'pending', 'approved', 'correction' no filtro
  // Mas os roteiros podem vir com status 'awaiting_approval', então tratamos no frontend
  const filters = useMemo(() => {
    const filter: { status?: string; phase_id?: string } = {};
    // Se o filtro for "pending", não enviamos filtro de status para a API
    // e filtramos no frontend para incluir tanto "pending" quanto "awaiting_approval"
    if (selectedStatusFilter !== "all" && selectedStatusFilter !== "pending") {
      filter.status = selectedStatusFilter;
    }
    if (selectedPhaseFilter !== "all") {
      filter.phase_id = selectedPhaseFilter;
    }
    return filter;
  }, [selectedStatusFilter, selectedPhaseFilter]);

  const {
    data: scripts = [],
    isLoading: isLoadingScripts,
    refetch: refetchScripts,
  } = useCampaignScripts(campaignId || "", filters);

  // Normalizar roteiros conforme formato da API
  const normalizedScripts = useMemo(() => {
    return scripts.map((script: RawCampaignScriptResponse) => ({
      id: script.id,
      campaign_id: script.campaign_id,
      influencer_id: script.influencer_id,
      influencerId: script.influencer_id,
      influencer_name: script.influencer_name,
      influencerName: script.influencer_name || "",
      influencer_avatar: script.influencer_avatar,
      influencerAvatar: script.influencer_avatar || "",
      // Suporte ao novo formato: social_network como objeto ou string
      social_network: script.social_network_type || (typeof script.social_network === "object" && script.social_network !== null ? script.social_network.type : script.social_network) || "",
      social_network_type: script.social_network_type || (typeof script.social_network === "object" && script.social_network !== null ? script.social_network.type : script.social_network) || "",
      social_network_obj: script.social_network || undefined,
      // Novo campo: content_format (pode ser objeto único ou array)
      content_format: script.content_format || undefined,
      // Tipo específico do formato deste script
      content_format_type: script.content_format_type || script.metadata?.content_format_type || null,
      metadata: script.metadata || null,
      // Novo campo: phase como objeto
      phase: script.phase || undefined,
      script: script.script,
      script_text: script.script,
      scriptText: script.script || "",
      file_url: script.file_url,
      status: script.status,
      phase_id: script.phase_id || script.phase?.id || null,
      submitted_at: script.submitted_at,
      submittedAt: script.submitted_at || "",
      approved_at: script.approved_at,
      feedback: script.feedback,
    })) as CampaignScript[];
  }, [scripts]);

  // Filtrar roteiros baseado nos filtros selecionados
  const filteredScripts = useMemo(() => {
    let filtered = normalizedScripts;

    // Filtro por fase já é aplicado na query, mas garantimos aqui também
    if (selectedPhaseFilter !== "all") {
      filtered = filtered.filter((script) => script.phase_id === selectedPhaseFilter);
    }

    // Filtro por status (tratar awaiting_approval como pending)
    if (selectedStatusFilter !== "all") {
      if (selectedStatusFilter === "pending") {
        filtered = filtered.filter((script) =>
          script.status === "pending" || script.status === "awaiting_approval"
        );
      } else if (selectedStatusFilter === "correction") {
        filtered = filtered.filter(
          (script) => script.status === "correction" || script.status === "rejected"
        );
      } else {
        filtered = filtered.filter((script) => script.status === selectedStatusFilter);
      }
    }

    // Filtro por busca de influenciador
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((script) =>
        (script.influencerName || script.influencer_name || "").toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [normalizedScripts, selectedPhaseFilter, selectedStatusFilter, debouncedSearch]);

  // Hooks para mutations
  const { mutate: approveScript, isPending: isApproving } = useApproveScript(campaignId || "");
  const { mutate: rejectScript, isPending: isRejecting } = useRejectScript(campaignId || "");
  const {
    approve: bulkApprove,
    reject: bulkReject,
    isApproving: isBulkApproving,
    isRejecting: isBulkRejecting,
  } = useBulkScriptActions({ campaignId: campaignId || "" });

  const filteredScriptIds = useMemo(() => filteredScripts.map((s) => s.id), [filteredScripts]);
  const {
    selected: selectedScripts,
    toggle: handleSelectScript,
    toggleAll: handleSelectAll,
    clear: clearSelectedScripts,
    isAllSelected: isAllScriptsSelected,
  } = useBulkSelection(filteredScriptIds);

  const handleApprove = (script: CampaignScript) => {
    approveScript(
      { script_id: script.id },
      {
        onSuccess: () => {
          toast.success("Roteiro aprovado com sucesso!");
          refetchScripts();
        },
        onError: (error: Error) => {
          toast.error(error?.message || "Erro ao aprovar roteiro");
        },
      }
    );
  };

  const handleReject = (script: CampaignScript) => {
    setRejectTarget(script);
  };

  const handleConfirmRejection = (feedback: string) => {
    if (!rejectTarget) return;
    rejectScript(
      { script_id: rejectTarget.id, feedback },
      {
        onSuccess: () => {
          toast.success("Roteiro rejeitado com sucesso!");
          setRejectTarget(null);
          refetchScripts();
        },
        onError: (error: Error) => {
          toast.error(error?.message || "Erro ao rejeitar roteiro");
        },
      }
    );
  };

  const handleBulkApprove = () => {
    const scriptIds = Array.from(selectedScripts);
    if (scriptIds.length === 0) {
      toast.error("Selecione pelo menos um roteiro");
      return;
    }

    bulkApprove(scriptIds, {
      onSuccess: () => {
        clearSelectedScripts();
        setBulkActionType(null);
        refetchScripts();
      },
    });
  };

  const handleBulkReject = () => {
    if (!bulkRejectionFeedback.trim()) {
      toast.error("Feedback é obrigatório para reprovação em massa");
      return;
    }

    const scriptIds = Array.from(selectedScripts);
    if (scriptIds.length === 0) {
      toast.error("Selecione pelo menos um roteiro");
      return;
    }

    bulkReject(
      { scriptIds, feedback: bulkRejectionFeedback },
      {
        onSuccess: () => {
          clearSelectedScripts();
          setBulkRejectionFeedback("");
          setBulkActionType(null);
          refetchScripts();
        },
      }
    );
  };

  const handleOpenDetailModal = (script: CampaignScript) => {
    setSelectedScript(script);
    setIsDetailModalOpen(true);
  };

  const getStatusBadge = (status: CampaignScript["status"]) => {
    const statusConfig: Record<
      CampaignScript["status"],
      { text: string; bg: string; textColor: string }
    > = {
      pending: { text: "Pendente", bg: "bg-yellow-50", textColor: "text-yellow-900" },
      awaiting_approval: { text: "Pendente", bg: "bg-yellow-50", textColor: "text-yellow-900" },
      approved: { text: "Aprovado", bg: "bg-green-50", textColor: "text-green-900" },
      correction: {
        text: "Correção Solicitada",
        bg: "bg-orange-50",
        textColor: "text-orange-900",
      },
      rejected: { text: "Rejeitado", bg: "bg-red-50", textColor: "text-red-900" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge
        text={config.text}
        backgroundColor={config.bg}
        textColor={config.textColor}
      />
    );
  };

  // Função auxiliar para obter o número da fase
  const getPhaseNumber = (phaseId?: string | null) => {
    if (!phaseId) return null;
    // Primeiro tenta encontrar na prop campaignPhases
    const phaseIndex = campaignPhases.findIndex((p) => p.id === phaseId);
    if (phaseIndex >= 0) return phaseIndex + 1;
    // Se não encontrar, tenta usar o order do objeto phase no script
    const script = normalizedScripts.find((s) => s.phase_id === phaseId);
    if (script?.phase?.order) return script.phase.order;
    return null;
  };

  // Type guard para verificar se content_format é objeto único
  const isContentFormatObject = (
    format: CampaignScript["content_format"]
  ): format is { social_network: string; formats: Array<{ type: string; quantity: number }> } => {
    return format !== undefined && !Array.isArray(format) && "social_network" in format;
  };

  const phaseOptions = [
    { value: "all", label: "Todas as fases" },
    ...campaignPhases.map((phase, index) => ({
      value: phase.id,
      label: `Fase ${index + 1}`,
    })),
  ];

  const statusFilterLabels: Record<string, string> = {
    pending: "Pendentes",
    approved: "Aprovados",
    correction: "Reprovados",
  };
  const listTitleByStatus: Record<string, string> = {
    pending: "Roteiro pendentes",
    approved: "Roteiro aprovados",
    correction: "Roteiro reprovados",
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        {/* Cabeçalho da seção - alinhado ao Figma */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
            Aprovações de Roteiro
          </h2>
          <p className="text-base text-[#4d4d4d] leading-5">
            Revise, aprove ou solicite ajustes nos textos enviados pelos
            influenciadores antes da etapa de gravação.
          </p>
        </div>

        <FilterPanel
          search={searchInfluencer}
          onSearchChange={setSearchInfluencer}
          phaseOptions={phaseOptions}
          selectedPhase={selectedPhaseFilter}
          onPhaseChange={setSelectedPhaseFilter}
        />

        {/* Card 2: Status pills + lista de roteiros */}
        <div className="bg-white rounded-[12px] p-5 flex flex-col gap-6">
          {/* Header: título dinâmico + pills Pendentes | Aprovados | Reprovados */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              {listTitleByStatus[selectedStatusFilter] || "Roteiro pendentes"} (
              {filteredScripts.length})
            </h3>
            <div className="flex gap-1">
              {(["pending", "approved", "correction"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedStatusFilter(key)}
                  className={`h-11 px-4 py-2.5 rounded-full text-base font-semibold transition-colors ${
                    selectedStatusFilter === key
                      ? "bg-primary-600 text-white"
                      : "border border-[#e5e5e5] text-[#737373] hover:bg-neutral-50"
                  }`}
                >
                  {statusFilterLabels[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Selecionar todos + Múltiplas aprovações */}
          {filteredScripts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                <Checkbox
                  checked={isAllScriptsSelected}
                  onCheckedChange={handleSelectAll}
                  className="rounded-[4px] border-[#c8c8c8] bg-[#f5f5f5] size-6"
                />
                <label className="text-base text-neutral-950 cursor-pointer">
                  Selecionar todos ({filteredScripts.length})
                </label>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedScripts.size > 0) {
                    setBulkActionType("approve");
                  } else {
                    toast.error("Selecione pelo menos um roteiro");
                  }
                }}
                className="h-11 px-6 rounded-full border-[#e5e5e5] text-base font-semibold text-neutral-950"
              >
                Múltiplas aprovações
              </Button>
            </div>
          )}

          {isLoadingScripts ? (
            <div className="text-center py-12">
              <p className="text-neutral-500">Carregando roteiros...</p>
            </div>
          ) : filteredScripts.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="FileText" color="#A3A3A3" size={48} />
              <p className="text-neutral-600 mt-4">Nenhum roteiro encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filteredScripts.map((script) => {
                const resolvedSocialNetwork =
                  script.social_network ||
                  script.social_network_type ||
                  script.social_network_obj?.type ||
                  (isContentFormatObject(script.content_format)
                    ? script.content_format.social_network
                    : "") ||
                  "";

                const networkLabel = getSocialNetworkDisplayLabel(resolvedSocialNetwork);
                const influencerNameLabel =
                  script.influencerName || script.influencer_name || "Sem nome";
                const scriptText =
                  script.script || script.scriptText || script.script_text || "";
                const phaseNumber =
                  script.phase?.order ?? getPhaseNumber(script.phase_id) ?? null;
                const formatLabel =
                  script.content_format_type ||
                  (isContentFormatObject(script.content_format) &&
                    script.content_format.formats?.[0]?.type) ||
                  null;
                const isPending =
                  script.status === "pending" || script.status === "awaiting_approval";
                const isSelected = selectedScripts.has(script.id);

                return (
                  <div
                    key={script.id}
                    className={`flex min-h-[320px] w-full min-w-0 flex-col gap-5 rounded-xl bg-neutral-100 p-3 border transition-colors ${
                      isSelected && isPending
                        ? "border-primary-500 ring-1 ring-primary-200"
                        : "border-transparent"
                    }`}
                  >
                    {/* Topo: avatar (com checkbox circular) + network icon */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="relative shrink-0">
                        <div className="size-[60px] overflow-hidden rounded-2xl bg-neutral-200">
                          <Avatar
                            src={script.influencerAvatar || ""}
                            alt={influencerNameLabel}
                            size="2xl"
                          />
                        </div>
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleSelectScript(script.id)}
                            aria-pressed={isSelected}
                            className="absolute -left-2 -top-2 flex size-7 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm"
                          >
                            {isSelected ? (
                              <Icon name="Check" size={14} color="var(--color-primary-600)" />
                            ) : (
                              <div className="size-3 rounded-full border-2 border-neutral-300" />
                            )}
                          </button>
                        )}
                      </div>

                      {resolvedSocialNetwork && (
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200/90 bg-white shadow-sm"
                          title={networkLabel}
                          aria-label={`Rede: ${networkLabel}`}
                        >
                          <SocialNetworkIcon
                            networkType={resolvedSocialNetwork}
                            size={22}
                            color="#404040"
                          />
                        </div>
                      )}
                    </div>

                    {/* Nome do influenciador */}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-xl font-medium leading-6 text-neutral-950">
                        {influencerNameLabel}
                      </p>
                    </div>

                    {/* Chips: Fase + Formato */}
                    {(phaseNumber != null || formatLabel) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {phaseNumber != null && (
                          <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium leading-tight text-primary-700">
                            Fase {phaseNumber}
                            {campaignPhases.length > 0 ? `/${campaignPhases.length}` : ""}
                          </span>
                        )}
                        {formatLabel && (
                          <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium leading-tight capitalize text-neutral-700">
                            {formatLabel}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Preview do roteiro */}
                    <div className="flex flex-col gap-1 rounded-lg bg-neutral-200 p-3">
                      <p className="text-xs font-medium text-neutral-600">Roteiro</p>
                      <p className="line-clamp-3 min-h-[60px] text-sm leading-5 text-neutral-800">
                        {scriptText || "Sem texto"}
                      </p>
                    </div>

                    {/* Ações por status */}
                    <div className="mt-auto flex flex-col gap-2">
                      {isPending && (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            onClick={() => handleApprove(script)}
                            disabled={isApproving || isRejecting}
                            className="h-11 flex-1 rounded-full border-0 bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
                          >
                            <Icon name="Check" size={20} color="#fafafa" />
                            Aprovar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleOpenDetailModal(script)}
                            className="h-11 flex-1 rounded-full border-neutral-200 text-base font-semibold text-neutral-600 hover:bg-neutral-50"
                          >
                            Avaliar
                          </Button>
                        </div>
                      )}
                      {script.status === "approved" && (
                        <p className="text-base font-medium text-neutral-600">
                          Aprovado
                        </p>
                      )}
                      {(script.status === "correction" || script.status === "rejected") && (
                        <Button
                          variant="outline"
                          onClick={() => handleOpenDetailModal(script)}
                          className="h-11 rounded-full border-neutral-200 text-base font-semibold text-neutral-600 hover:bg-neutral-50"
                        >
                          Visualizar feedback
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhes do roteiro */}
      {selectedScript && isDetailModalOpen && (
        <Modal
          title="Roteiro completo"
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedScript(null);
          }}
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Avatar
                src={selectedScript.influencerAvatar || ""}
                alt={selectedScript.influencerName || selectedScript.influencer_name || ""}
                size="lg"
              />
              <div>
                <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
                  {selectedScript.influencerName || selectedScript.influencer_name || "Sem nome"}
                </h3>
                <div className="mt-2">{getStatusBadge(selectedScript.status)}</div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-950 mb-2 block">
                Roteiro:
              </label>
              <div className="bg-canvas rounded-[22px] p-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-neutral-950 whitespace-pre-wrap">
                  {selectedScript.script || selectedScript.scriptText || selectedScript.script_text || "Sem texto"}
                </p>
              </div>
            </div>

            {selectedScript.file_url && (
              <div>
                <label className="text-sm font-medium text-neutral-950 mb-2 block">
                  Arquivo anexado:
                </label>
                <a
                  href={selectedScript.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-2"
                >
                  <Icon name="File" color="#2563eb" size={16} />
                  <span>Baixar arquivo</span>
                </a>
              </div>
            )}

            {/* Informações da fase */}
            {(selectedScript.phase || selectedScript.phase_id) && (
              <div>
                <label className="text-sm font-medium text-neutral-950 mb-2 block">
                  Fase {selectedScript.phase?.order || getPhaseNumber(selectedScript.phase_id) || "?"}:
                </label>
                {selectedScript.phase ? (
                  <div className="bg-canvas rounded-[22px] p-4">
                    <p className="text-sm text-neutral-950 font-medium mb-1">
                      {selectedScript.phase.objective}
                    </p>
                    {selectedScript.phase.publish_date && (
                      <p className="text-xs text-neutral-600">
                        Data de publicação: {formatDateOrInstantPtBr(selectedScript.phase.publish_date)}
                        {selectedScript.phase.publish_time && ` às ${selectedScript.phase.publish_time.slice(0, 5)}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-canvas rounded-[22px] p-4">
                    <p className="text-sm text-neutral-600">Informações da fase não disponíveis</p>
                  </div>
                )}
              </div>
            )}

            {/* Informações de rede social e formato */}
            {(selectedScript.content_format || selectedScript.content_format_type) && (
              <div>
                <label className="text-sm font-medium text-neutral-950 mb-2 block">
                  Rede social e formato:
                </label>
                <div className="bg-canvas rounded-[22px] p-4">
                  {selectedScript.content_format_type && (
                    <div>
                      <p className="text-sm text-neutral-950 font-medium mb-1">Tipo de formato:</p>
                      <p className="text-sm text-neutral-600 capitalize">{selectedScript.content_format_type}</p>
                    </div>
                  )}
                  {selectedScript.content_format && (
                    <>
                      {/* Suporte para content_format como objeto único */}
                      {isContentFormatObject(selectedScript.content_format) && selectedScript.content_format.formats && (
                        <div className={selectedScript.content_format_type ? "mt-3 pt-3 border-t border-neutral-200" : ""}>
                          <p className="text-sm text-neutral-950 font-medium mb-2 capitalize">
                            {selectedScript.content_format.social_network}
                          </p>
                          {selectedScript.content_format.formats.length > 0 && (
                            <ul className="list-disc list-inside space-y-1">
                              {selectedScript.content_format.formats.map((format: any, idx: number) => (
                                <li key={idx} className="text-sm text-neutral-600">
                                  {format.type} - {format.quantity}x
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {/* Suporte para content_format como array (retrocompatibilidade) */}
                      {Array.isArray(selectedScript.content_format) && selectedScript.content_format.length > 0 && (
                        <>
                          {selectedScript.content_format.map((contentFormat: any, formatIdx: number) => (
                            <div key={formatIdx} className={formatIdx > 0 || selectedScript.content_format_type ? "mt-3 pt-3 border-t border-neutral-200" : ""}>
                              <p className="text-sm text-neutral-950 font-medium mb-2 capitalize">
                                {contentFormat.social_network}
                              </p>
                              {contentFormat.formats && contentFormat.formats.length > 0 && (
                                <ul className="list-disc list-inside space-y-1">
                                  {contentFormat.formats.map((format: any, idx: number) => (
                                    <li key={idx} className="text-sm text-neutral-600">
                                      {format.type} - {format.quantity}x
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {selectedScript.social_network && !selectedScript.social_network_obj && (
              <div>
                <label className="text-sm font-medium text-neutral-950 mb-2 block">
                  Rede social:
                </label>
                <p className="text-sm text-neutral-600 capitalize">
                  {selectedScript.social_network}
                </p>
              </div>
            )}

            {selectedScript.feedback && (
              <div>
                <label className="text-sm font-medium text-neutral-950 mb-2 block">
                  Feedback:
                </label>
                <div className="bg-warning-50 rounded-2xl p-4">
                  <p className="text-sm text-warning-900">
                    {selectedScript.feedback}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedScript(null);
                }}
                className="flex-1"
              >
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleApprove(selectedScript);
                }}
                className="flex-1"
                disabled={isApproving || isRejecting}
              >
                Aprovar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleReject(selectedScript);
                }}
                className="flex-1"
                disabled={isApproving || isRejecting}
              >
                Reprovar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de reprovação individual */}
      {rejectTarget && (
        <RejectionModal
          influencer={{
            id: rejectTarget.id,
            name: rejectTarget.influencerName || rejectTarget.influencer_name || "Sem nome",
            avatar: rejectTarget.influencerAvatar || "",
          }}
          onConfirm={handleConfirmRejection}
          onClose={() => setRejectTarget(null)}
        />
      )}

      {/* Modal de ação em massa */}
      <BulkActionModal
        actionType={bulkActionType}
        count={selectedScripts.size}
        rejectionFeedback={bulkRejectionFeedback}
        onRejectionFeedbackChange={setBulkRejectionFeedback}
        onConfirm={bulkActionType === "approve" ? handleBulkApprove : handleBulkReject}
        onClose={() => { setBulkActionType(null); setBulkRejectionFeedback(""); }}
        isLoading={isBulkApproving || isBulkRejecting}
      />
    </>
  );
}
