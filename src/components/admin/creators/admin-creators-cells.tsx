import { useState } from "react";

import { I } from "@/components/prototype/ui";
import {
  AdminAvatar,
  AdminLink,
  AdminStatusBadge,
  type AdminLinkTarget,
} from "@/components/admin/platform";
import { formatDate, formatInt } from "@/lib/admin/format";
import type { AdminCreatorListItem, AdminCreatorNetwork } from "@/shared/admin-platform.types";

import {
  EXTERNAL_ACCOUNT_HELP,
  EXTERNAL_ACCOUNT_LABEL,
  formatHandle,
  isUgcType,
  networkIconName,
  networkLabel,
} from "./creator-labels";

import "@/styles/admin-creators.css";

/** Foto, nome (com a etiqueta de suspenso, quando for o caso) e e-mail. */
export function CreatorCell({ creator }: { creator: AdminCreatorListItem }) {
  return (
    <div className="adm-creators-who">
      <AdminAvatar name={creator.name} photo={creator.photo} size={40} />
      <span className="adm-creators-who-text">
        <span className="adm-creators-who-name">
          <b title={creator.name}>{creator.name}</b>
          {creator.status !== "active" ? <AdminStatusBadge kind="user" value={creator.status} size="sm" /> : null}
        </span>
        <small title={creator.email}>{creator.email}</small>
      </span>
    </div>
  );
}

function NetworkLine({ network }: { network: AdminCreatorNetwork }) {
  const label = networkLabel(network.type);
  return (
    <li data-disabled={network.disabled ? "true" : undefined}>
      <span className="adm-creators-net-ico" role="img" aria-label={label} title={label}>
        <I n={networkIconName(network.type)} cls="sm" />
      </span>
      <span className="adm-creators-net-user" title={formatHandle(network.username)}>
        {formatHandle(network.username)}
      </span>
      {network.disabled ? (
        <span className="adm-creators-net-off" title="Rede desativada: os seguidores dela não entram no total">
          inativa
        </span>
      ) : null}
      <span className="adm-creators-net-n" title="Seguidores">
        {formatInt(network.followers)}
      </span>
    </li>
  );
}

/**
 * Redes do criador, uma por linha (ícone, @usuário, seguidores). UGC é um tipo de conteúdo e não uma rede social:
 * vira só a etiqueta "UGC", nunca uma linha de rede (mesmo que o servidor mande `ugc` junto das redes).
 */
export function NetworksCell({ creator }: { creator: AdminCreatorListItem }) {
  const networks = creator.networks.filter((network) => !isUgcType(network.type));
  const ugc = creator.has_ugc || networks.length !== creator.networks.length;

  if (networks.length === 0 && !ugc) return <span className="adm-muted">Sem redes</span>;
  return (
    <ul className="adm-creators-nets">
      {networks.map((network) => (
        <NetworkLine key={`${network.type}:${network.username}`} network={network} />
      ))}
      {ugc ? (
        <li>
          <span className="adm-creators-ugc" title="Também produz conteúdo UGC (não é uma rede social)">
            UGC
          </span>
        </li>
      ) : null}
    </ul>
  );
}

const MISSING_VISIBLE = 2;

/** "Faltam: …": os dois primeiros itens e, se houver mais, "+N itens" que abre a lista inteira no lugar. */
function MissingList({ items }: { items: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const hidden = items.length - MISSING_VISIBLE;
  const shown = open || hidden <= 0 ? items : items.slice(0, MISSING_VISIBLE);
  return (
    <p className="adm-creators-missing">
      <span>Faltam:</span> {shown.join(", ")}
      {hidden > 0 ? (
        <>
          {" "}
          <button type="button" className="adm-creators-more" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? "mostrar menos" : `+${hidden} ${hidden === 1 ? "item" : "itens"}`}
          </button>
        </>
      ) : null}
    </p>
  );
}

/** Etiqueta do estado do cadastro e o que falta. O rótulo é uma sugestão de atenção, não um erro (ver o "i" do cabeçalho). */
export function RegistrationCell({ creator }: { creator: AdminCreatorListItem }) {
  const { state, missing } = creator.registration;
  return (
    <div className="adm-creators-reg">
      <AdminStatusBadge
        kind="registration"
        value={state}
        label={state === "stub" ? EXTERNAL_ACCOUNT_LABEL : undefined}
        title={state === "stub" ? EXTERNAL_ACCOUNT_HELP : undefined}
      />
      {missing.length > 0 ? <MissingList items={missing} /> : null}
    </div>
  );
}

export function workspaceTarget(id: string): AdminLinkTarget {
  return { to: "/admin/workspaces/$workspaceId", params: { workspaceId: id } };
}

export function campaignTarget(id: string): AdminLinkTarget {
  return { to: "/admin/campaigns/$campaignId", params: { campaignId: id } };
}

/**
 * Primeira campanha em que o criador participou (campanha, workspace e dia). Não é um "workspace de origem": isso não
 * existe no banco, e o cabeçalho da coluna explica que é um dado derivado.
 */
export function FirstCampaignCell({ creator }: { creator: AdminCreatorListItem }) {
  const first = creator.first_campaign;
  if (!first) return <span className="adm-muted">Nunca participou</span>;
  return (
    <div className="adm-creators-first">
      <AdminLink to={campaignTarget(first.campaign.id)} className="adm-creators-first-title" title={first.campaign.title}>
        {first.campaign.title}
      </AdminLink>
      <small>
        <AdminLink to={workspaceTarget(first.workspace.id)} title={first.workspace.name}>
          {first.workspace.name}
        </AdminLink>
        {" · "}
        {formatDate(first.at)}
      </small>
    </div>
  );
}
