import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";

export interface WorkspaceOverviewTask {
  kind: "content" | "script" | "participant";
  campaignId: string;
  campaignTitle: string;
  count: number;
  tab: "approval" | "script-approval" | "management";
  label: string;
}

/** Payload `data` de `GET .../dashboard-overview` — ver API_BACKOFFICE_WORKSPACE_DASHBOARD_OVERVIEW.md */
export interface WorkspaceDashboardOverviewApiCampaign {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  updated_at?: string;
  reach: number;
  engagement: number;
  published_content: number;
  active_influencers: number;
  pending_content_count: number;
  pending_script_count: number;
  participants_action_count: number;
}

export interface WorkspaceDashboardOverviewApi {
  aggregate_metrics: {
    reach: number;
    engagement_avg: number;
    published_content: number;
    active_influencers: number;
  };
  campaign_stats?: {
    total: number;
    active: number;
    finished: number;
    draft: number;
  };
  campaigns: WorkspaceDashboardOverviewApiCampaign[];
  tasks?: Array<{
    kind: "content" | "script" | "participant";
    campaign_id: string;
    campaign_title: string;
    count: number;
    tab: "approval" | "script-approval" | "management";
    label?: string;
  }>;
}

export interface WorkspaceDashboardOverviewResult {
  aggregateMetrics: {
    reach: number;
    engagement: number;
    publishedContent: number;
    activeInfluencers: number;
  };
  campaignStats: {
    total: number;
    active: number;
    finished: number;
    draft: number;
  } | null;
  perCampaign: Array<{
    campaignId: string;
    campaignTitle: string;
    pendingContent: number;
    pendingScripts: number;
    participantsAction: number;
    metrics: {
      reach: number;
      engagement: number;
      publishedContent: number;
      activeInfluencers: number;
    };
  }>;
  tasks: WorkspaceOverviewTask[];
  /** Linhas prontas para a tabela (evita depender de GET /campaigns). */
  campaignTable: WorkspaceDashboardOverviewApiCampaign[];
}

const DEFAULT_TASK_LABELS: Record<WorkspaceOverviewTask["kind"], string> = {
  content: "Aprovar conteúdos",
  script: "Aprovar roteiros",
  participant: "Pendências no gerenciamento",
};

function normalizeTasks(
  raw: NonNullable<WorkspaceDashboardOverviewApi["tasks"]> | undefined,
  campaigns: WorkspaceDashboardOverviewApiCampaign[],
): WorkspaceOverviewTask[] {
  if (raw?.length) {
    return raw.map((t) => ({
      kind: t.kind,
      campaignId: t.campaign_id,
      campaignTitle: t.campaign_title,
      count: t.count,
      tab: t.tab,
      label: t.label?.trim() || DEFAULT_TASK_LABELS[t.kind],
    }));
  }

  const derived: WorkspaceOverviewTask[] = [];
  for (const c of campaigns) {
    if (c.pending_content_count > 0) {
      derived.push({
        kind: "content",
        campaignId: c.id,
        campaignTitle: c.title,
        count: c.pending_content_count,
        tab: "approval",
        label: DEFAULT_TASK_LABELS.content,
      });
    }
    if (c.pending_script_count > 0) {
      derived.push({
        kind: "script",
        campaignId: c.id,
        campaignTitle: c.title,
        count: c.pending_script_count,
        tab: "script-approval",
        label: DEFAULT_TASK_LABELS.script,
      });
    }
    if (c.participants_action_count > 0) {
      derived.push({
        kind: "participant",
        campaignId: c.id,
        campaignTitle: c.title,
        count: c.participants_action_count,
        tab: "management",
        label: DEFAULT_TASK_LABELS.participant,
      });
    }
  }
  derived.sort((a, b) => b.count - a.count);
  return derived;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Aceita payload próximo do contrato; normaliza omissões e tipos comuns da API. */
function normalizeOverviewApi(raw: unknown): WorkspaceDashboardOverviewApi {
  if (!raw || typeof raw !== "object") {
    throw new Error("Resposta inválida do servidor");
  }
  const d = raw as Record<string, unknown>;
  const agg = (d.aggregate_metrics as Record<string, unknown>) ?? {};

  const campaignsIn = d.campaigns;
  const campaignsList = Array.isArray(campaignsIn) ? campaignsIn : [];

  const campaigns: WorkspaceDashboardOverviewApiCampaign[] = campaignsList.map(
    (row) => {
      const c = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const published =
        c.published_content ?? c.publishedContent;
      const activeInf =
        c.active_influencers ?? c.activeInfluencers;
      const pendContent =
        c.pending_content_count ?? c.pendingContentCount;
      const pendScript =
        c.pending_script_count ?? c.pendingScriptCount;
      const pendPart =
        c.participants_action_count ?? c.participantsActionCount;

      return {
        id: String(c.id ?? ""),
        title: String(c.title ?? ""),
        description:
          c.description === undefined || c.description === null
            ? null
            : String(c.description),
        status: c.status != null ? String(c.status) : undefined,
        updated_at:
          c.updated_at != null
            ? String(c.updated_at)
            : c.updatedAt != null
              ? String(c.updatedAt)
              : undefined,
        reach: num(c.reach),
        engagement: num(c.engagement),
        published_content: num(published),
        active_influencers: num(activeInf),
        pending_content_count: num(pendContent),
        pending_script_count: num(pendScript),
        participants_action_count: num(pendPart),
      };
    },
  ).filter((c) => c.id.length > 0);

  const statsRaw = d.campaign_stats ?? d.campaignStats;
  let campaign_stats: WorkspaceDashboardOverviewApi["campaign_stats"];
  if (statsRaw && typeof statsRaw === "object" && !Array.isArray(statsRaw)) {
    const s = statsRaw as Record<string, unknown>;
    campaign_stats = {
      total: num(s.total),
      active: num(s.active),
      finished: num(s.finished),
      draft: num(s.draft),
    };
  }

  const tasksRaw = d.tasks;

  type TaskRow = NonNullable<WorkspaceDashboardOverviewApi["tasks"]>[number];

  let tasks: WorkspaceDashboardOverviewApi["tasks"];
  if (Array.isArray(tasksRaw)) {
    const parsed: TaskRow[] = tasksRaw
      .map((row) => {
        const t = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        const kindRaw = t.kind;
        const tabRaw = t.tab;
        let k: TaskRow["kind"] | null = null;
        if (kindRaw === "content" || kindRaw === "script" || kindRaw === "participant") {
          k = kindRaw;
        }
        let tb: TaskRow["tab"] | null = null;
        if (
          tabRaw === "approval" ||
          tabRaw === "script-approval" ||
          tabRaw === "management"
        ) {
          tb = tabRaw;
        }
        if (!k || !tb) return null;
        const campaign_id = String(
          t.campaign_id ?? t.campaignId ?? "",
        );
        if (!campaign_id) return null;
        const out: TaskRow = {
          kind: k,
          campaign_id,
          campaign_title: String(t.campaign_title ?? t.campaignTitle ?? ""),
          count: num(t.count),
          tab: tb,
          label:
            t.label != null && String(t.label).trim() !== ""
              ? String(t.label)
              : undefined,
        };
        return out;
      })
      .filter((x): x is TaskRow => x != null && x.count > 0);
    tasks = parsed.length > 0 ? parsed : undefined;
  }

  return {
    aggregate_metrics: {
      reach: num(agg.reach),
      engagement_avg: num(
        agg.engagement_avg ?? agg.engagementAvg,
      ),
      published_content: num(
        agg.published_content ?? agg.publishedContent,
      ),
      active_influencers: num(
        agg.active_influencers ?? agg.activeInfluencers,
      ),
    },
    campaign_stats,
    campaigns,
    tasks,
  };
}

function mapApiToResult(api: WorkspaceDashboardOverviewApi): WorkspaceDashboardOverviewResult {
  const perCampaign = api.campaigns.map((c) => ({
    campaignId: c.id,
    campaignTitle: c.title?.trim() || "Campanha",
    pendingContent: c.pending_content_count,
    pendingScripts: c.pending_script_count,
    participantsAction: c.participants_action_count,
    metrics: {
      reach: c.reach,
      engagement: c.engagement,
      publishedContent: c.published_content,
      activeInfluencers: c.active_influencers,
    },
  }));

  return {
    aggregateMetrics: {
      reach: api.aggregate_metrics.reach,
      engagement: api.aggregate_metrics.engagement_avg,
      publishedContent: api.aggregate_metrics.published_content,
      activeInfluencers: api.aggregate_metrics.active_influencers,
    },
    campaignStats: api.campaign_stats ?? null,
    perCampaign,
    tasks: normalizeTasks(api.tasks, api.campaigns),
    campaignTable: api.campaigns,
  };
}

/**
 * Uma chamada agregada para o dashboard do workspace.
 * @see API_BACKOFFICE_WORKSPACE_DASHBOARD_OVERVIEW.md
 */
export async function getWorkspaceDashboardOverview(): Promise<WorkspaceDashboardOverviewResult> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl("/me/workspace/dashboard-overview"),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
    },
  );

  if (!request.ok) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = { message: "Falha ao carregar visão do workspace" };
    }
    const msg =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : "Falha ao carregar visão do workspace";
    const err = new Error(msg) as Error & { status?: number };
    err.status = request.status;
    throw err;
  }

  const json = await request.json();
  const data = json?.data;
  const normalized = normalizeOverviewApi(data);
  return mapApiToResult(normalized);
}
