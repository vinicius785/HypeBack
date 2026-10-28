import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { CampaignFormData, CampaignProductDraft } from "@/shared/types";
import { handleCurrencyInput, handleNumberInput } from "@/shared/utils/masks";
import {
  PRODUCT_IMAGE_LIMITS,
  validateProductImageFile,
} from "@/shared/services/campaign-products";

interface CreateCampaignStepProductsProps {
  formData: CampaignFormData;
  updateFormData: (field: keyof CampaignFormData, value: unknown) => void;
  onBack?: () => void;
  onNext?: () => void;
  hideBackButton?: boolean;
  /** Quando true, renderiza como <div> em vez de <form> (uso inline dentro de outro form) */
  asSection?: boolean;
}

function emptyProduct(): CampaignProductDraft {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    description: "",
    market_value: "",
    weight_grams: "",
    width_cm: "",
    height_cm: "",
    length_cm: "",
    brand: "",
    sku: "",
    notes: "",
    images: [],
    pendingImageFiles: [],
  };
}

const inputClass =
  "h-11 w-full rounded-[24px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none";
const labelClass = "text-sm font-medium leading-5 text-[#0A0A0A]";

export function CreateCampaignStepProducts({
  formData,
  updateFormData,
  onBack,
  onNext,
  hideBackButton = false,
  asSection = false,
}: CreateCampaignStepProductsProps) {
  const [products, setProducts] = useState<CampaignProductDraft[]>(
    formData.products?.length ? formData.products : [emptyProduct()]
  );
  const [expandedId, setExpandedId] = useState<string | null>(
    () => (formData.products?.length ? formData.products[0].id : products[0].id)
  );

  // Garante que o estado inicial está refletido no formData do pai
  useEffect(() => {
    if (!formData.products?.length) {
      updateFormData("products", products);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: CampaignProductDraft[]) => {
    setProducts(next);
    updateFormData("products", next);
  };

  const addProduct = () => {
    const p = emptyProduct();
    const next = [...products, p];
    persist(next);
    setExpandedId(p.id);
  };

  const removeProduct = (id: string) => {
    if (products.length <= 1) return;
    const next = products.filter((p) => p.id !== id);
    persist(next);
    if (expandedId === id) setExpandedId(next[0]?.id ?? null);
  };

  const updateProduct = (id: string, field: keyof CampaignProductDraft, value: string) => {
    persist(products.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  /** Patch arbitrário (usado pelo uploader de imagens, que muda 2 campos juntos). */
  const updateProductPartial = (id: string, patch: Partial<CampaignProductDraft>) => {
    persist(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const validate = (): boolean => {
    for (let i = 0; i < products.length; i++) {
      if (!products[i].name.trim()) {
        toast.error(`O produto ${i + 1} precisa ter um nome.`);
        setExpandedId(products[i].id);
        return false;
      }
      if (!products[i].market_value?.trim()) {
        toast.error(`O produto ${i + 1} precisa ter um valor de mercado.`);
        setExpandedId(products[i].id);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validate()) onNext?.();
  };

  const Wrapper = asSection ? "div" : "form";
  const wrapperProps = asSection
    ? {}
    : {
        onSubmit: (e: FormEvent) => {
          e.preventDefault();
          handleNext();
        },
      };

  return (
    <Wrapper className="flex flex-col gap-4" {...wrapperProps}>
      <div className="flex flex-col gap-4 mt-10">
        <h2 className="text-[28px] font-medium leading-8 text-neutral-950">
          Produtos da permuta
        </h2>
        <p className="text-lg leading-8 text-neutral-700">
          Cadastre os produtos que serão enviados aos influenciadores como parte da permuta.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-[12px]">
        {products.map((product, idx) => {
          const isExpanded = expandedId === product.id;
          return (
            <div
              key={product.id}
              className="overflow-hidden rounded-2xl border border-neutral-200"
            >
              {/* Header */}
              <div
                className="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-6 py-4"
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : product.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : product.id);
                  }
                }}
              >
                <span className="rounded-[24px] bg-primary-100 px-3 py-1 text-base font-medium text-primary-900">
                  {product.name.trim() || `Produto ${idx + 1}`}
                </span>
                <div className="flex items-center gap-3">
                  {products.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remover produto ${idx + 1}`}
                      className="rounded p-1 text-neutral-700 hover:bg-neutral-200 hover:text-danger-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProduct(product.id);
                      }}
                    >
                      <Icon name="Trash2" size={20} color="#404040" />
                    </button>
                  )}
                  <span
                    className="flex shrink-0 transition-transform"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    <Icon name="ChevronDown" size={16} color="#404040" />
                  </span>
                </div>
              </div>

              {/* Body */}
              {isExpanded && (
                <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                  {/* Nome */}
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className={labelClass}>
                      Nome do produto <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Kit de skincare"
                      value={product.name}
                      onChange={(e) => updateProduct(product.id, "name", e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  {/* Descrição */}
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className={labelClass}>Descrição (opcional)</label>
                    <textarea
                      placeholder="Descreva o produto..."
                      value={product.description ?? ""}
                      onChange={(e) => updateProduct(product.id, "description", e.target.value)}
                      rows={3}
                      className="w-full rounded-[12px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none resize-y"
                    />
                  </div>

                  {/* Marca */}
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Marca (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: L'Oréal"
                      value={product.brand ?? ""}
                      onChange={(e) => updateProduct(product.id, "brand", e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  {/* SKU */}
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>SKU (opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: SKU-001"
                      value={product.sku ?? ""}
                      onChange={(e) => updateProduct(product.id, "sku", e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  {/* Valor de mercado */}
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>
                      Valor de mercado <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-neutral-500">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={product.market_value ?? ""}
                        onChange={(e) =>
                          handleCurrencyInput(e, (v) =>
                            updateProduct(product.id, "market_value", v)
                          )
                        }
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>

                  {/* Peso */}
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Peso em gramas (opcional)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Ex: 250"
                      value={product.weight_grams ?? ""}
                      onChange={(e) =>
                        handleNumberInput(e, (v) =>
                          updateProduct(product.id, "weight_grams", v)
                        )
                      }
                      className={inputClass}
                    />
                  </div>

                  {/* Dimensões */}
                  <div className="sm:col-span-2 flex flex-col gap-2">
                    <label className={labelClass}>Dimensões em cm (opcional)</label>
                    <div className="flex gap-3">
                      {(
                        [
                          { field: "width_cm", placeholder: "Largura" },
                          { field: "height_cm", placeholder: "Altura" },
                          { field: "length_cm", placeholder: "Comprimento" },
                        ] as const
                      ).map(({ field, placeholder }) => (
                        <input
                          key={field}
                          type="text"
                          inputMode="decimal"
                          placeholder={placeholder}
                          value={(product[field] as string) ?? ""}
                          onChange={(e) =>
                            updateProduct(product.id, field, e.target.value.replace(/[^0-9.,]/g, ""))
                          }
                          className={`${inputClass} flex-1 min-w-0`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className={labelClass}>Observações (opcional)</label>
                    <textarea
                      placeholder="Informações adicionais para o influenciador..."
                      value={product.notes ?? ""}
                      onChange={(e) => updateProduct(product.id, "notes", e.target.value)}
                      rows={2}
                      className="w-full rounded-[12px] bg-[#F5F5F5] px-4 py-3 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none resize-y"
                    />
                  </div>

                  {/* Imagens do produto */}
                  <div className="sm:col-span-2 flex flex-col gap-2">
                    <label className={labelClass}>
                      Imagens do produto (até {PRODUCT_IMAGE_LIMITS.maxPerProduct})
                    </label>
                    <ProductImagesUploader
                      product={product}
                      onChange={(patch) => updateProductPartial(product.id, patch)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          onClick={addProduct}
          className="h-11 w-max rounded-[24px]"
        >
          <div className="flex items-center gap-2">
            <Icon name="Plus" size={16} color="#404040" />
            <span className="text-base font-semibold text-neutral-700">
              Adicionar produto
            </span>
          </div>
        </Button>
      </div>

      {!hideBackButton && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack} type="button">
            <div className="flex items-center justify-center gap-2">
              <Icon name="ArrowLeft" size={16} color="#404040" />
              <p className="font-semibold text-neutral-700">Voltar</p>
            </div>
          </Button>
        </div>
      )}
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// ProductImagesUploader
// ---------------------------------------------------------------------------

/**
 * Uploader de até 5 imagens por produto.
 *
 * Estratégia: **sempre defere**. Adicionar/remover imagens só edita o estado
 * local do draft — nenhuma request é disparada durante a interação. O envio
 * acontece quando o usuário clica em "Continuar"/"Salvar":
 *  - Criação: `createAllCampaignProducts` empacota tudo (URLs existentes +
 *    base64 dos `pendingImageFiles`) no POST do produto.
 *  - Edição: o save da campanha chama `updateCampaignProduct` que faz o
 *    mesmo empacotamento no PUT.
 *
 * Validações cliente-side (espelham regras do backend):
 *  - Total ≤ 5 imagens por produto
 *  - 5 MB por arquivo
 *  - mimes: jpeg/jpg/png/webp
 */
function ProductImagesUploader({
  product,
  onChange,
}: {
  product: CampaignProductDraft;
  onChange: (patch: Partial<CampaignProductDraft>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const existing = product.images ?? [];
  const pending = product.pendingImageFiles ?? [];
  const totalCount = existing.length + pending.length;
  const remaining = PRODUCT_IMAGE_LIMITS.maxPerProduct - totalCount;
  const canAdd = remaining > 0;

  const handleSelect = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    if (files.length > remaining) {
      toast.error(
        `Limite de ${PRODUCT_IMAGE_LIMITS.maxPerProduct} imagens por produto. Você tem ${totalCount}, está tentando enviar ${files.length}.`,
      );
      return;
    }

    for (const f of files) {
      const err = validateProductImageFile(f);
      if (err) {
        toast.error(err);
        return;
      }
    }

    onChange({ pendingImageFiles: [...pending, ...files] });

    // permite re-selecionar o mesmo arquivo após remover
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemoveExisting = (url: string) => {
    onChange({ images: existing.filter((u) => u !== url) });
  };

  const handleRemovePending = (idx: number) => {
    onChange({ pendingImageFiles: pending.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* Thumbnails existentes (URLs hospedadas) */}
      {existing.map((url) => (
        <ImageThumbnail
          key={url}
          src={url}
          onRemove={() => handleRemoveExisting(url)}
          uploaded
        />
      ))}

      {/* Thumbnails pendentes (Files locais) */}
      {pending.map((file, idx) => (
        <ImageThumbnail
          key={`pending-${idx}-${file.name}-${file.size}`}
          src={URL.createObjectURL(file)}
          onRemove={() => handleRemovePending(idx)}
        />
      ))}

      {/* Slot de adicionar */}
      {canAdd && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 flex flex-col items-center justify-center gap-1 text-neutral-500 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600 transition-colors cursor-pointer"
            aria-label="Adicionar imagens"
          >
            <Icon name="Plus" size={20} color="currentColor" />
            <span className="text-[10px] font-medium leading-tight">
              +{remaining} restante{remaining === 1 ? "" : "s"}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={PRODUCT_IMAGE_LIMITS.acceptedMimes.join(",")}
            multiple
            className="hidden"
            onChange={(e) => handleSelect(e.target.files)}
          />
        </>
      )}

      {/* Caption helper */}
      {totalCount === 0 && (
        <p className="basis-full text-xs text-neutral-500 mt-1">
          JPEG, PNG ou WebP · até 5 MB cada · {PRODUCT_IMAGE_LIMITS.maxPerProduct}{" "}
          imagens no total · enviadas ao salvar a campanha
        </p>
      )}
    </div>
  );
}

function ImageThumbnail({
  src,
  onRemove,
  uploaded = false,
}: {
  src: string;
  onRemove: () => void;
  uploaded?: boolean;
}) {
  return (
    <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 group">
      <img src={src} alt="Imagem do produto" className="w-full h-full object-cover" />
      {!uploaded && (
        <span className="absolute bottom-1 left-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
          Pendente
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-danger-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Remover imagem"
      >
        <Icon name="X" size={14} color="#FFFFFF" />
      </button>
    </div>
  );
}
