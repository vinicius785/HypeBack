import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { CampaignContent } from "../types";

/** Máximo aceito pela API (`PAGINATION_MAX_PER_PAGE`). */
const CONTENTS_PER_PAGE = 100;
/** Trava de segurança contra loop infinito caso a API pare de paginar. */
const MAX_CONTENT_PAGES = 20;

export interface ApproveContentData {
  content_id: string;
  feedback?: string;
  caption_feedback?: string;
  new_submission_deadline?: string; // ISO 8601 timestamp
}

export interface RejectContentData {
  content_id: string;
  feedback: string;
  caption_feedback?: string;
  new_submission_deadline?: string; // ISO 8601 timestamp
}

/**
 * Lista conteúdos de uma campanha
 */
export async function getCampaignContents(
  campaignId: string,
  filters?: {
    status?: string;
    phase_id?: string;
  }
): Promise<CampaignContent[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  // A API pagina em 20 por padrão (máx. 100). A aba de conteúdos filtra e agrupa
  // tudo no cliente, então precisamos da lista completa — senão conteúdos
  // aprovados/reprovados simplesmente somem em campanhas com muitos envios.
  const all: CampaignContent[] = [];
  for (let page = 1; page <= MAX_CONTENT_PAGES; page++) {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.phase_id) params.append("phase_id", filters.phase_id);
    params.append("page", String(page));
    params.append("per_page", String(CONTENTS_PER_PAGE));

    const request = await fetch(
      getApiUrl(`/campaigns/${campaignId}/contents?${params.toString()}`),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Client-Type": "backoffice",
          Authorization: `Bearer ${getAuthToken()}`,
          "Workspace-Id": workspaceId,
        },
      }
    );

    if (!request.ok) {
      let errorData;
      try {
        errorData = await request.json();
      } catch {
        errorData = { message: "Failed to get campaign contents" };
      }
      throw errorData || "Failed to get campaign contents";
    }

    const response = await request.json();
    const batch: CampaignContent[] = Array.isArray(response.data)
      ? response.data
      : [];
    all.push(...batch);

    if (batch.length < CONTENTS_PER_PAGE) break;
  }

  return all;
}

/**
 * Aprova um conteúdo
 */
export async function approveContent(
  campaignId: string,
  data: ApproveContentData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/contents/${data.content_id}/approve`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        ...(data.feedback && { feedback: data.feedback }),
        ...(data.caption_feedback && { caption_feedback: data.caption_feedback }),
        ...(data.new_submission_deadline && {
          new_submission_deadline: data.new_submission_deadline,
        }),
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to approve content" };
    }
    throw errorData || "Failed to approve content";
    }
}

/**
 * Rejeita um conteúdo
 */
export async function rejectContent(
  campaignId: string,
  data: RejectContentData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/contents/${data.content_id}/reject`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        feedback: data.feedback,
        ...(data.caption_feedback && { caption_feedback: data.caption_feedback }),
        ...(data.new_submission_deadline && {
          new_submission_deadline: data.new_submission_deadline,
        }),
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to reject content" };
    }
    throw errorData || "Failed to reject content";
    }
}

/**
 * Busca a avaliação da IA do conteúdo
 */
export async function getContentEvaluation(
  campaignId: string,
  contentId: string
): Promise<{
  score: number;
  criteria: {
    relevance: number;
    quality: number;
    engagement: number;
  };
  recommendations: string[];
} | null> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(
      `/campaigns/${campaignId}/contents/${contentId}/evaluation`
    ),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get content evaluation" };
    }
    throw errorData || "Failed to get content evaluation";
    }

  const response = await request.json();
  return response.data;
}

/**
 * Aprova múltiplos conteúdos em massa
 */
export async function bulkApproveContents(
  campaignId: string,
  contentIds: string[],
  data?: {
    feedback?: string;
    caption_feedback?: string;
    new_submission_deadline?: string;
  }
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/contents/bulk-approve`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        content_ids: contentIds,
        ...(data?.feedback && { feedback: data.feedback }),
        ...(data?.caption_feedback && { caption_feedback: data.caption_feedback }),
        ...(data?.new_submission_deadline && {
          new_submission_deadline: data.new_submission_deadline,
        }),
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to bulk approve contents" };
    }
    throw errorData || "Failed to bulk approve contents";
    }
}

/**
 * Reprova múltiplos conteúdos em massa
 */
export async function bulkRejectContents(
  campaignId: string,
  contentIds: string[],
  feedback: string,
  data?: {
    caption_feedback?: string;
    new_submission_deadline?: string;
  }
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/contents/bulk-reject`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        content_ids: contentIds,
        feedback,
        ...(data?.caption_feedback && { caption_feedback: data.caption_feedback }),
        ...(data?.new_submission_deadline && {
          new_submission_deadline: data.new_submission_deadline,
        }),
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to bulk reject contents" };
    }
    throw errorData || "Failed to bulk reject contents";
    }
}

