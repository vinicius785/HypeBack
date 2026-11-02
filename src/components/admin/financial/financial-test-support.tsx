/** Apoio dos testes do Financeiro: as rotas da tela e do que ela linka, montadas num roteador de verdade. */
import { renderAdminRoute, stubRoute, type TestRoute } from "@/test/render-admin-route";

import { FinancialPage } from "./financial-page";
import { validateFinancialSearch } from "./financial-search";

export const FINANCIAL_ROUTES: TestRoute[] = [
  { path: "/admin/financial", component: FinancialPage, validateSearch: validateFinancialSearch },
  stubRoute("/admin/workspaces/$workspaceId"),
  stubRoute("/admin/campaigns/$campaignId"),
  stubRoute("/admin/users/$userId"),
];

export function renderFinancial(url = "/admin/financial") {
  return renderAdminRoute(FINANCIAL_ROUTES, url);
}
