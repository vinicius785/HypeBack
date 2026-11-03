import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminAvatar, AdminBadge, AdminConfirmDialog, type AdminConfirmValues } from "@/components/admin/platform";
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

/** Sem digitar nada, a busca não vai ao servidor: o mínimo para a lista de contas fazer sentido. */
export const TEAM_SEARCH_MIN = 2;

/** Atraso (ms) entre a última tecla e a busca de contas. */
const SEARCH_DEBOUNCE_MS = 300;

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

/** Escolha da conta que vai entrar na equipe: busca por nome ou e-mail entre as contas de marca ativas. */
function AccountPicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: TeamTarget | null;
  onSelect: (target: TeamTarget | null) => void;
  disabled: boolean;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const searching = term.length >= TEAM_SEARCH_MIN;
  // Sem termo a lista nem sai: sem busca ela devolveria "todo mundo", que não é o que a pessoa pediu.
  const results = useAdminUsers(
    { search: searching ? term : undefined, kind: "brand", status: "active", per_page: 6 },
    { enabled: searching },
  );
  const items = searching ? (results.data?.data ?? []) : [];

  if (selected) {
    return (
      <div className="adm-team-picked">
        <AdminAvatar name={selected.name} size={36} />
        <span>
          <b>{selected.name}</b>
          <small>{selected.email}</small>
        </span>
        <button type="button" className="btn out adm-btn-sm" disabled={disabled} onClick={() => onSelect(null)}>
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="adm-field">
      <label htmlFor={inputId}>Conta</label>
      <input
        id={inputId}
        type="search"
        className="adm-input"
        value={text}
        autoComplete="off"
        placeholder="Busque por nome ou e-mail"
        readOnly={disabled}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="adm-team-results" role="listbox" aria-label="Contas encontradas">
        {!searching ? (
          <p className="adm-team-hint">Digite pelo menos {TEAM_SEARCH_MIN} letras para buscar.</p>
        ) : results.isLoading ? (
          <p className="adm-team-hint" role="status">
            Buscando…
          </p>
        ) : items.length === 0 ? (
          <p className="adm-team-hint">Nenhuma conta ativa encontrada. Só contas de marca ativas podem entrar na equipe.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={false}
              className="adm-team-result"
              onClick={() => onSelect({ id: item.id, name: item.name, email: item.email, role: null })}
            >
              <AdminAvatar name={item.name} photo={item.photo} size={32} />
              <span>
                <b>{item.name}</b>
                <small>{item.email}</small>
              </span>
              {item.is_platform_admin ? <AdminBadge tone="brand" size="sm">Administrador</AdminBadge> : null}
            </button>
          ))
        )}
      </div>
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
  const [account, setAccount] = useState<TeamTarget | null>(target ?? null);
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
          toast.success(role === null ? "Pessoa tirada da equipe." : `Papel definido: ${label(role)}.`);
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
