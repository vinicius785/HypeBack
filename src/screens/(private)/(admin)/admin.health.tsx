import { createFileRoute, redirect } from "@tanstack/react-router";

/** A Saúde da plataforma virou uma aba das Atividades: o endereço antigo (e links salvos) leva para lá. */
export const Route = createFileRoute("/(private)/(admin)/admin/health")({
  beforeLoad: ({ search }) => {
    const severity = (search as { severity?: string }).severity;
    throw redirect({ to: "/admin/activity", search: { tab: "health", ...(severity ? { severity } : {}) } as never, replace: true });
  },
});
