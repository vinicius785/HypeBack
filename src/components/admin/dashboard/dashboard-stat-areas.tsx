import type { CSSProperties, ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { AdminErrorState, AdminFigureCard, AdminSection, type AdminLinkTarget } from "@/components/admin/platform";
import { useAdminCampaigns } from "@/hooks/admin/use-admin-campaigns";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { useAdminWorkspaceList } from "@/hooks/admin/use-admin-workspaces";
import { useUsersActivity } from "@/hooks/admin/use-users-activity";
import { campaignApplicationsOf, type AdminDateRange, type AdminOverview } from "@/shared/admin-platform.types";

import { DashboardCarousel, type CarouselPerson } from "./dashboard-carousel";
import { buildDashboardAreas, type DashboardArea, type DashboardHint } from "./dashboard-model";

import "@/styles/admin-dashboard.css";

interface DashboardStatAreasProps {
  overview: UseQueryResult<AdminOverview, unknown>;
  period: AdminDateRange;
}

/**
 * A definição do número que o texto de apoio cita ("Novos clientes no período"): entra no "i" do rótulo, como mais um
 * parágrafo (`hintInfo`), em vez de o apoio ter um segundo "i". O nome do número vai na frente, porque o "i" é de outro.
 */
function hintDefinition(hint: DashboardHint) {
  if (!hint.label || !hint.definition) return undefined;
  return (
    <>
      <strong>{hint.label}:</strong> {hint.definition}
    </>
  );
}

interface StatAreaProps {
  area: DashboardArea;
  /** Primeira carga: todo número é esqueleto. */
  loading: boolean;
  /** Período novo carregando (os números do anterior seguem na tela): só os que dependem do período viram esqueleto. */
  periodLoading: boolean;
  /** Embaixo dos números (o carrossel de fotos). */
  footer?: ReactNode;
}

/**
 * Um cartão (branco) com DOIS números lado a lado: o total e o que conta (ativos, ativos hoje, criados no período, publicadas
 * e inscrições). Cada número é um `AdminFigureCard` que leva à sua lista; o tipo e a regra vivem no "i" do rótulo.
 */
function StatArea({ area, loading, periodLoading, footer }: StatAreaProps) {
  const style = {
    "--c-lg": area.columns.lg,
    "--c-md": area.columns.md,
    "--c-sm": area.columns.sm,
  } as CSSProperties;

  return (
    <AdminSection title={area.title}>
      <div className="adm-dash-strip" style={style}>
        {area.stats.map((stat) => {
          const hint = stat.hint && !(stat.hint.periodic && periodLoading) ? stat.hint : undefined;
          return (
            <AdminFigureCard
              key={stat.id}
              variant="plain"
              label={stat.label}
              figure={stat.figure}
              to={stat.to}
              showKind={false}
              hint={hint?.text}
              hintInfo={hint ? hintDefinition(hint) : undefined}
              loading={loading || (periodLoading && stat.periodic === true) || stat.figure === undefined}
            />
          );
        })}
      </div>
      {footer}
    </AdminSection>
  );
}

/** Rostos para os carrosséis: quem tem foto vem primeiro (é o que se quer ver passar); sem foto entra por último. */
function faces<T extends { id: string | number; name: string; photo: string | null }>(items: readonly T[] | undefined, to: (item: T) => AdminLinkTarget): CarouselPerson[] {
  const list = (items ?? []).map((item) => ({ id: item.id, name: item.name, photo: item.photo, to: to(item) }));
  return [...list.filter((p) => p.photo), ...list.filter((p) => !p.photo)].slice(0, 24);
}

/** O mais recente primeiro: as 30 contas mais novas (a API ordena por cadastro). */
const NEWEST = { page: 1, per_page: 30, sort_by: "created_at", order: "desc" } as const;

/**
 * Os quatro cartões de números do Dashboard em grade (bento): Clientes e Criadores (com carrossel) na primeira linha, Usuários e
 * Campanhas (mais baixos) na segunda, para os cartões de cada linha terem a mesma altura e não sobrar espaço em branco. Quase tudo vem de UMA consulta
 * (`/admin/overview`); "Ativos hoje" e "Inscrições hoje" vêm das rotas de usuários e de campanhas, e os rostos dos carrosséis
 * (clientes e criadores) da lista mais recente de cada um. Carregando mostra os mesmos cartões em esqueleto (a tela não pula
 * de tamanho); falha mostra um só estado de erro com "Tentar de novo".
 */
export function DashboardStatAreas({ overview, period }: DashboardStatAreasProps) {
  const { data, isPending, isError, isPlaceholderData, isFetching, error, refetch } = overview;

  const usersActivity = useUsersActivity();
  const campaigns = useAdminCampaigns({ page: 1, per_page: 1 }, { refetchInterval: 60_000 });
  const workspaceFaces = useAdminWorkspaceList({ ...NEWEST });
  const creatorsActive = useAdminUsers({ page: 1, per_page: 1, status: "active", kind: "creator" });
  const creatorFaces = useAdminUsers({ ...NEWEST, status: "active,suspended,pending", kind: "creator" });

  if (isError && !data) {
    return (
      <AdminSection title="Números da plataforma">
        <AdminErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </AdminSection>
    );
  }

  const areas = buildDashboardAreas(data, period, {
    activeToday: usersActivity.activeToday === null ? null : { value: usersActivity.activeToday, capped: usersActivity.capped },
    applications: campaignApplicationsOf(campaigns.data?.meta),
    creatorsActive: creatorsActive.data?.meta.total ?? null,
  });
  const loading = isPending && !data;
  const periodLoading = isPlaceholderData;

  return (
    <div className="adm-dash-grid">
      <StatArea
        area={areas.workspaces}
        loading={loading}
        periodLoading={periodLoading}
        footer={
          <DashboardCarousel
            label="Clientes mais recentes"
            loading={workspaceFaces.isPending}
            people={faces(workspaceFaces.data?.data, (w) => ({ to: "/admin/workspaces/$workspaceId", params: { workspaceId: w.id } }))}
          />
        }
      />
      <StatArea
        area={areas.creators}
        loading={loading}
        periodLoading={periodLoading}
        footer={
          <DashboardCarousel
            label="Criadores mais recentes"
            loading={creatorFaces.isPending}
            people={faces(creatorFaces.data?.data, (c) => ({ to: "/admin/users/$userId", params: { userId: String(c.id) } }))}
          />
        }
      />
      <StatArea area={areas.users} loading={loading} periodLoading={periodLoading} />
      <StatArea area={areas.campaigns} loading={loading} periodLoading={periodLoading} />
    </div>
  );
}
