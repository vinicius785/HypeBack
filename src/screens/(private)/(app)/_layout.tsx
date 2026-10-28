import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import { WorkspaceProvider } from "@/contexts/workspace-context";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

export const Route = createFileRoute("/(private)/(app)")({
  component: RouteComponent,
});

function RouteComponent() {
  const { pathname } = useLocation();

  let title = "Início";

  if (pathname === "/campaigns") {
    title = "Campanhas";
  } else if (pathname === "/campaigns/new") {
    title = "Criação de campanha";
  } else if (pathname.includes("/influencer/")) {
    title = "Perfil do influenciador";
  } else if (pathname.includes("/edit")) {
    title = "Editar campanha";
  } else if (pathname.startsWith("/campaigns/")) {
    title = "Detalhes da campanha";
  } else if (pathname === "/settings") {
    title = "Configurações";
  } else if (pathname === "/workspace/settings") {
    title = "Gerenciar workspace";
  } else if (pathname === "/financial") {
    title = "Financeiro";
  } else if (pathname === "/lives/new") {
    title = "Nova live";
  } else if (pathname.startsWith("/lives/")) {
    title = "Sala de controle";
  } else if (pathname === "/lives") {
    title = "Lives";
  }

  // Páginas já portadas para o novo visual trazem o próprio título.
  const ownTitle =
    pathname === "/" ||
    pathname === "/campaigns" ||
    pathname === "/creators" ||
    (pathname.startsWith("/lives/") && pathname !== "/lives/new") ||
    pathname === "/lives" ||
    pathname === "/financial" ||
    pathname === "/workspace/settings" ||
    pathname === "/settings" ||
    (pathname.startsWith("/campaigns/") && !pathname.includes("/influencer/"));
  if (ownTitle || pathname === "/lives/new" || pathname.includes("/influencer/")) title = "";
  // Detalhe da campanha: a barra do topo (voltar + ações) é da própria página.
  const detailOwnsTop =
    pathname.startsWith("/campaigns/") && !pathname.includes("/influencer/");

  return (
    <WorkspaceProvider>
      <div className="grid h-screen grid-cols-[252px_1fr] gap-4 bg-canvas p-4 max-[1100px]:grid-cols-[84px_1fr]">
        <Sidebar />

        <div className="flex min-w-0 flex-col overflow-hidden">
          {!detailOwnsTop && <Header title={title} />}

          <main className="w-full flex-1 overflow-y-auto px-2 pb-10 pt-4">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
