/** Só para os testes de Criadores: monta a tela inteira (as três abas) num roteador de verdade. */
import { validateAdminCreatorsSearch } from "@/hooks/admin/use-admin-creators";
import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { AdminCreatorsScreen } from "./admin-creators-screen";

export function renderCreators(url = "/admin/creators") {
  return renderAdminRoute(
    [
      { path: "/admin/creators", component: AdminCreatorsScreen, validateSearch: validateAdminCreatorsSearch },
      stubRoute("/admin/campaigns/$campaignId"),
      stubRoute("/admin/workspaces/$workspaceId"),
      stubRoute("/admin/users/$userId"),
    ],
    url,
  );
}
