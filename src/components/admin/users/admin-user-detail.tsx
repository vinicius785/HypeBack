import {
  AdminAvatar,
  AdminBadge,
  AdminErrorState,
  AdminNotFound,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSkeleton,
  AdminSkeletonLines,
  AdminStatusBadge,
  AdminTabPanel,
  AdminTabs,
  type AdminCrumb,
  type AdminTabItem,
} from "@/components/admin/platform";
import { useAuth } from "@/contexts/auth-context";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";
import { useAdminUser } from "@/hooks/admin/use-admin-users";
import { AdminApiError, isAdminApiError } from "@/lib/admin/admin-client";
import type { AdminUserDetail } from "@/shared/admin-platform.types";

import { AdminUserActionNotice, AdminUserActions } from "./admin-user-actions";
import { AdminUserActivityTab } from "./admin-user-activity-tab";
import { AdminUserData, AdminUserSuspension } from "./admin-user-info";
import { AdminUserNetworks } from "./admin-user-networks";
import { AdminUserTrustSection } from "./admin-user-trust";
import { AdminUserLinksTab } from "./admin-user-links-tab";
import { AdminUserSessionsTab } from "./admin-user-sessions-tab";
import { userKindText } from "./admin-users-format";
import { usersListLabel, usersListLink } from "./admin-users-links";

import "@/styles/admin-users.css";

/** `summary` (Resumo) é a primeira e a padrão; `links`, `sessions` e `activity` são os valores que já existiam na URL. */
export const ADMIN_USER_TABS = ["summary", "links", "sessions", "activity"] as const;
export type AdminUserTab = (typeof ADMIN_USER_TABS)[number];

/** `validateSearch` da rota do detalhe: só `tab`, e só um valor conhecido (a barra de endereço é entrada de usuário). */
export function validateAdminUserSearch(raw: Record<string, unknown>): { tab?: AdminUserTab } {
  const tab = (ADMIN_USER_TABS as readonly unknown[]).includes(raw.tab) ? (raw.tab as AdminUserTab) : undefined;
  return tab && tab !== "summary" ? { tab } : {};
}

/** Migalha de volta à lista: calculada a cada render, para levar os filtros e a ordenação que a pessoa deixou. */
const listCrumb = (kind?: string): AdminCrumb => ({ label: usersListLabel(kind), to: usersListLink(kind) });

/** O id da URL precisa ser um inteiro positivo; qualquer outra coisa nem vai ao servidor. */
const VALID_USER_ID = /^[1-9]\d{0,17}$/;

function DetailSkeleton() {
  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumb={[listCrumb(), { label: "Usuário" }]}
        leading={<AdminSkeleton width={64} height={64} radius="50%" />}
        title={
          <>
            <AdminSkeleton width={240} height={34} />
            <span className="adm-sr">Usuário</span>
          </>
        }
        subtitle={<AdminSkeleton width={200} height={14} />}
      />
      <span className="adm-sr" role="status">
        Carregando usuário…
      </span>
      <AdminSection>
        <AdminSkeletonLines lines={5} />
      </AdminSection>
    </AdminPage>
  );
}

function DetailError({ error, onRetry, retrying }: { error: unknown; onRetry?: () => void; retrying?: boolean }) {
  return (
    <AdminPage>
      <AdminPageHeader breadcrumb={[listCrumb(), { label: "Usuário" }]} title="Usuário" />
      {isAdminApiError(error, "NOT_FOUND") ? (
        <AdminNotFound entity="usuário" backTo={usersListLink()} />
      ) : (
        <AdminErrorState boxed error={error} onRetry={onRetry} retrying={retrying} />
      )}
    </AdminPage>
  );
}

function AdminUserDetailView({ user }: { user: AdminUserDetail }) {
  const { user: me } = useAuth();
  const [tab, setTab] = useAdminSearchParam<AdminUserTab>("tab", "summary", ADMIN_USER_TABS);

  const tabs: AdminTabItem<AdminUserTab>[] = [
    { id: "summary", label: "Resumo" },
    { id: "links", label: "Vínculos", count: user.workspaces.length },
    { id: "sessions", label: "Sessões", count: user.sessions.active_count },
    { id: "activity", label: "Atividade" },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumb={[listCrumb(user.kind), { label: user.name }]}
        leading={<AdminAvatar name={user.name} photo={user.photo} size={64} />}
        title={user.name}
        // O nome fica sozinho na linha do título; o e-mail e as etiquetas (estado, tipo, admin) vêm juntos logo abaixo.
        subtitle={
          <span className="adm-users-id">
            <span className="adm-users-id-email">{user.email}</span>
            <span className="adm-users-id-badges">
              <AdminStatusBadge kind="user" value={user.status} title={user.pending_step?.label} />
              {/* conta em cadastro: o texto que a API já manda sobre a etapa em que ela parou fica à vista, ao lado */}
              {user.status === "pending" && user.pending_step?.label ? <span className="adm-muted">{user.pending_step.label}</span> : null}
              <AdminBadge>{userKindText(user.kind)}</AdminBadge>
              {user.is_platform_admin ? (
                <AdminBadge tone="brand" title="Tem acesso ao Admin da plataforma">
                  Admin da plataforma
                </AdminBadge>
              ) : null}
            </span>
          </span>
        }
        actions={<AdminUserActions user={user} selfId={me?.id} />}
      />

      <AdminUserActionNotice user={user} selfId={me?.id} />
      <AdminUserSuspension user={user} />

      <AdminTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Seções do usuário" idPrefix="admin-user" />
      <AdminTabPanel idPrefix="admin-user" id="summary" active={tab === "summary"}>
        {/* Em tela larga a confiança e os dados ficam lado a lado (sem os vãos de um cartão de largura inteira). */}
        <div className="adm-users-summary">
          <AdminUserTrustSection trust={user.trust} />
          <div className="adm-users-summary-col">
            <AdminUserData user={user} />
            <AdminUserNetworks user={user} />
          </div>
        </div>
      </AdminTabPanel>
      <AdminTabPanel idPrefix="admin-user" id="links" active={tab === "links"}>
        <AdminUserLinksTab user={user} />
      </AdminTabPanel>
      <AdminTabPanel idPrefix="admin-user" id="sessions" active={tab === "sessions"}>
        <AdminUserSessionsTab user={user} />
      </AdminTabPanel>
      <AdminTabPanel idPrefix="admin-user" id="activity" active={tab === "activity"}>
        <AdminUserActivityTab userId={user.id} />
      </AdminTabPanel>
    </AdminPage>
  );
}

/**
 * Detalhe do usuário (`/admin/users/:userId`): cabeçalho com foto, nome, e-mail, estado, tipo e as ações; o aviso de
 * por que não há ação (quando é o caso) e o bloco da suspensão (quando há); e as abas Resumo (dados da conta),
 * Vínculos, Sessões e Atividade (na URL: `?tab=`).
 */
export function AdminUserDetailScreen({ userId }: { userId: string }) {
  const validId = VALID_USER_ID.test(userId);
  const query = useAdminUser(validId ? userId : undefined);

  if (!validId) {
    return <DetailError error={new AdminApiError({ status: 404, code: "NOT_FOUND", message: "Usuário não encontrado." })} />;
  }
  if (query.isLoading) return <DetailSkeleton />;
  if (!query.data) {
    return <DetailError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  }
  // `key`: ir de um usuário a outro (pelo link de quem agiu) começa do zero: aba, página e diálogo não "vazam".
  return <AdminUserDetailView key={query.data.id} user={query.data} />;
}
