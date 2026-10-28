import { I } from "@/components/prototype/ui";
import type { AdminWorkspaceRankingItem } from "@/shared/types";
import type { AdminWorkspaceRankingSort } from "@/shared/services/admin-dashboard";

import { formatAdminMoney } from "./admin-financial-volume-chart";
import { AdminSeg } from "./admin-period-filter";

interface AdminWorkspacesRankingProps {
  data: AdminWorkspaceRankingItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  sortBy: AdminWorkspaceRankingSort;
  onSortChange: (sort: AdminWorkspaceRankingSort) => void;
}

const SORTS: { id: AdminWorkspaceRankingSort; label: string }[] = [
  { id: "campaigns", label: "Campanhas ativas" },
  { id: "volume", label: "Volume" },
  { id: "influencers", label: "Criadores" },
];

const NUM = new Intl.NumberFormat("pt-BR");

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

function metric(r: AdminWorkspaceRankingItem, s: AdminWorkspaceRankingSort) {
  return s === "volume"
    ? r.total_volume
    : s === "influencers"
      ? r.influencers_contracted
      : r.active_campaigns;
}

export function AdminWorkspacesRanking({
  data,
  isLoading,
  isError,
  sortBy,
  onSortChange,
}: AdminWorkspacesRankingProps) {
  const rows = data ?? [];
  const mx = Math.max(...rows.map((r) => metric(r, sortBy)), 1);

  return (
    <div className="adx-cd">
      <div className="adx-ch-h">
        <div>
          <h3>Clientes em destaque</h3>
          <small>Workspaces que mais usam a plataforma</small>
        </div>
        <AdminSeg
          className="adx-sg"
          items={SORTS}
          value={sortBy}
          onChange={onSortChange}
        />
      </div>

      {isLoading ? (
        <div style={{ opacity: 0.4 }}>Carregando…</div>
      ) : isError || rows.length === 0 ? (
        <div className="empty">
          <span className="ei">
            <I n="users" />
          </span>
          <b>{isError ? "Não foi possível carregar" : "Sem dados ainda"}</b>
          <p>
            {isError
              ? "Não foi possível carregar o ranking."
              : "Sem workspaces ativos no período."}
          </p>
        </div>
      ) : (
        <div className="adx-rk">
          {rows.map((r, i) => {
            const v = metric(r, sortBy);
            return (
              <div
                className="adx-rr"
                key={r.workspace_id}
                style={{ "--k": i } as React.CSSProperties}
              >
                <span className="adx-rn">{i + 1}</span>
                <span
                  className="lvx-im sm"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    background: "#050505",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 18,
                  }}
                >
                  {initialsOf(r.workspace_name)}
                </span>
                <div className="adx-rb">
                  <b>{r.workspace_name}</b>
                  <div>
                    <i style={{ width: `${(v / mx) * 100}%` }} />
                  </div>
                </div>
                <strong>
                  {sortBy === "volume" ? formatAdminMoney(v) : NUM.format(v)}
                </strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
