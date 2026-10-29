import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpdateAvailable } from "./update-available";

function mockServerVersion(version: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ version }) })),
  );
}

const reload = vi.fn();

beforeEach(() => {
  vi.stubEnv("DEV", false);
  vi.stubGlobal("__APP_VERSION__", "1");
  reload.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function renderWithNewVersion(version = "2") {
  mockServerVersion(version);
  render(<UpdateAvailable />);
  return screen.findByText("Nova versão disponível");
}

describe("UpdateAvailable", () => {
  it("não aparece quando a versão publicada é a mesma", async () => {
    mockServerVersion("1");
    render(<UpdateAvailable />);
    await act(async () => {});
    expect(screen.queryByText("Nova versão disponível")).toBeNull();
  });

  it("aparece quando há versão nova e atualiza uma única vez", async () => {
    await renderWithNewVersion();
    const button = screen.getByRole("button", { name: "Atualizar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(reload).toHaveBeenCalledTimes(1);
    const updating = screen.getByRole("button", { name: "Atualizando…" });
    expect(updating).toBeDisabled();
    expect(updating).toHaveAttribute("aria-busy", "true");
  });

  it("mostra erro e permite tentar de novo quando a recarga não acontece", async () => {
    await renderWithNewVersion();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível recarregar a página");
    expect(screen.getByText("Nova versão disponível")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("não tenta recarregar sem conexão", async () => {
    await renderWithNewVersion();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Sem conexão");
  });

  it("dispensar não atualiza", async () => {
    await renderWithNewVersion();
    fireEvent.click(screen.getByRole("button", { name: "Dispensar aviso de nova versão" }));
    expect(screen.queryByText("Nova versão disponível")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
