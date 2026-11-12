import { useEffect, useMemo, useRef, useState } from "react";

import { useAdminCampaigns } from "@/hooks/admin/use-admin-campaigns";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminWorkspaceList } from "@/hooks/admin/use-admin-workspaces";
import { campaignApplicationsOf, type AdminActivityEvent } from "@/shared/admin-platform.types";

/** O que a ilha do Dashboard anuncia. */
export type DashboardNewsKind = "workspace" | "user" | "creator" | "campaign" | "application" | "charge" | "withdrawal";

export interface DashboardNews {
  /** Muda quando chega novidade (a ilha anuncia quando o `id` muda; nunca na primeira carga). */
  id: string;
  kind: DashboardNewsKind;
  /** Quem ou o quê ("Café Serra Verde"). */
  subject: string;
  /** Quando aconteceu (ISO). */
  at: string;
}

const NEWS_REFRESH_MS = 30_000;
const NEWEST = { page: 1, per_page: 1, sort_by: "created_at", order: "desc" } as const;

/**
 * A última novidade da plataforma, para a ilha do Dashboard: de todas as fontes (cliente, usuário, criador e campanha mais
 * novos, aporte e saque pagos do feed e inscrições), a mais recente. Cada fonte é uma consulta de 1 item que se atualiza a
 * cada 30 segundos. Inscrição não tem item na API (só o contador do dia): vira novidade quando o contador SOBE entre duas
 * leituras, e então fica no horário em que o aumento foi visto.
 */
export function useDashboardNews(activity: readonly AdminActivityEvent[] | undefined): DashboardNews | null {
  const refresh = { refetchInterval: NEWS_REFRESH_MS } as const;
  const workspace = useAdminWorkspaceList({ ...NEWEST });
  const user = useAdminUsers({ ...NEWEST, status: "active,suspended,pending" }, refresh);
  const creator = useAdminUsers({ ...NEWEST, status: "active,suspended,pending", kind: "creator" }, refresh);
  const campaign = useAdminCampaigns({ page: 1, per_page: 1 }, refresh);

  // Inscrições: só o contador do dia. Aumentou desde a leitura anterior = chegou inscrição agora.
  const applications = campaignApplicationsOf(campaign.data?.meta)?.today;
  const previous = useRef<number | undefined>(undefined);
  const [application, setApplication] = useState<DashboardNews | null>(null);
  useEffect(() => {
    if (applications === undefined) return;
    if (previous.current !== undefined && applications > previous.current) {
      const added = applications - previous.current;
      setApplication({ id: `application:${applications}`, kind: "application", subject: added === 1 ? "1 nova inscrição" : `${added} novas inscrições`, at: new Date().toISOString() });
    }
    previous.current = applications;
  }, [applications]);

  const w = workspace.data?.data[0];
  const u = user.data?.data[0];
  const c = creator.data?.data[0];
  const k = campaign.data?.data[0];
  const paid = activity?.find((event) => event.kind === "charge_paid" || event.kind === "withdrawal_paid");

  // Memoizado: a ilha reage à troca de `id`, então o objeto só pode mudar quando a novidade muda (senão o efeito dela roda a cada render).
  return useMemo(() => {
    const candidates: DashboardNews[] = [];
    if (w) candidates.push({ id: `workspace:${w.id}`, kind: "workspace", subject: w.name, at: w.created_at });
    if (u) candidates.push({ id: `user:${u.id}`, kind: "user", subject: u.name, at: u.created_at });
    if (c) candidates.push({ id: `creator:${c.id}`, kind: "creator", subject: c.name, at: c.created_at });
    if (k) candidates.push({ id: `campaign:${k.id}`, kind: "campaign", subject: k.title, at: k.created_at });
    if (paid) candidates.push({ id: `${paid.kind}:${paid.id}`, kind: paid.kind === "charge_paid" ? "charge" : "withdrawal", subject: paid.title, at: paid.occurred_at });
    if (application) candidates.push(application);
    const valid = candidates.filter((n) => Number.isFinite(Date.parse(n.at)));
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => (Date.parse(b.at) > Date.parse(a.at) ? b : a));
  }, [w?.id, w?.name, w?.created_at, u?.id, u?.name, u?.created_at, c?.id, c?.name, c?.created_at, k?.id, k?.title, k?.created_at, paid?.id, paid?.kind, paid?.title, paid?.occurred_at, application]);
}
