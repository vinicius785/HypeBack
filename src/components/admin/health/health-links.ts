import type { AdminLinkTarget } from "@/components/admin/platform";
import type { AdminAlert } from "@/shared/admin-platform.types";

export type AdminAlertSample = AdminAlert["samples"][number];

/**
 * Para onde leva um exemplo de alerta, pelo `type`/`id` do contrato. Só os que têm tela de detalhe (workspace,
 * usuário, campanha) viram link; cobrança, saque, transferência e lançamento não têm página própria e ficam como
 * texto (a "Ver todos" do alerta já leva à lista filtrada).
 */
export function sampleLink(sample: AdminAlertSample): AdminLinkTarget | undefined {
  const id = String(sample.id);
  switch (sample.type) {
    case "workspace":
      return { to: "/admin/workspaces/$workspaceId", params: { workspaceId: id } };
    case "user":
      return { to: "/admin/users/$userId", params: { userId: id } };
    case "campaign":
      return { to: "/admin/campaigns/$campaignId", params: { campaignId: id } };
    default:
      return undefined;
  }
}
