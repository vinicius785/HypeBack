import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { BrandCard, BrandCardSkeleton } from "@/components/agency/brand-card";
import { BrandFormDialog, brandErrorMessage } from "@/components/agency/brand-form-dialog";
import {
  DEFAULT_BRAND_FILTERS,
  brandStats,
  filterBrands,
  hasBrandCriteria,
  sortBrands,
  type BrandFilters,
} from "@/components/agency/brand-list";
import { BrandToolbar } from "@/components/agency/brand-toolbar";
import { I } from "@/components/prototype/ui";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { useAgencyBrands, useIsAgencyWorkspace, useSetAgencyBrandStatus } from "@/hooks/use-agency-brands";
import type { AgencyBrand } from "@/shared/services/agency-brands";

import "@/styles/agency-brands.css";

export const Route = createFileRoute("/(private)/(app)/brands")({
  component: BrandsPage,
});

function BrandsPage() {
  const isAgency = useIsAgencyWorkspace();
  const permissions = useWorkspacePermissions();
  const canWrite = permissions.workspace_settings_write;
  const { data: brands = [], isLoading, error } = useAgencyBrands();
  const setStatus = useSetAgencyBrandStatus();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<BrandFilters>(DEFAULT_BRAND_FILTERS);
  const [editing, setEditing] = useState<AgencyBrand | "new" | null>(null);

  const stats = useMemo(() => brandStats(brands), [brands]);
  const visible = useMemo(() => sortBrands(filterBrands(brands, query, filters), filters.sort), [brands, query, filters]);

  const wrap = (children: React.ReactNode) => (
    <div className="pv">
      <div className="wrap" style={{ maxWidth: "none" }}>
        {children}
      </div>
    </div>
  );

  if (!isAgency) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="lock" />
        </span>
        <b>Marcas são exclusivas de agências</b>
        <small>Este workspace não é de agência. Fale com a equipe Hype para ativar o acesso de agência.</small>
      </div>,
    );
  }

  const toggle = (brand: AgencyBrand) => {
    const next = brand.status === "active" ? "archived" : "active";
    setStatus.mutate(
      { brandId: brand.id, status: next },
      {
        onSuccess: () => toast.success(next === "archived" ? `“${brand.name}” foi arquivada` : `“${brand.name}” foi reativada`),
        onError: (e) => toast.error(brandErrorMessage(e, "Não foi possível alterar a marca.")),
      },
    );
  };

  const hasAny = brands.length > 0;
  const criteria = hasBrandCriteria(query, filters);
  const clearAll = () => {
    setQuery("");
    setFilters((f) => ({ ...DEFAULT_BRAND_FILTERS, sort: f.sort }));
  };

  // Indicadores clicáveis: cada um aplica o filtro que ele conta; tocar de novo volta ao padrão.
  const isOn = (status: BrandFilters["status"], campaigns: BrandFilters["campaigns"]) =>
    filters.status === status && filters.campaigns === campaigns;
  const pick = (status: BrandFilters["status"], campaigns: BrandFilters["campaigns"]) =>
    setFilters((f) => (isOn(status, campaigns) ? { ...DEFAULT_BRAND_FILTERS, sort: f.sort } : { ...f, status, campaigns }));

  const kpis = [
    { key: "active", label: "Ativas", value: stats.active, hint: stats.active === 0 ? "nenhuma em operação" : "em operação", status: "active", campaigns: "all" },
    { key: "archived", label: "Arquivadas", value: stats.archived, hint: "fora de operação", status: "archived", campaigns: "all" },
    { key: "with", label: "Com campanhas", value: stats.withCampaigns, hint: "marcas ativas vinculadas", status: "active", campaigns: "with" },
    { key: "without", label: "Sem campanhas", value: stats.withoutCampaigns, hint: "marcas ativas sem vínculo", status: "active", campaigns: "without" },
  ] as const;

  return wrap(
    <>
      <div className="head fade">
        <div>
          <h1>Marcas</h1>
          <p>Todas as marcas da agência e as campanhas vinculadas em um só lugar.</p>
        </div>
        {canWrite ? (
          <div className="btns">
            <button type="button" className="btn" onClick={() => setEditing("new")}>
              <I n="plus" cls="sm" />
              Nova marca
            </button>
          </div>
        ) : null}
      </div>

      {hasAny ? (
        <div className="fade">
          <div className="card" role="group" aria-label="Resumo de marcas">
            <div className="stats">
              {kpis.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={`stat clk${isOn(k.status, k.campaigns) ? " on" : ""}${k.value === 0 ? " zero" : ""}`}
                  aria-pressed={isOn(k.status, k.campaigns)}
                  onClick={() => pick(k.status, k.campaigns)}
                >
                  <small>{k.label}</small>
                  <b>{k.value}</b>
                  <span className="d">{k.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {hasAny ? <BrandToolbar query={query} onQuery={setQuery} filters={filters} onFilters={setFilters} /> : null}

      {isLoading ? (
        <div className="agb-grid" aria-busy="true" aria-label="Carregando marcas">
          {Array.from({ length: 6 }).map((_, i) => (
            <BrandCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="ov-empty big" role="alert">
          <span>
            <I n="x" />
          </span>
          <b>Erro ao carregar as marcas</b>
          <small>{error instanceof Error ? error.message : "Tente novamente."}</small>
        </div>
      ) : !hasAny ? (
        <div className="ov-empty big">
          <span>
            <I n="box" />
          </span>
          <b>Nenhuma marca cadastrada ainda</b>
          <small>Cadastre a primeira marca para começar a organizar as campanhas da agência.</small>
          {canWrite ? (
            <button type="button" className="btn" onClick={() => setEditing("new")}>
              <I n="plus" cls="sm" />
              Nova marca
            </button>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        <div className="ov-empty big">
          <span>
            <I n={criteria ? "search" : "box"} />
          </span>
          <b>{criteria ? "Nenhuma marca encontrada" : "Nenhuma marca para mostrar"}</b>
          <small>{criteria ? "Ajuste a busca ou os filtros para ver outras marcas." : "Não há marcas neste estado."}</small>
          {criteria ? (
            <button type="button" className="btn out" onClick={clearAll}>
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <div className="agb-grid fade">
          {visible.map((b) => (
            <BrandCard key={b.id} brand={b} canWrite={canWrite} busy={setStatus.isPending} onEdit={() => setEditing(b)} onToggle={() => toggle(b)} />
          ))}
        </div>
      )}

      {editing ? (
        <BrandFormDialog brand={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>,
  );
}
