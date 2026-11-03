import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useCampaignShipments, useCreateShipment } from "@/hooks/use-campaign-shipment";
import { getCampaignProducts } from "@/shared/services/campaign-products";
import type { CreateShipmentDto } from "@/shared/services/campaign-shipment";

import { ShipmentFormModal } from "./shipment-form-modal";

/** Colunas do quadro cuja ação acontece aqui (etapa Envio). */
export const SHIPMENT_COLUMNS = ["awaiting_shipment", "awaiting_receipt"] as const;
export const isShipmentColumn = (c: string) =>
  (SHIPMENT_COLUMNS as readonly string[]).includes(c);

const METHOD_LABEL: Record<string, string> = {
  correios: "Correios",
  carrier: "Transportadora",
  in_person: "Pessoalmente",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

/**
 * Envio do criador no painel lateral do card: cadastrar o envio (físico ou
 * digital) e acompanhar o que já foi enviado.
 */
export function ShipmentPanelActions({
  campaignId,
  userId,
}: {
  campaignId: string;
  userId: string;
}) {
  const { data: entries = [], isLoading } = useCampaignShipments(campaignId);
  const { mutate: createShipment, isPending } = useCreateShipment(campaignId);
  const { data: products = [] } = useQuery({
    queryKey: ["campaigns", campaignId, "products"],
    queryFn: () => getCampaignProducts(campaignId),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);

  const entry = entries.find((e) => String(e.user_id) === userId);

  if (isLoading) return <small className="drw-hint">Carregando envio…</small>;
  if (!entry) return <small className="drw-hint">Este criador ainda não tem envio a fazer.</small>;

  const confirm = (dto: CreateShipmentDto) =>
    createShipment(
      { influencerId: String(entry.campaign_user_id), dto },
      {
        onSuccess: () => {
          toast.success("Envio cadastrado com sucesso.");
          setOpen(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Erro ao cadastrar envio."),
      },
    );

  const s = entry.shipment;

  return (
    <div className="kb2-sel">
      <div className="kb2-prof">
        {entry.status === "awaiting_shipment" ? (
          <button type="button" className="btn" disabled={isPending} onClick={() => setOpen(true)}>
            Cadastrar envio
          </button>
        ) : (
          s && (
            <>
              <div className="kb2-prof-h">
                <b>{s.product_name || "Envio"}</b>
                <small>{METHOD_LABEL[s.method] ?? s.method}</small>
              </div>
              {s.tracking_code && <small className="drw-hint">Rastreio: {s.tracking_code}</small>}
              {s.shipped_at && (
                <small className="drw-hint">
                  Enviado em {new Date(s.shipped_at).toLocaleDateString("pt-BR")}
                </small>
              )}
              <small className="drw-hint">Aguardando o criador confirmar o recebimento.</small>
            </>
          )
        )}
      </div>

      {open && (
        <ShipmentFormModal
          entry={entry}
          products={products}
          isPending={isPending}
          onConfirm={confirm}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
