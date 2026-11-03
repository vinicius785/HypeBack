/**
 * Configuração da conta: as rotas do passo do telefone (que a chave `VITE_PHONE_VERIFICATION` desliga) e a criação da
 * marca em duas etapas (a segunda vive em `?etapa=empresa`). Fica em `src/test` e não ao lado das rotas: tudo dentro
 * de `src/screens` é lido pelo gerador de rotas.
 */
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isRedirect } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  uploadWorkspacePhoto: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: (id: string) => (options: Record<string, unknown>) => ({ id, options }),
  };
});
vi.mock("@/shared/services/workspace", () => ({
  createWorkspace: mocks.createWorkspace,
  uploadWorkspacePhoto: mocks.uploadWorkspacePhoto,
}));
vi.mock("@/hooks/use-niches", () => ({
  useNiches: () => ({
    data: [
      { id: 1, parent_id: null, name: "Moda" },
      { id: 2, parent_id: null, name: "Beleza" },
    ],
    isLoading: false,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { Route as CreateWorkspaceRoute } from "@/screens/(private)/onboarding/create-workspace";
import { Route as PhoneRoute } from "@/screens/(private)/onboarding";
import { Route as VerifyPhoneRoute } from "@/screens/(private)/onboarding/verify-phone";
import { currentSearch, renderAdminRoute, stubRoute } from "@/test/render-admin-route";

type MockRoute = {
  id: string;
  options: {
    beforeLoad?: () => unknown;
    component: () => ReactNode;
    validateSearch?: (raw: Record<string, unknown>) => Record<string, unknown>;
  };
};

const phone = PhoneRoute as unknown as MockRoute;
const verify = VerifyPhoneRoute as unknown as MockRoute;
const create = CreateWorkspaceRoute as unknown as MockRoute;

const VIACEP = { logradouro: "Avenida Paulista", complemento: "", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" };

beforeEach(() => {
  mocks.createWorkspace.mockReset().mockResolvedValue({ id: "ws_1", name: "Casa Aurora" });
  mocks.uploadWorkspacePhoto.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => VIACEP })));
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ids das rotas (a árvore de rotas não muda)", () => {
  it("são os que o gerador de rotas espera", () => {
    expect(phone.id).toBe("/(private)/onboarding/");
    expect(verify.id).toBe("/(private)/onboarding/verify-phone");
    expect(create.id).toBe("/(private)/onboarding/create-workspace");
  });
});

describe("passo do telefone", () => {
  const redirectOf = (route: MockRoute): { to?: string; replace?: boolean } | null => {
    try {
      route.options.beforeLoad?.();
    } catch (thrown) {
      expect(isRedirect(thrown)).toBe(true);
      return (thrown as { options: { to?: string; replace?: boolean } }).options;
    }
    return null;
  };

  it("com a confirmação desligada (o padrão), /onboarding e /onboarding/verify-phone seguem direto para a marca", () => {
    for (const route of [phone, verify]) {
      expect(redirectOf(route)).toMatchObject({ to: "/onboarding/create-workspace", replace: true });
    }
  });

  it("com VITE_PHONE_VERIFICATION=on as duas telas abrem normalmente", () => {
    vi.stubEnv("VITE_PHONE_VERIFICATION", "on");
    for (const route of [phone, verify]) expect(redirectOf(route)).toBeNull();
  });
});

describe("criação da marca em duas etapas", () => {
  const routes = () => [
    { path: "/onboarding/create-workspace", component: create.options.component, validateSearch: create.options.validateSearch },
    stubRoute("/onboarding/welcome"),
  ];
  const open = (url = "/onboarding/create-workspace") => renderAdminRoute(routes(), url);

  async function fillBrand(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("Nome da marca"), "Casa Aurora");
    await user.click(screen.getByRole("button", { name: /Selecione o nicho da sua marca/ }));
    await user.click(await screen.findByRole("button", { name: "Moda" }));
    await user.type(screen.getByLabelText("Sobre a marca"), "Moda feminina com foco em peças atemporais.");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
  }

  async function fillCompany(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("Razão social"), "Casa Aurora Moda Ltda.");
    await user.type(screen.getByLabelText("CNPJ"), "12345678000195");
    await user.type(screen.getByLabelText("CEP"), "01310100");
    await user.tab();
    await screen.findByLabelText("Rua / Avenida");
    await user.type(screen.getByLabelText("Número"), "1578");
  }

  it("abre na marca, 'Etapa 1 de 2', sem a etapa do telefone", async () => {
    const { router } = open();
    expect(await screen.findByRole("heading", { name: "Crie sua marca" })).toBeInTheDocument();
    expect(screen.getByText("Etapa 1 de 2")).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({});
  });

  it("com a confirmação ligada, a contagem inclui o telefone e o código (Etapa 3 de 4)", async () => {
    vi.stubEnv("VITE_PHONE_VERIFICATION", "on");
    open();
    expect(await screen.findByText("Etapa 3 de 4")).toBeInTheDocument();
  });

  it("enviar a marca vazia mostra o que falta e não sai da etapa", async () => {
    const user = userEvent.setup();
    const { router } = open();
    await user.click(await screen.findByRole("button", { name: /Continuar/ }));

    expect(await screen.findByText("Nome da marca é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Nicho é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Descrição da marca é obrigatória")).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({});
  });

  it("continuar leva aos dados da empresa, que passam a ter URL própria (?etapa=empresa)", async () => {
    const user = userEvent.setup();
    const { router } = open();
    await fillBrand(user);

    expect(await screen.findByRole("heading", { name: "Dados da empresa" })).toBeInTheDocument();
    expect(screen.getByText("Etapa 2 de 2")).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({ etapa: "empresa" });
  });

  it("'Voltar' retorna à marca com o que já foi preenchido", async () => {
    const user = userEvent.setup();
    const { router } = open();
    await fillBrand(user);
    await user.click(await screen.findByRole("button", { name: /Voltar/ }));

    expect(await screen.findByRole("heading", { name: "Crie sua marca" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da marca")).toHaveValue("Casa Aurora");
    expect(currentSearch(router)).toEqual({});
  });

  it("abrir ou recarregar direto em ?etapa=empresa (sem a marca preenchida) volta à marca", async () => {
    const { router } = open("/onboarding/create-workspace?etapa=empresa");

    expect(await screen.findByRole("heading", { name: "Crie sua marca" })).toBeInTheDocument();
    await waitFor(() => expect(currentSearch(router)).toEqual({}));
  });

  it("só 'empresa' vale em ?etapa=: qualquer outro valor é descartado e a tela fica na marca", async () => {
    expect(create.options.validateSearch?.({ etapa: "empresa" })).toEqual({ etapa: "empresa" });
    expect(create.options.validateSearch?.({ etapa: "qualquer" })).toEqual({});
    expect(create.options.validateSearch?.({})).toEqual({});

    open("/onboarding/create-workspace?etapa=qualquer");
    expect(await screen.findByRole("heading", { name: "Crie sua marca" })).toBeInTheDocument();
    expect(screen.getByText("Etapa 1 de 2")).toBeInTheDocument();
  });

  it("CNPJ e CEP ganham máscara enquanto se digita", async () => {
    const user = userEvent.setup();
    open();
    await fillBrand(user);
    await user.type(await screen.findByLabelText("CNPJ"), "12345678000195");
    await user.type(screen.getByLabelText("CEP"), "01310100");

    expect(screen.getByLabelText("CNPJ")).toHaveValue("12.345.678/0001-95");
    expect(screen.getByLabelText("CEP")).toHaveValue("01310-100");
  });

  it("o CEP completo preenche o endereço e abre o bloco de endereço", async () => {
    const user = userEvent.setup();
    open();
    await fillBrand(user);
    expect(screen.queryByLabelText("Rua / Avenida")).not.toBeInTheDocument();
    await fillCompany(user);

    expect(screen.getByLabelText("Rua / Avenida")).toHaveValue("Avenida Paulista");
    expect(screen.getByLabelText("Bairro")).toHaveValue("Bela Vista");
    expect(screen.getByLabelText("Cidade")).toHaveValue("São Paulo");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("https://viacep.com.br/ws/01310100/json/");
  });

  it("criar a marca envia CNPJ e CEP só com dígitos, guarda a marca e vai para as boas-vindas", async () => {
    const user = userEvent.setup();
    open();
    await fillBrand(user);
    await fillCompany(user);
    await user.click(screen.getByRole("button", { name: /Criar marca/ }));

    await waitFor(() =>
      expect(mocks.createWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Casa Aurora",
          niche_id: 1,
          legal_name: "Casa Aurora Moda Ltda.",
          tax_id: "12345678000195",
          postal_code: "01310100",
          street: "Avenida Paulista",
          street_number: "1578",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
        }),
      ),
    );
    expect(await screen.findByTestId("stub:/onboarding/welcome")).toBeInTheDocument();
    expect(window.localStorage.getItem("workspaceId")).toBe("ws_1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Sua marca Casa Aurora foi criada com sucesso.");
    expect(mocks.uploadWorkspacePhoto).not.toHaveBeenCalled();
  });

  it("erro da API aparece como aviso e a pessoa continua nos dados da empresa", async () => {
    mocks.createWorkspace.mockRejectedValueOnce(new Error("CNPJ já cadastrado"));
    const user = userEvent.setup();
    const { router } = open();
    await fillBrand(user);
    await fillCompany(user);
    await user.click(screen.getByRole("button", { name: /Criar marca/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("CNPJ já cadastrado"));
    expect(screen.getByRole("heading", { name: "Dados da empresa" })).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({ etapa: "empresa" });
  });

  it("CNPJ incompleto é recusado antes de chamar a API", async () => {
    const user = userEvent.setup();
    open();
    await fillBrand(user);
    await fillCompany(user);
    await user.clear(screen.getByLabelText("CNPJ"));
    await user.type(screen.getByLabelText("CNPJ"), "1234");
    await user.click(screen.getByRole("button", { name: /Criar marca/ }));

    expect(await screen.findByText("CNPJ deve ter 14 dígitos")).toBeInTheDocument();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });
});
