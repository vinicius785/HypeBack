import { useRef } from "react";

import type { UseFormRegisterReturn } from "react-hook-form";
import { clsx } from "clsx";

import { Icon } from "@/components/ui/icon";
import { ErrorMessage } from "@/components/ui/error-message";

interface ImageUploadProps {
  register: UseFormRegisterReturn;
  preview: string | null;
  setPreview: (preview: string | null) => void;
  onRemove?: () => void;
  disabled?: boolean;
  error?: string;
  id?: string;
  accept?: string;
  /** Diâmetro do círculo, em px. */
  size?: number;
}

export function ImageUpload({
  register,
  preview,
  setPreview,
  onRemove,
  disabled = false,
  error,
  id = "photo",
  accept = "image/jpeg,image/jpg,image/png",
  size = 128,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const circle = { width: size, height: size };
  // Em círculos pequenos só cabe o ícone.
  const compact = size < 112;

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemove?.();
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {preview ? (
        <div className="relative rounded-full" style={circle}>
          <img
            src={preview}
            alt="Pré-visualização da foto"
            className="h-full w-full rounded-full object-cover"
          />

          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remover foto"
            className="absolute -right-1 -top-1 grid size-7 cursor-pointer place-items-center rounded-full bg-danger-600 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
          >
            <Icon name="X" color="#FFFFFF" size={14} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          style={circle}
          className={clsx(
            "relative flex flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed border-neutral-300 bg-neutral-100 text-neutral-500 transition-colors focus-within:border-neutral-950",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-neutral-950 hover:text-neutral-950",
          )}
        >
          <input
            id={id}
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled}
            {...register}
            ref={(e) => {
              fileInputRef.current = e;
              register.ref(e);
            }}
            onChange={(e) => {
              handleFileSelect(e.target.files);
              register.onChange(e);
            }}
          />

          <Icon name="Camera" color="currentColor" size={compact ? 26 : 32} />
          {compact ? (
            <span className="sr-only">Enviar foto</span>
          ) : (
            <span className="text-sm font-medium">Enviar foto</span>
          )}
        </label>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
