import { useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import { useCreateAgencyBrand, useUpdateAgencyBrand } from "@/hooks/use-agency-brands";
import { AGENCY_BRAND_ERROR_MESSAGES, type AgencyBrand } from "@/shared/services/agency-brands";

const NAME_MAX = 100;
const DESC_MAX = 2000;

/** Mensagem para a pessoa: o código da API vira texto claro; o resto cai na mensagem do servidor. */
export function brandErrorMessage(error: unknown, fallback: string): string {
  const e = error as { error?: string; message?: string; data?: { error?: string } } | null;
  const code = e?.error ?? e?.data?.error;
  if (code && AGENCY_BRAND_ERROR_MESSAGES[code]) return AGENCY_BRAND_ERROR_MESSAGES[code];
  return e?.message || fallback;
}

/** Criar (sem `brand`) ou editar (com `brand`) uma marca da agência. */
export function BrandFormDialog({ brand, onClose }: { brand?: AgencyBrand; onClose: () => void }) {
  const [name, setName] = useState(brand?.name ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  const [tried, setTried] = useState(false);
  const create = useCreateAgencyBrand();
  const update = useUpdateAgencyBrand();
  const pending = create.isPending || update.isPending;
  const nameBad = tried && !name.trim();

  const submit = () => {
    setTried(true);
    const trimmed = name.trim();
    if (!trimmed) return;
    const input = { name: trimmed, description: description.trim() || null };
    const onError = (error: unknown) => toast.error(brandErrorMessage(error, "Não foi possível salvar a marca."));
    if (brand) {
      update.mutate(
        { brandId: brand.id, input },
        {
          onSuccess: () => {
            toast.success("Marca atualizada");
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success("Marca criada");
          onClose();
        },
        onError,
      });
    }
  };

  return (
    <Modal title={brand ? "Editar marca" : "Nova marca"} onClose={onClose} panelClassName="max-w-lg">
      <form
        className="pv agb-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className={`nf ${nameBad ? "err" : ""}`.trim()}>
          <label htmlFor="agb-name">Nome da marca</label>
          <div className="nwrap">
            <input
              id="agb-name"
              className="ni"
              autoFocus
              maxLength={NAME_MAX}
              placeholder="Ex.: Acme Cosméticos"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {nameBad ? <small className="nfe">Informe o nome da marca</small> : null}
        </div>
        <div className="nf">
          <label htmlFor="agb-desc">Descrição (opcional)</label>
          <div className="nwrap">
            <textarea
              id="agb-desc"
              className="ni"
              rows={3}
              maxLength={DESC_MAX}
              placeholder="Segmento, observações ou o que mais ajudar o time"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="agb-actions">
          <button type="button" className="btn out" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Salvando…" : brand ? "Salvar" : "Criar marca"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
