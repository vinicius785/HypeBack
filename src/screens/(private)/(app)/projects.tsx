import { useMemo, useState } from "react";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { PageContainer, PageEmptyState, PageHeader } from "@/components/page/page-kit";
import { I } from "@/components/prototype/ui";
import { ProjectCard, ProjectCardSkeleton, ProjectListHead, ProjectRow } from "@/components/agency-projects/project-card";
import { ProjectForm } from "@/components/agency-projects/project-form";
import {
  clearProjectFilters,
  deriveResponsibles,
  filterProjects,
  groupProjects,
  hasProjectCriteria,
  parseProjectsSearch,
  projectFiltersToSearch,
  projectKpis,
  searchToProjectFilters,
  type ProjectFilters,
} from "@/components/agency-projects/project-ui";
import { ProjectToolbar, type ProjectView } from "@/components/agency-projects/project-toolbar";
import { useProjectActions } from "@/components/agency-projects/use-project-actions";
import { useProjectPermissions } from "@/components/agency-projects/use-project-permissions";
import { useAgencyProjects } from "@/hooks/use-agency-projects";
import { useIsAgencyWorkspace } from "@/hooks/use-agency-brands";
import { isAgencyProjectsUnavailable, type Project } from "@/shared/services/agency-projects";

import "@/styles/agency-projects.css";

export const Route = createFileRoute("/(private)/(app)/projects")({
  // Filtros e ordenação moram na URL (`?status=ativo&health=em_risco&owner=7&sort=name`): o link da lista é compartilhável e o
  // "voltar" do navegador devolve a lista como estava. Valor inválido some, sem quebrar a página.
  validateSearch: (search: Record<string, unknown>) => parseProjectsSearch(search),
  component: ProjectsRoute,
});

/** `/projects/:id` é filha desta rota (arquivo `projects.$projectId.tsx`): só a lista desenha a página, o resto vai para o `Outlet`. */
function ProjectsRoute() {
  const { pathname } = useLocation();
  if (pathname.replace(/\/+$/, "") !== "/projects") return <Outlet />;
  return <ProjectsPage />;
}

function ProjectsPage() {
  const isAgency = useIsAgencyWorkspace();
  const can = useProjectPermissions();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const filters = useMemo(() => searchToProjectFilters(search), [search]);
  const { data: projects = [], isLoading, error, refetch, isFetching } = useAgencyProjects();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [view, setView] = useState<ProjectView>("grid");

  const goToProject = (projectId: string) => void navigate({ to: "/projects/$projectId", params: { projectId } });
  const actions = useProjectActions({ onDuplicated: (copy) => goToProject(copy.id) });

  const setFilters = (next: ProjectFilters) => void navigate({ search: projectFiltersToSearch(next), replace: true });

  const kpis = useMemo(() => projectKpis(projects), [projects]);
  const responsibles = useMemo(() => deriveResponsibles(projects), [projects]);
  const { main, closed } = useMemo(() => groupProjects(filterProjects(projects, query, filters), filters), [projects, query, filters]);

  const wrap = (children: React.ReactNode) => (
    <div className="pv">
      <PageContainer>{children}</PageContainer>
    </div>
  );

  const header = (actions?: React.ReactNode) => <PageHeader title="Projetos" subtitle="Organize tarefas e entregas do time." actions={actions} />;

  if (!isAgency) {
    return wrap(
      <>
        {header()}
        <PageEmptyState
          icon="lock"
          title="Projetos são exclusivos de agências"
          description="Este workspace não é de agência. Fale com a equipe Hype para ativar o acesso de agência."
        />
      </>,
    );
  }

  if (!can.canRead) {
    return wrap(
      <>
        {header()}
        <PageEmptyState icon="lock" title="Você não tem acesso a Projetos" description="Peça a quem administra o workspace a permissão para ver campanhas." />
      </>,
    );
  }

  const unavailable = isAgencyProjectsUnavailable(error);
  const hasAny = projects.length > 0;
  const criteria = hasProjectCriteria(query, filters);
  const clearAll = () => {
    setQuery("");
    setFilters(clearProjectFilters(filters));
  };
  const openNew = () => setEditing("new");

  const newButton = can.canCreate ? (
    <button type="button" className="btn" onClick={openNew}>
      <I n="plus" cls="sm" />
      Novo projeto
    </button>
  ) : null;

  const cards = (list: Project[], isClosed = false) =>
    list.map((p) => (
      <ProjectCard key={p.id} project={p} can={can} actions={actions} closed={isClosed} onOpen={() => goToProject(p.id)} onEdit={() => setEditing(p)} />
    ));

  const items = (list: Project[], isClosed: boolean, label: string) =>
    view === "list" ? (
      <div className="apj-list fade">
        <ProjectListHead />
        <div role="list" aria-label={label}>
          {list.map((p) => (
            <ProjectRow key={p.id} project={p} can={can} actions={actions} closed={isClosed} onOpen={() => goToProject(p.id)} onEdit={() => setEditing(p)} />
          ))}
        </div>
      </div>
    ) : (
      <div className="apj-grid fade" role="list" aria-label={label}>
        {cards(list, isClosed)}
      </div>
    );

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className="apj-grid" aria-busy="true" aria-label="Carregando projetos">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (unavailable) {
    body = (
      <PageEmptyState
        icon="clock"
        title="Projetos ainda não está disponível"
        description="Esta função chega ao seu workspace em breve. Nada foi perdido: volte aqui mais tarde."
      />
    );
  } else if (error) {
    body = (
      <PageEmptyState
        role="alert"
        icon="alert"
        title="Erro ao carregar os projetos"
        description={error instanceof Error ? error.message : "Tente novamente."}
        action={
          <button type="button" className="btn out" disabled={isFetching} onClick={() => void refetch()}>
            Tentar de novo
          </button>
        }
      />
    );
  } else if (!hasAny) {
    body = (
      <PageEmptyState
        icon="list"
        title="Seu primeiro projeto começa aqui"
        description={
          can.canCreate
            ? "Projetos reúnem as tarefas, os prazos e os arquivos de uma entrega do time num só lugar."
            : "Projetos reúnem as tarefas, os prazos e os arquivos de uma entrega do time. Peça a quem administra o workspace para criar o primeiro."
        }
        action={newButton ?? undefined}
      >
        <ul className="pg-hints" aria-label="O que um projeto reúne">
          <li>
            <I n="check" cls="sm" />
            Quadro de tarefas por etapa
          </li>
          <li>
            <I n="check" cls="sm" />
            Responsáveis e prazos
          </li>
          <li>
            <I n="check" cls="sm" />
            Arquivos e links
          </li>
        </ul>
      </PageEmptyState>
    );
  } else if (main.length === 0 && closed.length === 0) {
    body = (
      <PageEmptyState
        icon="search"
        title="Nenhum projeto encontrado"
        description="Ajuste a busca ou os filtros para ver outros projetos."
        action={
          criteria ? (
            <button type="button" className="btn out" onClick={clearAll}>
              Limpar filtros
            </button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <>
        {main.length > 0 ? (
          items(main, false, "Projetos")
        ) : (
          <PageEmptyState
            icon="check"
            title="Nenhum projeto em andamento"
            description={`Todos os projetos${criteria ? " encontrados" : ""} estão encerrados. Veja-os abaixo ou crie um novo.`}
            action={newButton ?? undefined}
          />
        )}

        {closed.length > 0 ? (
          <div className="apj-closed">
            <button type="button" className="apj-closed-t" aria-expanded={showClosed} aria-controls="apj-closed-list" onClick={() => setShowClosed((v) => !v)}>
              {showClosed ? "Ocultar projetos encerrados" : `Ver projetos encerrados (${closed.length})`}
              <ChevronDown className={`ico sm${showClosed ? " rot" : ""}`} aria-hidden />
            </button>
            {showClosed ? (
              <div id="apj-closed-list">{items(closed, true, "Projetos encerrados")}</div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return wrap(
    <>
      {/* Sem projetos, a ação principal é a do próprio estado vazio: um botão só. */}
      {header(hasAny || unavailable || error ? (newButton ?? undefined) : undefined)}

      {hasAny && !unavailable && !error ? (
        <div className="fade">
          <div className="card" role="group" aria-label="Resumo de projetos">
            <div className="stats apj-stats">
              <div className="stat">
                <small>Projetos ativos</small>
                <b>{kpis.active}</b>
              </div>
              <div className={`stat${kpis.atRisk > 0 ? " warn" : ""}`}>
                <small>Em risco</small>
                <b>{kpis.atRisk}</b>
              </div>
              <div className={`stat${kpis.overdueTasks > 0 ? " bad" : ""}`}>
                <small>Tarefas atrasadas</small>
                <b>{kpis.overdueTasks}</b>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {hasAny && !unavailable && !error ? (
        <ProjectToolbar query={query} onQuery={setQuery} filters={filters} onFilters={setFilters} responsibles={responsibles} view={view} onView={setView} />
      ) : null}

      {body}

      {editing ? (
        <ProjectForm
          project={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            // Projeto novo leva ao detalhe (como na Plataforma VNH); edição fica na lista.
            if (created) goToProject(saved.id);
          }}
        />
      ) : null}
      {actions.dialog}
    </>,
  );
}
