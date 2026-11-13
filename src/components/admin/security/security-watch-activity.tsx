import { useMemo, useState } from "react";

import { AdminBadge, AdminDrawer, AdminErrorState, AdminTable, type AdminTableColumn } from "@/components/admin/platform";
import { useWatchActivity } from "@/hooks/admin/use-admin-security";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import type { SecurityWatch, SecurityWatchActivityRow } from "@/shared/admin-platform.types";

import { deviceFromUserAgent, isErrorStatus, statusTone } from "./security-labels";

import "@/styles/admin-security.css";

type StatusFilter = "all" | "errors";

export const ACTIVITY_NOTICE = "Registro de rotas e IPs, guardado por 30 dias, visível só para administradores. Não inclui o conteúdo das requisições.";
export const ACTIVITY_EMPTY = "Sem atividade registrada nos últimos 30 dias.";

const COLUMNS: AdminTableColumn<SecurityWatchActivityRow>[] = [
  {
    key: "time",
    header: "Horário",
    width: "138px",
    nowrap: true,
    primary: true,
    cell: (row) => <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time>,
  },
  { key: "method", header: "Método", width: "68px", cell: (row) => <code className="adm-sec-mono">{row.method}</code> },
  {
    key: "path",
    header: "Rota",
    width: "minmax(0, 2fr)",
    cell: (row) => (
      <span className="adm-sec-act-path">
        <code className="adm-sec-mono">{row.path}</code>
        {row.hits > 1 ? <small className="adm-sec-act-hits">×{formatInt(row.hits)}</small> : null}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "76px",
    cell: (row) =>
      row.status === null ? (
        "—"
      ) : (
        <AdminBadge tone={statusTone(row.status)} size="sm">
          {row.status}
        </AdminBadge>
      ),
  },
  { key: "ip", header: "IP", width: "minmax(0, 1fr)", cell: (row) => (row.ip ? <code className="adm-sec-mono">{row.ip}</code> : "—") },
  { key: "device", header: "Aparelho", width: "minmax(0, 0.8fr)", cell: (row) => <span title={row.user_agent ?? undefined}>{deviceFromUserAgent(row.user_agent)}</span> },
];

/**
 * Atividade de um vigiado: tabela do mais recente para o mais antigo (horário de Brasília, método, rota, status, IP e aparelho),
 * com filtros no cliente por IP e por status (só erros) e "Carregar mais" por `offset`. IP, rota e User-Agent são texto simples
 * em fonte monoespaçada. Só o administrador chega aqui; um 403 da API aparece como "Sem permissão".
 */
export function WatchActivityDrawer({ watch, onClose }: { watch: SecurityWatch; onClose: () => void }) {
  const query = useWatchActivity(watch.id);
  const [ip, setIp] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const pages = query.data?.pages ?? [];
  const loaded = useMemo(() => pages.flatMap((page) => page.data), [pages]);
  const total = pages[pages.length - 1]?.meta?.total ?? loaded.length;
  const ips = useMemo(() => [...new Set(loaded.map((row) => row.ip).filter((value): value is string => Boolean(value)))], [loaded]);
  const rows = useMemo(
    () => loaded.filter((row) => (ip === "" || row.ip === ip) && (status === "all" || isErrorStatus(row.status))),
    [loaded, ip, status],
  );
  const filtered = ip !== "" || status !== "all";
  const left = Math.max(0, total - loaded.length);

  return (
    <AdminDrawer open onClose={onClose} title="Atividade" description={watch.email} size="lg">
      <div className="adm-sec-act">
        {query.error && loaded.length === 0 ? (
          <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <>
            {loaded.length > 0 ? (
              <div className="adm-sec-actfilters">
                <label>
                  <span>IP</span>
                  <select className="adm-input" value={ip} aria-label="Filtrar por IP" onChange={(event) => setIp(event.target.value)}>
                    <option value="">Todos os IPs</option>
                    {ips.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select className="adm-input" value={status} aria-label="Filtrar por status" onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                    <option value="all">Todos</option>
                    <option value="errors">Só erros (4xx e 5xx)</option>
                  </select>
                </label>
              </div>
            ) : null}
            <AdminTable
              caption={`Atividade de ${watch.email}`}
              columns={COLUMNS}
              rows={query.isLoading ? undefined : rows}
              rowKey={(row) => row.id}
              loading={query.isLoading}
              stickyHeader={false}
              skeletonRows={5}
              empty={{ title: filtered ? "Nada encontrado com esses filtros entre os carregados." : ACTIVITY_EMPTY }}
            />
            {query.hasNextPage ? (
              <div className="adm-sec-more">
                <button type="button" className="btn out adm-btn-sm" aria-disabled={query.isFetchingNextPage ? true : undefined} onClick={() => (query.isFetchingNextPage ? undefined : void query.fetchNextPage())}>
                  {query.isFetchingNextPage ? "Carregando…" : left > 0 ? `Carregar mais (${formatInt(left)})` : "Carregar mais"}
                </button>
              </div>
            ) : null}
          </>
        )}
        <p className="adm-sec-privacy">{ACTIVITY_NOTICE}</p>
      </div>
    </AdminDrawer>
  );
}
