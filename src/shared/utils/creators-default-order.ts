import type { CatalogOrderBy, CatalogOrderDir } from "@/shared/services/creators-catalog";

/**
 * Ordenação enviada ao catálogo quando a pessoa NÃO escolheu uma: do criador mais ativo (última sessão mais recente)
 * para o menos ativo. "Perto de mim" segue pela distância (sem `order_by`), e a escolha explícita sempre vence.
 */
export function defaultCatalogOrder(
  explicit: { order_by?: CatalogOrderBy; order_dir?: CatalogOrderDir },
  nearMe: boolean,
): { order_by?: CatalogOrderBy; order_dir?: CatalogOrderDir } {
  if (explicit.order_by) return explicit;
  if (nearMe) return {};
  return { order_by: "activity", order_dir: "desc" };
}
