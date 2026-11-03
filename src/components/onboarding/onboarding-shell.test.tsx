/**
 * Moldura da Configuração da conta: a faixa de etapas (qual é a atual, quais já passaram), o rodapé com "Sair",
 * o atalho de volta ao painel e o contato de ajuda. O CSS não roda no jsdom: os estados saem em `data-status`.
 */
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { onboardingSteps } from "@/lib/onboarding/flow";
import { renderAdminRoute, stubRoute } from "@/test/render-admin-route";

import { OnboardingShell, type OnboardingShellProps } from "./onboarding-shell";

afterEach(cleanup);

const USER = { name: "Marina Costa", email: "marina@casaaurora.com.br", avatar: null };

function renderShell(props: Partial<OnboardingShellProps> = {}) {
  const onLogout = vi.fn();
  const view = renderAdminRoute(
    [
      {
        path: "/onboarding",
        component: () => (
          <OnboardingShell
            group="brand"
            steps={onboardingSteps("brand", false)}
            current="brand"
            user={USER}
            canLeave={false}
            onLogout={onLogout}
            isLoggingOut={false}
            {...props}
          >
            <p>conteúdo da etapa</p>
          </OnboardingShell>
        ),
      },
      stubRoute("/"),
    ],
    "/onboarding",
  );
  return { ...view, onLogout };
}

// A moldura monta junto com o roteador (assíncrono): espera ela aparecer antes de olhar dentro da faixa.
const rail = () => screen.findByRole("complementary", { name: "Etapas da configuração" });

describe("OnboardingShell", () => {
  it("mostra o conteúdo da etapa dentro do cartão", async () => {
    renderShell();
    expect(await screen.findByText("conteúdo da etapa")).toBeInTheDocument();
  });

  it("lista as etapas em ordem, com a atual marcada para leitores de tela", async () => {
    renderShell({ steps: onboardingSteps("profile", true), group: "profile", current: "code" });
    const items = within(await screen.findByRole("list", { name: "Etapas" })).getAllByRole("listitem");

    expect(items.map((li) => li.dataset.status)).toEqual(["done", "current"]);
    expect(items.map((li) => li.querySelector(".ob-step-title")?.textContent)).toEqual(["Seu perfil", "Confirmação"]);
    expect(items.filter((li) => li.getAttribute("aria-current") === "step")).toHaveLength(1);
    expect(items[1]).toHaveAttribute("aria-current", "step");
  });

  it("etapa concluída ganha o aviso para leitores de tela e o ícone de check no lugar do número", async () => {
    renderShell({ current: "company" });
    const [brand, company] = within(await screen.findByRole("list", { name: "Etapas" })).getAllByRole("listitem");

    expect(brand).toHaveTextContent("(concluída)");
    expect(brand.querySelector(".ob-step-dot svg")).not.toBeNull();
    expect(company.querySelector(".ob-step-dot")).toHaveTextContent("2");
    expect(company.querySelector(".ob-step-dot svg")).toBeNull();
  });

  it("a frase da faixa conta as etapas da marca (dois passos)", async () => {
    renderShell();
    expect(within(await rail()).getByText("Sua marca no Hype em dois passos")).toBeInTheDocument();
  });

  it("no perfil (uma etapa só) a faixa fala do perfil e não mostra lista nem barrinhas", async () => {
    const { container } = renderShell({ group: "profile", steps: onboardingSteps("profile", false), current: "profile" });
    const aside = within(await rail());

    expect(aside.getByText("Vamos montar o seu perfil")).toBeInTheDocument();
    expect(aside.queryByRole("list", { name: "Etapas" })).not.toBeInTheDocument();
    expect(container.querySelector(".ob-seg")?.parentElement).toHaveAttribute("hidden");
  });

  it("na tela de boas-vindas todas as etapas estão concluídas e a faixa muda de frase", async () => {
    renderShell({ current: "done" });
    const items = within(await screen.findByRole("list", { name: "Etapas" })).getAllByRole("listitem");

    expect(items.map((li) => li.dataset.status)).toEqual(["done", "done"]);
    expect(within(await rail()).getByText("Tudo pronto por aqui")).toBeInTheDocument();
  });

  it("as barrinhas do topo (celular) seguem as mesmas etapas", async () => {
    const { container } = renderShell({ current: "company" });
    await screen.findByText("conteúdo da etapa");

    expect([...container.querySelectorAll(".ob-seg")].map((seg) => (seg as HTMLElement).dataset.status)).toEqual(["done", "current"]);
  });

  it("mostra quem está na conta", async () => {
    renderShell();
    const aside = within(await rail());
    expect(aside.getByText("Marina Costa")).toBeInTheDocument();
    expect(aside.getByText("marina@casaaurora.com.br")).toBeInTheDocument();
  });

  it("Sair chama o encerramento da sessão, tanto no topo (celular) quanto na faixa (desktop)", async () => {
    const user = userEvent.setup();
    const { onLogout } = renderShell();
    const buttons = await screen.findAllByRole("button", { name: "Sair" });

    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]);
    await user.click(buttons[1]);
    expect(onLogout).toHaveBeenCalledTimes(2);
  });

  it("enquanto sai, o botão avisa e fica desabilitado", async () => {
    renderShell({ isLoggingOut: true });
    const buttons = await screen.findAllByRole("button", { name: "Saindo..." });

    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  it("só oferece 'Voltar ao painel' a quem já tem marca (quem abre 'Nova marca' não fica preso)", async () => {
    renderShell({ canLeave: false });
    await screen.findByText("conteúdo da etapa");
    expect(screen.queryByRole("link", { name: /Voltar ao painel/ })).not.toBeInTheDocument();
    cleanup();

    renderShell({ canLeave: true });
    const links = await screen.findAllByRole("link", { name: /Voltar ao painel/ });
    for (const link of links) expect(link).toHaveAttribute("href", "/");
  });

  it("na tela de boas-vindas o atalho some (o botão 'Começar agora' já leva ao painel)", async () => {
    renderShell({ canLeave: true, current: "done" });
    await screen.findByText("conteúdo da etapa");
    expect(screen.queryByRole("link", { name: /Voltar ao painel/ })).not.toBeInTheDocument();
  });

  it("traz o e-mail de suporte, já com o assunto preenchido", async () => {
    renderShell();
    const links = await screen.findAllByRole("link", { name: "suporte@hypeapp.com.br" });

    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith("mailto:suporte@hypeapp.com.br?subject=")).toBe(true);
      expect(decodeURIComponent(href)).toContain("Ajuda com a configuração da conta");
    }
  });

  it("sem usuário carregado, não mostra o cartão de conta", async () => {
    renderShell({ user: null });
    await screen.findByText("conteúdo da etapa");
    expect(within(await rail()).queryByText("Marina Costa")).not.toBeInTheDocument();
  });
});
