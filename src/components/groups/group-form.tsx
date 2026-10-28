import { useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import { validateGroupCoverFile } from "@/shared/services/groups";

const NAME_MAX = 80;
const DESC_MAX = 280;
const RULES_MAX = 2000;

export interface GroupFormSubmit {
  name: string;
  description: string;
  is_official: boolean;
  rules: string | null;
  /** `null` = sem requisito de nível. */
  required_level: number | null;
  /** `null` = entrada gratuita. */
  required_hype_points: number | null;
}

interface GroupFormProps {
  initial?: {
    name?: string;
    description?: string;
    is_official?: boolean;
    rules?: string | null;
    required_level?: number | null;
    required_hype_points?: number | null;
  };
  /** URL já resolvida da capa atual (modo edição). */
  initialCoverUrl?: string | null;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: GroupFormSubmit, coverFile: File | null) => void;
  onCancel?: () => void;
}

export function GroupForm({
  initial,
  initialCoverUrl,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: GroupFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [rules, setRules] = useState(initial?.rules ?? "");
  const [isOfficial, setIsOfficial] = useState(initial?.is_official ?? false);

  // Requisitos de entrada — combináveis (nível e/ou Hype Points).
  const [levelEnabled, setLevelEnabled] = useState(
    initial?.required_level != null,
  );
  const [level, setLevel] = useState(
    initial?.required_level != null ? String(initial.required_level) : "",
  );
  const [hypeEnabled, setHypeEnabled] = useState(
    initial?.required_hype_points != null && initial.required_hype_points > 0,
  );
  const [hype, setHype] = useState(
    initial?.required_hype_points ? String(initial.required_hype_points) : "",
  );

  // Upload deferido: guardamos o File; o screen envia em /uploads antes de salvar.
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    initialCoverUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome obrigatório";
    else if (name.length > NAME_MAX) e.name = `Máx ${NAME_MAX} caracteres`;
    if (!description.trim()) e.description = "Descrição obrigatória";
    else if (description.length > DESC_MAX)
      e.description = `Máx ${DESC_MAX} caracteres`;
    if (rules.length > RULES_MAX) e.rules = `Máx ${RULES_MAX} caracteres`;
    if (levelEnabled) {
      const n = Number.parseInt(level, 10);
      if (!level || Number.isNaN(n) || n < 1)
        e.level = "Nível mínimo deve ser ≥ 1";
    }
    if (hypeEnabled) {
      const n = Number.parseInt(hype, 10);
      if (!hype || Number.isNaN(n) || n < 1) e.hype = "Valor deve ser ≥ 1";
    }
    return e;
  }, [name, description, rules, levelEnabled, level, hypeEnabled, hype]);

  const hasErrors = Object.keys(errors).length > 0;

  const handlePickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateGroupCoverFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = () => {
    if (hasErrors) {
      toast.error("Corrija os campos destacados antes de continuar.");
      return;
    }
    onSubmit(
      {
        name: name.trim(),
        description: description.trim(),
        is_official: isOfficial,
        rules: rules.trim() || null,
        required_level: levelEnabled ? Number.parseInt(level, 10) : null,
        required_hype_points: hypeEnabled ? Number.parseInt(hype, 10) : null,
      },
      coverFile,
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Campos */}
      <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Informações
          </h3>
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Criadores de Games"
            error={errors.name}
            maxLength={NAME_MAX + 1}
          />
          <div className="-mt-2 flex justify-end text-[11px] text-neutral-500">
            {name.length}/{NAME_MAX}
          </div>
          <Textarea
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sobre o que é esse grupo."
            error={errors.description}
            maxLength={DESC_MAX + 1}
            rows={3}
          />
          <div className="-mt-1 flex justify-end text-[11px] text-neutral-500">
            {description.length}/{DESC_MAX}
          </div>
          <Textarea
            label="Regras (opcional)"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Regras de convivência exibidas no detalhe do grupo."
            error={errors.rules}
            maxLength={RULES_MAX + 1}
            rows={3}
          />
        </section>

        {/* Requisitos de entrada (combináveis) */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Requisitos de entrada
            </h3>
            <p className="text-xs text-neutral-500">
              Deixe ambos desativados para um grupo <strong>aberto</strong>.
              Podem ser combinados.
            </p>
          </div>

          {/* Nível mínimo */}
          <div
            className={clsx(
              "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
              levelEnabled
                ? "border-primary-300 bg-primary-50/40"
                : "border-neutral-200 bg-white",
            )}
          >
            <label className="flex items-start gap-3">
              <Checkbox
                checked={levelEnabled}
                onCheckedChange={(v) => setLevelEnabled(v === true)}
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-900">
                  Exigir nível mínimo
                </span>
                <span className="text-xs text-neutral-500">
                  O usuário precisa ter pelo menos esse nível para entrar.
                </span>
              </span>
            </label>
            {levelEnabled && (
              <Input
                type="number"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="Ex.: 3"
                error={errors.level}
              />
            )}
          </div>

          {/* Hype Points */}
          <div
            className={clsx(
              "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
              hypeEnabled
                ? "border-primary-300 bg-primary-50/40"
                : "border-neutral-200 bg-white",
            )}
          >
            <label className="flex items-start gap-3">
              <Checkbox
                checked={hypeEnabled}
                onCheckedChange={(v) => setHypeEnabled(v === true)}
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-900">
                  Cobrar entrada (Hype Points)
                </span>
                <span className="text-xs text-neutral-500">
                  Debitado do saldo do usuário ao entrar (transação atômica).
                </span>
              </span>
            </label>
            {hypeEnabled && (
              <Input
                type="number"
                value={hype}
                onChange={(e) => setHype(e.target.value)}
                placeholder="Ex.: 500"
                error={errors.hype}
              />
            )}
          </div>
        </section>

        {/* Selo oficial */}
        <label className="flex items-center gap-3">
          <Checkbox
            checked={isOfficial}
            onCheckedChange={(v) => setIsOfficial(v === true)}
          />
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-neutral-900">
              Grupo oficial
            </span>
            <span className="text-xs text-neutral-500">
              Exibe o selo "Oficial" no app.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-full"
            >
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={hasErrors || isSubmitting}
            className="rounded-full"
          >
            <Icon name="Check" size={16} color="#ffffff" />
            <span className="font-semibold text-white">
              {isSubmitting ? submittingLabel : submitLabel}
            </span>
          </Button>
        </div>
      </div>

      {/* Capa */}
      <aside className="flex h-fit flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Capa
        </h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 transition-colors hover:border-primary-300"
        >
          {coverPreview ? (
            <>
              <img
                src={coverPreview}
                alt="Pré-visualização da capa"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                Trocar imagem
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-neutral-400">
              <Icon name="ImagePlus" size={28} color="#a3a3a3" />
              <span className="text-xs">Enviar capa (16:10)</span>
            </div>
          )}
        </button>
        <p className="text-[11px] text-neutral-500">
          JPEG, PNG ou WebP · até 5 MB. A imagem é enviada ao salvar.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePickCover}
          className="hidden"
        />
      </aside>
    </div>
  );
}
