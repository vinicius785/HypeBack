/**
 * Aulas e Inspirações (aba "Conteúdos" do app).
 *
 * O QUE PRECISA FUNCIONAR: listar com custo, desbloqueios e instrutor; criar com o vídeo enviado pelas rotas de upload e só o
 * endereço guardado; editar; excluir com o aviso de que os pontos NÃO voltam.
 * O QUE NÃO PODE ACONTECER: salvar sem o arquivo obrigatório; mandar Idempotency-Key (estas rotas não usam).
 */
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminGet: vi.fn(),
  adminPostPlain: vi.fn(),
  adminPatchPlain: vi.fn(),
  adminDelete: vi.fn(),
  uploadVideo: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock("@/lib/admin/admin-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/admin-client")>()),
  adminGet: mocks.adminGet,
  adminPostPlain: mocks.adminPostPlain,
  adminPatchPlain: mocks.adminPatchPlain,
  adminDelete: mocks.adminDelete,
}));
const poster = vi.hoisted(() => ({ make: vi.fn() }));
vi.mock("@/lib/admin/video-poster", () => ({ videoPosterFile: poster.make }));
const posts = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/shared/services/community-posts", () => ({ listCommunityPosts: posts.list, deleteCommunityPost: vi.fn() }));
vi.mock("@/shared/services/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/groups")>()),
  uploadCommunityVideo: mocks.uploadVideo,
  uploadCommunityImage: mocks.uploadImage,
}));

import type { CommunityInspiration, CommunityLesson } from "@/shared/community-content.types";

import { renderRoutes } from "../../users/admin-users-test-utils";
import { CommunityInspirations } from "./inspirations-tab";
import { CommunityLessons } from "./lessons-tab";
import { formatDuration, parseDuration } from "./content-format";

const LESSON: CommunityLesson = {
  id: "l1",
  title: "Como gravar um bom UGC",
  description: null,
  thumbnail_url: "https://cdn.test/capa.jpg",
  video_url: "https://cdn.test/aula.mp4",
  points_cost: 300,
  duration_seconds: 205,
  category: "Vídeo",
  instructor_id: 42,
  unlocks_count: 17,
  created_at: "2026-11-10T12:00:00.000Z",
};
const INSPIRATION: CommunityInspiration = { id: "i1", title: "Reel de verão", image_url: "https://cdn.test/p.jpg", video_url: "https://cdn.test/r.mp4", author_id: null, source: "Marca X" };

function lessons() {
  return renderRoutes([{ path: "/", component: CommunityLessons }], "/");
}
function inspirations() {
  return renderRoutes([{ path: "/", component: CommunityInspirations }], "/");
}

beforeEach(() => {
  posts.list.mockReset();
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.adminGet.mockImplementation(async (path: string) => (path.includes("inspirations") ? [INSPIRATION] : [LESSON]));
});
afterEach(() => cleanup());

describe("formato de duração", () => {
  it("lê mm:ss e segundos soltos; recusa o que não é tempo", () => {
    expect(parseDuration("3:25")).toBe(205);
    expect(parseDuration("205")).toBe(205);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("3:75")).toBeUndefined();
    expect(parseDuration("abc")).toBeUndefined();
    expect(formatDuration(205)).toBe("3:25");
  });
});

describe("Aulas", () => {
  it("lista com custo, quantas pessoas desbloquearam e o instrutor", async () => {
    await lessons();
    await screen.findByText("Como gravar um bom UGC");
    const table = screen.getByRole("table", { name: "Aulas" });
    expect(within(table).getByText("Como gravar um bom UGC")).toBeInTheDocument();
    expect(within(table).getByText("300 pts")).toBeInTheDocument();
    expect(within(table).getByText("17")).toBeInTheDocument();
    expect(within(table).getByText("Usuário 42")).toBeInTheDocument();
    expect(mocks.adminGet.mock.calls[0][0]).toBe("/admin/community/lessons");
  });

  it("sem aula: diz que o app esconde a fileira", async () => {
    mocks.adminGet.mockResolvedValue([]);
    await lessons();
    expect(await screen.findByText("Nenhuma aula cadastrada")).toBeInTheDocument();
  });

  it("cria a aula: o vídeo sobe pela rota de upload e só o endereço vai no corpo", async () => {
    const user = userEvent.setup();
    mocks.uploadVideo.mockResolvedValue({ url: "https://cdn.test/novo.mp4" });
    mocks.adminPostPlain.mockResolvedValue({ ...LESSON, id: "l2" });
    await lessons();
    await user.click(await screen.findByRole("button", { name: "Nova aula" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova aula" });

    // sem o vídeo não salva
    await user.type(within(dialog).getByLabelText("Título"), "Aula nova");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(mocks.adminPostPlain).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Envie este arquivo para continuar.")).toBeInTheDocument();

    const file = new File(["x"], "aula.mp4", { type: "video/mp4" });
    await user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"][accept^="video"]')!, file);
    await waitFor(() => expect(mocks.uploadVideo).toHaveBeenCalledWith(file));
    await user.clear(within(dialog).getByLabelText("Custo em pontos"));
    await user.type(within(dialog).getByLabelText("Custo em pontos"), "150");
    await user.type(within(dialog).getByLabelText(/Duração/), "1:30");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledTimes(1));
    expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/community/lessons", {
      title: "Aula nova",
      video_url: "https://cdn.test/novo.mp4",
      thumbnail_url: null,
      description: null,
      points_cost: 150,
      duration_seconds: 90,
      category: null,
      instructor_id: null,
    });
  });

  it("excluir avisa que os pontos já cobrados não voltam", async () => {
    const user = userEvent.setup();
    mocks.adminDelete.mockResolvedValue(undefined);
    await lessons();
    await user.click(await screen.findByRole("button", { name: "Ações de “Como gravar um bom UGC”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/17 pessoas já desbloquearam e os pontos cobrados NÃO são devolvidos/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Excluir aula" }));
    await waitFor(() => expect(mocks.adminDelete).toHaveBeenCalledWith("/admin/community/lessons/l1"));
  });

  it("editar manda só PATCH, sem Idempotency-Key", async () => {
    const user = userEvent.setup();
    mocks.adminPatchPlain.mockResolvedValue(LESSON);
    await lessons();
    await user.click(await screen.findByRole("button", { name: "Ações de “Como gravar um bom UGC”" }));
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar aula" });
    await user.clear(within(dialog).getByLabelText("Custo em pontos"));
    await user.type(within(dialog).getByLabelText("Custo em pontos"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.adminPatchPlain).toHaveBeenCalledTimes(1));
    const [path, body] = mocks.adminPatchPlain.mock.calls[0];
    expect(path).toBe("/admin/community/lessons/l1");
    expect(body).toMatchObject({ points_cost: 0, video_url: "https://cdn.test/aula.mp4" });
    expect(mocks.adminPatchPlain.mock.calls[0]).toHaveLength(2);
  });
});

describe("Inspirações: escolher da comunidade", () => {
  it("a publicação escolhida preenche foto, vídeo e autor; só entram as que têm mídia", async () => {
    const user = userEvent.setup();
    posts.list.mockResolvedValue({
      items: [
        { id: "p1", content: "Só texto", image_url: null, video_url: null, video_thumbnail_url: null, author: { id: "u1", name: "Sem Mídia", avatar_url: null }, likes_count: 0, comments_count: 0, created_at: "2026-11-01T10:00:00Z", group: null },
        { id: "p2", content: "Meu look   do dia", image_url: null, video_url: "https://cdn.test/v.mp4", video_thumbnail_url: "https://cdn.test/poster.jpg", author: { id: "u7", name: "Marina", avatar_url: null }, likes_count: 3, comments_count: 1, created_at: "2026-11-02T10:00:00Z", group: null },
      ],
      meta: { next_cursor: null, has_more: false },
    });
    mocks.adminPostPlain.mockResolvedValue(INSPIRATION);
    await inspirations();
    await user.click(await screen.findByRole("button", { name: "Nova inspiração" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova inspiração" });
    await user.click(within(dialog).getByRole("button", { name: /Escolher da comunidade/ }));

    const picker = await screen.findByRole("dialog", { name: "Escolher da comunidade" });
    expect(await within(picker).findByRole("button", { name: "Escolher a publicação de Marina" })).toBeInTheDocument();
    expect(within(picker).queryByText("Sem Mídia")).not.toBeInTheDocument();
    await user.click(within(picker).getByRole("button", { name: "Escolher a publicação de Marina" }));

    const form = await screen.findByRole("dialog", { name: "Nova inspiração" });
    expect(within(form).getByLabelText("Título")).toHaveValue("Meu look do dia");
    expect(within(form).getByLabelText(/Autor/)).toHaveValue("u7");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledTimes(1));
    expect(mocks.adminPostPlain.mock.calls[0][1]).toMatchObject({ title: "Meu look do dia", image_url: "https://cdn.test/poster.jpg", video_url: "https://cdn.test/v.mp4", author_id: "u7" });
  });
});

describe("Inspirações", () => {
  it("lista e cria com a foto (obrigatória) enviada pela rota de imagem", async () => {
    const user = userEvent.setup();
    mocks.uploadImage.mockResolvedValue({ url: "https://cdn.test/foto.jpg" });
    mocks.adminPostPlain.mockResolvedValue(INSPIRATION);
    await inspirations();
    expect(await screen.findByText("Reel de verão")).toBeInTheDocument();
    expect(screen.getByText("Marca X")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nova inspiração" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova inspiração" });
    await user.type(within(dialog).getByLabelText("Título"), "Nova");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(mocks.adminPostPlain).not.toHaveBeenCalled();

    await user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"][accept^="image"]')!, new File(["x"], "f.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalled());
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledTimes(1));
    expect(mocks.adminPostPlain).toHaveBeenCalledWith("/admin/community/inspirations", { title: "Nova", image_url: "https://cdn.test/foto.jpg", video_url: null, author_id: null, source: null });
  });

  it("só com o vídeo: a capa sai de um quadro dele e vai junto", async () => {
    const user = userEvent.setup();
    const frame = new File(["j"], "capa.jpg", { type: "image/jpeg" });
    poster.make.mockResolvedValue(frame);
    mocks.uploadVideo.mockResolvedValue({ url: "https://cdn.test/reel.mp4" });
    mocks.uploadImage.mockResolvedValue({ url: "https://cdn.test/capa.jpg" });
    mocks.adminPostPlain.mockResolvedValue(INSPIRATION);
    await inspirations();
    await user.click(await screen.findByRole("button", { name: "Nova inspiração" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova inspiração" });
    await user.type(within(dialog).getByLabelText("Título"), "Só reel");
    const video = new File(["v"], "r.mp4", { type: "video/mp4" });
    await user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"][accept^="video"]')!, video);
    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalledWith(frame));
    expect(poster.make).toHaveBeenCalledWith(video);
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.adminPostPlain).toHaveBeenCalledTimes(1));
    expect(mocks.adminPostPlain.mock.calls[0][1]).toMatchObject({ image_url: "https://cdn.test/capa.jpg", video_url: "https://cdn.test/reel.mp4" });
  });

  it("não deu para tirar a capa: avisa e pede uma foto, sem salvar", async () => {
    const user = userEvent.setup();
    poster.make.mockResolvedValue(null);
    mocks.uploadVideo.mockResolvedValue({ url: "https://cdn.test/reel.mp4" });
    await inspirations();
    await user.click(await screen.findByRole("button", { name: "Nova inspiração" }));
    const dialog = await screen.findByRole("dialog", { name: "Nova inspiração" });
    await user.type(within(dialog).getByLabelText("Título"), "Só reel");
    await user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"][accept^="video"]')!, new File(["v"], "r.mov", { type: "video/quicktime" }));
    expect(await within(dialog).findByText(/Não deu para tirar a capa/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(mocks.adminPostPlain).not.toHaveBeenCalled();
  });
});
