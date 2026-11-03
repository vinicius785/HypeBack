import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { lookupPostalCode } from "@/shared/utils/postal-code";
import { formatCepInput } from "@/shared/utils/masks";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import type { CampaignProduct } from "@/shared/services/campaign-products";
import type {
  ShipmentKind,
  ShipmentMethod,
  CreateShipmentDto,
  CampaignShipmentEntry,
  ShipmentItemDto,
  ShipmentAddress,
} from "@/shared/services/campaign-shipment";

// ---------------------------------------------------------------------------
// Tipos e constantes
// ---------------------------------------------------------------------------





const KIND_OPTIONS: { value: ShipmentKind; label: string }[] = [
  { value: "physical", label: "Físico (produto)" },
  { value: "digital", label: "Digital (código, acesso, etc.)" },
];

const METHOD_OPTIONS: {
  value: ShipmentMethod;
  label: string;
  onlyPhysical?: boolean;
  requiresTarget?: boolean;
}[] = [
    { value: "correios", label: "Correios", onlyPhysical: true },
    { value: "carrier", label: "Transportadora", onlyPhysical: true },
    { value: "in_person", label: "Pessoalmente", onlyPhysical: true },
    { value: "email", label: "E-mail", requiresTarget: true },
    { value: "whatsapp", label: "WhatsApp", requiresTarget: true },
  ];

const inputClass =
  "h-10 w-full rounded-[24px] bg-[#F5F5F5] px-4 text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none";
const labelClass = "text-sm font-medium text-[#0A0A0A]";

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------


interface ShipmentFormModalProps {
  entry: CampaignShipmentEntry;
  products: CampaignProduct[];
  isPending: boolean;
  onConfirm: (dto: CreateShipmentDto) => void;
  onClose: () => void;
}

/**
 * Item de envio no estado local do form.
 * `localId` para keys de React; o backend só recebe os outros campos.
 */
interface DraftShipmentItem {
  localId: string;
  product_id: string;
  product_name: string;
  product_description: string;
  product_market_value_brl: string; // BRL "129,90"
  quantity: string;
}

const MAX_ITEMS = 20;

function emptyItem(): DraftShipmentItem {
  return {
    localId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: "",
    product_name: "",
    product_description: "",
    product_market_value_brl: "",
    quantity: "1",
  };
}

function emptyAddress(): ShipmentAddress {
  return {
    recipient_name: "",
    phone: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip: "",
    country: "BR",
  };
}

export function ShipmentFormModal({
  entry,
  products,
  isPending,
  onConfirm,
  onClose,
}: ShipmentFormModalProps) {
  const [kind, setKind] = useState<ShipmentKind>("physical");
  const [method, setMethod] = useState<ShipmentMethod>("correios");
  const [items, setItems] = useState<DraftShipmentItem[]>([emptyItem()]);
  const [trackingCode, setTrackingCode] = useState("");
  const [address, setAddress] = useState<ShipmentAddress>(
    entry.shippingAddress
      ? { ...emptyAddress(), ...entry.shippingAddress }
      : { ...emptyAddress(), recipient_name: entry.name },
  );
  const [deliveryTarget, setDeliveryTarget] = useState("");
  const [notes, setNotes] = useState("");

  const availableMethods = useMemo(
    () => METHOD_OPTIONS.filter((m) => !m.onlyPhysical || kind === "physical"),
    [kind],
  );

  const selectedMethod = METHOD_OPTIONS.find((m) => m.value === method);
  const requiresAddress = kind === "physical";
  const requiresTarget = !!selectedMethod?.requiresTarget;

  // Reseta método se ficou indisponível ao trocar kind
  useEffect(() => {
    const still = availableMethods.find((m) => m.value === method);
    if (!still) setMethod(availableMethods[0]?.value ?? "email");
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => {
    if (items.length >= MAX_ITEMS) {
      toast.error(`Máximo de ${MAX_ITEMS} produtos por envio.`);
      return;
    }
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (localId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  };

  const updateItem = (
    localId: string,
    field: keyof Omit<DraftShipmentItem, "localId">,
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, [field]: value } : i)),
    );
  };

  /** Seleciona produto do catálogo → pré-preenche nome/descrição/valor. */
  const handleItemProductSelect = (localId: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    setItems((prev) =>
      prev.map((i) => {
        if (i.localId !== localId) return i;
        if (!p) return { ...i, product_id: "" };
        return {
          ...i,
          product_id: p.id,
          product_name: p.name,
          product_description: p.description ?? i.product_description,
          product_market_value_brl:
            p.market_value_cents != null
              ? (p.market_value_cents / 100).toFixed(2).replace(".", ",")
              : i.product_market_value_brl,
        };
      }),
    );
  };

  const updateAddress = <K extends keyof ShipmentAddress>(
    field: K,
    value: ShipmentAddress[K],
  ) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Valida itens
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (!it.product_name.trim()) {
        toast.error(`Produto ${idx + 1}: nome é obrigatório.`);
        return;
      }
      const q = parseInt(it.quantity, 10);
      if (!Number.isFinite(q) || q < 1) {
        toast.error(`Produto ${idx + 1}: quantidade inválida.`);
        return;
      }
    }

    if (requiresAddress) {
      if (!address.recipient_name?.trim() || !address.phone?.trim() || !address.street.trim() || !address.number.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
        toast.error("Preencha destinatário, telefone, rua, número, cidade, estado e CEP.");
        return;
      }
    }
    if (requiresTarget && !deliveryTarget.trim()) {
      toast.error("O contato de entrega é obrigatório para este método.");
      return;
    }

    const productsPayload: ShipmentItemDto[] = items.map((it) => {
      const dto: ShipmentItemDto = {
        product_name: it.product_name.trim(),
        quantity: parseInt(it.quantity, 10) || 1,
      };
      if (it.product_id) dto.product_id = it.product_id;
      if (it.product_description.trim()) dto.product_description = it.product_description.trim();
      const rawValue = it.product_market_value_brl.replace(/\./g, "").replace(",", ".");
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed) && parsed > 0) dto.product_market_value_brl = parsed;
      return dto;
    });

    const dto: CreateShipmentDto = {
      kind,
      method,
      products: productsPayload,
    };
    if (requiresAddress) {
      dto.recipient_address = {
        recipient_name: address.recipient_name?.trim(),
        phone: address.phone?.replace(/[^\d+]/g, ""),
        street: address.street.trim(),
        number: address.number.trim(),
        complement: address.complement?.trim() || undefined,
        neighborhood: address.neighborhood?.trim() || undefined,
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
        zip: address.zip.replace(/\D/g, ""),
        country: address.country?.trim() || "BR",
        reference: address.reference?.trim() || undefined,
        delivery_notes: address.delivery_notes?.trim() || undefined,
      };
    }
    if (kind === "physical" && trackingCode.trim()) {
      dto.tracking_code = trackingCode.trim();
    }
    if (requiresTarget && deliveryTarget.trim()) {
      dto.delivery_target = deliveryTarget.trim();
    }
    if (notes.trim()) dto.notes = notes.trim();

    onConfirm(dto);
  };

  return (
    <Modal
      title={`Cadastrar envio — ${entry.name}`}
      onClose={onClose}
      panelClassName="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {/* Tipo de envio */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>
            Tipo de envio <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKind(opt.value)}
                className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  kind === opt.value
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Método de envio */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>
            Método de envio <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {availableMethods.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMethod(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  method === opt.value
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de produtos */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>
              Produtos do envio <span className="text-red-500">*</span>
              <span className="ml-2 text-xs font-normal text-neutral-500">
                ({items.length} de {MAX_ITEMS})
              </span>
            </label>
            <button
              type="button"
              onClick={addItem}
              disabled={items.length >= MAX_ITEMS}
              className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Icon name="Plus" size={14} color="currentColor" />
              Adicionar produto
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {items.map((item, idx) => (
              <ShipmentItemRow
                key={item.localId}
                index={idx}
                item={item}
                catalog={products}
                canRemove={items.length > 1}
                onProductSelect={(pid) => handleItemProductSelect(item.localId, pid)}
                onChange={(field, value) => updateItem(item.localId, field, value)}
                onRemove={() => removeItem(item.localId)}
              />
            ))}
          </div>
        </div>

        {/* Endereço estruturado — obrigatório para físico */}
        {requiresAddress && (
          <AddressFields address={address} onChange={updateAddress} />
        )}

        {/* Código de rastreio — só físico */}
        {kind === "physical" && (
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Código de rastreio (opcional)</label>
            <input
              type="text"
              placeholder="Ex: BR123456789BR"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              maxLength={64}
              className={inputClass}
            />
          </div>
        )}

        {/* Contato — email/whatsapp */}
        {requiresTarget && (
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              {method === "email" ? "E-mail de destino" : "WhatsApp de destino"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type={method === "email" ? "email" : "text"}
              placeholder={
                method === "email" ? "email@exemplo.com" : "(11) 99999-9999"
              }
              value={deliveryTarget}
              onChange={(e) => setDeliveryTarget(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {/* Observações */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Observações (opcional)</label>
          <textarea
            placeholder="Ex: Cuidado: frágil"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full rounded-[12px] bg-[#F5F5F5] px-4 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none resize-y"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isPending}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white border-0"
          >
            {isPending ? "Salvando..." : "Confirmar envio"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ShipmentItemRow — linha de produto no envio multi-produto
// ---------------------------------------------------------------------------

function ShipmentItemRow({
  index,
  item,
  catalog,
  canRemove,
  onProductSelect,
  onChange,
  onRemove,
}: {
  index: number;
  item: DraftShipmentItem;
  catalog: CampaignProduct[];
  canRemove: boolean;
  onProductSelect: (productId: string) => void;
  onChange: (field: keyof Omit<DraftShipmentItem, "localId">, value: string) => void;
  onRemove: () => void;
}) {
  const fromCatalog = !!item.product_id;
  const catalogProduct = fromCatalog
    ? catalog.find((p) => p.id === item.product_id)
    : undefined;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Produto {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover produto ${index + 1}`}
            className="p-1 rounded hover:bg-danger-500/10 text-neutral-500 hover:text-danger-500 transition-colors cursor-pointer"
          >
            <Icon name="Trash2" size={14} color="currentColor" />
          </button>
        )}
      </div>

      {catalog.length > 0 && (
        <select
          value={item.product_id}
          onChange={(e) => onProductSelect(e.target.value)}
          className={`${inputClass} cursor-pointer`}
        >
          <option value="">Sem produto selecionado</option>
          {catalog.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {fromCatalog && catalogProduct ? (
        // Produto do catálogo — dados travados (vêm do servidor).
        // Apenas quantidade segue editável: é específica do envio, não do produto.
        <CatalogProductDisplay
          product={catalogProduct}
          quantity={item.quantity}
          onQuantityChange={(v) => onChange("quantity", v)}
        />
      ) : (
        // Item ad-hoc — usuário digita livremente.
        <>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
            <input
              type="text"
              placeholder="Nome do produto *"
              value={item.product_name}
              onChange={(e) => onChange("product_name", e.target.value)}
              maxLength={200}
              className={inputClass}
            />
            <input
              type="number"
              min={1}
              max={10000}
              placeholder="Qtd"
              value={item.quantity}
              onChange={(e) => onChange("quantity", e.target.value)}
              className={inputClass}
            />
          </div>

          <textarea
            placeholder="Descrição (opcional, ex.: cor/tamanho)"
            value={item.product_description}
            onChange={(e) => onChange("product_description", e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full rounded-[12px] bg-[#F5F5F5] px-4 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] outline-none resize-y"
          />

          <input
            type="text"
            placeholder="Valor de mercado em R$ (opcional, ex.: 149,90)"
            value={item.product_market_value_brl}
            onChange={(e) => onChange("product_market_value_brl", e.target.value)}
            className={inputClass}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogProductDisplay — exibe dados travados do produto vindo do servidor
// ---------------------------------------------------------------------------

function CatalogProductDisplay({
  product,
  quantity,
  onQuantityChange,
}: {
  product: CampaignProduct;
  quantity: string;
  onQuantityChange: (v: string) => void;
}) {
  const thumb = product.images?.[0] ?? null;

  const valueBRL =
    product.market_value_cents != null
      ? (product.market_value_cents / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 2,
        })
      : null;

  const dim = product.dimensions;
  const dimensionsLabel =
    dim && (dim.width_cm || dim.height_cm || dim.length_cm)
      ? [dim.width_cm, dim.height_cm, dim.length_cm]
          .filter((v) => v != null)
          .join(" × ") + " cm"
      : null;

  const weightLabel = product.weight_grams
    ? product.weight_grams >= 1000
      ? `${(product.weight_grams / 1000).toLocaleString("pt-BR", {
          maximumFractionDigits: 2,
        })} kg`
      : `${product.weight_grams} g`
    : null;

  // Specs mostradas no grid — só inclui as que existem.
  const specs: { label: string; value: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [];
  if (valueBRL) specs.push({ label: "Valor", value: valueBRL, icon: "Tag" });
  if (product.brand) specs.push({ label: "Marca", value: product.brand, icon: "Bookmark" });
  if (product.sku) specs.push({ label: "SKU", value: product.sku, icon: "Hash" });
  if (weightLabel) specs.push({ label: "Peso", value: weightLabel, icon: "Weight" });
  if (dimensionsLabel)
    specs.push({ label: "Dimensões", value: dimensionsLabel, icon: "Ruler" });

  const qtyValue = parseInt(quantity, 10);
  const safeQty = Number.isFinite(qtyValue) && qtyValue >= 1 ? qtyValue : 1;

  const setQty = (n: number) => {
    const clamped = Math.max(1, Math.min(10000, n));
    onQuantityChange(String(clamped));
  };

  return (
    <div className="rounded-[28px] bg-white overflow-hidden">
      {/* Header: imagem à esquerda alinhada ao centro vertical do bloco de texto */}
      <div className="relative bg-gradient-to-b from-neutral-50 to-white px-4 py-4 flex items-center gap-4 border-b border-neutral-100">
        <span
          className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700 shadow-sm"
          title="Dados sincronizados com o catálogo da campanha"
        >
          <Icon name="Lock" size={10} color="currentColor" />
          Do catálogo
        </span>

        {thumb ? (
          <img
            src={thumb}
            alt={product.name}
            className="size-20 rounded-xl object-cover border border-neutral-200 bg-neutral-100 shadow-sm shrink-0"
          />
        ) : (
          <div className="size-20 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
            <Icon name="Package" size={28} color="#a3a3a3" />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-1 pr-20">
          <p className="text-sm font-semibold text-neutral-950 leading-tight">
            {product.name}
          </p>
          {product.description && (
            <p className="text-xs text-neutral-500 leading-snug line-clamp-2">
              {product.description}
            </p>
          )}
        </div>
      </div>

      {/* Specs grid — 3 colunas no desktop, 2 no mobile pra densidade */}
      {specs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-neutral-100">
          {specs.map((s) => (
            <div
              key={s.label}
              className="bg-white px-3 py-2 flex items-center gap-2 min-w-0"
            >
              <Icon name={s.icon} size={13} color="#737373" className="shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 leading-none">
                  {s.label}
                </span>
                <span className="text-xs font-medium text-neutral-800 truncate tabular-nums">
                  {s.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes opcionais */}
      {product.notes && (
        <div className="px-4 py-2.5 border-t border-neutral-100 bg-amber-50/40">
          <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 mb-0.5">
            Observações
          </p>
          <p className="text-xs text-amber-900 leading-snug line-clamp-3">{product.notes}</p>
        </div>
      )}

      {/* Footer: quantidade — único campo editável */}
      <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/60 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-neutral-700">Quantidade neste envio</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setQty(safeQty - 1)}
            disabled={safeQty <= 1}
            aria-label="Diminuir quantidade"
            className="size-7 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 hover:border-primary-300 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Icon name="Minus" size={12} color="currentColor" />
          </button>
          <input
            type="number"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            className="h-7 w-14 rounded-lg bg-white border border-neutral-200 px-1 text-sm text-center text-neutral-950 tabular-nums outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
          />
          <button
            type="button"
            onClick={() => setQty(safeQty + 1)}
            disabled={safeQty >= 10000}
            aria-label="Aumentar quantidade"
            className="size-7 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 hover:border-primary-300 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Icon name="Plus" size={12} color="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddressFields — endereço estruturado (cf. ShipmentAddress)
// ---------------------------------------------------------------------------

function AddressFields({
  address,
  onChange,
}: {
  address: ShipmentAddress;
  onChange: <K extends keyof ShipmentAddress>(field: K, value: ShipmentAddress[K]) => void;
}) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  // Guarda o último CEP consultado para descartar respostas obsoletas (race).
  const lastLookupRef = useRef<string>("");

  /**
   * Consulta o CEP no ViaCEP e preenche rua/bairro/cidade/UF.
   * Só sobrescreve rua/bairro quando a API retorna valor (CEPs de cidade única
   * não trazem logradouro — preserva o que o usuário já digitou).
   */
  const handleCepLookup = async (rawZip: string) => {
    const digits = rawZip.replace(/\D/g, "");
    if (digits.length !== 8) return;

    lastLookupRef.current = digits;
    setCepLoading(true);
    setCepError(null);
    try {
      const result = await lookupPostalCode(digits);
      if (lastLookupRef.current !== digits) return; // resposta obsoleta
      if (!result) {
        setCepError("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      if (result.logradouro) onChange("street", result.logradouro);
      if (result.bairro) onChange("neighborhood", result.bairro);
      onChange("city", result.localidade || "");
      onChange("state", (result.uf || "").toUpperCase().slice(0, 2));
    } catch {
      if (lastLookupRef.current !== digits) return;
      setCepError("Erro ao buscar o CEP. Preencha o endereço manualmente.");
    } finally {
      if (lastLookupRef.current === digits) setCepLoading(false);
    }
  };

  return (
    <fieldset className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-3 flex flex-col gap-2.5">
      <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-1">
        Endereço de entrega *
      </legend>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Nome do destinatário *"
          value={address.recipient_name ?? ""}
          onChange={(e) => onChange("recipient_name", e.target.value)}
          maxLength={100}
          className={inputClass}
        />
        <input
          type="tel"
          placeholder="Telefone *"
          value={address.phone ?? ""}
          onChange={(e) => onChange("phone", e.target.value)}
          maxLength={20}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
        <div className="flex flex-col gap-1">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="CEP *"
              value={address.zip}
              onChange={(e) => {
                setCepError(null);
                onChange("zip", formatCepInput(e.target.value));
              }}
              onBlur={(e) => handleCepLookup(e.target.value)}
              maxLength={9}
              className={inputClass}
            />
            {cepLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Icon name="Loader" size={14} color="#737373" className="animate-spin" />
              </span>
            )}
          </div>
          {cepError && <span className="text-xs text-danger-500">{cepError}</span>}
        </div>
        <input
          type="text"
          placeholder="Rua *"
          value={address.street}
          onChange={(e) => onChange("street", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
        <input
          type="text"
          placeholder="Número *"
          value={address.number}
          onChange={(e) => onChange("number", e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Complemento"
          value={address.complement ?? ""}
          onChange={(e) => onChange("complement", e.target.value)}
          className={inputClass}
        />
      </div>

      <input
        type="text"
        placeholder="Bairro"
        value={address.neighborhood ?? ""}
        onChange={(e) => onChange("neighborhood", e.target.value)}
        className={inputClass}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Ponto de referência"
          value={address.reference ?? ""}
          onChange={(e) => onChange("reference", e.target.value)}
          maxLength={300}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Observações de entrega"
          value={address.delivery_notes ?? ""}
          onChange={(e) => onChange("delivery_notes", e.target.value)}
          maxLength={500}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px] gap-2">
        <input
          type="text"
          placeholder="Cidade *"
          value={address.city}
          onChange={(e) => onChange("city", e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="UF *"
          value={address.state}
          onChange={(e) => onChange("state", e.target.value.toUpperCase().slice(0, 2))}
          maxLength={2}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="País"
          value={address.country ?? "BR"}
          onChange={(e) => onChange("country", e.target.value.toUpperCase().slice(0, 2))}
          maxLength={2}
          className={inputClass}
        />
      </div>
    </fieldset>
  );
}

