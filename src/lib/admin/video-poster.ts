/**
 * Tira um quadro do vídeo e devolve como imagem JPEG, para servir de capa quando ninguém enviou uma.
 * Devolve `null` se o navegador não consegue ler o vídeo (codec sem suporte) ou se o quadro não pode ser lido.
 */
export async function videoPosterFile(source: File | string, name = "capa"): Promise<File | null> {
  const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  if (typeof source === "string") video.crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
      video.src = objectUrl ?? (source as string);
    });
    // O primeiro quadro costuma ser preto: avança um pouco, sem passar do fim.
    const target = Math.min(1, (Number.isFinite(video.duration) ? video.duration : 1) / 10);
    if (target > 0) {
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("video"));
        video.currentTime = target;
      });
    }
    if (!video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], `${name}.jpg`, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}
