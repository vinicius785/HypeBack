import { useState } from "react";

import { AdminPage, AdminPageHeader } from "@/components/admin/platform";
import { AccountRequestsQueue } from "@/components/admin/account-type/account-requests-page";
import { SupportQueue } from "@/components/admin/support/support-page";
import { useAdminAccountTypeRequests } from "@/hooks/admin/use-admin-account-type-requests";
import { supportCounts, useAdminSupportTickets } from "@/hooks/admin/use-admin-support";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";

import { ServiceIsland, type ServiceCounts } from "./service-island";
import { DEFAULT_SERVICE_QUEUE, SERVICE_QUEUES, type ServiceQueue } from "./service-search";

/**
 * Atendimento (`/admin/support`): uma página só para o que a equipe atende, sem abas. A "ilha" no topo é a única
 * navegação (Suporte: ativos e resolvidos; Solicitações de conta: pendentes e histórico) e mostra o que aguarda a equipe;
 * embaixo, a busca, os filtros e a fila escolhida. A fila mora na URL (`?fila=requests`).
 */
export function AdminServicePage() {
  // Onde as filas penduram a barra (busca, filtros, atualizar): dentro da ilha.
  const [tools, setTools] = useState<HTMLElement | null>(null);
  const [queue, setQueue] = useAdminSearchParam<ServiceQueue>("fila", DEFAULT_SERVICE_QUEUE, SERVICE_QUEUES);

  // Só a contagem de cada fila: uma página de 1 item basta (o servidor manda o total e as contagens no `meta`).
  const support = useAdminSupportTickets({ status: "active", page: 1, per_page: 1 });
  const pending = useAdminAccountTypeRequests({ status: "pending", page: 1, per_page: 1 });
  const decided = useAdminAccountTypeRequests({ status: "decided", page: 1, per_page: 1 });

  const c = supportCounts(support.data?.meta);
  const counts: ServiceCounts = {
    supportActive: c ? c.by_status.open + c.by_status.in_progress + c.by_status.waiting : null,
    supportDone: c ? c.by_status.resolved + c.by_status.closed : null,
    unassigned: c ? c.unassigned : null,
    mine: c ? c.mine : null,
    inProgress: c ? c.by_status.in_progress : null,
    waiting: c ? c.by_status.waiting : null,
    requestsPending: pending.data?.meta.total ?? null,
    requestsDone: decided.data?.meta.total ?? null,
  };

  return (
    <AdminPage>
      <AdminPageHeader title="Atendimento" subtitle="Pedidos de ajuda e solicitações de troca de tipo de conta, em um só lugar." />

      <ServiceIsland value={queue} onChange={setQueue} counts={counts} toolsRef={setTools} />

      {queue === "support" ? <SupportQueue view="active" tools={tools} /> : null}
      {queue === "support-done" ? <SupportQueue view="resolved_all" tools={tools} /> : null}
      {queue === "requests" ? <AccountRequestsQueue view="pending" tools={tools} /> : null}
      {queue === "requests-done" ? <AccountRequestsQueue view="decided" tools={tools} /> : null}
    </AdminPage>
  );
}
