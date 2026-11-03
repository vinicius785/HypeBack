import { useMemo, useState } from "react";

import { AdminEntityPicker, adminEntityPickerSummary, type AdminEntityPickerSearchResult } from "@/components/admin/platform";
import { useAdminItem, useAdminList } from "@/hooks/admin/use-admin-queries";
import { adminPath } from "@/lib/admin/admin-client";
import { isEndpointUnavailable } from "@/lib/admin/admin-errors";
import { USER_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminUserDetail, AdminUserListItem } from "@/shared/admin-platform.types";

interface AuditActorPickerProps {
  /** Id do usuário escolhido, como texto (o da URL). Vazio: ninguém. */
  value: string;
  /**
   * Escolha de alguém (`id` como texto) ou `''` quando a pessoa limpa o campo. Com alguém escolhido, o segundo argumento
   * é a pessoa (com o nome): quem mostra o nome fora do seletor (o chip do filtro) o repassa a `useAuditActorSelection`
   * em `known` e não precisa buscar o detalhe nem piscar "Carregando…" até a URL atualizar.
   */
  onChange: (userId: string, actor?: AuditActorOption) => void;
  label?: string;
  placeholder?: string;
  /** Quantos resultados cada busca traz. */
  limit?: number;
  debounceMs?: number;
  /** `filterBar`: dentro de um filtro `custom` do `AdminFilterBar` (sem ×: o chip e "Limpar filtros" já limpam). */
  variant?: "pill" | "filterBar";
}

/** O que a lista mostra de cada pessoa: o mínimo comum entre o item da busca (e-mail, tipo) e o resolvido só por id (nome). */
export interface AuditActorOption {
  id: string;
  name: string;
  email?: string | null;
  /** Texto de apoio da opção ("Administrador da plataforma", "Marca"). */
  role?: string;
}

/** O hook de busca nasce fora do render: o `AdminEntityPicker` o chama como hook e pede sempre a mesma função. */
function createActorSearch(limit: number) {
  return function useActorSearch(search: string): AdminEntityPickerSearchResult<AuditActorOption> {
    const list = useAdminList<AdminUserListItem>({
      resource: "users",
      // Escopo próprio: a busca do filtro nunca se mistura com a lista de Usuários (que tem outros parâmetros).
      scope: ["actor-picker"],
      path: "/admin/users",
      params: { search, kind: "brand", status: "all", per_page: limit, sort_by: "name", order: "asc" },
    });
    const data = useMemo<AuditActorOption[] | undefined>(
      () =>
        list.data?.data.map((user) => ({
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.is_platform_admin ? "Administrador da plataforma" : USER_KIND_LABEL[user.kind],
        })),
      [list.data],
    );
    return {
      data,
      isLoading: list.isLoading,
      isError: list.isError,
      isFetching: list.isFetching,
      total: list.data?.meta.total,
      error: list.error,
      errorMessage: isEndpointUnavailable(list.error) ? "A busca de usuários ainda não está disponível no servidor." : undefined,
      retry: () => void list.refetch(),
    };
  };
}

/**
 * A pessoa de um `id` (o da URL) como objeto, mais o texto do chip do filtro ("Autor: Marina Admin"). Com o nome já
 * conhecido (`known`: o que a pessoa acabou de escolher) não consulta nada; senão busca o detalhe, uma vez, e guarda
 * por um tempo. Enquanto carrega o nome é "Carregando…"; se a pessoa não existe mais, "Usuário <id>".
 * Sem `id`: `actor` e `summary` são `null` (sem chip).
 *
 * É a mesma consulta que o `AuditActorPicker` faz: quem usa o seletor num filtro `custom` do `AdminFilterBar` chama
 * este hook para o `summary` do filtro sem gastar outra requisição.
 */
export function useAuditActorSelection(
  id: string | null | undefined,
  options: { label?: string; known?: AuditActorOption | null } = {},
): { actor: AuditActorOption | null; summary: string | null } {
  const { label = "Autor", known } = options;
  const selectedId = id ?? "";
  const knownName = known && known.id === selectedId ? known.name : undefined;
  const lookup = useAdminItem<AdminUserDetail>({
    resource: "users",
    id: selectedId || undefined,
    path: adminPath`/admin/users/${selectedId}`,
    enabled: !!selectedId && !knownName,
    staleTime: 5 * 60_000,
  });
  const actor: AuditActorOption | null = !selectedId
    ? null
    : { id: selectedId, name: knownName ?? lookup.data?.name ?? (lookup.isError ? `Usuário ${selectedId}` : "Carregando…") };
  return { actor, summary: adminEntityPickerSummary(label, actor, (item) => item.name) };
}

/**
 * Filtro "Autor" das alterações administrativas: busca de usuários no servidor (`GET /admin/users?search=`,
 * por nome ou e-mail), sobre o `AdminEntityPicker`. Quem fez a alteração é sempre alguém do time da plataforma ou o
 * proprietário que excluiu o próprio workspace, e todos estão na lista de usuários; o resultado marca quem é
 * administrador da plataforma. O escolhido aparece pelo nome (buscado quando só se conhece o id, como numa URL
 * recarregada). Teclado e acessibilidade são os do `AdminEntityPicker`.
 */
export function AuditActorPicker({
  value,
  onChange,
  label = "Autor",
  placeholder = "Qualquer pessoa",
  limit = 8,
  debounceMs = 300,
  variant = "pill",
}: AuditActorPickerProps) {
  // A última escolha: enquanto quem usa ainda não atualizou o `value` (a URL muda um instante depois), a pílula segue
  // mostrando o nome conhecido em vez de buscar o detalhe de novo e piscar "Carregando…".
  const [picked, setPicked] = useState<AuditActorOption | null>(null);
  const { actor } = useAuditActorSelection(value || null, { label, known: picked });
  const search = useMemo(() => createActorSearch(limit), [limit]);

  return (
    <AdminEntityPicker<AuditActorOption>
      label={label}
      placeholder="Buscar por nome ou e-mail"
      allLabel={placeholder}
      value={actor}
      onChange={(next) => {
        if (next) {
          const person = { id: next.id, name: next.name };
          setPicked(person);
          onChange(next.id, person);
        } else {
          onChange("");
        }
      }}
      search={search}
      getKey={(item) => item.id}
      getLabel={(item) => item.name}
      renderOption={(item) => {
        const detail = [item.email, item.role].filter(Boolean).join(" · ");
        return (
          <>
            <b>{item.name}</b>
            {detail ? <small>{detail}</small> : null}
          </>
        );
      }}
      variant={variant}
      debounceMs={debounceMs}
      emptyTitle="Nenhum usuário encontrado"
    />
  );
}
