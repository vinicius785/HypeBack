export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  /** Foto de perfil (path relativo ou URL) — `avatar`, `photo` na API. */
  avatar?: string | null;
  /**
   * Papel de plataforma (escopo global, fora de workspace).
   * Backend deve retornar `true` em `GET /me` quando o usuário tem `platform_role = 'admin'`
   * (ou ability `platform:admin`). Fallback temporário por env em `lib/utils/platform-admin.ts`
   * enquanto backend não implementa. Ver `docs/api-super-admin-dashboard.md`.
   */
  is_platform_admin?: boolean;
}

export interface AdminPeriod {
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
}

export type AdminGranularity = "day" | "week" | "month";

export interface AdminCreatorsSummary {
  total: number;
  new_in_period: number;
  active_in_period: number;
  total_social_networks: number;
  avg_networks_per_creator: number;
  activation_rate: number;
}

export interface AdminCampaignsSummary {
  total: number;
  active: number;
  finished: number;
  draft: number;
  created_in_period: number;
  avg_influencers_per_campaign: number;
  workspaces_with_active_campaigns: number;
  draft_to_active_rate: number;
}

export interface AdminFinancialSummary {
  custody_balance: number;
  total_volume_in_period: number;
  paid_to_creators: number;
  total_deposits: number;
  platform_fees: number;
  pending_payments: number;
}

export interface AdminDashboardSummary {
  period: AdminPeriod;
  creators: AdminCreatorsSummary;
  campaigns: AdminCampaignsSummary;
  financial: AdminFinancialSummary;
}

export interface AdminTimeSeriesPoint {
  /** YYYY-MM-DD ou YYYY-MM (depende da granularidade) */
  bucket: string;
  value: number;
}

export interface AdminCreatorsStats extends AdminCreatorsSummary {
  growth_series: AdminTimeSeriesPoint[];
}

export interface AdminCampaignsStats extends AdminCampaignsSummary {
  evolution: {
    bucket: string;
    created: number;
    published: number;
    finished: number;
  }[];
}

export interface AdminFinancialStats extends AdminFinancialSummary {
  volume_series: {
    bucket: string;
    deposits: number;
    payments: number;
  }[];
}

export interface AdminNicheDistributionItem {
  niche_id: number;
  niche_name: string;
  count: number;
  percentage: number;
}

export type AdminCreatorSizeBucket =
  | "ugc"
  | "nano"
  | "micro"
  | "mid"
  | "macro"
  | "mega";

export interface AdminSizeDistributionItem {
  bucket: AdminCreatorSizeBucket;
  count: number;
  percentage: number;
}

export interface AdminSaasMetrics {
  churn_rate: number;
  ltv_estimate: number;
  arpu: number;
  nrr: number;
  avg_ticket_per_campaign: number;
  activation_rate_new_clients: number;
  avg_customer_lifetime_days: number;
  cac?: number | null;
}

export interface AdminWorkspaceRankingItem {
  workspace_id: string;
  workspace_name: string;
  active_campaigns: number;
  total_volume: number;
  influencers_contracted: number;
}

export interface AdminGeoDistributionItem {
  state: string;
  count: number;
  percentage: number;
}

// ───────────────────────────────────────────────────────────
// Super Admin — Notificações (push / email / whatsapp)
// Detalhes do contrato em `docs/api-super-admin-notifications.md`.
// ───────────────────────────────────────────────────────────

export type AdminNotificationChannel = "push" | "email" | "whatsapp";

export type AdminNotificationStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "partially_failed"
  | "failed"
  | "cancelled";

/** Tipo discriminado de filtro de audiência. */
export type AdminAudienceFilter =
  | { type: "all" }
  | { type: "campaign"; campaign_id: string }
  | { type: "niche"; niche_ids: number[] }
  | { type: "followers"; min_followers: number; max_followers: number }
  | {
      type: "location";
      states?: string[];
      cities?: string[];
    };

export type AdminAudienceFilterType = AdminAudienceFilter["type"];

/** Payload de criação enviado para o backend. */
export interface AdminNotificationCreatePayload {
  title: string;
  body: string;
  cta_url?: string | null;
  channels: AdminNotificationChannel[];
  audience: AdminAudienceFilter;
  /**
   * ISO 8601 com timezone (`2026-05-22T18:30:00-03:00`) quando agendado.
   * `null`/`undefined` = enviar imediatamente.
   */
  scheduled_at?: string | null;
}

/** Resposta de `POST /admin/notifications/estimate-audience`. */
export interface AdminAudienceEstimate {
  total_recipients: number;
  /** Quebra por canal (alguns criadores podem não ter email, etc.). */
  by_channel: Partial<Record<AdminNotificationChannel, number>>;
}

/** Item retornado em `GET /admin/notifications` (lista). */
export interface AdminNotificationListItem {
  id: string;
  title: string;
  body: string;
  cta_url: string | null;
  channels: AdminNotificationChannel[];
  audience: AdminAudienceFilter;
  status: AdminNotificationStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  created_by: { id: number; name: string };
  /** Estatísticas de entrega — populadas após processamento. */
  stats?: {
    total_recipients: number;
    delivered: number;
    failed: number;
  };
}

/** Resposta completa de `GET /admin/notifications/{id}`. */
export interface AdminNotificationDetail extends AdminNotificationListItem {
  per_channel_stats?: Partial<
    Record<
      AdminNotificationChannel,
      { sent: number; delivered: number; failed: number }
    >
  >;
}

/** Papéis em `GET /backoffice/me/workspaces` — @see API_BACKOFFICE_WORKSPACES_AND_PERMISSIONS.md */
export type WorkspaceRole =
  | "owner"
  | "admin"
  | "member"
  | "aprovador"
  | "observador"
  | "juridico"
  | "financeiro"
  | "analista";

/** Permissões calculadas no servidor por workspace (UX; mutações ainda validam 403). */
export interface WorkspacePermissions {
  // Workspace
  workspace_read: boolean;
  workspace_settings_write: boolean;
  workspace_delete: boolean;
  workspace_photo_write: boolean;
  // Membros
  members_list: boolean;
  members_invite: boolean;
  members_remove: boolean;
  members_remove_only_member_role: boolean;
  members_role_write: boolean;
  // Campanhas
  campaigns_read: boolean;
  campaigns_create: boolean;
  campaigns_write: boolean;
  campaigns_delete: boolean;
  campaigns_publish: boolean;
  // Influenciadores
  influencers_read: boolean;
  influencers_invite: boolean;
  influencers_approve: boolean;
  influencers_reject: boolean;
  /** Ver valores/preços dos criadores (custo por criador, negociação, preços por formato). */
  influencer_values_read: boolean;
  // Roteiros
  scripts_read: boolean;
  scripts_write: boolean;
  scripts_approve: boolean;
  scripts_reject: boolean;
  // Conteúdo
  content_read: boolean;
  content_write: boolean;
  content_approve: boolean;
  content_reject: boolean;
  // Contratos
  contracts_read: boolean;
  contracts_write: boolean;
  // Lives da Comunidade (transmissões ao vivo)
  community_lives_read: boolean;
  community_lives_write: boolean;
  // Financeiro
  financial_read: boolean;
  financial_balance_add: boolean;
  financial_payments_approve: boolean;
  financial_reports_export: boolean;
  /** @deprecated use influencers_read */
  catalog_read: boolean;
  catalog_write: boolean;
  /** @deprecated use financial_read */
  billing_read: boolean;
  billing_write: boolean;
}

export interface Workspace {
  id: string; // public_id (UUID)
  name: string;
  photo?: string;
  description?: string | null;
  niche_id?: number | null;
  // Company / legal data
  legal_name?: string | null;
  tax_id?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  unit?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  created_at?: string;
  updated_at?: string;
  role?: WorkspaceRole;
  membership_id?: number;
  joined_at?: string;
  permissions?: WorkspacePermissions;
}

/** Membro do workspace — `GET /backoffice/workspaces/:id/members`. */
export interface WorkspaceMember {
  user_id: number;
  name: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
  /** Permissões customizadas do membro — array de strings retornado pela API. */
  permissions?: string[];
}

export interface Niche {
  /** Inteiro ou string (ex.: UUID), conforme a API. */
  id: number | string;
  parent_id: number | string | null;
  name: string;
}
export interface Campaign {
  id: string; // public_id (UUID)
  title: string;
  description: string;
  objective: string;
  primary_niche?: { id: number; name: string };
  secondary_niches?: Array<{ id: number; name: string }> | number[];
  max_influencers: number;
  payment_method: string;
  payment_method_details?: {
    amount?: number;
    currency?: string;
    description?: string;
  };
  benefits?: string | string[]; // Aceita string (compatibilidade) ou array de strings
  rules_does?: string | string[]; // Aceita string (compatibilidade) ou array de strings
  rules_does_not?: string | string[]; // Aceita string (compatibilidade) ou array de strings
  segment_min_followers?: number;
  segment_state?: string[];
  segment_city?: string[];
  segment_genders?: string[];
  image_rights_period?: number;
  status?: "draft" | "published" | "active" | "completed" | "cancelled";
  banner?: string;
  created_at?: string;
  updated_at?: string;
  // Campos legados para compatibilidade
  niche_id?: number;
  payment_method_label?: string;
  payment_value?: PaymentValue;
  segments?: Segments;
  rules?: Rules;
  benefits_bonus?: string;
}

export interface PaymentValue {
  amount: number;
  currency: string;
  description: string;
}

export interface Segments {
  min_followers: number;
  location: string;
  gender: string;
  social_network: string[];
}

export interface Rules {
  do: string[];
  do_not: string[];
}

export interface Link {
  url?: string;
  label: string;
  page?: number;
  active: boolean;
}

export interface Links {
  first: string;
  last: string;
  prev: any;
  next: string;
}

export interface Meta {
  current_page: number;
  from: number;
  last_page: number;
  links: Link[];
  path: string;
  per_page: number;
  to: number;
  total: number;
}

export interface CampaignProductDraft {
  /** ID gerado no cliente para controle da lista */
  id: string;
  /** ID do produto no backend, presente quando carregado em modo edição */
  serverId?: string;
  name: string;
  description?: string;
  /** Valor de mercado formatado em BRL (ex: "1.500,00") — convertido p/ centavos no envio */
  market_value?: string;
  weight_grams?: string;
  width_cm?: string;
  height_cm?: string;
  length_cm?: string;
  brand?: string;
  sku?: string;
  notes?: string;
  /** URLs de imagens já hospedadas (pós-upload) */
  images?: string[];
  /**
   * Arquivos selecionados localmente, ainda não enviados.
   * - Fluxo de criação: ficam aqui até o produto ser criado; depois o
   *   `createAllCampaignProducts` faz upload em batch.
   * - Fluxo de edição: upload é imediato; este array fica vazio.
   */
  pendingImageFiles?: File[];
}

export interface SocialFormat {
  id: string;
  socialNetwork: string;
  contentType: string;
  quantity: string;
  /** Preço do formato (BRL formatado, ex: "1.500,00") — obrigatório quando paymentType === "fixed" */
  price?: string;
}

export interface CampaignPhase {
  id: string;
  objective: string;
  postDate: string;
  postTime?: string;
  /** Prazo para envio de conteúdo (YYYY-MM-DD, dashboard / API) */
  contentSubmissionDeadline?: string;
  /** Prazo para correção (YYYY-MM-DD) */
  correctionSubmissionDeadline?: string;
  /** Bloqueia o envio de conteúdo até a confirmação de recebimento do produto. */
  requiresProductReceipt?: boolean;
  /** Hashtag da fase (opcional) */
  hashtag?: string;
  /** Sim: incluir direitos (padrão); Não: não incluir */
  includeImageRights?: boolean;
  /** Meses — quando includeImageRights é Sim */
  imageRightsPeriod?: string;
  formats: SocialFormat[];
  files: string;
  /** Ordem da fase (dashboard API) */
  order?: number;
  /** ISO — data de criação da fase (dashboard API) */
  createdAt?: string;
}

export interface CampaignFormData {
  title: string;
  description: string;
  mainNiche: string;
  subniches: string;
  influencersCount: string;
  minFollowers: string;
  state: string;
  city: string;
  gender: string;
  paymentType: string;
  // Campos específicos de pagamento
  paymentFixedAmount: string; // Valor fixo por influenciador
  paymentSwapItem: string; // Item oferecido (Permuta)
  paymentSwapMarketValue: string; // Valor de mercado (Permuta)
  paymentCpaActions: string; // Quais ações geram CPA
  paymentCpaValue: string; // Valor do CPA
  paymentCpmValue: string; // Valor do CPM
  benefitsBonus?: string; // Descrição do bônus por performance (quando toggle ativo)
  benefits: string | string[]; // Aceita string (compatibilidade) ou array de strings
  generalObjective: string;
  whatToDo: string | string[]; // Aceita string (compatibilidade) ou array de strings
  whatNotToDo: string | string[]; // Aceita string (compatibilidade) ou array de strings
  banner: string;
  bannerFile?: File; // Arquivo original do banner para upload
  imageRightsPeriod: string;
  brandFiles: string;
  phasesCount: string;
  phases: CampaignPhase[];
  /** Revisão: campanha pública ou privada */
  campaignVisibility?: "public" | "private";
  /** Produtos da campanha — preenchido quando paymentType === "swap" */
  products?: CampaignProductDraft[];
  /** Nome do nicho primário (API `primary_niche`) para exibição no dashboard */
  primaryNicheName?: string;
  /** Nomes dos nichos raízes vindos da API para exibição no dashboard. */
  nicheNames?: string[];
  /** Nomes dos subnichos (filhos) vindos da API para exibição no dashboard. */
  subNicheNames?: string[];
}

export interface Influencer {
  /** `campaign_users.id` quando vem do dashboard de campanha. */
  id: string;
  /**
   * `users.id` — id interno do usuário. Útil para casar contratos/itens cujo
   * `influencer_id` no backend ainda referencia o user, e não o campaign_user.
   */
  user_id?: string;
  name: string;
  username: string;
  avatar: string;
  followers: number;
  engagement: number;
  niche: string;
  /** Nome legível quando a API envia além do id (ex.: niche_name). */
  nicheName?: string;
  status?:
    | "applications"
    | "pre_selection"
    | "pre_selection_curation"
    | "curation"
    | "invited"
    | "price_proposed"
    | "price_countered"
    | "contract_pending"
    | "approved"
    | "awaiting_shipment"
    | "awaiting_receipt"
    | "script_pending"
    | "content_pending"
    | "pending_approval"
    | "in_correction"
    | "content_approved"
    | "payment_pending"
    | "published"
    | "rejected";
  phase?: string;
  /** campaign_users.id — quando a lista de inscrições vem da API enriquecida */
  campaign_user_id?: string;
  /**
   * Negociação de "valor individual por criador" (payment_method
   * `individual_price`). Presente só quando há negociação em curso/fechada.
   */
  price_negotiation?: {
    proposed_price_cents: number | null;
    counter_price_cents: number | null;
    agreed_price_cents: number | null;
    /** "proposed" | "countered" | "accepted" | "rejected" */
    price_status: string | null;
    /** "invite" | "pre_selection" */
    origin: string | null;
  } | null;
  updated_at?: string;
  is_external?: boolean;
  // Perfis de rede social que se inscreveram na campanha (vem direto da API)
  social_networks?: Array<{
    id: number | string;
    type: string;
    name: string;
    username?: string;
    members?: number;
    /** Foto do perfil na rede (URL/path da API) */
    photo?: string | null;
    status?: Influencer["status"];
    /**
     * Preços por formato (centavos BRL) definidos pelo influenciador.
     * Presente quando o backend inclui — usado para gating de aprovação
     * em campanhas com `payment_method === "price"`.
     */
    prices?: Record<string, number>;
  }>;
}

export interface CampaignContent {
  id: string;
  campaign_id?: string;
  influencer_id?: string;
  influencerId: string;
  influencer_name?: string;
  influencerName: string;
  influencer_avatar?: string;
  influencerAvatar: string;
  social_network?: string;
  socialNetwork: string;
  social_network_type?: string;
  social_network_obj?: {
    id: string;
    type: string;
    name: string;
    username?: string;
  };
  content_type?: string;
  contentType: string;
  content_format?: {
    social_network: string;
    formats: Array<{
      type: string;
      quantity: number;
    }>;
  };
  content_format_type?: string | null;
  preview_url?: string;
  previewUrl: string;
  preview_urls?: string[]; // Array com todas as URLs de preview
  previewUrls?: string[]; // Alias para compatibilidade
  post_url?: string;
  postUrl: string;
  status: "pending" | "awaiting_approval" | "approved" | "content_approved" | "correction" | "rejected" | "published";
  phase?: {
    id: string;
    order: number;
    objective: string;
    publish_date: string;
    publish_time?: string;
    content_submission_deadline?: string;
    correction_submission_deadline?: string;
  };
  phase_id?: string | null;
  submitted_at?: string;
  submittedAt: string;
  published_at?: string | null;
  publishedAt?: string;
  feedback?: string | null;
  // Legenda enviada pelo influenciador (compatível com diferentes formatos da API)
  caption?: string | null;
  caption_feedback?: string | null;
  metadata?: {
    content_format_type?: string;
  } | null;
  ai_evaluation?: any | null;
}

export interface CampaignScript {
  id: string;
  campaign_id?: string;
  influencer_id?: string;
  influencerId?: string;
  influencer_name?: string;
  influencerName?: string;
  influencer_avatar?: string;
  influencerAvatar?: string;
  social_network?: string;
  social_network_type?: string;
  social_network_obj?: {
    id: string;
    type: string;
    name: string;
  };
  content_format?: {
    social_network: string;
    formats: Array<{
      type: string;
      quantity: number;
    }>;
  } | Array<{
    social_network: string;
    formats: Array<{
      type: string;
      quantity: number;
    }>;
  }>;
  content_format_type?: string | null;
  metadata?: {
    content_format_type?: string;
  } | null;
  phase?: {
    id: string;
    order: number;
    objective: string;
    publish_date: string;
    publish_time?: string;
  };
  script?: string;
  script_text?: string;
  scriptText?: string;
  file_url?: string;
  status: "pending" | "awaiting_approval" | "approved" | "correction" | "rejected";
  phase_id?: string | null;
  submitted_at?: string;
  submittedAt?: string;
  approved_at?: string;
  feedback?: string | null;
}

/** Formato bruto retornado pela API para `social_network` — pode ser string ou objeto. */
type RawSocialNetwork =
  | string
  | { id?: string; type: string; name?: string; username?: string }
  | undefined
  | null;

/**
 * Resposta bruta da API para conteúdos antes da normalização.
 * `social_network` chega como string ou objeto dependendo do endpoint.
 */
export interface RawCampaignContentResponse {
  id: string;
  campaign_id?: string;
  influencer_id?: string;
  influencerId?: string;
  influencer_name?: string;
  influencerName?: string;
  influencer_avatar?: string;
  influencerAvatar?: string;
  social_network?: RawSocialNetwork;
  socialNetwork?: string;
  social_network_type?: string;
  content_type?: string;
  contentType?: string;
  content_format?: CampaignContent["content_format"];
  content_format_type?: string | null;
  preview_url?: string;
  previewUrl?: string;
  preview_urls?: string[];
  previewUrls?: string[];
  post_url?: string;
  postUrl?: string;
  status: CampaignContent["status"];
  phase?: CampaignContent["phase"];
  phase_id?: string | null;
  phaseId?: string;
  submitted_at?: string;
  submittedAt?: string;
  published_at?: string | null;
  publishedAt?: string;
  feedback?: string | null;
  caption?: string | null;
  caption_feedback?: string | null;
  metadata?: { content_format_type?: string } | null;
  ai_evaluation?: unknown | null;
}

/**
 * Resposta bruta da API para roteiros antes da normalização.
 * `social_network` chega como string ou objeto dependendo do endpoint.
 */
export interface RawCampaignScriptResponse {
  id: string;
  campaign_id?: string;
  influencer_id?: string;
  influencer_name?: string;
  influencer_avatar?: string;
  social_network?: RawSocialNetwork;
  social_network_type?: string;
  content_format?: CampaignScript["content_format"];
  content_format_type?: string | null;
  metadata?: { content_format_type?: string } | null;
  phase?: CampaignScript["phase"];
  script?: string;
  file_url?: string;
  status: CampaignScript["status"];
  phase_id?: string | null;
  submitted_at?: string;
  approved_at?: string;
  feedback?: string | null;
}

export interface ContentMetrics {
  contentId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  reach: number;
}

export interface InfluencerList {
  id: string;
  name: string;
  createdAt: string;
  influencerIds: string[];
}

export interface ChatMessage {
  id: string;
  campaign_id: string;
  campaign_user_id?: number; // ID do campaign_users (apenas em WebSocket)
  influencer_id?: string; // ID do influenciador (apenas em REST API)
  sender_id: string; // ID do usuário remetente
  sender_name: string; // Nome do remetente
  sender_avatar: string | null; // URL do avatar ou null
  message: string; // Texto da mensagem
  attachments: string[]; // Array de URLs de arquivos anexados
  read_at: string | null; // ISO 8601 timestamp quando foi lida, ou null
  created_at: string; // ISO 8601 timestamp de criação
  // Campos legados para compatibilidade
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  timestamp?: string;
  isFromInfluencer?: boolean;
}

export interface AIEvaluation {
  score: number;
  feedback: string;
  compliance: {
    mentionsBrand: boolean;
    usesHashtag: boolean;
    showsProduct: boolean;
    followsGuidelines: boolean;
  };
  suggestions: string[];
}

export interface InfluencerEvaluation {
  influencerId: string;
  rating: number;
  feedback: string;
  performance: "excellent" | "good" | "average" | "poor";
  wouldWorkAgain: boolean;
}

export interface IdentifiedPost {
  id: string;
  influencerId: string;
  influencerName: string;
  influencerAvatar: string;
  socialNetwork: string;
  contentType: string;
  postUrl: string;
  previewUrl: string;
  phaseId: string;
  phaseHashtag: string;
  publishedAt: string;
  metrics?: ContentMetrics;
}

export type ContractType = "platform" | "custom";

export type ContractStatus =
  | "pending"
  | "sent"
  | "viewed"
  | "signed"
  | "rejected"
  | "expired";

/**
 * Item retornado por `GET /campaigns/:id/contracts`. Modelado em snake_case
 * exatamente como o backend entrega — evita uma camada de normalização.
 *
 * IMPORTANTE: `id === null` significa "linha pending sintética" — um
 * influenciador em `contract_pending` que ainda não teve contrato gerado.
 * Use `campaign_user_id` como chave estável (sempre presente).
 */
export interface CampaignContract {
  /** UUID do contrato. `null` para linhas pending sintéticas geradas pelo backend. */
  id: string | null;
  /** UUID público do `campaign_users` — chave para todas as ações (enviar/reenviar/baixar). */
  campaign_user_id: string;

  contract_type: ContractType | null;
  status: ContractStatus;

  /** Provedor de assinatura eletrônica (ex.: "docusign"). */
  automation_provider: string | null;
  automation_operation_id: string | null;

  representative_email: string | null;
  witness_1_email: string | null;
  witness_2_email: string | null;

  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  rejected_at: string | null;
  expiration_at: string | null;
  created_at: string | null;

  rejection_reason: string | null;
  /** URL direta do PDF assinado quando `status === "signed"`. */
  signed_file_url: string | null;

  /** Status do influenciador no kanban — embutido no payload para UX. */
  kanban_status: string | null;

  /** Espelho do influenciador, para evitar lookup cruzado no front. */
  influencer_id: number | string | null;
  influencer_name: string;
  influencer_photo: string | null;
}

/**
 * Defaults de contrato salvos por workspace — pré-preenchem o modal de envio
 * a partir do 2º contrato. Backend faz upsert após cada envio bem-sucedido.
 */
export interface WorkspaceContractDefaults {
  representative_email?: string;
  witness_1_email?: string;
  witness_2_email?: string;
  brand_legal_name?: string;
  brand_cnpj?: string;
  brand_address?: string;
  representative_name?: string;
  representative_cpf?: string;
}

/**
 * Variável dinâmica de contrato (`{{nome_variavel}}`) — listada no painel
 * lateral quando o usuário opta por upload de contrato próprio.
 */
export interface ContractVariable {
  /** Tag literal sem chaves (ex.: "influencer_name"). */
  key: string;
  /** Tag completa renderizada (ex.: "{{influencer_name}}"). */
  tag: string;
  label: string;
  description?: string;
  group: "influencer" | "brand" | "campaign";
}
// ---------------------------------------------------------------------------
// Lives da Comunidade (transmissões ao vivo) — LiveKit/WebRTC.
// Contrato: hypeapp-api/docs/backoffice-community-lives.md
// ---------------------------------------------------------------------------

/**
 * Máquina de estados:
 *  upcoming → live → ended
 *  upcoming → cancelled
 */
export type LiveStatus = "upcoming" | "live" | "ended" | "cancelled";

/** Estado do processamento da gravação (VOD). */
export type LiveRecordingStatus = "none" | "processing" | "ready" | "failed";

/** Filtro de status na listagem (`past` agrega `ended`). */
export type LiveStatusFilter = "live" | "upcoming" | "past" | "cancelled" | "all";

/** Membro do backoffice que criou a live. */
export interface LiveCreator {
  id: string;
  name: string;
  avatar_url: string | null;
}

/** Objeto `Live` (gestão no backoffice) — §4 do doc de backend. */
export interface Live {
  id: string; // public_id (UUID)
  title: string;
  description: string | null;
  /** URL absoluta (upload prévio em /community/lives/uploads). */
  thumbnail_url: string | null;
  host_display_name: string | null;
  status: LiveStatus;
  scheduled_at: string; // ISO (sempre presente)
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  views_count: number;
  likes_count: number;
  recording_status: LiveRecordingStatus;
  /** Playback do VOD quando `recording_status === "ready"`. */
  recording_url: string | null;
  creator: LiveCreator;
  created_at: string;
  updated_at: string;
}

/**
 * Credenciais de transmissão do criador (LiveKit). Efêmeras — retornadas só por
 * `POST /:id/start` e `POST /:id/broadcaster-token`. Nunca persistir além do
 * necessário para a conexão; renovar via `/broadcaster-token` ao expirar.
 */
export interface BroadcasterCredentials {
  provider: string; // "livekit"
  url: string; // wss://... endpoint do LiveKit
  room: string; // nome da sala (== live id)
  token: string; // JWT de PUBLISH (TTL curto)
  identity: string; // identidade do publicador na sala
  expires_at: string; // ISO
}

/** Resposta de `POST /:id/start`. */
export interface StartLiveResponse {
  live: Live;
  broadcaster: BroadcasterCredentials;
}

/** Payload de criação/agendamento — `POST /community/lives`. */
export interface CreateLivePayload {
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  host_display_name?: string | null;
  /** ISO 8601 UTC. Futuro = agenda; agora/passado = abrir já (depois chamar /start). */
  scheduled_at: string;
}

/** Payload de edição (apenas `upcoming`) — `PATCH /community/lives/:id`. */
export interface UpdateLivePayload {
  title?: string;
  description?: string | null;
  thumbnail_url?: string | null;
  host_display_name?: string | null;
  scheduled_at?: string;
}

/** Meta de paginação por cursor opaco. */
export interface CursorMeta {
  next_cursor: string | null;
  has_more: boolean;
}

/** Página de lives. */
export interface LivePage {
  items: Live[];
  meta: CursorMeta;
}

/** Autor de um comentário no chat ao vivo (frame do WS). */
export interface LiveCommentAuthor {
  id: string;
  name: string;
  username?: string;
  avatar_url: string | null;
}

/** Comentário do chat ao vivo — frame `comment` do namespace `/community/live`. */
export interface LiveComment {
  id: string;
  live_id: string;
  author: LiveCommentAuthor;
  content: string;
  created_at: string;
}

// ===========================================================================
// Comunidade ▸ Grupos (backoffice/super-admin)
// Contrato: backend-community-groups-spec.md (rotas §4, escopo global sem
// `Workspace-Id`, protegidas por `PlatformAdminGuard`).
// ===========================================================================

/** Filtro de status na listagem admin (`active` é o default do backend). */
export type GroupStatusFilter = "active" | "deleted" | "all";

/** Moderador/admin de um grupo (lista exibida no detalhe). */
export interface CommunityGroupModerator {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

/**
 * Grupo da comunidade (visão de backoffice).
 *
 * `cover_url` é a identidade visual primária (imagem enviada). `icon_name`/
 * `icon_color` permanecem como fallback legado para grupos antigos sem capa —
 * resolver `cover_url` com `getUploadUrl()` antes de renderizar.
 */
export interface CommunityGroup {
  id: string; // public_id (UUID)
  name: string;
  description: string;
  cover_url: string | null;
  /** Legado/fallback — só quando `cover_url` é null. */
  icon_name: string | null;
  /** Legado/fallback — hex sem `#`. */
  icon_color: string | null;
  required_level: number | null;
  required_hype_points: number | null;
  members_count: number;
  is_official: boolean;
  // Campos exclusivos do contexto admin (§4.1):
  posts_count?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Detalhe do grupo (§4.2) — inclui regras e moderadores. */
export interface CommunityGroupDetail extends CommunityGroup {
  rules: string | null;
  moderators: CommunityGroupModerator[];
}

/** Página de grupos (cursor). */
export interface CommunityGroupPage {
  items: CommunityGroup[];
  meta: CursorMeta;
}

/**
 * Payload de criação — `POST /admin/community/groups` (§4.3).
 *
 * Requisitos de entrada são **combináveis**: `required_level` e
 * `required_hype_points` podem coexistir; ambos `null`/`0` = grupo aberto.
 */
export interface CreateGroupPayload {
  name: string;
  description: string;
  cover_url?: string | null;
  required_level?: number | null;
  required_hype_points?: number | null;
  is_official?: boolean;
  rules?: string | null;
  /** Seed inicial de moderadores (cria membership role=moderator). */
  moderator_user_ids?: string[];
}

/** Payload de edição parcial — `PATCH /admin/community/groups/:id` (§4.4). */
export type UpdateGroupPayload = Partial<CreateGroupPayload>;

/** Autor de um post (moderação de conteúdo). */
export interface GroupPostAuthor {
  id: string;
  name: string;
  username?: string;
  avatar_url: string | null;
}

/** Post de um grupo (moderação — §4.7). */
export interface GroupPost {
  id: string; // public_id
  content: string;
  image_url: string | null;
  /** Vídeo do post (migration 089). Quando presente, substitui a imagem. */
  video_url: string | null;
  /** Poster do vídeo (primeiro frame). `null` = player abre no fundo preto. */
  video_thumbnail_url: string | null;
  author: GroupPostAuthor;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

/** Página de posts do grupo (cursor). */
export interface GroupPostPage {
  items: GroupPost[];
  meta: CursorMeta;
}
