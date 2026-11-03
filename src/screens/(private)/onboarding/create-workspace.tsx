import { useEffect, useState } from "react";

import {
  createFileRoute,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createWorkspace, uploadWorkspacePhoto } from "@/shared/services/workspace";
import { saveWorkspaceId } from "@/lib/utils/api";
import { COMPANY_STEP_SEARCH } from "@/lib/onboarding/flow";
import { formatCep, formatCnpj } from "@/lib/utils/format";
import type { Workspace } from "@/shared/types";
import { useNiches } from "@/hooks/use-niches";
import { isNicheRoot } from "@/shared/utils/niche-tree";

import { ImageUpload } from "@/components/image-upload";
import { OnboardingHeader } from "@/components/onboarding/onboarding-header";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/(private)/onboarding/create-workspace")({
  // `?etapa=empresa` é a segunda metade da criação (dados da empresa): com URL própria, a faixa de etapas e o botão
  // voltar do navegador acompanham a tela.
  validateSearch: (search: Record<string, unknown>): { etapa?: typeof COMPANY_STEP_SEARCH.etapa } =>
    search.etapa === COMPANY_STEP_SEARCH.etapa ? { etapa: COMPANY_STEP_SEARCH.etapa } : {},
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { search } = useLocation();
  const etapa = (search as { etapa?: unknown }).etapa;

  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [addressVisible, setAddressVisible] = useState(false);
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);

  // Os dados da empresa só existem com a marca preenchida: abrir o link direto (ou recarregar a página) volta à marca.
  const step: 1 | 2 = etapa === COMPANY_STEP_SEARCH.etapa && step1Data ? 2 : 1;
  useEffect(() => {
    if (etapa === COMPANY_STEP_SEARCH.etapa && !step1Data) {
      navigate({ to: "/onboarding/create-workspace", search: {}, replace: true });
    }
  }, [etapa, step1Data, navigate]);

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
    navigate({ to: "/onboarding/create-workspace", search: { etapa: COMPANY_STEP_SEARCH.etapa } });
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

  // ── Step 1 ──
  if (step === 1) {
    return (
      <form
        key="marca"
        className="ob-form ob-screen"
        onSubmit={handleSubmit1(onStep1Submit)}
      >
        <OnboardingHeader
          title="Crie sua marca"
          description="Defina o nome, o nicho e a foto da sua marca para continuar."
        />

        <div className="ob-logo">
          <ImageUpload
            size={88}
            register={register1("photo")}
            preview={preview}
            setPreview={setPreview}
            onRemove={() => setValue1("photo", undefined)}
          />

          <div>
            <b>Logo da marca</b>
            {errors1.photo?.message ? (
              <ErrorMessage message={errors1.photo.message} />
            ) : (
              <small>JPG ou PNG, até 10 MB. É opcional.</small>
            )}
          </div>
        </div>

        <div className="ob-fields">
          <Input
            id="name"
            type="text"
            label="Nome da marca"
            placeholder="Como sua marca se chama"
            autoComplete="organization"
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
            placeholder="Conte em poucas linhas o que a sua marca faz"
            error={errors1.description?.message}
            {...register1("description")}
          />
        </div>

        <Button type="submit" className="ob-primary">
          Continuar
          <Icon name="ArrowRight" size={18} color="currentColor" />
        </Button>
      </form>
    );
  }

  // ── Step 2 ──
  return (
    <form
      key="empresa"
      className="ob-form ob-screen"
      onSubmit={handleSubmit2(onStep2Submit)}
    >
      <button
        type="button"
        className="ob-link ob-back"
        disabled={isPending}
        onClick={() => router.history.back()}
      >
        <Icon name="ArrowLeft" size={16} color="currentColor" />
        Voltar
      </button>

      <OnboardingHeader
        title="Dados da empresa"
        description="Informe os dados jurídicos da marca para finalizar o cadastro."
      />

      <div className="ob-fields">
        <Input
          id="legalName"
          type="text"
          label="Razão social"
          placeholder="Ex.: Empresa Exemplo Ltda."
          autoComplete="organization"
          disabled={isPending}
          error={errors2.legalName?.message}
          {...register2("legalName")}
        />

        <Controller
          name="taxId"
          control={control2}
          render={({ field }) => (
            <Input
              id="taxId"
              ref={field.ref}
              type="text"
              inputMode="numeric"
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              disabled={isPending}
              error={errors2.taxId?.message}
              value={field.value}
              onChange={(event) => field.onChange(formatCnpj(event.target.value))}
              onBlur={field.onBlur}
            />
          )}
        />

        <Controller
          name="postalCode"
          control={control2}
          render={({ field }) => (
            <Input
              id="postalCode"
              ref={field.ref}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              label="CEP"
              placeholder="00000-000"
              disabled={isPending}
              error={errors2.postalCode?.message}
              value={field.value}
              onChange={(event) => field.onChange(formatCep(event.target.value))}
              onBlur={(event) => {
                field.onBlur();
                handlePostalCodeBlur(event);
              }}
              icon={
                postalCodeLoading ? (
                  <Icon name="LoaderCircle" size={18} color="#7e7e7e" className="animate-spin" />
                ) : undefined
              }
            />
          )}
        />

        {addressVisible && (
          <div className="ob-group">
            <Input
              id="street"
              type="text"
              label="Rua / Avenida"
              placeholder="Nome da rua"
              disabled={isPending}
              error={errors2.street?.message}
              {...register2("street")}
            />

            <div className="ob-pair">
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

            <div className="ob-pair">
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
          </div>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="ob-primary">
        {isPending ? "Criando sua marca..." : "Criar marca"}
        {!isPending && <Icon name="ArrowRight" size={18} color="currentColor" />}
      </Button>
    </form>
  );
}
