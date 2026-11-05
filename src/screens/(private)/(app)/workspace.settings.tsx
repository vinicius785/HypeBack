import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";

import { BrandTab, type BrandValues } from "@/components/workspace-settings/brand-tab";
import { CompanyTab, type CompanyValues } from "@/components/workspace-settings/company-tab";
import { AccountTypeCard } from "@/components/workspace-settings/account-type-card";
import { apiErr } from "@/components/workspace-settings/constants";
import { DangerTab } from "@/components/workspace-settings/danger-tab";
import { SettingsSection } from "@/components/workspace-settings/settings-section";
import { PageContainer, PageControls, PageHeader, PageTabs } from "@/components/page/page-kit";
import { DeleteModal } from "@/components/workspace-settings/delete-modal";
import { InviteModal, type InvitePayload } from "@/components/workspace-settings/invite-modal";
import { PermModal } from "@/components/workspace-settings/perm-modal";
import { TeamTab } from "@/components/workspace-settings/team-tab";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import {
  useInviteWorkspaceMember,
  useRemoveWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useWorkspaceMembersQuery,
} from "@/hooks/use-workspace-members";
import { useCancelWorkspaceInvite, useWorkspaceInvitesQuery } from "@/hooks/use-workspace-invites";
import { useAccountTypeRequests } from "@/hooks/use-account-type-requests";
import { useNiches } from "@/hooks/use-niches";
import { removeWorkspaceId, saveWorkspaceId } from "@/lib/utils/api";
import { getDeleteBlockers } from "@/lib/workspace-state/delete-blockers";
import { pickDefaultWorkspace } from "@/lib/workspace-state/workspace-list-cache";
import {
  deleteWorkspace,
  getMyWorkspaces,
  updateWorkspace,
  uploadWorkspacePhoto,
} from "@/shared/services/workspace";
import type { WorkspaceMember, WorkspaceRole } from "@/shared/types";

import "@/styles/prototype-workspace.css";

export const Route = createFileRoute("/(private)/(app)/workspace/settings")({
  component: WorkspaceSettingsScreen,
});

type Tab = "brand" | "team" | "adv";
const TAB_IDS: readonly Tab[] = ["brand", "team", "adv"];

const NON_PRIVILEGED: WorkspaceRole[] = ["member", "aprovador", "observador", "juridico", "financeiro", "analista"];

function WorkspaceSettingsScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedWorkspace, selectWorkspace } = useWorkspaceContext();
  const workspaceId = selectedWorkspace?.id;
  const perms = selectedWorkspace?.permissions;

  const { data: members = [], isLoading: loadingMembers, isError: membersError, refetch: refetchMembers } = useWorkspaceMembersQuery(workspaceId);
  const { data: niches = [] } = useNiches();
  const typeRequests = useAccountTypeRequests(workspaceId);

  // A aba fica no endereço (`?tab=equipe`): recarregar, voltar e compartilhar o link levam à mesma aba.
  const search = useSearch({ from: "/(private)/(app)/workspace/settings" }) as Record<string, string>;
  const [tab, setTabState] = useState<Tab>(() => (TAB_IDS as readonly string[]).includes(search?.tab) ? (search.tab as Tab) : "brand");
  const setTab = (t: Tab) => {
    setTabState(t);
    navigate({ search: t === "brand" ? {} : { tab: t }, replace: true } as never);
  };
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [forceNew, setForceNew] = useState(0);
  const [permMember, setPermMember] = useState<WorkspaceMember | null>(null);

  const canRead = perms?.workspace_read !== false;
  const canEditSettings = perms?.workspace_settings_write === true;
  const canPhoto = perms?.workspace_photo_write === true;
  const canListMembers = perms?.members_list === true;
  const canInvite = perms?.members_invite === true;
  const canRoleWrite = perms?.members_role_write === true;
  const canRemove = perms?.members_remove === true;
  const removeOnlyMember = perms?.members_remove_only_member_role === true;
  const canDeleteWs = perms?.workspace_delete === true;
  const isOwner = selectedWorkspace?.role === "owner";

  // Avançado reúne o tipo do workspace, os dados da empresa (só o proprietário) e a exclusão.
  const showAdv = canDeleteWs || isOwner || canEditSettings;
  const tabs: Array<[Tab, string]> = [["brand", "Marca"]];
  if (canListMembers) tabs.push(["team", "Equipe"]);
  if (showAdv) tabs.push(["adv", "Avançado"]);
  const active: Tab = tabs.some(([k]) => k === tab) ? tab : "brand";

  const syncWorkspaceFromServer = useCallback(async () => {
    if (!workspaceId) return;
    const list = await queryClient.fetchQuery({ queryKey: ["me-workspaces"], queryFn: getMyWorkspaces });
    const w = list.find((x) => x.id === workspaceId);
    if (w) selectWorkspace(w);
  }, [queryClient, workspaceId, selectWorkspace]);

  const updateMutation = useMutation({
    mutationFn: (values: BrandValues) => {
      if (!workspaceId) throw new Error("Sem workspace");
      return updateWorkspace(workspaceId, {
        name: values.name.trim(),
        description: values.description?.trim() === "" ? null : (values.description?.trim() ?? null),
        niche_id: values.niche_id && values.niche_id !== "" ? Number(values.niche_id) : null,
      });
    },
    onSuccess: async () => {
      toast.success("Dados do workspace atualizados.");
      await syncWorkspaceFromServer();
    },
    onError: (e) => toast.error(apiErr(e)),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => {
      if (!workspaceId) throw new Error("Sem workspace");
      return uploadWorkspacePhoto(workspaceId, file);
    },
    onSuccess: async () => {
      toast.success("Foto atualizada.");
      await syncWorkspaceFromServer();
    },
    onError: (e) => toast.error(apiErr(e)),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (values: CompanyValues) => {
      if (!workspaceId || !selectedWorkspace) throw new Error("Sem workspace");
      return updateWorkspace(workspaceId, {
        name: selectedWorkspace.name,
        legal_name: values.legalName || null,
        tax_id: values.taxId ? values.taxId.replace(/\D/g, "") : null,
        postal_code: values.postalCode ? values.postalCode.replace(/\D/g, "") : null,
        street: values.street || null,
        street_number: values.streetNumber || null,
        unit: values.unit || null,
        neighborhood: values.neighborhood || null,
        city: values.city || null,
        state: values.state || null,
      });
    },
    onSuccess: async () => {
      toast.success("Dados da empresa atualizados.");
      await syncWorkspaceFromServer();
    },
    onError: (e) => toast.error(apiErr(e)),
  });

  const inviteMutation = useInviteWorkspaceMember(workspaceId ?? "");
  const { data: pendingInvites = [] } = useWorkspaceInvitesQuery(workspaceId, canInvite);
  const cancelInviteMutation = useCancelWorkspaceInvite(workspaceId ?? "");
  const roleMutation = useUpdateWorkspaceMemberRole(workspaceId ?? "");
  const removeMutation = useRemoveWorkspaceMember(workspaceId ?? "");

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) throw new Error("Sem workspace");
      return deleteWorkspace(workspaceId);
    },
    onSuccess: async () => {
      toast.success("Workspace excluído.");
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["me-workspaces"] });
      const list = await queryClient.fetchQuery({ queryKey: ["me-workspaces"], queryFn: getMyWorkspaces });
      const next = pickDefaultWorkspace(list);
      if (next) {
        selectWorkspace(next);
        saveWorkspaceId(next.id);
        navigate({ to: "/" });
      } else {
        removeWorkspaceId();
        navigate({ to: "/onboarding/create-workspace" });
      }
    },
    onError: (e) => {
      // Impedimentos (saldo, cobrança pendente, campanha publicada...) aparecem dentro do diálogo, que continua
      // aberto: sem toast de erro por cima.
      if (getDeleteBlockers(e) !== null) return;
      toast.error(apiErr(e));
    },
  });
  const deleteBlockers = getDeleteBlockers(deleteMutation.error);
  const closeDelete = () => {
    setDeleteOpen(false);
    deleteMutation.reset();
  };

  const canRemoveMember = (m: WorkspaceMember) => {
    if (!canRemove) return false;
    if (removeOnlyMember) return NON_PRIVILEGED.includes(m.role);
    return true;
  };

  const submitInvite = (p: InvitePayload) => {
    inviteMutation.mutate(
      {
        email: p.email,
        role: p.role,
        ...(p.mode === "new" ? { name: p.name } : {}),
        permissions: p.permissions,
      },
      {
        onSuccess: (result) => {
          if (result.pending && result.created_account) {
            toast.success(
              "Convite enviado. A pessoa receberá um e-mail com o código de 6 dígitos para definir a senha e poderá aceitar o convite ao entrar.",
            );
          } else if (result.pending) {
            toast.success("Convite enviado. A pessoa entra na equipe quando aceitar, ao abrir o Hype.");
          } else if (result.created_account) {
            toast.success(
              "Conta criada. A pessoa receberá um e-mail com o código de 6 dígitos para definir a senha em Redefinir senha.",
            );
          } else {
            toast.success("Adicionado ao workspace. O usuário já tinha conta e receberá um e-mail avisando.");
          }
          setInviteOpen(false);
        },
        onError: (e) => {
          const st = (e as { status?: number }).status;
          const msg = (e as Error).message?.toLowerCase() ?? "";
          if (p.mode === "invite" && st === 400 && msg.includes("name")) {
            setForceNew((n) => n + 1);
            toast.error("Este e-mail não tem cadastro. Preencha o nome para criar uma conta.");
          } else {
            toast.error(apiErr(e));
          }
        },
      },
    );
  };

  if (!selectedWorkspace || !workspaceId) {
    return (
      <div className="pv">
        <div className="wrap" style={{ maxWidth: "none" }}>
          <div className="head fade">
            <div>
              <h1>Configurações</h1>
              <p>Selecione um workspace no topo da página para gerenciar.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="pv">
        <div className="wrap" style={{ maxWidth: "none" }}>
          <div className="head fade">
            <div>
              <h1>Configurações</h1>
              <p>Você não tem permissão para ver as configurações deste workspace.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ws = selectedWorkspace;

  // Todas as abas permitidas ficam montadas e só se alternam por `hidden`: o que foi digitado numa aba (ex.: o
  // formulário da Marca) não se perde ao olhar outra, e trocar de aba não refaz consultas.
  const teamPanel = (
    <TeamTab
      workspaceName={ws.name}
      members={members}
      loading={loadingMembers}
      error={membersError}
      onRetry={() => refetchMembers()}
      selfId={user?.id}
      canInvite={canInvite}
      canManagePermissions={canRoleWrite}
      canRemoveMember={canRemoveMember}
      removing={removeMutation.isPending}
      pendingInvites={pendingInvites}
      cancelingInvite={cancelInviteMutation.isPending}
      onCancelInvite={(invite) =>
        cancelInviteMutation.mutate(invite.id, {
          onSuccess: () => toast.success(`Convite para ${invite.email} cancelado.`),
          onError: (e) => toast.error(apiErr(e)),
        })
      }
      onInvite={() => setInviteOpen(true)}
      onEdit={setPermMember}
      onRemove={(m) =>
        removeMutation.mutate(m.user_id, {
          onSuccess: () => toast.success(`${m.name.split(" ")[0]} removido da equipe`),
          onError: (e) => toast.error(apiErr(e)),
        })
      }
    />
  );

  return (
    <div className="pv">
      <PageContainer>
        <PageHeader title="Configurações" subtitle="Gerencie a identidade, os acessos e as configurações do seu workspace." />
        <PageControls>
          <PageTabs
            ariaLabel="Seções das configurações"
            value={active}
            onChange={setTab}
            items={tabs.map(([id, label]) => ({ id, label, count: id === "team" && !loadingMembers ? members.length : undefined }))}
          />
        </PageControls>

        <div className="st-body">
          <div className="st-panel" hidden={active !== "brand"}>
            <BrandTab
              name={ws.name ?? ""}
              description={ws.description ?? ""}
              nicheId={ws.niche_id != null ? String(ws.niche_id) : ""}
              photo={ws.photo}
              niches={niches}
              canEdit={canEditSettings}
              canPhoto={canPhoto}
              saving={updateMutation.isPending}
              saved={updateMutation.isSuccess}
              saveError={updateMutation.isError ? apiErr(updateMutation.error) : null}
              photoPending={photoMutation.isPending}
              onSave={(v) => updateMutation.mutate(v)}
              onPhoto={(f) => photoMutation.mutate(f)}
            />
          </div>

          {canListMembers && (
            <div className="st-panel" hidden={active !== "team"}>
              {teamPanel}
            </div>
          )}

          {showAdv && (
            <div className="st-panel" hidden={active !== "adv"}>
              <SettingsSection id="st-type" title="Tipo de workspace" description="Define como o workspace opera no HypeApp: como marca ou como agência.">
                <AccountTypeCard
                  workspaceId={ws.id}
                  current={ws.account_type === "agency" ? "agency" : "brand"}
                  requests={typeRequests.data ?? []}
                  loading={typeRequests.isLoading}
                  error={typeRequests.isError}
                  canRequest={canEditSettings}
                  onRetry={() => void typeRequests.refetch()}
                />
              </SettingsSection>
              {isOwner && (
                <SettingsSection id="st-co" title="Dados da empresa" description="Usados em contratos e notas dos pagamentos. Visível apenas para o proprietário.">
                  <CompanyTab workspace={ws} saving={updateCompanyMutation.isPending} onSave={(v) => updateCompanyMutation.mutate(v)} />
                </SettingsSection>
              )}
              {canDeleteWs && (
                <SettingsSection id="st-del" title="Excluir workspace" description="Remove o workspace para você e para toda a equipe.">
                  <DangerTab name={ws.name} onDelete={() => setDeleteOpen(true)} />
                </SettingsSection>
              )}
            </div>
          )}
        </div>
      </PageContainer>

      {permMember && (
        <PermModal
          member={permMember}
          saving={roleMutation.isPending}
          onClose={() => setPermMember(null)}
          onSave={(role, permissions) =>
            roleMutation.mutate(
              { userId: permMember.user_id, role, permissions },
              {
                onSuccess: () => {
                  toast.success("Permissões atualizadas.");
                  setPermMember(null);
                },
                onError: (e) => toast.error(apiErr(e)),
              },
            )
          }
        />
      )}
      {inviteOpen && (
        <InviteModal
          pending={inviteMutation.isPending}
          canManagePermissions={canRoleWrite}
          forceNew={forceNew}
          onClose={() => setInviteOpen(false)}
          onSubmit={submitInvite}
        />
      )}
      {deleteOpen && (
        <DeleteModal
          name={ws.name}
          pending={deleteMutation.isPending}
          blockers={deleteBlockers}
          onClose={closeDelete}
          onConfirm={() => deleteMutation.mutate()}
        />
      )}
    </div>
  );
}
