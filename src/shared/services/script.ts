import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import type { CampaignScript } from "../types";

export interface ApproveScriptData {
  script_id: string;
}

export interface RejectScriptData {
  script_id: string;
  feedback: string;
  new_submission_deadline?: string; // ISO 8601 timestamp
}

/**
 * Lista roteiros de uma campanha
 */
export async function getCampaignScripts(
  campaignId: string,
  filters?: {
    status?: string;
    phase_id?: string;
  }
): Promise<CampaignScript[]> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.phase_id) params.append("phase_id", filters.phase_id);

  const url = `/campaigns/${campaignId}/scripts${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const request = await fetch(getApiUrl(url), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Client-Type": "backoffice",
      Authorization: `Bearer ${getAuthToken()}`,
      "Workspace-Id": workspaceId,
    },
  });

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to get campaign scripts" };
    }
    throw errorData || "Failed to get campaign scripts";
    }

  const response = await request.json();
  return response.data;
}

/**
 * Aprova um roteiro
 */
export async function approveScript(
  campaignId: string,
  data: ApproveScriptData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/scripts/${data.script_id}/approve`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      errorData = { message: "Failed to approve script" };
    }
    throw errorData || "Failed to approve script";
    }
}

/**
 * Rejeita um roteiro
 */
export async function rejectScript(
  campaignId: string,
  data: RejectScriptData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/scripts/${data.script_id}/reject`),
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
      errorData = { message: "Failed to reject script" };
    }
    throw errorData || "Failed to reject script";
    }
}

/**
 * Aprova múltiplos roteiros em massa
 */
export async function bulkApproveScripts(
  campaignId: string,
  scriptIds: string[]
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/scripts/bulk-approve`),
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
        script_ids: scriptIds,
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to bulk approve scripts" };
    }
    throw errorData || "Failed to bulk approve scripts";
    }
}

/**
 * Reprova múltiplos roteiros em massa
 */
export async function bulkRejectScripts(
  campaignId: string,
  scriptIds: string[],
  feedback: string
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/scripts/bulk-reject`),
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
        script_ids: scriptIds,
        feedback,
      }),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to bulk reject scripts" };
    }
    throw errorData || "Failed to bulk reject scripts";
    }
}
