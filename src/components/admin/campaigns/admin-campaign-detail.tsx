import {
  AdminEmptyState,
  AdminEntityCell,
  AdminErrorState,
  AdminFigureCard,
  AdminFigureGrid,
  AdminKeyValueList,
  AdminLink,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminSkeleton,
  AdminSkeletonLines,
  AdminStatusBadge,
} from "@/components/admin/platform";
import { useAdminCampaign } from "@/hooks/admin/use-admin-campaigns";
import { isAdminApiError } from "@/lib/admin/admin-client";
import { formatDate, formatDateOrInstant, formatInt } from "@/lib/admin/format";
import type { AdminCampaignDetail as AdminCampaignDetailData } from "@/shared/admin-platform.types";

import { AdminCampaignBanner } from "./admin-campaign-banner";
import { campaignsListLink, campaignWorkspaceLink } from "./campaign-links";
import {
  CAMPAIGN_COLUMN_DEFINITIONS,
  paymentMethodLabel,
  participationStatusGroups,
} from "./campaign-labels";

import "@/styles/admin-campaigns.css";

function ParticipationsSection({ campaign }: { campaign: AdminCampaignDetailData }) {
  const groups = participationStatusGroups(campaign.participations_by_status);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const { participating, total: participations } = campaign.participants;

  return (
    <AdminSection
      title="Participações por status"
      description={`${formatInt(participations)} ${participations === 1 ? "participação" : "participações"} no total, ${formatInt(participating)} em andamento.`}
    >
      {groups.length === 0 ? (
        <AdminEmptyState compact title="Nenhuma participação ainda" description="Quando criadores se candidatarem ou forem convidados, a distribuição aparece aqui." />
      ) : (
        <ul className="adm-campaigns-dist">
          {groups.map((group) => (
            <li key={group.key}>
              <span className="adm-campaigns-dist-label">{group.label}</span>
              <span className="adm-campaigns-dist-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(2, (group.count / total) * 100)}%` }} />
              </span>
              <b className="adm-num">{formatInt(group.count)}</b>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}

function ScheduleSection({ campaign }: { campaign: AdminCampaignDetailData }) {
  const steps = [...campaign.steps].sort((a, b) => a.order - b.order);
  return (
    <AdminSection title="Cronograma" description="As fases da campanha e a data de publicação de cada uma.">
      {steps.length === 0 ? (
        <AdminEmptyState compact title="Sem fases definidas" description="Esta campanha ainda não tem fases no cronograma." />
      ) : (
        <ol className="adm-campaigns-steps">
          {steps.map((step) => (
            <li key={step.order}>
              <span className="adm-campaigns-step-n" aria-hidden="true">
                {step.order}
              </span>
              <span className="adm-campaigns-step-t">{step.objective || `Fase ${step.order}`}</span>
              <span className="adm-campaigns-step-d">
                {step.publish_date ? (
                  <>
                    Publicação: <b>{formatDateOrInstant(step.publish_date)}</b>
                  </>
                ) : (
                  <span className="adm-muted">Sem data de publicação</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </AdminSection>
  );
}

function SummarySection({ campaign }: { campaign: AdminCampaignDetailData }) {
  return (
    <AdminSection title="Resumo">
      <AdminKeyValueList
        columns={2}
        items={[
          { label: "Objetivo", value: campaign.objective },
          {
            label: "Prazo de inscrição",
            value: campaign.registration_deadline ? formatDateOrInstant(campaign.registration_deadline) : "Não definido",
          },
          { label: "Mural", value: campaign.mural_active ? "Ativo" : "Inativo" },
          { label: "Vagas para criadores", value: formatInt(campaign.max_influencers) },
        ]}
      />
      <div className="adm-campaigns-desc">
        <h3>Descrição</h3>
        {campaign.description.trim() ? <p>{campaign.description}</p> : <p className="adm-muted">Sem descrição.</p>}
      </div>
    </AdminSection>
  );
}

const FIGURE_LABELS = ["Comprometido", "Liberado a criadores", "Pago via PIX", "Orçamento"] as const;

function FinancialSection({ campaign }: { campaign: AdminCampaignDetailData }) {
  const { figures } = campaign;
  const [committed, released, paidPix, budget] = FIGURE_LABELS;
  return (
    <AdminSection title="Financeiro" description="Reservas, liberações e PIX concluídos desta campanha.">
      <AdminFigureGrid>
        <AdminFigureCard variant="plain" label={committed} figure={figures.committed} />
        <AdminFigureCard variant="plain" label={released} figure={figures.released} />
        <AdminFigureCard variant="plain" label={paidPix} figure={figures.paid_pix} />
        <AdminFigureCard variant="plain" label={budget} figure={campaign.budget} />
      </AdminFigureGrid>
    </AdminSection>
  );
}

function WorkspaceSection({ campaign }: { campaign: AdminCampaignDetailData }) {
  const { workspace, workspace_owner: owner } = campaign;
  return (
    <AdminSection
      title="Workspace"
      actions={
        <AdminLink to={campaignWorkspaceLink(workspace.id)} className="btn out adm-btn-sm">
          Ver workspace
        </AdminLink>
      }
    >
      <div className="adm-campaigns-wscard">
        <AdminEntityCell name={workspace.name} shape="square" size={44} />
        {workspace.status !== "active" ? <AdminStatusBadge kind="workspace" value={workspace.status} /> : null}
      </div>
      <AdminKeyValueList
        items={[
          {
            label: "Proprietário do workspace",
            value: owner?.name ?? "Sem proprietário",
            hint: owner?.email,
            definition: CAMPAIGN_COLUMN_DEFINITIONS.owner,
          },
        ]}
      />
    </AdminSection>
  );
}

function DetailSkeleton() {
  return (
    <>
      <span className="adm-sr" role="status">
        Carregando campanha…
      </span>
      <AdminSection>
        <AdminFigureGrid>
          {FIGURE_LABELS.map((label) => (
            <AdminFigureCard key={label} variant="plain" label={label} loading />
          ))}
        </AdminFigureGrid>
      </AdminSection>
      <div className="adm-campaigns-grid">
        <div className="adm-campaigns-col">
          <AdminSection>
            <AdminSkeletonLines lines={5} />
          </AdminSection>
          <AdminSection>
            <AdminSkeletonLines lines={3} />
          </AdminSection>
        </div>
        <div className="adm-campaigns-col">
          <AdminSection>
            <AdminSkeletonLines lines={4} />
          </AdminSection>
          <AdminSection>
            <AdminSkeletonLines lines={2} />
          </AdminSection>
        </div>
      </div>
    </>
  );
}

/**
 * Detalhe de uma campanha (`/admin/campaigns/:campaignId`): cabeçalho com banner, estado, workspace e pagamento;
 * financeiro (os números com a definição de cada um), resumo, cronograma, participações por status e o workspace.
 * Só leitura.
 */
export function AdminCampaignDetail({ campaignId }: { campaignId: string }) {
  const query = useAdminCampaign(campaignId);
  const campaign = query.data;
  const back = [{ label: "Campanhas", to: campaignsListLink() }] as const;

  if (!campaign) {
    const notFound = isAdminApiError(query.error, "NOT_FOUND");
    return (
      <AdminPage>
        <AdminPageHeader
          breadcrumb={[...back, { label: "Campanha" }]}
          title={query.isError ? "Campanha" : <AdminSkeleton width={320} height={32} radius={10} />}
        />
        {query.isError ? (
          notFound ? (
            <AdminEmptyState
              boxed
              title="Campanha não encontrada"
              description="Ela pode ter sido excluída, ou o endereço está incorreto."
              action={
                <AdminLink to={campaignsListLink()} className="btn out adm-btn-sm">
                  Voltar para campanhas
                </AdminLink>
              }
            />
          ) : (
            <AdminErrorState boxed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
          )
        ) : (
          <DetailSkeleton />
        )}
      </AdminPage>
    );
  }

  const { workspace } = campaign;

  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumb={[...back, { label: campaign.title }]}
        leading={<AdminCampaignBanner title={campaign.title} banner={campaign.banner} />}
        title={campaign.title}
        badges={<AdminStatusBadge kind="campaign" value={campaign.status} />}
        meta={
          <>
            <span>
              Workspace:{" "}
              <b>
                <AdminLink to={campaignWorkspaceLink(workspace.id)} className="adm-campaigns-link">
                  {workspace.name}
                </AdminLink>
              </b>{" "}
              {workspace.status !== "active" ? <AdminStatusBadge kind="workspace" value={workspace.status} size="sm" /> : null}
            </span>
            <span>
              Pagamento: <b>{paymentMethodLabel(campaign.payment_method)}</b>
            </span>
            <span>
              Criada em <b>{formatDate(campaign.created_at)}</b>
            </span>
          </>
        }
      />

      <FinancialSection campaign={campaign} />

      <div className="adm-campaigns-grid">
        <div className="adm-campaigns-col">
          <SummarySection campaign={campaign} />
          <ScheduleSection campaign={campaign} />
        </div>
        <div className="adm-campaigns-col">
          <ParticipationsSection campaign={campaign} />
          <WorkspaceSection campaign={campaign} />
        </div>
      </div>
    </AdminPage>
  );
}
