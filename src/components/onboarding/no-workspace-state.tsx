import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/contexts/auth-context";

import { Icon } from "@/components/ui/icon";
import { MyInvitesPanel } from "@/components/workspace-invites/my-invites";
import { SIGNUP_ENABLED } from "@/shared/constants/signup";
import { MY_INVITES_KEY } from "@/hooks/use-workspace-invites";

/**
 * Painel de quem ainda não faz parte de nenhuma marca: criar o perfil não obriga a criar uma marca (a pessoa pode
 * estar entrando numa que outra pessoa criou), então aqui ela escolhe.
 */
export function NoWorkspaceState() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-[760px] flex-col justify-center gap-8 px-2 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.04em] text-neutral-950">
          Bem-vindo(a) ao Hype{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="text-[15px] text-neutral-500">
          {SIGNUP_ENABLED
            ? "Seu perfil está pronto. Você ainda não faz parte de nenhuma marca: como quer começar?"
            : "Você ainda não faz parte de nenhuma marca. Peça um convite a quem administra a marca."}
        </p>
      </div>

      <MyInvitesPanel />

      <div className={`grid gap-4 ${SIGNUP_ENABLED ? "sm:grid-cols-2" : ""}`}>
        {SIGNUP_ENABLED ? (
        <section className="flex flex-col gap-4 rounded-[28px] bg-white p-7">
            <span className="grid size-12 place-items-center rounded-full bg-neutral-950 text-white" aria-hidden>
              <Icon name="Store" size={22} color="currentColor" />
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <h2 className="text-[20px] font-semibold tracking-[-0.03em]">Criar minha marca</h2>
              <p className="text-[14px] leading-relaxed text-neutral-500">
                Cadastre a sua marca para criar campanhas e encontrar os criadores certos.
              </p>
            </div>
            <Link
              to="/onboarding/create-workspace"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-bold text-white transition-colors hover:bg-primary-600"
            >
              Criar marca
              <Icon name="ArrowRight" size={16} color="currentColor" />
            </Link>
          </section>
        ) : null}
        <section className="flex flex-col gap-4 rounded-[28px] bg-white p-7">
          <span className="grid size-12 place-items-center rounded-full bg-primary-100 text-primary-700" aria-hidden>
            <Icon name="UserPlus" size={22} color="currentColor" />
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            <h2 className="text-[20px] font-semibold tracking-[-0.03em]">Entrar em uma marca</h2>
            <p className="text-[14px] leading-relaxed text-neutral-500">
              Peça a quem administra a marca para te convidar usando o e-mail{" "}
              <b className="break-words font-semibold text-neutral-950">{user?.email}</b>. O convite aparece aqui para
              você aceitar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["me-workspaces"] });
              void queryClient.invalidateQueries({ queryKey: MY_INVITES_KEY });
            }}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-neutral-100 px-6 text-sm font-bold text-neutral-950 transition-colors hover:bg-neutral-200"
          >
            <Icon name="RefreshCw" size={16} color="currentColor" />
            Verificar convites
          </button>
        </section>
      </div>
    </div>
  );
}
