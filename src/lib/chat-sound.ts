import { useSyncExternalStore } from "react";

/** Som de mensagem recebida: dois toques curtos gerados no navegador (sem arquivo de áudio). */
const KEY = "hype:chat-sound";
const EVENT = "hype:chat-sound-pref";
/** Duas mensagens quase juntas (ex.: a gaveta e a conversa percebem a mesma) tocam uma vez só. */
export const SOUND_MIN_GAP_MS = 1500;

export function isChatSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setChatSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // sem armazenamento: vale só até recarregar
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Preferência de som (liga/desliga), sincronizada entre abas. */
export function useChatSoundPref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isChatSoundOn, () => true);
  return [on, setChatSoundOn];
}

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
let lastPlayed = 0;

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioCtor | undefined =
    typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

let unlockInstalled = false;
/** Navegadores só liberam áudio depois de um clique/tecla: prepara o som no primeiro gesto da pessoa. */
export function installChatSoundUnlock(): void {
  if (unlockInstalled || typeof document === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    const c = audioContext();
    if (c && c.state === "suspended") void c.resume().catch(() => undefined);
    if (c && c.state !== "closed") {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    }
  };
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
}

/** Toca o aviso de mensagem recebida. Devolve se tocou (desligado, sem áudio liberado ou repetido = não). `force` ignora o intervalo mínimo (prévia ao ligar o som). */
export function playMessageSound(now: number = Date.now(), force = false): boolean {
  if (!isChatSoundOn()) return false;
  if (!force && now - lastPlayed < SOUND_MIN_GAP_MS) return false;
  const c = audioContext();
  if (!c) return false;
  if (c.state === "suspended") void c.resume().catch(() => undefined);
  if (c.state !== "running") return false;
  lastPlayed = now;
  const t = c.currentTime;
  [
    [880, 0],
    [1318.5, 0.11],
  ].forEach(([freq, delay]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.12, t + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.26);
    osc.connect(gain).connect(c.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 0.28);
  });
  return true;
}

/** Só para testes. */
export function resetChatSoundForTests(): void {
  ctx = null;
  lastPlayed = 0;
  unlockInstalled = false;
}
