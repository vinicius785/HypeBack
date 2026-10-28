import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { CampaignFormData } from "@/shared/types";

const DESCRIPTION_MAX = 1000;
const OBJECTIVE_MAX = 1000;

interface CreateCampaignStepOneProps {
  formData: CampaignFormData;
  updateFormData: (field: keyof CampaignFormData, value: string | string[]) => void;
  fieldErrors?: Set<string>;
}

export function CreateCampaignStepOne({
  formData,
  updateFormData,
  fieldErrors,
}: CreateCampaignStepOneProps) {
  const [whatToDoItems, setWhatToDoItems] = useState<string[]>(() => {
    if (Array.isArray(formData.whatToDo)) return formData.whatToDo.filter(Boolean);
    if (formData.whatToDo && typeof formData.whatToDo === "string")
      return formData.whatToDo.split("\n").map((s) => s.trim()).filter(Boolean);
    return [];
  });
  const [whatNotToDoItems, setWhatNotToDoItems] = useState<string[]>(() => {
    if (Array.isArray(formData.whatNotToDo)) return formData.whatNotToDo.filter(Boolean);
    if (formData.whatNotToDo && typeof formData.whatNotToDo === "string")
      return formData.whatNotToDo.split("\n").map((s) => s.trim()).filter(Boolean);
    return [];
  });
  const [newWhatToDo, setNewWhatToDo] = useState("");
  const [newWhatNotToDo, setNewWhatNotToDo] = useState("");

  useEffect(() => {
    updateFormData("whatToDo", whatToDoItems.length > 0 ? whatToDoItems : [""]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatToDoItems]);

  useEffect(() => {
    updateFormData("whatNotToDo", whatNotToDoItems.length > 0 ? whatNotToDoItems : [""]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatNotToDoItems]);

  const addWhatToDo = () => {
    const v = newWhatToDo.trim();
    if (!v) return;
    setWhatToDoItems((prev) => [...prev, v]);
    setNewWhatToDo("");
  };

  const addWhatNotToDo = () => {
    const v = newWhatNotToDo.trim();
    if (!v) return;
    setWhatNotToDoItems((prev) => [...prev, v]);
    setNewWhatNotToDo("");
  };

  const removeWhatToDo = (index: number) => {
    setWhatToDoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const removeWhatNotToDo = (index: number) => {
    setWhatNotToDoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const descCount = (formData.description?.length ?? 0);
  const objCount = (formData.generalObjective?.length ?? 0);

  const titleError = fieldErrors?.has("title");
  const descError = fieldErrors?.has("description");
  const whatToDoError = fieldErrors?.has("whatToDo");
  const whatNotToDoError = fieldErrors?.has("whatNotToDo");

  useEffect(() => {
    if (!fieldErrors?.size) return;
    const order = [
      { field: "title", id: "campaign-title" },
      { field: "description", id: "campaign-description" },
      { field: "whatToDo", id: "campaign-whatToDo" },
      { field: "whatNotToDo", id: "campaign-whatNotToDo" },
    ];
    const first = order.find(({ field }) => fieldErrors.has(field));
    if (!first) return;
    const el = document.getElementById(first.id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el.querySelector<HTMLElement>("input, textarea");
    (focusable ?? el).focus?.();
  }, [fieldErrors]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <h2 className="text-[28px] font-medium leading-8 text-[#0A0A0A]">
          Briefing da campanha
        </h2>
        <p className="text-lg text-[#404040]">
          Defina o objetivo principal e as regras para os criadores
        </p>
      </div>

      {/* Card 1: Título, Descrição, Objetivo */}
      <div className="flex flex-col gap-7 rounded-[12px] bg-[#FAFAFA] p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="campaign-title" className="text-base font-medium text-[#0A0A0A]">
            Título da campanha
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </label>
          <input
            id="campaign-title"
            type="text"
            placeholder="Escolha um nome claro e descritivo para sua campanha"
            value={formData.title}
            onChange={(e) => updateFormData("title", e.target.value)}
            className={`w-full rounded-[24px] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none transition-colors ${
              titleError
                ? "bg-red-50 border border-red-400 focus:border-red-500"
                : "bg-[#F5F5F5]"
            }`}
          />
          {titleError && (
            <p className="flex items-center gap-1 text-sm text-red-500 mt-0.5">
              <Icon name="CircleAlert" size={14} color="currentColor" />
              Campo obrigatório
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="campaign-description" className="text-base font-medium text-[#0A0A0A]">
              Descrição da campanha
              <span className="text-red-500 ml-1" aria-hidden>*</span>
            </label>
            <textarea
              id="campaign-description"
              placeholder="Digite aqui sua descrição..."
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value.slice(0, DESCRIPTION_MAX))}
              maxLength={DESCRIPTION_MAX}
              rows={6}
              className={`min-h-[120px] w-full rounded-[12px] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none resize-y transition-colors ${
                descError
                  ? "bg-red-50 border border-red-400 focus:border-red-500"
                  : "bg-[#F5F5F5]"
              }`}
            />
            {descError && (
              <p className="flex items-center gap-1 text-sm text-red-500 mt-0.5">
                <Icon name="CircleAlert" size={14} color="currentColor" />
                Campo obrigatório
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Icon name="Lightbulb" size={24} color="#626262" />
              <span className="text-base text-[#626262]">Seja claro e conciso para guiar os criadores</span>
            </div>
            <span className="rounded-[32px] bg-[#404040] px-3 py-2 text-base text-white">
              {descCount}/{DESCRIPTION_MAX}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-end">
          <div className="flex flex-col gap-1 w-full">
            <label className="text-base font-medium text-[#0A0A0A]">Objetivo geral da campanha</label>
            <textarea
              placeholder="Descreva detalhadamente o que você espera alcançar com essa campanha."
              value={formData.generalObjective}
              onChange={(e) => updateFormData("generalObjective", e.target.value.slice(0, OBJECTIVE_MAX))}
              maxLength={OBJECTIVE_MAX}
              rows={4}
              className="min-h-[80px] w-full rounded-[24px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none resize-y"
            />
          </div>
          <span className="rounded-[32px] bg-[#404040] px-3 py-2 text-base text-white">
            {objCount}/{OBJECTIVE_MAX}
          </span>
        </div>
      </div>

      {/* Card 2: O que fazer */}
      <div id="campaign-whatToDo" className={`flex flex-col gap-7 rounded-[12px] p-6 ${whatToDoError ? "bg-red-50 ring-1 ring-red-400" : "bg-[#FAFAFA]"}`}>
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold text-[#0A0A0A]">O que fazer</h3>
          <p className="text-base text-[#404040]">Itens obrigatórios que devem aparecer no conteúdo</p>
        </div>
        <div className="flex gap-3 items-start">
          <input
            type="text"
            placeholder="Ex: Mostrar o produto em uso no dia-a-dia"
            value={newWhatToDo}
            onChange={(e) => setNewWhatToDo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWhatToDo())}
            className="flex-1 rounded-[12px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#404040] outline-none"
          />
          <Button
            type="button"
            onClick={addWhatToDo}
            className="shrink-0 h-11 rounded-[24px] bg-primary-600 px-4 font-semibold text-white hover:bg-primary-700 w-min"
          >
            <span className="flex items-center gap-2">
              Adicionar
              <Icon name="Plus" size={16} color="#FAFAFA" />
            </span>
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {whatToDoItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-[12px] border border-[#EDEDED] p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="CircleCheck" size={24} color="#22c55e" className="shrink-0" />
                <span className="text-base text-black truncate">{item}</span>
              </div>
              <button
                type="button"
                onClick={() => removeWhatToDo(index)}
                className="p-1 rounded-full hover:bg-neutral-100 shrink-0"
                aria-label="Remover"
              >
                <Icon name="CircleX" size={24} color="#A3A3A3" />
              </button>
            </div>
          ))}
        </div>
        {whatToDoError && (
          <p className="flex items-center gap-1 text-sm text-red-500">
            <Icon name="CircleAlert" size={14} color="currentColor" />
            Adicione pelo menos um item obrigatório
          </p>
        )}
      </div>

      {/* Card 3: O que não fazer */}
      <div id="campaign-whatNotToDo" className={`flex flex-col gap-7 rounded-[12px] p-6 ${whatNotToDoError ? "bg-red-50 ring-1 ring-red-400" : "bg-[#FAFAFA]"}`}>
        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-bold text-[#0A0A0A]">O que não fazer</h3>
          <p className="text-base text-[#404040]">
            Restrições e riscos. Tudo aqui deve evitar reprovação, multa ou conflito com marca
          </p>
        </div>
        <div className="flex gap-3 items-start">
          <input
            type="text"
            placeholder="Ex: Não mencionar concorrentes nem comparar preços"
            value={newWhatNotToDo}
            onChange={(e) => setNewWhatNotToDo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWhatNotToDo())}
            className="flex-1 rounded-[12px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#404040] outline-none"
          />
          <Button
            type="button"
            onClick={addWhatNotToDo}
            className="shrink-0 h-11 rounded-[24px] bg-primary-600 px-4 font-semibold text-white hover:bg-primary-700 w-min"
          >
            <span className="flex items-center gap-2">
              Adicionar
              <Icon name="Plus" size={16} color="#FAFAFA" />
            </span>
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {whatNotToDoItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-[12px] border border-[#EDEDED] p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="X" size={24} color="#404040" className="shrink-0" />
                <span className="text-base text-black truncate">{item}</span>
              </div>
              <button
                type="button"
                onClick={() => removeWhatNotToDo(index)}
                className="p-1 rounded-full hover:bg-neutral-100 shrink-0"
                aria-label="Remover"
              >
                <Icon name="CircleX" size={24} color="#A3A3A3" />
              </button>
            </div>
          ))}
        </div>
        {whatNotToDoError && (
          <p className="flex items-center gap-1 text-sm text-red-500">
            <Icon name="CircleAlert" size={14} color="currentColor" />
            Adicione pelo menos um item obrigatório
          </p>
        )}
      </div>
    </div>
  );
}
