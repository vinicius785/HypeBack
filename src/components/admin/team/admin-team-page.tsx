import { useState } from "react";

import {
  AdminActionMenu,
  AdminBadge,
  AdminEntityCell,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSkeleton,
  AdminStatusBadge,
  AdminTable,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { PeopleIsland } from "@/components/admin/people/people-island";
import { I } from "@/components/prototype/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAdminCapabilities, useAdminPlatformTeam } from "@/hooks/admin/use-admin-team";
import type { AdminPlatformRoleInfo, AdminPlatformTeamMember } from "@/shared/admin-platform.types";

import { userDetailLink } from "../users/admin-users-links";
import { ADMIN_ONLY_TEXT, PERMISSION_TEXT, ROLE_FALLBACK_LABEL, ROLE_TONE } from "./team-labels";
import { StaffRecoveryDialogs, type StaffRecoveryTarget } from "./staff-recovery-dialogs";
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
 * Os três papéis, recolhidos: quem vem gerenciar acesso quer ver as pessoas primeiro. Enquanto a equipe carrega, o bloco
 * é um esqueleto da altura do bloco recolhido (a página não pula quando os papéis chegam); se a consulta falha e não há
 * papéis, o bloco não aparece (o erro é da tabela, inline).
 */
function RolesBlock({ loading, roles, members }: { loading: boolean; roles: readonly AdminPlatformRoleInfo[]; members: readonly AdminPlatformTeamMember[] }) {
  if (loading) {
    return (
      <AdminSection>
        {/* decorativo: quem usa leitor de tela já ouve o "Carregando…" da tabela, e uma segunda região repetiria o aviso */}
        <div className="adm-team-roles-skel" aria-hidden="true">
          <AdminSkeleton width={220} height={16} />
        </div>
      </AdminSection>
    );
  }
  if (roles.length === 0) return null;
  return (
    <AdminSection>
      <details className="adm-team-roles-more">
        <summary className="adm-summary">O que cada papel pode fazer</summary>
        <p className="adm-team-roles-note">Cada pessoa da equipe tem um papel. Só o administrador muda papéis.</p>
        <div className="adm-team-roles">
          {roles.map((role) => (
            <RoleCard key={role.role} role={role} members={members.filter((member) => member.role === role.role).length} />
          ))}
        </div>
      </details>
    </AdminSection>
  );
}

/**
 * Equipe da plataforma: as pessoas com acesso ao Admin (papel e status; a linha abre a conta) e, recolhido, o que
 * cada papel (administrador, suporte e somente leitura) pode fazer. O administrador adiciona pessoas e troca
 * papéis; os demais papéis só enxergam a lista.
 * Dados: `GET /admin/platform-team`; troca: `PATCH /admin/users/:userId/platform-role`.
 */
export function AdminTeamPage() {
  const query = useAdminPlatformTeam();
  const capabilities = useAdminCapabilities();
  const { user } = useAuth();
  const [dialog, setDialog] = useState<{ target?: TeamTarget } | null>(null);
  const [recovery, setRecovery] = useState<StaffRecoveryTarget | null>(null);

  const team = query.data;
  const roles = team?.roles ?? [];
  const members = team?.members ?? [];
  const roleLabel = (role: AdminPlatformTeamMember["role"]) =>
    roles.find((entry) => entry.role === role)?.label ?? ROLE_FALLBACK_LABEL[role];

  const changeRole = (member: AdminPlatformTeamMember) =>
    setDialog({ target: { id: member.user_id, name: member.name, email: member.email, role: member.role } });

  const columns: AdminTableColumn<AdminPlatformTeamMember>[] = [
    {
      key: "person",
      header: "Pessoa",
      width: "minmax(0, 2fr)",
      primary: true,
      cell: (member) => <AdminEntityCell name={member.name} photo={member.photo} subtitle={member.email} size={36} />,
    },
    {
      key: "role",
      header: "Papel",
      width: "minmax(0, 1fr)",
      cell: (member) => <AdminBadge tone={ROLE_TONE[member.role]}>{roleLabel(member.role)}</AdminBadge>,
    },
    {
      key: "status",
      header: "Status",
      width: "150px",
      cell: (member) => <AdminStatusBadge kind="user" value={member.status} />,
    },
    {
      key: "actions",
      header: "",
      headerLabel: "Ações",
      mobileLabel: "",
      width: "88px",
      align: "right",
      cell: (member) => {
        if (member.user_id === user?.id) return <span className="adm-team-self">Você</span>;
        if (!capabilities.isAdmin) return null;
        // Duas ações por pessoa, ambas só do administrador e nunca na própria linha: trocar o papel (tirar da equipe é uma
        // opção do próprio diálogo) e gerar o código com que o colega redefine a senha. Num menu "⋯", como nos membros do workspace.
        return (
          <AdminActionMenu
            iconOnly
            variant="ghost"
            label="Ações"
            ariaLabel={`Ações de ${member.name}`}
            items={[
              { id: "role", label: "Alterar papel", icon: "users", onSelect: () => changeRole(member) },
              {
                id: "recovery",
                label: "Gerar código de recuperação",
                icon: "lock",
                onSelect: () => setRecovery({ id: member.user_id, name: member.name, email: member.email }),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pessoas"
        subtitle="Quem acessa a plataforma: usuários, criadores, workspaces e a equipe do Admin, com o que cada pessoa pode fazer."
        actions={
          capabilities.isAdmin ? (
            <button type="button" className="btn" disabled={!team} onClick={() => setDialog({})}>
              <I n="plus" cls="sm" /> Adicionar pessoa
            </button>
          ) : undefined
        }
      />

      <PeopleIsland current="team" />

      <AdminSection flush title="Equipe da plataforma" description="Contas com algum papel no Admin, da mais antiga para a mais nova.">
        <AdminTable
          caption="Equipe da plataforma"
          columns={columns}
          rows={team ? members : undefined}
          rowKey={(member) => member.user_id}
          rowLink={(member) => userDetailLink(member.user_id)}
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

      <RolesBlock loading={query.isLoading} roles={roles} members={members} />

      {dialog ? <AdminTeamRoleDialog target={dialog.target} roles={roles} onClose={() => setDialog(null)} /> : null}
      <StaffRecoveryDialogs target={recovery} onClose={() => setRecovery(null)} />
    </AdminPage>
  );
}
