import { useEffect, useRef, useState } from "react";

import { I } from "@/components/prototype/ui";

import "@/styles/admin-kit-refresh-button.css";

export interface AdminRefreshButtonProps {
  /** Refaz a consulta (`refetch()` / `invalidateQueries`). Não é chamado enquanto `loading`. */
  onClick: () => void;
  /** Atualizando: o ícone gira, o botão fica `aria-busy` e não aceita novo clique. */
  loading?: boolean;
  /** Nome da ação (padrão "Atualizar"). Com `iconOnly` vira o nome acessível e a dica do botão. */
  label?: string;
  /** Só o ícone (para o fim da barra de filtros). O texto continua como nome acessível. */
  iconOnly?: boolean;
  /** Anunciado quando começa a atualizar (padrão "Atualizando…"). */
  loadingLabel?: string;
  /** Anunciado quando termina (padrão "Atualizado"). */
  doneLabel?: string;
  /** Sem permissão ou sem o que atualizar: desabilitado de verdade (sai da ordem do teclado). */
  disabled?: boolean;
  /**
   * Anuncia "Atualizando…/Atualizado" por leitor de tela (padrão `true`). Use `false` quando a atualização também
   * roda sozinha (refetch por intervalo, como a Saúde a cada 60 s): senão o leitor repetiria o aviso sem que a
   * pessoa tenha pedido nada. O estado `aria-busy` do botão continua valendo.
   */
  announce?: boolean;
}

/**
 * Botão "Atualizar" do Admin (substitui as cópias de Atividades, Saúde, Financeiro, Comunidade e Notificações).
 *
 * Enquanto atualiza ele NÃO usa `disabled` nativo: um botão que se desabilita no próprio clique faz o foco do
 * teclado cair no `<body>`. Em vez disso fica `aria-disabled` (o clique é ignorado, o foco permanece) e
 * `aria-busy`. O texto visível não troca; quem usa leitor de tela ouve o início e o fim por uma região
 * `role="status"` que só tem texto depois da primeira mudança (nada é lido ao abrir a página). Com `announce={false}`
 * a região segue no DOM, mas nunca recebe texto.
 */
export function AdminRefreshButton({
  onClick,
  loading = false,
  label = "Atualizar",
  iconOnly = false,
  loadingLabel = "Atualizando…",
  doneLabel = "Atualizado",
  disabled = false,
  announce = true,
}: AdminRefreshButtonProps) {
  const [status, setStatus] = useState("");
  const previous = useRef(loading);
  // Montou já atualizando (primeira consulta da página): o fim dessa carga não é anunciado, ninguém pediu.
  const silentFirstEnd = useRef(loading);
  useEffect(() => {
    if (previous.current === loading) return;
    previous.current = loading;
    if (!loading && silentFirstEnd.current) {
      silentFirstEnd.current = false;
      return;
    }
    silentFirstEnd.current = false;
    if (announce) setStatus(loading ? loadingLabel : doneLabel);
  }, [loading, loadingLabel, doneLabel, announce]);

  return (
    <>
      <button
        type="button"
        className="btn out adm-refresh"
        data-icon-only={iconOnly ? "true" : undefined}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        aria-busy={loading ? true : undefined}
        aria-disabled={loading ? true : undefined}
        disabled={disabled}
        onClick={() => {
          if (!loading) onClick();
        }}
      >
        <I n="refresh" cls="sm" />
        {iconOnly ? null : label}
      </button>
      <span className="adm-sr" role="status">
        {announce ? status : ""}
      </span>
    </>
  );
}
