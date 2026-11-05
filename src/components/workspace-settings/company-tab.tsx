import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { I } from "@/components/prototype/ui";
import "@/styles/settings.css";

import { maskCep, maskCnpj, UF } from "./constants";
import { Field } from "./settings-section";

const schema = z.object({
  legalName: z.string().trim().max(200, "Máximo 200 caracteres"),
  taxId: z
    .string()
    .trim()
    .refine((v) => v === "" || v.replace(/\D/g, "").length === 14, "O CNPJ tem 14 dígitos"),
  postalCode: z
    .string()
    .trim()
    .refine((v) => v === "" || v.replace(/\D/g, "").length === 8, "O CEP tem 8 dígitos"),
  street: z.string().trim(),
  streetNumber: z.string().trim().regex(/^\d*$/, "Só números"),
  unit: z.string().trim(),
  neighborhood: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
});

export type CompanyValues = z.infer<typeof schema>;

interface ViaCep {
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

async function lookupCep(digits: string): Promise<ViaCep | null> {
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;
  const data: ViaCep = await res.json();
  return data.erro ? null : data;
}

export interface CompanyInitial {
  legal_name?: string | null;
  tax_id?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  unit?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

const toValues = (w: CompanyInitial): CompanyValues => ({
  legalName: w.legal_name ?? "",
  taxId: maskCnpj(w.tax_id ?? ""),
  postalCode: maskCep(w.postal_code ?? ""),
  street: w.street ?? "",
  streetNumber: w.street_number ?? "",
  unit: w.unit ?? "",
  neighborhood: w.neighborhood ?? "",
  city: w.city ?? "",
  state: w.state ?? "",
});

export function CompanyTab({
  workspace,
  saving,
  onSave,
}: {
  workspace: CompanyInitial;
  saving: boolean;
  onSave: (v: CompanyValues) => void;
}) {
  const [loadingCep, setLoadingCep] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<CompanyValues>({ resolver: zodResolver(schema), defaultValues: toValues(workspace) });

  useEffect(() => {
    reset(toValues(workspace));
  }, [workspace, reset]);

  const onCepBlur = async (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoadingCep(true);
    clearErrors("postalCode");
    try {
      const r = await lookupCep(digits);
      if (!r) {
        setError("postalCode", { message: "CEP não encontrado" });
      } else {
        const o = { shouldValidate: true, shouldDirty: true };
        setValue("street", r.logradouro, o);
        setValue("neighborhood", r.bairro, o);
        setValue("city", r.localidade, o);
        setValue("state", r.uf, o);
        if (r.complemento) setValue("unit", r.complemento, { shouldDirty: true });
      }
    } catch {
      setError("postalCode", { message: "Erro ao buscar CEP. Tente novamente." });
    } finally {
      setLoadingCep(false);
    }
  };

  const fd = ({
    id,
    label,
    k,
    ph,
    opt,
    numeric,
    children,
  }: {
    id: string;
    label: string;
    k: keyof CompanyValues;
    ph: string;
    opt?: boolean;
    numeric?: boolean;
    children?: React.ReactNode;
  }) => {
    const err = errors[k]?.message;
    const reg =
      k === "taxId"
        ? register(k, { onChange: (e) => (e.target.value = maskCnpj(e.target.value)) })
        : k === "postalCode"
          ? register(k, {
              onChange: (e) => (e.target.value = maskCep(e.target.value)),
              onBlur: (e) => onCepBlur(e.target.value),
            })
          : k === "streetNumber"
            ? register(k, { onChange: (e) => (e.target.value = e.target.value.replace(/\D/g, "")) })
            : register(k);
    return (
      <Field label={label} htmlFor={id} optional={opt} error={err} aside={children}>
        <input className="st-in" id={id} placeholder={ph} autoComplete="off" inputMode={numeric ? "numeric" : undefined} {...reg} />
      </Field>
    );
  };

  return (
    <form className="st-form" onSubmit={handleSubmit(onSave)} noValidate>
      <div className="st-g2">
        {fd({ id: "wkl", label: "Razão social", k: "legalName", ph: "Ex.: Empresa Exemplo Ltda." })}
        {fd({ id: "wkcnpj", label: "CNPJ", k: "taxId", ph: "00.000.000/0000-00", numeric: true })}
      </div>
      <div className="st-g3">
        {fd({ id: "wkcep", label: "CEP", k: "postalCode", ph: "00000-000", numeric: true, children: loadingCep ? "Buscando…" : null })}
        {fd({ id: "wkst", label: "Rua / Avenida", k: "street", ph: "Nome da rua" })}
        {fd({ id: "wknum", label: "Número", k: "streetNumber", ph: "Ex.: 123", numeric: true })}
      </div>
      <div className="st-g4">
        {fd({ id: "wkcomp", label: "Complemento", k: "unit", ph: "Apto, sala…", opt: true })}
        {fd({ id: "wkbai", label: "Bairro", k: "neighborhood", ph: "Nome do bairro" })}
        {fd({ id: "wkcity", label: "Cidade", k: "city", ph: "Nome da cidade" })}
        <Field label="Estado" htmlFor="wkuf">
          <select className="st-in st-selnat" id="wkuf" {...register("state")}>
            <option value="">—</option>
            {UF.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="st-actions">
        <button type="submit" className="btn" disabled={!isDirty || saving}>
          <I n="check" cls="sm" />
          {saving ? "Salvando…" : "Salvar dados da empresa"}
        </button>
      </div>
    </form>
  );
}
