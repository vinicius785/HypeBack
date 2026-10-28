import { useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createWorkspace, uploadWorkspacePhoto } from "@/shared/services/workspace";
import { saveWorkspaceId } from "@/lib/utils/api";
import type { Workspace } from "@/shared/types";
import { useNiches } from "@/hooks/use-niches";
import { isNicheRoot } from "@/shared/utils/niche-tree";

import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/onboarding/create-workspace")({
  component: RouteComponent,
});

// ─── Brazilian states ─────────────────────────────────────────────────────────

const BR_STATES = [
  { value: "AC", label: "AC – Acre" },
  { value: "AL", label: "AL – Alagoas" },
  { value: "AP", label: "AP – Amapá" },
  { value: "AM", label: "AM – Amazonas" },
  { value: "BA", label: "BA – Bahia" },
  { value: "CE", label: "CE – Ceará" },
  { value: "DF", label: "DF – Distrito Federal" },
  { value: "ES", label: "ES – Espírito Santo" },
  { value: "GO", label: "GO – Goiás" },
  { value: "MA", label: "MA – Maranhão" },
  { value: "MT", label: "MT – Mato Grosso" },
  { value: "MS", label: "MS – Mato Grosso do Sul" },
  { value: "MG", label: "MG – Minas Gerais" },
  { value: "PA", label: "PA – Pará" },
  { value: "PB", label: "PB – Paraíba" },
  { value: "PR", label: "PR – Paraná" },
  { value: "PE", label: "PE – Pernambuco" },
  { value: "PI", label: "PI – Piauí" },
  { value: "RJ", label: "RJ – Rio de Janeiro" },
  { value: "RN", label: "RN – Rio Grande do Norte" },
  { value: "RS", label: "RS – Rio Grande do Sul" },
  { value: "RO", label: "RO – Rondônia" },
  { value: "RR", label: "RR – Roraima" },
  { value: "SC", label: "SC – Santa Catarina" },
  { value: "SP", label: "SP – São Paulo" },
  { value: "SE", label: "SE – Sergipe" },
  { value: "TO", label: "TO – Tocantins" },
];

// ─── Step 1 schema ────────────────────────────────────────────────────────────

const step1Schema = z.object({
  name: z
    .string()
    .nonempty("Nome da marca é obrigatório")
    .min(3, "Nome da marca deve ter no mínimo 3 caracteres")
    .max(20, "Nome da marca deve ter no máximo 20 caracteres"),
  niche: z.string().nonempty("Nicho é obrigatório"),
  description: z
    .string()
    .nonempty("Descrição da marca é obrigatória")
    .min(10, "Descrição da marca deve ter no mínimo 10 caracteres")
    .max(1000, "Descrição da marca deve ter no máximo 1000 caracteres"),
  photo: z
    .instanceof(FileList)
    .optional()
    .refine(
      (files) => !files || files.length === 0 || files[0]?.size <= 10240 * 1024,
      "A foto da sua marca deve ter no máximo 10MB",
    )
    .refine(
      (files) =>
        !files ||
        files.length === 0 ||
        ["image/jpeg", "image/jpg", "image/png"].includes(files[0]?.type || ""),
      "Apenas fotos JPG e PNG são permitidas",
    ),
});

type Step1Values = z.infer<typeof step1Schema>;

// ─── Step 2 schema ────────────────────────────────────────────────────────────

const step2Schema = z.object({
  legalName: z
    .string()
    .trim()
    .nonempty("Razão social é obrigatória")
    .max(200, "Razão social deve ter no máximo 200 caracteres"),
  taxId: z
    .string()
    .trim()
    .nonempty("CNPJ é obrigatório")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, "CNPJ deve ter 14 dígitos"),
  postalCode: z
    .string()
    .trim()
    .nonempty("CEP é obrigatório")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "CEP deve ter 8 dígitos"),
  street: z.string().trim().nonempty("Rua/Avenida é obrigatória"),
  streetNumber: z.string().trim().nonempty("Número é obrigatório").regex(/^\d+$/, "Apenas números são permitidos"),
  unit: z.string().trim().optional(),
  neighborhood: z.string().trim().nonempty("Bairro é obrigatório"),
  city: z.string().trim().nonempty("Cidade é obrigatória"),
  state: z.string().trim().nonempty("Estado é obrigatório"),
});

type Step2Values = z.infer<typeof step2Schema>;

// ─── ViaCEP ──────────────────────────────────────────────────────────────────

interface ViaCepResponse {
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

async function lookupPostalCode(raw: string): Promise<ViaCepResponse | null> {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;
  const data: ViaCepResponse = await res.json();
  if (data.erro) return null;
  return data;
}

// ─── Component ───────────────────────────────────────────────────────────────

function RouteComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [addressVisible, setAddressVisible] = useState(false);
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);

  const { data: niches = [], isLoading: loadingNiches } = useNiches();

  // ── Step 1 form ──
  const {
    control,
    register: register1,
    handleSubmit: handleSubmit1,
    formState: { errors: errors1 },
    setValue: setValue1,
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: "", niche: "", description: "" },
  });

  // ── Step 2 form ──
  const {
    control: control2,
    register: register2,
    handleSubmit: handleSubmit2,
    formState: { errors: errors2 },
    setValue: setValue2,
    setError: setError2,
    clearErrors: clearErrors2,
  } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      legalName: "",
      taxId: "",
      postalCode: "",
      street: "",
      streetNumber: "",
      unit: "",
      neighborhood: "",
      city: "",
      state: "",
    },
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async (data: Step1Values & Step2Values) => {
      return createWorkspace({
        name: data.name,
        niche_id: data.niche ? parseInt(data.niche, 10) : undefined,
        description: data.description,
        legal_name: data.legalName,
        tax_id: data.taxId,
        postal_code: data.postalCode,
        street: data.street,
        street_number: data.streetNumber,
        unit: data.unit || undefined,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
      });
    },
    onSuccess: async (workspace: Workspace, variables: Step1Values & Step2Values) => {
      queryClient.invalidateQueries({ queryKey: ["me-workspaces"] });
      saveWorkspaceId(workspace.id);

      if (variables.photo && variables.photo.length > 0) {
        try {
          await uploadWorkspacePhoto(workspace.id, variables.photo[0]);
        } catch {
          toast.error("Marca criada, mas houve um erro ao fazer upload da foto.");
        }
      }

      toast.success(`Sua marca ${workspace.name} foi criada com sucesso.`);
      navigate({ to: "/onboarding/welcome" });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Erro ao criar marca. Tente novamente.");
    },
  });

  const onStep1Submit = (data: Step1Values) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = (data: Step2Values) => {
    if (!step1Data) return;
    submit({ ...step1Data, ...data });
  };

  const handlePostalCodeBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits.length !== 8) {
      setAddressVisible(false);
      return;
    }

    setPostalCodeLoading(true);
    clearErrors2("postalCode");

    try {
      const result = await lookupPostalCode(digits);
      if (!result) {
        setError2("postalCode", { message: "CEP não encontrado" });
        setAddressVisible(false);
      } else {
        setValue2("street", result.logradouro, { shouldValidate: true });
        setValue2("neighborhood", result.bairro, { shouldValidate: true });
        setValue2("city", result.localidade, { shouldValidate: true });
        setValue2("state", result.uf, { shouldValidate: true });
        if (result.complemento) setValue2("unit", result.complemento);
        setAddressVisible(true);
      }
    } catch {
      setError2("postalCode", { message: "Erro ao buscar CEP. Tente novamente." });
      setAddressVisible(false);
    } finally {
      setPostalCodeLoading(false);
    }
  };

  // ── Step indicator ──
  const StepIndicator = () => (
    <div className="flex items-center gap-2 self-center">
      {[1, 2].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              step === n
                ? "bg-tertiary-500 text-white"
                : step > n
                  ? "bg-success-500 text-white"
                  : "border border-neutral-300 text-neutral-400"
            }`}
          >
            {n}
          </div>
          {n < 2 && <div className="h-px w-6 bg-neutral-300" />}
        </div>
      ))}
    </div>
  );

  // ── Step 1 ──
  if (step === 1) {
    return (
      <form
        className="max-w-md w-full flex flex-col gap-6"
        onSubmit={handleSubmit1(onStep1Submit)}
      >
        <div className="flex flex-col items-center gap-3">
          <StepIndicator />
          <h1 className="text-2xl font-medium text-neutral-950">Criar marca</h1>
          <p className="text-neutral-600 text-center">
            Defina o nome e a foto da sua marca para continuar.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="my-6">
            <ImageUpload
              register={register1("photo")}
              preview={preview}
              setPreview={setPreview}
              onRemove={() => setValue1("photo", new FileList())}
              error={errors1.photo?.message}
            />
          </div>

          <Input
            id="name"
            type="text"
            label="Nome da marca"
            placeholder="Digite o nome da sua marca"
            error={errors1.name?.message}
            {...register1("name")}
          />

          <Controller
            name="niche"
            control={control}
            render={({ field }) => (
              <Select
                id="niche"
                label="Nicho"
                placeholder={loadingNiches ? "Carregando nichos..." : "Selecione o nicho da sua marca"}
                value={field.value}
                onChange={field.onChange}
                options={niches.filter(isNicheRoot).map((niche) => ({
                  label: niche.name,
                  value: niche.id.toString(),
                }))}
                error={errors1.niche?.message}
                disabled={loadingNiches}
                isSearchable={true}
              />
            )}
          />

          <Textarea
            id="description"
            label="Sobre a marca"
            placeholder="Digite uma breve descrição sobre a sua marca"
            error={errors1.description?.message}
            {...register1("description")}
          />
        </div>

        <Button type="submit" className="min-w-max">
          <p className="text-neutral-50 font-semibold">Continuar</p>
        </Button>
      </form>
    );
  }

  // ── Step 2 ──
  return (
    <form
      className="max-w-md w-full flex flex-col gap-6"
      onSubmit={handleSubmit2(onStep2Submit)}
    >
      <div className="flex flex-col items-center gap-3">
        <StepIndicator />
        <h1 className="text-2xl font-medium text-neutral-950">Dados da empresa</h1>
        <p className="text-neutral-600 text-center">
          Informe os dados jurídicos da marca para finalizar o cadastro.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          id="legalName"
          type="text"
          label="Razão social"
          placeholder="Ex.: Empresa Exemplo Ltda."
          disabled={isPending}
          error={errors2.legalName?.message}
          {...register2("legalName")}
        />

        <Input
          id="taxId"
          type="text"
          label="CNPJ"
          placeholder="00.000.000/0000-00"
          disabled={isPending}
          error={errors2.taxId?.message}
          {...register2("taxId")}
        />

        <div className="relative">
          <Input
            id="postalCode"
            type="text"
            label="CEP"
            placeholder="00000-000"
            disabled={isPending}
            error={errors2.postalCode?.message}
            {...register2("postalCode", { onBlur: handlePostalCodeBlur })}
          />
          {postalCodeLoading && (
            <span className="absolute right-3 top-9 text-xs text-neutral-400">
              Buscando…
            </span>
          )}
        </div>

        {addressVisible && (
          <>
            <Input
              id="street"
              type="text"
              label="Rua / Avenida"
              placeholder="Nome da rua"
              disabled={isPending}
              error={errors2.street?.message}
              {...register2("street")}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="streetNumber"
                type="text"
                inputMode="numeric"
                label="Número"
                placeholder="Ex.: 123"
                disabled={isPending}
                error={errors2.streetNumber?.message}
                {...register2("streetNumber", {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, "");
                  },
                })}
              />

              <Input
                id="unit"
                type="text"
                label="Complemento"
                placeholder="Apto, sala… (opcional)"
                disabled={isPending}
                error={errors2.unit?.message}
                {...register2("unit")}
              />
            </div>

            <Input
              id="neighborhood"
              type="text"
              label="Bairro"
              placeholder="Nome do bairro"
              disabled={isPending}
              error={errors2.neighborhood?.message}
              {...register2("neighborhood")}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="city"
                type="text"
                label="Cidade"
                placeholder="Nome da cidade"
                disabled={isPending}
                error={errors2.city?.message}
                {...register2("city")}
              />

              <Controller
                name="state"
                control={control2}
                render={({ field }) => (
                  <Select
                    id="state"
                    label="Estado"
                    placeholder="Selecione"
                    value={field.value}
                    onChange={field.onChange}
                    options={BR_STATES}
                    error={errors2.state?.message}
                    disabled={isPending}
                  />
                )}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" disabled={isPending} className="min-w-max">
          <p className="text-neutral-50 font-semibold">
            {isPending ? "Criando sua marca..." : "Criar marca"}
          </p>
        </Button>

        <button
          type="button"
          disabled={isPending}
          className="text-sm text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
          onClick={() => setStep(1)}
        >
          Voltar
        </button>
      </div>
    </form>
  );
}
