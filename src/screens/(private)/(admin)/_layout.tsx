import { useEffect, useRef } from "react";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { WorkspaceProvider } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { useAdminSessionGuard } from "@/hooks/admin/use-admin-session-guard";
import { isPlatformStaff } from "@/lib/utils/platform-admin";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export const Route = createFileRoute("/(private)/(admin)")({
  component: AdminLayout,
});

/**
 * Rotas do Admin que abrem como diálogo por cima da lista (a lista continua montada por baixo, com a sua
 * rolagem): o scroll não pode voltar ao topo quando o diálogo abre.
 */
const KEEP_SCROLL_PREFIXES = ["/admin/groups"];

/**
 * Layout do Admin da plataforma.
 *
 * Particularidades:
 * - Reaproveita `WorkspaceProvider` + `Sidebar` + `MobileNav` do app, no escopo `platform`: o seletor de
 *   workspace some (trocar de workspace regravaria o `workspaceId` guardado, e o Admin não usa
 *   workspace), os itens do workspace saem e entra o "Voltar ao app". Nenhuma tela do Admin lê o contexto
 *   de workspace; o provider fica só porque o menu compartilhado com o app o exige, e faz a mesma
 *   inicialização de sempre (restaura o workspace guardado, ou grava o primeiro quando não há um válido —
 *   o que acontece igual ao abrir o app). Não existe ação na tela do Admin que troque o workspace.
 * - Sem o `Header` do app: o sino e o chat são do workspace selecionado, não da plataforma.
 * - As requisições do Admin NÃO enviam `Workspace-Id` (ver `src/lib/admin/admin-client.ts`).
 * - Sessão vencida ou conta suspensa no meio do uso (401 do Admin): `useAdminSessionGuard` faz o mesmo
 *   que o app faz quando `/me` volta 401 e leva para o login.
 * - O guard de acesso é feito em runtime via `useAuth` + `isPlatformStaff` — ele depende do `User`
 *   carregado em `(private)/_layout.tsx`, então `beforeLoad` ainda não tem acesso ao usuário. A segurança
 *   de verdade é o `PlatformAdminGuard` do backend (403).
 * - Celular (≤ 900px): sem sidebar, com a barra inferior; o <main> rola até o topo a cada página nova.
 */
function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useAdminSessionGuard();

  useEffect(() => {
    if (user && !isPlatformStaff(user)) {
      navigate({ to: "/", replace: true });
    }
  }, [user, navigate]);

  // O <main> é o mesmo elemento em todas as páginas: sem isso, a rolagem da página anterior continua e o
  // cabeçalho da nova abre cortado.
  const mainRef = useRef<HTMLElement>(null);
  const previous = useRef(pathname);
  useEffect(() => {
    const before = previous.current;
    previous.current = pathname;
    if (KEEP_SCROLL_PREFIXES.some((prefix) => pathname.startsWith(prefix) && before.startsWith(prefix))) return;
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (!user || !isPlatformStaff(user)) {
    return null;
  }

  return (
    <WorkspaceProvider>
      <div className="grid h-screen grid-cols-[252px_1fr] gap-4 bg-canvas p-4 max-[1100px]:grid-cols-[84px_1fr] max-[900px]:grid-cols-1 max-[900px]:gap-0 max-[900px]:p-0">
        <Sidebar scope="platform" />

        <div className="flex min-w-0 flex-col overflow-hidden">
          {/* Sem `pt-4` no <main>: o cabeçalho fixo das tabelas gruda na borda de cima da área que rola, e um
              respiro ali deixaria as linhas aparecerem por cima dele. O mesmo respiro vem do div de dentro. */}
          <main
            ref={mainRef}
            className="w-full flex-1 overflow-y-auto px-2 pb-10 max-[900px]:px-5 max-[900px]:pb-32"
          >
            <div className="pt-4">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <MobileNav scope="platform" />
    </WorkspaceProvider>
  );
}
