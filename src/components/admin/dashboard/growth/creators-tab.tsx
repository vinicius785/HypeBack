import { useState, type CSSProperties } from "react";

import { AdminEmptyState, AdminFigureCard, AdminSection } from "@/components/admin/platform";
import {
  ENGAGEMENT_DAYS_DEFAULT,
  useGrowthEngagement,
  useGrowthNeverApplied,
  useGrowthProfile,
} from "@/hooks/admin/use-admin-growth";
import { formatCivilDate, formatInt, formatPercent } from "@/lib/admin/format";
import type { GrowthNetwork } from "@/shared/admin-growth.types";

import { BarList, ChartNote, LineChart, StackedBar } from "./growth-charts";
import { GrowthBlock, generatedAtText } from "./growth-block";
import {
  ENGAGEMENT_LABEL,
  FOLLOWER_BAND_LABEL,
  GENDER_LABEL,
  NETWORK_LABEL,
  cityName,
  growthFigure,
  labelOf,
  nicheName,
  periodLabel,
} from "./growth-format";

const strip = (lg: number): CSSProperties => ({ "--c-lg": lg, "--c-md": Math.min(lg, 3), "--c-sm": 2 }) as CSSProperties;

const DAY_CHOICES = [1, 7, 14, ENGAGEMENT_DAYS_DEFAULT, 60, 90] as const;
const dayText = (days: number) => (days === 1 ? "Último dia" : `Últimos ${days} dias`);

/** O que os criadores fazem no app. É a consulta mais pesada do painel: só roda quando a aba Criadores abre. */
function EngagementSection() {
  const [days, setDays] = useState<number>(ENGAGEMENT_DAYS_DEFAULT);
  const query = useGrowthEngagement(days);
  return (
    <AdminSection
      title="Engajamento"
      description={generatedAtText(query.data) ?? "Quantos criadores fizeram cada ação no app. Pode levar alguns segundos."}
      actions={
        <select className="adm-input" aria-label="Período do engajamento" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {DAY_CHOICES.map((value) => (
            <option key={value} value={value}>
              {dayText(value)}
            </option>
          ))}
        </select>
      }
    >
      <GrowthBlock query={query} skeletonHeight={360}>
        {(eng) => {
          const rows = Object.entries(eng.by_action)
            .map(([key, value]) => ({ key, label: labelOf(ENGAGEMENT_LABEL, key), value }))
            .sort((a, b) => b.value - a.value);
          return (
            <>
              <div className="adm-dash-strip" style={strip(3)}>
                <AdminFigureCard
                  variant="plain"
                  showKind={false}
                  label="Fizeram alguma ação"
                  hint={`${formatPercent(eng.engaged_any_pct)} das contas`}
                  figure={growthFigure(eng.engaged_any, "count", `Criadores distintos com ao menos uma ação nos ${dayText(eng.days).toLowerCase()}.`, "derived")}
                />
                <AdminFigureCard
                  variant="plain"
                  showKind={false}
                  label="3 tipos de ação ou mais"
                  figure={growthFigure(eng.engaged_3plus, "count", "Criadores que fizeram ao menos 3 tipos diferentes de ação.", "derived")}
                />
                <AdminFigureCard
                  variant="plain"
                  showKind={false}
                  label="5 tipos de ação ou mais"
                  figure={growthFigure(eng.engaged_5plus, "count", "Criadores que fizeram ao menos 5 tipos diferentes de ação.", "derived")}
                />
              </div>
              <div className="adm-gr-block" style={{ marginTop: 20 }}>
                <h3 className="adm-gr-sub">Criadores por tipo de ação</h3>
                <BarList label={`Criadores por tipo de ação, ${dayText(eng.days).toLowerCase()}`} rows={rows} total={eng.accounts} />
                <ChartNote>Cada criador conta uma vez por ação. A porcentagem é sobre as {formatInt(eng.accounts)} contas ativas.</ChartNote>
              </div>
              {eng.days === ENGAGEMENT_DAYS_DEFAULT ? (
                <div className="adm-gr-block" style={{ marginTop: 20 }}>
                  <h3 className="adm-gr-sub">Engajados ao longo do tempo</h3>
                  {eng.history.length === 0 ? (
                    <AdminEmptyState compact title="O histórico começa hoje" description="O registro diário ainda não rodou: os números acima são a foto de agora." />
                  ) : (
                    <LineChart
                      label="Criadores engajados por dia"
                      xLabels={eng.history.map((h) => periodLabel(h.date, "week"))}
                      xTitles={eng.history.map((h) => formatCivilDate(h.date))}
                      series={[
                        { key: "any", label: "Alguma ação", values: eng.history.map((h) => h.engaged_any) },
                        { key: "3", label: "3 tipos ou mais", values: eng.history.map((h) => h.engaged_3plus) },
                        { key: "5", label: "5 tipos ou mais", values: eng.history.map((h) => h.engaged_5plus) },
                      ]}
                    />
                  )}
                </div>
              ) : null}
            </>
          );
        }}
      </GrowthBlock>
    </AdminSection>
  );
}

/** Quem nunca se candidatou: só contagens, nenhum criador individual. */
function NeverAppliedSection() {
  const query = useGrowthNeverApplied();
  return (
    <AdminSection
      title="Quem nunca se candidatou"
      description={generatedAtText(query.data) ?? "Só contagens: nenhum criador aparece aqui."}
    >
      <GrowthBlock query={query} skeletonHeight={280}>
        {(data) => (
          <>
            <div className="adm-dash-strip" style={strip(1)}>
              <AdminFigureCard
                variant="plain"
                showKind={false}
                label="Criadores que nunca se candidataram"
                figure={growthFigure(data.total, "count", "Criadores ativos sem nenhuma candidatura própria (sem convite).", "derived")}
              />
            </div>
            <div className="adm-gr-block" style={{ marginTop: 20 }}>
              <h3 className="adm-gr-sub">Perfil preenchido</h3>
              <StackedBar
                label="Perfil de quem nunca se candidatou"
                segments={[
                  { key: "complete", label: "Completo", value: data.profile.complete },
                  { key: "partial", label: "Parcial", value: data.profile.partial },
                  { key: "empty", label: "Vazio", value: data.profile.empty },
                ]}
              />
              <ChartNote>Completo: rede conectada, cidade e nicho principal. Vazio: nenhum dos três. Parcial: o resto.</ChartNote>
            </div>
            <div className="adm-gr-grid-3" style={{ marginTop: 20 }}>
              <div className="adm-gr-block">
                <h3 className="adm-gr-sub">Por rede</h3>
                <BarList
                  label="Quem nunca se candidatou, por rede"
                  rows={data.by_network.map((n) => ({ key: n.network, label: labelOf(NETWORK_LABEL, n.network), value: n.count }))}
                />
              </div>
              <div className="adm-gr-block">
                <h3 className="adm-gr-sub">Por nicho (top 15)</h3>
                <BarList
                  label="Quem nunca se candidatou, por nicho"
                  rows={data.by_niche.map((n) => ({ key: String(n.niche_id), label: nicheName(n.name, n.parent_id), value: n.count }))}
                />
              </div>
              <div className="adm-gr-block">
                <h3 className="adm-gr-sub">Por cidade (top 15)</h3>
                <BarList
                  label="Quem nunca se candidatou, por cidade"
                  rows={data.by_city.map((c) => ({ key: `${c.city}/${c.state}`, label: cityName(c.city, c.state), value: c.count }))}
                />
              </div>
            </div>
          </>
        )}
      </GrowthBlock>
    </AdminSection>
  );
}

const NETWORKS: GrowthNetwork[] = ["instagram", "tiktok", "youtube"];

/** Perfil das contas ativas: redes, gênero, nicho, local e seguidores por rede. */
function ProfileSection() {
  const query = useGrowthProfile();
  return (
    <AdminSection title="Perfil dos criadores" description={generatedAtText(query.data) ?? "Quem são as contas ativas."}>
      <GrowthBlock query={query} skeletonHeight={360}>
        {(p) => {
          const noNiche = p.no_niche > 0 ? [{ key: "no-niche", label: "Sem nicho informado", value: p.no_niche }] : [];
          const noAddress = p.no_address > 0 ? [{ key: "no-address", label: "Sem endereço", value: p.no_address }] : [];
          return (
            <>
              <div className="adm-dash-strip" style={strip(4)}>
                <AdminFigureCard
                  variant="plain"
                  showKind={false}
                  label="Com alguma rede"
                  hint={`${formatPercent(p.with_network_pct)} das contas`}
                  figure={growthFigure(p.with_network.any, "count", "Contas ativas com ao menos uma rede social conectada.")}
                />
                {NETWORKS.map((network) => (
                  <AdminFigureCard
                    key={network}
                    variant="plain"
                    showKind={false}
                    label={`Com ${labelOf(NETWORK_LABEL, network)}`}
                    figure={growthFigure(p.with_network[network], "count", `Contas ativas com ${labelOf(NETWORK_LABEL, network)} conectado.`)}
                  />
                ))}
              </div>

              <div className="adm-gr-grid-2" style={{ marginTop: 20 }}>
                <div className="adm-gr-block">
                  <h3 className="adm-gr-sub">Gênero</h3>
                  <BarList
                    label="Criadores por gênero"
                    total={p.accounts}
                    rows={p.gender.map((g) => ({ key: g.key, label: labelOf(GENDER_LABEL, g.key), value: g.count }))}
                  />
                </div>
                <div className="adm-gr-block">
                  <h3 className="adm-gr-sub">Nicho (top 20)</h3>
                  <BarList
                    label="Criadores por nicho"
                    total={p.accounts}
                    rows={[...p.niches.map((n) => ({ key: String(n.id), label: nicheName(n.name, n.parent_id), value: n.count })), ...noNiche]}
                  />
                </div>
                <div className="adm-gr-block">
                  <h3 className="adm-gr-sub">Estado (top 20)</h3>
                  <BarList
                    label="Criadores por estado"
                    total={p.accounts}
                    rows={[...p.states.map((s) => ({ key: s.uf, label: s.uf, value: s.count })), ...noAddress]}
                  />
                </div>
                <div className="adm-gr-block">
                  <h3 className="adm-gr-sub">Cidade (top 20)</h3>
                  <BarList
                    label="Criadores por cidade"
                    total={p.accounts}
                    rows={p.cities_top.map((c) => ({ key: `${c.city}/${c.uf}`, label: cityName(c.city, c.uf), value: c.count }))}
                  />
                </div>
              </div>

              <div className="adm-gr-block" style={{ marginTop: 20 }}>
                <h3 className="adm-gr-sub">Seguidores por rede</h3>
                <div className="adm-gr-grid-3">
                  {NETWORKS.map((network) => (
                    <div key={network} className="adm-gr-block">
                      <h4 className="adm-gr-sub">{labelOf(NETWORK_LABEL, network)}</h4>
                      <BarList
                        label={`Criadores por faixa de seguidores no ${labelOf(NETWORK_LABEL, network)}`}
                        rows={(p.followers[network] ?? []).map((b) => ({ key: b.band, label: labelOf(FOLLOWER_BAND_LABEL, b.band), value: b.count }))}
                      />
                    </div>
                  ))}
                </div>
                <ChartNote>Cada criador conta uma vez por rede, pela faixa do maior perfil dele nessa rede.</ChartNote>
              </div>
            </>
          );
        }}
      </GrowthBlock>
    </AdminSection>
  );
}

/** Aba "Criadores" do dashboard. */
export function CreatorsTab() {
  return (
    <>
      <EngagementSection />
      <NeverAppliedSection />
      <ProfileSection />
    </>
  );
}
