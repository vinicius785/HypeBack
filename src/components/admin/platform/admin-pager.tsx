import { I } from "@/components/prototype/ui";
import { formatInt } from "@/lib/admin/format";
import { ADMIN_PER_PAGE_OPTIONS } from "@/lib/admin/list-query";
import { buildPageList, clampPage, pageRange, totalPagesFor } from "@/lib/admin/pagination";

import "@/styles/admin-platform.css";

interface AdminPagerProps {
  /** Página atual (1-based), do `meta.page` ou da URL. */
  page: number;
  perPage: number;
  /** `meta.total`: quantos registros existem com os filtros atuais. */
  total: number;
  onPageChange: (page: number) => void;
  /** Sem ele o seletor "por página" não aparece. */
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: readonly number[];
  /** Enquanto uma página carrega: os botões não aceitam clique repetido. */
  disabled?: boolean;
}

/**
 * Paginação numerada: "X–Y de Z", seletor de itens por página e botões 1 … 4 5 6 … 20. Funciona sobre o
 * `AdminPageMeta` do contrato (`page`, `per_page`, `total`). Lista vazia não mostra nada. No celular só
 * ficam "anterior", "próxima" e "Página X de Y".
 */
export function AdminPager({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = ADMIN_PER_PAGE_OPTIONS,
  disabled,
}: AdminPagerProps) {
  if (total <= 0) return null;

  const totalPages = totalPagesFor(total, perPage);
  const current = clampPage(page, totalPages);
  const { from, to } = pageRange(current, perPage, total);
  const items = buildPageList(current, totalPages);
  const options = perPageOptions.includes(perPage) ? perPageOptions : [...perPageOptions, perPage].sort((a, b) => a - b);
  // Tudo cabe numa página e não há o que escolher: só o resumo.
  const showSize = !!onPerPageChange && total > options[0];
  const go = (target: number) => {
    const next = clampPage(target, totalPages);
    if (next !== current) onPageChange(next);
  };

  return (
    <nav className="adm-pg" aria-label="Paginação">
      <div className="adm-pg-range">
        <b>
          {formatInt(from)}–{formatInt(to)}
        </b>{" "}
        de {formatInt(total)}
      </div>
      <div className="adm-pg-ctl">
        {showSize ? (
          <label className="adm-pg-size">
            <span className="adm-sr">Itens por página</span>
            <select value={perPage} disabled={disabled} onChange={(event) => onPerPageChange?.(Number(event.target.value))}>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option} por página
                </option>
              ))}
            </select>
            <I n="chev" cls="sm" />
          </label>
        ) : null}
        {totalPages > 1 ? (
          <div className="adm-pg-nav">
            <button
              type="button"
              className="adm-pg-btn"
              aria-label="Página anterior"
              disabled={disabled || current <= 1}
              onClick={() => go(current - 1)}
            >
              <I n="chev" cls="rot" />
            </button>
            {items.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  className="adm-pg-btn adm-pg-num"
                  aria-label={`Página ${item}`}
                  aria-current={item === current ? "page" : undefined}
                  disabled={disabled}
                  onClick={() => go(item)}
                >
                  {formatInt(item)}
                </button>
              ) : (
                <span key={item} className="adm-pg-gap" aria-hidden="true">
                  …
                </span>
              ),
            )}
            <span className="adm-pg-compact">
              Página {formatInt(current)} de {formatInt(totalPages)}
            </span>
            <button
              type="button"
              className="adm-pg-btn"
              aria-label="Próxima página"
              disabled={disabled || current >= totalPages}
              onClick={() => go(current + 1)}
            >
              <I n="chev" />
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
