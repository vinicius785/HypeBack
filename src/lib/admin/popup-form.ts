import { TARGET_SCREENS_PLAIN, TARGET_SCREENS_WITH_ID } from "@/lib/admin/notification-target";
import type { Popup, PopupBody, PopupOptions, PopupStatus, PopupTarget } from "@/shared/popups.types";

export const POPUP_TITLE_MAX = 80;
export const POPUP_BODY_MAX = 400;
export const POPUP_BUTTON_MAX = 30;
export const POPUP_PRIORITY_MAX = 100;

/** Prioridade em três níveis na tela; a API guarda um número de 0 a 100 (maior aparece primeiro). */
export const PRIORITY_LEVELS = [
  { key: "low", label: "Baixa", value: 10, hint: "Aparece depois dos outros pop-ups do dia." },
  { key: "normal", label: "Normal", value: 50, hint: "A ordem comum, sem passar na frente de ninguém." },
  { key: "high", label: "Alta", value: 90, hint: "Aparece primeiro quando houver mais de um válido no dia." },
] as const;
export type PriorityKey = (typeof PRIORITY_LEVELS)[number]["key"];

/** Em qual nível cai um número guardado na API (faixas de 0–33, 34–66 e 67–100). */
export function priorityLevel(value: number | string): (typeof PRIORITY_LEVELS)[number] {
  const n = Number(value);
  return n < 34 ? PRIORITY_LEVELS[0] : n <= 66 ? PRIORITY_LEVELS[1] : PRIORITY_LEVELS[2];
}
export const EXTERNAL_URL = "external_url";

/**
 * Regra da imagem do pop-up: o quadro do app é 16:9 e a imagem preenche o quadro, então qualquer outra proporção seria
 * cortada. Por isso só entra imagem 16:9 (com folga de 2%) e com largura mínima para não ficar borrada.
 */
export const POPUP_IMAGE = { ratio: 16 / 9, tolerance: 0.02, minWidth: 960, idealLabel: "1600 × 900 px" } as const;
export const POPUP_IMAGE_HINT = `Proporção 16:9, mínimo ${POPUP_IMAGE.minWidth} × ${Math.round(POPUP_IMAGE.minWidth / POPUP_IMAGE.ratio)} px (ideal ${POPUP_IMAGE.idealLabel}). Em outra proporção o app cortaria a imagem. JPG, PNG ou WebP, até 5 MB.`;

/** Motivo da recusa de uma imagem com estas dimensões, ou `null` se serve. */
export function imageDimensionError(width: number, height: number): string | null {
  if (!width || !height) return "Não foi possível ler as dimensões da imagem.";
  if (Math.abs(width / height - POPUP_IMAGE.ratio) / POPUP_IMAGE.ratio > POPUP_IMAGE.tolerance) {
    return `A imagem tem ${width} × ${height} px (${(width / height).toFixed(2)}:1). Use proporção 16:9, como ${POPUP_IMAGE.idealLabel}, para o app não cortar.`;
  }
  if (width < POPUP_IMAGE.minWidth) return `A imagem é pequena (${width} px de largura). Use pelo menos ${POPUP_IMAGE.minWidth} px, ideal ${POPUP_IMAGE.idealLabel}.`;
  return null;
}

/** Lê as dimensões do arquivo no navegador e aplica a regra, antes de enviar. */
export async function validatePopupImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ w: image.naturalWidth, h: image.naturalHeight });
      image.onerror = () => reject(new Error("imagem ilegível"));
      image.src = url;
    });
    return imageDimensionError(size.w, size.h);
  } catch {
    return "Não foi possível ler a imagem. Use JPG, PNG ou WebP.";
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Brasília não tem horário de verão desde 2019: o deslocamento é fixo. */
const SAO_PAULO_OFFSET = "-03:00";
const DAY_MS = 24 * 60 * 60 * 1000;

export const POPUP_STATUS_LABEL: Record<PopupStatus, string> = { scheduled: "Agendado", live: "No ar", expired: "Expirado" };

/** Nomes das telas para quem usa o painel; o que a API manda (e não está aqui) vira texto legível. */
const EXTRA_SCREEN_LABEL: Record<string, string> = { agency_chat: "Chat da agência", campaign_detail: "Detalhe da campanha" };
const ID_FIELD_LABEL: Record<string, string> = { campaign_id: "Campanha", group_id: "Id do grupo", post_id: "Id da publicação" };

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

export function screenLabel(screen: string): string {
  return (
    TARGET_SCREENS_PLAIN.find((item) => item.value === screen)?.label ??
    TARGET_SCREENS_WITH_ID.find((item) => item.value === screen)?.label ??
    EXTRA_SCREEN_LABEL[screen] ??
    humanize(screen)
  );
}

export function idFieldLabel(idField: string): string {
  return ID_FIELD_LABEL[idField] ?? "Id";
}

export function themeLabel(theme: string): string {
  return theme === "dark" ? "Preto" : theme === "light" ? "Branco" : humanize(theme);
}

export interface PopupDraft {
  title: string;
  body: string;
  imageUrl: string;
  theme: string;
  /** "" = sem ícone. */
  icon: string;
  buttonLabel: string;
  /** "" = sem destino; `external_url` = link; senão o nome da tela. */
  screen: string;
  targetId: string;
  url: string;
  audience: "all" | "campaign";
  campaignId: string;
  priority: string;
  /** `YYYY-MM-DDTHH:mm`, horário de Brasília. Vazio = agora. */
  startsAt: string;
}

export const EMPTY_POPUP_DRAFT: PopupDraft = {
  title: "",
  body: "",
  imageUrl: "",
  theme: "light",
  icon: "",
  buttonLabel: "",
  screen: "",
  targetId: "",
  url: "",
  audience: "all",
  campaignId: "",
  priority: "50",
  startsAt: "",
};

/** ISO UTC → valor do campo de data e hora, no horário de Brasília. */
export function toInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return parts.replace(" ", "T");
}

/** Valor do campo (Brasília) → ISO UTC; vazio ou inválido vira `null`. */
export function fromInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00${SAO_PAULO_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Quando o pop-up deixa de valer: início (ou agora) + 1 dia. A API é quem define; aqui só se mostra. */
export function validUntil(startsAt: string, now: number = Date.now()): Date {
  const iso = fromInputValue(startsAt);
  return new Date((iso ? new Date(iso).getTime() : now) + DAY_MS);
}

export function draftFromPopup(popup: Popup, options: { keepStart: boolean }): PopupDraft {
  const target = popup.target;
  const base: PopupDraft = {
    ...EMPTY_POPUP_DRAFT,
    title: popup.title,
    body: popup.body ?? "",
    imageUrl: popup.image_url ?? "",
    theme: popup.theme,
    icon: popup.icon ?? "",
    buttonLabel: popup.button_label ?? "",
    audience: popup.audience,
    campaignId: popup.campaign_id ?? "",
    priority: String(popup.priority),
    startsAt: options.keepStart ? toInputValue(popup.starts_at) : "",
  };
  if (!target) return base;
  if (target.screen === EXTERNAL_URL) return { ...base, screen: EXTERNAL_URL, url: typeof target.url === "string" ? target.url : "" };
  const idEntry = Object.entries(target).find(([key, value]) => key.endsWith("_id") && typeof value === "string");
  return { ...base, screen: target.screen, targetId: idEntry ? String(idEntry[1]) : "" };
}

/** Qual campo guarda o id de uma tela, segundo as opções da API. */
export function idFieldOf(screen: string, options: PopupOptions | undefined): string | null {
  return options?.screens_with_id.find((item) => item.screen === screen)?.id_field ?? null;
}

export function buildTarget(draft: PopupDraft, options: PopupOptions | undefined): PopupTarget | null {
  if (!draft.screen) return null;
  if (draft.screen === EXTERNAL_URL) return { version: 1, screen: EXTERNAL_URL, url: draft.url.trim() };
  const idField = idFieldOf(draft.screen, options);
  return idField ? { version: 1, screen: draft.screen, [idField]: draft.targetId.trim() } : { version: 1, screen: draft.screen };
}

export type PopupField = "title" | "body" | "buttonLabel" | "screen" | "targetId" | "url" | "campaignId" | "priority" | "startsAt";

/** O que a API recusaria, dito antes de enviar (a mensagem da API continua valendo para o resto). */
export function popupDraftErrors(draft: PopupDraft, options: PopupOptions | undefined): Partial<Record<PopupField, string>> {
  const errors: Partial<Record<PopupField, string>> = {};
  const title = draft.title.trim();
  if (!title) errors.title = "Informe o título.";
  else if (title.length > POPUP_TITLE_MAX) errors.title = `No máximo ${POPUP_TITLE_MAX} caracteres.`;
  if (draft.body.length > POPUP_BODY_MAX) errors.body = `No máximo ${POPUP_BODY_MAX} caracteres.`;

  const label = draft.buttonLabel.trim();
  if (label.length > POPUP_BUTTON_MAX) errors.buttonLabel = `No máximo ${POPUP_BUTTON_MAX} caracteres.`;
  else if (draft.screen && !label) errors.buttonLabel = "Escreva o texto do botão: ele anda junto com a página de destino.";
  else if (label && !draft.screen) errors.screen = "Escolha para qual página o botão vai.";

  if (draft.screen === EXTERNAL_URL) {
    const hosts = options?.external_url_hosts ?? [];
    try {
      const url = new URL(draft.url.trim());
      if (url.protocol !== "https:") errors.url = "Só links https são aceitos.";
      else if (hosts.length > 0 && !hosts.includes(url.hostname.toLowerCase())) errors.url = `Só links de ${hosts.join(", ")}.`;
    } catch {
      errors.url = "Link inválido. Use https://… completo.";
    }
  } else if (draft.screen && idFieldOf(draft.screen, options) && !draft.targetId.trim()) {
    errors.targetId = "Escolha o item.";
  }

  if (draft.audience === "campaign" && !draft.campaignId) errors.campaignId = "Escolha a campanha.";

  const priority = Number(draft.priority);
  if (!/^\d+$/.test(draft.priority.trim()) || priority > POPUP_PRIORITY_MAX) errors.priority = `Um número de 0 a ${POPUP_PRIORITY_MAX}.`;

  if (draft.startsAt && !fromInputValue(draft.startsAt)) errors.startsAt = "Data inválida.";
  return errors;
}

/**
 * Corpo do envio. Na edição os campos opcionais vão como `null` quando esvaziados (é assim que a API os tira); na criação
 * o que está vazio nem vai.
 */
export function buildPopupBody(draft: PopupDraft, options: PopupOptions | undefined, mode: "create" | "edit"): PopupBody {
  const edit = mode === "edit";
  const optional = <T,>(value: T | null): T | null | undefined => (value === null ? (edit ? null : undefined) : value);
  const startsAt = fromInputValue(draft.startsAt);
  const body: PopupBody = {
    title: draft.title.trim(),
    body: optional(draft.body.trim() || null),
    image_url: optional(draft.imageUrl || null),
    theme: draft.theme,
    icon: optional(draft.icon || null),
    button_label: optional(draft.buttonLabel.trim() || null),
    target: optional(buildTarget(draft, options)),
    audience: draft.audience,
    campaign_id: draft.audience === "campaign" ? draft.campaignId : edit ? null : undefined,
    priority: Number(draft.priority),
    ...(startsAt ? { starts_at: startsAt } : {}),
  };
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)) as PopupBody;
}

/** Cliques ÷ vistos, em %; "—" sem nenhuma visualização. */
export function clickRate(views: number, clicks: number): string {
  if (views <= 0) return "—";
  return `${((clicks / views) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export const POPUP_FILTERS = [
  { value: "", label: "Todos" },
  { value: "live", label: "No ar" },
  { value: "scheduled", label: "Agendados" },
  { value: "expired", label: "Expirados" },
] as const;
