/**
 * Contrato HTTP de Projetos da agência: rotas, métodos e corpos, cabeçalhos (`Workspace-Id`), desembrulho de `{ data }`,
 * tolerância a API antiga (404 de rota ≠ 404 de registro), DELETE sem corpo e o envio multipart (capa e anexo).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AGENCY_PROJECT_ERROR_MESSAGES,
  AgencyProjectsUnavailableError,
  agencyProjectErrorMessage,
  createAgencyProject,
  createProjectDocument,
  createProjectTask,
  createTaskComment,
  deleteAgencyProject,
  deleteProjectDocument,
  deleteProjectTask,
  deleteTaskAttachment,
  deleteTaskComment,
  duplicateAgencyProject,
  getAgencyProject,
  getProjectTask,
  isAgencyProjectNotFound,
  isAgencyProjectsUnavailable,
  listAgencyProjects,
  listProjectDocuments,
  listProjectTasks,
  updateAgencyProject,
  updateProjectDocument,
  updateProjectTask,
  uploadAgencyProjectCover,
  uploadTaskAttachment,
} from "./agency-projects";

const API = "http://api.test/api/backoffice";

function respond(status: number, body?: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError("Unexpected end of JSON input")) : Promise.resolve(body)),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const lastCall = (fn: ReturnType<typeof vi.fn>) => {
  const [url, init] = fn.mock.calls[fn.mock.calls.length - 1] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

beforeEach(() => {
  vi.stubEnv("VITE_SERVER_URL", API);
  localStorage.setItem("token", "tok");
  localStorage.setItem("workspaceId", "ws-1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("projetos", () => {
  it("lista: GET, com token e workspace, e desembrulha { data }", async () => {
    const fetchMock = respond(200, { data: [{ id: "p1" }], meta: { total: 1 } });
    await expect(listAgencyProjects()).resolves.toEqual([{ id: "p1" }]);
    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe(`${API}/agency/projects`);
    expect(init.method).toBe("GET");
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["Workspace-Id"]).toBe("ws-1");
    expect(headers["Client-Type"]).toBe("backoffice");
  });

  it("detalhe, criação, edição, cópia e exclusão usam as rotas do contrato", async () => {
    let fetchMock = respond(200, { data: { id: "p1" } });
    await getAgencyProject("p1");
    expect(lastCall(fetchMock).url).toBe(`${API}/agency/projects/p1`);

    fetchMock = respond(201, { data: { id: "p1" } });
    await createAgencyProject({ name: "Verão", description: null });
    expect(lastCall(fetchMock).init.method).toBe("POST");
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({ name: "Verão", description: null });

    fetchMock = respond(200, { data: { id: "p1" } });
    await updateAgencyProject("p1", { status: "pausado", cover_url: null });
    expect(lastCall(fetchMock).url).toBe(`${API}/agency/projects/p1`);
    expect(lastCall(fetchMock).init.method).toBe("PATCH");
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({ status: "pausado", cover_url: null });

    fetchMock = respond(201, { data: { id: "p2" } });
    await duplicateAgencyProject("p1");
    expect(lastCall(fetchMock).url).toBe(`${API}/agency/projects/p1/duplicate`);
    expect(lastCall(fetchMock).init.method).toBe("POST");

    fetchMock = respond(200, { data: { deleted: true } });
    await expect(deleteAgencyProject("p1")).resolves.toBeUndefined();
    expect(lastCall(fetchMock).url).toBe(`${API}/agency/projects/p1`);
    expect(lastCall(fetchMock).init.method).toBe("DELETE");
  });

  it("o id vai codificado na URL", async () => {
    const fetchMock = respond(200, { data: {} });
    await getAgencyProject("a/b?c");
    expect(lastCall(fetchMock).url).toBe(`${API}/agency/projects/a%2Fb%3Fc`);
  });
});

describe("tolerância a API antiga e erros", () => {
  it("404 sem código de domínio (rota inexistente) vira 'indisponível'", async () => {
    respond(404, { statusCode: 404, message: "Cannot GET /api/backoffice/agency/projects", error: "Not Found" });
    const error = await listAgencyProjects().catch((e) => e);
    expect(error).toBeInstanceOf(AgencyProjectsUnavailableError);
    expect(isAgencyProjectsUnavailable(error)).toBe(true);
    expect(isAgencyProjectNotFound(error)).toBe(false);
  });

  it("404 sem corpo também é rota ausente", async () => {
    respond(404);
    expect(isAgencyProjectsUnavailable(await listAgencyProjects().catch((e) => e))).toBe(true);
  });

  it("404 PROJECT_NOT_FOUND é projeto inexistente (ou de outro workspace), não API antiga", async () => {
    respond(404, { statusCode: 404, message: "Projeto não encontrado", error: "PROJECT_NOT_FOUND" });
    const error = await getAgencyProject("x").catch((e) => e);
    expect(isAgencyProjectsUnavailable(error)).toBe(false);
    expect(isAgencyProjectNotFound(error)).toBe(true);
    expect(error.code).toBe("PROJECT_NOT_FOUND");
    expect(error.status).toBe(404);
  });

  it("404 de projeto SEM código (a API só repassa os códigos da lista pública) não é rota ausente", async () => {
    respond(404, { statusCode: 404, message: "Projeto não encontrado.", path: "/api/backoffice/agency/projects/x" });
    const error = await getAgencyProject("x").catch((e) => e);
    expect(isAgencyProjectsUnavailable(error)).toBe(false);
    expect(isAgencyProjectNotFound(error)).toBe(true);
  });

  it("envio acima do limite (413 `File too large`, em inglês) vira texto em português", async () => {
    respond(413, { statusCode: 413, message: "File too large" });
    const error = await uploadTaskAttachment("p", "t", new File(["x"], "a.pdf", { type: "application/pdf" })).catch((e) => e);
    expect(error.status).toBe(413);
    expect(agencyProjectErrorMessage(error, "x")).toBe("O arquivo passa do tamanho máximo.");
  });

  it("os demais códigos que a API devolve também têm texto", () => {
    for (const code of [
      "PRIMARY_NOT_ASSIGNEE", "TASK_LIMIT", "COMMENT_LIMIT", "DOCUMENT_LIMIT", "COMMENT_NOT_YOURS", "INVALID_COVER_URL",
      "DOCUMENT_NOT_FOUND", "COMMENT_NOT_FOUND", "ATTACHMENT_NOT_FOUND",
    ]) {
      expect(AGENCY_PROJECT_ERROR_MESSAGES[code]).toBeTruthy();
    }
  });

  it("os códigos do contrato viram texto em português", () => {
    expect(agencyProjectErrorMessage({ code: "AGENCY_ONLY" }, "x")).toBe("Projetos existem só em workspaces de agência.");
    expect(agencyProjectErrorMessage({ code: "ASSIGNEE_NOT_MEMBER" }, "x")).toBe("Só membros ativos do workspace podem ser responsáveis.");
    expect(agencyProjectErrorMessage({ code: "SUBTASK_DEPTH" }, "x")).toBe("Uma subtarefa não pode ter subtarefas.");
    expect(agencyProjectErrorMessage({ code: "ATTACHMENT_LIMIT" }, "x")).toBe("Cada tarefa aceita até 10 anexos.");
    expect(agencyProjectErrorMessage({ error: "TASK_NOT_FOUND" }, "x")).toBe("Essa tarefa não existe mais.");
    expect(agencyProjectErrorMessage(new Error("Nome muito longo"), "x")).toBe("Nome muito longo");
    expect(agencyProjectErrorMessage(null, "padrão")).toBe("padrão");
  });

  it("erro de validação (400) mantém a mensagem do servidor e o código", async () => {
    respond(400, { statusCode: 400, message: ["name não pode ser vazio"], error: "Bad Request" });
    const error = await createAgencyProject({ name: "" }).catch((e) => e);
    expect(error.message).toBe("name não pode ser vazio");
    expect(error.status).toBe(400);
    expect(isAgencyProjectsUnavailable(error)).toBe(false);
  });

  it("DELETE com 200 e corpo vazio conta como feito", async () => {
    respond(200);
    await expect(deleteProjectTask("p1", "t1")).resolves.toBeUndefined();
  });

  it("DELETE recusado propaga o erro", async () => {
    respond(403, { statusCode: 403, message: "Sem permissão", error: "Forbidden" });
    await expect(deleteAgencyProject("p1")).rejects.toMatchObject({ status: 403, message: "Sem permissão" });
  });
});

describe("tarefas, comentários, anexos e documentos", () => {
  it("rotas e métodos", async () => {
    const cases: [() => Promise<unknown>, string, string][] = [
      [() => listProjectTasks("p1"), "GET", "/agency/projects/p1/tasks"],
      [() => getProjectTask("p1", "t1"), "GET", "/agency/projects/p1/tasks/t1"],
      [() => createProjectTask("p1", { title: "Roteiro" }), "POST", "/agency/projects/p1/tasks"],
      [() => updateProjectTask("p1", "t1", { status: "concluido" }), "PATCH", "/agency/projects/p1/tasks/t1"],
      [() => deleteProjectTask("p1", "t1"), "DELETE", "/agency/projects/p1/tasks/t1"],
      [() => createTaskComment("p1", "t1", "ok"), "POST", "/agency/projects/p1/tasks/t1/comments"],
      [() => deleteTaskComment("p1", "t1", "c1"), "DELETE", "/agency/projects/p1/tasks/t1/comments/c1"],
      [() => deleteTaskAttachment("p1", "t1", "a1"), "DELETE", "/agency/projects/p1/tasks/t1/attachments/a1"],
      [() => listProjectDocuments("p1"), "GET", "/agency/projects/p1/documents"],
      [() => createProjectDocument("p1", { name: "Briefing", url: "https://x.com" }), "POST", "/agency/projects/p1/documents"],
      [() => updateProjectDocument("p1", "d1", { pinned: true }), "PATCH", "/agency/projects/p1/documents/d1"],
      [() => deleteProjectDocument("p1", "d1"), "DELETE", "/agency/projects/p1/documents/d1"],
    ];
    for (const [call, method, path] of cases) {
      const fetchMock = respond(200, { data: {} });
      await call();
      const { url, init } = lastCall(fetchMock);
      expect(`${init.method} ${url}`).toBe(`${method} ${API}${path}`);
    }
  });

  it("corpos: comentário, tarefa (responsáveis e subtarefa) e documento", async () => {
    let fetchMock = respond(201, { data: {} });
    await createTaskComment("p1", "t1", "Aprovado!");
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({ body: "Aprovado!" });

    fetchMock = respond(201, { data: {} });
    await createProjectTask("p1", { title: "Cortar vídeo", assignee_ids: [7, 8], primary_assignee_id: 7, parent_task_id: "t0", due_date: "2026-11-10" });
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({
      title: "Cortar vídeo",
      assignee_ids: [7, 8],
      primary_assignee_id: 7,
      parent_task_id: "t0",
      due_date: "2026-11-10",
    });

    fetchMock = respond(200, { data: {} });
    await updateProjectDocument("p1", "d1", { name: "Novo", category: "contrato", pinned: false });
    expect(JSON.parse(lastCall(fetchMock).init.body as string)).toEqual({ name: "Novo", category: "contrato", pinned: false });
  });
});

describe("envio de arquivos (multipart)", () => {
  const file = new File(["x"], "capa.jpg", { type: "image/jpeg" });

  it("capa: POST /agency/projects/cover com o arquivo em `file`, sem Content-Type (o navegador põe o boundary)", async () => {
    const fetchMock = respond(201, { data: { url: "/uploads/agency-projects/capa.jpg" } });
    await expect(uploadAgencyProjectCover(file)).resolves.toEqual({ url: "/uploads/agency-projects/capa.jpg" });
    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe(`${API}/agency/projects/cover`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["Workspace-Id"]).toBe("ws-1");
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("anexo da tarefa: rota da tarefa e dados do anexo devolvidos", async () => {
    const attachment = { id: "a1", url: "/uploads/x.pdf", name: "x.pdf", mime_type: "application/pdf", size: 1, uploaded_by: 7, created_at: "2026-11-05T12:00:00Z" };
    const fetchMock = respond(201, { data: attachment });
    await expect(uploadTaskAttachment("p1", "t1", new File(["x"], "x.pdf", { type: "application/pdf" }))).resolves.toEqual(attachment);
    expect(lastCall(fetchMock).url).toBe(`${API}/agency/projects/p1/tasks/t1/attachments`);
  });

  it("limite de anexos: o código vira texto claro", async () => {
    respond(400, { statusCode: 400, message: "Limite", error: "ATTACHMENT_LIMIT" });
    const error = await uploadTaskAttachment("p1", "t1", file).catch((e) => e);
    expect(error.code).toBe("ATTACHMENT_LIMIT");
    expect(agencyProjectErrorMessage(error, "x")).toBe("Cada tarefa aceita até 10 anexos.");
  });

  it("envio recusado usa a mensagem do servidor; rota ausente vira 'indisponível'", async () => {
    respond(413, { statusCode: 413, message: "Arquivo muito grande", error: "Payload Too Large" });
    await expect(uploadAgencyProjectCover(file)).rejects.toMatchObject({ message: "Arquivo muito grande", status: 413 });
    respond(404, { statusCode: 404, message: "Cannot POST /agency/projects/cover", error: "Not Found" });
    expect(isAgencyProjectsUnavailable(await uploadAgencyProjectCover(file).catch((e) => e))).toBe(true);
  });

  it("resposta de sucesso sem dados é erro (não devolve undefined)", async () => {
    respond(200, {});
    await expect(uploadAgencyProjectCover(file)).rejects.toThrow("Não foi possível enviar a capa.");
  });
});
