import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * O Elenco virou um recorte de Criadores ("No elenco" e "Convites"). A rota continua existindo só para os links e
 * favoritos antigos: leva para o recorte certo, sem perder a página.
 */
export const Route = createFileRoute("/(private)/(app)/roster")({
  beforeLoad: () => {
    throw redirect({ to: "/creators", search: { tab: "roster" } as never, replace: true });
  },
});
