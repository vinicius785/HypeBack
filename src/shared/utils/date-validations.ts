/**
 * Adiciona dias a uma data
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Formata data para YYYY-MM-DD (formato do input date / API)
 * Usa métodos locais para evitar problemas de timezone
 */
export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Converte YYYY-MM-DD para DD/MM/AAAA (exibição para o usuário)
 */
export const formatDateToDisplay = (isoDate: string): string => {
  if (!isoDate || isoDate.length < 10) return "";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

/**
 * Converte DD/MM/AAAA (ou digitação parcial) para YYYY-MM-DD se válido
 * Aceita: 25/12/2024, 25/12/24, 25/1/2024, etc.
 */
export const parseDisplayDateToISO = (display: string): string | null => {
  const digits = display.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  let year = digits.slice(4, 8);
  if (year.length === 2) year = `20${year}`;
  if (year.length < 4) return null;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
  const lastDay = new Date(y, m, 0).getDate();
  if (d > lastDay) return null;
  return `${y}-${month}-${day}`;
};

/**
 * Calcula a data mínima para fase 1 (10 dias a partir de hoje)
 */
export const getPhase1MinDate = (): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = addDays(today, 10);
  minDate.setHours(0, 0, 0, 0);
  return formatDateForInput(minDate);
};

/**
 * Valida data da fase 1: não pode ser menor que 10 dias da data atual
 */
export const validatePhase1Date = (date: string): { valid: boolean; error?: string; minDate?: string } => {
  const minDateStr = getPhase1MinDate();
  // Criar data mínima a partir da string (evita problemas de timezone)
  const [minYear, minMonth, minDay] = minDateStr.split("-").map(Number);
  const minDate = new Date(minYear, minMonth - 1, minDay);
  minDate.setHours(0, 0, 0, 0);
  
  if (!date) {
    return { valid: true, minDate: minDateStr }; // Permite campo vazio
  }

  // Criar data a partir da string no formato YYYY-MM-DD (evita problemas de timezone)
  const [year, month, day] = date.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  selectedDate.setHours(0, 0, 0, 0);

  // Comparar apenas as datas (sem horas)
  if (selectedDate.getTime() < minDate.getTime()) {
    const minDateFormatted = minDate.toLocaleDateString("pt-BR");
    return {
      valid: false,
      error: `Use uma data a partir de ${minDateFormatted}`,
      minDate: minDateStr,
    };
  }

  return { valid: true, minDate: minDateStr };
};

/** Dias mínimos entre uma fase e a fase anterior. */
export const MIN_DAYS_BETWEEN_PHASES = 3;

/**
 * Data mínima de uma fase subsequente: 3 dias após a fase anterior.
 *
 * Independe da data já escolhida na fase atual — é isso que permite BLOQUEAR o
 * seletor desde o início (o `min` do input não pode depender do valor ainda vazio).
 * Retorna `undefined` se a fase anterior ainda não tem data.
 */
export const getSubsequentPhaseMinDate = (
  previousPhaseDate: string
): string | undefined => {
  if (!previousPhaseDate) return undefined;
  const [prevYear, prevMonth, prevDay] = previousPhaseDate.split("-").map(Number);
  if (!prevYear || !prevMonth || !prevDay) return undefined;
  const prevDate = new Date(prevYear, prevMonth - 1, prevDay);
  prevDate.setHours(0, 0, 0, 0);
  const minDate = addDays(prevDate, MIN_DAYS_BETWEEN_PHASES);
  minDate.setHours(0, 0, 0, 0);
  return formatDateForInput(minDate);
};

/**
 * Valida data de fases subsequentes: não pode ser menor que 3 dias da fase anterior
 */
export const validateSubsequentPhaseDate = (
  date: string,
  previousPhaseDate: string
): { valid: boolean; error?: string; minDate?: string } => {
  if (!date) {
    return { valid: true }; // Permite campo vazio
  }

  const minDateStr = getSubsequentPhaseMinDate(previousPhaseDate);
  if (!minDateStr) {
    return { valid: true }; // Se não há fase anterior, não valida
  }

  // Criar data a partir da string no formato YYYY-MM-DD (evita problemas de timezone)
  const [year, month, day] = date.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  selectedDate.setHours(0, 0, 0, 0);

  const [minYear, minMonth, minDay] = minDateStr.split("-").map(Number);
  const minDate = new Date(minYear, minMonth - 1, minDay);
  minDate.setHours(0, 0, 0, 0);

  // Comparar apenas as datas (sem horas)
  if (selectedDate.getTime() < minDate.getTime()) {
    return {
      valid: false,
      error: `Use uma data a partir de ${minDate.toLocaleDateString("pt-BR")}`,
      minDate: minDateStr,
    };
  }

  return { valid: true, minDate: minDateStr };
};

/**
 * Valida data limite do mural (Ativar Descobrir):
 * - Precisa ser maior que a data atual
 * - Precisa ser 7 dias menor que a data prevista da fase 1
 */
export const validateMuralEndDate = (
  date: string,
  phase1Date: string
): { valid: boolean; error?: string; minDate?: string; maxDate?: string } => {
  if (!date) {
    return { valid: true }; // Permite campo vazio
  }

  // Criar data a partir da string no formato YYYY-MM-DD (evita problemas de timezone)
  const [year, month, day] = date.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  selectedDate.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Deve ser maior que hoje
  if (selectedDate.getTime() <= today.getTime()) {
    return {
      valid: false,
      error: "A data limite precisa ser maior que a data atual.",
      minDate: formatDateForInput(addDays(today, 1)),
    };
  }

  if (!phase1Date) {
    return { valid: true }; // Se não há fase 1, não valida o limite superior
  }

  const [phase1Year, phase1Month, phase1Day] = phase1Date.split("-").map(Number);
  const phase1 = new Date(phase1Year, phase1Month - 1, phase1Day);
  phase1.setHours(0, 0, 0, 0);
  
  // Deve ser 7 dias menor que a fase 1
  const maxDate = addDays(phase1, -7);
  maxDate.setHours(0, 0, 0, 0);

  if (selectedDate.getTime() >= phase1.getTime()) {
    return {
      valid: false,
      error: `A data limite para receber inscrições precisa ser pelo menos 7 dias menor que a data prevista da fase 1. Data máxima: ${maxDate.toLocaleDateString("pt-BR")}`,
      maxDate: formatDateForInput(maxDate),
    };
  }

  return {
    valid: true,
    minDate: formatDateForInput(addDays(today, 1)),
    maxDate: formatDateForInput(maxDate),
  };
};

/**
 * Data limite sugerida ao ativar o mural na criação/edição em modo público
 * (mesmas regras de {@link validateMuralEndDate}).
 */
export function suggestMuralEndDateFromFormPhases(
  phases: Array<{ postDate?: string } | undefined> | undefined,
  options?: { fallbackDaysFromToday?: number }
): string | null {
  const fallbackDays = options?.fallbackDaysFromToday ?? 30;
  const phase1Date =
    phases?.find((p) => p?.postDate?.trim())?.postDate?.trim() ?? "";

  if (phase1Date) {
    const [py, pm, pd] = phase1Date.split("-").map(Number);
    const phase1 = new Date(py, pm - 1, pd);
    const maxEnd = addDays(phase1, -7);
    maxEnd.setHours(0, 0, 0, 0);
    const candidate = formatDateForInput(maxEnd);
    const v = validateMuralEndDate(candidate, phase1Date);
    if (v.valid) return candidate;
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = formatDateForInput(addDays(today, fallbackDays));
  const v = validateMuralEndDate(candidate, "");
  return v.valid ? candidate : null;
}

/**
 * Calcula data limite para influenciador enviar conteúdo (4 dias antes da fase)
 */
export const calculateContentSubmissionDeadline = (phaseDate: string): string | null => {
  if (!phaseDate) return null;
  
  const phase = new Date(phaseDate);
  const deadline = addDays(phase, -4);
  return formatDateForInput(deadline);
};

/**
 * Calcula data limite para influenciador enviar conteúdo corrigido (1 dia antes da fase)
 */
export const calculateCorrectedContentDeadline = (phaseDate: string): string | null => {
  if (!phaseDate) return null;
  
  const phase = new Date(phaseDate);
  const deadline = addDays(phase, -1);
  return formatDateForInput(deadline);
};

