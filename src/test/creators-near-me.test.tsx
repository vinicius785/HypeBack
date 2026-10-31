import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/screens/(private)/(app)/creators";
import type { CatalogItem } from "@/shared/services/creators-catalog";

const catalog = vi.hoisted(() => ({ items: [] as CatalogItem[], cached: null as unknown }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({ selectedWorkspace: { id: "w1", name: "Marca" } }),
  useWorkspacePermissions: () => ({ catalog_read: true, catalog_write: false }),
}));
vi.mock("@/hooks/use-niches", () => ({ useNiches: () => ({ data: [] }) }));
vi.mock("@/hooks/use-influencer-lists", () => ({
  useInfluencerLists: () => ({ data: [], isLoading: false }),
  useInfluencerList: () => ({ data: undefined, isLoading: false }),
  useInfluencerMembershipMap: () => new Map(),
}));
vi.mock("@/hooks/use-influencer-accounts", () => ({ useInfluencerAccounts: () => ({}) }));
vi.mock("@/hooks/use-creators-catalog", () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    // Resultado estável entre renders (como o do React Query), para a tela não entrar em laço.
    useCreatorsCatalog: () => {
      const cached = catalog.cached as { items: CatalogItem[]; result: unknown } | null;
      if (cached && cached.items === catalog.items) return cached.result;
      const result = {
        data: { pages: [{ items: catalog.items, hasMore: false, page: 1 }] },
        isLoading: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
      };
      catalog.cached = { items: catalog.items, result };
      return result;
    },
    useCreateInfluencerList: mutation,
    useUpdateInfluencerList: mutation,
    useDeleteInfluencerList: mutation,
    useAddToInfluencerList: mutation,
    useRemoveFromInfluencerList: mutation,
  };
});
// Leaflet fica de fora: aqui só importa se o mapa está ou não na tela.
vi.mock("@/components/creators/near-me-map", async () => {
  const React = await import("react");
  return { NearMeMap: () => React.createElement("div", { "data-testid": "near-me-map" }) };
});
vi.mock("@/components/influencer-profile/profile-drawer", () => ({ InfluencerProfileDrawer: () => null }));
vi.mock("@/components/influencer-lists/campaign-picker-modal", () => ({ CampaignPickerModal: () => null }));
vi.mock("@/components/influencer-lists/list-membership-modal", () => ({ ListMembershipModal: () => null }));
vi.mock("@/components/influencer-lists/invite-networks-modal", () => ({ InviteNetworksModal: () => null }));

const Page = (Route as unknown as { options: { component: () => React.ReactElement } }).options.component;

const creator = (id: number): CatalogItem => ({
  social_network: { id: 100 + id, type: "instagram", name: `Criador ${id}`, username: `criador${id}`, members: 1000, photo: null, engagement_percent: 3 },
  user: { id, name: `Criador ${id}`, photo: null, gender: null },
  niches: [],
  distance_km: id,
  approx_location: { lat: -23.55, lng: -46.63, precision_km: 1 },
});

beforeEach(() => {
  catalog.items = [creator(1), creator(2)];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: -23.55, longitude: -46.63 } }),
    },
  });
});

const mapButton = () => screen.getByRole("button", { name: "Mapa" });
const cardsButton = () => screen.getByRole("button", { name: "Cartões" });
const nearChip = () => screen.getByRole("button", { name: "Remover filtro Perto de mim" });

/** Abre o mapa e liga "Perto de mim" pelo botão do próprio mapa. */
async function openMapWithLocation() {
  render(<Page />);
  fireEvent.click(mapButton());
  fireEvent.click(screen.getByRole("button", { name: /Usar minha localização/ }));
  await screen.findByTestId("near-me-map");
}

function expectBackToCards() {
  expect(screen.queryByTestId("near-me-map")).toBeNull();
  expect(screen.queryByText("Veja os criadores no mapa")).toBeNull();
  expect(cardsButton()).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("button", { name: "Remover filtro Perto de mim" })).toBeNull();
}

describe("Criadores · tirar 'Perto de mim' estando no mapa", () => {
  it("clicar no filtro ativo volta para os cartões, sem pedir a localização de novo", async () => {
    await openMapWithLocation();
    fireEvent.click(nearChip());
    expectBackToCards();
  });

  it("'Limpar filtros' também sai do mapa", async () => {
    await openMapWithLocation();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expectBackToCards();
  });

  it("remover 'Perto de mim' no painel de filtros também sai do mapa", async () => {
    await openMapWithLocation();
    fireEvent.click(document.querySelector(".cx-fb")!);
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expectBackToCards();
  });

  it("nos cartões, tirar o filtro mantém os cartões", async () => {
    await openMapWithLocation();
    fireEvent.click(cardsButton());
    fireEvent.click(nearChip());
    expect(cardsButton()).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Remover filtro Perto de mim" })).toBeNull();
  });
});

describe("Criadores · entrar no mapa sem localização", () => {
  it("continua oferecendo usar a localização (é o caminho de entrada do mapa)", () => {
    render(<Page />);
    fireEvent.click(mapButton());
    expect(screen.getByText("Veja os criadores no mapa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar minha localização/ })).toBeInTheDocument();
    expect(mapButton()).toHaveAttribute("aria-pressed", "true");
  });
});
