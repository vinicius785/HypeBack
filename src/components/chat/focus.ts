/**
 * No celular/toque o foco automático abriria o teclado assim que a conversa abre, empurrando o cabeçalho (e o botão de
 * voltar) para fora da tela. Só em tela grande com mouse o campo já abre focado.
 */
export function canAutoFocus(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
}
