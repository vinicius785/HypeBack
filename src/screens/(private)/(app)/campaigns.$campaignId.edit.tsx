import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CreateCampaignStepOne } from "@/components/forms/create-campaign-step-one";
import { CreateCampaignStepTwo } from "@/components/forms/create-campaign-step-two";
import { CreateCampaignStepThree } from "@/components/forms/create-campaign-step-three";
import { CreateCampaignStepFour } from "@/components/forms/create-campaign-step-four";
import { CreateCampaignStepFive } from "@/components/forms/create-campaign-step-five";
import { CreateCampaignStepSeven } from "@/components/forms/create-campaign-step-seven";

import type { CampaignFormData, CampaignProductDraft } from "@/shared/types";
import { useCampaign } from "@/hooks/use-campaigns";
import { useUpdateCampaign } from "@/hooks/use-campaigns";
import { useCampaignDashboard } from "@/hooks/use-campaign-dashboard";
import {
  campaignPhasesListIsPresent,
  mapApiPhasesToCampaignPhases,
} from "@/shared/services/dashboard";
import { uploadCampaignBanner } from "@/shared/services/campaign";
import { formatReais } from "@/shared/utils/masks";
import { suggestMuralEndDateFromFormPhases } from "@/shared/utils/date-validations";
import type { CampaignPhaseUpsertPayload } from "@/shared/services/phase";
import {
  buildCampaignUpdatePayloadFromForm,
  buildPhasesPayloadFromForm,
  buildPutCampaignUpdateBody,
  mergePaymentDetailsWithServer,
} from "@/shared/utils/campaign-edit-request";
import { activateMural } from "@/shared/services/mural";
import { isNicheRoot } from "@/shared/utils/niche-tree";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCampaignProducts,
  createCampaignProduct,
  updateCampaignProduct,
  deleteCampaignProduct,
  type CampaignProduct,
} from "@/shared/services/campaign-products";
import { getUploadUrl } from "@/lib/utils/api";
import { useNiches } from "@/hooks/use-niches";
import { getCampaignStatusValue } from "@/shared/utils/campaign-status";

export const Route = createFileRoute("/(private)/(app)/campaigns/$campaignId/edit")({
  component: RouteComponent,
});

/** Mesmo stepper da criação (6 passos). */
const STEP_LABELS = [
  "Briefing",
  "Influenciadores",
  "Remuneração",
  "Materiais",
  "Fases",
  "Revisão",
];

function RouteComponent() {
  const navigate = useNavigate();
  const { campaignId } = useParams({ from: "/(private)/(app)/campaigns/$campaignId/edit" });
  const [currentStep, setCurrentStep] = useState(6);
  const [focusPhaseId, setFocusPhaseId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const formInitializedRef = useRef(false);
  /** Snapshot campanha (sem substituir fases) + fases — para diff alinhado à API de PUT. */
  const initialCampaignApiPayloadRef = useRef<ReturnType<
    typeof buildCampaignUpdatePayloadFromForm
  > | null>(null);
  const initialPhasesApiPayloadRef = useRef<CampaignPhaseUpsertPayload[] | null>(null);
  /** IDs dos produtos que vieram do servidor (para diff no save). */
  const serverProductIdsRef = useRef<Set<string>>(new Set());

  // Buscar dados da campanha
  const {
    data: campaign,
    isLoading: isLoadingCampaign,
    error: campaignError,
  } = useCampaign(campaignId);

  // Buscar fases da campanha
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
  } = useCampaignDashboard(campaignId);

  const phasesFromCampaignDetail = useMemo(() => {
    if (!campaign || !campaignPhasesListIsPresent(campaign.phases)) {
      return null;
    }
    return mapApiPhasesToCampaignPhases(campaign.phases);
  }, [campaign, campaign?.phases]);

  const phases =
    phasesFromCampaignDetail !== null
      ? phasesFromCampaignDetail
      : dashboardData?.phases ?? [];
  const updateCampaignMutation = useUpdateCampaign();
  
  // Buscar nichos para determinar o nicho principal na edição
  const { data: niches = [] } = useNiches();

  // Buscar produtos existentes da campanha (só necessário para swap)
  const {
    data: serverProducts = [],
    isSuccess: productsLoaded,
  } = useQuery({
    queryKey: ["campaigns", campaignId, "products"],
    queryFn: () => getCampaignProducts(campaignId),
    enabled: !!campaignId,
    staleTime: 60_000,
  });

  // Inicializar formData com dados da campanha
  const [formData, setFormData] = useState<CampaignFormData>({
    title: "",
    description: "",
    mainNiche: "",
    subniches: "",
    influencersCount: "",
    minFollowers: "",
    state: "",
    city: "",
    gender: "",
    paymentType: "",
    paymentFixedAmount: "",
    paymentSwapItem: "",
    paymentSwapMarketValue: "",
    paymentCpaActions: "",
    paymentCpaValue: "",
    paymentCpmValue: "",
    benefits: "",
    generalObjective: "",
    whatToDo: "",
    whatNotToDo: "",
    banner: "",
    imageRightsPeriod: "",
    brandFiles: "",
    phasesCount: "1",
    phases: [],
    benefitsBonus: "",
    campaignVisibility: "public",
  });

  // Carregar dados da campanha no formData apenas uma vez (quando campanha E nichos disponíveis)
  useEffect(() => {
    if (formInitializedRef.current) return;
    if (!campaign || !phases) return;
    // Aguarda os nichos carregarem para poder separar raiz vs. filho corretamente
    if (niches.length === 0) return;
    // Para campanhas de permuta, aguarda os produtos carregarem antes de inicializar
    if (campaign.payment_method === "swap" && !productsLoaded) return;

    formInitializedRef.current = true;

    // Extrair IDs numéricos diretamente da resposta da API (secondary_niches pode ser
    // Array<{ id, name }> ou number[])
    const allNicheIds: string[] = Array.isArray(campaign.secondary_niches)
      ? campaign.secondary_niches
          .map((n: any) => (typeof n === "object" && n !== null ? String(n.id) : String(n)))
          .filter(Boolean)
      : [];

    const mainNicheIds: string[] = [];
    const subnicheIds: string[] = [];

    // Nicho primário explícito tem precedência
    if (campaign.primary_niche?.id != null) {
      mainNicheIds.push(String(campaign.primary_niche.id));
    }

    // Separar raízes de filhos usando a árvore carregada
    allNicheIds.forEach((id) => {
      const niche = niches.find((n) => String(n.id) === id);
      if (niche && isNicheRoot(niche)) {
        if (!mainNicheIds.includes(id)) mainNicheIds.push(id);
      } else {
        subnicheIds.push(id);
      }
    });

    const parseBenefits = (raw: string | string[] | undefined): string[] => {
      if (!raw) return [""];
      if (Array.isArray(raw)) {
        const filtered = raw.filter((item) => item.trim() !== "");
        return filtered.length > 0 ? filtered : [""];
      }
      const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.some((l) => l.startsWith(".") || l.startsWith("-") || l.startsWith("•"))) {
        return lines
          .filter((l) => l.startsWith(".") || l.startsWith("-") || l.startsWith("•"))
          .map((l) => l.replace(/^[.\-•]\s*/, "").trim())
          .filter(Boolean);
      }
      return lines.length > 0 ? lines : [""];
    };

    const toStringArray = (raw: string | string[] | undefined): string[] => {
      if (!raw) return [""];
      if (Array.isArray(raw)) return raw;
      return [raw];
    };

    const initialForm: CampaignFormData = {
      title: campaign.title || "",
      description: campaign.description || "",
      mainNiche: mainNicheIds.join(","),
      subniches: subnicheIds.join(","),
      influencersCount: campaign.max_influencers?.toString() || "0",
      minFollowers: campaign.segment_min_followers
        ? campaign.segment_min_followers.toString()
        : "",
      state: Array.isArray(campaign.segment_state)
        ? campaign.segment_state.join(",")
        : campaign.segment_state || "",
      city: Array.isArray(campaign.segment_city)
        ? campaign.segment_city.join(",")
        : campaign.segment_city || "",
      gender: Array.isArray(campaign.segment_genders)
        ? campaign.segment_genders[0] || "all"
        : campaign.segment_genders || "all",
      paymentType: campaign.payment_method || "",
      paymentFixedAmount:
        campaign.payment_method === "fixed" && campaign.payment_method_details?.amount
          ? formatReais(campaign.payment_method_details.amount)
          : "",
      paymentSwapItem:
        campaign.payment_method === "swap" && campaign.payment_method_details?.description
          ? campaign.payment_method_details.description.split(" - Valor de mercado:")[0]?.trim() || ""
          : "",
      paymentSwapMarketValue:
        campaign.payment_method === "swap" && campaign.payment_method_details?.amount
          ? formatReais(campaign.payment_method_details.amount)
          : "",
      paymentCpaActions:
        campaign.payment_method === "cpa" && campaign.payment_method_details?.description
          ? campaign.payment_method_details.description
              .replace("Ações que geram CPA:", "")
              .split(" - Valor:")[0]
              ?.trim() || ""
          : "",
      paymentCpaValue:
        campaign.payment_method === "cpa" && campaign.payment_method_details?.amount
          ? formatReais(campaign.payment_method_details.amount)
          : "",
      paymentCpmValue:
        campaign.payment_method === "cpm" && campaign.payment_method_details?.amount
          ? formatReais(campaign.payment_method_details.amount)
          : "",
      benefits: parseBenefits(campaign.benefits),
      generalObjective: campaign.objective || "",
      whatToDo: toStringArray(campaign.rules_does),
      whatNotToDo: toStringArray(campaign.rules_does_not),
      banner: campaign.banner ? getUploadUrl(campaign.banner) || campaign.banner : "",
      imageRightsPeriod: campaign.image_rights_period?.toString() || "0",
      brandFiles: "",
      phasesCount: phases.length.toString(),
      phases: [...phases]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((phase) => ({
          ...phase,
          includeImageRights: (campaign.image_rights_period ?? 0) > 0,
          imageRightsPeriod:
            (campaign.image_rights_period ?? 0) > 0
              ? String(campaign.image_rights_period)
              : "",
          files: phase.files ?? "",
        })),
      // Recupera o bonus embutido em payment_method_details.description ("Bônus: X")
      benefitsBonus: (() => {
        const desc = campaign.payment_method_details?.description ?? "";
        const m = desc.match(/Bônus:\s*(.+?)(?:\n\n|$)/);
        return m ? m[1].trim() : "";
      })(),
      campaignVisibility: campaign.status === "draft" ? "private" : "public",
      products: campaign.payment_method === "swap"
        ? serverProducts.map((p: CampaignProduct) => ({
            id: p.id,
            serverId: p.id,
            name: p.name,
            description: p.description ?? "",
            market_value: p.market_value_cents ? (p.market_value_cents / 100).toFixed(2).replace(".", ",") : "",
            weight_grams: p.weight_grams?.toString() ?? "",
            width_cm: p.dimensions?.width_cm?.toString() ?? "",
            height_cm: p.dimensions?.height_cm?.toString() ?? "",
            length_cm: p.dimensions?.length_cm?.toString() ?? "",
            brand: p.brand ?? "",
            sku: p.sku ?? "",
            notes: p.notes ?? "",
            images: p.images ?? [],
            pendingImageFiles: [],
          } satisfies CampaignProductDraft))
        : undefined,
    };

    // Registrar IDs dos produtos do servidor para diff no save
    serverProductIdsRef.current = new Set(serverProducts.map((p: CampaignProduct) => p.id));

    const rawInitialPayload = buildCampaignUpdatePayloadFromForm(initialForm);
    initialCampaignApiPayloadRef.current = mergePaymentDetailsWithServer(
      rawInitialPayload,
      campaign,
    );
    initialPhasesApiPayloadRef.current = buildPhasesPayloadFromForm(initialForm);
    setFormData(initialForm);
  }, [campaign, phases, niches, productsLoaded, serverProducts]);

  const totalSteps = 6;

  // Identidade estável e obrigatória: vários steps declaram `updateFormData` no array
  // de dependências de useEffect. Sem useCallback a função é recriada a cada render,
  // o efeito redispara, o setState causa novo render — "Maximum update depth exceeded".
  const updateFormData = useCallback((field: keyof CampaignFormData, value: unknown) => {
    setFormData((prev) => {
      // Bail-out: gravar o mesmo valor não deve produzir render. O spread cria sempre
      // um objeto novo, então sem esta guarda o React nunca consegue abortar a atualização.
      if (Object.is(prev[field], value)) return prev;
      return { ...prev, [field]: value };
    });
    setFieldErrors((prev) => {
      if (!prev.has(field as string)) return prev;
      const next = new Set(prev);
      next.delete(field as string);
      return next;
    });
  }, []);

  // Handler para submissão do formulário
  const handleSubmitCampaign = async () => {
    try {
      if (!campaign) {
        toast.error("Campanha não carregada. Atualize a página e tente de novo.");
        return;
      }
      const missing: { step: number; field: string; label: string }[] = [];

      // Step 1
      if (!formData.title?.trim()) missing.push({ step: 1, field: "title", label: "Título da campanha" });
      if (!formData.description?.trim()) missing.push({ step: 1, field: "description", label: "Descrição da campanha" });
      const whatToDoArr = Array.isArray(formData.whatToDo)
        ? formData.whatToDo.filter((s) => s.trim())
        : formData.whatToDo?.trim() ? [formData.whatToDo] : [];
      if (!whatToDoArr.length) missing.push({ step: 1, field: "whatToDo", label: "O que fazer" });
      const whatNotToDoArr = Array.isArray(formData.whatNotToDo)
        ? formData.whatNotToDo.filter((s) => s.trim())
        : formData.whatNotToDo?.trim() ? [formData.whatNotToDo] : [];
      if (!whatNotToDoArr.length) missing.push({ step: 1, field: "whatNotToDo", label: "O que não fazer" });

      // Step 2
      if (!formData.influencersCount?.trim()) missing.push({ step: 2, field: "influencersCount", label: "Quantidade de influenciadores" });

      // Step 3
      if (!formData.paymentType?.trim()) missing.push({ step: 3, field: "paymentType", label: "Tipo de remuneração" });

      // Step 4
      if (!formData.banner?.trim()) missing.push({ step: 4, field: "banner", label: "Banner da campanha" });

      // Step 5
      const phasesArr = formData.phases ?? [];
      if (!phasesArr.length || phasesArr.some((p) => !p.objective?.trim() || !p.postDate?.trim() || !p.formats?.length)) {
        missing.push({ step: 5, field: "phases", label: "Fases da campanha" });
      }

      if (missing.length > 0) {
        setFieldErrors(new Set(missing.map((m) => m.field)));
        setCurrentStep(missing[0].step);
        const labels = missing.map((m) => m.label);
        const description =
          labels.length <= 3 ? labels.join(", ") : `${labels.slice(0, 3).join(", ")} e mais ${labels.length - 3}`;
        toast.error("Campos obrigatórios não preenchidos", { description });
        return;
      }

      const campaignDataRaw = buildCampaignUpdatePayloadFromForm(formData);
      const nextMerged = mergePaymentDetailsWithServer(campaignDataRaw, campaign);
      const baseline = initialCampaignApiPayloadRef.current;
      const baselinePhases = initialPhasesApiPayloadRef.current ?? [];
      const nextPhases = buildPhasesPayloadFromForm(formData);

      const putBody = baseline
        ? buildPutCampaignUpdateBody({
            baseline,
            nextMerged,
            baselinePhases,
            nextPhases,
          })
        : { ...nextMerged, phases: nextPhases };

      await updateCampaignMutation.mutateAsync({
        campaignId,
        data: putBody,
      });

      // Sincronizar produtos (somente para campanhas de permuta)
      if (formData.paymentType === "swap") {
        try {
          const currentProducts = (formData.products ?? []).filter((p) => p.name.trim());
          const originalIds = serverProductIdsRef.current;
          const currentIds = new Set(currentProducts.map((p) => p.id));

          await Promise.all([
            // Criar novos produtos (ID não existe no servidor)
            ...currentProducts
              .filter((p) => !originalIds.has(p.id))
              .map((p) => createCampaignProduct(campaignId, p)),
            // Atualizar produtos existentes
            ...currentProducts
              .filter((p) => originalIds.has(p.id))
              .map((p) => updateCampaignProduct(campaignId, p.id, p)),
            // Deletar produtos removidos
            ...[...originalIds]
              .filter((id) => !currentIds.has(id))
              .map((id) => deleteCampaignProduct(campaignId, id)),
          ]);

          queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "products"] });
        } catch (err) {
          console.error("[edit] erro ao sincronizar produtos:", err);
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          toast.error(`Campanha salva, mas houve um erro ao salvar os produtos: ${msg}`);
        }
      }

      // Fazer upload do banner se houver novo arquivo
      const bannerFile = (formData as any).bannerFile;
      if (bannerFile instanceof File) {
        try {
          await uploadCampaignBanner(campaignId, bannerFile);
        } catch {
          toast.error("Campanha atualizada, mas houve um erro ao fazer upload do banner.");
        }
      }

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "dashboard"] });

      let successDescription: string | undefined;
      const stillDraft = getCampaignStatusValue(campaign?.status) === "draft";
      if (formData.campaignVisibility !== "private" && stillDraft) {
        const muralEnd = suggestMuralEndDateFromFormPhases(formData.phases);
        if (muralEnd) {
          try {
            await activateMural(campaignId, { end_date: muralEnd });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", campaignId, "mural"],
            });
            successDescription =
              "A campanha está no mural (Descobrir) com data limite sugerida a partir da fase 1.";
          } catch {
            toast.error(
              "Campanha salva, mas não foi possível ativar o Descobrir. Ative manualmente na campanha."
            );
          }
        } else {
          successDescription =
            "Ajuste a data da fase 1 ou ative o Descobrir manualmente na campanha.";
        }
      }

      toast.success("Campanha atualizada com sucesso!", {
        ...(successDescription ? { description: successDescription } : {}),
      });
      navigate({ to: "/campaigns/$campaignId", params: { campaignId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar campanha. Tente novamente.";
      toast.error(message);
    }
  };

  const handleContinue = () => {
    if (currentStep < totalSteps) {
      if (currentStep === 5) setFocusPhaseId(null);
      setCurrentStep((s) => s + 1);
    }
  };

  const handleFooterBack = () => {
    if (currentStep <= 1) {
      navigate({ to: "/campaigns/$campaignId", params: { campaignId } });
    } else {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleEditFromReview = (step: number) => {
    if (step === 5) setFocusPhaseId(null);
    setCurrentStep(step);
  };

  const handleEditPhase = (phaseIndex: number) => {
    const p = formData.phases[phaseIndex];
    if (p?.id) {
      setFocusPhaseId(p.id);
      setCurrentStep(5);
    }
  };

  if (isLoadingCampaign || isLoadingDashboard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-neutral-600">Carregando...</p>
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-neutral-600">Erro ao carregar campanha</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-min shrink-0 rounded-[24px] border-[#e5e5e5] px-3"
          onClick={() => navigate({ to: "/campaigns/$campaignId", params: { campaignId } })}
        >
          <Icon name="ArrowLeft" size={16} color="#404040" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-neutral-950 truncate">Editar campanha</h1>
          <p className="text-sm text-neutral-600 truncate">{campaign.title}</p>
        </div>
      </div>

      <div className="flex gap-4 items-center mb-8 w-full">
        {STEP_LABELS.map((label, index) => {
          const stepNum = index + 1;
          const isActive = currentStep === stepNum;
          return (
            <div key={`edit-step-${stepNum}`} className="flex gap-4 items-center shrink-0">
              <button
                type="button"
                className={`flex gap-2 items-center justify-center pb-3 shrink-0 text-left cursor-pointer ${
                  isActive ? "border-b-[3px] border-tertiary-500" : ""
                }`}
                onClick={() => {
                  if (stepNum === 5) setFocusPhaseId(null);
                  setCurrentStep(stepNum);
                }}
              >
                <div
                  className={`flex items-center justify-center rounded-full size-7 text-sm font-bold shrink-0 ${
                    isActive
                      ? "bg-tertiary-500 text-white"
                      : "border border-[#e5e5e5] text-[#7c7c7c]"
                  }`}
                >
                  {stepNum}
                </div>
                <span className="text-base whitespace-nowrap text-[#7c7c7c]">{label}</span>
              </button>
              {index < STEP_LABELS.length - 1 && (
                <div
                  className="h-px flex-1 min-w-[40px] bg-[#e5e5e5] self-center"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-[12px] p-6 flex-1">
        {currentStep === 1 && (
          <CreateCampaignStepOne formData={formData} updateFormData={updateFormData} fieldErrors={fieldErrors} />
        )}
        {currentStep === 2 && (
          <CreateCampaignStepTwo
            formData={formData}
            updateFormData={updateFormData}
            onBack={() => setCurrentStep(1)}
            onNext={handleContinue}
            hideBackButton
            fieldErrors={fieldErrors}
          />
        )}
        {currentStep === 3 && (
          <CreateCampaignStepThree
            formData={formData}
            updateFormData={updateFormData}
            onBack={() => setCurrentStep(2)}
            onNext={handleContinue}
            hideBackButton
            fieldErrors={fieldErrors}
          />
        )}
        {currentStep === 4 && (
          <CreateCampaignStepFour
            formData={formData}
            updateFormData={updateFormData}
            onBack={() => setCurrentStep(3)}
            onNext={handleContinue}
            hideBackButton
            fieldErrors={fieldErrors}
          />
        )}
        {currentStep === 5 && (
          <CreateCampaignStepFive
            formData={formData}
            updateFormData={updateFormData}
            onBack={() => setCurrentStep(4)}
            onNext={handleContinue}
            hideBackButton
            focusPhaseId={focusPhaseId}
          />
        )}
        {currentStep === 6 && (
          <CreateCampaignStepSeven
            formData={formData}
            updateFormData={updateFormData}
            onBack={() => setCurrentStep(5)}
            onEdit={handleEditFromReview}
            onSubmitCampaign={handleSubmitCampaign}
            isLoading={updateCampaignMutation.isPending}
            onReviewBack={() =>
              navigate({ to: "/campaigns/$campaignId", params: { campaignId } })
            }
            onEditPhase={handleEditPhase}
            submitButtonLabel="Salvar alterações"
            submitLoadingLabel="Salvando..."
            reviewSubtitle="Escolha uma seção abaixo ou edite uma fase específica. Depois, salve as alterações."
          />
        )}
      </div>

      {currentStep < 6 && (
        <div className="mt-10 flex items-center justify-between gap-4 rounded-xl border-t border-[#e5e5e5] bg-[#FAFAFA] p-6 z-10">
          <Button
            type="button"
            variant="outline"
            onClick={handleFooterBack}
            className="h-11 min-w-0 shrink-0 rounded-[24px] border-[#e5e5e5] px-4 font-semibold text-neutral-700 w-min"
          >
            <span className="flex items-center gap-2">
              <Icon name="ArrowLeft" color="#404040" size={16} />
              Voltar
            </span>
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            className="h-11 shrink-0 rounded-[24px] bg-primary-600 px-4 font-semibold text-white hover:bg-primary-700 w-min"
          >
            <span className="flex items-center gap-2">
              Continuar
              <Icon name="ArrowRight" color="#FAFAFA" size={16} />
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
