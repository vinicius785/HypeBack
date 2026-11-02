/**
 * Monta uma tela do Admin num roteador de verdade (histórico em memória) com React Query: a URL é a fonte do
 * estado da lista e da aba, então os testes conferem o que foi para a URL e o que foi para a API, sem simular
 * `useSearch`/`useNavigate`. Só os testes importam este arquivo.
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
import { vi } from "vitest";

export interface TestRoute {
  /** Caminho do roteador (`/admin/users`, `/admin/users/$userId`). */
  path: string;
  component: () => ReactNode;
  validateSearch?: (raw: Record<string, unknown>) => Record<string, unknown>;
}

/** Rota sem tela: só para o `Link` de uma tela apontar para um caminho que existe. */
export function stubRoute(path: string): TestRoute {
  return { path, component: () => <div data-testid={`stub:${path}`} /> };
}

export function createTestQueryClient(): QueryClient {
  // Sem espera entre tentativas e sem cache entre testes: um erro 5xx vira estado de erro na hora.
  return new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 }, mutations: { retry: false } } });
}

export function renderRoutes(routes: readonly TestRoute[], url: string) {
  // O roteador restaura a rolagem a cada navegação; o jsdom não implementa `window.scrollTo` e reclama no console.
  window.scrollTo = vi.fn() as typeof window.scrollTo;
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
  const queryClient = createTestQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Parâmetros de busca atuais da URL (já validados pela rota). */
export function currentSearch(router: ReturnType<typeof renderRoutes>["router"]): Record<string, unknown> {
  return router.state.location.search as Record<string, unknown>;
}
