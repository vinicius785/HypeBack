/**
 * Comportamento do composer de publicação em grupo (Backoffice → app).
 *
 * Cobre o que o usuário precisa conseguir fazer sem sair do Backoffice:
 * escrever, anexar imagem ou vídeo opcional, publicar por botão ou atalho — e o
 * que NÃO pode acontecer: publicar vazio, Enter enviando no meio da digitação,
 * vídeo acima do limite de duração, ou o texto sumir quando a publicação falha.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createPostMutate = vi.fn();
const uploadMutate = vi.fn();
const uploadVideoMutate = vi.fn();
const probeVideoFile = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("@/hooks/use-groups", () => ({
  useCreateGroupPost: () => ({
    mutateAsync: createPostMutate,
    isPending: false,
  }),
  useUploadGroupCover: () => ({
    mutateAsync: uploadMutate,
    isPending: false,
  }),
  useUploadGroupVideo: () => ({
    mutateAsync: uploadVideoMutate,
    isPending: false,
  }),
}));

// Só `probeVideoFile` é dublado: ele depende de decode de vídeo, que o jsdom não
// faz (o elemento nunca dispara loadedmetadata e a prova cairia no timeout). As
// validações puras do módulo continuam reais — é o que os testes exercitam.
vi.mock("@/shared/services/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/services/groups")>()),
  probeVideoFile: (...args: unknown[]) => probeVideoFile(...args),
}));

import { GroupPostComposer } from "./group-post-composer";

const publishButton = () => screen.getByRole("button", { name: "Publicar" });
const textbox = () => screen.getByRole("textbox");

describe("GroupPostComposer", () => {
  beforeEach(() => {
    createPostMutate.mockReset().mockResolvedValue({ id: "post-1" });
    uploadMutate.mockReset().mockResolvedValue({ url: "/uploads/community/a.png" });
    uploadVideoMutate
      .mockReset()
      .mockResolvedValue({ url: "https://storage/community/videos/a.mp4" });
    probeVideoFile.mockReset().mockResolvedValue({
      durationSeconds: 30,
      poster: new File(["p"], "poster.jpg", { type: "image/jpeg" }),
    });
    toastError.mockReset();
    toastSuccess.mockReset();
    // jsdom não implementa objectURL — o composer usa para a prévia da imagem.
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("mantém Publicar desabilitado enquanto o texto está vazio ou só com espaços", async () => {
    const user = userEvent.setup();
    render(<GroupPostComposer groupId="group-abc" />);

    expect(publishButton()).toBeDisabled();

    await user.type(textbox(), "   ");
    expect(publishButton()).toBeDisabled();

    await user.type(textbox(), "aviso");
    expect(publishButton()).toBeEnabled();
  });

  it("publica o conteúdo sem espaços nas pontas e limpa o campo", async () => {
    const user = userEvent.setup();
    render(<GroupPostComposer groupId="group-abc" />);

    await user.type(textbox(), "  Reunião amanhã  ");
    await user.click(publishButton());

    await waitFor(() =>
      expect(createPostMutate).toHaveBeenCalledWith({
        content: "Reunião amanhã",
        image_url: null,
      }),
    );
    expect(textbox()).toHaveValue("");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("Enter quebra linha e Ctrl+Enter publica", async () => {
    const user = userEvent.setup();
    render(<GroupPostComposer groupId="group-abc" />);

    await user.type(textbox(), "linha 1{Enter}linha 2");
    expect(createPostMutate).not.toHaveBeenCalled();
    expect(textbox()).toHaveValue("linha 1\nlinha 2");

    await user.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() =>
      expect(createPostMutate).toHaveBeenCalledWith({
        content: "linha 1\nlinha 2",
        image_url: null,
      }),
    );
  });

  it("sobe a imagem antes do post e usa a url retornada", async () => {
    const user = userEvent.setup();
    const { container } = render(<GroupPostComposer groupId="group-abc" />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await user.upload(
      input,
      new File(["x"], "banner.png", { type: "image/png" }),
    );
    expect(await screen.findByAltText("Prévia da imagem do conteúdo")).toBeInTheDocument();

    await user.type(textbox(), "Com banner");
    await user.click(publishButton());

    await waitFor(() =>
      expect(createPostMutate).toHaveBeenCalledWith({
        content: "Com banner",
        image_url: "/uploads/community/a.png",
      }),
    );
    expect(uploadMutate).toHaveBeenCalledTimes(1);
  });

  it("recusa arquivo fora da whitelist sem anexar", async () => {
    const { container } = render(<GroupPostComposer groupId="group-abc" />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    // fireEvent em vez de user.upload: o userEvent aplica o filtro do atributo
    // `accept` e descartaria o arquivo antes do handler. Aqui o alvo é a
    // validação do próprio composer, que cobre arraste e extensão trocada.
    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "documento.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(
      screen.queryByAltText("Prévia da imagem do conteúdo"),
    ).not.toBeInTheDocument();
  });

  it("preserva o texto digitado quando a publicação falha", async () => {
    createPostMutate.mockRejectedValue(new Error("Group not found"));
    const user = userEvent.setup();
    render(<GroupPostComposer groupId="group-abc" />);

    await user.type(textbox(), "Não pode sumir");
    await user.click(publishButton());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Group not found"),
    );
    expect(textbox()).toHaveValue("Não pode sumir");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("não publica de novo enquanto o texto está vazio após um envio", async () => {
    const user = userEvent.setup();
    render(<GroupPostComposer groupId="group-abc" />);

    await user.type(textbox(), "Único");
    await user.click(publishButton());
    await waitFor(() => expect(textbox()).toHaveValue(""));

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(createPostMutate).toHaveBeenCalledTimes(1);
  });

  it("sobe vídeo e poster antes do post e publica com video_url", async () => {
    const user = userEvent.setup();
    const { container } = render(<GroupPostComposer groupId="group-abc" />);
    const videoInput = container.querySelectorAll(
      'input[type="file"]',
    )[1] as HTMLInputElement;

    fireEvent.change(videoInput, {
      target: { files: [new File(["v"], "clipe.mp4", { type: "video/mp4" })] },
    });
    expect(
      await screen.findByLabelText("Prévia do vídeo do conteúdo"),
    ).toBeInTheDocument();

    await user.type(textbox(), "Com vídeo");
    await user.click(publishButton());

    await waitFor(() =>
      expect(createPostMutate).toHaveBeenCalledWith({
        content: "Com vídeo",
        image_url: null,
        video_url: "https://storage/community/videos/a.mp4",
        video_thumbnail_url: "/uploads/community/a.png",
      }),
    );
    // O poster vai pela rota de imagem; o vídeo, pela dedicada.
    expect(uploadVideoMutate).toHaveBeenCalledTimes(1);
    expect(uploadMutate).toHaveBeenCalledTimes(1);
  });

  it("publica o vídeo mesmo quando o poster falha ao subir", async () => {
    uploadMutate.mockRejectedValue(new Error("storage fora do ar"));
    const user = userEvent.setup();
    const { container } = render(<GroupPostComposer groupId="group-abc" />);
    const videoInput = container.querySelectorAll(
      'input[type="file"]',
    )[1] as HTMLInputElement;

    fireEvent.change(videoInput, {
      target: { files: [new File(["v"], "clipe.mp4", { type: "video/mp4" })] },
    });
    await screen.findByLabelText("Prévia do vídeo do conteúdo");

    await user.type(textbox(), "Sem capa");
    await user.click(publishButton());

    await waitFor(() =>
      expect(createPostMutate).toHaveBeenCalledWith({
        content: "Sem capa",
        image_url: null,
        video_url: "https://storage/community/videos/a.mp4",
        video_thumbnail_url: null,
      }),
    );
  });

  it("recusa vídeo acima do limite de duração sem anexar", async () => {
    probeVideoFile.mockResolvedValue({ durationSeconds: 400, poster: null });
    const { container } = render(<GroupPostComposer groupId="group-abc" />);
    const videoInput = container.querySelectorAll(
      'input[type="file"]',
    )[1] as HTMLInputElement;

    fireEvent.change(videoInput, {
      target: { files: [new File(["v"], "longo.mp4", { type: "video/mp4" })] },
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(
      screen.queryByLabelText("Prévia do vídeo do conteúdo"),
    ).not.toBeInTheDocument();
  });

  it("troca a imagem anexada pelo vídeo — os dois não coexistem", async () => {
    const user = userEvent.setup();
    const { container } = render(<GroupPostComposer groupId="group-abc" />);
    const inputs = container.querySelectorAll('input[type="file"]');

    await user.upload(
      inputs[0] as HTMLInputElement,
      new File(["x"], "banner.png", { type: "image/png" }),
    );
    await screen.findByAltText("Prévia da imagem do conteúdo");

    fireEvent.change(inputs[1] as HTMLInputElement, {
      target: { files: [new File(["v"], "clipe.mp4", { type: "video/mp4" })] },
    });

    expect(
      await screen.findByLabelText("Prévia do vídeo do conteúdo"),
    ).toBeInTheDocument();
    expect(
      screen.queryByAltText("Prévia da imagem do conteúdo"),
    ).not.toBeInTheDocument();
  });
});
