import { describe, it, expect } from "vitest";
import {
  mapInscriptionApiRowToInfluencer,
  type InscriptionApiRow,
} from "./campaign-tab-influencers";

function row(partial: Partial<InscriptionApiRow> = {}): InscriptionApiRow {
  return {
    campaign_user_id: "10",
    user_id: "99",
    user: { id: "99", name: "Ana Souza" },
    status: "applications",
    social_network: {
      id: 5,
      type: "instagram",
      name: "Instagram",
      username: "anasouza",
      members: 12500,
    },
    ...partial,
  };
}

describe("mapInscriptionApiRowToInfluencer — seguidores", () => {
  it("usa members do perfil da rede", () => {
    expect(mapInscriptionApiRowToInfluencer(row()).followers).toBe(12500);
  });

  it("expõe members também na rede social do card", () => {
    const inf = mapInscriptionApiRowToInfluencer(row());
    expect(inf.social_networks?.[0]?.members).toBe(12500);
  });

  it("cai para 0 quando a rede não tem members", () => {
    const inf = mapInscriptionApiRowToInfluencer(
      row({
        social_network: { id: 5, type: "instagram", name: "Instagram", members: null },
      })
    );
    expect(inf.followers).toBe(0);
  });
});

describe("mapInscriptionApiRowToInfluencer — engajamento", () => {
  // Regressão: nas abas Inscrições/Curadoria o backend calcula `engagement` a
  // partir das publicações identificadas DAQUELA campanha, que é sempre 0 para
  // quem acabou de se inscrever. O valor útil é o do perfil
  // (`social_network.engagement_percent`).
  it("prefere o engajamento do perfil ao 0 da campanha", () => {
    const inf = mapInscriptionApiRowToInfluencer(
      row({
        engagement: 0,
        social_network: {
          id: 5,
          type: "instagram",
          name: "Instagram",
          members: 12500,
          engagement_percent: 4.2,
        },
      })
    );
    expect(inf.engagement).toBe(4.2);
  });

  it("aceita engagement_percent na raiz da linha", () => {
    const inf = mapInscriptionApiRowToInfluencer(
      row({ engagement: 0, engagement_percent: 3.1 })
    );
    expect(inf.engagement).toBe(3.1);
  });

  it("o perfil tem precedência sobre a raiz", () => {
    const inf = mapInscriptionApiRowToInfluencer(
      row({
        engagement: 1,
        engagement_percent: 3.1,
        social_network: {
          id: 5,
          type: "instagram",
          name: "Instagram",
          members: 12500,
          engagement_percent: 4.2,
        },
      })
    );
    expect(inf.engagement).toBe(4.2);
  });

  it("mantém o engajamento da campanha quando não há métrica de perfil", () => {
    const inf = mapInscriptionApiRowToInfluencer(row({ engagement: 2.5 }));
    expect(inf.engagement).toBe(2.5);
  });

  it("engagement_percent null (métricas não calculadas) não sobrescreve a campanha", () => {
    const inf = mapInscriptionApiRowToInfluencer(
      row({
        engagement: 2.5,
        social_network: {
          id: 5,
          type: "instagram",
          name: "Instagram",
          members: 12500,
          engagement_percent: null,
        },
      })
    );
    expect(inf.engagement).toBe(2.5);
  });

  it("sem nenhuma fonte, cai para 0", () => {
    const inf = mapInscriptionApiRowToInfluencer(row({ engagement: null }));
    expect(inf.engagement).toBe(0);
  });
});

describe("mapInscriptionApiRowToInfluencer — nichos", () => {
  it("preserva o rótulo de nicho + sub-nichos enviado pela API", () => {
    const inf = mapInscriptionApiRowToInfluencer(
      row({ niche: "Moda, Beleza, Skincare" })
    );
    expect(inf.niche).toBe("Moda, Beleza, Skincare");
  });

  it("usa niche_name quando a API envia o nome separado", () => {
    const inf = mapInscriptionApiRowToInfluencer(
      row({ niche_id: 7, niche_name: "Games" })
    );
    expect(inf.niche).toBe("7");
    expect(inf.nicheName).toBe("Games");
  });

  it("sem nicho, o campo fica vazio (card não renderiza chips)", () => {
    expect(mapInscriptionApiRowToInfluencer(row()).niche).toBe("");
  });
});
