export function formatPhoneNumber(phoneValue: string): string {
  const numbers = phoneValue.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 10) {
    return numbers.replace(
      /(\d{2})(\d{4})(\d{0,4})/,
      (_, area, first, second) => {
        if (second) return `(${area}) ${first}-${second}`;
        if (first) return `(${area}) ${first}`;
        if (area) return `(${area}`;
        return numbers;
      }
    );
  } else {
    return numbers.replace(
      /(\d{2})(\d{5})(\d{0,4})/,
      (_, area, first, second) => {
        if (second) return `(${area}) ${first}-${second}`;
        if (first) return `(${area}) ${first}`;
        if (area) return `(${area}`;
        return numbers;
      }
    );
  }
}

export const cleanPhoneNumber = (phoneValue: string): string => {
  return phoneValue.replace(/\D/g, "");
};

/** `12345678000195` → `12.345.678/0001-95`; digitado pela metade, só pontua o que já existe. */
export function formatCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12, 14)}`;
  return out;
}

/** `01310100` → `01310-100`. */
export function formatCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const truncateText = (text: string, maxLength: number = 20): string => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
};

/** `01021990` → `01/02/1990`; digitado pela metade, só pontua o que já existe. */
export function formatDateBr(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `/${d.slice(2, 4)}`;
  if (d.length > 4) out += `/${d.slice(4, 8)}`;
  return out;
}

/**
 * `01/02/1990` → `1990-02-01` (o formato da API). `null` se não for uma data de verdade (31/02), se for do futuro ou
 * de antes de 1900.
 */
export function parseBrDate(value: string, today: Date = new Date()): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() > todayUtc) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
