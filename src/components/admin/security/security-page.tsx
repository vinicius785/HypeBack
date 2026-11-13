import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AdminErrorState, AdminFilterBar, AdminIsland, AdminPage, AdminPageHeader, AdminSearchInput, type AdminFilterDef } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { formatInt } from "@/lib/admin/format";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";
import { useCanUseSecurity, useSecuritySummary } from "@/hooks/admin/use-admin-security";
import type { SecurityAlertStatus } from "@/shared/admin-platform.types";

import { Sentinel } from "./sentinel";
import { SecurityAlertsTab } from "./security-alerts-tab";
import { ALERT_FILTERS, DEFAULT_WATCH_FILTER, KIND_FILTERS, SECURITY_PRIVACY_NOTE, SECURITY_STATUSES, SECURITY_TABS, WATCH_FILTERS, type KindFilter, type SecurityTab, type WatchFilter } from "./security-labels";
import { SecurityWatchlistTab } from "./security-watchlist-tab";

import "@/styles/admin-security.css";

/** Filtros da aba Alertas: o que mostrar (novos ou todos) e o tipo. */
const ALERT_FILTER_DEFS: readonly AdminFilterDef[] = [
  { kind: "select", key: "status", label: "Mostrar", defaultValue: "unseen", options: ALERT_FILTERS.map((option) => ({ value: option.id, label: option.label })) },
  { kind: "select", key: "kind", label: "Tipo", defaultValue: "all", options: KIND_FILTERS.map((option) => ({ value: option.id, label: option.label })) },
];

/** Filtro da aba Vigiados: o estado da vigilância. */
const WATCH_FILTER_DEFS: readonly AdminFilterDef[] = [
  { kind: "select", key: "state", label: "Estado", defaultValue: DEFAULT_WATCH_FILTER, options: WATCH_FILTERS.map((option) => ({ value: option.id, label: option.label })) },
];

const TAB_LABEL: Record<SecurityTab, string> = { alerts: "Alertas", watchlist: "Vigiados" };

/**
 * Segurança (sentinela): alertas de contas vigiadas e a lista de vigiados. Exclusivo do administrador da plataforma;
 * quem tem papel de equipe vê "Sem permissão" (a API também recusa com 403). A aba e o filtro ficam na URL
 * (`?tab=watchlist`, `?status=all`), que é o que o sino usa para chegar aqui.
 */
export function SecurityPage() {
  const canUse = useCanUseSecurity();
  const [tab, setTab] = useAdminSearchParam<SecurityTab>("tab", "alerts", SECURITY_TABS);
  const [status, setStatus] = useAdminSearchParam<SecurityAlertStatus>("status", "unseen", SECURITY_STATUSES);
  const summary = useSecuritySummary();
  const [watchFilter, setWatchFilter] = useState<WatchFilter>(DEFAULT_WATCH_FILTER);
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  // A pílula branca desliza até a aba escolhida (mede a aba pressionada); a primeira posição não anima.
  const segsRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [pillReady, setPillReady] = useState(false);
  const unseenNow = summary.data?.unseen ?? 0;
  useLayoutEffect(() => {
    const on = segsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (on) setPill({ x: on.offsetLeft, w: on.offsetWidth });
  }, [tab, unseenNow]);
  useEffect(() => {
    if (!pill) return;
    const frame = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(frame);
  }, [pill]);

  // Para onde o conteúdo desliza ao trocar de aba: quem vem depois entra pela direita, quem vem antes pela esquerda.
  const previousTab = useRef(tab);
  const direction = SECURITY_TABS.indexOf(tab) >= SECURITY_TABS.indexOf(previousTab.current) ? "next" : "prev";
  useEffect(() => {
    previousTab.current = tab;
  }, [tab]);

  if (!canUse) {
    return (
      <AdminPage>
        <AdminPageHeader title="Segurança" />
        <AdminErrorState boxed title="Sem permissão" message="Esta área é exclusiva dos administradores da plataforma." />
      </AdminPage>
    );
  }

  const unseen = summary.data?.unseen ?? 0;
  const headline = unseen === 0 ? "Tudo tranquilo" : unseen === 1 ? "1 alerta novo" : `${formatInt(unseen)} alertas novos`;

  return (
    <AdminPage>
      <AdminPageHeader title="Segurança" subtitle="A sentinela avisa quando uma conta vigiada abre sessão. Ela só avisa: não bloqueia nem suspende ninguém." />
      {/* A "ilha" (padrão Dynamic Island do Admin), alta para abrigar a sentinela: à esquerda o estado da vigilância em uma frase e as
          duas abas; embaixo, as ferramentas da aba (filtros, busca, "Vigiar e-mail", "Marcar todos como vistos"); à direita a sentinela, encostada na base e no canto. Com alertas novos a ilha inteira esquenta (vermelho). */}
      <AdminIsland
        ariaLabel="Segurança"
        className={`adm-sec-isl${unseen > 0 ? " adm-sec-isl-alert" : ""}`}
        start={
          <div className="adm-sec-isl-main">
            <div className="isl-t adm-sec-isl-t">
              <h2 data-alert={unseen > 0 ? "true" : undefined}>
                <i aria-hidden="true" />
                <span key={headline} className="adm-sec-swap">
                  {headline}
                </span>
              </h2>
              <p key={unseen === 0 ? "calm" : "alert"} className="adm-sec-swap">
                {unseen === 0 ? "Nenhuma conta vigiada abriu sessão sem você ver." : "Contas vigiadas abriram sessão. Confira e marque como visto."}
              </p>
            </div>
            <div className="isl-segs adm-sec-segs" ref={segsRef} role="group" aria-label="Seções de Segurança">
              <span className="adm-sec-pill" data-ready={pillReady ? "true" : undefined} style={pill ? { width: pill.w, transform: `translateX(${pill.x}px)` } : { opacity: 0 }} aria-hidden="true" />
              {SECURITY_TABS.map((id) => (
                <button key={id} type="button" className="isl-seg" aria-pressed={tab === id} onClick={() => setTab(id)}>
                  <i aria-hidden="true" />
                  {TAB_LABEL[id]}
                  {id === "alerts" && unseen > 0 ? <small key={unseen}>{unseen > 99 ? "99+" : unseen}</small> : null}
                </button>
              ))}
            </div>
            <span className="adm-sr" role="status" aria-live="polite">
              {unseen === 0 ? "Nenhum alerta novo" : `${unseen} ${unseen === 1 ? "alerta novo" : "alertas novos"}`}
            </span>
          </div>
        }
        end={<Sentinel alert={unseen > 0} />}
        tools={
          <div className="adm-sec-tools" key={tab}>
            {tab === "alerts" ? (
              // Um botão de filtro só (com o número de filtros ativos e os chips): o painel traz "Mostrar" e "Tipo".
              <AdminFilterBar
                compact
                filters={ALERT_FILTER_DEFS}
                values={{ status, kind: kindFilter }}
                onChange={(patch) => {
                  if (patch.status === "unseen" || patch.status === "all") setStatus(patch.status);
                  if (patch.kind !== undefined) setKindFilter(patch.kind as KindFilter);
                }}
                onClear={() => {
                  setStatus("unseen");
                  setKindFilter("all");
                }}
                trailing={
                  <button type="button" className="adm-sec-tool" disabled={unseen === 0} onClick={() => setConfirmAll(true)}>
                    <I n="checks" cls="sm" />
                    Marcar todos como vistos
                  </button>
                }
              />
            ) : (
              <AdminFilterBar
                compact
                search={<AdminSearchInput value={term} onSearch={setTerm} label="Buscar vigiados" placeholder="Buscar por e-mail, nome ou motivo" />}
                searchLabel="Buscar vigiados"
                filters={WATCH_FILTER_DEFS}
                values={{ state: watchFilter }}
                onChange={(patch) => {
                  if (patch.state !== undefined) setWatchFilter(patch.state as WatchFilter);
                }}
                onClear={() => setWatchFilter(DEFAULT_WATCH_FILTER)}
                trailing={
                  <button type="button" className="adm-sec-tool" data-primary="true" onClick={() => setAdding(true)}>
                    <I n="plus" cls="sm" />
                    Vigiar e-mail
                  </button>
                }
              />
            )}
          </div>
        }
      />
      <div key={tab} className="adm-sec-panel" data-dir={direction}>
      {tab === "alerts" ? (
        <SecurityAlertsTab status={status} kind={kindFilter} confirmAll={confirmAll} onConfirmAllChange={setConfirmAll} />
      ) : (
        <SecurityWatchlistTab
          filter={watchFilter}
          term={term}
          adding={adding}
          onAddingChange={setAdding}
          onShowAll={() => setWatchFilter("all")}
          onClearFilters={() => {
            setWatchFilter(DEFAULT_WATCH_FILTER);
            setTerm("");
          }}
        />
      )}
      </div>
      <p className="adm-sec-privacy">{SECURITY_PRIVACY_NOTE}</p>
    </AdminPage>
  );
}
