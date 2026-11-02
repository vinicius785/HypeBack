import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { I } from "@/components/prototype/ui";
import { useAdminItem, useAdminList } from "@/hooks/admin/use-admin-queries";
import { useDebounce } from "@/hooks/use-debounce";
import { adminPath, isAdminApiError } from "@/lib/admin/admin-client";
import { describeAdminError, isEndpointUnavailable } from "@/lib/admin/admin-errors";
import { formatInt } from "@/lib/admin/format";
import { WORKSPACE_STATUS_LABEL } from "@/lib/admin/labels";
import type {
  AdminWorkspaceDetail,
  AdminWorkspaceKind,
  AdminWorkspaceListItem,
  AdminWorkspaceRef,
} from "@/shared/admin-platform.types";

import "@/styles/admin-platform.css";
import "@/styles/admin-users.css";

export interface AdminWorkspacePickerProps {
  /** `public_id` do workspace escolhido (o da URL ou do filtro). Vazio ou ausente: nenhum. */
  value?: string | null;
  /** Escolha de um workspace, ou `null` quando a pessoa limpa o campo. Quem usa guarda só o `id`. */
  onChange: (workspace: AdminWorkspaceRef | null) => void;
  /** Que workspaces entram na busca (`kind` de `GET /admin/workspaces`). Padrão: `brand` (os clientes). */
  kind?: AdminWorkspaceKind | "all";
  /** Nome do campo: aparece ao lado do valor e é o nome acessível do combobox. */
  label?: string;
  /** Texto do campo quando nada está escolhido. */
  placeholder?: string;
  disabled?: boolean;
  /** Mostra o × que limpa a escolha (padrão: sim). */
  clearable?: boolean;
  /** Quantos resultados cada busca traz (padrão 10; o resto se alcança digitando mais). */
  limit?: number;
  /** Espera depois da última tecla antes de buscar (padrão 300 ms). */
  debounceMs?: number;
}

/**
 * Seletor de workspace com busca no servidor (combobox ARIA 1.2 com lista): digitar busca por nome do
 * workspace, nome ou e-mail do dono, id e CNPJ (`GET /admin/workspaces?search=`), com atraso para não consultar a
 * cada tecla. Mostra o workspace escolhido (mesmo quando só se conhece o id, como numa URL recarregada: o nome é
 * buscado) e pode ser limpo.
 *
 * Teclado: ↓ ↑ navegam (↓ abre a lista), Enter escolhe, Esc fecha, Tab sai. Mouse: clicar abre; clicar numa opção
 * escolhe. Estados: carregando, nenhum resultado, "mostrando N de M" e erro com "Tentar de novo" (inclusive a
 * rota que o servidor ainda não tem).
 *
 * É a peça compartilhada dos filtros por workspace das telas do Admin: o estado fica com quem usa (`value`/`onChange`).
 */
export function AdminWorkspacePicker({
  value,
  onChange,
  kind = "brand",
  label = "Workspace",
  placeholder = "Todos",
  disabled = false,
  clearable = true,
  limit = 10,
  debounceMs = 300,
}: AdminWorkspacePickerProps) {
  const selectedId = value ?? "";
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  // `editing`: a pessoa está digitando uma busca (o campo mostra o texto dela); senão mostra o workspace escolhido.
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [picked, setPicked] = useState<AdminWorkspaceRef | null>(null);

  const search = useDebounce(query, debounceMs).trim();
  const settling = query.trim() !== search;

  const list = useAdminList<AdminWorkspaceListItem>({
    resource: "workspaces",
    // Escopo próprio: a busca do seletor nunca se mistura com a lista de Workspaces (que tem outros parâmetros).
    scope: ["picker"],
    path: "/admin/workspaces",
    params: { search, kind, per_page: limit, sort_by: "name", order: "asc" },
    enabled: open && !disabled,
  });
  const options = list.data?.data ?? [];
  const total = list.data?.meta.total ?? options.length;
  const active = Math.min(highlight, Math.max(options.length - 1, 0));

  // O destaque volta ao primeiro resultado a cada busca nova.
  useEffect(() => {
    setHighlight(0);
  }, [search, kind, open]);

  // O workspace escolhido sem nome conhecido (id vindo da URL): busca o nome, uma vez, e guarda por um tempo.
  const knownName = picked && picked.id === selectedId ? picked.name : undefined;
  const lookup = useAdminItem<AdminWorkspaceDetail>({
    resource: "workspaces",
    id: selectedId || undefined,
    path: adminPath`/admin/workspaces/${selectedId}`,
    enabled: !!selectedId && !knownName,
    staleTime: 5 * 60_000,
  });
  const selectedLabel = !selectedId
    ? ""
    : (knownName ?? lookup.data?.name ?? (lookup.isError ? `Workspace ${selectedId.slice(0, 8)}…` : "Carregando…"));

  const close = () => {
    setOpen(false);
    setEditing(false);
    setQuery("");
  };

  const choose = (workspace: AdminWorkspaceListItem) => {
    const ref: AdminWorkspaceRef = { id: workspace.id, name: workspace.name };
    setPicked(ref);
    close();
    onChange(ref);
  };

  const clear = () => {
    // `picked` fica: enquanto quem usa ainda não atualizou o `value` (a URL muda um instante depois), o campo segue
    // mostrando o nome conhecido em vez de buscar o detalhe de novo e piscar "Carregando…".
    close();
    onChange(null);
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
      // Enter nunca envia o formulário em volta; escolhe só quando a lista está aberta com uma opção em foco.
      if (open) {
        event.preventDefault();
        const option = options[active];
        if (option) choose(option);
      }
    } else if (event.key === "Escape") {
      if (open) {
        // Fecha só a lista: um diálogo em volta não deve fechar junto.
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    } else if (event.key === "Tab") {
      // Tab sai do campo (para o × ou para fora): a lista fecha e o campo volta a mostrar o escolhido.
      close();
    }
  };

  const hasOptions = options.length > 0;
  const busy = open && (list.isFetching || settling);
  const unavailable = isEndpointUnavailable(list.error);
  const showError = open && list.isError && !hasOptions;
  const retryable = !isAdminApiError(list.error, "FORBIDDEN") && !isAdminApiError(list.error, "NOT_FOUND");

  // Uma linha de estado por vez, na ordem do que a pessoa precisa saber primeiro.
  let statusText = "";
  if (showError) statusText = "";
  else if (!list.data) statusText = "Carregando workspaces…";
  else if (busy) statusText = "Buscando…";
  else if (!hasOptions) statusText = search ? `Nenhum workspace encontrado para “${search}”.` : "Nenhum workspace encontrado.";
  else if (total > options.length) {
    statusText = `Mostrando ${formatInt(options.length)} de ${formatInt(total)}. Digite para refinar a busca.`;
  }

  return (
    <div
      ref={rootRef}
      className="adm-users-picker"
      data-active={selectedId ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      onBlur={(event) => {
        // O foco saiu do seletor inteiro (campo, × e "Tentar de novo" contam como dentro): fecha a lista.
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        close();
      }}
    >
      <div className="adm-users-picker-field">
        <span className="adm-users-picker-k" aria-hidden="true">
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
          disabled={disabled}
          placeholder={placeholder}
          value={editing ? query : selectedLabel}
          onChange={(event) => {
            setEditing(true);
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          // O texto do workspace escolhido já vem selecionado (ao focar e ao clicar): digitar substitui, em vez de
          // acrescentar. Durante uma busca o clique só posiciona o cursor.
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => {
            if (disabled) return;
            setOpen(true);
            if (!editing) event.currentTarget.select();
          }}
        />
        {clearable && selectedId && !disabled ? (
          <button type="button" className="adm-users-picker-clear" aria-label={`Limpar ${label.toLowerCase()}`} onClick={clear}>
            <I n="x" cls="sm" />
          </button>
        ) : (
          <span className="adm-users-picker-chev" aria-hidden="true">
            <I n="chev" cls="sm" />
          </span>
        )}
      </div>

      {open ? (
        // `mousedown` com preventDefault: clicar na lista não tira o foco do campo (o blur fecharia antes do clique).
        <div className="adm-users-picker-pop" onMouseDown={(event) => event.preventDefault()}>
          <ul id={listboxId} role="listbox" aria-label={label} className="adm-users-picker-list" hidden={!hasOptions}>
            {options.map((workspace, index) => {
              const selected = workspace.id === selectedId;
              const detail = [
                workspace.owner?.email,
                workspace.status !== "active" ? WORKSPACE_STATUS_LABEL[workspace.status] : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={workspace.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  className="adm-users-picker-opt"
                  data-active={index === active ? "true" : undefined}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(workspace)}
                >
                  <span className="adm-users-picker-opt-text">
                    <b>{workspace.name}</b>
                    {detail ? <small>{detail}</small> : null}
                  </span>
                  {selected ? <I n="check" cls="sm" /> : null}
                </li>
              );
            })}
          </ul>

          {showError ? (
            <div className="adm-users-picker-error" role="alert">
              <span>
                {unavailable ? "A busca de workspaces ainda não está disponível no servidor." : describeAdminError(list.error)}
              </span>
              {retryable ? (
                <button type="button" className="adm-textbtn" onClick={() => void list.refetch()}>
                  Tentar de novo
                </button>
              ) : null}
            </div>
          ) : null}

          {statusText ? (
            <p className="adm-users-picker-status" role="status">
              {statusText}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
