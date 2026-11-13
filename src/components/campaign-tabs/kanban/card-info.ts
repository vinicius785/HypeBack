import { getNetworkLabel } from "@/shared/constants/network-labels";
import { fmtBRL } from "../shared/prices-utils";
import type { ExtendedInfluencer } from "../management-kanban-config";

/** Colunas em que a seleção/curadoria é decidida no painel do card (sem menu "Recusar" no cartão). */
const DECIDED_IN_PANEL = new Set(["applications", "pre_selection", "pre_selection_curation", "curation"]);

/** Menu do cartão oferece "Recusar" nas mesmas colunas em que o painel oferece. */
export function canRejectFromMenu(column: string): boolean {
  return column !== "rejected" && !DECIDED_IN_PANEL.has(column);
}

/** Data da inscrição: a primeira movimentação registrada. */
export function enrolledAt(inf: Pick<ExtendedInfluencer, "statusHistory">): Date | null {
  const first = inf.statusHistory?.[0];
  if (!first) return null;
  const d = new Date(first.timestamp);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const shortDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export const fullDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** "Instagram" ou "Instagram +1" quando o criador tem mais de uma rede na campanha. */
export function networkSummary(inf: Pick<ExtendedInfluencer, "socialNetwork" | "social_networks">): string {
  const nets = inf.social_networks ?? [];
  const main = getNetworkLabel(inf.socialNetwork ?? nets[0]?.type, "");
  if (!main) return "";
  return nets.length > 1 ? `${main} +${nets.length - 1}` : main;
}

export interface CardNote {
  text: string;
  /** `warn` = pede atenção (atraso, pendência); `info` = contexto. */
  tone: "info" | "warn";
}

/**
 * Uma linha de contexto para a etapa atual, só com dados que já existem:
 * atraso, valor em negociação, data da inscrição ou métricas ainda não disponíveis.
 */
export function cardNote(
  inf: ExtendedInfluencer,
  column: string,
  idleDays: number | undefined,
  late: boolean,
): CardNote | null {
  if (late) return { text: `${idleDays} ${idleDays === 1 ? "dia" : "dias"} sem avanço`, tone: "warn" };
  const pn = inf.price_negotiation;
  if (column === "price_countered" && pn?.counter_price_cents != null) {
    return { text: `Contraproposta ${fmtBRL(pn.counter_price_cents)}`, tone: "warn" };
  }
  if (column === "price_proposed" && pn?.proposed_price_cents != null) {
    return { text: `Proposta ${fmtBRL(pn.proposed_price_cents)}`, tone: "info" };
  }
  if (!inf.followers && !inf.engagement) return { text: "Métricas ainda não disponíveis", tone: "warn" };
  if (column === "applications") {
    const d = enrolledAt(inf);
    if (d) return { text: `Inscrito em ${shortDate(d)}`, tone: "info" };
  }
  return null;
}

export interface NetworkRow {
  key: string;
  label: string;
  members: number;
}

/** Redes em que o criador se inscreveu, cada uma com seus seguidores; sem lista da API, cai na rede principal com o total. */
export function networkRows(
  inf: Pick<ExtendedInfluencer, "socialNetwork" | "social_networks" | "followers">,
): NetworkRow[] {
  const nets = inf.social_networks ?? [];
  if (nets.length === 0) {
    return [{ key: "main", label: getNetworkLabel(inf.socialNetwork, "Rede"), members: inf.followers }];
  }
  return nets.map((n, i) => ({
    key: `${n.id}-${i}`,
    label: getNetworkLabel(n.type, n.name),
    members: n.members ?? 0,
  }));
}
