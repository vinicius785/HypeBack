import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InviteModal } from "./invite-modal";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a> }));

afterEach(cleanup);

const brands = [
  { id: "b-1", name: "Rodonaves" },
  { id: "b-2", name: "MaxMilhas" },
];

const base = { pending: false, canManagePermissions: true, forceNew: 0, onClose: vi.fn() };

describe("InviteModal — papel Cliente da agência", () => {
  it("só oferece o papel Cliente em workspace de agência", () => {
    const { rerender } = render(<InviteModal {...base} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cliente" })).not.toBeInTheDocument();
    rerender(<InviteModal {...base} isAgency brands={brands} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cliente" })).toBeInTheDocument();
  });

  it("Cliente pede as marcas e não deixa enviar sem nenhuma", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<InviteModal {...base} isAgency brands={brands} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("E-mail"), "ana@marca.com");
    await user.click(screen.getByRole("button", { name: "Cliente" }));
    expect(screen.getByText("Marcas que o cliente acompanha")).toBeInTheDocument();
    // sem a personalização de acessos: o cliente tem um conjunto fixo
    expect(screen.queryByText("Acessos")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enviar convite" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Escolha ao menos uma marca")).toBeInTheDocument();
  });

  it("envia o convite com as marcas escolhidas e sem permissões personalizadas", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<InviteModal {...base} isAgency brands={brands} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("E-mail"), "ana@marca.com");
    await user.click(screen.getByRole("button", { name: "Cliente" }));
    await user.click(screen.getByRole("button", { name: "MaxMilhas" }));
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ana@marca.com", role: "cliente", brandIds: ["b-2"], permissions: undefined }),
    );
  });

  it("trocar de Cliente para outro papel descarta as marcas escolhidas", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<InviteModal {...base} isAgency brands={brands} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("E-mail"), "ana@marca.com");
    await user.click(screen.getByRole("button", { name: "Cliente" }));
    await user.click(screen.getByRole("button", { name: "Rodonaves" }));
    await user.click(screen.getByRole("button", { name: "Observador" }));
    await user.click(screen.getByRole("button", { name: "Enviar convite" }));

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.role).toBe("observador");
    expect(payload.brandIds).toBeUndefined();
  });

  it("agência sem marcas ativas avisa em vez de oferecer uma lista vazia", async () => {
    const user = userEvent.setup();
    render(<InviteModal {...base} isAgency brands={[]} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Cliente" }));
    expect(screen.getByText(/ainda não tem marcas ativas/)).toBeInTheDocument();
  });
});
