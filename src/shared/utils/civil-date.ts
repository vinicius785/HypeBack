const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatCivilDatePtBr(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() + 1 !== month ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDateOrInstantPtBr(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const civil = formatCivilDatePtBr(value);
  if (civil) return civil;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toLocaleDateString("pt-BR");
}
