import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AdminAvatar,
  AdminEmptyState,
  AdminErrorState,
  AdminFilterBar,
  inIsland,
  AdminLoadMore,
  AdminSearchInput,
  AdminSection,
  AdminSkeleton,
} from "@/components/admin/platform";
import { useCommunityMembers, useUpdateCommunityMember } from "@/hooks/use-community-members";
import type { CommunityMember, CommunityMembersFilter } from "@/shared/services/community-members";

import { VerifiedBadge } from "./verified-badge";

import "@/styles/admin-community.css";

type Segment = "team" | "moderators" | "verified";

const SEGMENTS = [
  { value: "team", label: "Equipe" },
  { value: "moderators", label: "Moderadores" },
  { value: "verified", label: "Contas oficiais" },
] as const;

/** Busca com menos letras que isso não consulta (evita listar todo mundo ao digitar a primeira letra). */
const MIN_SEARCH = 2;

type Field = "moderator" | "verified";

function Toggle({ label, on, busy, onToggle, name }: { label: string; on: boolean; busy: boolean; onToggle: () => void; name: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${name}`}
      aria-busy={busy || undefined}
      disabled={busy}
      className={`adm-team-sw${on ? " on" : ""}`}
      onClick={onToggle}
    >
      <span className="adm-team-sw-k" aria-hidden="true" />
      {label}
    </button>
  );
}

function Row({ m, busyField, onToggle }: { m: CommunityMember; busyField: Field | null; onToggle: (m: CommunityMember, field: Field) => void }) {
  return (
    <li className="adm-team-row">
      <AdminAvatar name={m.name} photo={m.avatar_url} size={44} />
      <div className="adm-team-id">
        <p className="adm-team-name">
          <b>{m.name}</b>
          {m.is_verified ? <VerifiedBadge /> : null}
          {m.is_moderator ? <span className="adm-team-chip">Moderador</span> : null}
        </p>
        <small>{[m.username ? `@${m.username}` : null, m.email].filter(Boolean).join(" · ")}</small>
      </div>
      <div className="adm-team-act">
        <Toggle label="Moderador" name={m.name} on={m.is_moderator} busy={busyField === "moderator"} onToggle={() => onToggle(m, "moderator")} />
        <Toggle label="Verificado" name={m.name} on={m.is_verified} busy={busyField === "verified"} onToggle={() => onToggle(m, "verified")} />
      </div>
    </li>
  );
}

function TeamSkeleton() {
  return (
    <AdminSection flush>
      <div role="status" aria-busy="true">
        <span className="adm-sr">Carregando pessoas…</span>
        {Array.from({ length: 4 }, (_, i) => (
          <div className="adm-team-row" key={i} aria-hidden="true">
            <AdminSkeleton width={44} height={44} radius="50%" />
            <div className="adm-team-id">
              <AdminSkeleton height={16} width="38%" />
              <AdminSkeleton height={12} width="55%" />
            </div>
            <AdminSkeleton height={34} width={210} radius="999px" />
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

/**
 * Aba Equipe da Comunidade: quem é moderador e quem tem o selo roxo de conta oficial, e a busca de pessoas para
 * promover. Sem busca, lista a equipe (ou só moderadores, ou só contas oficiais); digitando, procura em todas as
 * pessoas. As duas marcas são identificação visual (nunca dão acesso ao Admin) e valem no app e no Feed.
 */
export function CommunityTeam({ tools }: { tools?: HTMLElement | null } = {}) {
  const [segment, setSegment] = useState<Segment>("team");
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= MIN_SEARCH;
  const filter: CommunityMembersFilter = searching ? "all" : segment;

  const query = useCommunityMembers({ filter, q: searching ? search : "" });
  const update = useUpdateCommunityMember();
  const members = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const toggle = (m: CommunityMember, field: Field) => {
    const grant = field === "moderator" ? !m.is_moderator : !m.is_verified;
    update.mutate(
      { userId: m.id, input: field === "moderator" ? { moderator: grant } : { verified: grant } },
      {
        onSuccess: () =>
          toast.success(
            field === "moderator"
              ? grant ? `${m.name} agora é moderador` : `${m.name} deixou de ser moderador`
              : grant ? `${m.name} agora é uma conta oficial` : `O selo de ${m.name} foi removido`,
          ),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar a alteração."),
      },
    );
  };

  const busy = (m: CommunityMember): Field | null => {
    if (!update.isPending || update.variables?.userId !== m.id) return null;
    return update.variables.input.moderator !== undefined ? "moderator" : "verified";
  };

  let body: ReactNode;
  if (query.isLoading) {
    body = <TeamSkeleton />;
  } else if (query.error) {
    body = (
      <AdminSection flush>
        <AdminErrorState
          compact
          title="Não foi possível carregar as pessoas"
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </AdminSection>
    );
  } else if (members.length === 0) {
    body = (
      <AdminSection flush>
        {searching ? (
          <AdminEmptyState
            compact
            icon="search"
            title="Nenhuma pessoa encontrada"
            description={`Ninguém corresponde a “${search.trim()}”. Tente o nome completo, o e-mail ou o @usuário.`}
            action={
              <button type="button" className="btn out adm-btn-sm" onClick={() => setSearch("")}>
                Limpar busca
              </button>
            }
          />
        ) : (
          <AdminEmptyState
            compact
            icon="users"
            title={segment === "moderators" ? "Nenhum moderador ainda" : segment === "verified" ? "Nenhuma conta oficial ainda" : "Ninguém na equipe ainda"}
            description="Use a busca acima para achar uma pessoa e ligar Moderador ou Verificado."
          />
        )}
      </AdminSection>
    );
  } else {
    body = (
      <>
        <AdminSection flush>
          <ul className="adm-team-list" aria-busy={query.isPlaceholderData ? true : undefined} aria-label={searching ? "Resultado da busca" : "Pessoas"}>
            {members.map((m) => (
              <Row key={m.id} m={m} busyField={busy(m)} onToggle={toggle} />
            ))}
          </ul>
        </AdminSection>
        <AdminLoadMore
          loaded={members.length}
          hasMore={!!query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          noun={{ singular: "pessoa", plural: "pessoas" }}
        />
      </>
    );
  }

  return (
    <div className="adm-com-stack">
      <p className="adm-team-note">
        <b>Moderador</b> e o selo <b>Verificado</b> (a conta oficial, com o ícone roxo) são só identificação: aparecem no app e no Feed e
        não dão acesso ao Admin.
      </p>
      {inIsland(tools, (
      <AdminFilterBar
        filters={[{ kind: "select", key: "segment", label: "Quem mostrar", options: SEGMENTS, defaultValue: "team" }]}
        values={{ segment }}
        onChange={(patch) => {
          if (patch.segment !== undefined) setSegment(patch.segment as Segment);
        }}
        onClear={() => setSegment("team")}
        search={
          <AdminSearchInput
            value={search}
            onSearch={setSearch}
            placeholder="Buscar pessoa por nome, e-mail ou @usuário"
            label="Buscar pessoa"
          />
        }
        searchLabel="Buscar pessoa"
        compact
      />
      ))}
      {searching ? <p className="adm-team-hint">Resultado da busca em todas as pessoas. Limpe a busca para voltar à equipe.</p> : null}
      {body}
    </div>
  );
}
