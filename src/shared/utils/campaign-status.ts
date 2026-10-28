/**
 * A API pode retornar `status` como string ou como `{ value: string; label: string }`.
 */
export function getCampaignStatusValue(
  status: unknown
): string | undefined {
  if (status == null) return undefined;
  if (typeof status === "string") return status;
  if (typeof status === "object" && status !== null && "value" in status) {
    const v = (status as { value?: unknown }).value;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

/** Texto para badge: usa `label` da API quando existir; senão mapeia `value`. */
export function getCampaignStatusDisplayLabel(status: unknown): string {
  if (status != null && typeof status === "object" && "label" in (status as object)) {
    const l = (status as { label?: unknown }).label;
    if (typeof l === "string" && l.trim()) return l;
  }
  const v = getCampaignStatusValue(status);
  if (v === "published") return "Publicado";
  if (v === "draft") return "Rascunho";
  if (v === "active") return "Ativa";
  if (v === "finished" || v === "completed") return "Finalizada";
  return v ?? "—";
}
