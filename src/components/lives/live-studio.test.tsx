/**
 * Painel de áudio do estúdio de live.
 *
 * O bug que isto cobre: trocar perfil/dispositivo/filtros não tinha efeito
 * nenhum no que ia ao ar. `setMicrophoneEnabled(false)` do livekit-client só
 * MUTA a publicação, e o `setMicrophoneEnabled(true, opções)` seguinte desmuta
 * a mesma track ignorando as opções. O fake abaixo reproduz essa semântica de
 * propósito — um mock que aceitasse as opções em qualquer caso deixaria o bug
 * passar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { BroadcasterCredentials } from "@/shared/types";

type CaptureOptions = Record<string, unknown>;
interface FakePublication {
  source: string;
  track: { id: number };
  captureOptions?: CaptureOptions;
  isMuted: boolean;
}

const lk = vi.hoisted(() => ({
  mic: null as FakePublication | null,
  nextTrackId: 1,
}));

vi.mock("livekit-client", () => {
  const Source = { Camera: "camera", Microphone: "microphone", ScreenShare: "screen_share" };

  class Room {
    localParticipant = {
      setCameraEnabled: vi.fn(async () => undefined),
      setScreenShareEnabled: vi.fn(async () => undefined),
      setMicrophoneEnabled: vi.fn(
        async (enabled: boolean, captureOptions?: CaptureOptions) => {
          if (!enabled) {
            if (lk.mic) lk.mic.isMuted = true; // muta, NÃO despublica
            return lk.mic ?? undefined;
          }
          if (lk.mic) {
            lk.mic.isMuted = false; // desmuta a mesma track; opções ignoradas
            return lk.mic;
          }
          lk.mic = {
            source: Source.Microphone,
            track: { id: lk.nextTrackId++ },
            captureOptions,
            isMuted: false,
          };
          return lk.mic;
        },
      ),
      getTrackPublication: vi.fn((source: string) =>
        source === Source.Microphone ? (lk.mic ?? undefined) : undefined,
      ),
      unpublishTrack: vi.fn(async (track: { id: number }) => {
        const pub = lk.mic;
        if (pub && pub.track.id === track.id) lk.mic = null;
        return pub ?? undefined;
      }),
    };
    on = vi.fn();
    off = vi.fn();
    connect = vi.fn(async () => undefined);
    disconnect = vi.fn();
    switchActiveDevice = vi.fn(async () => true);
    static getLocalDevices = vi.fn(async () => []);
  }

  return {
    Room,
    RoomEvent: {
      LocalTrackPublished: "localTrackPublished",
      LocalTrackUnpublished: "localTrackUnpublished",
      Disconnected: "disconnected",
    },
    Track: { Source },
    AudioPresets: { speech: { maxBitrate: 24_000 }, musicHighQualityStereo: { maxBitrate: 128_000 } },
  };
});

import { LiveStudio } from "./live-studio";

const credentials = { url: "wss://teste.livekit.cloud", token: "jwt" } as BroadcasterCredentials;

async function renderConnected() {
  const user = userEvent.setup();
  render(<LiveStudio credentials={credentials} />);
  await waitFor(() => expect(lk.mic).not.toBeNull());
  await user.click(screen.getByRole("button", { name: "Configurações de áudio" }));
  return user;
}

describe("LiveStudio — configurações de áudio", () => {
  beforeEach(() => {
    lk.mic = null;
    lk.nextTrackId = 1;
  });

  it("publica o microfone com o perfil de voz ao conectar", async () => {
    await renderConnected();

    expect(lk.mic?.captureOptions).toMatchObject({ echoCancellation: true, noiseSuppression: true });
  });

  it("trocar para música recria a track com as opções novas", async () => {
    const user = await renderConnected();
    const trackAntes = lk.mic?.track.id;

    await user.selectOptions(screen.getByRole("combobox", { name: /perfil do áudio/i }), "music");

    await waitFor(() => expect(lk.mic?.track.id).not.toBe(trackAntes));
    expect(lk.mic?.captureOptions).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    });
    expect(lk.mic?.isMuted).toBe(false);
  });

  it("com o mic desligado, a troca vale quando o mic for religado", async () => {
    const user = await renderConnected();

    await user.click(screen.getByRole("button", { name: "Microfone" }));
    await waitFor(() => expect(lk.mic?.isMuted).toBe(true));

    await user.selectOptions(screen.getByRole("combobox", { name: /perfil do áudio/i }), "music");
    // Nada vai ao ar com o mic desligado.
    await waitFor(() => expect(lk.mic).toBeNull());

    await user.click(screen.getByRole("button", { name: "Mudo" }));

    await waitFor(() => expect(lk.mic?.captureOptions).toMatchObject({ channelCount: 2 }));
    expect(lk.mic?.isMuted).toBe(false);
  });
});
