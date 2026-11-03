import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  AdminBadge,
  AdminConfirmDialog,
  AdminEntityPicker,
  adminToast,
  type AdminConfirmValues,
  type AdminEntityPickerSearchResult,
} from "@/components/admin/platform";
import { adminKeys } from "@/hooks/admin/admin-query-keys";
import { ADMIN_TEAM_RESOURCE, useAdminSetPlatformRole } from "@/hooks/admin/use-admin-team";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import type { AdminPlatformRole, AdminPlatformRoleInfo } from "@/shared/admin-platform.types";

import { describeTeamError, ROLE_FALLBACK_LABEL, ROLE_TONE, teamErrorOutdatesScreen } from "./team-labels";

import "@/styles/admin-team.css";

/** A conta que vai receber (ou perder) o papel. */
export interface TeamTarget {
  id: number;
  name: string;
  email: string;
  /** `null` = ainda não é da equipe. */
  role: AdminPlatformRole | null;
}

/** Mínimo de letras da busca de contas: o do seletor (`minChars`) e o do `enabled` da consulta são este mesmo número. */
export const TEAM_SEARCH_MIN = 2;

/** Atraso (ms) entre a última tecla e a busca de contas. */
const SEARCH_DEBOUNCE_MS = 300;

/** A conta como o seletor a guarda: o que o diálogo precisa (`TeamTarget`) e o que a lista mostra de cada resultado. */
type TeamAccount = TeamTarget & { isPlatformAdmin?: boolean };

function RoleChoices({
  roles,
  value,
  current,
  disabled,
  onChange,
}: {
  roles: readonly AdminPlatformRoleInfo[];
  value: AdminPlatformRole | null | undefined;
  current: AdminPlatformRole | null;
  disabled: boolean;
  onChange: (role: AdminPlatformRole | null) => void;
}) {
  const name = useId();
  return (
    <fieldset className="adm-team-choices" disabled={disabled}>
      <legend>Papel na equipe</legend>
      {roles.map((role) => (
        <label key={role.role} className="adm-team-choice" data-checked={value === role.role ? "true" : undefined}>
          <input
            type="radio"
            name={name}
            checked={value === role.role}
            onChange={() => onChange(role.role)}
          />
          <span>
            <b>
              {role.label}
              {current === role.role ? <em> · papel atual</em> : null}
            </b>
            <small>{role.description}</small>
          </span>
        </label>
      ))}
      {current !== null ? (
        <label className="adm-team-choice" data-danger="true" data-checked={value === null ? "true" : undefined}>
          <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} />
          <span>
            <b>Tirar da equipe</b>
            <small>A conta continua existindo, mas perde o acesso ao Admin.</small>
          </span>
        </label>
      ) : null}
    </fieldset>
  );
}

/**
 * Busca de contas do seletor (`AdminEntityPicker`). Nasce fora do render: o seletor a chama como hook e pede sempre a
 * mesma função. Sem o mínimo de letras a consulta nem sai (o seletor mostra a dica "Digite pelo menos N letras"): sem
 * busca ela devolveria "todo mundo", que não é o que a pessoa pediu.
 */
function useTeamAccountSearch(term: string): AdminEntityPickerSearchResult<TeamAccount> {
  const searching = term.length >= TEAM_SEARCH_MIN;
  const results = useAdminUsers(
    { search: searching ? term : undefined, kind: "brand", status: "active", per_page: 6 },
    { enabled: searching },
  );
  return {
    data: searching
      ? results.data?.data.map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          role: null,
          isPlatformAdmin: item.is_platform_admin,
        }))
      : undefined,
    isLoading: results.isLoading,
    isFetching: results.isFetching,
    isError: results.isError,
    total: results.data?.meta.total,
    error: results.error,
    retry: () => void results.refetch(),
  };
}

/**
 * Escolha da conta que vai entrar na equipe: busca por nome ou e-mail entre as contas de marca ativas. O seletor do
 * kit cuida do resto: `minChars` mostra "Digite pelo menos N letras" no lugar do vazio e `required` tira o "Todos" e o
 * × (a pílula diz "Escolha…", nunca "Todos").
 */
function AccountPicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: TeamAccount | null;
  onSelect: (account: TeamAccount | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="adm-field">
      <AdminEntityPicker<TeamAccount>
        label="Conta"
        placeholder="Nome ou e-mail"
        emptyTitle="Nenhuma conta ativa encontrada"
        required
        minChars={TEAM_SEARCH_MIN}
        value={selected}
        onChange={onSelect}
        search={useTeamAccountSearch}
        getKey={(item) => item.id}
        getLabel={(item) => item.name}
        renderOption={(item) => (
          <>
            <b>{item.name}</b>
            <small>
              {item.email}
              {item.isPlatformAdmin ? " · Administrador da plataforma" : ""}
            </small>
          </>
        )}
        debounceMs={SEARCH_DEBOUNCE_MS}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Dá, troca ou tira o papel de uma conta na equipe da plataforma. Com `target`, edita aquela conta; sem ele,
 * é o fluxo "Adicionar pessoa": a própria janela traz a busca da conta. Um só diálogo (motivo obrigatório, erro
 * do servidor dentro dele), e a confirmação só habilita com conta e papel escolhidos e diferentes do atual.
 */
export function AdminTeamRoleDialog({
  target,
  roles,
  onClose,
}: {
  target?: TeamTarget;
  roles: readonly AdminPlatformRoleInfo[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<TeamAccount | null>(target ?? null);
  const [role, setRole] = useState<AdminPlatformRole | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const mutation = useAdminSetPlatformRole(account?.id ?? 0);

  const removing = role === null;
  const unchanged = role === undefined || (account !== null && role === account.role);
  const label = (value: AdminPlatformRole) => roles.find((entry) => entry.role === value)?.label ?? ROLE_FALLBACK_LABEL[value];

  const confirm = ({ reason }: AdminConfirmValues) => {
    if (!account || role === undefined) return;
    setError(null);
    mutation.mutate(
      { role, reason },
      {
        onSuccess: () => {
          adminToast.success(role === null ? "Pessoa tirada da equipe." : `Papel definido: ${label(role)}.`);
          onClose();
        },
        onError: (failure) => {
          setError(describeTeamError(failure));
          if (teamErrorOutdatesScreen(failure)) {
            void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_TEAM_RESOURCE) });
          }
        },
      },
    );
  };

  return (
    <AdminConfirmDialog
      open
      eyebrow={account ? `Equipe · ${account.email}` : "Equipe da plataforma"}
      title={target ? `Papel de ${target.name}` : "Adicionar pessoa à equipe"}
      description={
        target
          ? "A mudança vale na hora, sem a pessoa precisar sair e entrar de novo."
          : "Escolha uma conta de marca ativa e o que ela pode fazer no Admin."
      }
      tone={removing ? "danger" : "neutral"}
      confirmLabel={removing ? "Tirar da equipe" : "Salvar papel"}
      pendingLabel="Salvando…"
      pending={mutation.isPending}
      confirmDisabled={!account || unchanged}
      error={error}
      dirty={!!account && !target}
      onConfirm={confirm}
      onClose={onClose}
    >
      {!target ? <AccountPicker selected={account} onSelect={setAccount} disabled={mutation.isPending} /> : null}
      {account ? (
        <RoleChoices roles={roles} value={role} current={account.role} disabled={mutation.isPending} onChange={setRole} />
      ) : null}
      {account && role !== undefined && role !== null ? (
        <p className="adm-team-summary">
          <AdminBadge tone={ROLE_TONE[role]}>{label(role)}</AdminBadge>
        </p>
      ) : null}
    </AdminConfirmDialog>
  );
}
