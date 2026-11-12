import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";

import { AdminIsland, AdminIslandStat } from "@/components/admin/platform";
import { PLATFORM_SECTION_GROUPS } from "@/components/navigation/nav-config";
import { I } from "@/components/prototype/ui";
import { useAdminUsers } from "@/hooks/admin/use-admin-users";
import { ACTIVITY_PAGE, useUsersActivity } from "@/hooks/admin/use-users-activity";
import { useAdminWorkspaceList } from "@/hooks/admin/use-admin-workspaces";
import { civilDateInSaoPaulo, formatInt } from "@/lib/admin/format";

import "@/styles/admin-people.css";

export type PeopleSection = "users" | "creators" | "workspaces";

const n = (value: number | undefined) => (value === undefined ? "—" : formatInt(value));

/** Total de uma consulta de 1 item: o servidor manda `meta.total`, então uma página mínima basta. */
const ONE = { page: 1, per_page: 1 } as const;

const LIVE_REFRESH_MS = 30_000;

/** "Excluídas hoje" (só em Criadores): a lixeira que cai (vermelha quando houve exclusão, apagada quando não houve). */
function DeletedStat({ total }: { total: number | undefined }) {
  return (
    <AdminIslandStat
      icon={<I n="trash" cls="sm" />}
      anim="drop"
      tone={total ? "bad" : undefined}
      value={n(total)}
      label="Excluídas hoje"
      hint="Contas excluídas hoje (horário de São Paulo), inclusive as que a própria pessoa apagou"
    />
  );
}

/** O "gráfico de confiança" da tabela em miniatura (cinco barras): é o ícone dos alertas, para falar a mesma língua da coluna. */
function MiniTrust() {
  return (
    <span className="isl-mini-trust">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** Usuários: quantos tiveram sessão hoje e quantos estão online agora (sessão nos últimos 5 minutos). */
function UsersLive() {
  const { activeToday, online, capped } = useUsersActivity();
  const show = (count: number | null) => (count === null ? "—" : capped && count >= ACTIVITY_PAGE ? `${ACTIVITY_PAGE}+` : formatInt(count));
  return (
    <div className="isl-live" role="group" aria-label="Agora">
      <AdminIslandStat icon={<I n="users" cls="sm" />} anim="bob" value={show(activeToday)} label="Ativos hoje" hint="Usuários com sessão aberta hoje (horário de São Paulo)" />
      <AdminIslandStat icon={<I n="eye" cls="sm" />} anim="radar" tone={online ? "ok" : undefined} value={show(online)} label="Online agora" hint="Sessão aberta nos últimos 5 minutos" />
    </div>
  );
}

/** Criadores: quantos entraram hoje e quantos têm alerta de confiança (nível 1 ou 2). */
function CreatorsLive() {
  const today = civilDateInSaoPaulo();
  const base = { ...ONE, kind: "creator" } as const;
  const novos = useAdminUsers({ ...base, status: "active,suspended,pending", created_from: today, created_to: today }, { refetchInterval: LIVE_REFRESH_MS });
  // A primeira consulta por confiança pode levar alguns segundos (a API calcula e guarda as notas): o número aparece quando chega.
  const alertas = useAdminUsers({ ...base, status: "active,suspended", trust_max: 2 }, { refetchInterval: 5 * LIVE_REFRESH_MS });
  const alertCount = alertas.data?.meta.total;
  const excluidas = useAdminUsers({ ...base, status: "deleted", deleted_from: today, deleted_to: today }, { refetchInterval: 2 * LIVE_REFRESH_MS });
  return (
    <div className="isl-live" role="group" aria-label="Agora">
      <AdminIslandStat icon={<I n="arrup" cls="sm" />} anim="rise" tone="ok" value={n(novos.data?.meta.total)} label="Novos hoje" hint="Criadores que entraram hoje (horário de São Paulo)" />
      <DeletedStat total={excluidas.data?.meta.total} />
      <AdminIslandStat
        icon={<MiniTrust />}
        anim="alarm"
        tone={alertCount ? "warn" : alertCount === 0 ? "ok" : undefined}
        value={n(alertCount)}
        label="Alertas de confiança"
        hint="Criadores com confiança nível 1 ou 2 (suspeitos de bot)"
      />
    </div>
  );
}

/**
 * Pílula de navegação. Usuários e Criadores são a mesma rota (só muda o `kind`), e o `Link` do roteador marcaria os dois
 * como a página atual; aqui quem decide é `on`. Clique comum navega pelo roteador; com Ctrl/Cmd/Shift ou botão do meio
 * o navegador abre o endereço (`href`) como num link normal.
 */
function PillLink({ to, search, on, children }: { to: string; search?: Record<string, string>; on: boolean; children: ReactNode }) {
  const router = useRouter();
  const href = router.buildLocation({ to, search } as never).href;
  return (
    <a
      href={href}
      className="isl-seg"
      aria-current={on ? "page" : undefined}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void router.navigate({ to, search } as never);
      }}
    >
      {children}
    </a>
  );
}

/**
 * "Ilha" (padrão Dynamic Island do Gerenciamento) de Pessoas: a única navegação entre Usuários, Criadores e Workspaces
 * (cada pílula é um link e leva a contagem da lista). Embaixo das pílulas, `children` é a barra da lista (busca, ordenar,
 * filtros e atualizar), que mora dentro da ilha. À direita, "Em cadastro" com bolinhas pulsando enquanto houver conta que ainda
 * não terminou o cadastro (leva direto à lista filtrada). A seta abre uma folha com o que merece olhar: suspensos,
 * suspeitos de bot (confiança 1–2) e workspaces suspensos ou arquivados; essas contagens só são pedidas ao abrir.
 */
/**
 * Quando a ilha sai de uma aba e entra na outra, a página inteira é montada de novo. A animação de entrada (que sobe e
 * desfoca) só vale na primeira vez que a pessoa chega em Pessoas; ao trocar de aba ela fica parada, senão a ilha pisca.
 */
let mountedIslands = 0;
let leftPeopleAt = 0;
const STILL_WINDOW_MS = 1500;

export function PeopleIsland({ current, children }: { current: PeopleSection; children?: ReactNode }) {
  // Ao trocar de aba o React monta a ilha nova ANTES de desmontar a antiga: por isso conta também a que ainda está montada.
  const [still] = useState(() => mountedIslands > 0 || Date.now() - leftPeopleAt < STILL_WINDOW_MS);
  useEffect(() => {
    mountedIslands += 1;
    return () => {
      mountedIslands -= 1;
      leftPeopleAt = Date.now();
    };
  }, []);
  const [open, setOpen] = useState(false);

  // Sempre à vista: as contagens das pílulas e a de contas em cadastro.
  const users = useAdminUsers({ ...ONE, status: "active,suspended" });
  // A aba Criadores é a lista de usuários só com criadores (tipo fixo, não é filtro): a contagem é a dos criadores ATIVOS (`kind=creator`, `status=active`), a mesma do Dashboard.
  const creators = useAdminUsers({ ...ONE, status: "active", kind: "creator" });
  const workspaces = useAdminWorkspaceList({ ...ONE });

  // Só ao abrir a folha (a de suspeitos pode demorar na primeira vez: a API calcula e guarda as notas).
  const suspended = useAdminUsers({ ...ONE, status: "suspended" }, { enabled: open });
  const suspects = useAdminUsers({ ...ONE, status: "active,suspended", trust_max: 2 }, { enabled: open });
  const wsSuspended = useAdminWorkspaceList({ ...ONE, status: "suspended" });
  const wsArchived = useAdminWorkspaceList({ ...ONE, status: "archived" });

  const [usersTab, creatorsTab, workspacesTab] = PLATFORM_SECTION_GROUPS.people.tabs;

  return (
    <AdminIsland
      ariaLabel="Pessoas"
      className="isl-ppl-w"
      still={still}
      open={open}
      onOpenChange={setOpen}
      sheetLabel="Resumo de pessoas"
      chevronLabel={{ open: "Abrir o resumo de pessoas", close: "Fechar o resumo de pessoas" }}
      start={
        <nav className="isl-segs" aria-label="Pessoas">
          <PillLink to={usersTab.href} on={current === "users"}>
            <i aria-hidden="true" />
            Usuários
            <em>{n(users.data?.meta.total)}</em>
          </PillLink>
          <PillLink to={creatorsTab.href} on={current === "creators"}>
            <i aria-hidden="true" />
            Criadores
            <em>{n(creators.data?.meta.total)}</em>
          </PillLink>
          <PillLink to={workspacesTab.href} on={current === "workspaces"}>
            <i aria-hidden="true" />
            Workspaces
            <em>{n(workspaces.data?.meta.total)}</em>
          </PillLink>
        </nav>
      }
      end={current === "users" ? <UsersLive /> : current === "creators" ? <CreatorsLive /> : null}
      tools={children}
      sheet={
        <div className="adm-ppl-sheet">
          <div>
            <small>Usuários suspensos</small>
            <b>{n(suspended.data?.meta.total)}</b>
            <span>contas sem acesso ao app</span>
          </div>
          <div>
            <small>Suspeitos de bot</small>
            <b>{n(suspects.data?.meta.total)}</b>
            <span>confiança nível 1 ou 2</span>
          </div>
          <div>
            <small>Workspaces suspensos</small>
            <b>{n(wsSuspended.data?.meta.total)}</b>
            <span>clientes bloqueados</span>
          </div>
          <div>
            <small>Workspaces arquivados</small>
            <b>{n(wsArchived.data?.meta.total)}</b>
            <span>clientes encerrados</span>
          </div>
        </div>
      }
    />
  );
}
