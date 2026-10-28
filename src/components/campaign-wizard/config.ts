import type { CampaignFormData } from "@/shared/types";

export const WIZARD_STEPS = ["Campanha", "Criadores", "Pagamento", "Fases"] as const;
export const WIZARD_SUBS = [
  "Conte o essencial e envie o banner",
  "Defina quem você quer alcançar",
  "Escolha como os criadores serão pagos",
  "Planeje as fases e os formatos",
] as const;

export interface WizardMissing {
  step: number;
  field: string;
  label: string;
}

export const asList = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v.filter((s) => s.trim()) : v && v.trim() ? [v] : [];

/** Itens obrigatórios que faltam, por etapa (mesmas regras do envio da campanha). */
export function wizardMissing(d: CampaignFormData): WizardMissing[] {
  const m: WizardMissing[] = [];
  if (!d.title?.trim()) m.push({ step: 1, field: "title", label: "Título da campanha" });
  if (!d.description?.trim()) m.push({ step: 1, field: "description", label: "Descrição da campanha" });
  if (!asList(d.whatToDo).length) m.push({ step: 1, field: "whatToDo", label: "O que fazer" });
  if (!asList(d.whatNotToDo).length) m.push({ step: 1, field: "whatNotToDo", label: "O que não fazer" });
  if (!d.banner?.trim()) m.push({ step: 1, field: "banner", label: "Banner da campanha" });
  if (!(parseInt((d.influencersCount ?? "").replace(/\D/g, ""), 10) > 0))
    m.push({ step: 2, field: "influencersCount", label: "Quantidade de influenciadores" });
  if (!d.paymentType?.trim()) m.push({ step: 3, field: "paymentType", label: "Tipo de remuneração" });
  const phases = d.phases ?? [];
  if (!phases.length || phases.some((p) => !p.objective?.trim() || !p.postDate?.trim() || !p.formats?.length))
    m.push({ step: 4, field: "phases", label: "Fases da campanha" });
  return m;
}

export const stepOk = (d: CampaignFormData, step: number) =>
  !wizardMissing(d).some((x) => x.step === step);

export const money = (v: string | undefined) => (v && v.trim() ? `R$ ${v}` : "");

export const PAYMENT_LABEL: Record<string, string> = {
  fixed: "Valor fixo por conteúdo",
  price: "Preço definido pelo influenciador",
  individual_price: "Valor individual por criador",
  swap: "Permuta",
  cpa: "CPA (custo por ação)",
  cpm: "CPM (custo por mil)",
};

/** "Ganho" mostrado na prévia do app. */
export function paymentGain(d: CampaignFormData): string {
  switch (d.paymentType) {
    case "fixed":
      return d.paymentFixedAmount ? money(d.paymentFixedAmount) : "—";
    case "swap":
      return "Permuta";
    case "cpa":
      return "CPA";
    case "cpm":
      return "CPM";
    case "price":
    case "individual_price":
      return "A combinar";
    default:
      return "—";
  }
}
