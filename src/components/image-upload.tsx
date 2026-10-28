import { useRef } from "react";

import type { UseFormRegisterReturn } from "react-hook-form";
import { clsx } from "clsx";

import { Input } from "@/components/ui/input";
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
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="flex justify-center">
          <div className="relative w-32 h-32 rounded-full">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover rounded-full"
            />

            <div
              className="absolute -top-1 -right-1 cursor-pointer bg-danger-600 rounded-full p-0.5"
              onClick={handleRemove}
            >
              <Icon name="X" color="#FFFFFF" size={16} />
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            "relative w-32 h-32 rounded-full flex items-center justify-center cursor-pointer bg-neutral-100",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Input
            id={id}
            type="file"
            accept={accept}
            className="hidden sr-only"
            disabled={disabled}
            {...register}
            ref={(e) => {
              fileInputRef.current = e;
              const { ref } = register;
              if (typeof ref === "function") {
                ref(e);
              }
            }}
            onChange={(e) => {
              const files = e.target.files;
              handleFileSelect(files);
              register.onChange(e);
            }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
            <Icon name="Camera" color="#A3A3A3" size={32} />

            <p className="text-neutral-400 font-medium text-center">Enviar foto</p>
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
