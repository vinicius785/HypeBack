import { useId, useMemo, useState, type ReactNode } from "react";

import { AdminEmptyState, AdminErrorState, AdminSkeleton } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useNiches } from "@/hooks/use-niches";
import { useAdminCampaignLookup } from "@/hooks/use-admin-notifications";
import { BRAZILIAN_STATES } from "@/shared/data/brazilian-states-cities";
import type {
  AdminAudienceFilter,
  AdminAudienceFilterType,
} from "@/shared/types";

interface AdminAudienceBuilderProps {
  value: AdminAudienceFilter;
  onChange: (next: AdminAudienceFilter) => void;
}

const TYPE_OPTIONS: Array<[AdminAudienceFilterType, string]> = [
  ["all", "Todos"],
  ["campaign", "Campanha"],
  ["niche", "Nicho"],
  ["followers", "Tamanho"],
  ["location", "Estado"],
];

/** Audiência pronta para estimar/enviar (mesmas regras do formulário). */
export function isAudienceValid(a: AdminAudienceFilter): boolean {
  switch (a.type) {
    case "all":
      return true;
    case "campaign":
      return !!a.campaign_id;
    case "niche":
      return a.niche_ids.length > 0;
    case "followers":
      return a.max_followers > a.min_followers;
    case "location":
      return (a.states?.length ?? 0) > 0 || (a.cities?.length ?? 0) > 0;
  }
}

export function audienceError(a: AdminAudienceFilter): string | null {
  if (isAudienceValid(a)) return null;
  switch (a.type) {
    case "campaign":
      return "Selecione uma campanha";
    case "niche":
      return "Selecione ao menos um nicho";
    case "followers":
      return "Máximo deve ser maior que mínimo";
    case "location":
      return "Selecione estado ou cidade";
    default:
      return null;
  }
}

function defaultsForType(type: AdminAudienceFilterType): AdminAudienceFilter {
  switch (type) {
    case "all":
      return { type: "all" };
    case "campaign":
      return { type: "campaign", campaign_id: "" };
    case "niche":
      return { type: "niche", niche_ids: [] };
    case "followers":
      return { type: "followers", min_followers: 0, max_followers: 100000 };
    case "location":
      return { type: "location", states: [], cities: [] };
  }
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`nch ${on ? "on" : ""}`}
      aria-pressed={on}
      onClick={onClick}
    >
      {on ? <I n="check" cls="sm" /> : null}
      {children}
    </button>
  );
}

/** Chips em carregamento: o mesmo tamanho dos chips que vão chegar. */
function ChipsSkeleton({ label }: { label: string }) {
  return (
    <div className="nchips" role="status">
      <span className="adm-sr">{label}</span>
      {[132, 96, 148, 112, 84].map((width, index) => (
        <AdminSkeleton key={index} width={width} height={38} radius={999} />
      ))}
    </div>
  );
}

const toggle = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

const onlyDigits = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;

interface PickerQuery {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
  error: unknown;
}

/**
 * Estado de uma lista de chips que vem de uma consulta: carregando (esqueleto), erro (com "Tentar de novo") ou
 * vazio. `null` quando há o que mostrar: quem chama desenha os chips.
 */
function pickerState(
  query: PickerQuery,
  count: number,
  text: { loading: string; error: string; empty: string; emptyHint?: string; icon: string },
): ReactNode | null {
  if (query.isLoading) return <ChipsSkeleton label={text.loading} />;
  if (query.isError && count === 0) {
    return (
      <AdminErrorState
        compact
        error={query.error}
        title={text.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (count === 0) return <AdminEmptyState compact icon={text.icon} title={text.empty} description={text.emptyHint} />;
  return null;
}

export function AdminAudienceBuilder({
  value,
  onChange,
}: AdminAudienceBuilderProps) {
  const [campaignSearch, setCampaignSearch] = useState("");
  const typeLabelId = useId();
  const campaignSearchId = useId();
  const niches = useNiches();
  const campaignsQuery = useAdminCampaignLookup(campaignSearch, {
    enabled: value.type === "campaign",
  });
  const campaigns = campaignsQuery.data ?? [];
  const nicheList = niches.data ?? [];

  const campaignChips = useMemo(
    () =>
      campaigns.map((c) => ({
        id: c.id,
        label: c.workspace_name ? `${c.title} · ${c.workspace_name}` : c.title,
      })),
    [campaigns],
  );

  return (
    <>
      <div className="n4c" role="group" aria-labelledby={typeLabelId}>
        <span className="n4l" id={typeLabelId}>
          Quem vai receber
        </span>
        <div className="n4tm ntw-au">
          {TYPE_OPTIONS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={value.type === k ? "on" : ""}
              aria-pressed={value.type === k}
              onClick={() => value.type !== k && onChange(defaultsForType(k))}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {value.type === "campaign" && (
        <div className="n4c">
          <label className="n4l" htmlFor={campaignSearchId}>
            Campanha
          </label>
          <input
            id={campaignSearchId}
            className="cm-in"
            placeholder="Buscar campanha pelo título"
            value={campaignSearch}
            onChange={(e) => setCampaignSearch(e.target.value)}
            autoComplete="off"
            style={{ marginBottom: 12 }}
          />
          {pickerState(campaignsQuery, campaignChips.length, {
            loading: "Carregando campanhas…",
            error: "Não foi possível carregar as campanhas",
            empty: campaignSearch.trim() ? "Nenhuma campanha encontrada" : "Nenhuma campanha disponível",
            emptyHint: campaignSearch.trim() ? "Ajuste a busca pelo título." : undefined,
            icon: "search",
          }) ?? (
            <div className="nchips">
              {campaignChips.map((c) => (
                <Chip
                  key={c.id}
                  on={value.campaign_id === c.id}
                  onClick={() => onChange({ type: "campaign", campaign_id: c.id })}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {value.type === "niche" && (
        <div className="n4c" role="group" aria-labelledby={`${typeLabelId}-niche`}>
          <span className="n4l" id={`${typeLabelId}-niche`}>
            Nichos
          </span>
          {pickerState(niches, nicheList.length, {
            loading: "Carregando nichos…",
            error: "Não foi possível carregar os nichos",
            empty: "Nenhum nicho cadastrado",
            icon: "tag",
          }) ?? (
            <div className="nchips">
              {nicheList.map((n) => (
                <Chip
                  key={n.id}
                  on={value.niche_ids.includes(Number(n.id))}
                  onClick={() =>
                    onChange({
                      type: "niche",
                      niche_ids: toggle(value.niche_ids, Number(n.id)),
                    })
                  }
                >
                  {n.name}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {value.type === "followers" && (
        <div className="n4c" role="group" aria-labelledby={`${typeLabelId}-followers`}>
          <span className="n4l" id={`${typeLabelId}-followers`}>
            Faixa de seguidores
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input
              className="cm-in"
              inputMode="numeric"
              aria-label="Mínimo de seguidores"
              placeholder="Mínimo"
              value={
                value.min_followers
                  ? value.min_followers.toLocaleString("pt-BR")
                  : ""
              }
              onChange={(e) =>
                onChange({ ...value, min_followers: onlyDigits(e.target.value) })
              }
            />
            <input
              className="cm-in"
              inputMode="numeric"
              aria-label="Máximo de seguidores"
              placeholder="Máximo"
              value={
                value.max_followers
                  ? value.max_followers.toLocaleString("pt-BR")
                  : ""
              }
              onChange={(e) =>
                onChange({ ...value, max_followers: onlyDigits(e.target.value) })
              }
            />
          </div>
        </div>
      )}

      {value.type === "location" && (
        <>
          <div className="n4c" role="group" aria-labelledby={`${typeLabelId}-states`}>
            <span className="n4l" id={`${typeLabelId}-states`}>
              Estados
            </span>
            <div className="nchips">
              {BRAZILIAN_STATES.map((s) => (
                <Chip
                  key={s.code}
                  on={(value.states ?? []).includes(s.code)}
                  onClick={() =>
                    onChange({
                      type: "location",
                      states: toggle(value.states ?? [], s.code),
                      cities: value.cities ?? [],
                    })
                  }
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
          <div className="n4c">
            <label className="n4l" htmlFor={`${typeLabelId}-cities`}>
              Cidades <em>opcional, separadas por vírgula</em>
            </label>
            <input
              id={`${typeLabelId}-cities`}
              className="cm-in"
              placeholder="Ex.: São Paulo, Rio de Janeiro"
              value={(value.cities ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  type: "location",
                  states: value.states ?? [],
                  cities: e.target.value
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                })
              }
              autoComplete="off"
            />
          </div>
        </>
      )}
    </>
  );
}
