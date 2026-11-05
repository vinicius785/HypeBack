import { afterEach, describe, expect, it, vi } from "vitest";

import type { Task, TaskComment } from "@/shared/services/agency-projects";

import {
  addTag,
  canAddAssignee,
  canRemoveComment,
  columnDropId,
  describeEvent,
  describeEventDetail,
  draftFromTask,
  draftToInput,
  emptyDraft,
  isDraftDirty,
  isPlausibleDueDate,
  neighborColumn,
  normalizeAssignees,
  normalizeTag,
  readShowSubtasks,
  removeTag,
  resolveDrop,
  setPrimaryAssignee,
  showSubtasksStorageKey,
  sortComments,
  sortEvents,
  statusFromDropId,
  toggleAssignee,
  validateAttachment,
  validateComment,
  validateDueDate,
  validateTaskDescription,
  validateTaskTitle,
  writeShowSubtasks,
} from "./task-logic";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  project_id: "p1",
  parent_task_id: null,
  title: "Roteiro",
  description: null,
  status: "aberto",
  priority: "normal",
  due_date: null,
  tags: [],
  completed_at: null,
  assignees: [],
  counts: { subtasks: 0, subtasks_done: 0, comments: 0, attachments: 0 },
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("soltar cartão em coluna", () => {
  it("o id da coluna vai e volta; qualquer outro id não é coluna", () => {
    expect(statusFromDropId(columnDropId("em_ajustes"))).toBe("em_ajustes");
    expect(statusFromDropId("column:inexistente")).toBeNull();
    expect(statusFromDropId("t1")).toBeNull();
    expect(statusFromDropId(undefined)).toBeNull();
  });

  it("soltar em outra coluna devolve a tarefa e o status novo", () => {
    const t = task();
    expect(resolveDrop([t], "t1", columnDropId("concluido"))).toEqual({ task: t, status: "concluido" });
  });

  it("mesma coluna, fora do quadro, sobre outro cartão ou tarefa desconhecida: nada muda", () => {
    expect(resolveDrop([task()], "t1", columnDropId("aberto"))).toBeNull();
    expect(resolveDrop([task()], "t1", null)).toBeNull();
    expect(resolveDrop([task()], "t1", "t2")).toBeNull();
    expect(resolveDrop([task()], "zzz", columnDropId("concluido"))).toBeNull();
  });
});

describe("teclado: coluna vizinha", () => {
  const boxes = [
    { id: "a", left: 0, top: 0, width: 100 },
    { id: "b", left: 120, top: 0, width: 100 },
    { id: "c", left: 240, top: 0, width: 100 },
  ];

  it("vai para a seguinte e para a anterior a partir da coluna de centro mais próximo", () => {
    expect(neighborColumn(boxes, 60, 1)?.id).toBe("b");
    expect(neighborColumn(boxes, 170, 1)?.id).toBe("c");
    expect(neighborColumn(boxes, 170, -1)?.id).toBe("a");
  });

  it("nas pontas não há destino; a ordem de entrada não importa", () => {
    expect(neighborColumn(boxes, 290, 1)).toBeNull();
    expect(neighborColumn(boxes, 50, -1)).toBeNull();
    expect(neighborColumn([...boxes].reverse(), 60, 1)?.id).toBe("b");
    expect(neighborColumn([], 0, 1)).toBeNull();
  });
});

describe("rascunho", () => {
  it("do rascunho para o corpo da API: texto aparado, vazio vira null, principal sempre entre os responsáveis", () => {
    const input = draftToInput({ ...emptyDraft("em_andamento"), title: "  Nova  ", description: "   ", due_date: "", tags: ["a"], assignee_ids: [3, 3, 4], primary_assignee_id: 9 });
    expect(input).toEqual({
      title: "Nova",
      description: null,
      status: "em_andamento",
      priority: "normal",
      due_date: null,
      tags: ["a"],
      assignee_ids: [3, 4],
      primary_assignee_id: 3,
    });
  });

  it("da tarefa para o rascunho: principal marcado, ou o primeiro; sem ninguém, nulo", () => {
    const a = (id: number, primary: boolean) => ({ user_id: id, name: `U${id}`, avatar: null, is_primary: primary });
    expect(draftFromTask(task({ assignees: [a(1, false), a(2, true)], description: "x", due_date: "2026-11-10" }))).toMatchObject({ assignee_ids: [1, 2], primary_assignee_id: 2, description: "x", due_date: "2026-11-10" });
    expect(draftFromTask(task({ assignees: [a(1, false)] })).primary_assignee_id).toBe(1);
    expect(draftFromTask(task()).primary_assignee_id).toBeNull();
  });

  it("detecta alteração pendente", () => {
    const base = emptyDraft();
    expect(isDraftDirty(base, emptyDraft())).toBe(false);
    expect(isDraftDirty({ ...base, title: "x" }, base)).toBe(true);
    expect(isDraftDirty({ ...base, tags: ["a"] }, base)).toBe(true);
    expect(isDraftDirty({ ...base, assignee_ids: [1] }, base)).toBe(true);
  });

  it("valida título, descrição e prazo", () => {
    expect(validateTaskTitle("  ")).toBe("Informe o título da tarefa");
    expect(validateTaskTitle("x".repeat(201))).toMatch(/200/);
    expect(validateTaskTitle("ok")).toBeNull();
    expect(validateTaskDescription("x".repeat(5001))).toMatch(/5000/);
    expect(validateTaskDescription("ok")).toBeNull();
    expect(validateDueDate("")).toBeNull();
    expect(validateDueDate("2026-11-10")).toBeNull();
    expect(validateDueDate("0002-11-10")).toBe("Informe um prazo válido");
  });

  it("prazo plausível: data real entre 2000 e 2100", () => {
    expect(isPlausibleDueDate("2026-02-28")).toBe(true);
    expect(isPlausibleDueDate("2026-02-30")).toBe(false);
    expect(isPlausibleDueDate("1999-12-31")).toBe(false);
    expect(isPlausibleDueDate("2101-01-01")).toBe(false);
    expect(isPlausibleDueDate("2026-1-1")).toBe(false);
    expect(isPlausibleDueDate("")).toBe(false);
  });
});

describe("etiquetas", () => {
  it("normaliza: apara, tira # e reduz espaços", () => {
    expect(normalizeTag("  ##Vídeo   curto ")).toBe("Vídeo curto");
  });

  it("acrescenta, ignora vazio e recusa repetida (sem caixa), longa e a 11ª", () => {
    expect(addTag(["a"], "b").tags).toEqual(["a", "b"]);
    expect(addTag(["a"], "  ")).toEqual({ tags: ["a"] });
    expect(addTag(["Vídeo"], "vídeo").error).toBe("Essa etiqueta já está na tarefa");
    expect(addTag([], "x".repeat(31)).error).toMatch(/30/);
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(addTag(ten, "nova").error).toMatch(/10/);
    expect(addTag(ten, "nova").tags).toEqual(ten);
  });

  it("remove uma etiqueta", () => {
    expect(removeTag(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("responsáveis", () => {
  it("sem repetidos e com o principal entre eles", () => {
    expect(normalizeAssignees([1, 1, 2], 2)).toEqual({ ids: [1, 2], primary: 2 });
    expect(normalizeAssignees([1, 2], 7)).toEqual({ ids: [1, 2], primary: 1 });
    expect(normalizeAssignees([], 7)).toEqual({ ids: [], primary: null });
  });

  it("marcar o primeiro já o torna principal; desmarcar o principal passa para o próximo", () => {
    const one = toggleAssignee({ ids: [], primary: null }, 5);
    expect(one).toEqual({ ids: [5], primary: 5 });
    const two = toggleAssignee(one, 6);
    expect(two).toEqual({ ids: [5, 6], primary: 5 });
    expect(toggleAssignee(two, 5)).toEqual({ ids: [6], primary: 6 });
    expect(toggleAssignee({ ids: [6], primary: 6 }, 6)).toEqual({ ids: [], primary: null });
  });

  it("respeita o limite de 20 responsáveis da API (acima disso ela responde 400)", () => {
    const full = { ids: Array.from({ length: 20 }, (_, i) => i + 1), primary: 1 };
    expect(canAddAssignee(full)).toBe(false);
    expect(toggleAssignee(full, 99)).toBe(full);
    expect(setPrimaryAssignee(full, 99)).toBe(full);
    // Tirar e escolher o principal entre quem já está continuam valendo.
    expect(toggleAssignee(full, 20).ids).toHaveLength(19);
    expect(setPrimaryAssignee(full, 5).primary).toBe(5);
  });

  it("escolher o principal", () => {
    expect(setPrimaryAssignee({ ids: [5, 6], primary: 5 }, 6)).toEqual({ ids: [5, 6], primary: 6 });
  });
});

describe("anexos", () => {
  it("limite de quantidade, arquivo vazio e tamanho", () => {
    expect(validateAttachment({ name: "a.png", size: 100 }, 0)).toBeNull();
    expect(validateAttachment({ name: "a.png", size: 100 }, 10)).toMatch(/até 10 anexos/);
    expect(validateAttachment({ name: "a.png", size: 0 }, 0)).toMatch(/vazio/);
    expect(validateAttachment({ name: "gigante.mov", size: 26 * 1024 * 1024 }, 0)).toMatch(/passa de 25 MB/);
    // Tipos que a API aceita (JPEG, PNG, GIF, WebP, HEIC/HEIF, MP4, MOV, AVI, PDF, DOC, DOCX); o resto volta 400.
    expect(validateAttachment({ name: "a.pdf", size: 100, type: "application/pdf" }, 0)).toBeNull();
    expect(validateAttachment({ name: "a.mov", size: 100, type: "video/quicktime" }, 0)).toBeNull();
    expect(validateAttachment({ name: "a.txt", size: 100, type: "text/plain" }, 0)).toMatch(/não é de um tipo aceito/);
    expect(validateAttachment({ name: "a.svg", size: 100, type: "image/svg+xml" }, 0)).toMatch(/não é de um tipo aceito/);
    expect(validateAttachment({ name: "a.bin", size: 100, type: "" }, 0)).toMatch(/não é de um tipo aceito/);
  });
});

describe("comentários", () => {
  const c = (id: string, created_at: string, user_id = 1): TaskComment => ({ id, body: id, created_at, author: { user_id, name: "Ana", avatar: null } });

  it("mais antigo primeiro", () => {
    expect(sortComments([c("b", "2026-11-02T10:00:00Z"), c("a", "2026-11-01T10:00:00Z")]).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("excluir: precisa editar e ser o autor ou ter exclusão", () => {
    const mine = c("a", "2026-11-01T10:00:00Z", 1);
    expect(canRemoveComment(mine, 1, { canWrite: true, canDelete: false })).toBe(true);
    expect(canRemoveComment(mine, 2, { canWrite: true, canDelete: false })).toBe(false);
    expect(canRemoveComment(mine, 2, { canWrite: true, canDelete: true })).toBe(true);
    // A API pede campaigns_write OU campaigns_delete na rota; o autor sem edição não passa, quem exclui passa.
    expect(canRemoveComment(mine, 2, { canWrite: false, canDelete: true })).toBe(true);
    expect(canRemoveComment(mine, 1, { canWrite: false, canDelete: false })).toBe(false);
    expect(canRemoveComment(mine, null, { canWrite: true, canDelete: false })).toBe(false);
  });

  it("valida o texto", () => {
    expect(validateComment("  ")).toBe("Escreva o comentário");
    expect(validateComment("x".repeat(2001))).toMatch(/2000/);
    expect(validateComment("oi")).toBeNull();
  });
});

describe("atividade", () => {
  it("rótulos em português para cada tipo e ator desconhecido vira 'Alguém'", () => {
    expect(describeEvent({ type: "created", data: {}, actor: { user_id: 1, name: "Ana" } })).toEqual({ actor: "Ana", action: "criou a tarefa", detail: null });
    expect(describeEvent({ type: "comment", data: {}, actor: null }).actor).toBe("Alguém");
    expect(describeEvent({ type: "outro", data: {}, actor: null }).action).toBe("atualizou a tarefa");
  });

  it("complemento só para status, prioridade e prazo, e só quando o formato é reconhecível", () => {
    expect(describeEventDetail({ type: "status", data: { from: "aberto", to: "em_andamento" } })).toBe("de Aberto para Em andamento");
    expect(describeEventDetail({ type: "status", data: { status: "concluido" } })).toBe("para Concluído");
    expect(describeEventDetail({ type: "priority", data: { from: "normal", to: "urgente" } })).toBe("de Normal para Urgente");
    expect(describeEventDetail({ type: "due_date", data: { from: "2026-11-10", to: "2026-11-12" } })).toBe("de 10/11/2026 para 12/11/2026");
    expect(describeEventDetail({ type: "due_date", data: { from: "2026-11-10", to: null } })).toBe("prazo removido");
    expect(describeEventDetail({ type: "status", data: { from: 1, to: 2 } })).toBeNull();
    expect(describeEventDetail({ type: "assignees", data: { added: [1] } })).toBeNull();
  });

  it("mais recente primeiro", () => {
    const e = (id: string, created_at: string) => ({ id, actor: null, type: "status", data: {}, created_at });
    expect(sortEvents([e("a", "2026-11-01T10:00:00Z"), e("b", "2026-11-02T10:00:00Z")]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("preferência de subtarefas no quadro", () => {
  it("guarda por projeto e lê de volta", () => {
    window.localStorage.clear();
    expect(readShowSubtasks("p1")).toBe(false);
    writeShowSubtasks("p1", true);
    expect(window.localStorage.getItem(showSubtasksStorageKey("p1"))).toBe("1");
    expect(readShowSubtasks("p1")).toBe(true);
    expect(readShowSubtasks("p2")).toBe(false);
    writeShowSubtasks("p1", false);
    expect(readShowSubtasks("p1")).toBe(false);
  });

  it("sem storage (erro ao ler ou gravar) não quebra", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("cota");
    });
    expect(readShowSubtasks("p1")).toBe(false);
    expect(() => writeShowSubtasks("p1", true)).not.toThrow();
  });
});
