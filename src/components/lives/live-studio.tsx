import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioPresets,
  Room,
  RoomEvent,
  Track,
  type AudioCaptureOptions,
  type LocalTrackPublication,
  type TrackPublishOptions,
} from "livekit-client";

import { Mic, MicOff, MonitorUp, Settings, VideoOff } from "lucide-react";

import { I } from "@/components/prototype/ui";
import type { BroadcasterCredentials } from "@/shared/types";

interface LiveStudioProps {
  credentials: BroadcasterCredentials;
  /** Disparado quando a conexão cai por expiração de token (parent re-minta). */
  onTokenExpired?: () => void;
  onError?: (message: string) => void;
  /** Espectadores agora (socket) — chip no topo do vídeo. */
  views?: number;
  /** Curtidas acumuladas: cada aumento solta corações flutuantes. */
  likes?: number;
  /** ISO do início da live — base do cronômetro. Sem ele conta desde a montagem. */
  startedAt?: string | null;
  /** Botão "Encerrar" do estúdio (a confirmação fica com o pai). */
  onEnd?: () => void;
}

/**
 * Perfil de áudio publicado.
 *
 * `voice` liga o processamento do navegador (eco/ruído/ganho) e DTX — é o certo
 * para alguém falando com fone. `music` desliga tudo isso e sobe em estéreo com
 * bitrate alto: o processamento de voz destrói música ao vivo (corta cauda de
 * instrumento achando que é ruído de fundo) e DTX corta trechos silenciosos.
 */
type AudioProfile = "voice" | "music";

interface AudioSettings {
  profile: AudioProfile;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /** `undefined` = dispositivo padrão do sistema. */
  deviceId?: string;
}

const DEFAULT_AUDIO: AudioSettings = {
  profile: "voice",
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

function captureOptionsFor(settings: AudioSettings): AudioCaptureOptions {
  if (settings.profile === "music") {
    return {
      deviceId: settings.deviceId,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    };
  }
  return {
    deviceId: settings.deviceId,
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  };
}

/**
 * Remove a publicação do microfone e para a captura. Única forma de a próxima
 * ativação respeitar opções novas — ver `applyAudio`.
 */
async function unpublishMicrophone(room: Room): Promise<void> {
  const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  if (pub?.track) {
    await room.localParticipant.unpublishTrack(pub.track, true);
  }
}

function publishOptionsFor(settings: AudioSettings): TrackPublishOptions {
  return settings.profile === "music"
    ? {
        audioPreset: AudioPresets.musicHighQualityStereo,
        dtx: false,
        red: false,
        forceStereo: true,
      }
    : { audioPreset: AudioPresets.speech };
}

/**
 * Estúdio de transmissão do criador (LiveKit/WebRTC). A mídia é publicada
 * direto do navegador para o SFU — não passa pela API. O preview local mostra a
 * câmera do próprio criador (espelhada).
 *
 * O painel de configurações existe porque "o áudio não sai" quase nunca é a
 * transmissão: é o microfone errado selecionado (webcam em vez do headset) ou
 * um processamento comendo o sinal. O medidor de nível mostra na hora que o
 * microfone está captando, antes de alguém reclamar do outro lado.
 */
export function LiveStudio({
  credentials,
  onTokenExpired,
  onError,
  views,
  likes,
  startedAt,
  onEnd,
}: LiveStudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);

  const [connecting, setConnecting] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [audio, setAudio] = useState<AudioSettings>(DEFAULT_AUDIO);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | undefined>(undefined);
  const [applying, setApplying] = useState(false);
  /** Pico do sinal do microfone, 0..1. Alimenta o medidor de nível. */
  const [level, setLevel] = useState(0);

  // `audio` é lido dentro do effect de conexão, que NÃO deve reconectar quando
  // as configurações mudam (isso derrubaria a live). A ref dá o valor atual sem
  // entrar na lista de dependências.
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // ─── Cronômetro e corações flutuantes (curtidas reais) ────────────────────
  const mountedAtRef = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const elapsed = Math.max(
    0,
    Math.floor((now - (Number.isNaN(startMs) ? mountedAtRef.current : startMs)) / 1000),
  );

  const [hearts, setHearts] = useState<Array<{ id: number; x: number; r: number }>>([]);
  const heartId = useRef(0);
  const prevLikes = useRef(likes);
  useEffect(() => {
    const prev = prevLikes.current;
    prevLikes.current = likes;
    if (likes == null || prev == null || likes <= prev) return;
    const batch = Array.from({ length: Math.min(likes - prev, 6) }, () => ({
      id: heartId.current++,
      x: Math.random() * 50 - 25,
      r: Math.random() * 40 - 20,
    }));
    setHearts((h) => [...h, ...batch]);
    const ids = new Set(batch.map((b) => b.id));
    window.setTimeout(() => setHearts((h) => h.filter((x) => !ids.has(x.id))), 2600);
  }, [likes]);

  // ─── Medidor de nível do microfone ────────────────────────────────────────
  // Web Audio direto no MediaStreamTrack local: mede o que está sendo captado,
  // não o que volta do servidor. Amostra a 12fps — a 60 do requestAnimationFrame
  // só geraria re-render à toa.
  const meterRef = useRef<{ ctx: AudioContext; timer: number } | null>(null);

  const stopMeter = useCallback(() => {
    const meter = meterRef.current;
    if (!meter) return;
    window.clearInterval(meter.timer);
    void meter.ctx.close().catch(() => undefined);
    meterRef.current = null;
    setLevel(0);
  }, []);

  const startMeter = useCallback(
    (track: MediaStreamTrack) => {
      stopMeter();
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(new MediaStream([track]));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const timer = window.setInterval(() => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i += 1) {
            peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
          }
          setLevel(peak);
        }, 80);

        meterRef.current = { ctx, timer };
      } catch {
        // AudioContext bloqueado (autoplay policy): o estúdio segue sem medidor.
        meterRef.current = null;
      }
    },
    [stopMeter],
  );

  // Conexão e publicação. Re-executa se as credenciais mudarem (reconexão).
  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const attachLocalTrack = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.Camera && pub.videoTrack && videoRef.current) {
        pub.videoTrack.attach(videoRef.current);
      }
      if (pub.source === Track.Source.Microphone && pub.audioTrack?.mediaStreamTrack) {
        startMeter(pub.audioTrack.mediaStreamTrack);
      }
    };

    const detachLocalTrack = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.Microphone) stopMeter();
    };

    room.on(RoomEvent.LocalTrackPublished, attachLocalTrack);
    room.on(RoomEvent.LocalTrackUnpublished, detachLocalTrack);
    room.on(RoomEvent.Disconnected, (reason) => {
      // 10 = TOKEN_EXPIRED no enum DisconnectReason do LiveKit.
      if (reason === 10) onTokenExpired?.();
    });

    (async () => {
      try {
        setConnecting(true);
        await room.connect(credentials.url, credentials.token);
        if (cancelled) return;
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(
          true,
          captureOptionsFor(audioRef.current),
          publishOptionsFor(audioRef.current),
        );
        if (cancelled) return;
        // Caso as tracks já estivessem publicadas antes do listener registrar.
        const camPub = room.localParticipant.getTrackPublication(
          Track.Source.Camera,
        );
        if (camPub) attachLocalTrack(camPub);
        const micPub = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        );
        if (micPub) attachLocalTrack(micPub);
        setConnecting(false);
        setMicOn(true);
        setCamOn(true);

        // Os rótulos dos dispositivos só aparecem depois da permissão concedida
        // — por isso a enumeração vem aqui, e não na montagem do componente.
        const [audioIn, videoIn] = await Promise.all([
          Room.getLocalDevices("audioinput"),
          Room.getLocalDevices("videoinput"),
        ]);
        if (cancelled) return;
        setMics(audioIn);
        setCams(videoIn);
      } catch (err) {
        if (cancelled) return;
        setConnecting(false);
        onError?.(
          err instanceof Error
            ? `Falha ao conectar à transmissão: ${err.message}`
            : "Falha ao conectar à transmissão.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stopMeter();
      room.off(RoomEvent.LocalTrackPublished, attachLocalTrack);
      room.off(RoomEvent.LocalTrackUnpublished, detachLocalTrack);
      room.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials.url, credentials.token]);

  useEffect(() => stopMeter, [stopMeter]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(
      next,
      captureOptionsFor(audio),
      publishOptionsFor(audio),
    );
    setMicOn(next);
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

  const toggleScreen = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenOn;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenOn(next);
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Falha ao compartilhar a tela.",
      );
    }
  };

  /**
   * Republica o microfone com as novas opções.
   *
   * Trocar processamento, perfil ou dispositivo exige recriar a track
   * (constraints entram na captura, não dá pra alterar no ar). E recriar exige
   * DESPUBLICAR: no livekit-client, `setMicrophoneEnabled(false)` só muta a
   * publicação, e o `setMicrophoneEnabled(true, opções)` seguinte desmuta a
   * MESMA track ignorando as opções — o painel inteiro não aplicava nada.
   *
   * O vídeo continua no ar — quem assiste ouve um engasgo, não um corte.
   */
  const applyAudio = async (next: AudioSettings) => {
    setAudio(next);
    const room = roomRef.current;
    if (!room) return;

    setApplying(true);
    try {
      stopMeter();
      await unpublishMicrophone(room);
      // Mic desligado: a track velha já saiu, então o próximo `toggleMic` cria
      // uma nova com estas opções em vez de desmutar a antiga.
      if (!micOn) return;
      const pub = await room.localParticipant.setMicrophoneEnabled(
        true,
        captureOptionsFor(next),
        publishOptionsFor(next),
      );
      if (pub?.audioTrack?.mediaStreamTrack) {
        startMeter(pub.audioTrack.mediaStreamTrack);
      }
    } catch (err) {
      onError?.(
        err instanceof Error
          ? `Falha ao aplicar as configurações de áudio: ${err.message}`
          : "Falha ao aplicar as configurações de áudio.",
      );
    } finally {
      setApplying(false);
    }
  };

  const changeCamera = async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    setCameraId(deviceId);
    try {
      await room.switchActiveDevice("videoinput", deviceId);
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Falha ao trocar a câmera.",
      );
    }
  };

  const percent = Math.min(100, Math.round(level * 140));
  const audible = micOn && percent > 4;

  return (
    <div className="lvs-l">
      <div className="lvs-fr">
        {/* Preview espelhado da própria câmera. */}
        <div className={`lvs-v${camOn ? "" : " off"}`}>
          <video ref={videoRef} autoPlay muted playsInline className="mir" />
        </div>
        {connecting && (
          <div className="lvs-ov">
            <div className="lvs-sp" />
            <span>Conectando à transmissão...</span>
          </div>
        )}
        {!camOn && !connecting && (
          <div className="lvs-ov" style={{ background: "transparent" }}>
            <VideoOff className="ico" aria-hidden />
            <span>Câmera desligada</span>
          </div>
        )}

        <div className="lvs-tp">
          <span className="lvx-lv">
            <i />
            AO VIVO
          </span>
          <span className="lvs-t">{formatClock(elapsed)}</span>
          {views != null && (
            <span className="lvx-vw">
              <I n="eye" cls="sm" />
              {views.toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        <div className="lvs-ht">
          {hearts.map((h) => (
            <i
              key={h.id}
              style={{ "--x": `${h.x}px`, "--r": `${h.r}deg` } as React.CSSProperties}
            >
              <I n="heart" />
            </i>
          ))}
        </div>

        {/* Nível do microfone: o diagnóstico de "não sai som". */}
        {!connecting && (
          <div
            role="meter"
            aria-label="Nível do microfone"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`lvs-mt${audible ? "" : " low"}`}
            title={
              !micOn ? "Microfone mudo" : audible ? "Captando áudio" : "Sem sinal do microfone"
            }
          >
            <i style={{ width: `${percent}%` }} />
          </div>
        )}

        {showSettings && (
          <div className="lvs-set">
            <h4>Configurações de áudio e vídeo</h4>

            <DeviceSelect
              label="Microfone"
              value={audio.deviceId ?? ""}
              devices={mics}
              disabled={applying || connecting}
              fallbackLabel="Microfone"
              onChange={(deviceId) => void applyAudio({ ...audio, deviceId })}
            />

            <DeviceSelect
              label="Câmera"
              value={cameraId ?? ""}
              devices={cams}
              disabled={connecting}
              fallbackLabel="Câmera"
              onChange={(deviceId) => void changeCamera(deviceId)}
            />

            <label>
              <span>Perfil do áudio</span>
              <select
                value={audio.profile}
                disabled={applying || connecting}
                onChange={(event) =>
                  void applyAudio({
                    ...audio,
                    profile: event.target.value as AudioProfile,
                  })
                }
              >
                <option value="voice">Voz — fala, com filtros (padrão)</option>
                <option value="music">Música — estéreo, sem filtros</option>
              </select>
              <small style={{ fontWeight: 500 }}>
                {audio.profile === "music"
                  ? "Estéreo em alta qualidade. Use quando houver instrumento ou música ao vivo."
                  : "Filtros de voz ligados. Ideal para quem fala usando fone."}
              </small>
            </label>

            {audio.profile === "voice" && (
              <>
                <AudioToggle
                  label="Cancelamento de eco"
                  hint="Desligue só se estiver usando fone e o áudio soar abafado."
                  checked={audio.echoCancellation}
                  disabled={applying || connecting}
                  onChange={(checked) =>
                    void applyAudio({ ...audio, echoCancellation: checked })
                  }
                />
                <AudioToggle
                  label="Supressão de ruído"
                  hint="Remove ventilador e ar-condicionado. Pode cortar voz baixa."
                  checked={audio.noiseSuppression}
                  disabled={applying || connecting}
                  onChange={(checked) =>
                    void applyAudio({ ...audio, noiseSuppression: checked })
                  }
                />
                <AudioToggle
                  label="Ganho automático"
                  hint="Nivela o volume de quem fala longe do microfone."
                  checked={audio.autoGainControl}
                  disabled={applying || connecting}
                  onChange={(checked) =>
                    void applyAudio({ ...audio, autoGainControl: checked })
                  }
                />
              </>
            )}

            {applying && <em>Aplicando… o áudio fica mudo por um instante.</em>}
          </div>
        )}

        {/* Controles do estúdio */}
        <div className="lvs-bt">
          <button
            type="button"
            className={`lvs-b${micOn ? " on" : ""}`}
            onClick={toggleMic}
            title={micOn ? "Microfone" : "Mudo"}
            aria-label={micOn ? "Microfone" : "Mudo"}
          >
            {micOn ? <Mic className="ico" aria-hidden /> : <MicOff className="ico" aria-hidden />}
          </button>
          <button
            type="button"
            className={`lvs-b${camOn ? " on" : ""}`}
            onClick={toggleCam}
            title={camOn ? "Câmera" : "Sem câmera"}
            aria-label={camOn ? "Câmera" : "Sem câmera"}
          >
            {camOn ? <I n="video" cls="sm" /> : <VideoOff className="ico" aria-hidden />}
          </button>
          <button
            type="button"
            className={`lvs-b${screenOn ? " on" : ""}`}
            onClick={toggleScreen}
            title={screenOn ? "Parar tela" : "Compartilhar tela"}
            aria-label={screenOn ? "Parar tela" : "Compartilhar tela"}
          >
            <MonitorUp className="ico" aria-hidden />
          </button>
          <button
            type="button"
            className={`lvs-b${showSettings ? " on" : ""}`}
            onClick={() => setShowSettings((open) => !open)}
            title="Configurações de áudio"
            aria-label="Configurações de áudio"
          >
            <Settings className="ico" aria-hidden />
          </button>
          {onEnd && (
            <button type="button" className="lvs-end" onClick={onEnd}>
              Encerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatClock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function DeviceSelect({
  label,
  value,
  devices,
  disabled,
  fallbackLabel,
  onChange,
}: {
  label: string;
  value: string;
  devices: MediaDeviceInfo[];
  disabled: boolean;
  fallbackLabel: string;
  onChange: (deviceId: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Padrão do sistema</option>
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${fallbackLabel} ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function AudioToggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ck">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {label}
        <small>{hint}</small>
      </span>
    </label>
  );
}
