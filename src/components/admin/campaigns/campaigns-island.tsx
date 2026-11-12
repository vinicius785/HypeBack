import { useState, type ReactNode } from "react";

import { AdminIsland, AdminIslandStat, type AdminFilterOption } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminCampaigns } from "@/hooks/admin/use-admin-campaigns";
import { campaignApplicationsOf } from "@/shared/admin-platform.types";
import { civilDateInSaoPaulo, formatInt } from "@/lib/admin/format";

import "@/styles/admin-campaigns.css";

/** Quantas campanhas há (uma página de 1 item: o servidor manda o total no `meta`). */
const ONE = { page: 1, per_page: 1 } as const;
const LIVE_REFRESH_MS = 60_000;

const n = (value: number | undefined) => (value === undefined ? "—" : formatInt(value));

/** O dia de São Paulo `days` dias atrás (0 = hoje), como `YYYY-MM-DD`. */
function daysAgo(days: number): string {
  return civilDateInSaoPaulo(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Primeiro dia do mês corrente em São Paulo. */
function monthStart(): string {
  return `${civilDateInSaoPaulo().slice(0, 8)}01`;
}

interface Props {
  /** Estados da campanha, na ordem das pílulas (o primeiro, `""`, é "Todas"). */
  options: readonly AdminFilterOption[];
  /** Estado escolhido (`""` = todas). */
  value: string;
  onChange: (status: string) => void;
  /** A barra da lista (busca, ordenar, filtros, atualizar): mora dentro da ilha. */
  children: ReactNode;
}

const STATUS_TONE: Record<string, "ok" | "warn" | undefined> = { published: "ok", draft: "warn" };

/**
 * "Ilha" (padrão `AdminIsland`) de Campanhas: à esquerda, os estados da campanha como pílulas com a contagem de cada um
 * (filtram a lista); à direita, "Inscrições hoje" (radar, vem do `meta.applications` da API) e "Criadas hoje" (seta verde).
 * Embaixo, a barra da lista; a seta abre uma folha com as inscrições e as criações de 7 dias e do mês. As contagens da folha só são pedidas ao abrir.
 */
export function CampaignsIsland({ options, value, onChange, children }: Props) {
  const [open, setOpen] = useState(false);
  const today = civilDateInSaoPaulo();

  // Uma consulta de 1 item por estado: a contagem de cada pílula ("Todas" não manda `status`).
  const counts = options.map((option) => ({
    option,
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `options` é uma lista fixa da tela (nunca muda de tamanho)
    // "Todas" também traz `meta.applications` (inscrições hoje, 7 dias e mês) e se atualiza sozinha.
    query: useAdminCampaigns(option.value ? { ...ONE, status: option.value } : { ...ONE }, option.value ? {} : { refetchInterval: LIVE_REFRESH_MS }),
  }));
  const allQuery = counts.find((c) => c.option.value === "")?.query;
  const applications = campaignApplicationsOf(allQuery?.data?.meta);
  const createdToday = useAdminCampaigns({ ...ONE, created_from: today, created_to: today }, { refetchInterval: LIVE_REFRESH_MS });

  // Só ao abrir a folha.
  const week = useAdminCampaigns({ ...ONE, created_from: daysAgo(6), created_to: today }, { enabled: open });
  const month = useAdminCampaigns({ ...ONE, created_from: monthStart(), created_to: today }, { enabled: open });

  return (
    <AdminIsland
      ariaLabel="Campanhas"
      className="isl-cmp-w"
      open={open}
      onOpenChange={setOpen}
      sheetLabel="Resumo das campanhas"
      chevronLabel={{ open: "Abrir o resumo das campanhas", close: "Fechar o resumo das campanhas" }}
      start={
        <div className="isl-segs" role="group" aria-label="Status da campanha">
          {counts.map(({ option, query }) => (
            <button
              key={option.value || "all"}
              type="button"
              className="isl-seg"
              data-tone={STATUS_TONE[option.value]}
              aria-pressed={option.value === value}
              onClick={() => onChange(option.value)}
            >
              <i aria-hidden="true" />
              {option.label}
              <em>{n(query.data?.meta.total)}</em>
            </button>
          ))}
        </div>
      }
      end={
        <div className="isl-live" role="group" aria-label="Agora">
          <AdminIslandStat
            icon={<I n="users" cls="sm" />}
            anim="radar"
            tone={applications && applications.today > 0 ? "ok" : undefined}
            value={applications ? formatInt(applications.today) : "—"}
            label="Inscrições hoje"
            hint="Criadores que se inscreveram em campanhas hoje (horário de São Paulo); convites da marca não contam"
          />
          <AdminIslandStat
            icon={<I n="arrup" cls="sm" />}
            anim="rise"
            tone="ok"
            value={n(createdToday.data?.meta.total)}
            label="Criadas hoje"
            hint="Campanhas criadas hoje (horário de São Paulo)"
          />
        </div>
      }
      tools={children}
      sheet={
        <div className="adm-cmp-sheet">
          <div>
            <small>Inscrições em 7 dias</small>
            <b>{applications ? formatInt(applications.last_7_days) : "—"}</b>
            <span>contando hoje</span>
          </div>
          <div>
            <small>Inscrições no mês</small>
            <b>{applications ? formatInt(applications.month_to_date) : "—"}</b>
            <span>desde o dia 1</span>
          </div>
          <div>
            <small>Criadas em 7 dias</small>
            <b>{n(week.data?.meta.total)}</b>
            <span>contando hoje</span>
          </div>
          <div>
            <small>Criadas neste mês</small>
            <b>{n(month.data?.meta.total)}</b>
            <span>desde o dia 1</span>
          </div>
        </div>
      }
    />
  );
}
