import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";

import { WorkspaceProvider } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { isPlatformAdmin } from "@/lib/utils/platform-admin";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export const Route = createFileRoute("/(private)/(admin)")({
  component: AdminLayout,
});

/**
 * Layout do Super Admin Dashboard.
 *
 * Particularidades:
 * - Reaproveita `WorkspaceProvider` + `Sidebar` + `Header` pra consistência
 *   visual com o resto do backoffice.
 * - As requisições do dashboard NÃO enviam `Workspace-Id` (ver
 *   `src/shared/services/admin-dashboard.ts`).
 * - O guard é feito em runtime via `useAuth` + `isPlatformAdmin` —
 *   ele depende do `User` carregado em `(private)/_layout.tsx`, então
 *   `beforeLoad` ainda não tem acesso ao usuário (não usamos aqui).
 */
function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user && !isPlatformAdmin(user)) {
      navigate({ to: "/", replace: true });
    }
  }, [user, navigate]);

  if (!user || !isPlatformAdmin(user)) {
    return null;
  }

  return (
    <WorkspaceProvider>
      <div className="grid h-screen grid-cols-[252px_1fr] gap-4 bg-canvas p-4 max-[1100px]:grid-cols-[84px_1fr]">
        <Sidebar />

        <div className="flex min-w-0 flex-col overflow-hidden">
          <Header />

          <main className="w-full flex-1 overflow-y-auto px-2 pb-10 pt-4">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
