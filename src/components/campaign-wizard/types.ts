import type { CampaignFormData } from "@/shared/types";

/** Props comuns das etapas do assistente de campanha (criar e editar). */
export interface WizardStepProps {
  formData: CampaignFormData;
  /** Identidade estável (useCallback) — pode entrar em deps de useEffect. */
  updateFormData: (field: keyof CampaignFormData, value: unknown) => void;
  /** Campos (chaves de CampaignFormData) com erro de obrigatoriedade. */
  fieldErrors: Set<string>;
  /** true depois de tentar avançar/publicar: mostra os avisos `.nfe` e bordas `.err`. */
  tried: boolean;
}
