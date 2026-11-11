import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * O "Redefinir com código" da equipe agora é o mesmo "Esqueci a senha" de todo mundo (o código de admin é aceito na tela de
 * redefinição). O endereço continua existindo só para os links salvos: leva ao começo do fluxo.
 */
export const Route = createFileRoute("/(public)/staff-reset-password")({
  beforeLoad: () => {
    throw redirect({ to: "/forgot-password", replace: true });
  },
});
