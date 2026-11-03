/**
 * Modelo da visão geral do Financeiro: os números do contrato (`AdminFinancialFigures`) em blocos com nome.
 * Fica fora do componente para a tela só desenhar e para o texto dos blocos ter um lugar único.
 */
import type { AdminFinancialFigures } from "@/shared/admin-platform.types";

interface FigureSpec {
  key: keyof AdminFinancialFigures;
  label: string;
}

interface GroupSpec {
  id: string;
  title: string;
  /** Uma linha: a regra de cada número está no "i" do próprio indicador. */
  description: string;
  figures: readonly FigureSpec[];
}

/**
 * O texto de cada número, o tipo (realizado, comprometido, posição atual, calculado, não apurado) e a regra de
 * cálculo vêm da API: a tela só escolhe o rótulo e a ordem. Os números do período dizem "no período" no próprio
 * rótulo; os demais são a posição de agora ou o histórico inteiro.
 */
export const FINANCIAL_GROUPS: readonly GroupSpec[] = [
  {
    id: "entradas",
    title: "Entradas",
    description: "Dinheiro que os clientes colocaram na plataforma, por PIX.",
    figures: [
      { key: "funded_in_period", label: "Aportes no período" },
      { key: "funded_total", label: "Aportes totais" },
      { key: "pending_charges", label: "Cobranças pendentes" },
    ],
  },
  {
    id: "custodia",
    title: "Custódia",
    description: "Saldo guardado agora nos workspaces. O comprometido já está na custódia: não se soma a ela.",
    figures: [
      { key: "custody", label: "Em custódia" },
      { key: "committed", label: "Comprometido" },
      { key: "free_balance", label: "Saldo livre" },
    ],
  },
  {
    id: "criadores",
    title: "Criadores",
    description: "O que já foi liberado aos criadores e em que etapa está.",
    figures: [
      { key: "in_grace", label: "Em carência" },
      { key: "available_to_withdraw", label: "Disponível para saque" },
      { key: "withdrawals_in_flight", label: "Saques em andamento" },
      { key: "released_in_period", label: "Liberado no período" },
      { key: "released_total", label: "Liberado no total" },
    ],
  },
  {
    id: "pago",
    title: "Pago",
    description: "Pago é o PIX concluído para o criador.",
    figures: [
      { key: "paid_pix_in_period", label: "Pago via PIX no período" },
      { key: "paid_pix_total", label: "Pago via PIX no total" },
    ],
  },
  {
    id: "plataforma",
    title: "Plataforma",
    description: "Taxas e comissão que ficam com a plataforma.",
    figures: [{ key: "platform_revenue", label: "Receita da plataforma" }],
  },
];

/** "Como ler os números": o texto completo que acompanha o título (liberado ≠ pago, período × posição atual). */
export const FINANCIAL_READING_HELP: readonly string[] = [
  "Liberado é o valor que foi para o saldo do criador (em carência, disponível ou já sacado); pago é o PIX concluído. Os dois aparecem separados nesta página.",
  "Os números “no período” seguem os dias escolhidos; os de “Posição atual” são a foto de agora e não mudam com o período.",
];

/** O que cada conferência quer dizer (vai no "i" do indicador). */
export const FINANCIAL_RECONCILIATION_HELP = {
  drift:
    "É o comprometido guardado nos saldos dos workspaces menos as reservas do ledger ligadas a campanhas. Zero quer dizer que as duas fontes batem; qualquer outro valor pede investigação antes de confiar na custódia e no saldo livre.",
  unattributed:
    "Reservas que não pertencem a nenhum workspace. Quando há valor, elas aparecem como “Não atribuído” na distribuição por workspace.",
} as const;
