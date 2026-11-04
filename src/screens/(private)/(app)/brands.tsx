import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { BrandFormDialog, brandErrorMessage } from "@/components/agency/brand-form-dialog";
import { I } from "@/components/prototype/ui";
import { useWorkspacePermissions } from "@/contexts/workspace-context";
import { useAgencyBrands, useIsAgencyWorkspace, useSetAgencyBrandStatus } from "@/hooks/use-agency-brands";
import type { AgencyBrand } from "@/shared/services/agency-brands";

import "@/styles/agency-brands.css";

export const Route = createFileRoute("/(private)/(app)/brands")({
  component: BrandsPage,
});

type Tab = "active" | "archived";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const campaignsLabel = (n: number) => (n === 1 ? "1 campanha" : `${n} campanhas`);

function BrandCard({
  brand,
  canWrite,
  busy,
  onEdit,
  onToggle,
}: {
  brand: AgencyBrand;
  canWrite: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const archived = brand.status === "archived";
  return (
    <article className="agb-card" data-archived={archived}>
      <div className="agb-top">
        <span className="agb-av" aria-hidden="true">
          {initials(brand.name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <b title={brand.name}>{brand.name}</b>
          <small>{campaignsLabel(brand.campaigns_count)}</small>
        </div>
        {archived ? <span className="agb-chip">Arquivada</span> : null}
      </div>
      <p className="agb-desc">{brand.description || "Sem descrição."}</p>
      <div className="agb-row">
        <Link to="/campaigns" search={{ brand: brand.id }} className="btn out">
          Ver campanhas
        </Link>
        {canWrite ? (
          <>
            <button type="button" className="btn out" onClick={onEdit} disabled={busy}>
              Editar
            </button>
            <button type="button" className="btn ghost" onClick={onToggle} disabled={busy}>
              {archived ? "Reativar" : "Arquivar"}
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function BrandsPage() {
  const isAgency = useIsAgencyWorkspace();
  const permissions = useWorkspacePermissions();
  const canWrite = permissions.workspace_settings_write;
  const { data: brands = [], isLoading, error } = useAgencyBrands();
  const setStatus = useSetAgencyBrandStatus();
  const [tab, setTab] = useState<Tab>("active");
  const [editing, setEditing] = useState<AgencyBrand | "new" | null>(null);

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

  const shown = brands.filter((b) => b.status === tab);
  const archivedCount = brands.filter((b) => b.status === "archived").length;

  const toggle = (brand: AgencyBrand) => {
    const next = brand.status === "active" ? "archived" : "active";
    setStatus.mutate(
      { brandId: brand.id, status: next },
      {
        onSuccess: () => toast.success(next === "archived" ? "Marca arquivada" : "Marca reativada"),
        onError: (e) => toast.error(brandErrorMessage(e, "Não foi possível alterar a marca.")),
      },
    );
  };

  return wrap(
    <>
      <div className="head fade">
        <div>
          <h1>Marcas</h1>
          <p>As marcas que a agência atende. Cada campanha pertence a uma marca.</p>
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

      <div className="tools fade agb-tabs">
        <div className="seg" role="tablist" aria-label="Estado das marcas">
          {(["active", "archived"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "active" ? "Ativas" : `Arquivadas${archivedCount ? ` (${archivedCount})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="ov-empty big">
          <small>Carregando…</small>
        </div>
      ) : error ? (
        <div className="ov-empty big">
          <span>
            <I n="x" />
          </span>
          <b>Erro ao carregar as marcas</b>
          <small>{error instanceof Error ? error.message : "Tente novamente."}</small>
        </div>
      ) : shown.length === 0 ? (
        <div className="ov-empty big">
          <span>
            <I n="box" />
          </span>
          <b>{tab === "active" ? "Nenhuma marca ainda" : "Nenhuma marca arquivada"}</b>
          <small>
            {tab === "active"
              ? "Crie a primeira marca para começar a organizar as campanhas da agência."
              : "Marcas arquivadas ficam aqui, com as campanhas que já tiveram."}
          </small>
          {tab === "active" && canWrite ? (
            <button type="button" className="btn" onClick={() => setEditing("new")}>
              <I n="plus" cls="sm" />
              Nova marca
            </button>
          ) : null}
        </div>
      ) : (
        <div className="agb-grid fade">
          {shown.map((b) => (
            <BrandCard
              key={b.id}
              brand={b}
              canWrite={canWrite}
              busy={setStatus.isPending}
              onEdit={() => setEditing(b)}
              onToggle={() => toggle(b)}
            />
          ))}
        </div>
      )}

      {editing ? (
        <BrandFormDialog brand={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      ) : null}
    </>,
  );
}
