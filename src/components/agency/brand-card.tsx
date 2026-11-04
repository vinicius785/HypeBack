import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Av, I } from "@/components/prototype/ui";
import type { AgencyBrand } from "@/shared/services/agency-brands";

const campaignsLabel = (n: number) =>
  n === 0 ? "Nenhuma campanha" : n === 1 ? "1 campanha" : `${n} campanhas`;

/** `03 nov` (com o ano só quando não é o ano corrente) e a data completa para o título. */
function createdLabel(iso: string): { short: string; full: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const short = d
    .toLocaleDateString(
      "pt-BR",
      sameYear
        ? { day: "2-digit", month: "short" }
        : { day: "2-digit", month: "short", year: "numeric" },
    )
    .replace(/\./g, "")
    .replace(/ de /g, " ");
  return {
    short,
    full: d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
  };
}

interface BrandCardProps {
  brand: AgencyBrand;
  canWrite: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

/**
 * Cartão de marca no desenho do cartão de Clientes: logo, nome com selo de estado, descrição curta, menu de ações no
 * canto, divisor e uma linha de fatos (campanhas, criação). O cartão inteiro leva às campanhas da marca por um link
 * sobreposto (sem botão dentro de botão); o menu fica por cima dele.
 */
export function BrandCard({
  brand,
  canWrite,
  busy,
  onEdit,
  onToggle,
}: BrandCardProps) {
  const archived = brand.status === "archived";
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const created = createdLabel(brand.created_at);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const act = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <article className="bcd" data-archived={archived}>
      <Link
        to="/campaigns"
        search={{ brand: brand.id }}
        className="bcd-open"
        aria-label={`Ver campanhas de ${brand.name}`}
      />
      <div className="bcd-top">
        <Av name={brand.name} src={brand.photo ?? undefined} size={48} />
        <div className="bcd-id">
          <div className="bcd-nm">
            <b title={brand.name}>{brand.name}</b>
            <span className={`bcd-st ${archived ? "archived" : "active"}`}>
              {archived ? "Arquivada" : "Ativa"}
            </span>
          </div>
          <small title={brand.description ?? undefined}>
            {brand.description?.trim() || "Sem descrição"}
          </small>
        </div>
        <div className={`cfw bcd-menu${menuOpen ? " open" : ""}`} ref={ref}>
          <button
            type="button"
            className="bcd-dots"
            aria-label={`Mais ações para ${brand.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <I n="more" />
          </button>
          {menuOpen ? (
            <div className="cfm right" role="menu">
              <Link
                to="/campaigns"
                search={{ brand: brand.id }}
                role="menuitem"
                className="bcd-mi"
                onClick={() => setMenuOpen(false)}
              >
                Ver campanhas
                <I n="chev" cls="sm" />
              </Link>
              {canWrite ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={act(onEdit)}
                    disabled={busy}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="bcd-dng"
                    onClick={act(onToggle)}
                    disabled={busy}
                  >
                    {archived ? "Reativar" : "Arquivar"}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="bcd-meta">
        <span>
          <I n="mega" cls="sm" />
          {campaignsLabel(brand.campaigns_count)}
        </span>
        {created ? (
          <span title={`Cadastrada em ${created.full}`}>
            <I n="cal" cls="sm" />
            {created.short}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Esqueleto com a mesma estrutura do cartão. */
export function BrandCardSkeleton() {
  return (
    <div className="bcd" aria-hidden="true">
      <div className="bcd-top">
        <span className="bcd-sk round" />
        <div className="bcd-id">
          <span className="bcd-sk" style={{ width: "62%", height: 16 }} />
          <span
            className="bcd-sk"
            style={{ width: "40%", height: 12, marginTop: 8 }}
          />
        </div>
      </div>
      <div className="bcd-meta">
        <span className="bcd-sk" style={{ width: 96, height: 12 }} />
        <span className="bcd-sk" style={{ width: 84, height: 12 }} />
      </div>
    </div>
  );
}
