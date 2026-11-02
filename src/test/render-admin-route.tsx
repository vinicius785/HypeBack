/**
 * Monta uma tela do Admin num roteador de verdade (histórico em memória) com React Query: a URL é a fonte do estado
 * da lista, então testar filtros/ordenação/página/abas é conferir o que vai para a URL e o que vai para a API, sem
 * simular `useSearch`/`useNavigate` na mão.
 *
 * Fica em `src/test` (e não em `src/screens`): tudo dentro de `src/screens` é lido pelo gerador de rotas.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type AnyRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

// O jsdom não implementa `scrollTo` (o roteador chama a cada navegação) e reclama no console: aqui não há rolagem.
if (typeof window !== "undefined") window.scrollTo = (() => {}) as typeof window.scrollTo;

export interface TestRoute {
  /** Caminho do roteador (`/admin/campaigns`, `/admin/campaigns/$campaignId`). */
  path: string;
  component: () => ReactNode;
  validateSearch?: (raw: Record<string, unknown>) => Record<string, unknown>;
}

/** Rota sem tela, só para o `Link` de uma tela apontar para um caminho que existe (ex.: o detalhe do workspace). */
export function stubRoute(path: string): TestRoute {
  return { path, component: () => <div data-testid={`stub:${path}`} /> };
}

export function renderAdminRoute(routes: readonly TestRoute[], url: string) {
  const root = createRootRoute({ component: Outlet });
  const children = routes.map((route) =>
    createRoute({
      getParentRoute: () => root,
      path: route.path,
      component: route.component,
      validateSearch: route.validateSearch,
    }),
  ) as AnyRoute[];
  const router = createRouter({
    routeTree: root.addChildren(children),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  // Sem retry nem espera entre tentativas: um erro 5xx vira estado de erro na hora, e nada fica em cache entre testes.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Parâmetros de busca atuais da URL (já validados pela rota). */
export function currentSearch(router: ReturnType<typeof renderAdminRoute>["router"]): Record<string, unknown> {
  return router.state.location.search as Record<string, unknown>;
}
