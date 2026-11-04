import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { AdminPage, AdminPageHeader, AdminTabPanel, AdminTabs, type AdminTabItem } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";

import { CommunityFeed } from "./community-feed";
import { CommunityGroups } from "./community-groups";
import { CommunityTeam } from "./community-team";
import { COMMUNITY_TAB_IDS, DEFAULT_COMMUNITY_TAB, resolveCommunityTab, type CommunityTabId } from "./community-search";

import "@/styles/admin-community.css";

const TABS: readonly AdminTabItem<CommunityTabId>[] = [
  { id: "feed", label: "Feed" },
  { id: "groups", label: "Grupos" },
  { id: "team", label: "Equipe" },
];

/** Fixo: não muda com a aba (o título da página diz o que ela é; a aba diz o que se vê). */
const SUBTITLE = "O que os criadores publicam no app e os grupos deles: acompanhe, modere, crie grupos e defina moderadores e contas oficiais.";

const TAB_PREFIX = "adm-com";

/**
 * Comunidade (`/admin/groups`): abre no Feed, a comunidade padrão do app (o "Para você": tudo o que os criadores
 * publicam, dentro e fora de grupos), e a aba Grupos guarda a gestão dos grupos. A aba mora na URL (`?tab=groups`).
 * O subtítulo é fixo; o cabeçalho só tem a ação primária da aba (Criar grupo, nos Grupos).
 */
export function CommunityPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [tabFromUrl, setTab] = useAdminSearchParam<CommunityTabId>("tab", DEFAULT_COMMUNITY_TAB, COMMUNITY_TAB_IDS);
  const tab = resolveCommunityTab(pathname, tabFromUrl);

  // Só a ação primária da aba: Criar grupo nos Grupos; no Feed não há nenhuma ("Atualizar" mora na barra do Feed).
  const actions =
    tab === "groups" ? (
      <button type="button" className="btn" onClick={() => navigate({ to: "/admin/groups/new" })}>
        <I n="plus" cls="sm" />
        Criar grupo
      </button>
    ) : undefined;

  return (
    <AdminPage>
      <AdminPageHeader title="Comunidade" subtitle={SUBTITLE} actions={actions} />

      <AdminTabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Seções da Comunidade" idPrefix={TAB_PREFIX} />

      <AdminTabPanel idPrefix={TAB_PREFIX} id="feed" active={tab === "feed"}>
        <CommunityFeed />
      </AdminTabPanel>
      <AdminTabPanel idPrefix={TAB_PREFIX} id="groups" active={tab === "groups"}>
        <CommunityGroups />
      </AdminTabPanel>

      <AdminTabPanel idPrefix={TAB_PREFIX} id="team" active={tab === "team"}>
        <CommunityTeam />
      </AdminTabPanel>

      {/* Rotas filhas (/admin/groups/new, /admin/groups/$groupId): diálogo sobre a lista de grupos. */}
      <Outlet />
    </AdminPage>
  );
}
