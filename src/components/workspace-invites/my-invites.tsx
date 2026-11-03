import { toast } from "sonner";

import { Icon } from "@/components/ui/icon";
import {
  useAcceptWorkspaceInvite,
  useDeclineWorkspaceInvite,
  useMyWorkspaceInvites,
} from "@/hooks/use-workspace-invites";
import type { MyWorkspaceInvite } from "@/shared/services/workspace-invites";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "vence hoje" / "vence amanhã" / "vence em 5 dias"; sem data válida, nada. */
export function expiryLabel(expiresAt: string, now: number = Date.now()): string {
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return "";
  const left = time - now;
  if (left < DAY_MS) return "vence hoje";
  if (left < 2 * DAY_MS) return "vence amanhã";
  return `vence em ${Math.ceil(left / DAY_MS)} dias`;
}

function errorText(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

function InviteRow({ invite, compact }: { invite: MyWorkspaceInvite; compact: boolean }) {
  const accept = useAcceptWorkspaceInvite();
  const decline = useDeclineWorkspaceInvite();
  const busy = accept.isPending || decline.isPending;
  const expiry = expiryLabel(invite.expiresAt);
  const detail = [
    invite.invitedByName ? `Convidado por ${invite.invitedByName}` : "Convite da marca",
    `como ${invite.roleLabel}`,
    expiry,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 ${compact ? "py-2" : "py-4"}`}>
      <span
        className="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-950 text-[15px] font-bold text-white"
        aria-hidden
      >
        {invite.workspaceName.trim().charAt(0).toUpperCase() || "M"}
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-neutral-950">{invite.workspaceName}</p>
        <p className="text-[13px] text-neutral-500">{detail}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={busy}
          aria-label={`Recusar convite de ${invite.workspaceName}`}
          onClick={() =>
            decline.mutate(invite.id, {
              onSuccess: () => toast.success("Convite recusado."),
              onError: (e) => toast.error(errorText(e, "Não foi possível recusar o convite.")),
            })
          }
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-neutral-100 px-5 text-sm font-bold text-neutral-950 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Recusar
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label={`Aceitar convite de ${invite.workspaceName}`}
          onClick={() =>
            accept.mutate(invite.id, {
              onSuccess: () => toast.success(`Você entrou em ${invite.workspaceName}.`),
              onError: (e) => toast.error(errorText(e, "Não foi possível aceitar o convite.")),
            })
          }
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="Check" size={16} color="currentColor" />
          Aceitar
        </button>
      </div>
    </li>
  );
}

/**
 * Convites para o time de uma marca, com aceitar e recusar. `compact` é a faixa discreta de quem já tem marca;
 * sem compact é o painel de quem ainda não tem nenhuma. Sem convites, não renderiza nada.
 */
export function MyInvitesPanel({ compact = false }: { compact?: boolean }) {
  const { data: invites = [] } = useMyWorkspaceInvites();
  if (invites.length === 0) return null;

  return (
    <section
      aria-label="Convites para você"
      className={`bg-white ${compact ? "mb-4 rounded-[22px] px-5 py-3" : "rounded-[28px] p-7"}`}
    >
      <h2 className={`font-semibold tracking-[-0.03em] text-neutral-950 ${compact ? "text-[15px]" : "text-[20px]"}`}>
        {invites.length === 1 ? "Você foi convidado(a) para uma marca" : `Você tem ${invites.length} convites de marcas`}
      </h2>
      <ul className="divide-y divide-neutral-100">
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} compact={compact} />
        ))}
      </ul>
    </section>
  );
}
