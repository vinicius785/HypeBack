import { useMemo, useState } from "react";

import { AdminEntityPicker, adminEntityPickerSummary, type AdminEntityPickerSearchResult } from "@/components/admin/platform";
import { useAdminItem, useAdminList } from "@/hooks/admin/use-admin-queries";
import { adminPath } from "@/lib/admin/admin-client";
import { isEndpointUnavailable } from "@/lib/admin/admin-errors";
import { WORKSPACE_STATUS_LABEL } from "@/lib/admin/labels";
import type {
  AdminWorkspaceDetail,
  AdminWorkspaceKind,
  AdminWorkspaceListItem,
  AdminWorkspaceOwner,
  AdminWorkspaceRef,
  AdminWorkspaceStatus,
} from "@/shared/admin-platform.types";

import "@/styles/admin-platform.css";

export interface AdminWorkspacePickerProps {
  /** `public_id` do workspace escolhido (o da URL ou do filtro). Vazio ou ausente: nenhum. */
  value?: string | null;
  /** Escolha de um workspace, ou `null` quando a pessoa limpa o campo. Quem usa guarda só o `id`. */
  onChange: (workspace: AdminWorkspaceRef | null) => void;
  /** Que workspaces entram na busca (`kind` de `GET /admin/workspaces`). Padrão: `brand` (os clientes). */
  kind?: AdminWorkspaceKind | "all";
  /** Nome do campo: aparece na pílula ("Workspace: Todos") e é o nome acessível do seletor. */
  label?: string;
  /** Texto da pílula quando nada está escolhido (padrão "Todos"). */
  placeholder?: string;
  disabled?: boolean;
  /** Mostra o × que limpa a escolha e a opção "Todos" da lista (padrão: sim). */
  clearable?: boolean;
  /** Quantos resultados cada busca traz (padrão 10; o resto se alcança digitando mais). */
  limit?: number;
  /** Espera depois da última tecla antes de buscar (padrão 300 ms). */
  debounceMs?: number;
  /**
   * `pill` (padrão): pílula solta, com o ×. `filterBar`: dentro de um filtro `custom` do `AdminFilterBar` (sem ×:
   * o chip e "Limpar filtros" já limpam).
   */
  variant?: "pill" | "filterBar";
}

/**
 * O que a lista do popover mostra de cada workspace. É o mínimo comum entre o item da busca (que traz dono e
 * estado) e a referência resolvida só por id (nome): o `AdminEntityPicker` pede o objeto inteiro como valor.
 */
type WorkspaceOption = AdminWorkspaceRef & { owner?: AdminWorkspaceOwner | null; status?: AdminWorkspaceStatus };

/** O hook de busca nasce fora do render: o `AdminEntityPicker` o chama como hook e pede sempre a mesma função. */
function createWorkspaceSearch(kind: AdminWorkspaceKind | "all", limit: number) {
  return function useWorkspaceSearch(search: string): AdminEntityPickerSearchResult<WorkspaceOption> {
    const list = useAdminList<AdminWorkspaceListItem>({
      resource: "workspaces",
      // Escopo próprio: a busca do seletor nunca se mistura com a lista de Workspaces (que tem outros parâmetros).
      scope: ["picker"],
      path: "/admin/workspaces",
      params: { search, kind, per_page: limit, sort_by: "name", order: "asc" },
    });
    return {
      data: list.data?.data,
      isLoading: list.isLoading,
      isError: list.isError,
      isFetching: list.isFetching,
      total: list.data?.meta.total,
      error: list.error,
      // A rota que o servidor ainda não tem aparece em instantes, com o deploy: o texto diz exatamente isso.
      errorMessage: isEndpointUnavailable(list.error) ? "A busca de workspaces ainda não está disponível no servidor." : undefined,
      retry: () => void list.refetch(),
    };
  };
}

/**
 * O workspace de um `id` (o da URL) como objeto, mais o texto do chip do filtro ("Workspace: Café Serra Verde").
 * Com o nome já conhecido (`known`: o que a pessoa acabou de escolher) não consulta nada; senão busca o detalhe, uma
 * vez, e guarda por um tempo. Enquanto carrega o nome é "Carregando…"; se o workspace não existe mais, o começo do id.
 * Sem `id`: `workspace` e `summary` são `null` (sem chip).
 *
 * É a mesma consulta que o `AdminWorkspacePicker` faz: quem usa o seletor num filtro `custom` do `AdminFilterBar` chama
 * este hook para o `summary` do filtro sem gastar outra requisição.
 */
export function useAdminWorkspaceSelection(
  id: string | null | undefined,
  options: { label?: string; known?: AdminWorkspaceRef | null } = {},
): { workspace: AdminWorkspaceRef | null; summary: string | null } {
  const { label = "Workspace", known } = options;
  const selectedId = id ?? "";
  const knownName = known && known.id === selectedId ? known.name : undefined;
  const lookup = useAdminItem<AdminWorkspaceDetail>({
    resource: "workspaces",
    id: selectedId || undefined,
    path: adminPath`/admin/workspaces/${selectedId}`,
    enabled: !!selectedId && !knownName,
    staleTime: 5 * 60_000,
  });
  const workspace: AdminWorkspaceRef | null = !selectedId
    ? null
    : {
        id: selectedId,
        name: knownName ?? lookup.data?.name ?? (lookup.isError ? `Workspace ${selectedId.slice(0, 8)}…` : "Carregando…"),
      };
  return { workspace, summary: adminEntityPickerSummary(label, workspace, (item) => item.name) };
}

/**
 * Seletor de workspace com busca no servidor: uma pílula "Workspace: Todos" que abre um popover com a busca e a
 * lista (`AdminEntityPicker`). Digitar busca por nome do workspace, nome ou e-mail do dono, id e CNPJ
 * (`GET /admin/workspaces?search=`), com atraso para não consultar a cada tecla. Mostra o workspace escolhido
 * (mesmo quando só se conhece o id, como numa URL recarregada: o nome é buscado) e pode ser limpo.
 *
 * Teclado e acessibilidade são os do `AdminEntityPicker` (↓ ↑ navegam, Enter escolhe, Esc fecha, Tab sai). Estados:
 * carregando, nenhum resultado, "mostrando N de M" e erro com "Tentar de novo" (inclusive a rota que o servidor
 * ainda não tem).
 *
 * É a peça compartilhada dos filtros por workspace das telas do Admin: o estado fica com quem usa (`value`/`onChange`).
 * Dentro do `AdminFilterBar`, use `variant="filterBar"` num filtro `custom` e `useAdminWorkspaceSelection` para o chip.
 */
export function AdminWorkspacePicker({
  value,
  onChange,
  kind = "brand",
  label = "Workspace",
  placeholder = "Todos",
  disabled = false,
  clearable = true,
  limit = 10,
  debounceMs = 300,
  variant = "pill",
}: AdminWorkspacePickerProps) {
  // A última escolha: enquanto quem usa ainda não atualizou o `value` (a URL muda um instante depois), a pílula segue
  // mostrando o nome conhecido em vez de buscar o detalhe de novo e piscar "Carregando…". Fica depois de limpar.
  const [picked, setPicked] = useState<AdminWorkspaceRef | null>(null);
  const { workspace } = useAdminWorkspaceSelection(value, { label, known: picked });
  const search = useMemo(() => createWorkspaceSearch(kind, limit), [kind, limit]);

  return (
    <AdminEntityPicker<WorkspaceOption>
      label={label}
      placeholder={`Buscar ${label.toLowerCase()}`}
      allLabel={placeholder}
      value={workspace}
      onChange={(next) => {
        if (next) {
          const ref: AdminWorkspaceRef = { id: next.id, name: next.name };
          setPicked(ref);
          onChange(ref);
        } else {
          onChange(null);
        }
      }}
      search={search}
      getKey={(item) => item.id}
      getLabel={(item) => item.name}
      renderOption={(item) => {
        const detail = [item.owner?.email, item.status && item.status !== "active" ? WORKSPACE_STATUS_LABEL[item.status] : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <>
            <b>{item.name}</b>
            {detail ? <small>{detail}</small> : null}
          </>
        );
      }}
      clearable={clearable}
      variant={variant}
      disabled={disabled}
      debounceMs={debounceMs}
      emptyTitle="Nenhum workspace encontrado"
    />
  );
}
