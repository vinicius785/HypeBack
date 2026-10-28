import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";

export interface MuralStatus {
  active: boolean;
  end_date?: string;
}

export interface ActivateMuralData {
  end_date: string;
}

/**
 * Ativa o mural da campanha para receber inscrições
 */
export async function activateMural(
  campaignId: string,
  data: ActivateMuralData
): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/mural/activate`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Client-Type": "backoffice",
        Authorization: `Bearer ${getAuthToken()}`,
        "Workspace-Id": workspaceId,
      },
      body: JSON.stringify(data),
    }
  );

  if (!request.ok) {
    let errorData;
    try {
      errorData = await request.json();
    } catch {
      errorData = { message: "Failed to activate mural" };
    }
    throw errorData || "Failed to activate mural";
    }
}

/**
 * Desativa o mural da campanha
 */
export async function deactivateMural(campaignId: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/mural/deactivate`),
    {
      method: "POST",
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
      errorData = { message: "Failed to deactivate mural" };
    }
    throw errorData || "Failed to deactivate mural";
    }
}

/**
 * Retorna o status atual do mural
 */
export async function getMuralStatus(
  campaignId: string
): Promise<MuralStatus> {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório");
  }

  const request = await fetch(
    getApiUrl(`/campaigns/${campaignId}/mural/status`),
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
      errorData = { message: "Failed to get mural status" };
    }
    throw errorData || "Failed to get mural status";
    }

  const response = await request.json();
  return response.data;
}

