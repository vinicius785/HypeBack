/** Apoio dos testes das Atividades: a rota da tela e as do que ela linka, num roteador de verdade. */
import { renderAdminRoute, stubRoute, type TestRoute } from "@/test/render-admin-route";

import { ActivityPage } from "./activity-page";
import { validateActivitySearch } from "./activity-search";

export const ACTIVITY_ROUTES: TestRoute[] = [
  { path: "/admin/activity", component: ActivityPage, validateSearch: validateActivitySearch },
  stubRoute("/admin/workspaces/$workspaceId"),
  stubRoute("/admin/campaigns/$campaignId"),
  stubRoute("/admin/users/$userId"),
];

export function renderActivity(url = "/admin/activity") {
  return renderAdminRoute(ACTIVITY_ROUTES, url);
}
