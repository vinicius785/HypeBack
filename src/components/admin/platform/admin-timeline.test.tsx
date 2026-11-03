import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminTimeline, AdminTimelineItem, groupTimelineByDay } from "./admin-timeline";

const css = readFileSync(resolve(__dirname, "../../../styles/admin-kit-timeline.css"), "utf8");

function groups() {
  return [
    {
      key: "2026-11-03",
      label: "Hoje",
      items: [
        <AdminTimelineItem key="a" title="Campanha criada" time="14:02" />,
        <AdminTimelineItem key="b" title="Aporte pago" time="09:40" />,
      ],
    },
    {
      key: "2026-11-02",
      label: "Ontem",
      items: <AdminTimelineItem title="Workspace criado" time="18:15" />,
    },
  ];
}

describe("AdminTimeline", () => {
  it("usa <ol>/<li> semânticos: grupos de dia, cada um com um cabeçalho e a sua lista", () => {
    render(<AdminTimeline groups={groups()} ariaLabel="Atividade" />);
    const outer = screen.getByRole("list", { name: "Atividade" });
    expect(outer.tagName).toBe("OL");
    expect(screen.getByRole("heading", { level: 3, name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Ontem" })).toBeInTheDocument();
    const days = within(outer).getAllByRole("listitem").filter((li) => li.classList.contains("adm-tl-day"));
    expect(days).toHaveLength(2);
    expect(within(days[0]).getAllByRole("listitem")).toHaveLength(2);
    expect(within(days[1]).getAllByRole("listitem")).toHaveLength(1);
  });

  it("o nível do cabeçalho de dia é configurável", () => {
    render(<AdminTimeline groups={groups()} headingLevel={4} />);
    expect(screen.getByRole("heading", { level: 4, name: "Hoje" })).toBeInTheDocument();
  });

  it("um único grupo sem rótulo vira só a lista de eventos (sem lista dentro de lista)", () => {
    render(
      <AdminTimeline
        ariaLabel="Recentes"
        groups={[{ items: [<AdminTimelineItem key="a" title="Um" time="1 min" />, <AdminTimelineItem key="b" title="Dois" time="2 min" />] }]}
      />,
    );
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Recentes" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("busy esmaece a lista e marca aria-busy; sem busy não marca", () => {
    const { rerender } = render(<AdminTimeline groups={groups()} ariaLabel="Atividade" busy />);
    expect(screen.getByRole("list", { name: "Atividade" })).toHaveAttribute("aria-busy", "true");
    rerender(<AdminTimeline groups={groups()} ariaLabel="Atividade" />);
    expect(screen.getByRole("list", { name: "Atividade" })).not.toHaveAttribute("aria-busy");
  });
});

describe("AdminTimelineItem", () => {
  const renderItem = (props: Partial<React.ComponentProps<typeof AdminTimelineItem>> = {}) =>
    render(
      <ol>
        <AdminTimelineItem title="Saque pago" time="há 3 min" {...props} />
      </ol>,
    );

  it("mostra título, meta (sem vazios, cada parte separada) e hora", () => {
    renderItem({ meta: ["por Ana", null, <a key="l" href="/w">Acme</a>, false] });
    expect(screen.getByText("Saque pago")).toBeInTheDocument();
    const meta = document.querySelector(".adm-tl-meta") as HTMLElement;
    expect(meta.children).toHaveLength(2);
    expect(within(meta).getByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(screen.getByText("há 3 min")).toBeInTheDocument();
  });

  it("meta com texto vazio ou só espaço (nome ausente) não vira parte nem deixa um '·' sobrando", () => {
    renderItem({ meta: ["", "  ", "Acme"] });
    const meta = document.querySelector(".adm-tl-meta") as HTMLElement;
    expect(meta.children).toHaveLength(1);
    renderItem({ meta: ["", ""] });
    expect(document.querySelectorAll(".adm-tl-meta")).toHaveLength(1);
  });

  it("sem meta, não renderiza o parágrafo de apoio", () => {
    renderItem();
    expect(document.querySelector(".adm-tl-meta")).toBeNull();
  });

  it("com dateTime a hora é <time datetime>, com o instante completo no title", () => {
    renderItem({ dateTime: "2026-11-03T14:02:00Z", timeTitle: "3 de novembro, 11:02" });
    const time = screen.getByText("há 3 min");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-11-03T14:02:00Z");
    expect(time).toHaveAttribute("title", "3 de novembro, 11:02");
  });

  it("sem dateTime a hora é um span comum", () => {
    renderItem();
    expect(screen.getByText("há 3 min").tagName).toBe("SPAN");
  });

  it("o marcador é decorativo; com ícone vira círculo, sem ícone é ponto; o tom padrão é neutro", () => {
    const { rerender } = renderItem();
    const mark = () => document.querySelector(".adm-tl-mark") as HTMLElement;
    expect(mark()).toHaveAttribute("aria-hidden", "true");
    expect(mark()).not.toHaveAttribute("data-icon");
    expect(document.querySelector(".adm-tl-item")).toHaveAttribute("data-tone", "neutral");
    rerender(
      <ol>
        <AdminTimelineItem title="Saque pago" time="agora" icon="check" tone="ok" />
      </ol>,
    );
    expect(mark()).toHaveAttribute("data-icon", "true");
    expect(mark().querySelector("svg")).not.toBeNull();
    expect(document.querySelector(".adm-tl-item")).toHaveAttribute("data-tone", "ok");
  });

  it("sem detalhe não há botão", () => {
    renderItem();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("com detalhe: botão com aria-expanded=false, aria-controls e o detalhe oculto", () => {
    renderItem({ detail: <p>Motivo: estorno</p> });
    const button = screen.getByRole("button", { name: "Ver detalhes" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(button.getAttribute("aria-controls") as string) as HTMLElement;
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("hidden");
    expect(screen.queryByText("Motivo: estorno")).not.toBeVisible();
  });

  it("o botão é descrito pelo título do evento (vários 'Ver detalhes' na lista não ficam anônimos)", () => {
    renderItem({ detail: "x" });
    expect(screen.getByRole("button", { name: "Ver detalhes" })).toHaveAccessibleDescription("Saque pago");
  });

  it("clique abre e fecha, trocando o rótulo e o aria-expanded, e avisa onToggle", async () => {
    const onToggle = vi.fn();
    renderItem({ detail: <p>Motivo: estorno</p>, onToggle });
    await userEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));
    const button = screen.getByRole("button", { name: "Ocultar detalhes" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Motivo: estorno")).toBeVisible();
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Ver detalhes" })).toHaveAttribute("aria-expanded", "false");
    expect(onToggle.mock.calls).toEqual([[true], [false]]);
  });

  it("teclado: Tab chega ao botão, Enter e Espaço abrem e fecham, e o foco fica nele", async () => {
    renderItem({ detail: <p>Motivo: estorno</p> });
    await userEvent.tab();
    const button = screen.getByRole("button");
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("defaultOpen abre já expandido", () => {
    renderItem({ detail: <p>Motivo: estorno</p>, defaultOpen: true });
    expect(screen.getByRole("button", { name: "Ocultar detalhes" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Motivo: estorno")).toBeVisible();
  });

  it("detalhe vazio (null/false) não cria botão", () => {
    const { rerender } = renderItem({ detail: null });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <ol>
        <AdminTimelineItem title="x" time="y" detail={false} />
      </ol>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("cada item tem os seus próprios ids (dois detalhes abertos não se confundem)", async () => {
    render(
      <ol>
        <AdminTimelineItem title="Um" time="1" detail="primeiro" />
        <AdminTimelineItem title="Dois" time="2" detail="segundo" />
      </ol>,
    );
    const [a, b] = screen.getAllByRole("button");
    expect(a.getAttribute("aria-controls")).not.toBe(b.getAttribute("aria-controls"));
    await userEvent.click(b);
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("segundo")).toBeVisible();
    expect(screen.getByText("primeiro")).not.toBeVisible();
  });

  it("não exibe rótulo de tipo em caixa alta: o texto é o que foi passado", () => {
    renderItem({ meta: "Ação do time" });
    expect(screen.getByText("Ação do time")).toHaveTextContent("Ação do time");
  });
});

describe("CSS da linha do tempo", () => {
  it("sem caixa alta, sem sombra, anel de foco do kit e alvo de toque do kit", () => {
    expect(css).not.toMatch(/text-transform:\s*uppercase/);
    expect(css).not.toMatch(/box-shadow:\s*0/);
    expect(css).toMatch(/\.adm-tl-toggle:focus-visible\s*\{[^}]*box-shadow:\s*var\(--adm-ring\)/);
    expect(css).toMatch(/\.adm-tl-toggle\s*\{[^}]*min-height:\s*var\(--adm-hit\)/);
  });

  it("tudo sob .pv, sem hex solto, e transições desligadas com movimento reduzido", () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^\s@{}][^{}]*(?=\{)/gm) ?? [];
    expect(selectors.length).toBeGreaterThan(0);
    selectors.forEach((selector) => expect(selector.trim()).toMatch(/^\.pv /));
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css.slice(css.indexOf("@media (prefers-reduced-motion"))).toMatch(/transition:\s*none/);
  });
});

describe("AdminTimelineItem: data-* e className", () => {
  it("repassa data-* e className ao <li>, sem perder a classe e o tom do kit", () => {
    render(
      <AdminTimeline
        groups={[
          {
            items: (
              <AdminTimelineItem
                title="Campanha criada"
                time="14:02"
                tone="ok"
                className="minha-classe"
                data-event-id="evt-1"
                data-kind="campaign_created"
              />
            ),
          },
        ]}
      />,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveClass("adm-tl-item", "minha-classe");
    expect(li).toHaveAttribute("data-event-id", "evt-1");
    expect(li).toHaveAttribute("data-kind", "campaign_created");
    expect(li).toHaveAttribute("data-tone", "ok");
  });

  it("sem className nem data-*, o <li> fica como antes", () => {
    render(<AdminTimeline groups={[{ items: <AdminTimelineItem title="Algo" time="09:00" /> }]} />);
    const li = screen.getByRole("listitem");
    expect(li.className).toBe("adm-tl-item");
    expect(li.getAttributeNames().sort()).toEqual(["class", "data-tone"]);
  });
});

describe("groupTimelineByDay", () => {
  // 3 nov 2026, 15:00 em São Paulo (UTC-3) = 18:00Z
  const NOW = new Date("2026-11-03T18:00:00Z");
  const get = (e: { at: string }) => e.at;

  it("rotula Hoje, Ontem e o dia por extenso, na ordem de chegada", () => {
    const events = [
      { id: 1, at: "2026-11-03T17:00:00Z" },
      { id: 2, at: "2026-11-03T12:00:00Z" },
      { id: 3, at: "2026-11-02T20:00:00Z" },
      { id: 4, at: "2026-10-30T15:00:00Z" },
    ];
    const groups = groupTimelineByDay(events, get, { timeZone: "America/Sao_Paulo", now: NOW });
    expect(groups.map((g) => [g.key, g.label, g.items.map((e) => e.id)])).toEqual([
      ["2026-11-03", "Hoje", [1, 2]],
      ["2026-11-02", "Ontem", [3]],
      ["2026-10-30", "Sexta-feira, 30 de outubro", [4]],
    ]);
  });

  it("o dia vem do fuso: 01h UTC ainda é o dia anterior em São Paulo", () => {
    const events = [{ at: "2026-11-03T01:30:00Z" }, { at: "2026-11-03T02:59:00Z" }, { at: "2026-11-03T03:00:00Z" }];
    const sp = groupTimelineByDay(events, get, { timeZone: "America/Sao_Paulo", now: NOW });
    expect(sp.map((g) => [g.key, g.items.length])).toEqual([
      ["2026-11-02", 2],
      ["2026-11-03", 1],
    ]);
    const utc = groupTimelineByDay(events, get, { timeZone: "UTC", now: NOW });
    expect(utc.map((g) => [g.key, g.items.length])).toEqual([["2026-11-03", 3]]);
  });

  it("Hoje também respeita o fuso do 'agora'", () => {
    // 02:00Z de 4 nov ainda é 3 nov em São Paulo
    const now = new Date("2026-11-04T02:00:00Z");
    const [group] = groupTimelineByDay([{ at: "2026-11-03T15:00:00Z" }], get, { now });
    expect(group.label).toBe("Hoje");
    const [utcGroup] = groupTimelineByDay([{ at: "2026-11-03T15:00:00Z" }], get, { timeZone: "UTC", now });
    expect(utcGroup.label).toBe("Ontem");
  });

  it("mostra o ano quando o dia não é do ano atual", () => {
    const [group] = groupTimelineByDay([{ at: "2025-12-24T15:00:00Z" }], get, { now: NOW });
    expect(group.label).toBe("Quarta-feira, 24 de dezembro de 2025");
  });

  it("data inválida ou ausente vai para um grupo 'Sem data' e não quebra", () => {
    const groups = groupTimelineByDay([{ at: "lixo" }, { at: "" }, { at: "2026-11-03T17:00:00Z" }], get, { now: NOW });
    expect(groups.map((g) => [g.key, g.label, g.items.length])).toEqual([
      ["", "Sem data", 2],
      ["2026-11-03", "Hoje", 1],
    ]);
  });

  it("fuso inválido volta ao de São Paulo; lista vazia dá nenhum grupo; aceita Date e número", () => {
    const [group] = groupTimelineByDay([{ at: "2026-11-03T01:30:00Z" }], get, { timeZone: "Nao/Existe", now: NOW });
    expect(group.key).toBe("2026-11-02");
    expect(groupTimelineByDay([], get, { now: NOW })).toEqual([]);
    const dates = groupTimelineByDay([new Date("2026-11-03T17:00:00Z"), Date.parse("2026-11-03T16:00:00Z")], (d) => d, { now: NOW.getTime() });
    expect(dates).toHaveLength(1);
    expect(dates[0].label).toBe("Hoje");
  });

  it("não reordena: dias que se repetem sem serem vizinhos viram grupos separados", () => {
    const groups = groupTimelineByDay(
      [{ at: "2026-11-03T17:00:00Z" }, { at: "2026-11-02T17:00:00Z" }, { at: "2026-11-03T10:00:00Z" }],
      get,
      { now: NOW },
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-11-03", "2026-11-02", "2026-11-03"]);
  });

  it("os grupos entram direto no AdminTimeline (trocando items pelos itens)", () => {
    const events = [
      { id: "a", at: "2026-11-03T17:00:00Z" },
      { id: "b", at: "2026-11-02T17:00:00Z" },
    ];
    const groups = groupTimelineByDay(events, get, { now: NOW }).map((g) => ({
      key: g.key,
      label: g.label,
      items: g.items.map((e) => <AdminTimelineItem key={e.id} title={`Evento ${e.id}`} time="—" />),
    }));
    render(<AdminTimeline groups={groups} ariaLabel="Atividade" />);
    expect(screen.getByRole("heading", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ontem" })).toBeInTheDocument();
    expect(screen.getByText("Evento b")).toBeInTheDocument();
  });
});
