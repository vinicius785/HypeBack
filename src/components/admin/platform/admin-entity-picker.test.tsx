import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useMemo, useState, type ComponentProps } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AdminEntityPicker,
  adminEntityPickerMinCharsHint,
  adminEntityPickerSummary,
  computeEntityPickerPosition,
  type AdminEntityPickerSearchResult,
} from "./admin-entity-picker";

interface Workspace {
  id: string;
  name: string;
  owner?: string;
}

const WORKSPACES: Workspace[] = [
  { id: "w1", name: "Café Serra Verde", owner: "ana@cafe.com.br" },
  { id: "w2", name: "Studio Lume Fotografia", owner: "paula@lume.com.br" },
  { id: "w3", name: "Aurora Beauty Studio" },
];

/** Uma lista falsa: o que o `search` de uma tela faria com `useAdminList`, sem rede. */
const fake = {
  mode: "ok" as "ok" | "loading" | "error",
  total: undefined as number | undefined,
  queries: [] as string[],
  retry: vi.fn(),
};

function useFakeSearch(query: string): AdminEntityPickerSearchResult<Workspace> {
  fake.queries.push(query);
  const rows = useMemo(() => WORKSPACES.filter((w) => w.name.toLowerCase().includes(query.toLowerCase())), [query]);
  if (fake.mode === "loading") return { data: undefined, isLoading: true, isError: false };
  if (fake.mode === "error") return { data: undefined, isLoading: false, isError: true, retry: fake.retry, errorMessage: "Servidor fora do ar." };
  return { data: rows, isLoading: false, isError: false, total: fake.total };
}

type PickerProps = Partial<ComponentProps<typeof AdminEntityPicker<Workspace>>>;

/** O estado fica com quem usa o seletor (a URL, nas telas): aqui, um `useState`. */
function Harness({ initial = null, onPick, ...props }: PickerProps & { initial?: Workspace | null; onPick?: (value: Workspace | null) => void }) {
  const [value, setValue] = useState<Workspace | null>(initial);
  return (
    <div>
      <AdminEntityPicker<Workspace>
        label="Workspace"
        placeholder="Buscar workspace"
        value={value}
        onChange={(next) => {
          setValue(next);
          onPick?.(next);
        }}
        search={useFakeSearch}
        getKey={(w) => w.id}
        getLabel={(w) => w.name}
        {...props}
      />
      <button type="button">Depois do seletor</button>
    </div>
  );
}

function setup(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  const view = render(<Harness {...props} />);
  return { user, ...view };
}

const trigger = () => screen.getByRole("button", { name: /^Workspace:/ });
const combobox = () => screen.getByRole("combobox", { name: "Buscar workspace" }) as HTMLInputElement;
const options = () => within(screen.getByRole("listbox", { name: "Workspace" })).getAllByRole("option");
const activeOption = () => document.getElementById(combobox().getAttribute("aria-activedescendant") ?? "");

beforeEach(() => {
  fake.mode = "ok";
  fake.total = undefined;
  fake.queries = [];
  fake.retry = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AdminEntityPicker — pílula", () => {
  it("diz 'Rótulo: Todos' sem escolha e o nome da entidade com escolha (pílula preta)", () => {
    const { unmount } = setup();
    expect(trigger()).toHaveTextContent("Workspace:Todos");
    expect(trigger().closest(".adm-ep")).not.toHaveAttribute("data-active");
    unmount();

    setup({ initial: WORKSPACES[0] });
    expect(trigger()).toHaveTextContent("Workspace:Café Serra Verde");
    expect(trigger().closest(".adm-ep")).toHaveAttribute("data-active", "true");
  });

  it("allLabel troca o texto de 'nada escolhido'", () => {
    setup({ allLabel: "Qualquer pessoa" });
    expect(trigger()).toHaveTextContent("Qualquer pessoa");
  });

  it("fechado, não consulta nada e a pílula anuncia que abre um popover", () => {
    setup();
    expect(fake.queries).toEqual([]);
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("desabilitado: a pílula não abre", async () => {
    const { user } = setup({ disabled: true });
    expect(trigger()).toBeDisabled();
    await user.click(trigger());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AdminEntityPicker — combobox", () => {
  it("abrir liga os atributos ARIA e põe o foco na busca", async () => {
    const { user } = setup();
    await user.click(trigger());

    const dialog = screen.getByRole("dialog", { name: "Escolher workspace" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("aria-controls", dialog.id);

    const input = combobox();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    const listbox = screen.getByRole("listbox", { name: "Workspace" });
    expect(input).toHaveAttribute("aria-controls", listbox.id);
    // o rótulo é um <label> de verdade, ligado ao campo
    expect(dialog.querySelector(`label[for="${input.id}"]`)).toHaveTextContent("Buscar workspace");
  });

  it("lista 'Todos' e as entidades como opções; sem escolha, 'Todos' está selecionado e destacado", async () => {
    const { user } = setup();
    await user.click(trigger());

    expect(options().map((o) => o.textContent)).toEqual(["Todos", "Café Serra Verde", "Studio Lume Fotografia", "Aurora Beauty Studio"]);
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    expect(combobox()).toHaveAttribute("aria-activedescendant", options()[0].id);
    expect(options()[1]).toHaveAttribute("aria-selected", "false");
  });

  it("com escolha, a opção escolhida vem selecionada e é a destacada ao abrir", async () => {
    const { user } = setup({ initial: WORKSPACES[1] });
    await user.click(trigger());
    expect(options()[2]).toHaveAttribute("aria-selected", "true");
    expect(activeOption()).toBe(options()[2]);
  });

  it("↓ e ↑ andam pela lista (com volta) e o foco continua na busca", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe(options()[1]);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(activeOption()).toBe(options()[3]);
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe(options()[0]);
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toBe(options()[3]);
    expect(combobox()).toHaveFocus();
  });

  it("Home e End vão ao primeiro e ao último com a busca vazia", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.keyboard("{End}");
    expect(activeOption()).toBe(options()[3]);
    await user.keyboard("{Home}");
    expect(activeOption()).toBe(options()[0]);
  });

  it("com texto digitado, Home/End são do cursor (não são cancelados); com Ctrl, vão à lista", async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.type(combobox(), "st");

    expect(fireEvent.keyDown(combobox(), { key: "End" })).toBe(true);
    expect(fireEvent.keyDown(combobox(), { key: "Home" })).toBe(true);
    expect(fireEvent.keyDown(combobox(), { key: "End", ctrlKey: true })).toBe(false);
  });

  it("Enter escolhe a opção destacada, fecha e devolve o foco à pílula", async () => {
    const onPick = vi.fn();
    const { user } = setup({ onPick });
    await user.click(trigger());
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledWith(WORKSPACES[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveTextContent("Café Serra Verde");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("Enter não envia o formulário em volta", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );
    await user.click(trigger());
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clicar numa opção escolhe e fecha", async () => {
    const onPick = vi.fn();
    const { user } = setup({ onPick });
    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Studio Lume Fotografia" }));
    expect(onPick).toHaveBeenCalledWith(WORKSPACES[1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("Esc fecha só o popover (não chega a um diálogo em volta) e devolve o foco à pílula", async () => {
    const outerKey = vi.fn();
    const user = userEvent.setup();
    render(
      <div onKeyDown={outerKey}>
        <Harness />
      </div>,
    );
    await user.click(trigger());
    outerKey.mockClear();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(outerKey).not.toHaveBeenCalled();
  });

  it("Tab fecha o popover e o foco segue para o próximo controle depois da pílula", async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.tab();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Depois do seletor" })).toHaveFocus();
  });

  it("Shift+Tab fecha e o foco vai para o controle antes da pílula (nunca se perde)", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Antes</button>
        <Harness />
      </div>,
    );
    await user.click(trigger());
    await user.tab({ shift: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Antes" })).toHaveFocus();
  });

  it("↓ na pílula abre o popover; clicar na pílula aberta fecha", async () => {
    const { user } = setup();
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(combobox()).toHaveFocus();

    await user.click(trigger());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicar fora fecha sem roubar o foco de quem foi clicado", async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Depois do seletor" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Depois do seletor" })).toHaveFocus();
  });

  it("abre com o foco na busca também no StrictMode (monta, desmonta e monta de novo)", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    await user.click(trigger());
    expect(combobox()).toHaveFocus();
  });
});

describe("AdminEntityPicker — busca", () => {
  it("espera a pessoa parar de digitar (uma consulta, não uma por tecla)", () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(trigger());
    expect(fake.queries.at(-1)).toBe("");

    const typed = (text: string) => fireEvent.change(combobox(), { target: { value: text } });
    typed("a");
    act(() => vi.advanceTimersByTime(150));
    typed("au");
    act(() => vi.advanceTimersByTime(150));
    typed("aur");
    act(() => vi.advanceTimersByTime(299));
    // nenhuma consulta com texto até o atraso (300 ms) passar
    expect(fake.queries.filter((q) => q !== "")).toEqual([]);

    act(() => vi.advanceTimersByTime(1));
    expect(fake.queries.at(-1)).toBe("aur");
    expect(options().map((o) => o.textContent)).toEqual(["Aurora Beauty Studio"]);
  });

  it("manda o texto aparado e, ao buscar, 'Todos' sai da lista e o primeiro resultado fica em foco", () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.change(combobox(), { target: { value: "  stu  " } });
    act(() => vi.advanceTimersByTime(300));

    expect(fake.queries.at(-1)).toBe("stu");
    expect(options().map((o) => o.textContent)).toEqual(["Studio Lume Fotografia", "Aurora Beauty Studio"]);
    expect(activeOption()).toBe(options()[0]);
  });

  it("Enter antes do atraso da busca não escolhe da lista antiga; depois do atraso escolhe o resultado novo", () => {
    vi.useFakeTimers();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.click(trigger());
    fireEvent.change(combobox(), { target: { value: "aurora" } });
    act(() => vi.advanceTimersByTime(100));
    // a lista ainda é a de antes (sem filtro): o primeiro item seria "Café Serra Verde"
    fireEvent.keyDown(combobox(), { key: "Enter" });
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(200));
    fireEvent.keyDown(combobox(), { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(WORKSPACES[2]);
  });

  it("um clique de mouse que não terminou em 'click' não atrapalha o Enter seguinte na pílula", async () => {
    const { user } = setup();
    await user.click(trigger());
    // mouse pressionado sobre a pílula aberta e solto fora: sem `click`, o popover fecha pelo blur
    fireEvent.mouseDown(trigger());
    fireEvent.blur(combobox(), { relatedTarget: document.body });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    trigger().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("debounceMs customizado", () => {
    vi.useFakeTimers();
    render(<Harness debounceMs={50} />);
    fireEvent.click(trigger());
    fireEvent.change(combobox(), { target: { value: "lume" } });
    act(() => vi.advanceTimersByTime(50));
    expect(fake.queries.at(-1)).toBe("lume");
  });

  it("reabrir recomeça com a busca vazia", async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.type(combobox(), "zzz");
    await user.keyboard("{Escape}");
    await user.click(trigger());
    expect(combobox()).toHaveValue("");
  });

  it("renderOption desenha o conteúdo e recebe selecionado/ativo", async () => {
    const renderOption = vi.fn((w: Workspace, state: { selected: boolean; active: boolean }) => (
      <>
        <b>{w.name}</b>
        <small>{w.owner ?? "sem dono"}</small>
        {state.selected ? <i data-testid="sel" /> : null}
      </>
    ));
    const { user } = setup({ initial: WORKSPACES[0], renderOption });
    await user.click(trigger());

    expect(screen.getByRole("option", { name: /Studio Lume Fotografia/ })).toHaveTextContent("paula@lume.com.br");
    expect(screen.getByRole("option", { name: /Aurora/ })).toHaveTextContent("sem dono");
    expect(screen.getAllByTestId("sel")).toHaveLength(1);
    expect(renderOption).toHaveBeenCalledWith(WORKSPACES[0], { selected: true, active: true });
  });

  it("'Mostrando N de M' quando o servidor tem mais do que a lista", async () => {
    fake.total = 40;
    const { user } = setup();
    await user.click(trigger());
    expect(screen.getByText("Mostrando 3 de 40. Digite para refinar a busca.")).toBeInTheDocument();
  });

  it("anuncia a quantidade de resultados numa região de status", async () => {
    const { user } = setup();
    await user.click(trigger());
    expect(screen.getAllByRole("status").some((el) => el.textContent === "3 resultados")).toBe(true);
  });
});

describe("AdminEntityPicker — estados", () => {
  it("sem resultado: estado vazio do kit com o termo buscado", () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.change(combobox(), { target: { value: "zzz" } });
    act(() => vi.advanceTimersByTime(300));

    const empty = screen.getByText("Nenhum resultado").closest('[role="status"]');
    expect(empty).toHaveTextContent("Nada encontrado para “zzz”");
    // sem lista visível e sem opção ativa
    expect(screen.getByRole("listbox", { hidden: true })).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(combobox()).not.toHaveAttribute("aria-activedescendant");
  });

  it("emptyTitle customizado", () => {
    vi.useFakeTimers();
    render(<Harness emptyTitle="Nenhum workspace" />);
    fireEvent.click(trigger());
    fireEvent.change(combobox(), { target: { value: "zzz" } });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("Nenhum workspace")).toBeInTheDocument();
  });

  it("carregando: esqueleto escondido da árvore e 'Carregando…' anunciado; 'Todos' segue disponível", async () => {
    fake.mode = "loading";
    const { user } = setup({ initial: WORKSPACES[0] });
    await user.click(trigger());

    expect(screen.getAllByRole("status").some((el) => el.textContent === "Carregando…")).toBe(true);
    expect(document.querySelectorAll(".adm-ep-loading .adm-sk").length).toBeGreaterThan(0);
    expect(document.querySelector(".adm-ep-loading")).toHaveAttribute("aria-hidden", "true");
    expect(options().map((o) => o.textContent)).toEqual(["Todos"]);
  });

  it("erro: alerta com a mensagem e 'Tentar de novo'", async () => {
    fake.mode = "error";
    const { user } = setup();
    await user.click(trigger());

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Servidor fora do ar.");
    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(fake.retry).toHaveBeenCalledTimes(1);
    // clicar no botão não fecha o popover
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("erro: Tab da busca chega a 'Tentar de novo' sem fechar; Tab dele fecha; Shift+Tab volta à busca", async () => {
    fake.mode = "error";
    const { user } = setup();
    await user.click(trigger());

    await user.tab();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.tab({ shift: true });
    expect(combobox()).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.tab();
    await user.tab();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Depois do seletor" })).toHaveFocus();
  });

  it("erro: Esc, ainda com o foco em 'Tentar de novo', fecha e volta à pílula", async () => {
    fake.mode = "error";
    const { user } = setup();
    await user.click(trigger());
    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });
});

describe("AdminEntityPicker — limpar e variantes", () => {
  it("o × limpa a escolha e leva o foco à pílula", async () => {
    const onPick = vi.fn();
    const { user } = setup({ initial: WORKSPACES[0], onPick });
    await user.click(screen.getByRole("button", { name: "Limpar workspace" }));

    expect(onPick).toHaveBeenCalledWith(null);
    expect(trigger()).toHaveTextContent("Todos");
    expect(screen.queryByRole("button", { name: "Limpar workspace" })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("a opção 'Todos' da lista limpa a escolha", async () => {
    const onPick = vi.fn();
    const { user } = setup({ initial: WORKSPACES[0], onPick });
    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Todos" }));
    expect(onPick).toHaveBeenCalledWith(null);
    expect(trigger()).toHaveFocus();
  });

  it("clearable=false: sem × e sem opção 'Todos'", async () => {
    const { user } = setup({ initial: WORKSPACES[0], clearable: false });
    expect(screen.queryByRole("button", { name: "Limpar workspace" })).not.toBeInTheDocument();
    await user.click(trigger());
    expect(options().map((o) => o.textContent)).toEqual(["Café Serra Verde", "Studio Lume Fotografia", "Aurora Beauty Studio"]);
  });

  it("variante filterBar: sem × (o chip limpa), mas 'Todos' continua na lista", async () => {
    const { user } = setup({ initial: WORKSPACES[0], variant: "filterBar" });
    expect(screen.queryByRole("button", { name: "Limpar workspace" })).not.toBeInTheDocument();
    expect(trigger().closest(".adm-ep")).toHaveAttribute("data-variant", "filterBar");
    await user.click(trigger());
    expect(options()[0]).toHaveTextContent("Todos");
  });
});

describe("AdminEntityPicker — minChars", () => {
  const typed = (text: string) => fireEvent.change(combobox(), { target: { value: text } });
  const hint = () => document.querySelector(".adm-ep-hint");

  it("antes do mínimo mostra 'Digite pelo menos N letras' (e não o vazio enganoso), ligado à busca por aria-describedby", () => {
    vi.useFakeTimers();
    render(<Harness minChars={3} required />);
    fireEvent.click(trigger());

    expect(hint()).toHaveTextContent("Digite pelo menos 3 letras");
    expect(combobox()).toHaveAttribute("aria-describedby", hint()?.id);
    // a dica também é anunciada na região de status (o aria-describedby só é lido ao focar a caixa)
    expect(screen.getAllByRole("status").some((el) => el.textContent === "Digite pelo menos 3 letras")).toBe(true);
    expect(screen.queryByText("Não há nada para escolher aqui.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum resultado")).not.toBeInTheDocument();
    // o que a busca devolveu para o texto curto é ignorado
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    typed("au");
    act(() => vi.advanceTimersByTime(300));
    expect(hint()).toHaveTextContent("Digite pelo menos 3 letras");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.queryByText("Nenhum resultado")).not.toBeInTheDocument();
  });

  it("no mínimo, a dica sai e a lista aparece depois do atraso (sem piscar o vazio no meio)", () => {
    vi.useFakeTimers();
    render(<Harness minChars={3} required />);
    fireEvent.click(trigger());
    typed("aur");

    // digitou o mínimo, a busca ainda não assentou: sem dica, sem lista, sem vazio; ocupado
    expect(hint()).toBeNull();
    expect(screen.queryByText("Nenhum resultado")).not.toBeInTheDocument();
    expect(combobox()).toHaveAttribute("aria-busy", "true");

    act(() => vi.advanceTimersByTime(300));
    expect(options().map((o) => o.textContent)).toEqual(["Aurora Beauty Studio"]);
    expect(combobox()).not.toHaveAttribute("aria-busy");
    expect(combobox()).not.toHaveAttribute("aria-describedby");
  });

  it("depois do mínimo, sem resultado, vale o vazio de sempre; apagar de novo volta a dica", () => {
    vi.useFakeTimers();
    render(<Harness minChars={3} required />);
    fireEvent.click(trigger());
    typed("zzz");
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("Nenhum resultado")).toBeInTheDocument();
    typed("zz");
    expect(screen.queryByText("Nenhum resultado")).not.toBeInTheDocument();
    expect(hint()).toHaveTextContent("Digite pelo menos 3 letras");
  });

  it("conta o texto aparado e fala 'letra' no singular; sem minChars nada muda", () => {
    expect(adminEntityPickerMinCharsHint(1)).toBe("Digite pelo menos 1 letra");
    vi.useFakeTimers();
    const { unmount } = render(<Harness minChars={2} required />);
    fireEvent.click(trigger());
    typed("  a  ");
    expect(hint()).toHaveTextContent("Digite pelo menos 2 letras");
    unmount();

    render(<Harness />);
    fireEvent.click(trigger());
    expect(hint()).toBeNull();
    expect(options()).toHaveLength(4);
  });

  it("sem obrigatoriedade, 'Todos' continua no topo junto da dica; Enter ainda escolhe e fecha", async () => {
    const onPick = vi.fn();
    const { user } = setup({ minChars: 3, initial: WORKSPACES[0], onPick });
    await user.click(trigger());
    expect(options().map((o) => o.textContent)).toEqual(["Todos"]);
    expect(hint()).toHaveTextContent("Digite pelo menos 3 letras");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it("o erro e o carregamento não aparecem enquanto a dica está na tela", async () => {
    fake.mode = "error";
    const { user } = setup({ minChars: 3, required: true });
    await user.click(trigger());
    expect(hint()).toHaveTextContent("Digite pelo menos 3 letras");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("AdminEntityPicker — required", () => {
  it("sem escolha: a pílula diz 'Escolha…' (nunca o allLabel), sem destaque de ativo", () => {
    setup({ required: true, allLabel: "Qualquer pessoa" });
    expect(trigger()).toHaveTextContent("Workspace:Escolha…");
    expect(trigger()).not.toHaveTextContent("Qualquer pessoa");
    expect(trigger().closest(".adm-ep")).not.toHaveAttribute("data-active");
    expect(trigger().closest(".adm-ep")).toHaveAttribute("data-required", "true");
    expect(trigger().querySelector(".adm-ep-v")).toHaveAttribute("data-placeholder", "true");
  });

  it("sem opção 'Todos' na lista, sem × na pílula, mesmo com clearable", async () => {
    const { user } = setup({ required: true, clearable: true, initial: WORKSPACES[1] });
    expect(screen.queryByRole("button", { name: "Limpar workspace" })).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Workspace:Studio Lume Fotografia");
    expect(trigger().querySelector(".adm-ep-v")).not.toHaveAttribute("data-placeholder");
    await user.click(trigger());
    expect(options().map((o) => o.textContent)).toEqual(["Café Serra Verde", "Studio Lume Fotografia", "Aurora Beauty Studio"]);
    // a escolha atual abre destacada
    expect(activeOption()).toBe(options()[1]);
  });

  it("também some o 'Todos' na variante filterBar, e escolher funciona pelo teclado", async () => {
    const onPick = vi.fn();
    const { user } = setup({ required: true, variant: "filterBar", onPick });
    await user.click(trigger());
    expect(screen.queryByRole("option", { name: "Todos" })).not.toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith(WORKSPACES[1]);
    expect(trigger()).toHaveTextContent("Workspace:Studio Lume Fotografia");
    expect(trigger()).toHaveFocus();
  });

  it("sem required, tudo como antes", () => {
    setup();
    expect(trigger()).toHaveTextContent("Workspace:Todos");
    expect(trigger().closest(".adm-ep")).not.toHaveAttribute("data-required");
  });
});

describe("AdminEntityPicker — fullWidthOnMobile", () => {
  const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-entity-picker.css"), "utf8");

  it("marca a pílula solta com data-full-mobile; padrão e filterBar não levam a marca", () => {
    const { unmount } = setup({ fullWidthOnMobile: true });
    expect(trigger().closest(".adm-ep")).toHaveAttribute("data-full-mobile", "true");
    unmount();
    const second = setup();
    expect(trigger().closest(".adm-ep")).not.toHaveAttribute("data-full-mobile");
    second.unmount();
    setup({ fullWidthOnMobile: true, variant: "filterBar" });
    expect(trigger().closest(".adm-ep")).not.toHaveAttribute("data-full-mobile");
  });

  it("o CSS dá a linha inteira só no celular, sob .pv e com tokens", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 560px)"), css.indexOf("@media (prefers-reduced-motion"));
    expect(mobile).toMatch(/\[data-variant="pill"\]\[data-full-mobile="true"\]\s*\{[^}]*width:\s*100%/);
    const outside = css.slice(0, css.indexOf("@media (max-width: 560px)"));
    expect(outside).not.toMatch(/data-full-mobile/);
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^\s*\.[^{}@]*(?=\{)/gm) ?? [];
    selectors.forEach((selector) => expect(selector.trim()).toMatch(/^\.pv /));
  });
});

describe("adminEntityPickerSummary", () => {
  it("texto do chip, ou null sem escolha", () => {
    expect(adminEntityPickerSummary("Workspace", WORKSPACES[0], (w) => w.name)).toBe("Workspace: Café Serra Verde");
    expect(adminEntityPickerSummary("Workspace", null, (w: Workspace) => w.name)).toBeNull();
    expect(adminEntityPickerSummary("Workspace", undefined, (w: Workspace) => w.name)).toBeNull();
  });
});

describe("computeEntityPickerPosition", () => {
  const viewport = { width: 1200, height: 800 };

  it("abre embaixo, alinhado à esquerda da pílula, com a largura mínima do popover", () => {
    const pos = computeEntityPickerPosition({ left: 100, top: 100, bottom: 144, width: 200 }, viewport);
    expect(pos).toMatchObject({ placement: "bottom", left: 100, width: 320, top: 150 });
    expect(pos.bottom).toBeUndefined();
    expect(pos.maxHeight).toBe(440);
  });

  it("inverte para cima quando falta espaço embaixo e sobra em cima", () => {
    const pos = computeEntityPickerPosition({ left: 100, top: 700, bottom: 744, width: 200 }, viewport);
    expect(pos.placement).toBe("top");
    expect(pos.bottom).toBe(800 - 700 + 6);
    expect(pos.top).toBeUndefined();
    // espaço em cima: 700 - 6 - 16, limitado a 440
    expect(pos.maxHeight).toBe(440);
  });

  it("fica embaixo (e a lista rola) quando nenhum dos lados é melhor", () => {
    const pos = computeEntityPickerPosition({ left: 10, top: 100, bottom: 144, width: 200 }, { width: 1200, height: 360 });
    expect(pos.placement).toBe("bottom");
    expect(pos.maxHeight).toBe(360 - 144 - 6 - 16);
  });

  it("nunca sai da janela pela direita nem pela esquerda e respeita a largura máxima", () => {
    const right = computeEntityPickerPosition({ left: 1100, top: 100, bottom: 144, width: 150 }, viewport);
    expect(right.left + right.width).toBeLessThanOrEqual(1200 - 16);
    const left = computeEntityPickerPosition({ left: -40, top: 100, bottom: 144, width: 150 }, viewport);
    expect(left.left).toBe(16);
    const wide = computeEntityPickerPosition({ left: 100, top: 100, bottom: 144, width: 900 }, viewport);
    expect(wide.width).toBe(420);
  });

  it("no celular estreito, o popover cabe com 16px de margem de cada lado", () => {
    const pos = computeEntityPickerPosition({ left: 16, top: 100, bottom: 144, width: 300 }, { width: 340, height: 700 });
    expect(pos.width).toBe(308);
    expect(pos.left).toBe(16);
  });
});

describe("AdminEntityPicker — posição no DOM", () => {
  it("o popover vai para um portal no <body> com position fixed calculado e inverte perto da base da janela", async () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 40,
      top: 640,
      bottom: 684,
      right: 240,
      width: 200,
      height: 44,
      x: 40,
      y: 640,
      toJSON: () => ({}),
    });
    const { user, container } = setup();
    await user.click(trigger());

    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog.closest(".pv")).not.toBeNull();
    expect(dialog).toHaveAttribute("data-placement", "top");
    expect(dialog.style.left).toBe("40px");
    expect(dialog.style.bottom).toBe("66px");
    expect(dialog.style.top).toBe("");
  });
});
