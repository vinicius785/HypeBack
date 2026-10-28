import { useState, useCallback, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CreateCampaignStepOne } from "@/components/forms/create-campaign-step-one";
import { CreateCampaignStepTwo } from "@/components/forms/create-campaign-step-two";
import { CreateCampaignStepThree } from "@/components/forms/create-campaign-step-three";
import { CreateCampaignStepFour } from "@/components/forms/create-campaign-step-four";
import { CreateCampaignStepFive } from "@/components/forms/create-campaign-step-five";
import { CreateCampaignStepSeven } from "@/components/forms/create-campaign-step-seven";
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

export const Route = createFileRoute("/(private)/(app)/campaigns/new" as "/(private)/(app)/campaigns/new")({
  component: CreateCampaignPage,
});

const STEP_LABELS = ["Briefing", "Influenciadores", "Remuneração", "Materiais", "Fases", "Revisão"];

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

/** Chave do rascunho de criação no localStorage (escopo deste navegador). */
const DRAFT_KEY = "hypeapp-campaign-draft-new";

interface CampaignDraft {
  data: CampaignFormData;
  step: number;
}

/**
 * Lê o rascunho salvo no localStorage. Retorna `null` quando não há rascunho,
 * o JSON é inválido ou o localStorage está indisponível (modo privado/quota).
 * Mescla sobre `initialFormData` para tolerar rascunhos de versões antigas do
 * formulário (campos novos entram com default em vez de ficar `undefined`).
 */
function loadCampaignDraft(): CampaignDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignDraft> | null;
    if (parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object") {
      return {
        data: { ...initialFormData, ...(parsed.data as CampaignFormData) },
        step: typeof parsed.step === "number" ? parsed.step : 1,
      };
    }
  } catch {
    // JSON inválido / localStorage indisponível — começa do zero.
  }
  return null;
}

function CreateCampaignPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Lê o rascunho UMA vez na montagem (ref-guard) e reusa nos inicializadores
  // de estado — evita ler o localStorage a cada render.
  const initialDraftRef = useRef<CampaignDraft | null | undefined>(undefined);
  if (initialDraftRef.current === undefined) {
    initialDraftRef.current = loadCampaignDraft();
  }
  const initialDraft = initialDraftRef.current;

  const [currentStep, setCurrentStep] = useState(initialDraft?.step ?? 1);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [formData, setFormData] = useState<CampaignFormData>(
    initialDraft?.data ?? initialFormData,
  );
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());
  // Controla a visibilidade do "Descartar rascunho": só faz sentido quando há
  // um rascunho (restaurado na montagem ou salvo durante esta sessão).
  const [hasDraft, setHasDraft] = useState<boolean>(!!initialDraft);

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
  const totalSteps = STEP_LABELS.length;
  const STEP_MATERIAIS = 4;
  const STEP_FASES     = 5;
  const STEP_REVISAO   = 6;

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
          baseDetails.description = `Ações que geram CPA: ${formData.paymentCpaActions || ""}${formData.paymentCpaValue ? ` - Valor: R$ ${formData.paymentCpaValue}` : ""
            }`;
          if (formData.paymentCpaValue) {
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
    if (formData.gender && formData.gender !== "all") {
      payload.segment_genders = [formData.gender];
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

      const missing: { step: number; field: string; label: string }[] = [];

      // Step 1
      if (!formData.title?.trim()) missing.push({ step: 1, field: "title", label: "Título da campanha" });
      if (!formData.description?.trim()) missing.push({ step: 1, field: "description", label: "Descrição da campanha" });
      const whatToDoArr = Array.isArray(formData.whatToDo) ? formData.whatToDo.filter((s) => s.trim()) : (formData.whatToDo ? [formData.whatToDo] : []);
      if (!whatToDoArr.length) missing.push({ step: 1, field: "whatToDo", label: "O que fazer" });
      const whatNotToDoArr = Array.isArray(formData.whatNotToDo) ? formData.whatNotToDo.filter((s) => s.trim()) : (formData.whatNotToDo ? [formData.whatNotToDo] : []);
      if (!whatNotToDoArr.length) missing.push({ step: 1, field: "whatNotToDo", label: "O que não fazer" });

      // Step 2
      if (!formData.influencersCount?.trim()) missing.push({ step: 2, field: "influencersCount", label: "Quantidade de influenciadores" });

      // Step 3
      if (!formData.paymentType?.trim()) missing.push({ step: 3, field: "paymentType", label: "Tipo de remuneração" });

      // Step Materiais
      if (!formData.banner?.trim()) missing.push({ step: STEP_MATERIAIS, field: "banner", label: "Banner da campanha" });

      // Step Fases
      const phases = formData.phases ?? [];
      if (!phases.length || phases.some((p) => !p.objective?.trim() || !p.postDate?.trim() || !p.formats?.length)) {
        missing.push({ step: STEP_FASES, field: "phases", label: "Fases da campanha" });
      }

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

      const bannerFile = (formData as CampaignFormData & { bannerFile?: File }).bannerFile;
      if (bannerFile instanceof File) {
        try {
          await uploadCampaignBanner(createdCampaign.id, bannerFile);
          queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        } catch {
          toast.error("Campanha criada, mas houve um erro ao fazer upload do banner.");
        }
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
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // localStorage indisponível — sem efeito colateral.
      }
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
    try {
      const { bannerFile: _bf, ...rest } = formData as CampaignFormData & {
        bannerFile?: File;
      };
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ savedAt: new Date().toISOString(), step: STEP_REVISAO, data: rest })
      );
      setHasDraft(true);
      toast.success("Rascunho salvo", {
        description:
          "Os dados foram guardados neste navegador. Conclua e envie a campanha quando quiser.",
        duration: 6000,
      });
    } catch {
      toast.error("Não foi possível salvar o rascunho. Tente de novo.");
    }
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // localStorage indisponível — sem efeito colateral.
    }
    setFormData(initialFormData);
    setFieldErrors(new Set());
    setCurrentStep(1);
    setHasDraft(false);
    toast.success("Rascunho descartado", {
      description: "O formulário foi reiniciado.",
    });
  };

  const handleContinue = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleFooterBack = () => {
    if (currentStep <= 1) {
      navigate({ to: "/campaigns" });
    } else {
      setCurrentStep((s) => s - 1);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] max-w-6xl mx-auto">
      {/* Stepper – design Figma (6 steps, roxo #c252dc, gap 16px/8px) */}
      <div className="flex gap-4 items-center mb-8 w-full">
        {STEP_LABELS.map((label, index) => {
          const stepNum = index + 1;
          const isActive = currentStep === stepNum;
          return (
            <div key={`step-${stepNum}`} className="flex gap-4 items-center shrink-0">
              <div
                className={`flex gap-2 items-center justify-center pb-3 shrink-0 ${isActive ? "border-b-[3px] border-tertiary-500" : ""
                  }`}
              >
                <div
                  className={`flex items-center justify-center rounded-full size-7 text-sm font-bold shrink-0 ${isActive
                    ? "bg-tertiary-500 text-white"
                    : "border border-[#e5e5e5] text-[#7c7c7c]"
                    }`}
                >
                  {stepNum}
                </div>
                <span className="text-base whitespace-nowrap text-[#7c7c7c]">
                  {label}
                </span>
              </div>
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

      {/* Step content - white card */}
      <div className="bg-white rounded-[12px] p-6 flex-1">
        {currentStep === 1 && (
          <CreateCampaignStepOne
            formData={formData}
            updateFormData={updateFormData}
            fieldErrors={fieldErrors}
          />
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
          />
        )}
        {currentStep === 6 && (
          <CreateCampaignStepSeven
            formData={formData}
            updateFormData={updateFormData}
            onBack={() => setCurrentStep(5)}
            onEdit={(step) => setCurrentStep(step)}
            onSubmitCampaign={handleSubmitCampaign}
            onSaveDraft={handleSaveDraft}
            onDiscardDraft={hasDraft ? handleDiscardDraft : undefined}
            isLoading={isCreatingCampaign || createCampaignMutation.isPending}
          />
        )}
      </div>

      {/* Barra fixa: Voltar + Continuar */}
      {currentStep < STEP_REVISAO && (
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
