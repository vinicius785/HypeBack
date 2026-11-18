/** Pop-ups de abertura do app (`/admin/popups`). Contrato: `docs/prompt-popup-painel.md` da API. */

export type PopupStatus = "scheduled" | "live" | "expired";
export type PopupAudience = "all" | "campaign";

/** Mesmo contrato de destino das notificações. */
export interface PopupTarget {
  version: 1;
  screen: string;
  url?: string;
  [idField: string]: unknown;
}

export interface Popup {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  theme: string;
  icon: string | null;
  button_label: string | null;
  target: PopupTarget | null;
  audience: PopupAudience;
  campaign_id: string | null;
  priority: number;
  /** Hype Points dados a quem toca no botão (1 vez por pessoa); `null` = sem prêmio. */
  reward_points?: number | null;
  /** Texto do selo; vazio, o app mostra "+N Hype Points". */
  reward_label?: string | null;
  /** ISO UTC. */
  starts_at: string;
  /** ISO UTC; a API põe início + 24h (não há campo de fim). */
  expires_at: string;
  status: PopupStatus;
  views: number;
  clicks: number;
  dismissals: number;
  created_at: string;
}

/** `GET /admin/popups/options`: nada disso fica fixo no painel. */
export interface PopupOptions {
  themes: string[];
  icons: string[];
  screens_without_id: string[];
  screens_with_id: Array<{ screen: string; id_field: string }>;
  external_url_hosts: string[];
  /** Faixa do prêmio em Hype Points. */
  reward_points?: { min: number; max: number };
}

/** Corpo do POST/PATCH. No PATCH, `null` tira ícone, imagem ou botão. */
export interface PopupBody {
  title?: string;
  body?: string | null;
  image_url?: string | null;
  theme?: string;
  icon?: string | null;
  button_label?: string | null;
  target?: PopupTarget | null;
  audience?: PopupAudience;
  campaign_id?: string | null;
  priority?: number;
  reward_points?: number | null;
  reward_label?: string | null;
  starts_at?: string;
}
