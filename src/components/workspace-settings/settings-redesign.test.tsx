import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceMember } from "@/shared/types";

import { BrandTab } from "./brand-tab";
import { NichePicker } from "./niche-picker";
import { TeamTab } from "./team-tab";

afterEach(cleanup);

const member = (id: number, name: string, role: WorkspaceMember["role"]): WorkspaceMember => ({ user_id: id, name, email: `${name.split(" ")[0].toLowerCase()}@x.com`, role, created_at: "" });
const members = [member(1, "Lúcia Prado", "owner"), member(2, "Marcos Dias", "admin"), member(3, "Paula Reis", "member")];

const team = {
  workspaceName: "Casa Aurora",
  members,
  loading: false,
  selfId: 2,
  canInvite: true,
  canManagePermissions: true,
  canRemoveMember: () => true,
  removing: false,
  onInvite: vi.fn(),
  onEdit: vi.fn(),
  onRemove: vi.fn(),
};

describe("Equipe", () => {
  it("o proprietário nunca tem remover nem permissões, mesmo com permissão de remover; você é identificado", () => {
    render(<TeamTab {...team} />);
    const rows = within(screen.getByRole("list", { name: "Membros da equipe" })).getAllByRole("listitem");
    const owner = rows[0];
    expect(within(owner).getByText("Proprietário")).toBeTruthy();
    expect(within(owner).queryByRole("button", { name: /Remover|Permissões/ })).toBeNull();
    const self = rows.find((r) => within(r).queryByText("Você"))!;
    expect(within(self).queryByRole("button", { name: /^Remover/ })).toBeNull();
    expect(within(rows[2]).getByRole("button", { name: "Remover Paula Reis" })).toBeTruthy();
  });

  it("remover pede confirmação antes de executar", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<TeamTab {...team} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Remover Paula Reis" }));
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(onRemove).toHaveBeenCalledWith(members[2]);
  });

  it("carregando, erro com tentar de novo, equipe vazia e restrição de permissão", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<TeamTab {...team} loading members={[]} />);
    expect(screen.getByLabelText("Carregando equipe")).toBeTruthy();
    rerender(<TeamTab {...team} members={[]} error onRetry={onRetry} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<TeamTab {...team} members={[]} />);
    expect(screen.getByText("Nenhum membro por aqui ainda")).toBeTruthy();
    rerender(<TeamTab {...team} canInvite={false} canManagePermissions={false} />);
    expect(screen.queryByRole("button", { name: "Adicionar membro" })).toBeNull();
    expect(screen.getByText(/só administradores convidam/)).toBeTruthy();
  });

  it("mostra o resumo por função", () => {
    render(<TeamTab {...team} />);
    const sum = screen.getByLabelText("Resumo por função");
    expect(sum.textContent).toMatch(/1 proprietário/);
    expect(sum.textContent).toMatch(/1 administrador/);
    expect(sum.textContent).toMatch(/1 membro/);
  });
});

const niches = [
  { id: 1, parent_id: null, name: "Moda" },
  { id: 2, parent_id: 1, name: "Streetwear" },
  { id: 3, parent_id: null, name: "Games" },
];

describe("Seletor de nicho", () => {
  it("categorias recolhidas, busca abre a que combina, escolher e remover", () => {
    const onChange = vi.fn();
    const { rerender } = render(<NichePicker niches={niches} value="" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Streetwear" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar nicho"), { target: { value: "street" } });
    fireEvent.click(screen.getByRole("button", { name: "Streetwear" }));
    expect(onChange).toHaveBeenCalledWith("2");
    rerender(<NichePicker niches={niches} value="2" onChange={onChange} />);
    expect(screen.getByText("1 selecionado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover nicho Streetwear" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    fireEvent.change(screen.getByLabelText("Buscar nicho"), { target: { value: "zzz" } });
    expect(screen.getByText(/Nenhum nicho encontrado/)).toBeTruthy();
  });
});

const brand = { name: "Casa", description: "", nicheId: "", niches, canEdit: true, canPhoto: true, saving: false, photoPending: false, onSave: vi.fn(), onPhoto: vi.fn() };

describe("Marca · salvamento", () => {
  it("sem edição não há barra de pendência; ao editar aparecem descartar e salvar", async () => {
    const user = userEvent.setup();
    render(<BrandTab {...brand} />);
    expect(screen.getByRole("status").className).not.toContain("show");
    await user.type(screen.getByLabelText("Nome da marca"), " Home");
    expect(screen.getByRole("status").textContent).toMatch(/Alterações não salvas/);
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    expect((screen.getByLabelText("Nome da marca") as HTMLInputElement).value).toBe("Casa");
  });

  it("mostra salvo e erro", () => {
    const { rerender } = render(<BrandTab {...brand} saved />);
    expect(screen.getByRole("status").textContent).toMatch(/Alterações salvas/);
    rerender(<BrandTab {...brand} saveError="Servidor indisponível" />);
    expect(screen.getByRole("status").textContent).toMatch(/Não foi possível salvar: Servidor indisponível/);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("sem permissão não há barra de salvamento e os campos ficam bloqueados", () => {
    render(<BrandTab {...brand} canEdit={false} canPhoto={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByLabelText("Nome da marca") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Somente administradores/)).toBeTruthy();
  });
});
