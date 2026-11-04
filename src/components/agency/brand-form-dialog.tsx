import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { I } from "@/components/prototype/ui";
import { Modal } from "@/components/ui/modal";
import {
  maskCep,
  maskCnpj,
  UF,
} from "@/components/workspace-settings/constants";
import {
  useCreateAgencyBrand,
  useUpdateAgencyBrand,
  useUploadAgencyBrandPhoto,
} from "@/hooks/use-agency-brands";
import { useNiches } from "@/hooks/use-niches";
import { getUploadUrl } from "@/lib/utils/api";
import {
  AGENCY_BRAND_ERROR_MESSAGES,
  BRAND_PHOTO_ACCEPT,
  BRAND_PHOTO_MAX_BYTES,
  type AgencyBrand,
  type AgencyBrandInput,
} from "@/shared/services/agency-brands";
import { lookupPostalCode } from "@/shared/utils/postal-code";

const NAME_MAX = 100;
const DESC_MAX = 2000;

/** Mensagem para a pessoa: o código da API vira texto claro; o resto cai na mensagem do servidor. */
export function brandErrorMessage(error: unknown, fallback: string): string {
  const e = error as {
    error?: string;
    message?: string;
    data?: { error?: string };
  } | null;
  const code = e?.error ?? e?.data?.error;
  if (code && AGENCY_BRAND_ERROR_MESSAGES[code])
    return AGENCY_BRAND_ERROR_MESSAGES[code];
  return e?.message || fallback;
}

interface Values {
  name: string;
  description: string;
  nicheId: string;
  legalName: string;
  taxId: string;
  postalCode: string;
  street: string;
  streetNumber: string;
  unit: string;
  neighborhood: string;
  city: string;
  state: string;
}

const toValues = (b?: AgencyBrand): Values => ({
  name: b?.name ?? "",
  description: b?.description ?? "",
  nicheId: b?.niche_id != null ? String(b.niche_id) : "",
  legalName: b?.legal_name ?? "",
  taxId: maskCnpj(b?.tax_id ?? ""),
  postalCode: maskCep(b?.postal_code ?? ""),
  street: b?.street ?? "",
  streetNumber: b?.street_number ?? "",
  unit: b?.unit ?? "",
  neighborhood: b?.neighborhood ?? "",
  city: b?.city ?? "",
  state: b?.state ?? "",
});

const digits = (v: string) => v.replace(/\D/g, "");
const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

type Errors = Partial<
  Record<"name" | "taxId" | "postalCode" | "streetNumber" | "photo", string>
>;

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Informe o nome da marca";
  if (v.taxId && digits(v.taxId).length !== 14)
    e.taxId = "O CNPJ tem 14 dígitos";
  if (v.postalCode && digits(v.postalCode).length !== 8)
    e.postalCode = "O CEP tem 8 dígitos";
  return e;
}

/** Criar (sem `brand`) ou editar (com `brand`) uma marca da agência, com o mesmo cadastro de um workspace. */
export function BrandFormDialog({
  brand,
  onClose,
}: {
  brand?: AgencyBrand;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Values>(() => toValues(brand));
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreateAgencyBrand();
  const update = useUpdateAgencyBrand();
  const upload = useUploadAgencyBrandPhoto();
  const { data: niches = [] } = useNiches();
  const pending = create.isPending || update.isPending || upload.isPending;

  const set = <K extends keyof Values>(k: K, v: Values[K]) =>
    setValues((cur) => ({ ...cur, [k]: v }));

  // Pré-visualização da logo escolhida (liberada ao trocar ou fechar).
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => (preview ? URL.revokeObjectURL(preview) : undefined),
    [preview],
  );
  const currentPhoto =
    !removePhoto && brand?.photo ? getUploadUrl(brand.photo) : undefined;
  const shownPhoto = preview ?? currentPhoto;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [shownPhoto]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!BRAND_PHOTO_ACCEPT.split(",").includes(f.type)) {
      setErrors((e) => ({ ...e, photo: "Use uma imagem JPG, PNG ou WebP." }));
      return;
    }
    if (f.size > BRAND_PHOTO_MAX_BYTES) {
      setErrors((e) => ({ ...e, photo: "A imagem passa de 5 MB." }));
      return;
    }
    setErrors((e) => ({ ...e, photo: undefined }));
    setRemovePhoto(false);
    setFile(f);
  };

  const onCepBlur = async () => {
    if (digits(values.postalCode).length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await lookupPostalCode(values.postalCode);
      if (!r) {
        setErrors((e) => ({ ...e, postalCode: "CEP não encontrado" }));
      } else {
        setErrors((e) => ({ ...e, postalCode: undefined }));
        setValues((cur) => ({
          ...cur,
          street: r.logradouro || cur.street,
          neighborhood: r.bairro || cur.neighborhood,
          city: r.localidade || cur.city,
          state: r.uf || cur.state,
          unit: cur.unit || r.complemento || "",
        }));
      }
    } catch {
      setErrors((e) => ({
        ...e,
        postalCode: "Erro ao buscar o CEP. Tente de novo.",
      }));
    } finally {
      setLoadingCep(false);
    }
  };

  const submit = async () => {
    setTried(true);
    const found = validate(values);
    setErrors((cur) => ({ ...cur, ...found, photo: cur.photo }));
    if (Object.keys(found).length > 0) return;

    const input: AgencyBrandInput = {
      name: values.name.trim(),
      description: orNull(values.description),
      niche_id: values.nicheId ? Number(values.nicheId) : null,
      legal_name: orNull(values.legalName),
      tax_id: values.taxId ? digits(values.taxId) : null,
      postal_code: values.postalCode ? digits(values.postalCode) : null,
      street: orNull(values.street),
      street_number: orNull(values.streetNumber),
      unit: orNull(values.unit),
      neighborhood: orNull(values.neighborhood),
      city: orNull(values.city),
      state: values.state || null,
      ...(brand && removePhoto && !file ? { photo: null } : {}),
    };

    try {
      const saved = brand
        ? await update.mutateAsync({ brandId: brand.id, input })
        : await create.mutateAsync(input);
      if (file) {
        try {
          await upload.mutateAsync({ brandId: saved.id, file });
        } catch (error) {
          toast.warning(
            `${brand ? "Marca atualizada" : "Marca criada"}, mas a logo não foi enviada. ${brandErrorMessage(error, "")}`.trim(),
          );
          onClose();
          return;
        }
      }
      toast.success(brand ? "Marca atualizada" : "Marca criada");
      onClose();
    } catch (error) {
      toast.error(brandErrorMessage(error, "Não foi possível salvar a marca."));
    }
  };

  const field = (
    id: string,
    label: string,
    node: React.ReactNode,
    error?: string,
  ) => (
    <div className={`nf ${error ? "err" : ""}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {node}
      {error ? <small className="nfe">{error}</small> : null}
    </div>
  );

  return (
    <Modal
      title={brand ? "Editar marca" : "Nova marca"}
      onClose={onClose}
      panelClassName="max-w-2xl"
    >
      <form
        className="pv agb-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <section className="agb-sec" aria-label="Identidade da marca">
          <h3 className="agb-h">Identidade</h3>
          <div className="agb-id">
            <div className="agb-logo">
              <div className="agb-lv" aria-hidden={!shownPhoto || broken}>
                {shownPhoto && !broken ? (
                  <img
                    src={shownPhoto}
                    alt="Logo da marca"
                    onError={() => setBroken(true)}
                  />
                ) : (
                  <span>
                    {(values.name.trim() || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="agb-la">
                <button
                  type="button"
                  className="btn out"
                  onClick={() => fileRef.current?.click()}
                  disabled={pending}
                >
                  <I n="image" cls="sm" />
                  {shownPhoto && !broken ? "Trocar logo" : "Escolher logo"}
                </button>
                {file || (currentPhoto && !removePhoto) ? (
                  <button
                    type="button"
                    className="agb-lr"
                    onClick={() => {
                      setFile(null);
                      if (brand?.photo) setRemovePhoto(true);
                    }}
                    disabled={pending}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={BRAND_PHOTO_ACCEPT}
                hidden
                aria-label="Arquivo da logo"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <small className={`agb-lh${errors.photo ? " bad" : ""}`}>
                {errors.photo ?? "JPG, PNG ou WebP · quadrada, até 5 MB"}
              </small>
            </div>
            <div className="agb-nm">
              {field(
                "agb-name",
                "Nome da marca",
                <input
                  id="agb-name"
                  className="ni"
                  autoFocus
                  maxLength={NAME_MAX}
                  placeholder="Ex.: Acme Cosméticos"
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                />,
                tried ? errors.name : undefined,
              )}
              {niches.length > 0
                ? field(
                    "agb-niche",
                    "Segmento",
                    <select
                      id="agb-niche"
                      className="ni"
                      value={values.nicheId}
                      onChange={(e) => set("nicheId", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {niches.map((n) => (
                        <option key={String(n.id)} value={String(n.id)}>
                          {n.name}
                        </option>
                      ))}
                    </select>,
                  )
                : null}
            </div>
          </div>
          {field(
            "agb-desc",
            "Sobre a marca",
            <div className="nwrap">
              <textarea
                id="agb-desc"
                className="ni"
                rows={3}
                maxLength={DESC_MAX}
                placeholder="O que a marca vende, tom de voz, observações para o time"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>,
          )}
        </section>

        <section className="agb-sec" aria-label="Dados da empresa">
          <h3 className="agb-h">
            Dados da empresa <em className="agb-opt">· opcional</em>
          </h3>
          <div className="agb-r2">
            {field(
              "agb-legal",
              "Razão social",
              <input
                id="agb-legal"
                className="ni"
                maxLength={200}
                placeholder="Ex.: Acme Cosméticos Ltda."
                value={values.legalName}
                onChange={(e) => set("legalName", e.target.value)}
              />,
            )}
            {field(
              "agb-cnpj",
              "CNPJ",
              <input
                id="agb-cnpj"
                className="ni"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={values.taxId}
                onChange={(e) => set("taxId", maskCnpj(e.target.value))}
              />,
              errors.taxId,
            )}
          </div>
        </section>

        <section className="agb-sec" aria-label="Endereço">
          <h3 className="agb-h">
            Endereço <em className="agb-opt">· opcional</em>
          </h3>
          <div className="agb-r3">
            {field(
              "agb-cep",
              "CEP",
              <input
                id="agb-cep"
                className="ni"
                inputMode="numeric"
                placeholder="00000-000"
                value={values.postalCode}
                onChange={(e) => set("postalCode", maskCep(e.target.value))}
                onBlur={() => void onCepBlur()}
              />,
              errors.postalCode,
            )}
            {field(
              "agb-street",
              "Rua / Avenida",
              <input
                id="agb-street"
                className="ni"
                maxLength={200}
                placeholder="Nome da rua"
                value={values.street}
                onChange={(e) => set("street", e.target.value)}
              />,
            )}
            {field(
              "agb-num",
              "Número",
              <input
                id="agb-num"
                className="ni"
                maxLength={20}
                inputMode="numeric"
                placeholder="123"
                value={values.streetNumber}
                onChange={(e) =>
                  set("streetNumber", e.target.value.replace(/\D/g, ""))
                }
              />,
            )}
          </div>
          {loadingCep ? (
            <small className="agb-lh">Buscando o endereço…</small>
          ) : null}
          <div className="agb-r4">
            {field(
              "agb-unit",
              "Complemento",
              <input
                id="agb-unit"
                className="ni"
                maxLength={50}
                placeholder="Sala, andar…"
                value={values.unit}
                onChange={(e) => set("unit", e.target.value)}
              />,
            )}
            {field(
              "agb-bairro",
              "Bairro",
              <input
                id="agb-bairro"
                className="ni"
                maxLength={100}
                placeholder="Bairro"
                value={values.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
              />,
            )}
            {field(
              "agb-city",
              "Cidade",
              <input
                id="agb-city"
                className="ni"
                maxLength={100}
                placeholder="Cidade"
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
              />,
            )}
            {field(
              "agb-uf",
              "Estado",
              <select
                id="agb-uf"
                className="ni"
                value={values.state}
                onChange={(e) => set("state", e.target.value)}
              >
                <option value="">—</option>
                {UF.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>,
            )}
          </div>
        </section>

        <div className="agb-actions">
          <button
            type="button"
            className="btn out"
            onClick={onClose}
            disabled={pending}
          >
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
