import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Icon } from "@/components/ui/icon";
import { LiveForm, type LiveFormSubmit } from "@/components/lives/live-form";
import { useCreateLive } from "@/hooks/use-lives";
import { uploadLiveThumbnail } from "@/shared/services/lives";
import { useWorkspacePermissions } from "@/contexts/workspace-context";

export const Route = createFileRoute("/(private)/(app)/lives/new")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const permissions = useWorkspacePermissions();
  const createMutation = useCreateLive();

  const handleSubmit = async (
    values: LiveFormSubmit,
    thumbnailFile: File | null,
  ) => {
    try {
      // Fluxo do doc: subir a thumbnail (retorna url) ANTES de criar a live.
      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        try {
          const uploaded = await uploadLiveThumbnail(thumbnailFile);
          thumbnailUrl = uploaded.url;
        } catch {
          toast.warning("Não foi possível enviar a thumbnail; criando sem ela.");
        }
      }

      const live = await createMutation.mutateAsync({
        title: values.title,
        description: values.description,
        host_display_name: values.host_display_name,
        thumbnail_url: thumbnailUrl,
        scheduled_at: values.scheduled_at,
      });

      toast.success("Live criada. Abra a sala de controle para transmitir.");
      navigate({ to: "/lives/$liveId", params: { liveId: live.id } });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível criar a live.",
      );
    }
  };

  if (!permissions.community_lives_write) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-3 text-center">
        <Icon name="Lock" size={28} color="#a3a3a3" />
        <p className="text-lg font-semibold text-neutral-950">
          Sem permissão para criar lives
        </p>
        <Link to="/lives" className="text-sm font-semibold text-primary-600">
          Voltar para Lives
        </Link>
      </div>
    );
  }

  return (
    <LiveForm
      submitLabel="Criar live"
      submittingLabel="Criando..."
      isSubmitting={createMutation.isPending}
      onSubmit={handleSubmit}
      onCancel={() => navigate({ to: "/lives" })}
    />
  );
}
