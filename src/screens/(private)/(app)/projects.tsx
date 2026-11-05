import { useMemo, useState } from "react";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/page/page-kit";
import { I } from "@/components/prototype/ui";
import { ProjectCard, ProjectCardSkeleton } from "@/components/agency-projects/project-card";
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
import { ProjectToolbar } from "@/components/agency-projects/project-toolbar";
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

  if (!isAgency) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="lock" />
        </span>
        <b>Projetos são exclusivos de agências</b>
        <small>Este workspace não é de agência. Fale com a equipe Hype para ativar o acesso de agência.</small>
      </div>,
    );
  }

  if (!can.canRead) {
    return wrap(
      <div className="ov-empty big">
        <span>
          <I n="lock" />
        </span>
        <b>Você não tem acesso a Projetos</b>
        <small>Peça a quem administra o workspace a permissão para ver campanhas.</small>
      </div>,
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
      <div className="ov-empty big">
        <span>
          <I n="clock" />
        </span>
        <b>Projetos ainda não está disponível</b>
        <small>Esta função chega ao seu workspace em breve. Nada foi perdido: volte aqui mais tarde.</small>
      </div>
    );
  } else if (error) {
    body = (
      <div className="ov-empty big" role="alert">
        <span>
          <I n="x" />
        </span>
        <b>Erro ao carregar os projetos</b>
        <small>{error instanceof Error ? error.message : "Tente novamente."}</small>
        <button type="button" className="btn out" disabled={isFetching} onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  } else if (!hasAny) {
    body = (
      <div className="ov-empty big">
        <span>
          <I n="list" />
        </span>
        <b>Nenhum projeto ainda</b>
        <small>Crie o primeiro projeto para organizar tarefas e entregas do time.</small>
        {newButton}
      </div>
    );
  } else if (main.length === 0 && closed.length === 0) {
    body = (
      <div className="ov-empty big">
        <span>
          <I n="search" />
        </span>
        <b>Nenhum projeto encontrado</b>
        <small>Ajuste a busca ou os filtros para ver outros projetos.</small>
        {criteria ? (
          <button type="button" className="btn out" onClick={clearAll}>
            Limpar filtros
          </button>
        ) : null}
      </div>
    );
  } else {
    body = (
      <>
        {main.length > 0 ? (
          <div className="apj-grid fade" role="list" aria-label="Projetos">
            {cards(main)}
          </div>
        ) : (
          <div className="ov-empty">
            <b>Nenhum projeto em andamento</b>
            <small>Todos os projetos{criteria ? " encontrados" : ""} estão encerrados. Veja-os abaixo ou crie um novo.</small>
            {newButton}
          </div>
        )}

        {closed.length > 0 ? (
          <div className="apj-closed">
            <button type="button" className="apj-closed-t" aria-expanded={showClosed} aria-controls="apj-closed-list" onClick={() => setShowClosed((v) => !v)}>
              {showClosed ? "Ocultar projetos encerrados" : `Ver projetos encerrados (${closed.length})`}
              <ChevronDown className={`ico sm${showClosed ? " rot" : ""}`} aria-hidden />
            </button>
            {showClosed ? (
              <div id="apj-closed-list" className="apj-grid fade" role="list" aria-label="Projetos encerrados">
                {cards(closed, true)}
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return wrap(
    <>
      <PageHeader title="Projetos" subtitle="Organize tarefas e entregas do time." actions={newButton ?? undefined} />

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
        <ProjectToolbar query={query} onQuery={setQuery} filters={filters} onFilters={setFilters} responsibles={responsibles} />
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
