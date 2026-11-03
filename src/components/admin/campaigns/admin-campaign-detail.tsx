import {
  AdminEmptyState,
  AdminErrorState,
  AdminFigureCard,
  AdminFigureGrid,
  AdminKeyValueList,
  AdminLink,
  AdminNotFound,
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

/**
 * Resumo: só o que o cabeçalho não diz (o workspace, o pagamento e a criação já estão lá). O responsável é o do
 * workspace: a campanha não tem dono próprio no banco, e a definição diz isso.
 */
function SummarySection({ campaign }: { campaign: AdminCampaignDetailData }) {
  const owner = campaign.workspace_owner;
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
          {
            label: "Responsável do workspace",
            value: owner?.name ?? "Sem proprietário",
            hint: owner?.email,
            definition: CAMPAIGN_COLUMN_DEFINITIONS.owner,
          },
        ]}
      />
      <div className="adm-campaigns-desc">
        <h3>Descrição</h3>
        {campaign.description.trim() ? <p>{campaign.description}</p> : <p className="adm-muted">Sem descrição.</p>}
      </div>
    </AdminSection>
  );
}

const FIGURE_LABELS = ["Comprometido", "Liberado a criadores", "Pago via PIX"] as const;

/** Os três números do contrato. O orçamento (`budget`) não aparece: o banco não o guarda e a API devolve sempre "não apurado". */
function FinancialSection({ campaign }: { campaign: AdminCampaignDetailData }) {
  const { figures } = campaign;
  const [committed, released, paidPix] = FIGURE_LABELS;
  return (
    <AdminSection title="Financeiro" description="Reservas, liberações e PIX concluídos desta campanha.">
      <AdminFigureGrid quiet>
        <AdminFigureCard variant="plain" label={committed} figure={figures.committed} />
        <AdminFigureCard variant="plain" label={released} figure={figures.released} />
        <AdminFigureCard variant="plain" label={paidPix} figure={figures.paid_pix} />
      </AdminFigureGrid>
    </AdminSection>
  );
}

/** Mesma anatomia do cabeçalho carregado (banner, título e linha de apoio), para a página não saltar ao chegar. */
function DetailSkeleton() {
  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumb={[{ label: "Campanhas", to: campaignsListLink() }, { label: "Campanha" }]}
        leading={<AdminSkeleton width={160} height={64} radius="var(--adm-r-sm)" />}
        title={<AdminSkeleton width={320} height={32} radius={10} />}
        meta={<AdminSkeleton width={340} height={14} />}
      />
      <span className="adm-sr" role="status">
        Carregando campanha…
      </span>
      <AdminSection>
        <AdminSkeletonLines lines={5} />
      </AdminSection>
      <AdminSection>
        <AdminFigureGrid quiet>
          {FIGURE_LABELS.map((label) => (
            <AdminFigureCard key={label} variant="plain" label={label} loading />
          ))}
        </AdminFigureGrid>
      </AdminSection>
      <div className="adm-campaigns-grid">
        <AdminSection>
          <AdminSkeletonLines lines={4} />
        </AdminSection>
        <AdminSection>
          <AdminSkeletonLines lines={3} />
        </AdminSection>
      </div>
    </AdminPage>
  );
}

/**
 * Detalhe de uma campanha (`/admin/campaigns/:campaignId`): cabeçalho com banner, estado, workspace e pagamento;
 * resumo, financeiro (os números com a definição de cada um), cronograma e participações por status.
 * Só leitura.
 */
export function AdminCampaignDetail({ campaignId }: { campaignId: string }) {
  const query = useAdminCampaign(campaignId);
  const campaign = query.data;
  const back = [{ label: "Campanhas", to: campaignsListLink() }] as const;

  if (!campaign) {
    if (!query.isError) return <DetailSkeleton />;
    return (
      <AdminPage>
        <AdminPageHeader breadcrumb={[...back, { label: "Campanha" }]} title="Campanha" />
        {isAdminApiError(query.error, "NOT_FOUND") ? (
          <AdminNotFound entity="campanha" backTo={campaignsListLink()} backLabel="Voltar para campanhas" />
        ) : (
          <AdminErrorState boxed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
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
              <AdminLink to={campaignWorkspaceLink(workspace.id)} textLink>
                {workspace.name}
              </AdminLink>{" "}
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

      <SummarySection campaign={campaign} />
      <FinancialSection campaign={campaign} />

      <div className="adm-campaigns-grid">
        <ScheduleSection campaign={campaign} />
        <ParticipationsSection campaign={campaign} />
      </div>
    </AdminPage>
  );
}
