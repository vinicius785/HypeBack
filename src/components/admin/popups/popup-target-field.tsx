import { useId } from "react";

import { useAdminList } from "@/hooks/admin/use-admin-queries";
import { EXTERNAL_URL, idFieldLabel, idFieldOf, screenLabel, type PopupDraft } from "@/lib/admin/popup-form";
import type { AdminCampaignListItem } from "@/shared/admin-platform.types";
import type { PopupOptions } from "@/shared/popups.types";

/** Campanhas mais recentes: o valor é o id público, que é o que a API espera. */
export function PopupCampaignSelect({ id, value, onChange, invalid, placeholder = "Escolha a campanha" }: { id: string; value: string; onChange: (value: string) => void; invalid?: boolean; placeholder?: string }) {
  const list = useAdminList<AdminCampaignListItem>({
    resource: "campaigns",
    scope: ["popup-campaign"],
    path: "/admin/campaigns",
    params: { per_page: 100, sort_by: "created_at", order: "desc" },
  });
  const items = list.data?.data ?? [];
  const known = items.some((campaign) => campaign.id === value);
  return (
    <select id={id} className="cm-in" value={value} aria-invalid={invalid ? true : undefined} onChange={(event) => onChange(event.target.value)}>
      <option value="">{list.isLoading ? "Carregando campanhas…" : placeholder}</option>
      {value && !known ? <option value={value}>{value}</option> : null}
      {items.map((campaign) => (
        <option key={campaign.id} value={campaign.id}>
          {campaign.title}
        </option>
      ))}
    </select>
  );
}

interface Props {
  draft: PopupDraft;
  options: PopupOptions;
  error?: string;
  onChange: (patch: Partial<PopupDraft>) => void;
}

/**
 * "Para qual página vai": as telas da API (sem id e com id) e o link externo. Nada de lista fixa no código. Devolve as
 * células da grade do bloco "Botão": a escolha da tela e, se pedir, o item ou o link na linha de baixo.
 */
export function PopupTargetField({ draft, options, error, onChange }: Props) {
  const selectId = useId();
  const detailId = useId();
  const idField = idFieldOf(draft.screen, options);
  const isLink = draft.screen === EXTERNAL_URL;
  return (
    <>
      <div className={`n4c ${error && !idField && !isLink ? "bad" : ""}`}>
        <label className="n4l" htmlFor={selectId}>
          Para qual página vai
        </label>
        <select id={selectId} className="cm-in" value={draft.screen} onChange={(event) => onChange({ screen: event.target.value, targetId: "", url: "" })}>
          <option value="">Sem botão (só informa e fecha)</option>
          <optgroup label="Telas do app">
            {options.screens_without_id.map((screen) => (
              <option key={screen} value={screen}>
                {screenLabel(screen)}
              </option>
            ))}
          </optgroup>
          {options.screens_with_id.length > 0 ? (
            <optgroup label="Uma tela específica">
              {options.screens_with_id.map((item) => (
                <option key={item.screen} value={item.screen}>
                  {screenLabel(item.screen)}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Fora do app">
            <option value={EXTERNAL_URL}>Link externo</option>
          </optgroup>
        </select>
        {error && !idField && !isLink ? (
          <small className="nfe" role="alert">
            {error}
          </small>
        ) : null}
      </div>

      {idField ? (
        <div className={`n4c adm-pop-wide ${error ? "bad" : ""}`}>
          <label className="n4l" htmlFor={detailId}>
            {idFieldLabel(idField)}
          </label>
          {idField === "campaign_id" ? (
            <PopupCampaignSelect id={detailId} value={draft.targetId} onChange={(targetId) => onChange({ targetId })} invalid={!!error} />
          ) : (
            <input id={detailId} className="cm-in" value={draft.targetId} placeholder="Cole o id" autoComplete="off" aria-invalid={error ? true : undefined} onChange={(event) => onChange({ targetId: event.target.value })} />
          )}
          {error ? (
            <small className="nfe" role="alert">
              {error}
            </small>
          ) : null}
        </div>
      ) : null}

      {isLink ? (
        <div className={`n4c adm-pop-wide ${error ? "bad" : ""}`}>
          <label className="n4l" htmlFor={detailId}>
            Link
          </label>
          <input id={detailId} className="cm-in" value={draft.url} inputMode="url" autoComplete="off" placeholder={`https://${options.external_url_hosts[0] ?? "hypeapp.com.br"}/…`} aria-invalid={error ? true : undefined} onChange={(event) => onChange({ url: event.target.value })} />
          {error ? (
            <small className="nfe" role="alert">
              {error}
            </small>
          ) : options.external_url_hosts.length > 0 ? (
            <small className="lvf-ct">Só https de {options.external_url_hosts.join(", ")}.</small>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
