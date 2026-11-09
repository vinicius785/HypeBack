import { buildCpaDescription, cpaHasAmount } from "@/shared/utils/cpa-payment";
import { useState, useCallback, useEffect, useRef } from "react";
import { discardCampaignDraft, readCampaignDraft, saveCampaignDraft } from "@/lib/campaign-draft";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { StepCampaign } from "@/components/campaign-wizard/step-campaign";
import { StepCreators } from "@/components/campaign-wizard/step-creators";
import { StepPayment } from "@/components/campaign-wizard/step-payment";
import { StepPhases } from "@/components/campaign-wizard/step-phases";
import { WizardShell } from "@/components/campaign-wizard/wizard-shell";
import { wizardMissing } from "@/components/campaign-wizard/config";
import { useSyncBrandRequired } from "@/components/campaign-wizard/use-brand-required";
import { bannerFileForUpload } from "@/lib/campaign-banner";
import { gendersOf } from "@/shared/utils/campaign-segment";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { createAllCampaignProducts } from "@/shared/services/campaign-products";
import type { CampaignFormData } from "@/shared/types";
import { useCreateCampaign } from "@/hooks/use-campaigns";
import type { CreateCampaignData } from "@/shared/services/campaign";
import type { CreatePhaseData } from "@/shared/services/phase";
import { uploadCampaignBanner } from "@/shared/services/campaign";
import { unformatNumber, currencyToNumber } from "@/shared/utils/masks";
import { suggestMuralEndDateFromFormPhases } from "@/shared/utils/date-validations";
import { aggregateImageRightsPeriodMonths } from "@/shared/utils/campaign-image-rights";
import { activateMural } from "@/shared/services/mural";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/(app)/campaigns/new")({
  // `draft`: id do rascunho a retomar. Sem ele a tela abre em branco, mesmo havendo rascunhos salvos.
  validateSearch: (search: Record<string, unknown>): { draft?: string } =>
    typeof search.draft === "string" && search.draft ? { draft: search.draft } : {},
  component: CreateCampaignPage,
});

const initialFormData: CampaignFormData = {
  title: "",
  description: "",
  mainNiche: "",
  subniches: "",
  influencersCount: "",
  minFollowers: "",
  state: "",
  city: "",
  gender: "all",
  paymentType: "",
  paymentFixedAmount: "",
  paymentSwapItem: "",
  paymentSwapMarketValue: "",
  paymentCpaActions: "",
  paymentCpaValue: "",
  paymentCpaMode: "value",
  paymentCpaPercent: "",
  paymentCpaNote: "",
  paymentCpmValue: "",
  benefitsBonus: "",
  benefits: "",
  generalObjective: "",
  whatToDo: "",
  whatNotToDo: "",
  banner: "",
  imageRightsPeriod: "",
  brandFiles: "",
  phasesCount: "1",
  phases: [
    {
      id: "1",
      objective: "",
      postDate: "",
      postTime: "18:00",
      includeImageRights: false,
      imageRightsPeriod: "",
      formats: [],
      files: "",
    },
  ],
  campaignVisibility: "public",
};

interface CampaignDraft {
  data: CampaignFormData;
  step: number;
}

/**
 * Lê o rascunho `id` do localStorage. Retorna `null` quando não existe mais ou o localStorage está indisponível
 * (modo privado/quota). Mescla sobre `initialFormData` para tolerar rascunhos de versões antigas do formulário
 * (campos novos entram com default em vez de ficar `undefined`).
 */
function loadCampaignDraft(id: string | undefined): CampaignDraft | null {
  if (!id) return null;
  const stored = readCampaignDraft<CampaignFormData>(id);
  if (!stored) return null;
  return { data: { ...initialFormData, ...stored.data }, step: stored.step };
}

function CreateCampaignPage() {
  const { draft } = Route.useSearch();
  // `key`: trocar de rascunho (ou voltar ao em branco) remonta o formulário em vez de reaproveitar o estado.
  return <CreateCampaignForm key={draft ?? "new"} draftId={draft} />;
}

function CreateCampaignForm({ draftId }: { draftId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Lê o rascunho UMA vez na montagem (ref-guard) e reusa nos inicializadores
  // de estado — evita ler o localStorage a cada render.
  const initialDraftRef = useRef<CampaignDraft | null | undefined>(undefined);
  if (initialDraftRef.current === undefined) {
    initialDraftRef.current = loadCampaignDraft(draftId);
  }
  const initialDraft = initialDraftRef.current;

  const [currentStep, setCurrentStep] = useState(Math.min(4, Math.max(1, initialDraft?.step ?? 1)));
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const { selectedWorkspace } = useWorkspaceContext();
  const isAgencyWorkspace = selectedWorkspace?.account_type === "agency";
  // `brandRequired` é da tela (workspace de agência), nunca vem do rascunho salvo: um rascunho de antes de o
  // workspace virar agência não pode esconder o campo.
  const [formData, setFormData] = useState<CampaignFormData>(() => ({
    ...(initialDraft?.data ?? initialFormData),
    brandRequired: isAgencyWorkspace,
  }));
  // O workspace pode carregar depois da primeira renderização: a marca obrigatória acompanha o tipo dele.
  useSyncBrandRequired(isAgencyWorkspace, setFormData);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  // Controla a visibilidade do "Descartar rascunho": só faz sentido quando há
  // um rascunho (restaurado na montagem ou salvo durante esta sessão).
  const [hasDraft, setHasDraft] = useState<boolean>(!!initialDraft);
  // Id do rascunho em edição: o recebido pela URL ou o criado ao salvar pela primeira vez.
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(initialDraft ? (draftId ?? null) : null);

  // Avisa (uma vez) que o rascunho foi restaurado, para o usuário não achar que
  // entrou num formulário "sujo" por engano.
  useEffect(() => {
    if (initialDraft) {
      toast.info("Rascunho restaurado", {
        description: "Continuamos de onde você parou neste navegador.",
        duration: 5000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCampaignMutation = useCreateCampaign();
  const isSwap = formData.paymentType === "swap";
  const [tried, setTried] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

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

  const transformFormDataToApiData = (formData: CampaignFormData): CreateCampaignData => {
    const subnicheIds = formData.subniches
      ? formData.subniches.split(",").filter(Boolean).map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
      : [];
    const mainNicheIds = formData.mainNiche
      ? formData.mainNiche.split(",").filter(Boolean).map((id) => parseInt(id, 10)).filter((id) => !isNaN(id))
      : [];
    const secondary_niches = [...new Set([...mainNicheIds, ...subnicheIds])];

    const benefitsFiltered = Array.isArray(formData.benefits)
      ? formData.benefits.filter((item) => item.trim() !== "")
      : formData.benefits
        ? [String(formData.benefits).trim()].filter((item) => item !== "")
        : [];

    const buildPaymentDetails = () => {
      const benefitsList = Array.isArray(formData.benefits)
        ? formData.benefits.filter((item) => item.trim() !== "")
        : formData.benefits ? [String(formData.benefits).trim()].filter(Boolean) : [];
      const parts: string[] = [];
      if (formData.benefitsBonus?.trim()) {
        parts.push(`Bônus: ${formData.benefitsBonus.trim()}`);
      }
      if (benefitsList.length > 0) {
        parts.push(benefitsList.join("\n"));
      }
      const baseDetails: { amount?: number; currency?: string; description?: string } = {
        description: parts.join("\n\n") || "",
      };
      switch (formData.paymentType) {
        case "fixed":
          if (formData.paymentFixedAmount) {
            baseDetails.amount = currencyToNumber(formData.paymentFixedAmount);
            baseDetails.currency = "BRL";
          }
          break;
        case "swap":
          baseDetails.description = `${formData.paymentSwapItem || ""}${formData.paymentSwapMarketValue ? ` - Valor de mercado: R$ ${formData.paymentSwapMarketValue}` : ""
            }`;
          if (formData.paymentSwapMarketValue) {
            baseDetails.amount = currencyToNumber(formData.paymentSwapMarketValue);
            baseDetails.currency = "BRL";
          }
          break;
        case "cpa":
          baseDetails.description = buildCpaDescription(
            {
              actions: formData.paymentCpaActions,
              mode: formData.paymentCpaMode,
              value: formData.paymentCpaValue,
              percent: formData.paymentCpaPercent,
              note: formData.paymentCpaNote,
            },
            "R$ ",
          );
          if (cpaHasAmount(formData.paymentCpaMode) && formData.paymentCpaValue) {
            baseDetails.amount = currencyToNumber(formData.paymentCpaValue);
            baseDetails.currency = "BRL";
          }
          break;
        case "cpm":
          if (formData.paymentCpmValue) {
            baseDetails.amount = currencyToNumber(formData.paymentCpmValue);
            baseDetails.currency = "BRL";
          }
          break;
        default:
          break;
      }
      if (parts.length > 0) {
        baseDetails.description = [baseDetails.description, parts.join("\n\n")].filter(Boolean).join("\n\n");
      }
      return baseDetails;
    };

    const rules_does = Array.isArray(formData.whatToDo)
      ? formData.whatToDo.filter((item) => item.trim() !== "")
      : formData.whatToDo
        ? [formData.whatToDo].filter((item) => (item as string).trim() !== "")
        : [];
    const rules_does_not = Array.isArray(formData.whatNotToDo)
      ? formData.whatNotToDo.filter((item) => item.trim() !== "")
      : formData.whatNotToDo
        ? [formData.whatNotToDo].filter((item) => (item as string).trim() !== "")
        : [];

    const payload: CreateCampaignData = {
      ...(formData.brandRequired && formData.brandId ? { brand_id: formData.brandId } : {}),
      title: formData.title,
      description: formData.description,
      objective: formData.generalObjective || "awareness",
      secondary_niches,
      max_influencers: parseInt(unformatNumber(formData.influencersCount), 10) || 0,
      payment_method: formData.paymentType || "fixed",
      payment_method_details: buildPaymentDetails(),
      rules_does,
      rules_does_not,
      image_rights_period: aggregateImageRightsPeriodMonths(formData.phases),
    };

    if (benefitsFiltered.length > 0) {
      payload.benefits = benefitsFiltered;
    }
    if (formData.minFollowers) {
      const n = parseInt(unformatNumber(formData.minFollowers), 10);
      if (!Number.isNaN(n)) payload.segment_min_followers = n;
    }
    if (formData.state) {
      payload.segment_state = formData.state.split(",").filter(Boolean);
    }
    if (formData.city) {
      payload.segment_city = formData.city.split(",").filter(Boolean);
    }
    const genders = gendersOf(formData.gender);
    if (genders.length > 0) {
      payload.segment_genders = genders;
    }

    return payload;
  };

  /** API aceita `HH:MM` ou `HH:MM:SS`; normaliza `HH:MM` para segundos. */
  const toPublishTimeForApi = (postTime: string | undefined): string | undefined => {
    const t = (postTime ?? "").trim();
    if (!t) return undefined;
    const segments = t.split(":");
    if (segments.length === 2) return `${t}:00`;
    return t;
  };

  const transformPhasesToApiData = (phases: CampaignFormData["phases"]): CreatePhaseData[] => {
    return phases
      .filter((phase) => phase.objective && phase.postDate)
      .map((phase) => {
        const formatsByNetwork: Record<string, { type: string; options: Array<{ type: string; quantity: number; price?: number }> }> = {};
        phase.formats.forEach((format) => {
          const network = format.socialNetwork || "instagram";
          if (!formatsByNetwork[network]) {
            formatsByNetwork[network] = { type: network, options: [] };
          }
          const option: { type: string; quantity: number; price?: number } = {
            type: format.contentType || "post",
            quantity: parseInt(format.quantity, 10) || 1,
          };
          if (format.price) {
            const priceNum = currencyToNumber(format.price);
            if (priceNum > 0) option.price = Math.round(priceNum * 100);
          }
          formatsByNetwork[network].options.push(option);
        });

        const publish_time = toPublishTimeForApi(phase.postTime);
        const row: CreatePhaseData = {
          objective: phase.objective,
          post_date: phase.postDate,
          requires_product_receipt: phase.requiresProductReceipt === true,
          formats: Object.values(formatsByNetwork).length > 0 ? Object.values(formatsByNetwork) : [],
          files: phase.files && phase.files.trim() ? [phase.files.trim()] : undefined,
        };
        if (publish_time) {
          row.publish_time = publish_time;
        }
        return row;
      });
  };

  const handleSubmitCampaign = async () => {
    try {
      setIsCreatingCampaign(true);

      const missing = wizardMissing(formData);

      if (missing.length > 0) {
        setFieldErrors(new Set(missing.map((m) => m.field)));
        setCurrentStep(missing[0].step);
        const labels = missing.map((m) => m.label);
        toast.error(`Campos obrigatórios não preenchidos: ${labels.length <= 3
          ? labels.join(", ")
          : `${labels.slice(0, 3).join(", ")} e mais ${labels.length - 3}`}`);
        setIsCreatingCampaign(false);
        return;
      }
      const campaignPayload = transformFormDataToApiData(formData);
      const phasesData = transformPhasesToApiData(formData.phases ?? []);
      const campaignData: CreateCampaignData =
        phasesData.length > 0
          ? { ...campaignPayload, phases: phasesData }
          : campaignPayload;

      const createdCampaign = await createCampaignMutation.mutateAsync(campaignData);

      if (phasesData.length > 0) {
        queryClient.invalidateQueries({
          queryKey: ["campaigns", createdCampaign.id, "dashboard"],
        });
      }

      if (isSwap) {
        const validProducts = (formData.products ?? []).filter((p) => p.name.trim());
        if (validProducts.length > 0) {
          try {
            await createAllCampaignProducts(createdCampaign.id, validProducts);
          } catch (err) {
            console.error("[campaigns] erro ao salvar produtos:", err);
            const msg = err instanceof Error ? err.message : "Erro desconhecido";
            toast.error(`Campanha criada, mas houve um erro ao salvar os produtos: ${msg}`);
          }
        }
      }

      // Rascunho restaurado só guarda a prévia da imagem: o arquivo é refeito a partir dela (senão o banner se perdia).
      const bannerFile = bannerFileForUpload(
        formData.banner,
        (formData as CampaignFormData & { bannerFile?: File }).bannerFile,
      );
      if (bannerFile) {
        try {
          await uploadCampaignBanner(createdCampaign.id, bannerFile);
          queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        } catch {
          toast.error("Campanha criada, mas houve um erro ao fazer upload do banner. Envie a imagem de novo na campanha.");
        }
      } else if (formData.banner) {
        toast.error("Campanha criada, mas não foi possível enviar o banner. Envie a imagem de novo na campanha.");
      }

      queryClient.invalidateQueries({ queryKey: ["campaigns"] });

      let successDescription: string | undefined;
      if (formData.campaignVisibility !== "private") {
        const muralEnd = suggestMuralEndDateFromFormPhases(formData.phases);
        if (muralEnd) {
          try {
            await activateMural(createdCampaign.id, { end_date: muralEnd });
            queryClient.invalidateQueries({
              queryKey: ["campaigns", createdCampaign.id, "mural"],
            });
            successDescription =
              "A campanha está no mural (Descobrir) com data limite sugerida a partir da fase 1.";
          } catch {
            toast.error(
              "Campanha criada, mas não foi possível ativar o Descobrir. Ative manualmente na campanha."
            );
          }
        } else {
          successDescription =
            "Ajuste a data da fase 1 ou ative o Descobrir manualmente na campanha.";
        }
      }

      // Campanha criada → descarta o rascunho para não reabrir dados obsoletos
      // na próxima "Nova campanha".
      if (currentDraftId) discardCampaignDraft(currentDraftId);
      setHasDraft(false);

      toast.success("Campanha criada com sucesso!", {
        ...(successDescription ? { description: successDescription } : {}),
      });
      setIsCreatingCampaign(false);
      navigate({ to: "/campaigns/$campaignId", params: { campaignId: createdCampaign.id } });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err?.message || "Erro ao criar campanha. Tente novamente.");
      setIsCreatingCampaign(false);
    }
  };

  const handleSaveDraft = () => {
    const { bannerFile: _bf, ...rest } = formData as CampaignFormData & {
      bannerFile?: File;
    };
    const id = saveCampaignDraft({
      id: currentDraftId,
      workspaceId: selectedWorkspace?.id ?? null,
      step: 4,
      data: rest,
    });
    if (!id) {
      toast.error("Não foi possível salvar o rascunho. Tente de novo.");
      return;
    }
    setCurrentDraftId(id);
    setHasDraft(true);
    toast.success("Rascunho salvo", {
      description:
        "Ele aparece na aba Rascunhos das campanhas, neste navegador. Você pode criar outra campanha e voltar a ele quando quiser.",
      duration: 6000,
    });
  };

  const handleDiscardDraft = () => {
    if (currentDraftId) discardCampaignDraft(currentDraftId);
    setCurrentDraftId(null);
    setFormData({ ...initialFormData, brandRequired: isAgencyWorkspace });
    setFieldErrors(new Set());
    setCurrentStep(1);
    setHasDraft(false);
    toast.success("Rascunho descartado", {
      description: "O formulário foi reiniciado.",
    });
  };

  return (
    <WizardShell
      mode="create"
      backLabel="Campanhas"
      onExit={() => navigate({ to: "/campaigns" })}
      step={currentStep}
      setStep={setCurrentStep}
      formData={formData}
      updateFormData={updateFormData}
      tried={tried}
      setTried={setTried}
      reviewOpen={reviewOpen}
      setReviewOpen={setReviewOpen}
      onPublish={handleSubmitCampaign}
      publishing={isCreatingCampaign || createCampaignMutation.isPending}
      workspaceName={selectedWorkspace?.name}
      onSaveDraft={handleSaveDraft}
      onDiscardDraft={hasDraft ? handleDiscardDraft : undefined}
    >
      {(() => {
        const stepProps = { formData, updateFormData, fieldErrors, tried };
        return currentStep === 1 ? (
          <StepCampaign {...stepProps} />
        ) : currentStep === 2 ? (
          <StepCreators {...stepProps} />
        ) : currentStep === 3 ? (
          <StepPayment {...stepProps} />
        ) : (
          <StepPhases {...stepProps} />
        );
      })()}
    </WizardShell>
  );
}
