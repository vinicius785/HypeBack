import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { GroupCardPv } from "@/components/groups/pv-group";
import { I } from "@/components/prototype/ui";
import { useSlidingIndicator } from "@/hooks/admin/use-sliding-indicator";
import { useGroups } from "@/hooks/use-groups";
import { getUploadUrl } from "@/lib/utils/api";
import type { GroupStatusFilter } from "@/shared/types";

const TABS: Array<{ id: GroupStatusFilter; label: string }> = [
  { id: "active", label: "Ativos" },
  { id: "deleted", label: "Arquivados" },
  { id: "all", label: "Todos" },
];

/**
 * Aba Grupos da Comunidade: os grupos dos criadores (ativos, arquivados ou todos), a busca e o cartão de criar um
 * novo. Abrir um grupo ou criar um leva às rotas filhas (`/admin/groups/$groupId`, `/admin/groups/new`), que
 * abrem como diálogo por cima desta lista.
 */
export function CommunityGroups() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<GroupStatusFilter>("active");
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGroups({ status: activeTab, search });

  const groups = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const { containerRef, indicatorRef } = useSlidingIndicator<HTMLDivElement>(activeTab);

  const goNew = () => navigate({ to: "/admin/groups/new" });
  const q = search.trim();
  const showNew = activeTab !== "deleted" && !q;

  const body = () => {
    if (isLoading)
      return (
        <div className="ov-empty big lvx-em">
          <small>Carregando…</small>
        </div>
      );
    if (error)
      return (
        <div className="ov-empty big lvx-em">
          <span>
            <I n="x" />
          </span>
          <b>Erro ao carregar os grupos</b>
          <small>{error instanceof Error ? error.message : "Tente novamente."}</small>
        </div>
      );
    if (groups.length === 0 && !showNew)
      return (
        <div className="ov-empty big lvx-em">
          <span>
            <I n="users" />
          </span>
          <b>{q ? "Nenhum grupo encontrado" : "Nenhum grupo arquivado"}</b>
          <small>
            {q
              ? "Ajuste a busca ou crie um novo grupo."
              : "Grupos arquivados aparecem aqui."}
          </small>
        </div>
      );
    return (
      <>
        <div className="gpx-g">
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
          {showNew && (
            <button
              type="button"
              className="gpx-c gpx-nw"
              style={{ ["--k" as string]: groups.length }}
              onClick={goNew}
            >
              <span>
                <I n="plus" />
              </span>
              <b>Criar grupo</b>
              <small>Reúna os criadores em torno de um tema</small>
            </button>
          )}
        </div>
        {hasNextPage && (
          <div className="gpx-more">
            <button
              type="button"
              className="btn out"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div className="tools fade gpx-tl">
        <div className="seg" id="gpseg" ref={containerRef}>
          <i className="ind" ref={indicatorRef} />
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={activeTab === t.id ? "on" : ""}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <label className="find">
          <I n="search" cls="sm" />
          <input
            placeholder="Buscar grupos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="fade gpx-rs" key={activeTab}>
        {body()}
      </div>
    </>
  );
}
