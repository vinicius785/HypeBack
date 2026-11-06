import { PROFILE_PHOTO_OUTPUT } from "@/lib/utils/photo-crop";

import { SquareCropModal } from "../square-crop-modal";

interface Props {
  file: File;
  pending: boolean;
  /** Mensagem de erro do envio, mostrada dentro do diálogo para não perder o recorte. */
  error?: string | null;
  onClose: () => void;
  onConfirm: (cropped: Blob) => void;
}

/** Pré-visualização + recorte circular (arrastar e zoom). Entrega um JPEG quadrado de 512 px. */
export function PhotoCropModal({ file, pending, error, onClose, onConfirm }: Props) {
  return (
    <SquareCropModal
      file={file}
      pending={pending}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
      output={PROFILE_PHOTO_OUTPUT}
      shape="circle"
      eyebrow="Foto de perfil"
      title="Ajuste sua foto"
      hint="Arraste para posicionar. A foto aparece em formato circular."
      confirmLabel="Salvar foto"
      zoomLabel="Zoom da foto"
    />
  );
}
