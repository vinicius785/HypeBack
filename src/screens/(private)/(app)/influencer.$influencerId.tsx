import { createFileRoute, useCanGoBack, useNavigate, useParams, useRouter } from "@tanstack/react-router";

import { useInfluencerProfile } from "@/hooks/use-influencer-profile";
import { InfluencerProfileDrawer } from "@/components/influencer-profile/profile-drawer";

export const Route = createFileRoute("/(private)/(app)/influencer/$influencerId")({
  component: InfluencerProfileScreen,
});

/**
 * Perfil do criador como gaveta lateral. Ao fechar, volta no histórico interno
 * (ex.: gestão da campanha); sem histórico, vai para a campanha do perfil ou
 * para /creators.
 */
function InfluencerProfileScreen() {
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { influencerId } = useParams({ from: "/(private)/(app)/influencer/$influencerId" });
  // Mesma query (cache compartilhado) — só para saber a campanha de origem.
  const { data } = useInfluencerProfile(influencerId ?? "", 10);
  const campaignId = data?.campaign?.id;

  const handleClose = () => {
    if (canGoBack) {
      router.history.back();
    } else if (campaignId) {
      navigate({ to: "/campaigns/$campaignId", params: { campaignId } });
    } else {
      navigate({ to: "/creators" });
    }
  };

  return <InfluencerProfileDrawer influencerId={influencerId ?? ""} onClose={handleClose} />;
}
