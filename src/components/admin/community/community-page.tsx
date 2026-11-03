import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { AdminPage, AdminPageHeader, AdminTabPanel, AdminTabs, type AdminTabItem } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";
import { communityPostKeys } from "@/hooks/use-community-posts";

import { CommunityFeed } from "./community-feed";
import { CommunityGroups } from "./community-groups";
import { COMMUNITY_TAB_IDS, DEFAULT_COMMUNITY_TAB, resolveCommunityTab, type CommunityTabId } from "./community-search";

import "@/styles/admin-community.css";

const TABS: readonly AdminTabItem<CommunityTabId>[] = [
  { id: "feed", label: "Feed" },
  { id: "groups", label: "Grupos" },
];

const SUBTITLE: Record<CommunityTabId, string> = {
  feed: "O que os criadores publicam no app, dentro e fora dos grupos: acompanhe e remova o que não deve ficar.",
  groups: "Grupos dos criadores no app: crie, modere e acompanhe.",
};

const TAB_PREFIX = "adm-com";

/**
 * Comunidade (`/admin/groups`): abre no Feed, a comunidade padrão do app (o "Para você": tudo o que os criadores
 * publicam, dentro e fora de grupos), e a aba Grupos guarda a gestão dos grupos. A aba mora na URL (`?tab=groups`).
 */
export function CommunityPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tabFromUrl, setTab] = useAdminSearchParam<CommunityTabId>("tab", DEFAULT_COMMUNITY_TAB, COMMUNITY_TAB_IDS);
  const tab = resolveCommunityTab(pathname, tabFromUrl);
  const refreshing = useIsFetching({ queryKey: communityPostKeys.all }) > 0;

  const actions =
    tab === "groups" ? (
      <button type="button" className="btn" onClick={() => navigate({ to: "/admin/groups/new" })}>
        <I n="plus" cls="sm" />
        Criar grupo
      </button>
    ) : (
      <button
        type="button"
        className="btn out adm-btn-sm adm-com-refresh"
        disabled={refreshing}
        aria-busy={refreshing ? true : undefined}
        onClick={() => void queryClient.invalidateQueries({ queryKey: communityPostKeys.all })}
      >
        <I n="refresh" cls="sm" />
        {refreshing ? "Atualizando…" : "Atualizar"}
      </button>
    );

  return (
    <AdminPage>
      <AdminPageHeader title="Comunidade" subtitle={SUBTITLE[tab]} actions={actions} />

      <AdminTabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Áreas da Comunidade" idPrefix={TAB_PREFIX} />

      <AdminTabPanel idPrefix={TAB_PREFIX} id="feed" active={tab === "feed"}>
        <CommunityFeed />
      </AdminTabPanel>
      <AdminTabPanel idPrefix={TAB_PREFIX} id="groups" active={tab === "groups"}>
        <CommunityGroups />
      </AdminTabPanel>

      {/* Rotas filhas (/admin/groups/new, /admin/groups/$groupId): diálogo sobre a lista de grupos. */}
      <Outlet />
    </AdminPage>
  );
}
