import { useId } from "react";

import { useAdminList } from "@/hooks/admin/use-admin-queries";
import {
  EXTERNAL_URL_SCREEN,
  TARGET_SCREENS_PLAIN,
  TARGET_SCREENS_WITH_ID,
  targetDraftError,
  targetIdFieldLabel,
  type TargetDraft,
} from "@/lib/admin/notification-target";
import type { AdminCampaignListItem } from "@/shared/admin-platform.types";

interface Props {
  value: TargetDraft;
  onChange: (next: TargetDraft) => void;
  /** Mostra o erro do destino (depois de tentar avançar). */
  showError: boolean;
}

/** Campanhas publicadas mais recentes: o valor é o id público, que é o que o app espera no destino. */
function CampaignSelect({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid: boolean }) {
  const list = useAdminList<AdminCampaignListItem>({
    resource: "campaigns",
    scope: ["notification-target"],
    path: "/admin/campaigns",
    params: { status: "published", per_page: 100, sort_by: "created_at", order: "desc" },
  });
  const items = list.data?.data ?? [];
  const known = items.some((c) => c.id === value);
  return (
    <select id={id} className="cm-in" value={value} aria-invalid={invalid ? true : undefined} onChange={(e) => onChange(e.target.value)}>
      <option value="">{list.isLoading ? "Carregando campanhas…" : "Escolha a campanha"}</option>
      {value && !known ? <option value={value}>{value}</option> : null}
      {items.map((campaign) => (
        <option key={campaign.id} value={campaign.id}>
          {campaign.title}
        </option>
      ))}
    </select>
  );
}

/** "Ao tocar, abrir:": a tela do app (ou um link da Hype) que a push e o item do sino abrem. O padrão é a lista de notificações. */
export function AdminNotificationTargetField({ value, onChange, showError }: Props) {
  const selectId = useId();
  const detailId = useId();
  const error = showError ? targetDraftError(value) : null;
  const withId = TARGET_SCREENS_WITH_ID.find((s) => s.value === value.screen);
  const isLink = value.screen === EXTERNAL_URL_SCREEN;

  return (
    <div className={`n4c ${error ? "bad" : ""}`}>
      <label className="n4l" htmlFor={selectId}>
        Ao tocar, abrir
      </label>
      <select
        id={selectId}
        className="cm-in"
        value={value.screen}
        onChange={(e) => onChange({ screen: e.target.value, id: "", commentId: "", url: "" })}
      >
        <option value="">Lista de notificações (padrão)</option>
        <optgroup label="Telas do app">
          {TARGET_SCREENS_PLAIN.map((screen) => (
            <option key={screen.value} value={screen.value}>
              {screen.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Uma tela específica">
          {TARGET_SCREENS_WITH_ID.map((screen) => (
            <option key={screen.value} value={screen.value}>
              {screen.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Fora do app">
          <option value={EXTERNAL_URL_SCREEN}>Abrir um link</option>
        </optgroup>
      </select>

      {withId ? (
        <>
          <label className="n4l" htmlFor={detailId}>
            {targetIdFieldLabel(withId.field)}
          </label>
          {withId.field === "campaign_id" ? (
            <CampaignSelect id={detailId} value={value.id} onChange={(id) => onChange({ ...value, id })} invalid={!!error} />
          ) : (
            <input
              id={detailId}
              className="cm-in"
              value={value.id}
              placeholder="Cole o id"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ ...value, id: e.target.value })}
            />
          )}
          {value.screen === "community_post" ? (
            <>
              <label className="n4l" htmlFor={`${detailId}-comment`}>
                Id do comentário <em>opcional</em>
              </label>
              <input
                id={`${detailId}-comment`}
                className="cm-in"
                value={value.commentId}
                placeholder="Para abrir direto num comentário"
                autoComplete="off"
                onChange={(e) => onChange({ ...value, commentId: e.target.value })}
              />
            </>
          ) : null}
        </>
      ) : null}

      {isLink ? (
        <>
          <label className="n4l" htmlFor={detailId}>
            Link
          </label>
          <input
            id={detailId}
            className="cm-in"
            value={value.url}
            placeholder="https://www.hypeapp.com.br/promo"
            autoComplete="off"
            inputMode="url"
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
          />
        </>
      ) : null}

      {error ? (
        <small className="nfe" role="alert">
          {error}
        </small>
      ) : isLink ? (
        <small className="nfe" data-hint="true">
          Só https de hypeapp.com.br, www.hypeapp.com.br e api-v2.hypeapp.com.br.
        </small>
      ) : null}
    </div>
  );
}
