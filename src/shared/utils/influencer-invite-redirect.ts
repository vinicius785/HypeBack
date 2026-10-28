/**
 * Rotas relativas na **mesma origem** do site (sem variável de ambiente).
 * Ajuste o caminho se o app influenciador usar outro prefixo.
 *
 * Inscrições na campanha: `/influencer/campaigns/:id/applications`
 */
export function campaignApplicationsPath(campaignPublicId: string): string {
  return `/influencer/campaigns/${encodeURIComponent(campaignPublicId)}/applications`;
}

/** Usuário já cadastrado: abre as inscrições da campanha no app (login se precisar). */
export function buildInfluencerCampaignApplicationsUrl(campaignPublicId: string): string {
  return campaignApplicationsPath(campaignPublicId);
}
