import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: 1, name: "Ana Souza", email: "ana@x.com", phone: "11999998888", avatar: null as string | null },
  setUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  navigate: vi.fn(),
  proceed: vi.fn(),
  reset: vi.fn(),
  blocked: false,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (o: unknown) => o,
  useNavigate: () => mocks.navigate,
  useBlocker: () => ({
    status: mocks.blocked ? "blocked" : "idle",
    proceed: mocks.proceed,
    reset: mocks.reset,
  }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: mocks.user, setUser: mocks.setUser }) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({
    workspaces: [
      { id: "w1", name: "Marca Um", role: "owner" },
      { id: "w2", name: "Marca Dois", role: "member" },
    ],
    selectedWorkspace: { id: "w1", name: "Marca Um", role: "owner" },
    selectWorkspace: vi.fn(),
  }),
}));
vi.mock("@/shared/services/me", () => ({
  uploadProfilePhoto: mocks.upload,
  removeProfilePhoto: mocks.remove,
  updateCurrentUserProfile: mocks.update,
}));
vi.mock("@/shared/services/auth", () => ({ logout: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/profile/photo-crop-modal", () => ({
  PhotoCropModal: ({
    file,
    onConfirm,
    error,
  }: {
    file: File;
    onConfirm: (b: Blob) => void;
    error?: string | null;
  }) => (
    <div role="dialog">
      <span>{file.name}</span>
      {error ? <p role="alert">{error}</p> : null}
      <button onClick={() => onConfirm(new Blob(["x"], { type: "image/jpeg" }))}>Salvar foto</button>
    </div>
  ),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Route } from "@/screens/(private)/(app)/settings";

const Screen = (Route as unknown as { component: () => React.ReactElement }).component;
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Screen />
    </QueryClientProvider>,
  );

const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText("Escolher foto de perfil"), { target: { files: [file] } });

describe("Meu perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SERVER_URL", "http://api.test");
    mocks.user.avatar = null;
    mocks.blocked = false;
  });

  it("mostra título, descrição e a identificação do usuário", () => {
    renderPage();
    expect(screen.getByText("Gerencie suas informações pessoais e sua conta.")).toBeTruthy();
    expect(screen.getByText("em Marca Um")).toBeTruthy();
    expect(screen.getByText("Adicionar foto")).toBeTruthy();
    expect(screen.queryByText("Remover")).toBeNull();
  });

  it("recusa formato inválido e arquivo grande com mensagem clara, sem abrir o recorte", () => {
    renderPage();
    pick(new File(["x"], "a.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert").textContent).toMatch(/JPEG, PNG ou WebP/);
    pick(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.png", { type: "image/png" }));
    expect(screen.getByRole("alert").textContent).toMatch(/5 MB/);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("imagem válida abre o recorte, envia e atualiza o usuário", async () => {
    mocks.upload.mockResolvedValue({ ...mocks.user, avatar: "/uploads/photos/n.jpg" });
    renderPage();
    pick(new File(["x"], "eu.png", { type: "image/png" }));
    expect(screen.getByText("eu.png")).toBeTruthy();
    fireEvent.click(screen.getByText("Salvar foto"));
    await waitFor(() =>
      expect(mocks.setUser).toHaveBeenCalledWith(
        expect.objectContaining({ avatar: "/uploads/photos/n.jpg" }),
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("erro do envio aparece dentro do recorte e não perde a seleção", async () => {
    mocks.upload.mockRejectedValue(new Error("Formato de arquivo não suportado."));
    renderPage();
    pick(new File(["x"], "eu.png", { type: "image/png" }));
    fireEvent.click(screen.getByText("Salvar foto"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/não suportado/));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("com foto, permite remover e volta às iniciais", async () => {
    mocks.user.avatar = "/uploads/photos/a.jpg";
    mocks.remove.mockResolvedValue({ ...mocks.user, avatar: null });
    renderPage();
    expect(screen.getByText("Alterar foto")).toBeTruthy();
    fireEvent.click(screen.getByText("Remover"));
    await waitFor(() =>
      expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ avatar: null })),
    );
  });

  it("salvar fica desabilitado sem mudanças e habilita ao editar", () => {
    renderPage();
    const save = screen.getByRole("button", { name: /Salvar alterações/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Ana Maria" } });
    expect(save.disabled).toBe(false);
    expect(screen.getByText("Você tem alterações não salvas")).toBeTruthy();
  });

  it("sair da conta pede confirmação", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.getByText("Sair da conta?")).toBeTruthy();
  });

  it("sair da tela com alterações pendentes pede confirmação", () => {
    mocks.blocked = true;
    renderPage();
    fireEvent.click(screen.getByText("Descartar e sair"));
    expect(mocks.proceed).toHaveBeenCalled();
  });
});
