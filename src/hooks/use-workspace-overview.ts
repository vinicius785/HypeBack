import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";

import { fetchCampaignDashboardData } from "@/hooks/use-campaign-dashboard";
import { getCampaignScripts } from "@/shared/services/script";
import {
  getWorkspaceDashboardOverview,
  type WorkspaceOverviewTask,
  type WorkspaceDashboardOverviewApiCampaign,
} from "@/shared/services/workspace-dashboard-overview";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";
import { useWorkspacePermissions } from "@/contexts/workspace-context";

export type {
  WorkspaceOverviewTask,
} from "@/shared/services/workspace-dashboard-overview";

export interface WorkspaceOverviewCampaignRow {
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
}

function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

function isContentAwaitingApproval(status: string | undefined) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s === "pending" || s === "awaiting_approval";
}

function isScriptAwaitingApproval(status: string | undefined) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s === "pending" || s === "awaiting_approval";
}

function influencerNeedsBrandAction(status: string | undefined) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return (
    s === "pending_approval" ||
    s === "script_pending" ||
    s === "content_pending" ||
    s === "in_correction" ||
    s === "contract_pending"
  );
}

function aggregateLegacy(
  ids: string[],
  titleById: Map<string, string>,
  dashboardQueries: Array<{
    data?: Awaited<ReturnType<typeof fetchCampaignDashboardData>>;
  }>,
  scriptQueries: Array<{
    data?: Awaited<ReturnType<typeof getCampaignScripts>>;
  }>,
): {
  aggregateMetrics: {
    reach: number;
    engagement: number;
    publishedContent: number;
    activeInfluencers: number;
  };
  perCampaign: WorkspaceOverviewCampaignRow[];
  tasks: WorkspaceOverviewTask[];
} {
  let reach = 0;
  let engagementSum = 0;
  let engagementCount = 0;
  let publishedContent = 0;
  let activeInfluencers = 0;

  const perCampaign: WorkspaceOverviewCampaignRow[] = [];
  const tasks: WorkspaceOverviewTask[] = [];

  for (let i = 0; i < ids.length; i++) {
    const campaignId = ids[i];
    const title = titleById.get(campaignId) ?? "Campanha";
    const dash = dashboardQueries[i]?.data;
    const scripts = scriptQueries[i]?.data;

    if (!dash) {
      perCampaign.push({
        campaignId,
        campaignTitle: title,
        pendingContent: 0,
        pendingScripts: 0,
        participantsAction: 0,
        metrics: {
          reach: 0,
          engagement: 0,
          publishedContent: 0,
          activeInfluencers: 0,
        },
      });
      continue;
    }

    reach += dash.metrics.reach;
    if (Number.isFinite(dash.metrics.engagement)) {
      engagementSum += dash.metrics.engagement;
      engagementCount += 1;
    }
    publishedContent += dash.metrics.publishedContent;
    activeInfluencers += dash.metrics.activeInfluencers;

    const pendingContent = dash.contents.filter((c) =>
      isContentAwaitingApproval(c.status),
    ).length;

    const pendingScripts = (scripts ?? []).filter((s: { status?: string }) =>
      isScriptAwaitingApproval(s.status),
    ).length;

    const participantsAction = dash.influencers.filter((inf) =>
      influencerNeedsBrandAction(inf.status),
    ).length;

    perCampaign.push({
      campaignId,
      campaignTitle: title,
      pendingContent,
      pendingScripts,
      participantsAction,
      metrics: { ...dash.metrics },
    });

    if (pendingContent > 0) {
      tasks.push({
        kind: "content",
        campaignId,
        campaignTitle: title,
        count: pendingContent,
        tab: "approval",
        label: "Aprovar conteúdos",
      });
    }
    if (pendingScripts > 0) {
      tasks.push({
        kind: "script",
        campaignId,
        campaignTitle: title,
        count: pendingScripts,
        tab: "script-approval",
        label: "Aprovar roteiros",
      });
    }
    if (participantsAction > 0) {
      tasks.push({
        kind: "participant",
        campaignId,
        campaignTitle: title,
        count: participantsAction,
        tab: "management",
        label: "Pendências no gerenciamento",
      });
    }
  }

  tasks.sort((a, b) => b.count - a.count);

  const avgEngagement =
    engagementCount > 0 ? engagementSum / engagementCount : 0;

  return {
    aggregateMetrics: {
      reach,
      engagement: avgEngagement,
      publishedContent,
      activeInfluencers,
    },
    perCampaign,
    tasks,
  };
}

export function useWorkspaceOverview(
  campaigns: Array<{ id: string; title?: string }>,
  options?: { enabled?: boolean },
) {
  const workspaceId = useWorkspaceQueryKey();
  const permissions = useWorkspacePermissions();
  const canRead = permissions.campaigns_read === true;
  const enabledBase =
    (options?.enabled !== false) &&
    !!workspaceId &&
    canRead &&
    campaigns.length > 0;

  const ids = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of campaigns) {
      m.set(c.id, c.title?.trim() || "Campanha");
    }
    return m;
  }, [campaigns]);

  const summaryQuery = useQuery({
    queryKey: withWorkspaceKey(["workspace-dashboard-overview"], workspaceId),
    queryFn: getWorkspaceDashboardOverview,
    enabled: enabledBase,
    retry: false,
    staleTime: 60_000,
  });

  const shouldUseLegacy =
    enabledBase &&
    !summaryQuery.isPending &&
    summaryQuery.isError &&
    errorStatus(summaryQuery.error) === 404;

  const dashboardQueries = useQueries({
    queries: ids.map((campaignId) => ({
      queryKey: withWorkspaceKey(
        ["campaigns", campaignId, "dashboard"],
        workspaceId,
      ),
      queryFn: () => fetchCampaignDashboardData(campaignId),
      enabled: shouldUseLegacy && !!campaignId,
      staleTime: 60_000,
    })),
  });

  const scriptQueries = useQueries({
    queries: ids.map((campaignId) => ({
      queryKey: withWorkspaceKey(
        ["campaigns", campaignId, "scripts", {}],
        workspaceId,
      ),
      queryFn: () => getCampaignScripts(campaignId),
      enabled: shouldUseLegacy && !!campaignId,
      staleTime: 60_000,
    })),
  });

  const legacyPending =
    shouldUseLegacy &&
    (dashboardQueries.some((q) => q.isPending) ||
      scriptQueries.some((q) => q.isPending));

  const legacyError =
    shouldUseLegacy &&
    (dashboardQueries.some((q) => q.isError) ||
      scriptQueries.some((q) => q.isError));

  const isLoading =
    enabledBase &&
    (summaryQuery.isPending || legacyPending);

  const apiFailedHard =
    enabledBase &&
    summaryQuery.isError &&
    errorStatus(summaryQuery.error) !== 404;

  const hasError = apiFailedHard || legacyError;

  const legacyAggregated = useMemo(() => {
    if (!shouldUseLegacy) {
      return {
        aggregateMetrics: {
          reach: 0,
          engagement: 0,
          publishedContent: 0,
          activeInfluencers: 0,
        },
        perCampaign: [] as WorkspaceOverviewCampaignRow[],
        tasks: [] as WorkspaceOverviewTask[],
      };
    }
    return aggregateLegacy(ids, titleById, dashboardQueries, scriptQueries);
  }, [shouldUseLegacy, ids, titleById, dashboardQueries, scriptQueries]);

  const result = useMemo(() => {
    if (!enabledBase) {
      return {
        aggregateMetrics: {
          reach: 0,
          engagement: 0,
          publishedContent: 0,
          activeInfluencers: 0,
        },
        perCampaign: [] as WorkspaceOverviewCampaignRow[],
        tasks: [] as WorkspaceOverviewTask[],
        campaignStats: null as null | {
          total: number;
          active: number;
          finished: number;
          draft: number;
        },
        campaignTable: [] as WorkspaceDashboardOverviewApiCampaign[],
        usesAggregatedEndpoint: false,
      };
    }

    if (summaryQuery.data && !shouldUseLegacy) {
      const d = summaryQuery.data;
      return {
        aggregateMetrics: d.aggregateMetrics,
        perCampaign: d.perCampaign as WorkspaceOverviewCampaignRow[],
        tasks: d.tasks,
        campaignStats: d.campaignStats,
        campaignTable: d.campaignTable,
        usesAggregatedEndpoint: true,
      };
    }

    return {
      aggregateMetrics: legacyAggregated.aggregateMetrics,
      perCampaign: legacyAggregated.perCampaign,
      tasks: legacyAggregated.tasks,
      campaignStats: null,
      campaignTable: [] as WorkspaceDashboardOverviewApiCampaign[],
      usesAggregatedEndpoint: false,
    };
  }, [
    enabledBase,
    summaryQuery.data,
    shouldUseLegacy,
    legacyAggregated,
  ]);

  return {
    isLoading,
    hasError,
    enabled: enabledBase,
    aggregateMetrics: result.aggregateMetrics,
    perCampaign: result.perCampaign,
    tasks: result.tasks,
    campaignStats: result.campaignStats,
    campaignTable: result.campaignTable,
    usesAggregatedEndpoint: result.usesAggregatedEndpoint,
  };
}
