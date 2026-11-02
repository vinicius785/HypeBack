import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { I } from "@/components/prototype/ui";
import { useAdminItem, useAdminList } from "@/hooks/admin/use-admin-queries";
import { useDebounce } from "@/hooks/use-debounce";
import { adminPath, isAdminApiError } from "@/lib/admin/admin-client";
import { describeAdminError, isEndpointUnavailable } from "@/lib/admin/admin-errors";
import { formatInt } from "@/lib/admin/format";
import { USER_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminUserDetail, AdminUserListItem } from "@/shared/admin-platform.types";

import "@/styles/admin-platform.css";
import "@/styles/admin-activity.css";

interface AuditActorPickerProps {
  /** Id do usuário escolhido, como texto (o da URL). Vazio: ninguém. */
  value: string;
  /** Escolha de alguém (`id` como texto) ou `''` quando a pessoa limpa o campo. */
  onChange: (userId: string) => void;
  label?: string;
  placeholder?: string;
  /** Quantos resultados cada busca traz. */
  limit?: number;
  debounceMs?: number;
}

/**
 * Filtro "Autor" das alterações administrativas: busca de usuários no servidor (`GET /admin/users?search=`,
 * por nome ou e-mail). Quem fez a alteração é sempre alguém do time da plataforma ou o proprietário que excluiu o
 * próprio workspace, e todos estão na lista de usuários; o resultado marca quem é administrador da plataforma.
 *
 * Combobox ARIA com lista: ↓ ↑ navegam, Enter escolhe, Esc fecha. O escolhido aparece pelo nome (buscado quando
 * só se conhece o id, como numa URL recarregada) e pode ser limpo.
 */
export function AuditActorPicker({
  value,
  onChange,
  label = "Autor",
  placeholder = "Qualquer pessoa",
  limit = 8,
  debounceMs = 300,
}: AuditActorPickerProps) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const search = useDebounce(query, debounceMs).trim();
  const settling = query.trim() !== search;

  const list = useAdminList<AdminUserListItem>({
    resource: "users",
    // Escopo próprio: a busca do filtro nunca se mistura com a lista de Usuários (que tem outros parâmetros).
    scope: ["actor-picker"],
    path: "/admin/users",
    params: { search, kind: "brand", status: "all", per_page: limit, sort_by: "name", order: "asc" },
    enabled: open,
  });
  const options = list.data?.data ?? [];
  const total = list.data?.meta.total ?? options.length;
  const active = Math.min(highlight, Math.max(options.length - 1, 0));

  useEffect(() => {
    setHighlight(0);
  }, [search, open]);

  const knownName = picked && picked.id === value ? picked.name : undefined;
  const lookup = useAdminItem<AdminUserDetail>({
    resource: "users",
    id: value || undefined,
    path: adminPath`/admin/users/${value}`,
    enabled: !!value && !knownName,
    staleTime: 5 * 60_000,
  });
  const selectedLabel = !value ? "" : (knownName ?? lookup.data?.name ?? (lookup.isError ? `Usuário ${value}` : "Carregando…"));

  const close = () => {
    setOpen(false);
    setEditing(false);
    setQuery("");
  };

  const choose = (user: AdminUserListItem) => {
    setPicked({ id: String(user.id), name: user.name });
    close();
    onChange(String(user.id));
  };

  const clear = () => {
    setPicked(null);
    close();
    onChange("");
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (options.length === 0) return;
      setHighlight(event.key === "ArrowDown" ? Math.min(active + 1, options.length - 1) : Math.max(active - 1, 0));
    } else if (event.key === "Enter") {
      if (open) {
        event.preventDefault();
        const option = options[active];
        if (option) choose(option);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const hasOptions = options.length > 0;
  const busy = open && (list.isFetching || settling);
  const showError = open && list.isError && !hasOptions;
  const retryable = !isAdminApiError(list.error, "FORBIDDEN") && !isAdminApiError(list.error, "NOT_FOUND");

  let statusText = "";
  if (showError) statusText = "";
  else if (!list.data) statusText = "Carregando usuários…";
  else if (busy) statusText = "Buscando…";
  else if (!hasOptions) statusText = search ? `Nenhum usuário encontrado para “${search}”.` : "Nenhum usuário encontrado.";
  else if (total > options.length) statusText = `Mostrando ${formatInt(options.length)} de ${formatInt(total)}. Digite para refinar a busca.`;

  return (
    <div ref={rootRef} className="adm-act-actor" data-active={value ? "true" : undefined}>
      <div className="adm-act-actor-field">
        <span className="adm-act-actor-k" aria-hidden="true">
          {label}:
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && hasOptions ? optionId(active) : undefined}
          aria-busy={busy ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={editing ? query : selectedLabel}
          onChange={(event) => {
            setEditing(true);
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={(event) => event.currentTarget.select()}
          onClick={() => setOpen(true)}
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && rootRef.current?.contains(next)) return;
            close();
          }}
        />
        {value ? (
          <button type="button" className="adm-act-actor-clear" aria-label={`Limpar ${label.toLowerCase()}`} onClick={clear}>
            <I n="x" cls="sm" />
          </button>
        ) : (
          <span className="adm-act-actor-chev" aria-hidden="true">
            <I n="chev" cls="sm" />
          </span>
        )}
      </div>

      {open ? (
        <div className="adm-act-actor-pop" onMouseDown={(event) => event.preventDefault()}>
          <ul id={listboxId} role="listbox" aria-label={label} className="adm-act-actor-list" hidden={!hasOptions}>
            {options.map((user, index) => {
              const selected = String(user.id) === value;
              const detail = [user.email, user.is_platform_admin ? "Administrador da plataforma" : USER_KIND_LABEL[user.kind]]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={user.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  className="adm-act-actor-opt"
                  data-active={index === active ? "true" : undefined}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(user)}
                >
                  <span className="adm-act-actor-opt-text">
                    <b>{user.name}</b>
                    {detail ? <small>{detail}</small> : null}
                  </span>
                  {selected ? <I n="check" cls="sm" /> : null}
                </li>
              );
            })}
          </ul>

          {showError ? (
            <div className="adm-act-actor-error" role="alert">
              <span>{isEndpointUnavailable(list.error) ? "A busca de usuários ainda não está disponível no servidor." : describeAdminError(list.error)}</span>
              {retryable ? (
                <button type="button" className="adm-textbtn" onClick={() => void list.refetch()}>
                  Tentar de novo
                </button>
              ) : null}
            </div>
          ) : null}

          {statusText ? (
            <p className="adm-act-actor-status" role="status">
              {statusText}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
