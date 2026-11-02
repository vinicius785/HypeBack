import { supportMailto } from "@/lib/workspace-state/support-contact";

/**
 * Aviso de conta suspensa nas telas de entrar e de criar conta (o servidor responde 403 ACCOUNT_SUSPENDED em
 * qualquer caminho que emite token). `message` é o texto do servidor ("Conta suspensa. Entre em contato com o
 * suporte."); o link leva ao suporte. Fica na tela, não num toast que some.
 *
 * Essas telas ficam sobre fundo escuro, e o layout (`(public)/_layout.tsx`) força cores nos descendentes do
 * formulário (`<p>` vira branco a 60%, `.text-neutral-*` e `div.bg-white` são trocados). Por isso o texto é um
 * `<strong>` (e não um `<p>`) e o fundo segue o dos campos: branco a 10%.
 */
export function AccountSuspendedNotice({ message }: { message: string }) {
  return (
    <div role="alert" className="flex flex-col gap-1.5 rounded-2xl bg-white/10 px-4 py-3.5">
      <strong className="text-[14.5px] font-semibold leading-snug text-white">{message}</strong>
      <a
        href={supportMailto("Conta suspensa")}
        className="w-fit text-[13.5px] font-semibold text-primary-300 hover:underline"
      >
        Falar com o suporte
      </a>
    </div>
  );
}
