/**
 * Pop-ups do Admin.
 *
 * O QUE PRECISA FUNCIONAR: listar com status, vistos, cliques e taxa; criar com as opções vindas da API e a prévia ao vivo;
 * editar; duplicar com o início vazio; excluir; filtrar por status.
 * O QUE NÃO PODE ACONTECER: lista de ícones, temas ou telas fixa no código; campo de fim; salvar botão sem destino.
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminGet: vi.fn(), adminPostPlain: vi.fn(), adminPatchPlain: vi.fn(), adminDelete: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/admin-client")>()),
  adminGet: mocks.adminGet,
  adminPostPlain: mocks.adminPostPlain,
  adminPatchPlain: mocks.adminPatchPlain,
  adminDelete: mocks.adminDelete,
}));
vi.mock("@/hooks/admin/use-admin-queries", () => ({ useAdminList: () => ({ data: { data: [{ id: "camp1", title: "Campanha Verão" }] }, isLoading: false }) }));

import type { Popup, PopupOptions } from "@/shared/popups.types";

import { renderRoutes } from "../users/admin-users-test-utils";
import { AdminPopupsPage } from "./popups-page";

const OPTIONS: PopupOptions = {
  themes: ["light", "dark"],
  icons: ["gift", "trophy"],
  screens_without_id: ["home", "wallet"],
  screens_with_id: [{ screen: "campaign_detail", id_field: "campaign_id" }],
  external_url_hosts: ["hypeapp.com.br"],
  reward_points: { min: 1, max: 100 },
};

const LIVE: Popup = {
  id: "p1",
  title: "Black Friday chegou",
  body: "Confira as campanhas",
  image_url: null,
  theme: "dark",
  icon: "gift",
  button_label: "Ver carteira",
  target: { version: 1, screen: "wallet" },
  audience: "all",
  campaign_id: null,
  priority: 5,
  starts_at: "2026-11-17T12:00:00.000Z",
  expires_at: "2026-11-18T12:00:00.000Z",
  status: "live",
  views: 120,
  clicks: 31,
  dismissals: 80,
  created_at: "2026-11-16T12:00:00.000Z",
};
const PRIZE: Popup = { ...LIVE, id: "p3", title: "Bônus de boas-vindas", status: "expired", views: 0, clicks: 0, dismissals: 0, reward_points: 50, reward_label: "+50 Hype Points" };
const OLD: Popup = { ...LIVE, id: "p2", title: "Aviso antigo", status: "expired", views: 0, clicks: 0, dismissals: 0 };

function page() {
  return renderRoutes([{ path: "/", component: AdminPopupsPage }], "/");
}

beforeEach(() => {
  mocks.adminGet.mockImplementation(async (path: string) => (path.endsWith("/options") ? OPTIONS : [LIVE, OLD, PRIZE]));
  mocks.adminPostPlain.mockResolvedValue(LIVE);
  mocks.adminPatchPlain.mockResolvedValue(LIVE);
  mocks.adminDelete.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Pop-ups", () => {
  it("lista com status, vistos, cliques e taxa de clique (traço sem visualização)", async () => {
    page();
    const row = (await screen.findByText("Black Friday chegou")).closest("[role=row]") as HTMLElement;
    expect(within(row).getByText("No ar")).toBeInTheDocument();
    expect(within(row).getByText("120")).toBeInTheDocument();
    expect(within(row).getByText("25,8%")).toBeInTheDocument();
    const old = screen.getByText("Aviso antigo").closest("[role=row]") as HTMLElement;
    expect(within(old).getByText("Expirado")).toBeInTheDocument();
    expect(within(old).getByText("—")).toBeInTheDocument();
  });

  it("a ilha mostra o pop-up no ar (animação de chegada) e as contagens por situação", async () => {
    page();
    const island = await screen.findByLabelText("Resumo dos pop-ups");
    await screen.findByText("Black Friday chegou");
    expect(within(island).getByRole("status", { name: /No ar: “Black Friday chegou”, 120 vistos/, hidden: true })).toBeInTheDocument();
    expect(within(island).getByRole("button", { name: /^Todos\s*3/ })).toBeInTheDocument();
    expect(within(island).getByRole("button", { name: /^No ar\s*1/ })).toBeInTheDocument();
  });

  it("filtra por status", async () => {
    const user = userEvent.setup();
    page();
    await screen.findByText("Black Friday chegou");
    await user.click(screen.getByRole("button", { name: /^Expirados/ }));
    expect(screen.queryByText("Black Friday chegou")).not.toBeInTheDocument();
    expect(screen.getByText("Aviso antigo")).toBeInTheDocument();
  });

  it("cria em três passos, com ícones e telas vindos da API e a prévia ao vivo", async () => {
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole("button", { name: /Novo pop-up/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo pop-up" });
    await within(dialog).findByRole("radio", { name: "trophy" });
    expect(within(dialog).queryByLabelText(/^Fim/)).not.toBeInTheDocument();

    // passo 1: conteúdo, com a prévia mudando na hora
    await user.type(within(dialog).getByLabelText(/Título/), "Oi pessoal");
    expect(within(within(dialog).getByRole("figure", { name: "Prévia do pop-up" })).getByText("Oi pessoal")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "Preto" }));
    expect(dialog.querySelector(".adm-pop-card")).toHaveAttribute("data-theme", "dark");
    await user.click(within(dialog).getByRole("radio", { name: "gift" }));
    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));

    // passo 2: botão e destino andam juntos
    await user.type(await within(dialog).findByLabelText(/Texto do botão/), "Ver carteira");
    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));
    expect(await within(dialog).findByText(/Escolha para qual página/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("Para qual página vai"), "wallet");
    expect(within(dialog).getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Alta" }));
    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));

    // passo 3: começa agora, vale 1 dia, sem campo de fim
    expect(await within(dialog).findByText("1 dia")).toBeInTheDocument();
    expect(within(dialog).getByText(/Não existe campo de fim/)).toBeInTheDocument();
    expect(mocks.adminPostPlain).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Criar pop-up" }));
    await waitFor(() =>
      expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/popups", {
        title: "Oi pessoal",
        theme: "dark",
        icon: "gift",
        button_label: "Ver carteira",
        target: { version: 1, screen: "wallet" },
        audience: "all",
        priority: 90,
      }),
    );
  });

  it("não deixa continuar sem título", async () => {
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole("button", { name: /Novo pop-up/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo pop-up" });
    await within(dialog).findByRole("radio", { name: "trophy" });
    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));
    expect(await within(dialog).findByText("Informe o título.")).toBeInTheDocument();
  });

  it("editar manda null para o que foi esvaziado e mantém o início; duplicar abre sem início", async () => {
    const user = userEvent.setup();
    page();
    const row = (await screen.findByText("Black Friday chegou")).closest("[role=row]") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /Ações de/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicar" }));
    const copy = await screen.findByRole("dialog", { name: "Novo pop-up" });
    expect(within(copy).getByLabelText(/Título/)).toHaveValue("Black Friday chegou");
    await user.click(within(copy).getByRole("button", { name: /Continuar/ }));
    await user.click(await within(copy).findByRole("button", { name: /Continuar/ }));
    expect(await within(copy).findByRole("button", { name: /Começar agora/ })).toHaveClass("on");
    await user.click(within(copy).getByRole("button", { name: "Fechar" }));

    await user.click(within(row).getByRole("button", { name: /Ações de/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const edit = await screen.findByRole("dialog", { name: "Editar pop-up" });
    await within(edit).findByRole("radio", { name: "trophy" });
    await user.click(within(edit).getByRole("radio", { name: "Sem ícone" }));
    await user.click(within(edit).getByRole("button", { name: /Continuar/ }));
    await user.click(await within(edit).findByRole("button", { name: /Continuar/ }));
    await user.click(await within(edit).findByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(mocks.adminPatchPlain).toHaveBeenCalledWith("/admin/popups/p1", expect.objectContaining({ icon: null, title: "Black Friday chegou", starts_at: "2026-11-17T12:00:00.000Z" })));
  });

  it("exclui depois de confirmar", async () => {
    const user = userEvent.setup();
    page();
    const row = (await screen.findByText("Aviso antigo")).closest("[role=row]") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /Ações de/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    await user.click(await screen.findByRole("button", { name: "Excluir pop-up" }));
    await waitFor(() => expect(mocks.adminDelete).toHaveBeenCalledWith("/admin/popups/p2"));
  });

  it("Hype Points: o prêmio só libera com botão e destino, aparece na prévia e vai no envio", async () => {
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole("button", { name: /Novo pop-up/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo pop-up" });
    await within(dialog).findByRole("radio", { name: "trophy" });
    await user.type(within(dialog).getByLabelText(/Título/), "Bônus");
    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));

    const points = await within(dialog).findByLabelText(/Hype Points ao tocar no botão/);
    expect(points).toBeDisabled();
    expect(within(dialog).getByText(/Preencha o texto do botão e escolha a página/)).toBeInTheDocument();
    expect(within(dialog).getByText("O prêmio é dado uma vez por pessoa, a quem tocar no botão. Pontos não viram dinheiro.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Texto do botão/), "Ver carteira");
    await user.selectOptions(within(dialog).getByLabelText("Para qual página vai"), "wallet");
    expect(points).toBeEnabled();
    await user.type(points, "30");
    const preview = within(dialog).getByRole("figure", { name: "Prévia do pop-up" });
    expect(within(preview).getByText("+30 Hype Points")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Texto do selo/), "Ganhe 30");
    expect(within(preview).getByText("Ganhe 30")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));
    await user.click(await within(dialog).findByRole("button", { name: "Criar pop-up" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledTimes(1));
    expect(mocks.adminPostPlain.mock.calls[0][1]).toMatchObject({ button_label: "Ver carteira", reward_points: 30, reward_label: "Ganhe 30" });
  });

  it("Hype Points: fora da faixa da API não deixa continuar", async () => {
    const user = userEvent.setup();
    page();
    await user.click(await screen.findByRole("button", { name: /Novo pop-up/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo pop-up" });
    await within(dialog).findByRole("radio", { name: "trophy" });
    await user.type(within(dialog).getByLabelText(/Título/), "Bônus");
    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));
    await user.type(await within(dialog).findByLabelText(/Texto do botão/), "Ver");
    await user.selectOptions(within(dialog).getByLabelText("Para qual página vai"), "wallet");
    await user.type(within(dialog).getByLabelText(/Hype Points ao tocar no botão/), "0");
    await user.click(within(dialog).getByRole("button", { name: /Continuar/ }));
    expect(await within(dialog).findByText("Um número inteiro de 1 a 100.")).toBeInTheDocument();
  });

  it("Hype Points: a lista mostra o prêmio e duplicar copia pontos e selo", async () => {
    const user = userEvent.setup();
    page();
    const row = (await screen.findByText("Bônus de boas-vindas")).closest("[role=row]") as HTMLElement;
    expect(within(row).getByText(/50 Hype Points/)).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /Ações de/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicar" }));
    const copy = await screen.findByRole("dialog", { name: "Novo pop-up" });
    await user.click(within(copy).getByRole("button", { name: /Continuar/ }));
    expect(await within(copy).findByLabelText(/Hype Points ao tocar no botão/)).toHaveValue("50");
    expect(within(copy).getByLabelText(/Texto do selo/)).toHaveValue("+50 Hype Points");
  });
});
