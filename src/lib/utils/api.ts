export const getApiUrl = (path: string): string => {
  const baseUrl = import.meta.env.VITE_SERVER_URL;

  if (!baseUrl) {
    throw new Error("Unable to get base url.");
  }

  return `${baseUrl}${path}`;
};

export const saveAuthToken = (token: string): void => {
  localStorage.setItem("token", token);
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem("token");
};

export const removeAuthToken = (): void => {
  localStorage.removeItem("token");
};

export const getWorkspaceId = (): string | null => {
  return localStorage.getItem("workspaceId");
};

export const saveWorkspaceId = (workspaceId: string): void => {
  localStorage.setItem("workspaceId", workspaceId);
};

export const removeWorkspaceId = (): void => {
  localStorage.removeItem("workspaceId");
};

/**
 * Constrói a URL completa para arquivos de upload
 * Extrai a base URL do VITE_SERVER_URL removendo o path da API
 * 
 * @param uploadPath - Caminho do upload (ex: /uploads/workspaces/photo.png)
 * @returns URL completa (ex: http://localhost:3000/uploads/workspaces/photo.png)
 */
export const getUploadUrl = (uploadPath: string | null | undefined): string | undefined => {
  if (!uploadPath) {
    return undefined;
  }

  // Se já for uma URL completa, retornar como está
  if (uploadPath.startsWith("http://") || uploadPath.startsWith("https://")) {
    return uploadPath;
  }

  // Extrair a base URL do VITE_SERVER_URL
  const serverUrl = import.meta.env.VITE_SERVER_URL;
  
  if (!serverUrl) {
    throw new Error("Unable to get base url.");
  }

  // Remover o path da API para obter apenas a base URL
  // Ex: http://localhost:3000/api/backoffice -> http://localhost:3000
  const baseUrl = serverUrl.replace(/\/api\/backoffice\/?$/, "");

  // Garantir que o uploadPath comece com /
  const normalizedPath = uploadPath.startsWith("/") ? uploadPath : `/${uploadPath}`;

  return `${baseUrl}${normalizedPath}`;
};