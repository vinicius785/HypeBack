import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { spreadAvatars } from "@/components/creators/avatar-layout";
import { Icon } from "@/components/ui/icon";
import { getUploadUrl } from "@/lib/utils/api";
import type { CatalogItem } from "@/shared/services/creators-catalog";

export interface NearMeOrigin {
  lat: number;
  lng: number;
  radiusKm: number;
}

interface NearMeMapProps {
  origin: NearMeOrigin;
  items: CatalogItem[];
  /** Navega para o perfil do criador (recebe `user.id`). */
  onViewProfile: (userId: number) => void;
  /** Classe de altura do mapa (padrão: compacta). */
  heightClass?: string;
}

type LocatedItem = CatalogItem & {
  approx_location: NonNullable<CatalogItem["approx_location"]>;
};

/** Diâmetro (px) da foto por zoom: menor ao longe, para caber todo mundo; 42px de perto. */
function avatarSize(zoom: number): number {
  if (zoom <= 9) return 30;
  if (zoom === 10) return 34;
  if (zoom === 11) return 38;
  return 42;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lê um token de cor do tema (resolve a CSS var em valor concreto p/ o Leaflet). */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Escapa string para uso seguro dentro do HTML de um divIcon (evita XSS). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function originIcon(): L.DivIcon {
  return L.divIcon({
    className: "near-me-origin",
    html: '<span class="near-me-origin__pulse"></span><span class="near-me-origin__dot"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

/**
 * Resolve a foto do criador para URL absoluta.
 * Prioriza a foto do USUÁRIO (`/uploads/...`, caminho relativo); só cai para a
 * foto da rede social quando o usuário não tem foto. `getUploadUrl` passa URLs
 * http(s) adiante e prefixa relativas com a base do servidor — padrão do app.
 */
function resolvePhoto(item: CatalogItem): string | undefined {
  return getUploadUrl(item.user.photo ?? item.social_network.photo ?? undefined);
}

function avatarIcon(item: CatalogItem, size: number): L.DivIcon {
  const photo = resolvePhoto(item);
  const initial = (item.user.name || "?").trim().charAt(0).toUpperCase();
  // As iniciais ficam como base; a foto cobre via overlay `background-image`.
  // Se a foto der 404 (arquivo ausente no backend), o overlay fica transparente
  // e as iniciais aparecem — sem ícone de imagem quebrada e sem JS inline.
  const photoLayer = photo
    ? `<span class="near-me-avatar__photo" style="background-image:url('${escapeHtml(photo)}')"></span>`
    : "";
  return L.divIcon({
    className: "near-me-avatar",
    // `--sz` é o diâmetro da foto; anel, bico e iniciais escalam a partir dele (index.css).
    html: `<span class="near-me-avatar__box" style="--sz:${size}px"><span class="near-me-avatar__ring"><span class="near-me-avatar__initials">${escapeHtml(initial)}</span>${photoLayer}</span><span class="near-me-avatar__nub"></span></span>`,
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 6], // ponta inferior aponta para a localização
    popupAnchor: [0, -(size + 4)],
  });
}

/**
 * Uma foto por criador. Onde as fotos se sobreporiam no zoom atual (inclusive
 * criadores na mesma célula de ~1 km, que chegam com coordenadas idênticas) elas
 * se espalham ao redor do ponto, sem se cobrir; aproximar o mapa as devolve ao lugar.
 */
function CreatorMarkers({
  items,
  onViewProfile,
}: {
  items: LocatedItem[];
  onViewProfile: (userId: number) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  // O enquadramento do raio pode terminar (sem animação, em raios grandes) antes de o ouvinte acima existir.
  useEffect(() => setZoom(map.getZoom()), [map]);

  const markers = useMemo(() => {
    const size = avatarSize(zoom);
    const spread = spreadAvatars(
      items.map((item) => {
        const pt = map.project([item.approx_location.lat, item.approx_location.lng], zoom);
        return { id: item.social_network.id, x: pt.x, y: pt.y };
      }),
      size + 1, // anéis encostando (sem vão): empilha mais fotos na mesma área
    );
    return items.map((item, i) => ({
      item,
      position: map.unproject([spread[i].x, spread[i].y], zoom),
      icon: avatarIcon(item, size),
    }));
  }, [items, map, zoom]);

  return (
    <>
      {markers.map(({ item, position, icon }) => (
        <Marker key={item.social_network.id} position={position} icon={icon}>
          <Popup>
            <NearMeCreatorPopup item={item} onViewProfile={onViewProfile} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

/** Ajusta o viewport para enquadrar o raio de busca sempre que origem/raio mudam. */
function FitToRadius({ origin }: { origin: NearMeOrigin }) {
  const map = useMap();
  useEffect(() => {
    const center = L.latLng(origin.lat, origin.lng);
    // diâmetro (m) = raio * 2; toBounds devolve um quadrado centrado.
    const bounds = center.toBounds(origin.radiusKm * 2 * 1000);
    // O marcador sobe ~40px acima do ponto: dá a folga em cima (e tira de baixo, onde só a ponta chega),
    // sem mudar o total (56px) que decide o zoom do enquadramento.
    map.fitBounds(bounds, { paddingTopLeft: [28, 44], paddingBottomRight: [28, 12] });
  }, [map, origin.lat, origin.lng, origin.radiusKm]);
  return null;
}

// ---------------------------------------------------------------------------
// NearMeMap
// ---------------------------------------------------------------------------

/**
 * Mapa "Perto de mim" do catálogo de criadores.
 *
 * Tiles OSM dessaturados (filtro CSS) para os pins na cor da marca saltarem.
 * Plota a origem (admin) + um raio de busca + cada criador com `approx_location`.
 * Como a posição é privacy-snapped (~`precision_km`), cada criador ganha um halo
 * geográfico que comunica honestamente a área aproximada — sem fingir precisão.
 */
export function NearMeMap({ origin, items, onViewProfile, heightClass = "h-80 sm:h-72" }: NearMeMapProps) {
  const located = useMemo(
    () => items.filter((i): i is LocatedItem => !!i.approx_location),
    [items],
  );

  // Cores derivadas do tema (resolvidas p/ valor concreto que o Leaflet aceita).
  const colors = useMemo(
    () => ({
      primary: cssVar("--color-primary-500", "#ad47ff"),
      primaryStrong: cssVar("--color-primary-600", "#9e2cfa"),
    }),
    [],
  );

  const center: [number, number] = [origin.lat, origin.lng];

  return (
    <div className="near-me-map relative overflow-hidden">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        attributionControl={false}
        className={`${heightClass} w-full`}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToRadius origin={origin} />

        {/* Raio de busca */}
        <Circle
          center={center}
          radius={origin.radiusKm * 1000}
          pathOptions={{
            color: colors.primaryStrong,
            weight: 1.5,
            dashArray: "6 7",
            fillColor: colors.primary,
            fillOpacity: 0.05,
          }}
        />

        {/* Halos de aproximação (~precision_km) */}
        {located.map((item) => (
          <Circle
            key={`halo-${item.social_network.id}`}
            center={[item.approx_location.lat, item.approx_location.lng]}
            radius={item.approx_location.precision_km * 1000}
            pathOptions={{
              stroke: false,
              fillColor: colors.primary,
              fillOpacity: 0.12,
            }}
          />
        ))}

        {/* Origem (você) */}
        <Marker position={center} icon={originIcon()} zIndexOffset={1000}>
          <Popup>
            <div className="flex items-center gap-2 py-0.5">
              <Icon name="LocateFixed" size={16} color="var(--color-primary-600)" />
              <span className="text-sm font-medium text-neutral-900">Você está aqui</span>
            </div>
          </Popup>
        </Marker>

        {/* Criadores: uma foto por pessoa; onde se sobrepõem, espalham-se ao redor do ponto */}
        <CreatorMarkers items={located} onViewProfile={onViewProfile} />
      </MapContainer>

      {/* Legenda flutuante */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col gap-1.5 rounded-xl bg-white/90 px-3 py-2 text-xs text-neutral-600 shadow-sm backdrop-blur">
        <span className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-primary-600 ring-2 ring-primary-200" />
          Você
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full border border-primary-300 bg-primary-100" />
          Área aproximada (~1 km)
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popup do criador
// ---------------------------------------------------------------------------

function NearMeCreatorPopup({
  item,
  onViewProfile,
}: {
  item: CatalogItem;
  onViewProfile: (userId: number) => void;
}) {
  const photo = resolvePhoto(item);
  const initial = (item.user.name || "?").trim().charAt(0).toUpperCase();
  const distance = item.distance_km;
  // Se a foto 404 (arquivo ausente no backend), cai para as iniciais.
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div className="flex w-52 flex-col gap-3 py-1">
      <div className="flex items-center gap-3">
        {photo && !photoFailed ? (
          <img
            src={photo}
            alt={item.user.name}
            onError={() => setPhotoFailed(true)}
            className="size-11 rounded-full object-cover ring-2 ring-primary-100"
          />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-100 text-base font-semibold text-primary-700 ring-2 ring-primary-100">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-950">{item.user.name}</p>
          <p className="truncate text-xs text-neutral-500">@{item.social_network.username}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
        <Icon name="Navigation" size={13} color="var(--color-primary-600)" />
        {distance != null ? (
          <span>
            a <span className="font-medium text-neutral-900">{distance.toFixed(1)} km</span> de você ·
            local aproximado
          </span>
        ) : (
          <span>Localização aproximada</span>
        )}
      </div>

      <button
        type="button"
        className="btn"
        style={{ height: 38, width: "100%", justifyContent: "center", fontSize: 13 }}
        onClick={() => onViewProfile(item.user.id)}
      >
        Ver perfil
      </button>
    </div>
  );
}
