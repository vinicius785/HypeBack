/**
 * CPA (custo por ação): além do valor fixo por ação, a remuneração pode ser um percentual ou algo variável descrito em
 * texto. A API guarda só `description` e `amount` (BRL), então a modalidade vai na própria descrição, em um formato
 * que dá para ler de volta ao editar a campanha:
 *
 *   Ações que geram CPA: <ações> - Valor: R$ 10,00            (valor fixo; também vai em `amount`)
 *   Ações que geram CPA: <ações> - Percentual: 10%            (sem `amount`)
 *   Ações que geram CPA: <ações> - Remuneração variável: <texto> (sem `amount`)
 */
export type CpaMode = "value" | "percent" | "variable";

export const CPA_MODES: ReadonlyArray<{ id: CpaMode; label: string; hint: string }> = [
  { id: "value", label: "Valor", hint: "Um valor em reais por ação" },
  { id: "percent", label: "Percentual", hint: "Uma porcentagem sobre cada ação (ex.: sobre a venda)" },
  { id: "variable", label: "Variável", hint: "Você explica como será calculado" },
];

const PREFIX = "Ações que geram CPA:";
const VALUE_TAG = " - Valor:";
const PERCENT_TAG = " - Percentual:";
const VARIABLE_TAG = " - Remuneração variável:";

export interface CpaFields {
  actions?: string;
  mode?: CpaMode;
  /** Já formatado ("10,00"), como o campo de dinheiro entrega. */
  value?: string;
  /** Texto do campo de percentual (ex.: "10" ou "7,5"). */
  percent?: string;
  note?: string;
}

/** Limpa o texto de percentual: só dígitos e vírgula, no máximo 2 casas e entre 0 e 100. */
export function sanitizePercent(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, "");
  const [int = "", ...rest] = cleaned.split(",");
  const decimals = rest.join("").slice(0, 2);
  let intPart = int.replace(/^0+(?=\d)/, "");
  if (Number(intPart) > 100) intPart = "100";
  const hasComma = cleaned.includes(",");
  return hasComma ? `${intPart},${intPart === "100" ? "" : decimals}` : intPart;
}

/** Texto do percentual com "%" ("10%", "7,5%"); vazio sem número. */
export function formatPercent(percent: string | undefined): string {
  const p = (percent ?? "").trim().replace(/,$/, "");
  return p ? `${p}%` : "";
}

/** Falta preencher algo da modalidade escolhida? (o valor, o percentual ou a explicação) */
export function isCpaIncomplete(f: CpaFields): boolean {
  switch (f.mode ?? "value") {
    case "percent":
      return !formatPercent(f.percent);
    case "variable":
      return !(f.note ?? "").trim();
    default:
      return false;
  }
}

/** Descrição que vai para `payment_method_details.description`. `moneyPrefix` é "R$ " quando o valor vem sem moeda. */
export function buildCpaDescription(f: CpaFields, moneyPrefix = ""): string {
  const actions = (f.actions ?? "").trim();
  const head = `${PREFIX} ${actions}`.trimEnd();
  switch (f.mode ?? "value") {
    case "percent": {
      const p = formatPercent(f.percent);
      return p ? `${head}${PERCENT_TAG} ${p}` : head;
    }
    case "variable": {
      const note = (f.note ?? "").trim();
      return note ? `${head}${VARIABLE_TAG} ${note}` : head;
    }
    default: {
      const v = (f.value ?? "").trim();
      return v ? `${head}${VALUE_TAG} ${moneyPrefix}${v}` : head;
    }
  }
}

/** Só a modalidade "valor" tem `amount` em reais. */
export function cpaHasAmount(mode: CpaMode | undefined): boolean {
  return (mode ?? "value") === "value";
}

/** Lê a descrição gravada de volta para os campos do formulário (campanhas antigas caem em "valor"). */
export function parseCpaDescription(description: string | null | undefined): { actions: string; mode: CpaMode; percent: string; note: string } {
  const text = (description ?? "").replace(PREFIX, "").trim();
  const find = (tag: string) => {
    const i = text.indexOf(tag);
    return i === -1 ? null : { before: text.slice(0, i).trim(), after: text.slice(i + tag.length).trim() };
  };
  const percent = find(PERCENT_TAG);
  if (percent) return { actions: percent.before, mode: "percent", percent: percent.after.replace(/%$/, "").trim(), note: "" };
  const variable = find(VARIABLE_TAG);
  if (variable) return { actions: variable.before, mode: "variable", percent: "", note: variable.after };
  const value = find(VALUE_TAG);
  return { actions: (value ? value.before : text).trim(), mode: "value", percent: "", note: "" };
}

/** Resumo curto para cartões e revisão: "R$ 10,00 por ação", "10% por ação" ou a explicação. Vazio sem nada preenchido. */
export function cpaSummary(f: CpaFields): string {
  switch (f.mode ?? "value") {
    case "percent": {
      const p = formatPercent(f.percent);
      return p ? `${p} por ação` : "";
    }
    case "variable":
      return (f.note ?? "").trim();
    default:
      return f.value?.trim() ? `R$ ${f.value.trim()} por ação` : "";
  }
}

export interface CpaPublicView {
  /** Destaque ("R$ 10,00", "7,5%" ou "Variável"). */
  headline: string;
  /** Complemento do destaque ("por ação"). */
  caption: string;
  /** Texto corrido: o que gera o pagamento e, na modalidade variável, a explicação da marca. */
  detail: string;
}

/**
 * Como o criador vê o CPA no convite: o destaque, o complemento e o texto, sem o formato interno da descrição.
 * `formatMoney` formata o valor em reais (a página já tem o seu).
 */
export function cpaPublicView(description: string | null | undefined, amount: number | null | undefined, formatMoney: (n: number) => string): CpaPublicView {
  const parsed = parseCpaDescription(description);
  const actions = parsed.actions ? `Você é pago por: ${parsed.actions}.` : "";
  switch (parsed.mode) {
    case "percent": {
      const p = formatPercent(parsed.percent);
      return { headline: p || "CPA", caption: "por ação", detail: [actions, "O percentual é combinado com a marca e vale para cada ação realizada."].filter(Boolean).join(" ") };
    }
    case "variable":
      return { headline: "Variável", caption: "por ação", detail: [actions, parsed.note].filter(Boolean).join("\n\n") };
    default: {
      const hasAmount = amount != null && Number.isFinite(amount) && amount > 0;
      return { headline: hasAmount ? formatMoney(amount as number) : "CPA", caption: hasAmount ? "por ação" : "remuneração", detail: actions };
    }
  }
}
