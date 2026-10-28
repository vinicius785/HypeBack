import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import type { CampaignFormData } from "@/shared/types";

interface CreateCampaignStepFourProps {
  formData: CampaignFormData;
  updateFormData: (field: keyof CampaignFormData, value: unknown) => void;
  onBack: () => void;
  onNext: () => void;
  hideBackButton?: boolean;
  fieldErrors?: Set<string>;
}

export function CreateCampaignStepFour({
  formData,
  updateFormData,
  onBack,
  onNext,
  hideBackButton = false,
  fieldErrors,
}: CreateCampaignStepFourProps) {
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    formData.banner || null
  );
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [imagePosition, setImagePosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPosition, setDragStartPosition] = useState(0);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (formData.banner && !bannerPreview) {
      setBannerPreview(formData.banner);
    }
  }, [formData.banner, bannerPreview]);

  const bannerError = fieldErrors?.has("banner");

  useEffect(() => {
    if (!bannerError) return;
    const el = document.getElementById("campaign-banner");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fieldErrors]);

  const handleBannerSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const img = new Image();
        img.onload = () => {
          if (img.height > 512) {
            setOriginalImage(result);
            setOriginalFile(file);
            setShowCropModal(true);
            setImagePosition(0);
          } else {
            setBannerPreview(result);
            updateFormData("banner", result);
            updateFormData("bannerFile", file);
          }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!originalImage || !imageRef.current || !cropContainerRef.current) return;
    const img = imageRef.current;
    const container = cropContainerRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const targetWidth = 1280;
    const targetHeight = 512;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const containerWidth = container.clientWidth;
    const scale = containerWidth / img.naturalWidth;
    const visibleTopInOriginal = Math.max(0, -imagePosition / scale);
    const visibleHeightInOriginal = Math.min(
      img.naturalHeight - visibleTopInOriginal,
      container.clientHeight / scale
    );
    const targetAspectRatio = targetWidth / targetHeight;
    let sourceX = 0;
    let sourceY = visibleTopInOriginal;
    let sourceWidth = img.naturalWidth;
    let sourceHeight = visibleHeightInOriginal;
    const imageAspectRatio = img.naturalWidth / img.naturalHeight;
    if (imageAspectRatio > targetAspectRatio) {
      sourceWidth = img.naturalHeight * targetAspectRatio;
      sourceX = (img.naturalWidth - sourceWidth) / 2;
    }
    if (sourceHeight < targetHeight / scale) {
      sourceHeight = Math.min(img.naturalHeight - sourceY, targetHeight / scale);
    }
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], originalFile?.name || "banner.jpg", {
        type: blob.type || "image/jpeg",
      });
      const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setBannerPreview(croppedDataUrl);
      updateFormData("banner", croppedDataUrl);
      updateFormData("bannerFile", croppedFile);
      setShowCropModal(false);
      setOriginalImage(null);
      setOriginalFile(null);
    }, "image/jpeg", 0.9);
  };

  const handleCropCancel = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setShowCropModal(false);
    setOriginalImage(null);
    setOriginalFile(null);
    bannerInputRef.current && (bannerInputRef.current.value = "");
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartPosition(imagePosition);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current || !cropContainerRef.current) return;
    e.preventDefault();
    const deltaY = e.clientY - dragStartY;
    const newPosition = dragStartPosition + deltaY;
    const container = cropContainerRef.current;
    const img = imageRef.current;
    const scale = container.clientWidth / img.naturalWidth;
    const imageDisplayHeight = img.naturalHeight * scale;
    const minPosition = container.clientHeight - imageDisplayHeight;
    setImagePosition(Math.max(minPosition, Math.min(0, newPosition)));
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!imageRef.current || !cropContainerRef.current) return;
      const deltaY = e.clientY - dragStartY;
      const newPosition = dragStartPosition + deltaY;
      const container = cropContainerRef.current;
      const img = imageRef.current;
      const scale = container.clientWidth / img.naturalWidth;
      const imageDisplayHeight = img.naturalHeight * scale;
      const minPosition = container.clientHeight - imageDisplayHeight;
      setImagePosition(Math.max(minPosition, Math.min(0, newPosition)));
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, dragStartY, dragStartPosition]);

  const handleBrandFilesSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      updateFormData("brandFiles", files[0].name);
    }
  };

  const handleGenerateBannerAi = () => {
    // Placeholder: integrar com geração de banner por IA quando disponível
  };

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      {/* Header – Figma */}
      <div className="flex flex-col gap-4">
        <h2 className="text-[28px] font-medium leading-8 text-[#0A0A0A]">
          Arquivos
        </h2>
        <p className="text-lg leading-8 text-[#404040]">
          Envie o material que o influenciador deve usar como referência visual
          na criação do conteúdo
        </p>
      </div>

      {/* Card – Figma: bg #fafafa, rounded-12, p-6, gap-28 → gap-7 */}
      <div className="flex flex-col gap-7 rounded-[12px] bg-[#FAFAFA] p-6">
        {/* Banner da campanha (1280X512 px) */}
        <div id="campaign-banner" className="flex flex-col gap-2">
          <label className="text-base font-medium leading-5 text-[#0A0A0A]">
            Banner da campanha (1280X512 px)
            <span className="text-red-500 ml-1" aria-hidden>*</span>
          </label>
          {bannerPreview ? (
            <div className="flex gap-2 flex-wrap items-center rounded-[16px] border-2 border-dashed border-primary-900 bg-[#F5F5F5] p-6">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={(e) => handleBannerSelect(e.target.files)}
              />
              <div
                className="h-32 w-[295px] shrink-0 overflow-hidden rounded-[16px] bg-[#F5F5F5]"
                style={{ aspectRatio: "1280/512" }}
              >
                <img
                  src={bannerPreview}
                  alt="Banner da campanha"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <p className="text-base font-semibold leading-tight text-[#202020]">
                    Tamanho recomendado: 1280 × 512 px
                  </p>
                  <p className="text-base font-normal leading-snug text-[#646464]">
                    Use uma arte com boa resolução e pouco texto, para ficar
                    legível em diferentes telas.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => bannerInputRef.current?.click()}
                    className="h-11 rounded-[24px] border-[#E5E5E5] px-4 py-2.5 font-semibold text-black w-max"
                  >
                    Alterar imagem
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setBannerPreview(null);
                      updateFormData("banner", "");
                      updateFormData("bannerFile", undefined);
                      bannerInputRef.current && (bannerInputRef.current.value = "");
                    }}
                    className="flex h-11 items-center justify-center gap-1 rounded-lg py-2.5 font-bold text-danger-600 transition-colors cursor-pointer"
                  >
                    <Icon name="Trash2" size={20} color="#d42424" />
                    Remover imagem
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => bannerInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && bannerInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-1 rounded-[16px] border-2 border-dashed px-5 py-10 cursor-pointer transition-colors ${bannerError ? "border-red-400 bg-red-50 hover:bg-red-100" : "border-primary-900 bg-[#F5F5F5] hover:bg-[#ebebeb]"}`}
            >
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={(e) => handleBannerSelect(e.target.files)}
              />
              <Icon name="Upload" size={24} color="#5d1390" />
              <p className="text-base text-primary-900">Clique para enviar o banner</p>
            </div>
          )}
          {/* Gerar banner com IA – Figma: bg primary-50, border primary-200, text primary-900 */}
          <button
            type="button"
            onClick={handleGenerateBannerAi}
            className="flex items-center justify-center gap-2 self-start rounded-[24px] border border-primary-200 bg-primary-50 px-4 py-2.5 font-semibold text-primary-900 transition-colors hover:bg-primary-100 w-full cursor-pointer"
          >
            <Icon name="Sparkles" size={16} color="#5d1390" />
            Gerar banner com IA
          </button>
          {bannerError && (
            <p className="flex items-center gap-1 text-sm text-red-500">
              <Icon name="CircleAlert" size={14} color="currentColor" />
              Faça o upload do banner antes de continuar
            </p>
          )}
        </div>

        {/* Arquivos da marca */}
        <div className="flex flex-col gap-2">
          <label className="text-base font-medium leading-5 text-[#0A0A0A]">
            Arquivos da marca
          </label>
          {formData.brandFiles ? (
            <div className="flex flex-wrap gap-2 items-center rounded-[16px] border-2 border-dashed border-primary-900 bg-[#F5F5F5] p-6">
              <input
                ref={filesInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => handleBrandFilesSelect(e.target.files)}
              />
              <div className="flex flex-1 flex-col gap-6 min-w-0">
                <p className="text-base font-normal leading-snug text-[#646464]">
                  PNG ou JPG, máximo 2MB cada
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => filesInputRef.current?.click()}
                    className="h-11 rounded-[24px] border-[#E5E5E5] px-4 py-2.5 font-semibold text-black w-max"
                  >
                    Alterar imagem
                  </Button>
                  <button
                    type="button"
                    onClick={() => updateFormData("brandFiles", "")}
                    className="flex h-11 items-center justify-center gap-1 rounded-lg py-2.5 font-bold text-danger-600 transition-colors cursor-pointer"
                  >
                    <Icon name="Trash2" size={20} color="#d42424" />
                    Remover imagem
                  </button>
                </div>
              </div>
              <p className="text-base font-medium text-[#0A0A0A] shrink-0">
                {formData.brandFiles}
              </p>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => filesInputRef.current?.click()}
              onKeyDown={(e) =>
                e.key === "Enter" && filesInputRef.current?.click()
              }
              className="flex flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-primary-900 bg-[#F5F5F5] px-5 py-10 cursor-pointer transition-colors hover:bg-[#ebebeb]"
            >
              <input
                ref={filesInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => handleBrandFilesSelect(e.target.files)}
              />
              <Icon name="Upload" size={16} color="#5d1390" />
              <p className="text-base text-primary-900">
                Fazer upload de arquivos
              </p>
            </div>
          )}
        </div>
      </div>

      {!hideBackButton && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onBack} className="w-min">
            <div className="flex items-center justify-center gap-2">
              <Icon name="ArrowLeft" size={16} color="#404040" />
              <p className="font-semibold text-neutral-700">Voltar</p>
            </div>
          </Button>
        </div>
      )}

      {/* Modal de ajuste de banner (altura > 512px) */}
      {showCropModal && originalImage && (
        <Modal title="Ajustar banner" onClose={handleCropCancel}>
          <div className="flex flex-col gap-6">
            <p className="text-sm text-neutral-600">
              A imagem tem altura maior que 512px. Arraste a imagem para ajustar
              qual parte ficará visível no banner.
            </p>
            <div className="relative w-full overflow-hidden rounded-2xl border-2 border-neutral-200 bg-neutral-100">
              <div
                ref={cropContainerRef}
                className="relative w-full"
                style={{ aspectRatio: "1280/512", height: "512px" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  ref={imageRef}
                  src={originalImage}
                  alt="Banner para ajustar"
                  className="absolute h-auto w-full select-none"
                  style={{
                    transform: `translateY(${imagePosition}px)`,
                    cursor: isDragging ? "grabbing" : "grab",
                  }}
                  draggable={false}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCropCancel}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleCropConfirm} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </form>
  );
}
