import { createFileRoute, redirect } from "@tanstack/react-router";

/** As Solicitações viraram uma fila do Atendimento: o endereço antigo (e links salvos) leva para lá. */
export const Route = createFileRoute("/(private)/(admin)/admin/account-requests")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/support", search: { fila: "requests" } as never, replace: true });
  },
});
