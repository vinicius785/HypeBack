import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  useContractTemplates,
  useContractVariables,
  useSendContractTemplate,
  useUploadCustomContract,
  useUpsertWorkspaceContractDefaults,
  useWorkspaceContractDefaults,
} from "@/hooks/use-campaign-contracts";
import type {
  ContractType,
  WorkspaceContractDefaults,
} from "@/shared/types";
import {
  digitCount,
  formatCnpjInput,
  formatCpfInput,
} from "@/shared/utils/masks";

import { VariablesPanel } from "./variables-panel";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface InfluencerOption {
  /**
   * `campaign_users.id` — é o que o backend de contratos espera como
   * `campaign_user_id`. O dashboard já entrega esse id na lista de
   * influenciadores da campanha.
   */
  id: string;
  /**
   * `users.id` — usado pela aba Contratos para casar contratos cujo
   * `influencer_id` (no backend) ainda referencia o user, e não o campaign_user.
   * Evita listar o mesmo influenciador duplicado (linha pending + contrato real).
   */
  user_id?: string;
  name: string;
  avatar: string;
  username?: string;
  /** Status no kanban da campanha — `contract_pending` aparece priorizado. */
  status?: string;
}

interface SendContractModalProps {
  campaignId: string;
  influencers: InfluencerOption[];
  /** Influenciador pré-selecionado quando vier de "Enviar agora" da linha pending. */
  initialInfluencerId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"] as const;
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const labelClass = "text-sm font-medium text-neutral-900";
const fieldHint = "text-xs text-neutral-500";

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SendContractModal({
  campaignId,
  influencers,
  initialInfluencerId,
  onClose,
  onSuccess,
}: SendContractModalProps) {
  // -----------------------------------------------------------------------
  // Dados externos (defaults, variáveis, templates)
  // -----------------------------------------------------------------------
  const { data: defaults, isLoading: loadingDefaults } =
    useWorkspaceContractDefaults();
  const { data: variables = [], isLoading: loadingVariables } =
    useContractVariables();
  const { data: templates = [], isLoading: loadingTemplates } =
    useContractTemplates();

  const { mutate: sendTemplate, isPending: isSending } =
    useSendContractTemplate(campaignId);
  const { mutate: uploadContract, isPending: isUploading } =
    useUploadCustomContract(campaignId);
  const { mutate: upsertDefaults } = useUpsertWorkspaceContractDefaults();

  const isSubmitting = isSending || isUploading;

  // -----------------------------------------------------------------------
  // Estado do formulário
  // -----------------------------------------------------------------------
  const [contractType, setContractType] = useState<ContractType>("platform");
  const [influencerId, setInfluencerId] = useState(initialInfluencerId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // Signatários
  const [representativeEmail, setRepresentativeEmail] = useState("");
  const [witness1Email, setWitness1Email] = useState("");
  const [witness2Email, setWitness2Email] = useState("");

  // Dados da marca (Modo A)
  const [brandLegalName, setBrandLegalName] = useState("");
  const [brandCnpj, setBrandCnpj] = useState("");
  const [brandAddress, setBrandAddress] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeCpf, setRepresentativeCpf] = useState("");

  // Upload (Modo B)
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pré-preenche os campos quando os defaults chegam (apenas se estiverem vazios).
  // CNPJ/CPF são formatados aqui — o backend pode persistir com ou sem máscara.
  useEffect(() => {
    if (!defaults) return;
    setRepresentativeEmail((v) => v || defaults.representative_email || "");
    setWitness1Email((v) => v || defaults.witness_1_email || "");
    setWitness2Email((v) => v || defaults.witness_2_email || "");
    setBrandLegalName((v) => v || defaults.brand_legal_name || "");
    setBrandCnpj((v) => v || (defaults.brand_cnpj ? formatCnpjInput(defaults.brand_cnpj) : ""));
    setBrandAddress((v) => v || defaults.brand_address || "");
    setRepresentativeName((v) => v || defaults.representative_name || "");
    setRepresentativeCpf((v) =>
      v || (defaults.representative_cpf ? formatCpfInput(defaults.representative_cpf) : ""),
    );
  }, [defaults]);

  // -----------------------------------------------------------------------
  // Opções de influenciador (contract_pending primeiro)
  // -----------------------------------------------------------------------
  const influencerOptions = useMemo(() => {
    const sorted = [...influencers].sort((a, b) => {
      const aPriority = a.status === "contract_pending" ? 0 : 1;
      const bPriority = b.status === "contract_pending" ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.name.localeCompare(b.name);
    });
    return sorted.map((inf) => ({
      value: inf.id,
      label:
        inf.status === "contract_pending"
          ? `⏳ ${inf.name}`
          : inf.name,
    }));
  }, [influencers]);

  const templateOptions = useMemo(
    () => [
      { value: "", label: "Template padrão da plataforma" },
      ...templates.map((t) => ({ value: t.id, label: t.name })),
    ],
    [templates],
  );

  const selectedInfluencer = useMemo(
    () => influencers.find((i) => i.id === influencerId) ?? null,
    [influencers, influencerId],
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  // -----------------------------------------------------------------------
  // File handling
  // -----------------------------------------------------------------------
  const validateFile = useCallback((f: File): string | null => {
    const ext = `.${f.name.split(".").pop()?.toLowerCase() ?? ""}`;
    const validExt = ACCEPTED_EXTENSIONS.includes(
      ext as (typeof ACCEPTED_EXTENSIONS)[number],
    );
    const validMime = ACCEPTED_MIME.includes(f.type) || f.type === "";
    if (!validExt || !validMime) {
      return "Formato inválido. Aceitamos PDF ou DOCX.";
    }
    if (f.size > MAX_FILE_SIZE) {
      return "Arquivo excede 10MB.";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (f: File | null | undefined) => {
      if (!f) return;
      const err = validateFile(f);
      if (err) {
        toast.error(err);
        return;
      }
      setFile(f);
      setErrors((prev) => {
        const { file: _omit, ...rest } = prev;
        return rest;
      });
    },
    [validateFile],
  );

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // -----------------------------------------------------------------------
  // Validação e submit
  // -----------------------------------------------------------------------
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!influencerId) next.influencerId = "Selecione um influenciador.";

    if (!representativeEmail.trim()) {
      next.representativeEmail = "Obrigatório.";
    } else if (!EMAIL_REGEX.test(representativeEmail.trim())) {
      next.representativeEmail = "E-mail inválido.";
    }

    if (!witness1Email.trim()) {
      next.witness1Email = "Obrigatório.";
    } else if (!EMAIL_REGEX.test(witness1Email.trim())) {
      next.witness1Email = "E-mail inválido.";
    }

    if (!witness2Email.trim()) {
      next.witness2Email = "Obrigatório.";
    } else if (!EMAIL_REGEX.test(witness2Email.trim())) {
      next.witness2Email = "E-mail inválido.";
    }

    // Bloqueia mesmos e-mails entre signatários (regra DocuSign).
    const emails = [
      representativeEmail.trim().toLowerCase(),
      witness1Email.trim().toLowerCase(),
      witness2Email.trim().toLowerCase(),
    ].filter(Boolean);
    if (new Set(emails).size !== emails.length) {
      next.witness2Email =
        next.witness2Email ?? "Os e-mails dos signatários devem ser distintos.";
    }

    if (contractType === "platform") {
      if (!brandLegalName.trim()) {
        next.brandLegalName = "Obrigatório.";
      } else if (brandLegalName.trim().length > 255) {
        next.brandLegalName = "Máximo 255 caracteres.";
      }

      if (!brandCnpj.trim()) {
        next.brandCnpj = "Obrigatório.";
      } else if (digitCount(brandCnpj) !== 14) {
        next.brandCnpj = "CNPJ deve ter 14 dígitos.";
      }

      if (!brandAddress.trim()) next.brandAddress = "Obrigatório.";

      if (!representativeName.trim()) {
        next.representativeName = "Obrigatório.";
      } else if (representativeName.trim().length > 255) {
        next.representativeName = "Máximo 255 caracteres.";
      }

      if (!representativeCpf.trim()) {
        next.representativeCpf = "Obrigatório.";
      } else if (digitCount(representativeCpf) !== 11) {
        next.representativeCpf = "CPF deve ter 11 dígitos.";
      }
    } else if (contractType === "custom") {
      if (!file) next.file = "Anexe o arquivo do contrato (PDF ou DOCX).";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Persistência dos defaults — não bloqueia o sucesso do envio se falhar. */
  const persistDefaults = useCallback(() => {
    const payload: WorkspaceContractDefaults = {
      representative_email: representativeEmail.trim(),
      witness_1_email: witness1Email.trim(),
      witness_2_email: witness2Email.trim(),
      brand_legal_name: brandLegalName.trim() || undefined,
      brand_cnpj: brandCnpj.trim() || undefined,
      brand_address: brandAddress.trim() || undefined,
      representative_name: representativeName.trim() || undefined,
      representative_cpf: representativeCpf.trim() || undefined,
    };
    upsertDefaults(payload);
  }, [
    representativeEmail,
    witness1Email,
    witness2Email,
    brandLegalName,
    brandCnpj,
    brandAddress,
    representativeName,
    representativeCpf,
    upsertDefaults,
  ]);

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Revise os campos destacados.");
      return;
    }

    // `influencerId` é o id do `campaign_users` (entregue pelo dashboard) —
    // é exatamente o `campaign_user_id` que o backend de contratos espera.
    const campaignUserId = influencerId;

    const expirationAtIso = expiresAt
      ? new Date(expiresAt).toISOString()
      : undefined;

    const sharedSigners = {
      representative_email: representativeEmail.trim(),
      witness_1_email: witness1Email.trim(),
      witness_2_email: witness2Email.trim(),
    };

    if (contractType === "platform") {
      sendTemplate(
        {
          campaign_user_id: campaignUserId,
          contract_type: "platform",
          template_id: templateId || undefined,
          expiration_at: expirationAtIso,
          ...sharedSigners,
          brand_legal_name: brandLegalName.trim(),
          brand_cnpj: brandCnpj.trim(),
          brand_address: brandAddress.trim(),
          representative_name: representativeName.trim(),
          representative_cpf: representativeCpf.trim(),
        },
        {
          onSuccess: () => {
            toast.success("Contrato enviado ao DocuSign.");
            persistDefaults();
            onSuccess?.();
            onClose();
          },
          onError: (e) =>
            toast.error(
              e instanceof Error ? e.message : "Erro ao enviar contrato.",
            ),
        },
      );
      return;
    }

    // contractType === "custom"
    uploadContract(
      {
        campaign_user_id: campaignUserId,
        file: file!,
        expiration_at: expirationAtIso,
        ...sharedSigners,
      },
      {
        onSuccess: () => {
          toast.success("Contrato enviado ao DocuSign.");
          persistDefaults();
          onSuccess?.();
          onClose();
        },
        onError: (e) =>
          toast.error(
            e instanceof Error ? e.message : "Erro ao enviar contrato.",
          ),
      },
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const minExpiry = useMemo(
    () =>
      new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16),
    [],
  );

  const hasDefaults = !!defaults;
  const isCustom = contractType === "custom";

  return (
    <Modal
      title="Enviar contrato"
      onClose={onClose}
      panelClassName={isCustom ? "max-w-5xl" : "max-w-2xl"}
    >
      <div className="flex flex-col gap-6">
        {/* Tipo de contrato */}
        <ContractTypeSelector value={contractType} onChange={setContractType} />

        <div
          className={
            isCustom
              ? "grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6"
              : "flex flex-col gap-6"
          }
        >
          {/* Coluna principal */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* Influenciador */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                Influenciador <span className="text-red-500">*</span>
              </label>
              <Select
                placeholder="Selecione o influenciador"
                options={influencerOptions}
                value={influencerId}
                onChange={(v) => {
                  setInfluencerId(v);
                  setErrors((p) => ({ ...p, influencerId: "" }));
                }}
                error={errors.influencerId}
                isSearchable
              />
              {selectedInfluencer && (
                <div className="flex items-center gap-2 mt-1">
                  <Avatar
                    src={selectedInfluencer.avatar}
                    alt={selectedInfluencer.name}
                    size="sm"
                  />
                  <span className="text-xs text-neutral-600">
                    {selectedInfluencer.username
                      ? `@${selectedInfluencer.username}`
                      : selectedInfluencer.name}
                  </span>
                </div>
              )}
              <p className={fieldHint}>
                O e-mail do influenciador será buscado automaticamente no
                cadastro do app mobile e não é exibido aqui.
              </p>
            </div>

            {/* Modo A: template */}
            {!isCustom && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>
                    Modelo do contrato padrão
                  </label>
                  {selectedTemplate && (
                    <a
                      href={selectedTemplate.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Icon name="ExternalLink" size={12} color="#7c3aed" />
                      Visualizar modelo
                    </a>
                  )}
                </div>
                <Select
                  placeholder={
                    loadingTemplates
                      ? "Carregando templates..."
                      : "Template padrão da plataforma"
                  }
                  options={templateOptions}
                  value={templateId}
                  onChange={setTemplateId}
                  disabled={loadingTemplates}
                />
              </div>
            )}

            {/* Modo B: drag-and-drop */}
            {isCustom && (
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>
                  Contrato próprio <span className="text-red-500">*</span>
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={[
                    "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 transition-colors cursor-pointer",
                    isDragging
                      ? "border-primary-500 bg-primary-50/40"
                      : errors.file
                        ? "border-red-300 bg-red-50/40"
                        : "border-neutral-300 bg-neutral-50/40 hover:border-primary-400 hover:bg-primary-50/30",
                  ].join(" ")}
                >
                  {file ? (
                    <>
                      <Icon name="FileText" size={28} color="#7c3aed" />
                      <div className="flex flex-col items-center gap-0.5">
                        <p className="text-sm font-medium text-neutral-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {(file.size / 1024).toFixed(0)} KB · clique para
                          trocar
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="mt-1 text-xs font-medium text-red-600 hover:underline"
                      >
                        Remover arquivo
                      </button>
                    </>
                  ) : (
                    <>
                      <Icon name="Upload" size={28} color="#737373" />
                      <div className="flex flex-col items-center gap-0.5">
                        <p className="text-sm font-medium text-neutral-900">
                          Arraste o arquivo ou clique para selecionar
                        </p>
                        <p className="text-xs text-neutral-500">
                          PDF ou DOCX · até 10MB
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </div>
                {errors.file && (
                  <p className="text-xs text-red-600">{errors.file}</p>
                )}
                <p className={fieldHint}>
                  Use as variáveis ao lado no formato{" "}
                  <code className="font-mono text-primary-700">
                    {"{{nome_variavel}}"}
                  </code>{" "}
                  — serão substituídas automaticamente antes do envio.
                </p>
              </div>
            )}

            {/* Expiração */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Data de expiração (opcional)</label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={minExpiry}
              />
              <p className={fieldHint}>
                Após esta data, o envelope expira automaticamente no DocuSign.
              </p>
            </div>

            {/* E-mails dos signatários */}
            <SignersSection
              loadingDefaults={loadingDefaults}
              hasDefaults={hasDefaults}
              representativeEmail={representativeEmail}
              witness1Email={witness1Email}
              witness2Email={witness2Email}
              setRepresentativeEmail={setRepresentativeEmail}
              setWitness1Email={setWitness1Email}
              setWitness2Email={setWitness2Email}
              errors={errors}
              clearError={(k) => setErrors((p) => ({ ...p, [k]: "" }))}
            />

            {/* Dados da marca — somente Modo A */}
            {!isCustom && (
              <BrandDataSection
                brandLegalName={brandLegalName}
                brandCnpj={brandCnpj}
                brandAddress={brandAddress}
                representativeName={representativeName}
                representativeCpf={representativeCpf}
                setBrandLegalName={setBrandLegalName}
                setBrandCnpj={setBrandCnpj}
                setBrandAddress={setBrandAddress}
                setRepresentativeName={setRepresentativeName}
                setRepresentativeCpf={setRepresentativeCpf}
                errors={errors}
                clearError={(k) => setErrors((p) => ({ ...p, [k]: "" }))}
              />
            )}
          </div>

          {/* Coluna lateral (variáveis) — só no Modo B */}
          {isCustom && (
            <aside className="rounded-2xl border border-neutral-200 bg-neutral-50/40 p-4">
              <VariablesPanel
                variables={variables}
                isLoading={loadingVariables}
              />
            </aside>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-2 border-t border-neutral-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="sm:flex-none"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="sm:flex-none"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="Send" size={16} color="#FAFAFA" />
              {isSubmitting ? "Enviando..." : "Enviar contrato"}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function ContractTypeSelector({
  value,
  onChange,
}: {
  value: ContractType;
  onChange: (v: ContractType) => void;
}) {
  const options: Array<{
    value: ContractType;
    label: string;
    description: string;
    icon: "FileText" | "Upload";
  }> = [
    {
      value: "platform",
      label: "Contrato padrão da plataforma",
      description:
        "Usa o template jurídico cadastrado. Mais rápido e revisado.",
      icon: "FileText",
    },
    {
      value: "custom",
      label: "Upload de contrato próprio",
      description:
        "Anexe seu PDF/DOCX. Use variáveis dinâmicas para substituição.",
      icon: "Upload",
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>Tipo de contrato</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                active
                  ? "border-primary-500 bg-primary-50/60"
                  : "border-neutral-200 bg-white hover:border-neutral-300",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  active ? "bg-primary-100" : "bg-neutral-100",
                ].join(" ")}
              >
                <Icon
                  name={opt.icon}
                  size={18}
                  color={active ? "#7c3aed" : "#525252"}
                />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-semibold text-neutral-900">
                  {opt.label}
                </p>
                <p className="text-xs text-neutral-500">{opt.description}</p>
              </div>
              <div
                className={[
                  "ml-auto h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                  active
                    ? "border-primary-500 bg-primary-500"
                    : "border-neutral-300 bg-white",
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SignersSectionProps {
  loadingDefaults: boolean;
  hasDefaults: boolean;
  representativeEmail: string;
  witness1Email: string;
  witness2Email: string;
  setRepresentativeEmail: (v: string) => void;
  setWitness1Email: (v: string) => void;
  setWitness2Email: (v: string) => void;
  errors: Record<string, string>;
  clearError: (key: string) => void;
}

function SignersSection({
  loadingDefaults,
  hasDefaults,
  representativeEmail,
  witness1Email,
  witness2Email,
  setRepresentativeEmail,
  setWitness1Email,
  setWitness2Email,
  errors,
  clearError,
}: SignersSectionProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">
          Signatários da marca
        </p>
        {hasDefaults && (
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
            Pré-preenchido
          </span>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        Envio simultâneo para os 3 signatários da marca + influenciador. Use
        e-mails distintos.
      </p>

      <div className="grid grid-cols-1 gap-3">
        <Input
          label="E-mail do representante *"
          type="email"
          placeholder="representante@marca.com"
          value={representativeEmail}
          onChange={(e) => {
            setRepresentativeEmail(e.target.value);
            clearError("representativeEmail");
          }}
          disabled={loadingDefaults}
          error={errors.representativeEmail}
        />
        <Input
          label="E-mail testemunha 1 *"
          type="email"
          placeholder="testemunha1@marca.com"
          value={witness1Email}
          onChange={(e) => {
            setWitness1Email(e.target.value);
            clearError("witness1Email");
          }}
          disabled={loadingDefaults}
          error={errors.witness1Email}
        />
        <Input
          label="E-mail testemunha 2 *"
          type="email"
          placeholder="testemunha2@marca.com"
          value={witness2Email}
          onChange={(e) => {
            setWitness2Email(e.target.value);
            clearError("witness2Email");
          }}
          disabled={loadingDefaults}
          error={errors.witness2Email}
        />
      </div>
    </div>
  );
}

interface BrandDataSectionProps {
  brandLegalName: string;
  brandCnpj: string;
  brandAddress: string;
  representativeName: string;
  representativeCpf: string;
  setBrandLegalName: (v: string) => void;
  setBrandCnpj: (v: string) => void;
  setBrandAddress: (v: string) => void;
  setRepresentativeName: (v: string) => void;
  setRepresentativeCpf: (v: string) => void;
  errors: Record<string, string>;
  clearError: (key: string) => void;
}

function BrandDataSection(p: BrandDataSectionProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-neutral-900">
          Dados da marca
        </p>
        <p className="text-xs text-neutral-500">
          Substituem as variáveis{" "}
          <code className="font-mono text-primary-700">{"{{brand_*}}"}</code> e{" "}
          <code className="font-mono text-primary-700">
            {"{{representative_*}}"}
          </code>{" "}
          no template.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Razão social *"
          placeholder="Marca LTDA"
          value={p.brandLegalName}
          onChange={(e) => {
            p.setBrandLegalName(e.target.value);
            p.clearError("brandLegalName");
          }}
          maxLength={255}
          error={p.errors.brandLegalName}
        />
        <Input
          label="CNPJ *"
          placeholder="00.000.000/0001-00"
          value={p.brandCnpj}
          onChange={(e) => {
            // Máscara aplicada no onChange — o input mostra sempre formatado.
            p.setBrandCnpj(formatCnpjInput(e.target.value));
            p.clearError("brandCnpj");
          }}
          inputMode="numeric"
          maxLength={18}
          error={p.errors.brandCnpj}
        />
        <div className="sm:col-span-2">
          <Input
            label="Endereço completo *"
            placeholder="Rua, número, bairro, cidade/UF, CEP"
            value={p.brandAddress}
            onChange={(e) => {
              p.setBrandAddress(e.target.value);
              p.clearError("brandAddress");
            }}
            error={p.errors.brandAddress}
          />
        </div>
        <Input
          label="Nome do representante *"
          placeholder="Nome completo"
          value={p.representativeName}
          onChange={(e) => {
            p.setRepresentativeName(e.target.value);
            p.clearError("representativeName");
          }}
          maxLength={255}
          error={p.errors.representativeName}
        />
        <Input
          label="CPF do representante *"
          placeholder="000.000.000-00"
          value={p.representativeCpf}
          onChange={(e) => {
            p.setRepresentativeCpf(formatCpfInput(e.target.value));
            p.clearError("representativeCpf");
          }}
          inputMode="numeric"
          maxLength={14}
          error={p.errors.representativeCpf}
        />
      </div>
    </div>
  );
}
