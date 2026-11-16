/** "3:25" ou "205" → segundos; vazio → null; inválido → undefined. */
export function parseDuration(text: string): number | null | undefined {
  const value = text.trim();
  if (!value) return null;
  const match = /^(?:(\d{1,3}):)?(\d{1,2})$/.exec(value) ?? /^(\d{1,4})$/.exec(value);
  if (!match) return undefined;
  if (match.length === 3 && match[2] !== undefined) {
    const minutes = Number(match[1] ?? 0);
    const seconds = Number(match[2]);
    return seconds < 60 ? minutes * 60 + seconds : undefined;
  }
  return Number(match[1]);
}

/** Segundos → "3:25". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Quem dá a aula: a plataforma quando vazio. */
export function instructorLabel(id: string | number | null | undefined): string {
  return id === null || id === undefined || id === "" ? "Plataforma" : `Usuário ${id}`;
}
