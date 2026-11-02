/**
 * Observador de respostas da API: o ÚNICO lugar que reconhece WORKSPACE_SUSPENDED, WORKSPACE_ARCHIVED e
 * WORKSPACE_DELETED vindos de qualquer chamada do app, sem que cada tela ou serviço trate.
 *
 * Por que `fetch` e não o `http-client`: só 10 dos ~45 arquivos que falam com a API passam pelo `http-client`;
 * os outros chamam `fetch` direto e muitos jogam o corpo do erro fora (`new Error(message)`). Aqui o corpo ainda
 * está inteiro (lido numa cópia, `response.clone()`), e a resposta original segue intacta para o serviço.
 *
 * O que NÃO faz: não altera a resposta, não atrasa a chamada (o corpo é lido depois de devolvê-la) e não age
 * sozinho. Quem reage é o ouvinte registrado em `installWorkspaceStateObserver` (ver `reactions.ts`).
 */
import { getApiUrl, getWorkspaceId } from "@/lib/utils/api";

import {
  isWorkspaceReactionCode,
  parseWorkspaceStateErrorBody,
  type WorkspaceReactionCode,
} from "./lifecycle-errors";

export interface WorkspaceStateEvent {
  code: WorkspaceReactionCode;
  /**
   * Workspace da chamada que falhou: o header `Workspace-Id`, senão o da URL (`/workspaces/:id/...`), senão o
   * guardado. Pode não ser o selecionado agora (a pessoa trocou de workspace com a chamada em voo).
   */
  workspaceId: string | undefined;
  status: number;
  message: string;
}

export type WorkspaceStateListener = (event: WorkspaceStateEvent) => void;

/** Só 403 (suspenso, arquivado) e 404 (excluído) levam estes códigos. */
const INSPECTED_STATUSES: ReadonlySet<number> = new Set([403, 404]);
const WORKSPACE_ID_HEADER = "workspace-id";
const WORKSPACE_IN_PATH = /^\/workspaces\/([^/]+)/;
/** O Admin da plataforma é escopo global: não tem workspace "selecionado" para reagir. */
const PLATFORM_ADMIN_PATH = /^\/admin(\/|$)/;

function apiBaseUrl(): string | null {
  try {
    return getApiUrl("");
  } catch {
    return null;
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (typeof URL !== "undefined" && input instanceof URL) return input.href;
  return (input as Request).url;
}

/** Caminho da chamada depois da base da API (`/campaigns/1`), ou `null` quando não é uma chamada à API. */
function apiPath(url: string, base: string): string | null {
  if (!url.startsWith(base)) return null;
  const rest = url.slice(base.length);
  if (rest !== "" && !/^[/?#]/.test(rest)) return null;
  return rest.split(/[?#]/)[0] || "/";
}

function readHeader(headers: HeadersInit | null | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  // `Headers` por `get`, não por `instanceof`: o de um `Request` pode ser de outro "realm" (iframe, jsdom).
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? undefined;
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === name)?.[1];
  }
  for (const [key, value] of Object.entries(headers as Record<string, string>)) {
    if (key.toLowerCase() === name) return value;
  }
  return undefined;
}

function resolveWorkspaceId(input: RequestInfo | URL, init: RequestInit | undefined, path: string): string | undefined {
  const fromHeader =
    readHeader(init?.headers, WORKSPACE_ID_HEADER) ??
    (typeof input === "object" && "headers" in input ? readHeader((input as Request).headers, WORKSPACE_ID_HEADER) : undefined);
  if (fromHeader) return fromHeader;
  const fromPath = WORKSPACE_IN_PATH.exec(path)?.[1];
  if (fromPath) {
    try {
      return decodeURIComponent(fromPath);
    } catch {
      return fromPath;
    }
  }
  return getWorkspaceId() ?? undefined;
}

function inspectResponse(
  response: Response,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  listener: WorkspaceStateListener,
): void {
  try {
    const status = Number(response?.status);
    if (response.ok || !INSPECTED_STATUSES.has(status)) return;
    const base = apiBaseUrl();
    if (base === null) return;
    const path = apiPath(requestUrl(input), base);
    if (path === null || PLATFORM_ADMIN_PATH.test(path)) return;
    const workspaceId = resolveWorkspaceId(input, init, path);

    // A cópia é lida em paralelo com o serviço; a resposta original não é tocada.
    void response
      .clone()
      .json()
      .then(
        (body: unknown) => {
          const state = parseWorkspaceStateErrorBody(status, body);
          if (state === null || !isWorkspaceReactionCode(state.code)) return;
          try {
            listener({ code: state.code, workspaceId, status, message: state.message });
          } catch {
            // a reação não pode virar falha da requisição
          }
        },
        () => {
          // corpo ausente ou fora de JSON (proxy, CDN): não há código para reconhecer
        },
      );
  } catch {
    // observar nunca derruba a chamada
  }
}

/**
 * Passa a observar as respostas de `fetch`. Devolve a função que desfaz (o `fetch` anterior volta se ninguém
 * o trocou depois; senão o observador só fica inerte). Pode ser instalado mais de uma vez: cada instalação
 * embrulha a anterior.
 */
export function installWorkspaceStateObserver(listener: WorkspaceStateListener): () => void {
  const original = globalThis.fetch;
  if (typeof original !== "function") return () => {};

  let active = true;
  const observed = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await original.call(globalThis, input, init);
    if (active) inspectResponse(response, input, init, listener);
    return response;
  };

  globalThis.fetch = observed as typeof fetch;
  return () => {
    active = false;
    if (globalThis.fetch === observed) globalThis.fetch = original;
  };
}
