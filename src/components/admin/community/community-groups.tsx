import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  AdminLoadMore,
  AdminSearchInput,
  AdminSection,
  AdminSkeleton,
} from "@/components/admin/platform";
import { GroupCardPv } from "@/components/groups/pv-group";
import { useGroups } from "@/hooks/use-groups";
import { getUploadUrl } from "@/lib/utils/api";
import type { GroupStatusFilter } from "@/shared/types";

import "@/styles/admin-community.css";

const STATUS_OPTIONS = [
  { value: "active", label: "Ativos" },
  { value: "deleted", label: "Arquivados" },
  { value: "all", label: "Todos" },
] as const;

const DEFAULT_STATUS: GroupStatusFilter = "active";

/** Cartões em carregamento: o mesmo desenho da grade de grupos (capa quadrada, nome, descrição). */
function GroupsSkeleton() {
  return (
    <div className="adm-com-gsk" role="status">
      <span className="adm-sr">Carregando grupos…</span>
      <div className="gpx-g" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="adm-com-gsk-card" key={index}>
            <span className="adm-com-gsk-img">
              <AdminSkeleton width="100%" height="100%" radius="var(--adm-r-md)" />
            </span>
            <div className="adm-com-gsk-body">
              <AdminSkeleton height={18} width="62%" />
              <AdminSkeleton height={12} width="92%" />
              <AdminSkeleton height={12} width={`${70 - (index % 3) * 10}%`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Aba Grupos da Comunidade: os grupos dos criadores (ativos, arquivados ou todos) e a busca. Abrir um grupo ou
 * criar um leva às rotas filhas (`/admin/groups/$groupId`, `/admin/groups/new`), que abrem como diálogo por
 * cima desta lista. Só há UM "Criar grupo" na tela, o do cabeçalho da página: o estado vazio só orienta para ele
 * (sem repetir o botão) e, numa busca sem resultado, a ação é "Limpar busca". Arquivados/Todos contam como
 * filtro (chip e "Limpar filtros" voltam aos Ativos).
 */
export function CommunityGroups() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<GroupStatusFilter>(DEFAULT_STATUS);
  const [search, setSearch] = useState("");

  const query = useGroups({ status, search });
  const groups = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  let body: ReactNode;
  if (query.isLoading) {
    body = <GroupsSkeleton />;
  } else if (query.error) {
    body = (
      <AdminSection flush>
        <AdminErrorState
          compact
          title="Não foi possível carregar os grupos"
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </AdminSection>
    );
  } else if (groups.length === 0) {
    body = (
      <AdminSection flush>
        {search ? (
          <AdminEmptyState
            compact
            icon="search"
            title="Nenhum grupo encontrado"
            description={`Nenhum grupo corresponde a “${search}”.`}
            action={
              <button type="button" className="btn out adm-btn-sm" onClick={() => setSearch("")}>
                Limpar busca
              </button>
            }
          />
        ) : status === "deleted" ? (
          <AdminEmptyState compact icon="users" title="Nenhum grupo arquivado" description="Grupos arquivados aparecem aqui." />
        ) : (
          <AdminEmptyState
            compact
            icon="users"
            title="Nenhum grupo ainda"
            description="Use o botão “Criar grupo”, no topo da página, para reunir os criadores em torno de um tema."
          />
        )}
      </AdminSection>
    );
  } else {
    body = (
      <>
        <div className="gpx-g" aria-busy={query.isPlaceholderData ? true : undefined}>
          {groups.map((g, k) => (
            <GroupCardPv
              key={g.id}
              k={k}
              onOpen={() =>
                navigate({
                  to: "/admin/groups/$groupId",
                  params: { groupId: g.id },
                })
              }
              g={{
                name: g.name,
                description: g.description,
                cover: getUploadUrl(g.cover_url) ?? null,
                official: g.is_official,
                level: g.required_level,
                hype: g.required_hype_points,
                members: g.members_count,
                posts: g.posts_count,
                archived: !!g.deleted_at,
              }}
            />
          ))}
        </div>
        <AdminLoadMore
          loaded={groups.length}
          hasMore={!!query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          noun={{ singular: "grupo", plural: "grupos" }}
        />
      </>
    );
  }

  return (
    <div className="adm-com-stack">
      <AdminFilterBar
        segment={{
          options: STATUS_OPTIONS,
          value: status,
          onChange: (value) => setStatus(value as GroupStatusFilter),
          ariaLabel: "Status dos grupos",
        }}
        segmentDefault={DEFAULT_STATUS}
        search={<AdminSearchInput value={search} onSearch={setSearch} placeholder="Buscar grupos" label="Buscar grupos" />}
        searchLabel="Buscar grupos"
      />

      {body}
    </div>
  );
}
