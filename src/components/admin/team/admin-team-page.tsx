import { useState } from "react";

import {
  AdminBadge,
  AdminEntityCell,
  AdminErrorState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAdminCapabilities, useAdminPlatformTeam } from "@/hooks/admin/use-admin-team";
import type { AdminPlatformRoleInfo, AdminPlatformTeamMember } from "@/shared/admin-platform.types";

import { ADMIN_ONLY_TEXT, PERMISSION_TEXT, ROLE_FALLBACK_LABEL, ROLE_TONE } from "./team-labels";
import { AdminTeamRoleDialog, type TeamTarget } from "./team-role-dialog";

import "@/styles/admin-team.css";

/** Um cartão por papel: o que ele pode, e (nos que não são administrador) o que nunca pode. */
function RoleCard({ role, members }: { role: AdminPlatformRoleInfo; members: number }) {
  const isAdmin = role.role === "admin";
  return (
    <article className="adm-team-role" data-role={role.role}>
      <header>
        <AdminBadge tone={ROLE_TONE[role.role]}>{role.label}</AdminBadge>
        <span className="adm-team-count">
          {members} {members === 1 ? "pessoa" : "pessoas"}
        </span>
      </header>
      <p>{role.description}</p>
      <ul aria-label={`O que ${role.label} pode`}>
        {role.permissions.map((permission) => (
          <li key={permission} data-can="true">
            <I n="check" cls="sm" />
            {PERMISSION_TEXT[permission]}
          </li>
        ))}
        {isAdmin
          ? ADMIN_ONLY_TEXT.map((text) => (
              <li key={text} data-can="true">
                <I n="check" cls="sm" />
                {text}
              </li>
            ))
          : ADMIN_ONLY_TEXT.slice(0, 2).map((text) => (
              <li key={text} data-can="false">
                <I n="x" cls="sm" />
                {text}
              </li>
            ))}
      </ul>
    </article>
  );
}

/**
 * Equipe da plataforma: os três papéis (administrador, suporte e somente leitura), o que cada um pode, e quem
 * tem cada um. O administrador adiciona pessoas e troca papéis; os demais papéis só enxergam a lista.
 * Dados: `GET /admin/platform-team`; troca: `PATCH /admin/users/:userId/platform-role`.
 */
export function AdminTeamPage() {
  const query = useAdminPlatformTeam();
  const capabilities = useAdminCapabilities();
  const { user } = useAuth();
  const [dialog, setDialog] = useState<{ target?: TeamTarget } | null>(null);

  const team = query.data;
  const roles = team?.roles ?? [];
  const members = team?.members ?? [];
  const roleLabel = (role: AdminPlatformTeamMember["role"]) =>
    roles.find((entry) => entry.role === role)?.label ?? ROLE_FALLBACK_LABEL[role];

  const columns: AdminTableColumn<AdminPlatformTeamMember>[] = [
    {
      key: "person",
      header: "Pessoa",
      width: "minmax(0, 2fr)",
      cell: (member) => <AdminEntityCell name={member.name} subtitle={member.email} size={36} />,
    },
    {
      key: "role",
      header: "Papel",
      width: "minmax(0, 1fr)",
      cell: (member) => <AdminBadge tone={ROLE_TONE[member.role]}>{roleLabel(member.role)}</AdminBadge>,
    },
    {
      key: "status",
      header: "Situação",
      width: "150px",
      cell: (member) => <AdminStatusBadge kind="user" value={member.status} />,
    },
    {
      key: "actions",
      header: "",
      mobileLabel: "",
      width: "160px",
      align: "right",
      cell: (member) =>
        capabilities.isAdmin && member.user_id !== user?.id ? (
          <button
            type="button"
            className="btn out adm-btn-sm"
            onClick={() =>
              setDialog({ target: { id: member.user_id, name: member.name, email: member.email, role: member.role } })
            }
          >
            Alterar papel
          </button>
        ) : member.user_id === user?.id ? (
          <span className="adm-team-self">Você</span>
        ) : null,
    },
  ];

  if (query.isError && !team) {
    return (
      <AdminPage>
        <AdminPageHeader title="Equipe" subtitle="Quem tem acesso ao Admin da plataforma e o que cada pessoa pode fazer." />
        <AdminErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Equipe"
        subtitle="Quem tem acesso ao Admin da plataforma e o que cada pessoa pode fazer."
        actions={
          capabilities.isAdmin ? (
            <button type="button" className="btn" disabled={!team} onClick={() => setDialog({})}>
              <I n="plus" cls="sm" /> Adicionar pessoa
            </button>
          ) : undefined
        }
      />

      <AdminSection title="Papéis" description="Cada pessoa da equipe tem um papel. Só o administrador muda papéis.">
        <div className="adm-team-roles">
          {roles.map((role) => (
            <RoleCard key={role.role} role={role} members={members.filter((member) => member.role === role.role).length} />
          ))}
        </div>
      </AdminSection>

      <AdminSection flush title="Pessoas da equipe" description="Contas com algum papel no Admin, da mais antiga para a mais nova.">
        <AdminTable
          caption="Equipe da plataforma"
          columns={columns}
          rows={team ? members : undefined}
          rowKey={(member) => member.user_id}
          loading={query.isLoading}
          refreshing={query.isFetching && !query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
          empty={{
            title: "Ninguém na equipe ainda",
            description: capabilities.isAdmin ? "Use “Adicionar pessoa” para dar um papel a uma conta." : undefined,
          }}
        />
      </AdminSection>

      {dialog ? <AdminTeamRoleDialog target={dialog.target} roles={roles} onClose={() => setDialog(null)} /> : null}
    </AdminPage>
  );
}
