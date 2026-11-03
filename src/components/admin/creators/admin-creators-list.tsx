import type { ReactNode } from "react";

import {
  AdminFilterBar,
  AdminInfoPopover,
  AdminPager,
  AdminRefreshButton,
  AdminSearchInput,
  AdminTable,
  type AdminFilterDef,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useAdminListQueryState, useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import { ADMIN_CREATOR_LIST_CONFIG, useAdminCreators } from "@/hooks/admin/use-admin-creators";
import { formatDate, formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminCreatorListItem } from "@/shared/admin-platform.types";

import {
  CreatorCell,
  FirstCampaignCell,
  NetworksCell,
  RegistrationCell,
  userTarget,
} from "./admin-creators-cells";
import {
  minFollowersOptions,
  NETWORK_FILTER_OPTIONS,
  REGISTRATION_FILTER_OPTIONS,
} from "./creator-labels";
import { AdminCreatorsProfile } from "./admin-creators-profile";

import "@/styles/admin-creators.css";

/** O texto "como é calculado" que o servidor mandou para a coluna (`meta.definitions`), ou o do contrato. */
function pickDefinition(
  definitions: Record<string, string> | undefined,
  keys: readonly string[],
  fallback: string,
): string {
  for (const key of keys) {
    const text = definitions?.[key];
    if (text) return text;
  }
  return fallback;
}

/**
 * Aba "Criadores": a base de criadores da plataforma, somente leitura. Nenhuma ação altera criador aqui; o servidor
 * não tem rota para isso neste contrato. A linha leva ao usuário (`/admin/users/:userId`).
 *
 * "Perfil" é uma coisa só nesta tela: o segmento (Todos, Completo, Incompleto, Conta externa), a coluna e as etiquetas
 * dela falam do estado dos dados do cadastro; "Cadastrado em" é só a data (coluna e filtro). Na URL continuam
 * `registration`, `created_from` e `created_to`.
 */
export function AdminCreatorsList() {
  const list = useAdminListQueryState(ADMIN_CREATOR_LIST_CONFIG);
  const query = useAdminCreators(list.params);
  const meta = query.data?.meta;
  useAdminPageClamp(list.page, meta?.total_pages, list.setPage);

  const definitions = meta?.definitions;

  const filters: AdminFilterDef[] = [
    { kind: "select", key: "network", label: "Rede", options: NETWORK_FILTER_OPTIONS },
    {
      kind: "select",
      key: "min_followers",
      label: "Seguidores mínimos",
      options: minFollowersOptions(list.filters.min_followers),
    },
    { kind: "date-range", label: "Cadastrado em", fromKey: "created_from", toKey: "created_to" },
  ];

  const columns: AdminTableColumn<AdminCreatorListItem>[] = [
    {
      key: "creator",
      header: "Criador",
      sortKey: "name",
      primary: true,
      width: "minmax(0, 2fr)",
      cell: (creator) => <CreatorCell creator={creator} />,
    },
    {
      key: "networks",
      header: "Redes",
      // no cartão do celular a rede e os seguidores precisam da linha inteira para ficar legíveis e alinhados
      wide: true,
      width: "minmax(0, 2fr)",
      cell: (creator) => <NetworksCell creator={creator} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>
            Redes sociais do criador, com o @ e os seguidores de cada uma. UGC não é rede social: aparece só como etiqueta.
          </AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>Rede inativa: os seguidores dela não entram no total.</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "followers",
      header: "Seguidores",
      sortKey: "followers",
      align: "right",
      nowrap: true,
      width: "112px",
      cell: (creator) => <span className="adm-num">{formatInt(creator.followers_total)}</span>,
      definition: pickDefinition(
        definitions,
        ["followers_total", "followers"],
        "Soma dos seguidores das redes ativas. UGC não é rede social e não entra na conta.",
      ),
    },
    {
      key: "campaigns",
      header: "Campanhas",
      sortKey: "campaigns",
      align: "right",
      nowrap: true,
      hideBelow: "md",
      width: "104px",
      cell: (creator) => <span className="adm-num">{formatInt(creator.campaigns_count)}</span>,
    },
    {
      key: "registration",
      header: "Perfil",
      wide: true,
      width: "minmax(0, 1.7fr)",
      cell: (creator) => <RegistrationCell creator={creator} />,
      definition: (
        <>
          <AdminInfoPopover.Paragraph>
            {pickDefinition(
              definitions,
              ["registration"],
              "Completo: tem os dados mínimos de cadastro. Incompleto: faltam dados (veja a lista). Conta externa: criada por convite e nunca assumida pela pessoa.",
            )}
          </AdminInfoPopover.Paragraph>
          <AdminInfoPopover.Paragraph>O rótulo é uma sugestão de atenção, não um erro.</AdminInfoPopover.Paragraph>
        </>
      ),
    },
    {
      key: "first_campaign",
      header: "Primeira campanha",
      wide: true,
      hideBelow: "lg",
      width: "minmax(0, 1.8fr)",
      cell: (creator) => <FirstCampaignCell creator={creator} />,
      definition: pickDefinition(
        definitions,
        ["first_campaign"],
        "Não existe workspace de origem: todo criador tem um workspace pessoal. Esta é a primeira campanha em que ele participou (dado derivado).",
      ),
    },
    {
      key: "created",
      header: "Cadastrado em",
      sortKey: "created_at",
      hideBelow: "md",
      nowrap: true,
      width: "108px",
      cell: (creator) => <span title={formatDateTime(creator.created_at)}>{formatDate(creator.created_at)}</span>,
    },
  ];

  const filtered = list.hasActiveFilters || !!list.search;
  const emptyAction: ReactNode = filtered ? (
    <button type="button" className="btn out adm-btn-sm" onClick={list.reset}>
      Limpar busca e filtros
    </button>
  ) : undefined;

  return (
    <>
      <AdminFilterBar
        segment={{
          options: REGISTRATION_FILTER_OPTIONS,
          value: list.filters.registration,
          onChange: (value) => list.setFilter("registration", value),
          ariaLabel: "Perfil",
        }}
        segmentDefault=""
        search={<AdminSearchInput value={list.search} onSearch={list.setSearch} placeholder="Buscar por nome, e-mail ou @ da rede" />}
        searchLabel="Buscar criadores"
        filters={filters}
        values={list.filters}
        onChange={(patch) => list.setFilters(patch)}
        onClear={list.clearFilters}
        trailing={<AdminRefreshButton iconOnly onClick={() => void query.refetch()} loading={query.isFetching} />}
      />

      <AdminTable
        caption="Criadores"
        columns={columns}
        rows={query.data?.data}
        rowKey={(creator) => creator.id}
        rowLink={(creator) => userTarget(creator.id)}
        sort={{ by: list.sortBy, order: list.order }}
        onSort={(key) => list.toggleSort(key, key === "name" ? "asc" : "desc")}
        loading={query.isLoading}
        refreshing={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        empty={
          filtered
            ? {
                title: "Nenhum criador encontrado",
                description: "Nenhum criador corresponde à busca e aos filtros atuais.",
                action: emptyAction,
              }
            : { title: "Nenhum criador ainda", description: "Quando alguém se cadastrar como criador, aparece aqui." }
        }
        footer={
          meta ? (
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              onPageChange={list.setPage}
              onPerPageChange={list.setPerPage}
              disabled={query.isFetching}
            />
          ) : undefined
        }
      />

      <AdminCreatorsProfile />
    </>
  );
}
