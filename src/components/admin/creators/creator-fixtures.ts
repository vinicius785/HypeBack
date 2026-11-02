/** Respostas de exemplo tipadas pelo contrato (`admin-platform.types.ts`) para os testes de Criadores. */
import type { AdminListResult } from "@/lib/admin/admin-client";
import type {
  AdminCreatorListItem,
  AdminDuplicateGroup,
  AdminInconsistency,
  AdminPageMeta,
} from "@/shared/admin-platform.types";

type Registration = AdminCreatorListItem["registration"];

const COMPLETE_FLAGS: Registration["flags"] = {
  email_verified: true,
  phone_verified: true,
  has_photo: true,
  has_document: true,
  has_birth_date: true,
  has_gender: true,
  has_address: true,
  has_niche: true,
  has_active_network: true,
  is_external: false,
};

export const COMPLETE: Registration = { state: "complete", flags: COMPLETE_FLAGS, missing: [] };

export const INCOMPLETE: Registration = {
  state: "incomplete",
  flags: { ...COMPLETE_FLAGS, phone_verified: false, has_photo: false, has_document: false, has_gender: false },
  missing: ["Telefone não verificado", "Sem foto de perfil", "Sem documento (CPF)", "Sem gênero informado"],
};

export const STUB: Registration = {
  state: "stub",
  flags: { ...COMPLETE_FLAGS, email_verified: false, is_external: true },
  missing: ["E-mail não verificado"],
};

export function makeCreator(overrides: Partial<AdminCreatorListItem> = {}): AdminCreatorListItem {
  return {
    id: 1046,
    name: "Rafael Borges Mendes",
    email: "rafael.borges@hotmail.test",
    photo: null,
    status: "active",
    created_at: "2025-03-19T12:55:07.998Z",
    registration: COMPLETE,
    networks: [
      { type: "instagram", username: "rafael", followers: 4290, disabled: false },
      { type: "tiktok", username: "@rafael_tt", followers: 2_708_790, disabled: false },
    ],
    followers_total: 2_713_080,
    has_ugc: false,
    campaigns_count: 27,
    first_campaign: {
      workspace: { id: "7a1e0000-0000-4000-8000-000000000022", name: "Pizzaria Forno Antigo" },
      campaign: { id: "ca3b0000-0000-4000-8000-000000000051", title: "Páscoa Pizzaria Forno Antigo" },
      at: "2025-05-20T12:12:51.230Z",
    },
    ...overrides,
  };
}

export const INCOMPLETE_CREATOR = makeCreator({
  id: 1112,
  name: "Jéssica Moraes",
  email: "jessica.moraes@uol.test",
  created_at: "2026-03-18T00:01:54.747Z",
  registration: INCOMPLETE,
  networks: [
    { type: "youtube", username: "JéssicaMoraes", followers: 18_070, disabled: false },
    { type: "instagram_facebook", username: "jessica64", followers: 39_690, disabled: true },
  ],
  followers_total: 18_070,
  has_ugc: true,
  campaigns_count: 0,
  first_campaign: null,
});

export const STUB_CREATOR = makeCreator({
  id: 1143,
  name: "Natália Correia",
  email: "natalia.correia@gmail.test",
  status: "suspended",
  registration: STUB,
  networks: [],
  followers_total: 0,
  has_ugc: true,
  campaigns_count: 2,
});

export const CREATOR_DEFINITIONS: Record<string, string> = {
  registration: 'Completo = todos os dados mínimos; incompleto = falta algo (ver "missing"); conta externa = criada por convite.',
  followers_total: "Soma dos seguidores das redes ativas (redes desativadas não entram).",
  first_campaign: 'Não existe "workspace de origem": é a PRIMEIRA campanha em que o criador participou (derivado).',
};

export function pageOf<T>(data: T[], meta: Partial<AdminPageMeta> = {}): AdminListResult<T> {
  return {
    data,
    meta: { page: 1, per_page: 25, total: data.length, total_pages: data.length > 0 ? 1 : 0, ...meta },
  };
}

export const DUPLICATE_GROUP: AdminDuplicateGroup = {
  key: "email:0782db95d0",
  reason: "email",
  confidence: "high",
  match_masked: "j***@outlook.test",
  users: [
    {
      id: 1031,
      name: "Júlio Borges Mendes",
      email_masked: "j***@outlook.test",
      created_at: "2024-12-17T04:54:22.453Z",
      is_external: false,
      networks_count: 1,
      campaigns_count: 6,
    },
    {
      id: 1071,
      name: "Camila Prado",
      email_masked: "j***@outlook.test",
      created_at: "2025-08-09T06:08:09.801Z",
      is_external: true,
      networks_count: 0,
      campaigns_count: 2,
    },
  ],
};

export const POSSIBLE_DUPLICATE_GROUP: AdminDuplicateGroup = {
  key: "social_handle:ab12cd34ef",
  reason: "social_handle",
  confidence: "possible",
  match_masked: "@mar*** (em redes diferentes)",
  users: [
    {
      id: 1002,
      name: "Vanessa Mendes",
      email_masked: "v***@gmail.test",
      created_at: "2025-01-10T10:00:00.000Z",
      is_external: false,
      networks_count: 2,
      campaigns_count: 4,
    },
    {
      id: 1003,
      name: "Vanessa M. Souza",
      email_masked: "v***@uol.test",
      created_at: "2025-02-11T10:00:00.000Z",
      is_external: false,
      networks_count: 1,
      campaigns_count: 0,
    },
  ],
};

export const INCONSISTENCIES: AdminInconsistency[] = [
  {
    code: "CREATOR_WITHOUT_ACTIVE_NETWORK",
    kind: "suggestion",
    title: "Criadores sem rede social ativa",
    description: "Heurística: criadores sem nenhuma rede ativa dificilmente participam de campanhas.",
    count: 8,
    samples: [{ type: "user", id: 1201, label: "Ana Clara Dias" }],
  },
  {
    code: "WORKSPACE_WITHOUT_OWNER",
    kind: "alert",
    title: "Workspaces de marca sem proprietário",
    description: 'Há membros, mas nenhum com o papel "proprietário".',
    count: 3,
    samples: [
      { type: "workspace", id: "7a1e0000-0000-4000-8000-000000000011", label: "Pet Amigo Fiel" },
      { type: "workspace", id: "7a1e0000-0000-4000-8000-000000000020", label: "Cosméticos Flor do Cerrado" },
      { type: "workspace", id: "7a1e0000-0000-4000-8000-000000000022", label: "Pizzaria Forno Antigo" },
    ],
  },
  {
    code: "FINISHED_CAMPAIGN_WITH_RESERVED",
    kind: "alert",
    title: "Campanhas finalizadas ainda com reserva",
    description: "Campanha finalizada com entradas reservadas.",
    count: 1,
    samples: [{ type: "campaign", id: "ca3b0000-0000-4000-8000-000000000003", label: "Novidades da temporada (R$ 250,00)" }],
  },
];
