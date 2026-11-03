/**
 * Vocabulário das campanhas no Admin: modalidade de pagamento e status de participação.
 *
 * Nada aqui é inventado: os rótulos vêm do que o app já mostra ao time do cliente (o assistente de campanha e as
 * colunas do Kanban de gestão), para o Admin falar a mesma língua da plataforma.
 */
import { kanbanColumns } from "@/components/campaign-tabs/management-kanban-config";
import { mapUserStatusToKanbanColumn } from "@/components/campaign-tabs/management-status-map";
import { PAYMENT_LABEL } from "@/components/campaign-wizard/config";

/** `exchange` é o outro nome de permuta (o Kanban trata `swap` e `exchange` do mesmo jeito). */
const PAYMENT_ALIAS: Record<string, string> = { exchange: "swap" };

/** Modalidade de pagamento como o assistente de campanha a chama; um código que o app não conhece aparece como veio. */
export function paymentMethodLabel(method: string): string {
  return PAYMENT_LABEL[PAYMENT_ALIAS[method] ?? method] ?? method;
}

/** As modalidades que o assistente oferece, na mesma ordem (opções do filtro "Pagamento"). */
export const PAYMENT_METHOD_OPTIONS: readonly { value: string; label: string }[] = Object.entries(PAYMENT_LABEL).map(
  ([value, label]) => ({ value, label }),
);

export interface ParticipationGroup {
  /** Coluna do Kanban (ou o status cru, quando o app não conhece o status). */
  key: string;
  label: string;
  count: number;
}

/**
 * `participations_by_status` (status do backend → quantidade) no vocabulário do Kanban: vários status do backend caem
 * na mesma coluna ("publicado" e "concluído" são "Publicado"), então as quantidades se somam. A ordem é a do
 * funil (a das colunas do Kanban); status desconhecido vai ao fim, com o texto cru, em vez de virar "Inscrições".
 */
export function participationStatusGroups(byStatus: Readonly<Record<string, number>>): ParticipationGroup[] {
  const groups = new Map<string, ParticipationGroup & { order: number }>();
  for (const [status, count] of Object.entries(byStatus)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    const column = mapUserStatusToKanbanColumn(status);
    // O mapa do Kanban devolve "applications" para o que não conhece: só vale quando o status é mesmo esse.
    const recognised = column !== "applications" || status.toLowerCase() === "applications";
    const index = recognised ? kanbanColumns.findIndex((c) => c.id === column) : -1;
    const key = index >= 0 ? column : `status:${status}`;
    const current = groups.get(key);
    if (current) {
      current.count += count;
    } else {
      groups.set(key, {
        key,
        label: index >= 0 ? kanbanColumns[index].label : status,
        count,
        order: index >= 0 ? index : Number.MAX_SAFE_INTEGER,
      });
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"))
    .map(({ key, label, count }) => ({ key, label, count }));
}

/**
 * "Como é calculado" das colunas da lista, para quando o servidor não manda `meta.definitions`. São os comentários do
 * contrato, em português de tela. Quando o servidor manda o texto, o dele vale.
 */
export const CAMPAIGN_COLUMN_DEFINITIONS = {
  owner: "A campanha não tem responsável próprio no banco: vale o proprietário do workspace.",
  participants: "Total: todas as participações. Em andamento: os 14 estados ativos da regra de capacidade de vagas.",
  deliveries: 'Conteúdos com status "publicado".',
  pending: "Participações aguardando ação do time do cliente (roteiro, conteúdo ou participante pendentes).",
  committed: "Reservas em aberto desta campanha. É um compromisso, não um pagamento.",
  released: 'Valor liberado a criadores (em carência, disponível ou já sacado). Não é "pago via PIX".',
} as const;
