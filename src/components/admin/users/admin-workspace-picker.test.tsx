import { QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ adminList: vi.fn(), adminGet: vi.fn() }));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/admin-client")>();
  return { ...actual, adminList: client.adminList, adminGet: client.adminGet };
});

import { AdminApiError, toAdminApiError } from "@/lib/admin/admin-client";
import type { AdminWorkspaceRef } from "@/shared/admin-platform.types";

import { WS_AURORA, WS_CAFE, WS_LUME, listResult, makeWorkspaceItem } from "./admin-users-test-data";
import { createTestQueryClient } from "./admin-users-test-utils";
import { AdminWorkspacePicker, useAdminWorkspaceSelection } from "./admin-workspace-picker";

const WORKSPACES = [
  makeWorkspaceItem({ id: WS_CAFE, name: "Café Serra Verde" }),
  makeWorkspaceItem({
    id: WS_LUME,
    name: "Studio Lume Fotografia",
    status: "suspended",
    owner: { user_id: 12, name: "Paula Lume", email: "paula@lume.com.br" },
  }),
  makeWorkspaceItem({ id: WS_AURORA, name: "Aurora Beauty Studio", owner: null }),
];

/** Um servidor de mentira: filtra os workspaces pelo `search` recebido. */
function serveWorkspaces() {
  client.adminList.mockImplementation(async (_path: string, params?: Record<string, unknown>) => {
    const term = String(params?.search ?? "").toLowerCase();
    const rows = WORKSPACES.filter((w) => w.name.toLowerCase().includes(term));
    return listResult(rows, rows.length, { per_page: 10 });
  });
}

type PickerProps = Partial<ComponentProps<typeof AdminWorkspacePicker>>;

/** O estado fica com quem usa o seletor (o da URL, nas telas): aqui, um `useState`. */
function Harness({ initial = "", onPick, ...props }: PickerProps & { initial?: string; onPick?: (ws: AdminWorkspaceRef | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <AdminWorkspacePicker
      value={value}
      onChange={(workspace) => {
        setValue(workspace?.id ?? "");
        onPick?.(workspace);
      }}
      {...props}
    />
  );
}

function setup(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
  return { user, ...view, trigger: () => screen.getByRole("button", { name: /^Workspace/ }) };
}

/** A busca fica dentro do popover: existe só com a lista aberta. */
const search = () => screen.getByRole("combobox", { name: /^Buscar workspace/i }) as HTMLInputElement;
const options = () => within(screen.getByRole("listbox", { name: /Workspace/ })).getAllByRole("option");

beforeEach(() => {
  client.adminList.mockReset();
  client.adminGet.mockReset();
  serveWorkspaces();
});

describe("AdminWorkspacePicker: acessibilidade e abertura", () => {
  it("é uma pílula com nome, fechada por padrão, e não consulta o servidor até abrir", () => {
    const { trigger } = setup();
    expect(trigger()).toHaveTextContent("Workspace:Todos");
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(client.adminList).not.toHaveBeenCalled();
  });

  it("clicar abre a lista e busca os clientes (kind=brand) pelo nome, 10 por vez", async () => {
    const { user, trigger } = setup();
    await user.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const listbox = await screen.findByRole("listbox", { name: "Workspace" });
    expect(search()).toHaveAttribute("aria-controls", listbox.id);
    expect(search()).toHaveAttribute("aria-autocomplete", "list");
    // "Todos" no topo e os três workspaces
    await waitFor(() => expect(options()).toHaveLength(4));
    expect(client.adminList).toHaveBeenCalledWith(
      "/admin/workspaces",
      { search: "", kind: "brand", per_page: 10, sort_by: "name", order: "asc" },
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("cada opção mostra o nome, o e-mail do dono e o estado quando não é ativo", async () => {
    const { user, trigger } = setup();
    await user.click(trigger());
    expect(await screen.findByRole("option", { name: /Café Serra Verde.*bernardo@cafeserraverde\.com\.br/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Studio Lume Fotografia.*paula@lume\.com\.br · Suspenso/ })).toBeInTheDocument();
    // sem dono e ativo: só o nome
    expect(screen.getByRole("option", { name: "Aurora Beauty Studio" })).toBeInTheDocument();
  });

  it("aceita outro rótulo, outro texto vazio, outro tipo de workspace e outro limite", async () => {
    const { user } = setup({ label: "Workspace de origem", placeholder: "Qualquer", kind: "all", limit: 5 });
    const trigger = screen.getByRole("button", { name: /^Workspace de origem:/ });
    expect(trigger).toHaveTextContent("Qualquer");
    await user.click(trigger);
    await screen.findByRole("listbox", { name: "Workspace de origem" });
    expect(client.adminList.mock.calls[0][1]).toMatchObject({ kind: "all", per_page: 5 });
  });

  it("variant=filterBar não mostra o × nem com um workspace escolhido", async () => {
    client.adminGet.mockResolvedValue({ id: WS_CAFE, name: "Café Serra Verde" });
    setup({ initial: WS_CAFE, variant: "filterBar" });
    await waitFor(() => expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Café Serra Verde"));
    expect(screen.queryByRole("button", { name: /Limpar/ })).not.toBeInTheDocument();
  });

  it("desabilitado: não abre nem consulta", async () => {
    const { user, trigger } = setup({ disabled: true });
    expect(trigger()).toBeDisabled();
    await user.click(trigger());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(client.adminList).not.toHaveBeenCalled();
  });
});

describe("AdminWorkspacePicker: busca com atraso", () => {
  it("digitar espera a pessoa parar: uma só consulta, com o texto inteiro", async () => {
    const { user, trigger } = setup();
    await user.click(trigger());
    await screen.findByRole("listbox");
    await waitFor(() => expect(client.adminList).toHaveBeenCalled());
    client.adminList.mockClear();

    await user.type(search(), "lume");
    // nenhuma das teclas intermediárias ("l", "lu", "lum") foi à API
    expect(client.adminList).not.toHaveBeenCalled();

    await waitFor(() => expect(client.adminList).toHaveBeenCalledTimes(1));
    expect(client.adminList.mock.calls[0][1]).toMatchObject({ search: "lume", kind: "brand" });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByRole("option", { name: /Studio Lume Fotografia/ })).toBeInTheDocument();
  });

  it("o atraso é configurável", async () => {
    const { user, trigger } = setup({ debounceMs: 10 });
    await user.click(trigger());
    await screen.findByRole("listbox");
    await waitFor(() => expect(client.adminList).toHaveBeenCalled());
    client.adminList.mockClear();
    await user.type(search(), "au");
    await waitFor(() => expect(client.adminList).toHaveBeenCalled());
    expect(client.adminList.mock.calls.at(-1)?.[1]).toMatchObject({ search: "au" });
  });

  it("sem resultado: diz o que foi buscado", async () => {
    const { user, trigger } = setup();
    await user.click(trigger());
    await screen.findByRole("listbox");
    await user.type(search(), "zzz");
    expect(await screen.findByText("Nenhum workspace encontrado")).toBeInTheDocument();
    expect(screen.getByText("Nada encontrado para “zzz”. Tente outro termo.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("mais resultados do que cabem: avisa quantos aparecem e pede para refinar", async () => {
    client.adminList.mockResolvedValue(listResult(WORKSPACES, 70, { per_page: 3 }));
    const { user, trigger } = setup();
    await user.click(trigger());
    expect(await screen.findByText("Mostrando 3 de 70. Digite para refinar a busca.")).toBeInTheDocument();
  });

  it("carregando: avisa enquanto a primeira busca não chega", async () => {
    client.adminList.mockReturnValue(new Promise(() => undefined));
    const { user, trigger } = setup();
    await user.click(trigger());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Carregando…"));
    // nenhum workspace ainda: só a opção "Todos"
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByRole("option", { name: /Café Serra Verde/ })).not.toBeInTheDocument();
  });
});

describe("AdminWorkspacePicker: escolher e limpar", () => {
  it("clicar numa opção escolhe, fecha a lista, mostra o nome e devolve o foco à pílula", async () => {
    const onPick = vi.fn();
    const { user, trigger } = setup({ onPick });
    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: /Aurora Beauty Studio/ }));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({ id: WS_AURORA, name: "Aurora Beauty Studio" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Workspace:Aurora Beauty Studio");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveFocus();
    // o nome já é conhecido: nem precisa buscar o detalhe do workspace
    expect(client.adminGet).not.toHaveBeenCalled();
  });

  it("a opção escolhida aparece marcada ao abrir de novo", async () => {
    const { user, trigger } = setup();
    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: /Studio Lume/ }));
    await user.click(trigger());
    expect(await screen.findByRole("option", { name: /Studio Lume/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Café Serra Verde/ })).toHaveAttribute("aria-selected", "false");
  });

  it("o × limpa a escolha: avisa quem usa, volta a 'Todos' e devolve o foco", async () => {
    const onPick = vi.fn();
    const { user, trigger } = setup({ onPick });
    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: /Café Serra Verde/ }));
    expect(trigger()).toHaveTextContent("Café Serra Verde");

    await user.click(screen.getByRole("button", { name: "Limpar workspace" }));
    expect(onPick).toHaveBeenLastCalledWith(null);
    expect(trigger()).toHaveTextContent("Workspace:Todos");
    expect(trigger()).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Limpar workspace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("a opção 'Todos' da lista também limpa", async () => {
    const onPick = vi.fn();
    const { user, trigger } = setup({ onPick });
    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: /Café Serra Verde/ }));
    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: "Todos" }));
    expect(onPick).toHaveBeenLastCalledWith(null);
    expect(trigger()).toHaveTextContent("Workspace:Todos");
  });

  it("sem escolha não há ×", () => {
    setup();
    expect(screen.queryByRole("button", { name: /Limpar/ })).not.toBeInTheDocument();
  });

  it("clearable=false: escolhido, mas sem × e sem a opção 'Todos'", async () => {
    client.adminGet.mockResolvedValue({ id: WS_CAFE, name: "Café Serra Verde" });
    const { user, trigger } = setup({ initial: WS_CAFE, clearable: false });
    await waitFor(() => expect(trigger()).toHaveTextContent("Café Serra Verde"));
    expect(screen.queryByRole("button", { name: /Limpar/ })).not.toBeInTheDocument();
    await user.click(trigger());
    await screen.findByRole("option", { name: /Café Serra Verde/ });
    expect(screen.queryByRole("option", { name: "Todos" })).not.toBeInTheDocument();
  });

  it("o × leva o nome do campo", async () => {
    client.adminGet.mockResolvedValue({ id: WS_CAFE, name: "Café Serra Verde" });
    setup({ initial: WS_CAFE, label: "Workspace de origem" });
    expect(await screen.findByRole("button", { name: "Limpar workspace de origem" })).toBeInTheDocument();
  });

  it("digitar sem escolher e sair da lista mantém o workspace escolhido", async () => {
    const { user, trigger } = setup();
    await user.click(trigger());
    await user.click(await screen.findByRole("option", { name: /Studio Lume/ }));
    await user.click(trigger());
    await user.keyboard("qualquer coisa");
    expect(search()).toHaveValue("qualquer coisa");
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Workspace:Studio Lume Fotografia");
  });
});

describe("AdminWorkspacePicker: o workspace escolhido vem só como id (URL recarregada)", () => {
  it("busca o nome do workspace e o mostra", async () => {
    client.adminGet.mockResolvedValue({ id: WS_CAFE, name: "Café Serra Verde" });
    const { trigger } = setup({ initial: WS_CAFE });

    expect(trigger()).toHaveTextContent("Carregando…");
    await waitFor(() => expect(trigger()).toHaveTextContent("Workspace:Café Serra Verde"));
    expect(client.adminGet).toHaveBeenCalledWith(`/admin/workspaces/${WS_CAFE}`, undefined, expect.anything());
    // a lista só é consultada quando a pessoa abre o seletor
    expect(client.adminList).not.toHaveBeenCalled();
  });

  it("workspace que não existe mais: mostra o começo do id (e ainda dá para limpar)", async () => {
    client.adminGet.mockRejectedValue(new AdminApiError({ status: 404, code: "NOT_FOUND", message: "x" }));
    const { trigger } = setup({ initial: WS_CAFE });
    await waitFor(() => expect(trigger()).toHaveTextContent("Workspace 7a1e0000…"));
    expect(screen.getByRole("button", { name: "Limpar workspace" })).toBeInTheDocument();
  });

  it("o id some (limpo por fora, ex.: 'Limpar filtros'): a pílula volta a 'Todos'", async () => {
    client.adminGet.mockResolvedValue({ id: WS_CAFE, name: "Café Serra Verde" });
    const view = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <AdminWorkspacePicker value={WS_CAFE} onChange={() => undefined} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Café Serra Verde"));
    view.rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <AdminWorkspacePicker value="" onChange={() => undefined} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveTextContent("Workspace:Todos");
  });
});

describe("useAdminWorkspaceSelection: o chip do filtro", () => {
  function renderSelection(id: string | null | undefined, options?: Parameters<typeof useAdminWorkspaceSelection>[1]) {
    return renderHook(() => useAdminWorkspaceSelection(id, options), {
      wrapper: ({ children }) => <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>,
    });
  }

  it("sem id: nenhum workspace e nenhum chip, sem consultar", () => {
    const { result } = renderSelection("");
    expect(result.current).toEqual({ workspace: null, summary: null });
    expect(client.adminGet).not.toHaveBeenCalled();
  });

  it("com id: 'Workspace: Carregando…' e depois o nome buscado", async () => {
    client.adminGet.mockResolvedValue({ id: WS_CAFE, name: "Café Serra Verde" });
    const { result } = renderSelection(WS_CAFE);
    expect(result.current.summary).toBe("Workspace: Carregando…");
    await waitFor(() => expect(result.current.summary).toBe("Workspace: Café Serra Verde"));
    expect(result.current.workspace).toEqual({ id: WS_CAFE, name: "Café Serra Verde" });
  });

  it("nome já conhecido: usa-o sem consultar; o rótulo é configurável", () => {
    const { result } = renderSelection(WS_CAFE, { label: "Origem", known: { id: WS_CAFE, name: "Café Serra Verde" } });
    expect(result.current.summary).toBe("Origem: Café Serra Verde");
    expect(client.adminGet).not.toHaveBeenCalled();
  });

  it("nome conhecido de outro workspace não vale: busca o do id atual", async () => {
    client.adminGet.mockResolvedValue({ id: WS_LUME, name: "Studio Lume Fotografia" });
    const { result } = renderSelection(WS_LUME, { known: { id: WS_CAFE, name: "Café Serra Verde" } });
    await waitFor(() => expect(result.current.summary).toBe("Workspace: Studio Lume Fotografia"));
  });
});

describe("AdminWorkspacePicker: teclado", () => {
  it("↓ na pílula abre a lista; ↓ ↑ movem o destaque; Enter escolhe", async () => {
    const onPick = vi.fn();
    const { user, trigger } = setup({ onPick });
    await user.tab();
    expect(trigger()).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(options()).toHaveLength(4)); // Todos + 3
    const items = options();
    expect(search()).toHaveFocus();
    expect(search()).toHaveAttribute("aria-activedescendant", items[0].id);

    await user.keyboard("{ArrowDown}");
    expect(search()).toHaveAttribute("aria-activedescendant", items[1].id);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(search()).toHaveAttribute("aria-activedescendant", items[3].id);
    await user.keyboard("{ArrowUp}");
    expect(search()).toHaveAttribute("aria-activedescendant", items[2].id);

    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith({ id: WS_LUME, name: "Studio Lume Fotografia" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Workspace:Studio Lume Fotografia");
  });

  it("o destaque volta ao primeiro resultado a cada busca nova", async () => {
    const { user, trigger } = setup({ debounceMs: 10 });
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(options()).toHaveLength(4));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.keyboard("a");
    await waitFor(() => {
      const items = options();
      expect(search()).toHaveAttribute("aria-activedescendant", items[0].id);
    });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("Esc fecha só a lista (não escolhe nada e não chega ao diálogo em volta)", async () => {
    const outer = vi.fn();
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div onKeyDown={(event) => outer(event.key)}>
          <Harness onPick={onPick} />
        </div>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: /^Workspace:/ }));
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalledWith("Escape");
    expect(screen.getByRole("button", { name: /^Workspace:/ })).toHaveFocus();

    // com a lista fechada, o Esc segue para quem está em volta
    await user.keyboard("{Escape}");
    expect(outer).toHaveBeenCalledWith("Escape");
  });

  it("Tab sai da busca e fecha a lista sem escolher", async () => {
    const onPick = vi.fn();
    const { user, trigger } = setup({ onPick });
    await user.click(trigger());
    await screen.findByRole("listbox");
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("Enter na busca escolhe sem enviar o formulário em volta", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <form onSubmit={onSubmit}>
          <Harness onPick={onPick} />
          <button type="submit">Buscar</button>
        </form>
      </QueryClientProvider>,
    );
    await user.tab();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(options()).toHaveLength(4));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled(); // escolher não enviou o formulário
  });
});

describe("AdminWorkspacePicker: erros", () => {
  it("erro de servidor: mostra o motivo e 'Tentar de novo' busca outra vez", async () => {
    client.adminList.mockRejectedValue(toAdminApiError(500, { message: "Internal server error" }));
    const { user, trigger } = setup();
    await user.click(trigger());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("O servidor teve um problema. Tente novamente em instantes.");

    serveWorkspaces();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("option", { name: /Café Serra Verde/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // clicar em "Tentar de novo" não fechou a lista
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("rota que o servidor ainda não tem: diz exatamente isso", async () => {
    client.adminList.mockRejectedValue(toAdminApiError(404, { message: "Cannot GET /api/backoffice/admin/workspaces" }));
    const { user, trigger } = setup();
    await user.click(trigger());
    expect(await screen.findByRole("alert")).toHaveTextContent("A busca de workspaces ainda não está disponível no servidor.");
  });

  it("sem permissão: o motivo, sem botão de tentar de novo (repetir não muda nada)", async () => {
    client.adminList.mockRejectedValue(toAdminApiError(403, { message: "Forbidden resource" }));
    const { user, trigger } = setup();
    await user.click(trigger());
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão para acessar este recurso.");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });
});
