import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import type { CampaignFormData } from "@/shared/types";
import { handleCurrencyInput } from "@/shared/utils/masks";
import { CreateCampaignStepProducts } from "@/components/forms/create-campaign-step-products";

/** Toggle no estilo Figma: 37×20px, pill, verde (on) / cinza (off), knob cinza escuro */
function ToggleSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const trackWidth = 37;
  const trackHeight = 20;
  const knobSize = 16;
  const knobOffset = (trackHeight - knobSize) / 2;
  const travel = trackWidth - knobSize - knobOffset * 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="relative shrink-0 cursor-pointer rounded-[1.667px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      style={{
        width: trackWidth,
        height: trackHeight,
        borderRadius: trackHeight / 2,
      }}
    >
      <span
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{
          backgroundColor: checked ? "var(--color-success-500)" : "#d4d4d4",
          borderRadius: trackHeight / 2,
        }}
      />
      <span
        className="pointer-events-none absolute rounded-full transition-transform duration-200 ease-out"
        style={{
          width: knobSize,
          height: knobSize,
          top: knobOffset,
          left: knobOffset,
          backgroundColor: "#262626",
          transform: checked ? `translateX(${travel}px)` : "translateX(0)",
        }}
      />
    </button>
  );
}

interface CreateCampaignStepThreeProps {
  formData: CampaignFormData;
  /**
   * Aceita `unknown` para casar com a assinatura do parent (campaigns.new/edit)
   * e do filho `CreateCampaignStepProducts` — que grava arrays de objetos
   * (`products`) e não apenas string/string[].
   */
  updateFormData: (field: keyof CampaignFormData, value: unknown) => void;
  onBack: () => void;
  onNext: () => void;
  hideBackButton?: boolean;
  fieldErrors?: Set<string>;
}

export function CreateCampaignStepThree({
  formData,
  updateFormData,
  onBack,
  onNext,
  hideBackButton = false,
  fieldErrors,
}: CreateCampaignStepThreeProps) {
  const [includeBonus, setIncludeBonus] = useState(!!formData.benefitsBonus?.trim());
  const [benefitsItems, setBenefitsItems] = useState<string[]>(() => {
    if (Array.isArray(formData.benefits)) {
      return formData.benefits.filter((item) => item.trim() !== "");
    }
    if (formData.benefits && typeof formData.benefits === "string") {
      const parsed = formData.benefits
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line && (line.startsWith(".") || line.startsWith("-") || line.startsWith("•") || line.length > 0))
        .map((line) => line.replace(/^[.\-•]\s*/, "").trim())
        .filter(Boolean);
      return parsed.length > 0 ? parsed : [""];
    }
    return [""];
  });
  const [newBenefit, setNewBenefit] = useState("");

  useEffect(() => {
    const filtered = benefitsItems.filter((item) => item.trim() !== "");
    updateFormData("benefits", filtered.length > 0 ? filtered : [""]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benefitsItems]);

  useEffect(() => {
    if (!includeBonus) {
      updateFormData("benefitsBonus", "");
    }
  }, [includeBonus, updateFormData]);

  const addBenefit = () => {
    const value = newBenefit.trim();
    if (!value) return;
    setBenefitsItems((prev) => (prev[0] === "" ? [value] : [...prev, value]));
    setNewBenefit("");
  };

  const removeBenefit = (index: number) => {
    setBenefitsItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [""] : next;
    });
  };

  const inputClass =
    "w-full rounded-[24px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none";
  const labelClass = "text-base font-medium leading-5 text-[#0A0A0A]";

  const paymentTypeError = fieldErrors?.has("paymentType");

  useEffect(() => {
    if (!paymentTypeError) return;
    const el = document.getElementById("campaign-payment-type");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

  const renderPaymentFields = () => {
    switch (formData.paymentType) {
      case "fixed":
        return null;
      case "price":
        return null;
      case "individual_price":
        return (
          <div className="rounded-[12px] bg-[#F5F3FF] p-4">
            <p className="text-sm text-[#404040]">
              O valor será <strong>negociado individualmente</strong> com cada
              criador no momento do convite. Você propõe um valor e o criador
              pode aceitar ou enviar uma contraproposta — o saldo só é reservado
              quando o valor é fechado.
            </p>
          </div>
        );
      case "swap":
        return null;
      case "cpa":
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Quais ações geram CPA?</label>
              <textarea
                placeholder="Descreva quais ações dos influenciadores gerarão CPA (ex: clique no link, compra realizada, cadastro)"
                value={formData.paymentCpaActions}
                onChange={(e) => updateFormData("paymentCpaActions", e.target.value)}
                className={`${inputClass} min-h-[100px] rounded-[12px] resize-y`}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Valor do CPA</label>
              <input
                type="text"
                placeholder="Ex: R$ 50,00"
                value={formData.paymentCpaValue ? `R$ ${formData.paymentCpaValue}` : ""}
                onChange={(e) =>
                  handleCurrencyInput(e, (value) =>
                    updateFormData("paymentCpaValue", value)
                  )
                }
                className={inputClass}
              />
            </div>
          </div>
        );
      case "cpm":
        return (
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Valor do CPM - <span className="font-normal text-sm">As visualizações serão contabilizadas durante 7 dias após a publicação</span></label>
            <input
              type="text"
              placeholder="Ex: R$ 10,00"
              value={formData.paymentCpmValue ? `R$ ${formData.paymentCpmValue}` : ""}
              onChange={(e) =>
                handleCurrencyInput(e, (value) =>
                  updateFormData("paymentCpmValue", value)
                )
              }
              className={inputClass}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        {/* Header – Figma */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[28px] font-medium leading-8 text-[#0A0A0A]">
            Remuneração e benefícios
          </h2>
          <p className="text-lg leading-8 text-[#404040]">
            Deixar claro como o influenciador será compensado (dinheiro e/ou
            vantagens), sem travar quem ainda não quer definir valor exato agora
          </p>
        </div>

        {/* Card único – Figma */}
        <div className="flex flex-col gap-4 rounded-[12px] bg-[#FAFAFA] p-6">
          {/* Tipo de remuneração */}
          <div id="campaign-payment-type" className="flex flex-col gap-1">
            <Select
              label={<>Tipo de remuneração <span className="text-red-500" aria-hidden>*</span></>}
              placeholder="Escolha como os influenciadores serão pagos"
              value={formData.paymentType}
              onChange={(value) => updateFormData("paymentType", value)}
              error={paymentTypeError ? "Campo obrigatório" : undefined}
              options={[
                { label: "Valor fixo por conteúdo", value: "fixed" },
                { label: "Preço definido pelo influenciador", value: "price" },
                { label: "Valor individual por criador", value: "individual_price" },
                { label: "Permuta", value: "swap" },
                { label: "CPA (Custo Por Ação)", value: "cpa" },
                { label: "CPM (Custo Por Mil)", value: "cpm" },
              ]}
            />
          </div>

          {renderPaymentFields()}

          {/* Incluir bônus por performance? */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-6 rounded-[12px] bg-[#F5F5F5] px-4 py-3 min-h-[68px]">
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-lg font-medium text-black">
                  Incluir bônus por perfomance?{" "}
                  <span className="font-normal text-[#626262]">(opcional)</span>
                </p>
                <p className="text-base text-[#626262]">
                  Ative para oferecer vantagens extras além do cachê, ou caso a
                  campanha seja exclusivamente por permuta
                </p>
              </div>
              <ToggleSwitch checked={includeBonus} onCheckedChange={setIncludeBonus} />
            </div>

            {includeBonus && (
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Descrição do bônus (opcional)</label>
                <input
                  type="text"
                  placeholder="Detalhe as regras ou condições para o uso do bônus"
                  value={formData.benefitsBonus ?? ""}
                  onChange={(e) => updateFormData("benefitsBonus", e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Listagem dos benefícios inclusos */}
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-0">
              <h3 className="text-lg font-bold leading-8 text-[#0A0A0A]">
                Listagem dos beneficios inclusos
              </h3>
              <p className="text-base leading-8 text-[#404040]">
                Escreva o benefício e adicione à lista da campanha
              </p>
            </div>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Ex: Kit exclusivo com 3 produtos da marca"
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBenefit())}
                  className={inputClass}
                />
              </div>
              <Button
                type="button"
                onClick={addBenefit}
                className="shrink-0 rounded-[24px] bg-primary-600 px-4 py-2.5 font-semibold text-white hover:bg-primary-700 w-min"
              >
                <span className="flex items-center gap-2">
                  Adicionar
                  <Icon name="Plus" size={16} color="#FAFAFA" />
                </span>
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {benefitsItems.map(
                (item, index) =>
                  item.trim() !== "" && (
                    <div
                      key={`${index}-${item.slice(0, 20)}`}
                      className="flex items-center justify-between rounded-[12px] border border-[#EDEDED] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name="CircleCheck" size={24} color="#22c55e" />
                        <span className="text-base text-black">{item}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBenefit(index)}
                        className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-danger-500 transition-colors"
                        aria-label="Remover benefício"
                      >
                        <Icon name="CircleX" size={24} color="currentColor" />
                      </button>
                    </div>
                  )
              )}
            </div>
          </div>
        </div>

        {!hideBackButton && (
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={onBack} className="w-min">
              <div className="flex items-center justify-center gap-2">
                <Icon name="ArrowLeft" size={16} color="#404040" />
                <p className="font-semibold text-neutral-700">Voltar</p>
              </div>
            </Button>
          </div>
        )}
      </form>

      {formData.paymentType === "swap" && (
        <CreateCampaignStepProducts
          formData={formData}
          updateFormData={updateFormData}
          asSection
          hideBackButton
        />
      )}
    </>
  );
}
