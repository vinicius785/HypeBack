import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FilterChips, PageControls, PageToolbar, SearchInput, SelectControl } from "@/components/page/page-kit";
import { I } from "@/components/prototype/ui";
import { useDeleteProjectDocument, useProjectDocuments, useUpdateProjectDocument } from "@/hooks/use-agency-projects";
import {
  PROJECT_DOCUMENT_CATEGORIES,
  agencyProjectErrorMessage,
  isAgencyProjectsUnavailable,
  type Project,
  type ProjectDocument,
  type ProjectDocumentCategory,
} from "@/shared/services/agency-projects";

import { useProjectConfirm } from "../project-confirm";
import { DEFAULT_DOCUMENT_FILTERS, DOCUMENT_CATEGORY_LABEL, filterDocuments, groupDocumentsByCategory, type DocumentFilters } from "../project-ui";
import type { ProjectPermissions } from "../use-project-permissions";
import { DocumentForm } from "./document-form";
import { DocumentRow } from "./document-row";

import "@/styles/agency-projects.css";

interface ProjectDocumentsSectionProps {
  project: Project;
  can: ProjectPermissions;
}

/**
 * Arquivos e links do projeto: agrupados por categoria (fixados no alto de cada grupo), com busca e filtro de categoria,
 * ícone e tipo pela URL, fixar, adicionar, editar e remover (com confirmação). Sem `campaigns_write` só lista e abre.
 * O título "Arquivos e links" é da página.
 */
export function ProjectDocumentsSection({ project, can }: ProjectDocumentsSectionProps) {
  const { data, isLoading, error, refetch, isFetching } = useProjectDocuments(project.id);
  const update = useUpdateProjectDocument(project.id);
  const remove = useDeleteProjectDocument(project.id);
  const [filters, setFilters] = useState<DocumentFilters>(DEFAULT_DOCUMENT_FILTERS);
  const [form, setForm] = useState<{ document?: ProjectDocument } | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);
  const { confirm, dialog } = useProjectConfirm();

  const documents = useMemo(() => data ?? [], [data]);
  const groups = useMemo(() => groupDocumentsByCategory(filterDocuments(documents, filters)), [documents, filters]);
  const hasCriteria = filters.query.trim() !== "" || filters.category !== "all";
  const clear = () => setFilters(DEFAULT_DOCUMENT_FILTERS);

  const togglePin = (doc: ProjectDocument) => {
    setPinning(doc.id);
    update.mutate(
      { documentId: doc.id, input: { pinned: !doc.pinned } },
      {
        onSuccess: () => toast.success(doc.pinned ? "Link desafixado" : "Link fixado"),
        onError: (e) => toast.error(agencyProjectErrorMessage(e, "Não foi possível alterar o link.")),
        onSettled: () => setPinning(null),
      },
    );
  };

  const askRemove = async (doc: ProjectDocument) => {
    const ok = await confirm({
      title: "Remover link?",
      description: `“${doc.name}” sai da lista de arquivos e links do projeto. O arquivo original não é apagado.`,
      confirmLabel: "Remover link",
      tone: "danger",
      errorFallback: "Não foi possível remover o link.",
      run: () => remove.mutateAsync(doc.id),
    });
    if (ok) toast.success("Link removido");
  };

  if (isLoading && !data) {
    return (
      <div className="apj-dc-sk" aria-busy="true" aria-label="Carregando arquivos e links">
        <span className="apj-sk" />
        <span className="apj-sk" />
      </div>
    );
  }

  if (error && !data) {
    const unavailable = isAgencyProjectsUnavailable(error);
    return (
      <div className="ov-empty" role="alert">
        <span>
          <I n={unavailable ? "clock" : "x"} />
        </span>
        <b>{unavailable ? "Arquivos e links ainda não estão disponíveis" : "Erro ao carregar os arquivos e links"}</b>
        <small>{unavailable ? "Esta função chega ao seu workspace em breve." : error instanceof Error ? error.message : "Tente novamente."}</small>
        {unavailable ? null : (
          <button type="button" className="btn out" disabled={isFetching} onClick={() => void refetch()}>
            Tentar de novo
          </button>
        )}
      </div>
    );
  }

  const formNode = form ? <DocumentForm projectId={project.id} document={form.document} onClose={() => setForm(null)} /> : null;

  if (documents.length === 0) {
    return (
      <>
        <div className="ov-empty">
          <span>
            <I n="link" />
          </span>
          <b>Nenhum arquivo ou link ainda</b>
          <small>{can.canWrite ? "Guarde aqui o briefing, a apresentação e os materiais de referência deste projeto." : "Este projeto ainda não tem arquivos nem links."}</small>
          {can.canWrite ? (
            <button type="button" className="btn" onClick={() => setForm({})}>
              <I n="plus" cls="sm" />
              Adicionar link
            </button>
          ) : null}
        </div>
        {formNode}
        {dialog}
      </>
    );
  }

  return (
    <div className="apj-dc">
      <PageControls>
        <PageToolbar>
          <SearchInput value={filters.query} onChange={(query) => setFilters((f) => ({ ...f, query }))} placeholder="Buscar por nome ou endereço" label="Buscar arquivo ou link" />
          <SelectControl label="Categoria" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value as ProjectDocumentCategory | "all" }))}>
            <option value="all">Todas as categorias</option>
            {PROJECT_DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </SelectControl>
          {can.canWrite ? (
            <button type="button" className="btn apj-kb-new" onClick={() => setForm({})}>
              <I n="plus" cls="sm" />
              Adicionar link
            </button>
          ) : null}
        </PageToolbar>
        <FilterChips
          chips={filters.category !== "all" ? [{ id: "category", label: `Categoria: ${DOCUMENT_CATEGORY_LABEL[filters.category]}`, onRemove: () => setFilters((f) => ({ ...f, category: "all" })) }] : []}
          onClear={clear}
        />
      </PageControls>

      {groups.length === 0 ? (
        <div className="ov-empty">
          <span>
            <I n="search" />
          </span>
          <b>Nenhum item encontrado</b>
          <small>Nenhum arquivo ou link combina com a busca.</small>
          {hasCriteria ? (
            <button type="button" className="btn out" onClick={clear}>
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="apj-dc-g" aria-labelledby={`apj-dc-${group.category}`}>
            <h3>
              <span id={`apj-dc-${group.category}`}>{group.label}</span>
              <em>{group.items.length}</em>
            </h3>
            <ul role="list">
              {group.items.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  canWrite={can.canWrite}
                  pending={pinning === doc.id}
                  onTogglePin={() => togglePin(doc)}
                  onEdit={() => setForm({ document: doc })}
                  onRemove={() => void askRemove(doc)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
      {formNode}
      {dialog}
    </div>
  );
}
