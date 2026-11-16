import { useState } from "react";

import {
  AdminActionMenu,
  AdminConfirmDialog,
  AdminSection,
  AdminTable,
  adminErrorMessage,
  adminToast,
  type AdminTableColumn,
} from "@/components/admin/platform";
import { useCommunityLessons, useLessonMutations } from "@/hooks/admin/use-admin-community-content";
import { formatDate, formatInt } from "@/lib/admin/format";
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityLesson } from "@/shared/community-content.types";

import { formatDuration, instructorLabel } from "./content-format";
import { LessonDialog } from "./lesson-dialog";

import "@/styles/admin-community.css";

function thumb(url: string | null): string | undefined {
  return url ? (url.startsWith("/") ? getUploadUrl(url) : url) : undefined;
}

/** Aba Aulas: o que está na aba Conteúdos do app, com custo, quantos desbloquearam e o instrutor. */
export function CommunityLessons() {
  const query = useCommunityLessons();
  const { remove } = useLessonMutations();
  const [editing, setEditing] = useState<CommunityLesson | "new" | null>(null);
  const [deleting, setDeleting] = useState<CommunityLesson | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const columns: AdminTableColumn<CommunityLesson>[] = [
    {
      key: "title",
      header: "Aula",
      width: "minmax(220px, 2.4fr)",
      primary: true,
      cell: (lesson) => (
        <span className="adm-content-cell">
          <span className="adm-content-thumb" data-ratio="wide" aria-hidden="true">
            {thumb(lesson.thumbnail_url) ? <img src={thumb(lesson.thumbnail_url)} alt="" /> : null}
          </span>
          <span>
            <b>{lesson.title}</b>
            <small>{[lesson.category, formatDuration(lesson.duration_seconds)].filter(Boolean).join(" · ") || "Sem categoria"}</small>
          </span>
        </span>
      ),
    },
    { key: "cost", header: "Custo", width: "110px", align: "right", cell: (lesson) => (lesson.points_cost === 0 ? "Livre" : `${formatInt(lesson.points_cost)} pts`) },
    { key: "unlocks", header: "Desbloquearam", width: "130px", align: "right", hideBelow: "sm", cell: (lesson) => formatInt(lesson.unlocks_count) },
    { key: "instructor", header: "Instrutor", width: "minmax(120px, 1fr)", hideBelow: "md", cell: (lesson) => instructorLabel(lesson.instructor_id) },
    { key: "created", header: "Criada em", width: "120px", hideBelow: "lg", cell: (lesson) => formatDate(lesson.created_at) },
  ];

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(undefined);
    try {
      await remove.mutateAsync(deleting.id);
      adminToast.success("Aula excluída.");
      setDeleting(null);
    } catch (failure) {
      setDeleteError(adminErrorMessage(failure, "Não foi possível excluir a aula."));
    }
  };

  return (
    <>
      <AdminSection
        title="Aulas"
        description="Vídeos da aba Conteúdos do app. Custo 0 deixa a aula livre."
        flush
        actions={
          <button type="button" className="btn adm-btn-sm" onClick={() => setEditing("new")}>
            Nova aula
          </button>
        }
      >
        <AdminTable
          caption="Aulas"
          columns={columns}
          rows={query.data}
          rowKey={(lesson) => lesson.id}
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
          empty={{ title: "Nenhuma aula cadastrada", description: "O app esconde a fileira de aulas até haver conteúdo. Use “Nova aula” para começar." }}
          rowActions={(lesson) => (
            <AdminActionMenu
              iconOnly
              variant="ghost"
              ariaLabel={`Ações de “${lesson.title}”`}
              items={[
                { id: "edit", label: "Editar", onSelect: () => setEditing(lesson) },
                { id: "delete", label: "Excluir", tone: "danger", onSelect: () => (setDeleteError(undefined), setDeleting(lesson)) },
              ]}
            />
          )}
        />
      </AdminSection>

      {editing ? <LessonDialog lesson={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}

      <AdminConfirmDialog
        open={deleting !== null}
        tone="danger"
        eyebrow={deleting ? `Aula · ${deleting.title}` : undefined}
        title="Excluir esta aula?"
        description={
          deleting && deleting.unlocks_count > 0
            ? `A aula some do app. ${formatInt(deleting.unlocks_count)} ${deleting.unlocks_count === 1 ? "pessoa já desbloqueou" : "pessoas já desbloquearam"} e os pontos cobrados NÃO são devolvidos. Não dá para desfazer.`
            : "A aula some do app. Os pontos já cobrados de quem desbloqueou NÃO são devolvidos. Não dá para desfazer."
        }
        reason={false}
        cancelLabel="Voltar"
        confirmLabel="Excluir aula"
        pending={remove.isPending}
        pendingLabel="Excluindo…"
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
