import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  AdminErrorState,
  AdminFilterBar,
  AdminIsland,
  AdminPage,
  AdminPageHeader,
  AdminSearchInput,
  type AdminFilterDef,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { formatInt } from "@/lib/admin/format";
import { useAdminSearchParam } from "@/hooks/admin/use-admin-search-param";
import {
  useCanUseSecurity,
  useSecuritySummary,
} from "@/hooks/admin/use-admin-security";
import type { SecurityAlertStatus, SecurityWatchIp } from "@/shared/admin-platform.types";

import { useShield, useShieldHeld } from "@/hooks/admin/use-admin-shield";
import { Sentinel } from "./sentinel";
import {
  ActivateDialog,
  DeactivateDialog,
  SecurityShieldTab,
} from "./shield/shield-card";
import { formatShieldEnd, shieldRemaining } from "./shield/shield-format";
import { SlideToConfirm } from "./shield/slide-to-confirm";
import { ShieldHeldSection } from "./shield/shield-held";
import { SecurityAlertsTab } from "./security-alerts-tab";
import {
  ALERT_FILTERS,
  DEFAULT_WATCH_FILTER,
  KIND_FILTERS,
  SECURITY_EMAIL_NOTE,
  SECURITY_PRIVACY_NOTE,
  SECURITY_STATUSES,
  SECURITY_TABS,
  SEVERITY_FILTERS,
  WATCH_FILTERS,
  type KindFilter,
  type SeverityFilter,
  type SecurityTab,
  type WatchFilter,
} from "./security-labels";
import { SecurityWatchlistTab } from "./security-watchlist-tab";
import { SecurityWatchIpsTab, WatchIpDialog } from "./security-watch-ips";

import "@/styles/admin-security.css";

/** Filtros da aba Alertas: o que mostrar (novos ou todos) e o tipo. */
const ALERT_FILTER_DEFS: readonly AdminFilterDef[] = [
  {
    kind: "select",
    key: "status",
    label: "Mostrar",
    defaultValue: "unseen",
    options: ALERT_FILTERS.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  },
  {
    kind: "select",
    key: "severity",
    label: "Gravidade",
    defaultValue: "all",
    options: SEVERITY_FILTERS.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  },
  {
    kind: "select",
    key: "kind",
    label: "Tipo",
    defaultValue: "all",
    options: KIND_FILTERS.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  },
];

/** Filtro da aba Vigiados: o estado da vigilância. */
const WATCH_FILTER_DEFS: readonly AdminFilterDef[] = [
  {
    kind: "select",
    key: "state",
    label: "Estado",
    defaultValue: DEFAULT_WATCH_FILTER,
    options: WATCH_FILTERS.map((option) => ({
      value: option.id,
      label: option.label,
    })),
  },
];

const TAB_LABEL: Record<SecurityTab, string> = {
  alerts: "Alertas",
  watchlist: "Vigiados",
  ips: "IPs vigiados",
  shield: "Escudo",
};

/**
 * Segurança (sentinela): alertas de contas vigiadas e a lista de vigiados. Exclusivo do administrador da plataforma;
 * quem tem papel de equipe vê "Sem permissão" (a API também recusa com 403). A aba e o filtro ficam na URL
 * (`?tab=watchlist`, `?status=all`), que é o que o sino usa para chegar aqui.
 */
export function SecurityPage() {
  const canUse = useCanUseSecurity();
  const [tab, setTab] = useAdminSearchParam<SecurityTab>(
    "tab",
    "alerts",
    SECURITY_TABS,
  );
  const [status, setStatus] = useAdminSearchParam<SecurityAlertStatus>(
    "status",
    "unseen",
    SECURITY_STATUSES,
  );
  const summary = useSecuritySummary();
  const shield = useShield();
  const held = useShieldHeld();
  const shieldOn = shield.data?.active === true;
  const heldCount = (held.data?.accounts ?? 0) + (held.data?.withdrawals ?? 0);
  const [watchFilter, setWatchFilter] =
    useState<WatchFilter>(DEFAULT_WATCH_FILTER);
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  // IPs vigiados: o formulário abre pela ilha ("Vigiar IP") ou pelo link "Vigiar este IP" de um alerta (já com o IP).
  const [ipFilter, setIpFilter] = useState<WatchFilter>(DEFAULT_WATCH_FILTER);
  const [ipDialog, setIpDialog] = useState<{ ip?: string } | null>(null);
  const [ipReactivating, setIpReactivating] = useState<SecurityWatchIp | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  // Operação Escudo: o botão de ativar ou encerrar fica ao lado da personagem, na ilha.
  const [shieldDialog, setShieldDialog] = useState<
    "activate" | "deactivate" | null
  >(null);

  // A pílula branca desliza até a aba escolhida (mede a aba pressionada); a primeira posição não anima.
  const segsRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [pillReady, setPillReady] = useState(false);
  const unseenNow = summary.data?.unseen ?? 0;
  useLayoutEffect(() => {
    const on = segsRef.current?.querySelector<HTMLElement>(
      '[aria-pressed="true"]',
    );
    if (on) setPill({ x: on.offsetLeft, w: on.offsetWidth });
  }, [tab, unseenNow]);
  useEffect(() => {
    if (!pill) return;
    const frame = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(frame);
  }, [pill]);

  // Para onde o conteúdo desliza ao trocar de aba: quem vem depois entra pela direita, quem vem antes pela esquerda.
  const previousTab = useRef(tab);
  const direction =
    SECURITY_TABS.indexOf(tab) >= SECURITY_TABS.indexOf(previousTab.current)
      ? "next"
      : "prev";
  useEffect(() => {
    previousTab.current = tab;
  }, [tab]);

  if (!canUse) {
    return (
      <AdminPage>
        <AdminPageHeader title="Segurança" />
        <AdminErrorState
          boxed
          title="Sem permissão"
          message="Esta área é exclusiva dos administradores da plataforma."
        />
      </AdminPage>
    );
  }

  const unseen = summary.data?.unseen ?? 0;
  const onShieldTab = tab === "shield";
  const configured = shield.data?.configured !== false;
  // Com o Escudo ligado, o título é sempre o dele (em qualquer aba): "Tudo tranquilo" não cabe enquanto o protocolo está de pé.
  const shieldUntil = `Até ${formatShieldEnd(shield.data?.expires_at)} · falta ${shieldRemaining(shield.data?.expires_at)}`;
  const headline = shieldOn
    ? "Operação Escudo"
    : onShieldTab
      ? "Operação Escudo"
      : unseen === 0
        ? "Tudo tranquilo"
        : unseen === 1
          ? "1 alerta novo"
          : `${formatInt(unseen)} alertas novos`;
  const subline = shieldOn
    ? !onShieldTab && unseen > 0
      ? `${unseen === 1 ? "1 alerta novo" : `${formatInt(unseen)} alertas novos`} · ${shieldUntil}.`
      : `${shieldUntil}.`
    : onShieldTab
      ? !configured
        ? "Configuração pendente no servidor."
        : "Segurança reforçada por tempo limitado. Ativa e encerra com o código do Authenticator."
      : unseen === 0
        ? "Nenhuma conta vigiada abriu sessão sem você ver."
        : "Contas vigiadas abriram sessão. Confira e marque como visto.";

  return (
    <AdminPage>
      <AdminPageHeader
        title="Segurança"
        subtitle="A sentinela avisa quando uma conta vigiada abre sessão. Ela só avisa: não bloqueia nem suspende ninguém."
      />
      {/* A "ilha" (padrão Dynamic Island do Admin), alta para abrigar a sentinela: à esquerda o estado da vigilância em uma frase e as
          duas abas; embaixo, as ferramentas da aba (filtros, busca, "Vigiar e-mail", "Marcar todos como vistos"); à direita a sentinela, encostada na base e no canto. Com alertas novos a ilha inteira esquenta (vermelho). */}
      <AdminIsland
        ariaLabel="Segurança"
        className={`adm-sec-isl${unseen > 0 || shieldOn ? " adm-sec-isl-alert" : ""}${shieldOn ? " adm-sec-isl-shielded" : ""}`}
        start={
          <div className="adm-sec-isl-main">
            <div className="isl-t adm-sec-isl-t">
              <h2
                data-alert={
                  shieldOn || (!onShieldTab && unseen > 0) ? "true" : undefined
                }
              >
                <i aria-hidden="true" />
                <span key={headline} className="adm-sec-swap">
                  {headline}
                </span>
              </h2>
              <p key={subline} className="adm-sec-swap">
                {subline}
              </p>

            </div>
            <div
              className="isl-segs adm-sec-segs"
              ref={segsRef}
              role="group"
              aria-label="Seções de Segurança"
            >
              <span
                className="adm-sec-pill"
                data-ready={pillReady ? "true" : undefined}
                style={
                  pill
                    ? { width: pill.w, transform: `translateX(${pill.x}px)` }
                    : { opacity: 0 }
                }
                aria-hidden="true"
              />
              {SECURITY_TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="isl-seg"
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  <i aria-hidden="true" />
                  {TAB_LABEL[id]}
                  {id === "alerts" && unseen > 0 ? (
                    <small key={unseen}>{unseen > 99 ? "99+" : unseen}</small>
                  ) : null}
                  {id === "shield" && shieldOn ? (
                    <small data-shield="on">ligado</small>
                  ) : null}
                  {id === "shield" && !shieldOn && heldCount > 0 ? (
                    <small title="Retidos pelo Escudo">
                      {heldCount > 99 ? "99+" : heldCount}
                    </small>
                  ) : null}
                </button>
              ))}
            </div>
            <span className="adm-sr" role="status" aria-live="polite">
              {unseen === 0
                ? "Nenhum alerta novo"
                : `${unseen} ${unseen === 1 ? "alerta novo" : "alertas novos"}`}
            </span>
          </div>
        }
        end={
          onShieldTab && configured ? (
            <div className="adm-sec-shield-cta">
              <SlideToConfirm
                key={shieldOn ? "end" : "start"}
                label={shieldOn ? "Encerrar Escudo" : "Ativar Operação Escudo"}
                hint={
                  shieldOn ? "Deslize para encerrar" : "Deslize para ativar"
                }
                disabled={shield.isLoading}
                onConfirm={() =>
                  setShieldDialog(shieldOn ? "deactivate" : "activate")
                }
              />
              <Sentinel alert={false} shield={shieldOn} />
            </div>
          ) : (
            <Sentinel alert={unseen > 0} shield={shieldOn} />
          )
        }

        tools={
          tab === "shield" ? undefined : (
            <div className="adm-sec-tools" key={tab}>
              {tab === "alerts" ? (
                // Um botão de filtro só (com o número de filtros ativos e os chips): o painel traz "Mostrar" e "Tipo".
                <AdminFilterBar
                  compact
                  filters={ALERT_FILTER_DEFS}
                  values={{ status, kind: kindFilter, severity: severityFilter }}
                  onChange={(patch) => {
                    if (typeof patch.status === "string" && (SECURITY_STATUSES as readonly string[]).includes(patch.status))
                      setStatus(patch.status as SecurityAlertStatus);
                    if (patch.kind !== undefined)
                      setKindFilter(patch.kind as KindFilter);
                    if (patch.severity !== undefined)
                      setSeverityFilter(patch.severity as SeverityFilter);
                  }}
                  onClear={() => {
                    setStatus("unseen");
                    setKindFilter("all");
                    setSeverityFilter("all");
                  }}
                  trailing={
                    <button
                      type="button"
                      className="adm-sec-tool"
                      disabled={unseen === 0}
                      onClick={() => setConfirmAll(true)}
                    >
                      <I n="checks" cls="sm" />
                      Marcar todos como vistos
                    </button>
                  }
                />
              ) : tab === "ips" ? (
                <AdminFilterBar
                  compact
                  filters={WATCH_FILTER_DEFS}
                  values={{ state: ipFilter }}
                  onChange={(patch) => {
                    if (patch.state !== undefined) setIpFilter(patch.state as WatchFilter);
                  }}
                  onClear={() => setIpFilter(DEFAULT_WATCH_FILTER)}
                  trailing={
                    <button type="button" className="adm-sec-tool" data-primary="true" onClick={() => setIpDialog({})}>
                      <I n="plus" cls="sm" />
                      Vigiar IP
                    </button>
                  }
                />
              ) : (
                <AdminFilterBar
                  compact
                  search={
                    <AdminSearchInput
                      value={term}
                      onSearch={setTerm}
                      label="Buscar vigiados"
                      placeholder="Buscar por e-mail, nome ou motivo"
                    />
                  }
                  searchLabel="Buscar vigiados"
                  filters={WATCH_FILTER_DEFS}
                  values={{ state: watchFilter }}
                  onChange={(patch) => {
                    if (patch.state !== undefined)
                      setWatchFilter(patch.state as WatchFilter);
                  }}
                  onClear={() => setWatchFilter(DEFAULT_WATCH_FILTER)}
                  trailing={
                    <button
                      type="button"
                      className="adm-sec-tool"
                      data-primary="true"
                      onClick={() => setAdding(true)}
                    >
                      <I n="plus" cls="sm" />
                      Vigiar e-mail
                    </button>
                  }
                />
              )}
            </div>
          )
        }
      />
      <div key={tab} className="adm-sec-panel" data-dir={direction}>
        {tab === "alerts" ? (
          <SecurityAlertsTab
            status={status}
            kind={kindFilter}
            onWatchIp={(ip) => setIpDialog({ ip })}
            severity={severityFilter}
            onFocusUrgent={() => {
              setStatus("open");
              setSeverityFilter("high");
            }}
            confirmAll={confirmAll}
            onConfirmAllChange={setConfirmAll}
          />
        ) : tab === "ips" ? (
          <SecurityWatchIpsTab filter={ipFilter} onShowAll={() => setIpFilter("all")} reactivating={ipReactivating} onReactivatingChange={setIpReactivating} />
        ) : tab === "shield" ? (
          <SecurityShieldTab>
            <ShieldHeldSection />
          </SecurityShieldTab>
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
      {ipDialog ? <WatchIpDialog initialIp={ipDialog.ip} onClose={() => setIpDialog(null)} /> : null}
      {shieldDialog === "activate" ? (
        <ActivateDialog onClose={() => setShieldDialog(null)} />
      ) : null}
      {shieldDialog === "deactivate" ? (
        <DeactivateDialog onClose={() => setShieldDialog(null)} />
      ) : null}
      <p className="adm-sec-privacy">{SECURITY_PRIVACY_NOTE}</p>
      <p className="adm-sec-privacy">{SECURITY_EMAIL_NOTE}</p>
    </AdminPage>
  );
}
