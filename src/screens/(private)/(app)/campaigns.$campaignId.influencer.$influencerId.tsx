import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * URLs antigas /campaigns/:campaignId/influencer/:id redirecionam para a página dedicada do influenciador.
 */
export const Route = createFileRoute(
  "/(private)/(app)/campaigns/$campaignId/influencer/$influencerId"
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/influencer/$influencerId",
      params: { influencerId: params.influencerId },
    });
  },
});
