import { describe, expect, it } from "vitest";

import type { TeamChatConversation } from "@/shared/services/team-chat";
import { attachmentSummary, conversationPreview, formatFileSize, roleLabel } from "./format";

const conv = (over: Partial<TeamChatConversation>): TeamChatConversation => ({
  id: "c",
  kind: "direct",
  title: "Ana",
  peer: null,
  last_message: null,
  unread: 0,
  peer_last_read_message_id: null,
  ...over,
});
const last = (over: Record<string, unknown> = {}) => ({
  body: "oi",
  sender_id: 2,
  sender_name: "Ana Souza",
  created_at: "2026-11-03T10:00:00Z",
  has_attachments: false,
  ...over,
});

describe("formatFileSize", () => {
  it("escolhe a unidade", () => {
    expect(formatFileSize(0)).toBe("");
    expect(formatFileSize(12)).toBe("12 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1536 * 1024)).toBe("1,5 MB");
    expect(formatFileSize(25 * 1024 * 1024)).toBe("25 MB");
  });
});

describe("conversationPreview", () => {
  it("no 1 a 1 marca só as minhas; no canal leva o primeiro nome", () => {
    expect(conversationPreview(conv({ last_message: last() }), 1)).toBe("oi");
    expect(conversationPreview(conv({ last_message: last({ sender_id: 1 }) }), 1)).toBe("Você: oi");
    expect(conversationPreview(conv({ kind: "channel", last_message: last() }), 1)).toBe("Ana: oi");
    expect(conversationPreview(conv({ kind: "channel", last_message: last({ sender_id: 1 }) }), 1)).toBe("Você: oi");
  });
  it("sem texto usa o anexo; sem mensagem usa o convite", () => {
    expect(conversationPreview(conv({ last_message: last({ body: "", has_attachments: true }) }), 1)).toBe("Anexo");
    expect(conversationPreview(conv({ kind: "channel" }), 1)).toBe("Converse com toda a equipe");
    expect(conversationPreview(conv({}), 1)).toBe("Nenhuma mensagem ainda");
  });
});

describe("attachmentSummary / roleLabel", () => {
  it("resume os anexos", () => {
    expect(attachmentSummary([])).toBe("");
    expect(attachmentSummary([{ mime_type: "image/png" }])).toBe("Imagem");
    expect(attachmentSummary([{ mime_type: "image/png" }, { mime_type: "image/jpeg" }])).toBe("2 imagens");
    expect(attachmentSummary([{ mime_type: "application/pdf" }])).toBe("Anexo");
    expect(attachmentSummary([{ mime_type: "image/png" }, { mime_type: "application/pdf" }])).toBe("2 anexos");
  });
  it("traduz o papel", () => {
    expect(roleLabel("observador")).toBe("Observador");
    expect(roleLabel("outro")).toBe("outro");
  });
});
