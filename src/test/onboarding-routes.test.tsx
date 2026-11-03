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
  updateProfile: vi.fn(),
  uploadPhoto: vi.fn(),
  updatePhone: vi.fn(),
  verifyPhone: vi.fn(),
  setUser: vi.fn(),
  authUser: { id: 7, name: "Marina Costa", email: "marina@casaaurora.com.br", phone: null, created_at: "", updated_at: "" } as Record<string, unknown>,
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
vi.mock("@/shared/services/me", () => ({
  updateCurrentUserProfile: mocks.updateProfile,
  uploadProfilePhoto: mocks.uploadPhoto,
  updatePhone: mocks.updatePhone,
  verifyPhone: mocks.verifyPhone,
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.authUser, setUser: mocks.setUser }) }));
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
  mocks.updateProfile.mockReset().mockImplementation(async (data: Record<string, unknown>) => ({ ...mocks.authUser, ...data }));
  mocks.uploadPhoto.mockReset();
  mocks.updatePhone.mockReset().mockResolvedValue(undefined);
  mocks.setUser.mockReset();
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

describe("confirmação do telefone", () => {
  const redirectOf = (route: MockRoute): { to?: string; replace?: boolean } | null => {
    try {
      route.options.beforeLoad?.();
    } catch (thrown) {
      expect(isRedirect(thrown)).toBe(true);
      return (thrown as { options: { to?: string; replace?: boolean } }).options;
    }
    return null;
  };

  it("com a confirmação desligada (o padrão), a tela do código volta para o perfil", () => {
    expect(redirectOf(verify)).toMatchObject({ to: "/onboarding", replace: true });
  });

  it("com VITE_PHONE_VERIFICATION=on a tela do código abre normalmente", () => {
    vi.stubEnv("VITE_PHONE_VERIFICATION", "on");
    expect(redirectOf(verify)).toBeNull();
  });

  it("o perfil (/onboarding) abre sempre, com a confirmação ligada ou não", () => {
    expect(redirectOf(phone)).toBeNull();
    vi.stubEnv("VITE_PHONE_VERIFICATION", "on");
    expect(redirectOf(phone)).toBeNull();
  });
});

describe("perfil da pessoa", () => {
  const routes = () => [
    { path: "/onboarding", component: phone.options.component },
    stubRoute("/"),
    stubRoute("/onboarding/verify-phone"),
  ];
  const open = () => renderAdminRoute(routes(), "/onboarding");

  async function fill(user: ReturnType<typeof userEvent.setup>, { birth = "25/03/1992", tel = "" } = {}) {
    const name = await screen.findByLabelText("Nome completo");
    await user.clear(name);
    await user.type(name, "Marina Costa");
    await user.type(screen.getByLabelText("Data de nascimento"), birth.replace(/\D/g, ""));
    if (tel) await user.type(screen.getByLabelText(/Telefone/), tel);
  }

  it("abre com o nome da conta, o e-mail fixo e sem 'Etapa X de Y' (o perfil é uma etapa só)", async () => {
    open();
    expect(await screen.findByRole("heading", { name: "Crie seu perfil" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Marina Costa");
    expect(screen.getByLabelText("E-mail")).toHaveValue("marina@casaaurora.com.br");
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.queryByText(/^Etapa/)).not.toBeInTheDocument();
  });

  it("a data de nascimento ganha máscara enquanto se digita", async () => {
    const user = userEvent.setup();
    open();
    await fill(user, { birth: "25031992" });
    expect(screen.getByLabelText("Data de nascimento")).toHaveValue("25/03/1992");
  });

  it("sem data de nascimento (ou com data que não existe) não salva", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: /Salvar e continuar/ }));
    expect(await screen.findByText(/Informe uma data válida/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Data de nascimento"), "31021990");
    await user.click(screen.getByRole("button", { name: /Salvar e continuar/ }));
    expect(await screen.findByText(/Informe uma data válida/)).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("telefone é opcional e, informado, vai direto no perfil (sem código); depois entra no app", async () => {
    const user = userEvent.setup();
    const { queryClient } = open();
    const setQueryData = vi.spyOn(queryClient, "setQueryData");
    await fill(user, { tel: "11992922135" });
    await user.click(screen.getByRole("button", { name: /Salvar e continuar/ }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({ name: "Marina Costa", birth_date: "1992-03-25", phone: "11992922135" }),
    );
    expect(mocks.updatePhone).not.toHaveBeenCalled();
    expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ birth_date: "1992-03-25" }));
    expect(setQueryData).toHaveBeenCalledWith(["get-current-user"], expect.objectContaining({ birth_date: "1992-03-25" }));
    expect(await screen.findByTestId("stub:/")).toBeInTheDocument();
  });

  it("sem telefone, o perfil salva só nome e nascimento", async () => {
    const user = userEvent.setup();
    open();
    await fill(user);
    await user.click(screen.getByRole("button", { name: /Salvar e continuar/ }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ name: "Marina Costa", birth_date: "1992-03-25" }));
    expect(await screen.findByTestId("stub:/")).toBeInTheDocument();
  });

  it("telefone incompleto é recusado", async () => {
    const user = userEvent.setup();
    open();
    await fill(user, { tel: "1199" });
    await user.click(screen.getByRole("button", { name: /Salvar e continuar/ }));

    expect(await screen.findByText("Telefone deve ter 10 ou 11 dígitos, com DDD")).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("a foto é enviada depois do perfil; se falhar, o perfil fica salvo e a pessoa segue", async () => {
    mocks.uploadPhoto.mockRejectedValueOnce(new Error("falhou"));
    const user = userEvent.setup();
    open();
    await fill(user);
    await user.upload(document.getElementById("profile-photo") as HTMLInputElement, new File(["x"], "eu.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: /Salvar e continuar/ }));

    await waitFor(() => expect(mocks.uploadPhoto).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining("a foto não foi enviada")));
    expect(await screen.findByTestId("stub:/")).toBeInTheDocument();
  });

  it("erro da API aparece como aviso e a pessoa fica no perfil", async () => {
    mocks.updateProfile.mockRejectedValueOnce(new Error("Data de nascimento inválida"));
    const user = userEvent.setup();
    open();
    await fill(user);
    await user.click(screen.getByRole("button", { name: /Salvar e continuar/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Data de nascimento inválida"));
    expect(screen.getByRole("heading", { name: "Crie seu perfil" })).toBeInTheDocument();
  });

  describe("com a confirmação do telefone ligada", () => {
    beforeEach(() => vi.stubEnv("VITE_PHONE_VERIFICATION", "on"));

    it("o telefone é obrigatório", async () => {
      const user = userEvent.setup();
      open();
      await fill(user);
      await user.click(screen.getByRole("button", { name: /Enviar código/ }));

      expect(await screen.findByText(/Informe um telefone com DDD/)).toBeInTheDocument();
      expect(mocks.updateProfile).not.toHaveBeenCalled();
    });

    it("o perfil é salvo sem o telefone, o código é pedido e a pessoa vai para a confirmação", async () => {
      const user = userEvent.setup();
      open();
      await fill(user, { tel: "11992922135" });
      await user.click(screen.getByRole("button", { name: /Enviar código/ }));

      await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ name: "Marina Costa", birth_date: "1992-03-25" }));
      expect(mocks.updatePhone).toHaveBeenCalledWith({ phone: "11992922135" });
      expect(await screen.findByTestId("stub:/onboarding/verify-phone")).toBeInTheDocument();
    });
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

  it("abre na marca, 'Etapa 1 de 2', sem etapas do perfil", async () => {
    const { router } = open();
    expect(await screen.findByRole("heading", { name: "Crie sua marca" })).toBeInTheDocument();
    expect(screen.getByText("Etapa 1 de 2")).toBeInTheDocument();
    expect(currentSearch(router)).toEqual({});
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
