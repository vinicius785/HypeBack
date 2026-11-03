import {
  AdminKeyValueList,
  AdminLink,
  AdminSection,
  type AdminKeyValueItem,
} from "@/components/admin/platform";
import { formatDateTime } from "@/lib/admin/format";
import type { AdminUserDetail } from "@/shared/admin-platform.types";

import { formatPhone } from "./admin-users-format";
import { userDetailLink } from "./admin-users-links";

import "@/styles/admin-users.css";

/** Clientes e agências não passam pela verificação de e-mail (só o cadastro de criadores a faz). */
const EMAIL_NOT_VERIFIED_BRAND_HINT =
  "A verificação de e-mail só é feita no cadastro de criadores; nesta conta, “Não” não indica problema.";

/**
 * Dados da conta (aba Resumo): telefone, se o e-mail foi verificado, documento mascarado, cadastro e identificador.
 * O e-mail não entra: já é o subtítulo do cabeçalho. Cada dado aparece uma vez só.
 */
export function AdminUserData({ user }: { user: AdminUserDetail }) {
  const items: AdminKeyValueItem[] = [
    { label: "Telefone", value: formatPhone(user.phone) },
    {
      label: "E-mail verificado",
      value: user.email_verified ? "Sim" : "Não",
      hint: !user.email_verified && user.kind !== "creator" ? EMAIL_NOT_VERIFIED_BRAND_HINT : undefined,
    },
    { label: "Documento", value: user.document_masked, hint: user.document_masked ? "Mascarado: só os 2 últimos dígitos." : undefined },
    { label: "Cadastrado em", value: formatDateTime(user.created_at) },
    { label: "Identificador", value: <span className="adm-num">{user.id}</span> },
  ];
  if (user.deleted_at) items.push({ label: "Excluída em", value: formatDateTime(user.deleted_at) });

  return (
    <AdminSection title="Dados da conta">
      <AdminKeyValueList items={items} columns={2} />
    </AdminSection>
  );
}

/** Bloco da suspensão: desde quando, o motivo e quem suspendeu. Só aparece para conta suspensa. */
export function AdminUserSuspension({ user }: { user: AdminUserDetail }) {
  if (user.status !== "suspended" && !user.suspension) return null;
  const suspension = user.suspension;
  const by = suspension?.suspended_by;
  return (
    <AdminSection title="Conta suspensa" description="A pessoa não consegue entrar enquanto a suspensão durar.">
      <AdminKeyValueList
        items={[
          { label: "Desde", value: suspension ? formatDateTime(suspension.suspended_at) : null },
          {
            label: "Suspensa por",
            value: by ? (
              <AdminLink to={userDetailLink(by.user_id)} textLink>
                {by.name}
              </AdminLink>
            ) : (
              "Não informado"
            ),
          },
          { label: "Motivo", value: suspension?.reason?.trim() ? suspension.reason : "Não informado" },
        ]}
      />
    </AdminSection>
  );
}
