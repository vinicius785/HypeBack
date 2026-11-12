import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { useState } from "react";

import { AdminIsland, AdminPage, AdminPageHeader, type AdminTabItem } from "@/components/admin/platform";
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
  // Onde cada aba pendura a sua barra (busca, filtros, atualizar): dentro da ilha.
  const [tools, setTools] = useState<HTMLElement | null>(null);

  return (
    <AdminPage>
      <AdminPageHeader title="Comunidade" subtitle={SUBTITLE} />

      {/* A ilha é a navegação (Feed, Grupos, Equipe) e abriga a barra da aba aberta (busca, filtros, atualizar). */}
      <AdminIsland
        ariaLabel="Comunidade"
        className="isl-com-w"
        toolsRef={setTools}
        start={
          <div className="isl-segs" role="group" aria-label="Seções da Comunidade">
            {TABS.map((item) => (
              <button key={item.id} type="button" className="isl-seg" aria-pressed={item.id === tab} onClick={() => setTab(item.id)}>
                <i aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        }
        end={
          tab === "groups" ? (
            <button type="button" className="isl-cta" onClick={() => navigate({ to: "/admin/groups/new" })}>
              <I n="plus" cls="sm" />
              Criar grupo
            </button>
          ) : null
        }
      />

      {tab === "feed" ? <CommunityFeed tools={tools} /> : null}
      {tab === "groups" ? <CommunityGroups tools={tools} /> : null}
      {tab === "team" ? <CommunityTeam tools={tools} /> : null}

      {/* Rotas filhas (/admin/groups/new, /admin/groups/$groupId): diálogo sobre a lista de grupos. */}
      <Outlet />
    </AdminPage>
  );
}
