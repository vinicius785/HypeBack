import { AdminActionMenu } from "./admin-action-menu";

export interface AdminSortOption {
  sortBy: string;
  order: "asc" | "desc";
  /** Título do grupo no menu ("Cadastro"). */
  group: string;
  /** Texto curto, sob o grupo ("Mais recentes"). */
  shortLabel: string;
  /** Nome completo, para leitor de tela. */
  label: string;
}

interface AdminSortMenuProps {
  options: readonly AdminSortOption[];
  sortBy: string | undefined;
  order: "asc" | "desc";
  /** A ordenação padrão da lista: tocar na opção já escolhida a desmarca e volta para ela. */
  defaultSortBy: string;
  defaultOrder: "asc" | "desc";
  onSort: (sortBy: string, order: "asc" | "desc") => void;
}

/** O botão redondo "Ordenar" das listas do Admin (ao lado da busca e dos filtros). */
export function AdminSortMenu({ options, sortBy, order, defaultSortBy, defaultOrder, onSort }: AdminSortMenuProps) {
  return (
    <AdminActionMenu
      iconOnly
      round
      triggerIcon="sort"
      ariaLabel="Ordenar"
      items={options.map((option) => {
        const chosen = sortBy === option.sortBy && order === option.order;
        return {
          id: `${option.sortBy}:${option.order}`,
          label: option.label,
          selected: chosen,
          group: option.group,
          shortLabel: option.shortLabel,
          onSelect: () => (chosen ? onSort(defaultSortBy, defaultOrder) : onSort(option.sortBy, option.order)),
        };
      })}
    />
  );
}
