import { describe, expect, it } from "vitest";

import { buildFlow, type ChatLine, type FlowItem } from "./flow";
import { hrefOf, linkify } from "./linkify";

const line = (id: string, sender: string, iso: string, extra: Partial<ChatLine> = {}): ChatLine => ({
  id,
  mine: sender === "me",
  senderKey: sender,
  senderName: sender,
  body: id,
  attachments: [],
  createdAt: iso,
  ...extra,
});
const NOW = new Date("2026-11-03T18:00:00Z");
type Msg = Extract<FlowItem, { kind: "msg" }>;
const msgs = (items: FlowItem[]) => items.filter((i): i is Msg => i.kind === "msg");

describe("buildFlow", () => {
  it("agrupa seguidas do mesmo remetente e só o primeiro mostra o nome", () => {
    const items = buildFlow(
      [
        line("1", "ana", "2026-11-03T12:00:00Z"),
        line("2", "ana", "2026-11-03T12:02:00Z"),
        line("3", "bia", "2026-11-03T12:03:00Z"),
      ],
      { now: NOW },
    );
    expect(msgs(items).map((m) => [m.first, m.last, m.showSender])).toEqual([
      [true, false, true],
      [false, true, false],
      [true, true, true],
    ]);
  });
  it("separa por intervalo maior que 5 minutos e por dia, com separador de data", () => {
    const items = buildFlow(
      [
        line("1", "ana", "2026-11-02T12:00:00Z"),
        line("2", "ana", "2026-11-03T12:00:00Z"),
        line("3", "ana", "2026-11-03T12:10:00Z"),
      ],
      { now: NOW },
    );
    expect(items.filter((i) => i.kind === "day").map((d) => (d as { label: string }).label)).toEqual(["Ontem", "Hoje"]);
    expect(msgs(items).map((m) => m.first)).toEqual([true, true, true]);
  });
  it("mensagens próprias não mostram nome; o divisor 'novas' entra antes da primeira não lida", () => {
    const items = buildFlow([line("1", "me", "2026-11-03T12:00:00Z"), line("2", "ana", "2026-11-03T12:30:00Z")], {
      now: NOW,
      unreadFromId: "2",
    });
    expect(items.map((i) => i.kind)).toEqual(["day", "msg", "new", "msg"]);
    expect(msgs(items)[0].showSender).toBe(false);
  });
});

describe("linkify", () => {
  it("transforma http(s) e www em links seguros, sem a pontuação final", () => {
    const parts = linkify("veja https://hype.com/a?b=1, e www.exemplo.com.br.");
    const links = parts.filter((p) => typeof p === "object") as unknown as {
      props: { href: string; children: string };
    }[];
    expect(links.map((l) => l.props.href)).toEqual(["https://hype.com/a?b=1", "https://www.exemplo.com.br/"]);
    expect(links[0].props.children).toBe("https://hype.com/a?b=1");
  });
  it("não cria link para outros esquemas", () => {
    expect(hrefOf("javascript:alert(1)")).toBeUndefined();
    expect(linkify("javascript:alert(1)")).toEqual(["javascript:alert(1)"]);
  });
});
