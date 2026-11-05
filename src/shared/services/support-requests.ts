import { apiPost } from "@/lib/http-client";
import type { SupportCategory } from "@/shared/services/admin-support";

export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MIN = 10;
export const SUPPORT_MESSAGE_MAX = 5000;

export interface SupportRequestInput {
  subject: string;
  message: string;
  category: SupportCategory;
}

/** `POST /backoffice/support/tickets`: abre um pedido de ajuda da plataforma (a API limita a 10 por hora por pessoa). */
export async function createSupportRequest(input: SupportRequestInput): Promise<{ id: string; number: number }> {
  return await apiPost<{ id: string; number: number }>("/support/tickets", {
    subject: input.subject.trim(),
    message: input.message.trim(),
    category: input.category,
    context: { page_url: `${window.location.origin}${window.location.pathname}` },
  });
}
