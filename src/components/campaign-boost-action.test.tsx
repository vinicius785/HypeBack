import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({ getCampaign: vi.fn(), activateCampaignBoost: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/shared/services/campaign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/campaign")>()),
  getCampaign: svc.getCampaign,
  activateCampaignBoost: svc.activateCampaignBoost,
}));
vi.mock("@/hooks/use-workspace-query-key", () => ({
  useWorkspaceQueryKey: () => "ws-1",
  withWorkspaceKey: (parts: readonly unknown[], ws: string | undefined) => [...parts, ws ?? "__no_workspace__"],
}));
vi.mock("sonner", () => ({ toast: toasts }));

import { BOOST_HINT, CampaignBoostAction } from "./campaign-boost-action";
import { useCampaign } from "@/hooks/use-campaigns";
import type { CampaignBoost } from "@/shared/types";

const NOW = new Date("2026-11-12T15:00:00Z"); // 12:00 em Brasília
const ID = "c-1";

const AVAILABLE: CampaignBoost = { available: true, active: false, started_at: null, ends_at: null };
const ACTIVE: CampaignBoost = { available: false, active: true, started_at: "2026-11-12T14:00:00Z", ends_at: "2026-11-13T14:00:00Z" };
const USED: CampaignBoost = { available: false, active: false, started_at: "2026-11-01T13:00:00Z", ends_at: "2026-11-02T13:00:00Z" };

/** A ação alimentada pelo detalhe da campanha em cache, como no cabeçalho: o `boost` devolvido pelo POST aparece sozinho. */
function Header({ canWrite = true, published = true, registrationOpen = true as boolean | null }) {
  const { data } = useCampaign(ID);
  return <CampaignBoostAction campaignId={ID} boost={data?.boost} published={published} registrationOpen={registrationOpen} canWrite={canWrite} />;
}

function renderHeader(props: Parameters<typeof Header>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Header {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  Object.values(svc).forEach((mock) => mock.mockReset());
  toasts.success.mockReset();
  toasts.error.mockReset();
  svc.getCampaign.mockResolvedValue({ id: ID, boost: AVAILABLE });
});
afterEach(() => vi.useRealTimers());

describe("CampaignBoostAction · os três estados", () => {
  it("disponível: botão 'Impulsionar' com a explicação do Boost", async () => {
    renderHeader();
    const button = await screen.findByRole("button", { name: "Impulsionar" });
    expect(button).toBeEnabled();
    // o balãozinho explica o Boost ao passar o mouse (e some ao sair)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.hover(button);
    const bubble = screen.getByRole("tooltip");
    expect(bubble).toHaveTextContent("Impulsionar (Boost)");
    expect(bubble).toHaveTextContent(BOOST_HINT);
    expect(bubble).toHaveTextContent("1º lugar no Explorar e na seção “Campanhas em destaque” do app");
    expect(button).toHaveAccessibleDescription(expect.stringContaining(BOOST_HINT));
    await userEvent.unhover(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("ativo: pílula com o raio e o cronômetro do que falta; a dica traz o fim em Brasília; sem botão", async () => {
    svc.getCampaign.mockResolvedValue({ id: ID, boost: ACTIVE });
    renderHeader();
    // agora 15:00 UTC, fim 14:00 UTC de amanhã: faltam 23 h
    const timer = await screen.findByRole("timer", { name: "Boost ativo: faltam 23 h" });
    expect(timer).toHaveTextContent("23:00:00");
    expect(timer).toHaveClass("chd-boost-on");
    expect(timer.querySelector("svg")).not.toBeNull();
    // 14:00 UTC = 11:00 em Brasília, amanhã
    await userEvent.hover(timer);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/Boost ativo.*até amanhã às 11:00 \(horário de Brasília\)/);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("o cronômetro anda sozinho (a cada segundo)", async () => {
    svc.getCampaign.mockResolvedValue({ id: ID, boost: ACTIVE });
    renderHeader();
    const timer = await screen.findByRole("timer");
    expect(timer).toHaveTextContent("23:00:00");
    vi.setSystemTime(new Date(NOW.getTime() + 5_000)); // 5 s depois; o relógio do cronômetro lê a hora a cada segundo
    await waitFor(() => expect(timer).toHaveTextContent("22:59:55"), { timeout: 3_000 });
  });

  it("já utilizado: 'Boost utilizado' com a data de uso, sem botão", async () => {
    svc.getCampaign.mockResolvedValue({ id: ID, boost: USED });
    renderHeader();
    const tag = await screen.findByText("Boost utilizado");
    await userEvent.hover(tag);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Usado em 01/11/2026");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("um Boost 'ativo' cujo fim já passou aparece como utilizado", async () => {
    svc.getCampaign.mockResolvedValue({ id: ID, boost: { ...ACTIVE, ends_at: "2026-11-12T14:00:00Z" } });
    renderHeader();
    expect(await screen.findByText("Boost utilizado")).toBeInTheDocument();
  });

  it("sem o campo `boost` (API antiga) nada aparece", async () => {
    svc.getCampaign.mockResolvedValue({ id: ID });
    const { container } = renderHeader();
    await waitFor(() => expect(svc.getCampaign).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CampaignBoostAction · botão desabilitado, com explicação", () => {
  it.each([
    ["sem permissão de escrita", { canWrite: false }, /não tem permissão/],
    ["campanha não publicada", { published: false }, /Só campanhas publicadas/],
    ["inscrições fechadas", { registrationOpen: false }, /inscrições abertas/],
  ] as const)("%s", async (_name, props, text) => {
    renderHeader(props);
    const button = await screen.findByRole("button", { name: "Impulsionar" });
    expect(button).toBeDisabled();
    // o botão desabilitado não recebe o mouse: o balão abre pelo invólucro e traz o motivo
    await userEvent.hover(button.parentElement as HTMLElement);
    expect(screen.getByRole("tooltip")).toHaveTextContent(text);
    expect(button).toHaveAccessibleDescription(text);
  });
});

describe("CampaignBoostAction · usar o Boost", () => {
  it("pede confirmação antes, chama o POST uma vez, mostra o aviso com o horário e vira 'Boost ativo'", async () => {
    svc.activateCampaignBoost.mockResolvedValue(ACTIVE);
    const user = userEvent.setup();
    renderHeader();
    await user.click(await screen.findByRole("button", { name: "Impulsionar" }));

    expect(screen.getByText("Usar o Boost agora?")).toBeInTheDocument();
    expect(screen.getByText("A campanha ficará em destaque por 24 horas e não será possível usar de novo.")).toBeInTheDocument();
    expect(svc.activateCampaignBoost).not.toHaveBeenCalled();

    // depois do POST o servidor já devolve o detalhe com o Boost ativo (o que a nova consulta traz)
    svc.getCampaign.mockResolvedValue({ id: ID, boost: ACTIVE });
    await user.click(screen.getByRole("button", { name: "Usar o Boost" }));
    await waitFor(() => expect(svc.activateCampaignBoost).toHaveBeenCalledTimes(1));
    expect(svc.activateCampaignBoost).toHaveBeenCalledWith(ID);
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Boost ativado! Sua campanha está em destaque até 11:00"));
    expect(await screen.findByRole("timer")).toHaveTextContent("23:00:00");
    expect(screen.queryByText("Usar o Boost agora?")).not.toBeInTheDocument();
  });

  it("cancelar a confirmação não chama o POST", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(await screen.findByRole("button", { name: "Impulsionar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Usar o Boost agora?")).not.toBeInTheDocument();
    expect(svc.activateCampaignBoost).not.toHaveBeenCalled();
  });

  it("enquanto envia, o botão fica travado (sem clique duplo)", async () => {
    let finish: (boost: CampaignBoost) => void = () => undefined;
    svc.activateCampaignBoost.mockReturnValue(new Promise<CampaignBoost>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    renderHeader();
    await user.click(await screen.findByRole("button", { name: "Impulsionar" }));
    await user.click(screen.getByRole("button", { name: "Usar o Boost" }));
    const sending = await screen.findByRole("button", { name: "Ativando…" });
    expect(sending).toBeDisabled();
    await user.click(sending);
    expect(svc.activateCampaignBoost).toHaveBeenCalledTimes(1);
    finish(ACTIVE);
  });

  it("erro 409: mostra a mensagem da API e recarrega o detalhe (passa a mostrar 'utilizado')", async () => {
    svc.activateCampaignBoost.mockRejectedValue(Object.assign(new Error("O Boost desta campanha já foi usado."), { status: 409, code: "BOOST_ALREADY_USED" }));
    const user = userEvent.setup();
    renderHeader();
    await user.click(await screen.findByRole("button", { name: "Impulsionar" }));
    svc.getCampaign.mockResolvedValue({ id: ID, boost: USED });
    await user.click(screen.getByRole("button", { name: "Usar o Boost" }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("O Boost desta campanha já foi usado."));
    expect(toasts.success).not.toHaveBeenCalled();
    expect(await screen.findByText("Boost utilizado")).toBeInTheDocument();
    expect(svc.getCampaign.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("erro que não é de estado (ex.: rede): a mensagem fica no diálogo, que continua aberto para tentar de novo", async () => {
    svc.activateCampaignBoost.mockRejectedValue(Object.assign(new Error("Falha de rede"), { status: 0 }));
    const user = userEvent.setup();
    renderHeader();
    await user.click(await screen.findByRole("button", { name: "Impulsionar" }));
    await user.click(screen.getByRole("button", { name: "Usar o Boost" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de rede");
    expect(screen.getByRole("button", { name: "Usar o Boost" })).toBeEnabled();
  });
});
