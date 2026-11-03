import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { useSlidingIndicator } from "@/hooks/admin/use-sliding-indicator";
import { formatInt } from "@/lib/admin/format";

import "@/styles/admin-platform.css";

export interface AdminTabItem<T extends string = string> {
  id: T;
  label: string;
  /** Contagem ao lado do nome (some quando `null`/`undefined`). */
  count?: number | null;
  disabled?: boolean;
}

interface AdminTabsProps<T extends string> {
  tabs: readonly AdminTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Nome da lista de abas para leitor de tela ("Seções do workspace"). */
  ariaLabel: string;
  /** Liga cada aba ao seu painel (`aria-controls`): use o mesmo prefixo em `AdminTabPanel`. */
  idPrefix: string;
}

/** Ids da aba e do painel: a mesma regra nos dois componentes. */
export function adminTabIds(idPrefix: string, id: string): { tabId: string; panelId: string } {
  return { tabId: `${idPrefix}-tab-${id}`, panelId: `${idPrefix}-panel-${id}` };
}

/**
 * Abas com sublinhado (o "pé" do cabeçalho do detalhe da campanha). Padrão WAI-ARIA de abas: setas, Home e
 * End mudam de aba (e movem o foco), só a aba ativa entra na ordem de tabulação.
 *
 * O estado fica com quem usa (`value`/`onChange`); para guardá-lo na URL use `useAdminSearchParam`.
 */
export function AdminTabs<T extends string>({ tabs, value, onChange, ariaLabel, idPrefix }: AdminTabsProps<T>) {
  const { containerRef, indicatorRef } = useSlidingIndicator<HTMLDivElement>(
    value,
    tabs.map((t) => `${t.id}:${t.count ?? ""}`).join("|"),
    "[aria-selected='true']",
  );
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const move = (from: number, step: 1 | -1 | "first" | "last") => {
    const enabled = tabs.map((t, index) => ({ t, index })).filter(({ t }) => !t.disabled);
    if (enabled.length === 0) return;
    let target = enabled[0];
    if (step === "last") target = enabled[enabled.length - 1];
    else if (step !== "first") {
      const position = enabled.findIndex(({ index }) => index === from);
      target = enabled[(position + step + enabled.length) % enabled.length];
    }
    onChange(target.t.id);
    tabRefs.current.get(target.t.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") move(index, 1);
    else if (event.key === "ArrowLeft") move(index, -1);
    else if (event.key === "Home") move(index, "first");
    else if (event.key === "End") move(index, "last");
    else return;
    event.preventDefault();
  };

  return (
    <div className="adm-tabs" role="tablist" aria-label={ariaLabel} ref={containerRef}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        const { tabId, panelId } = adminTabIds(idPrefix, tab.id);
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            id={tabId}
            type="button"
            role="tab"
            className="adm-tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
            {tab.count !== null && tab.count !== undefined ? <em>{formatInt(tab.count)}</em> : null}
          </button>
        );
      })}
      <i className="adm-tabs-ind" ref={indicatorRef} aria-hidden="true" />
    </div>
  );
}

interface AdminTabPanelProps {
  idPrefix: string;
  id: string;
  active: boolean;
  children: ReactNode;
  /** Classe do painel (espaçamento, grade): sem ela o painel não ganha classe nenhuma. */
  className?: string;
  /** Elemento do painel (padrão `div`). O papel `tabpanel`, o id e o `aria-labelledby` não mudam. */
  as?: "div" | "section";
}

/** Painel de uma aba: só monta quando está ativa. Aponta de volta para a aba (`aria-labelledby`). */
export function AdminTabPanel({ idPrefix, id, active, children, className, as: Tag = "div" }: AdminTabPanelProps) {
  if (!active) return null;
  const { tabId, panelId } = adminTabIds(idPrefix, id);
  return (
    <Tag role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0} className={className}>
      {children}
    </Tag>
  );
}
