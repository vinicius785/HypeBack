import { AdminSection } from "@/components/admin/platform";
import { formatHandle, isUgcType, networkIconName, networkLabel, networkProfileUrl } from "@/components/admin/creators/creator-labels";
import { I } from "@/components/prototype/ui";
import { useAdminCreatorNetworks } from "@/hooks/admin/use-admin-creators";
import { formatInt } from "@/lib/admin/format";
import type { AdminCreatorListItem, AdminUserDetail } from "@/shared/admin-platform.types";

import "@/styles/admin-users.css";

function NetworkRow({ network }: { network: AdminCreatorListItem["networks"][number] }) {
  const label = networkLabel(network.type);
  const handle = formatHandle(network.username);
  const href = networkProfileUrl(network.type, network.username);
  return (
    <li className="adm-users-net" data-disabled={network.disabled ? "true" : undefined}>
      <span className="adm-users-net-ico" role="img" aria-label={label} title={label}>
        <I n={networkIconName(network.type)} cls="sm" />
      </span>
      <span className="adm-users-net-id">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${handle} no ${label} (abre em outra aba)`}>
            {handle}
          </a>
        ) : (
          <span>{handle}</span>
        )}
        <small>{label}</small>
      </span>
      {network.disabled ? (
        <span className="adm-users-net-off" title="Rede desativada: os seguidores dela não entram no total">
          inativa
        </span>
      ) : null}
      <span className="adm-users-net-n" title="Seguidores">
        <b className="adm-num">{formatInt(network.followers)}</b>
        <small>seguidores</small>
      </span>
    </li>
  );
}

/**
 * Redes sociais conectadas pelo criador (ícone, @usuário com link para o perfil, seguidores e o total das ativas). Só
 * aparece para conta de criador. UGC é tipo de conteúdo, não rede: nunca vira linha.
 */
export function AdminUserNetworks({ user }: { user: AdminUserDetail }) {
  const { creator, isLoading, error, refetch } = useAdminCreatorNetworks(user);
  if (user.kind !== "creator") return null;

  const networks = creator?.networks.filter((network) => !isUgcType(network.type)) ?? [];
  return (
    <AdminSection
      title="Redes sociais"
      description={creator && networks.length > 0 ? `${formatInt(creator.followers_total)} seguidores nas redes ativas.` : "Redes que o criador conectou ao perfil."}
    >
      {isLoading ? (
        <p className="adm-muted" role="status">
          Carregando as redes…
        </p>
      ) : error ? (
        <p className="adm-muted" role="alert">
          Não foi possível carregar as redes.{" "}
          <button type="button" className="adm-textlink" onClick={refetch}>
            Tentar de novo
          </button>
        </p>
      ) : !creator ? (
        <p className="adm-muted">Perfil de criador não encontrado na lista de criadores.</p>
      ) : networks.length === 0 ? (
        <p className="adm-muted">Nenhuma rede social conectada.</p>
      ) : (
        <ul className="adm-users-nets" aria-label="Redes sociais conectadas">
          {networks.map((network) => (
            <NetworkRow key={`${network.type}:${network.username}`} network={network} />
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
