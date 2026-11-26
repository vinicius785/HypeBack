import { useState, type CSSProperties } from "react";

import { AdminBadge, AdminEmptyState, AdminFigureCard, AdminInfoPopover, AdminSection } from "@/components/admin/platform";
import {
  GROWTH_PERIODS_MAX,
  useGrowthActive,
  useGrowthApplications,
  useGrowthBase,
  useGrowthFunnel,
  useGrowthTimeline,
  useGrowthTrend,
} from "@/hooks/admin/use-admin-growth";
import { formatCivilDate, formatInt, formatPercent } from "@/lib/admin/format";
import type { AdminBadgeTone } from "@/components/admin/platform";
import type { GrowthGranularity, GrowthVerdict } from "@/shared/admin-growth.types";

import { ChartNote, ColumnChart, FunnelBars, LineChart } from "./growth-charts";
import { DecimalFigure, GrowthBlock, generatedAtText } from "./growth-block";
import {
  ACTIVE_WINDOW_LABEL,
  FUNNEL_LABEL,
  VERDICT_LABEL,
  formatDeltaPct,
  formatDeltaPoints,
  formatOneDecimal,
  growthFigure,
  labelOf,
  periodLabel,
  periodTitle,
} from "./growth-format";

const VERDICT_TONE: Record<GrowthVerdict, AdminBadgeTone> = { melhorando: "ok", estavel: "neutral", piorando: "warn" };

const strip = (lg: number): CSSProperties => ({ "--c-lg": lg, "--c-md": Math.min(lg, 3), "--c-sm": 2 }) as CSSProperties;

/** Base: quantas contas foram criadas, quantas concluíram o cadastro e quantas usam o app. */
function BaseSection() {
  const query = useGrowthBase();
  return (
    <AdminSection title="Base de criadores" description={generatedAtText(query.data) ?? "Foto de agora, sem seguir o período do topo."}>
      <GrowthBlock query={query} skeletonHeight={96}>
        {(base) => (
          <div className="adm-dash-strip" style={strip(4)}>
            <AdminFigureCard
              variant="plain"
              showKind={false}
              label="Contas criadas"
              figure={growthFigure(base.accounts_created, "count", "Todas as contas de criador já criadas, inclusive as excluídas.")}
            />
            <AdminFigureCard
              variant="plain"
              showKind={false}
              label="Visíveis no Admin"
              figure={growthFigure(base.visible_in_admin, "count", "O total da lista de Criadores do Admin.")}
            />
            <AdminFigureCard
              variant="plain"
              showKind={false}
              label="Cadastro concluído"
              hint={`${formatPercent(base.signup_completed_pct)} das criadas`}
              figure={growthFigure(base.signup_completed, "count", "Contas com o e-mail confirmado.")}
            />
            <AdminFigureCard
              variant="plain"
              showKind={false}
              label="Ativas em 30 dias"
              hint={`${formatPercent(base.active_pct)} das contas`}
              figure={growthFigure(base.active_30d, "count", "Criadores que usaram o app nos últimos 30 dias.", "proxy")}
            />
          </div>
        )}
      </GrowthBlock>
    </AdminSection>
  );
}

/** Ativos em 24h, 7, 15, 30 e 90 dias, os que esfriaram e a linha de cada janela quando o histórico existir. */
function ActiveSection() {
  const query = useGrowthActive();
  return (
    <AdminSection title="Quem usa o app" description="Criadores que abriram o app em cada janela de tempo.">
      <GrowthBlock query={query} skeletonHeight={180}>
        {(active) => {
          const history = active.history;
          return (
            <>
              <div className="adm-dash-strip" style={strip(3)}>
                {active.windows.map((w) => (
                  <AdminFigureCard
                    key={w.days}
                    variant="plain"
                    showKind={false}
                    label={`Ativos em ${labelOf(ACTIVE_WINDOW_LABEL as Record<string, string>, String(w.days))}`}
                    hint={`${formatPercent(w.pct_of_accounts)} das contas`}
                    figure={growthFigure(w.count, "count", `Criadores que usaram o app nas últimas ${labelOf(ACTIVE_WINDOW_LABEL as Record<string, string>, String(w.days))}.`, "proxy")}
                  />
                ))}
                <AdminFigureCard
                  variant="plain"
                  showKind={false}
                  label="Esfriaram"
                  figure={growthFigure(active.churned_30_90, "count", "Usaram o app nos últimos 90 dias e não usaram nos últimos 30.", "derived")}
                />
              </div>
              <div className="adm-gr-block" style={{ marginTop: 20 }}>
                <h3 className="adm-gr-sub">Ativos ao longo do tempo</h3>
                {history.length === 0 ? (
                  <AdminEmptyState
                    compact
                    title="O histórico começa hoje"
                    description="O registro diário ainda não rodou: os números acima são a foto de agora. A linha aparece conforme os dias forem sendo guardados."
                  />
                ) : (
                  <LineChart
                    label="Criadores ativos por dia, nas janelas de 7, 30 e 90 dias"
                    xLabels={history.map((h) => periodLabel(h.date, "week"))}
                    xTitles={history.map((h) => formatCivilDate(h.date))}
                    series={[
                      { key: "7", label: "7 dias", values: history.map((h) => h.active_7d) },
                      { key: "30", label: "30 dias", values: history.map((h) => h.active_30d) },
                      { key: "90", label: "90 dias", values: history.map((h) => h.active_90d) },
                    ]}
                  />
                )}
              </div>
            </>
          );
        }}
      </GrowthBlock>
    </AdminSection>
  );
}

/** Semana a semana: veredito (com a regra), variações da última semana fechada e as 4 semanas. */
function TrendSection() {
  const query = useGrowthTrend();
  return (
    <AdminSection title="Melhorando ou piorando?" description="Última semana fechada contra as 3 anteriores.">
      <GrowthBlock query={query} skeletonHeight={180}>
        {(trend) => {
          const d = trend.delta_vs_prev;
          return (
            <>
              <div className="adm-gr-trend">
                <AdminBadge tone={VERDICT_TONE[trend.verdict] ?? "neutral"}>{VERDICT_LABEL[trend.verdict] ?? trend.verdict}</AdminBadge>
                <AdminInfoPopover triggerLabel="Como o veredito é calculado">
                  <AdminInfoPopover.Paragraph>{trend.rule}</AdminInfoPopover.Paragraph>
                </AdminInfoPopover>
              </div>
              <ul className="adm-gr-deltas" aria-label="Última semana fechada contra a anterior">
                <li>Contas novas<b>{formatDeltaPct(d.accounts_new_pct)}</b></li>
                <li>Confirmação de e-mail<b>{formatDeltaPoints(d.confirmed_pct_points)}</b></li>
                <li>Candidaturas<b>{formatDeltaPct(d.applications_pct)}</b></li>
                <li>Candidaturas por dia<b>{formatDeltaPct(d.applications_per_day_pct)}</b></li>
                <li>Campanhas novas<b>{formatDeltaPct(d.campaigns_new_pct)}</b></li>
              </ul>
              <table className="adm-gr-weeks">
                <caption className="adm-sr">As 4 últimas semanas fechadas</caption>
                <thead>
                  <tr>
                    <th scope="col">Semana de</th>
                    <th scope="col">Contas novas</th>
                    <th scope="col">Confirmaram o e-mail</th>
                    <th scope="col">Candidaturas</th>
                    <th scope="col">Por dia</th>
                    <th scope="col">Campanhas novas</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.weeks.map((w) => (
                    <tr key={w.start}>
                      <th scope="row">{formatCivilDate(w.start)}</th>
                      <td>{formatInt(w.accounts_new)}</td>
                      <td>{formatPercent(w.confirmed_pct)}</td>
                      <td>{formatInt(w.applications)}</td>
                      <td>{formatOneDecimal(w.applications_per_day)}</td>
                      <td>{formatInt(w.campaigns_new)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ChartNote>Semana vai de segunda a domingo, em dias de São Paulo. Só semanas fechadas entram aqui.</ChartNote>
            </>
          );
        }}
      </GrowthBlock>
    </AdminSection>
  );
}

const PERIOD_CHOICES = [6, 12, 24, GROWTH_PERIODS_MAX] as const;

/** Mês ou semana, até 36 períodos: contas novas, candidaturas, campanhas e confirmação de e-mail. */
function TimelineSection() {
  const [granularity, setGranularity] = useState<GrowthGranularity>("month");
  const [periods, setPeriods] = useState<number>(12);
  const query = useGrowthTimeline(granularity, periods);
  const unit = granularity === "month" ? "meses" : "semanas";

  return (
    <AdminSection
      title="Ao longo do tempo"
      description="O último período está em andamento e aparece tracejado."
      actions={
        <div className="adm-gr-tools">
          <select
            className="adm-input"
            aria-label="Agrupar por"
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as GrowthGranularity)}
          >
            <option value="month">Por mês</option>
            <option value="week">Por semana</option>
          </select>
          <select className="adm-input" aria-label="Quantos períodos" value={periods} onChange={(event) => setPeriods(Number(event.target.value))}>
            {PERIOD_CHOICES.map((value) => (
              <option key={value} value={value}>
                Últimos {value} {unit}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <GrowthBlock query={query} skeletonHeight={320}>
        {(timeline) => {
          const g = timeline.granularity ?? granularity;
          const points = (pick: (p: (typeof timeline.periods)[number]) => number) =>
            timeline.periods.map((p) => ({ key: p.start, label: periodLabel(p.start, g), title: periodTitle(p.start, g), value: pick(p), partial: p.partial }));
          if (timeline.periods.length === 0) return <AdminEmptyState compact title="Sem períodos para mostrar" />;
          return (
            <div className="adm-gr-grid-2">
              <div className="adm-gr-block">
                <h3 className="adm-gr-sub">Contas novas</h3>
                <ColumnChart label="Contas novas por período" valueHeader="Contas novas" points={points((p) => p.accounts_new)} />
              </div>
              <div className="adm-gr-block">
                <h3 className="adm-gr-sub">Candidaturas</h3>
                <ColumnChart label="Candidaturas por período" valueHeader="Candidaturas" points={points((p) => p.applications)} />
              </div>
              <div className="adm-gr-block">
                <h3 className="adm-gr-sub">Campanhas criadas</h3>
                <ColumnChart label="Campanhas criadas por período" valueHeader="Campanhas" points={points((p) => p.campaigns_created)} />
              </div>
              <div className="adm-gr-block">
                <h3 className="adm-gr-sub">Confirmaram o e-mail</h3>
                <LineChart
                  label="Percentual de confirmação de e-mail por coorte"
                  xLabels={timeline.periods.map((p) => periodLabel(p.start, g))}
                  xTitles={timeline.periods.map((p) => periodTitle(p.start, g))}
                  series={[{ key: "confirmed", label: "% que confirmou", values: timeline.periods.map((p) => p.confirmed_pct) }]}
                  format={(value) => formatPercent(value)}
                />
                <ChartNote>
                  Por coorte: das contas criadas em cada período, quantas já confirmaram. Períodos recentes tendem a subir, porque as pessoas ainda estão confirmando.
                </ChartNote>
              </div>
            </div>
          );
        }}
      </GrowthBlock>
    </AdminSection>
  );
}

/** Funil de cadastro e as três saídas: não terminou, excluiu e e-mail sem confirmar. */
function FunnelSection() {
  const query = useGrowthFunnel();
  return (
    <AdminSection title="Funil de cadastro" description="Do cadastro até quem usa o app.">
      <GrowthBlock query={query} skeletonHeight={220}>
        {(funnel) => (
          <>
            <FunnelBars
              label="Funil de cadastro de criadores"
              steps={funnel.steps.map((s) => ({ key: s.key, label: labelOf(FUNNEL_LABEL, s.key), value: s.count }))}
            />
            <div className="adm-dash-strip" style={{ ...strip(3), marginTop: 20 }}>
              <AdminFigureCard
                variant="plain"
                showKind={false}
                label="Não concluíram"
                figure={growthFigure(funnel.started_not_finished, "count", "E-mails com código de confirmação pendente que ainda não viraram uma conta confirmada.")}
              />
              <AdminFigureCard
                variant="plain"
                showKind={false}
                label="Excluíram a conta"
                figure={growthFigure(funnel.deleted_anonymized, "count", "Contas de criador excluídas (anonimizadas).")}
              />
              <AdminFigureCard
                variant="plain"
                showKind={false}
                label="Sem e-mail confirmado"
                figure={growthFigure(funnel.email_unconfirmed, "count", "Contas ativas que ainda não confirmaram o e-mail.")}
              />
            </div>
            <ChartNote>Os cadastros incluem as contas excluídas; por isso o funil nem sempre desce de uma etapa para a outra.</ChartNote>
          </>
        )}
      </GrowthBlock>
    </AdminSection>
  );
}

/** Candidaturas: inscrição do próprio criador, sem convite, de criadores ativos. */
function ApplicationsSection() {
  const query = useGrowthApplications();
  return (
    <AdminSection title="Candidaturas" description="Inscrições do próprio criador em campanhas, sem convite.">
      <GrowthBlock query={query} skeletonHeight={96}>
        {(a) => (
          <div className="adm-dash-strip" style={strip(3)}>
            <AdminFigureCard variant="plain" showKind={false} label="Total" figure={growthFigure(a.total, "count", "Inscrições do próprio criador (sem convite), de criadores ativos.")} />
            <AdminFigureCard variant="plain" showKind={false} label="Últimos 7 dias" figure={growthFigure(a.last_7d, "count", "Candidaturas feitas nos últimos 7 dias.")} />
            <AdminFigureCard variant="plain" showKind={false} label="Últimos 30 dias" figure={growthFigure(a.last_30d, "count", "Candidaturas feitas nos últimos 30 dias.")} />
            <AdminFigureCard variant="plain" showKind={false} label="Candidatos distintos" figure={growthFigure(a.applicants_distinct, "count", "Criadores que se candidataram ao menos uma vez.")} />
            <DecimalFigure
              label="Média por candidato"
              value={formatOneDecimal(a.avg_per_applicant)}
              definition="Candidaturas divididas pelos candidatos distintos, com 1 casa decimal."
            />
            <AdminFigureCard
              variant="plain"
              showKind={false}
              label="Candidataram-se dos concluídos"
              figure={growthFigure(a.applied_of_completed_pct, "percent", "Das pessoas que confirmaram o e-mail, quantas já se candidataram.", "derived")}
            />
          </div>
        )}
      </GrowthBlock>
    </AdminSection>
  );
}

/** Aba "Crescimento" do dashboard. */
export function GrowthTab() {
  return (
    <>
      <BaseSection />
      <ActiveSection />
      <TrendSection />
      <TimelineSection />
      <FunnelSection />
      <ApplicationsSection />
    </>
  );
}
