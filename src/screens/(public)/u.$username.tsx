import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InfluencerProfileView } from "@/components/influencer-profile/influencer-profile-view";
import { getPublicInfluencerProfile } from "@/shared/services/influencer";
import hypeappLogo from "@/assets/images/hypeapp-logo.png";

export const Route = createFileRoute("/(public)/u/$username")({
  component: PublicInfluencerProfileScreen,
});

/**
 * Página PÚBLICA e compartilhável do influenciador (`/u/:username`), sem login.
 * Reusa o corpo visual do backoffice (`InfluencerProfileView` em modo `public`),
 * omitindo ações internas (convite/pré-seleção/salvar/avaliação). O `username`
 * da URL é o `users.username` (app), não o handle da rede social.
 */
function PublicInfluencerProfileScreen() {
  const { username } = useParams({ from: "/(public)/u/$username" });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-influencer-profile", username],
    queryFn: () => getPublicInfluencerProfile(username),
    enabled: Boolean(username),
    retry: (failureCount, err) =>
      (err as { status?: number })?.status === 404 ? false : failureCount < 2,
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link do perfil copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-100">
      {/* Topo público — logo + copiar link */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-[1151px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <img src={hypeappLogo} alt="HypeApp" className="h-7 w-auto" />
          {data && (
            <Button
              variant="outline"
              className="h-10 rounded-full font-semibold border-neutral-200 min-w-max"
              onClick={handleCopyLink}
            >
              <span className="flex items-center gap-2">
                <Icon name="Link" size={16} color="#404040" />
                Copiar link
              </span>
            </Button>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-11 max-w-[1151px] mx-auto px-6 py-8">
          <div className="skeleton h-40 w-full rounded-xl" />
          <div className="skeleton h-64 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
          <Icon name="UserX" size={32} color="#a3a3a3" />
          <p className="text-lg font-medium text-neutral-800">
            {(error as { status?: number })?.status === 404
              ? "Perfil não encontrado."
              : "Não foi possível carregar este perfil."}
          </p>
          <p className="text-sm text-neutral-500">
            Verifique o link ou tente novamente mais tarde.
          </p>
        </div>
      ) : (
        <main className="flex flex-col gap-11 max-w-[1151px] mx-auto px-6 py-8">
          <InfluencerProfileView data={data} mode="public" />
        </main>
      )}
    </div>
  );
}
