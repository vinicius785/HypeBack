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

/** Distância (px) abaixo da qual marcadores viram um grupo com contagem. */
const CLUSTER_PX = 54;

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

function avatarIcon(item: CatalogItem): L.DivIcon {
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
    html: `<span class="near-me-avatar__ring"><span class="near-me-avatar__initials">${escapeHtml(initial)}</span>${photoLayer}</span><span class="near-me-avatar__nub"></span>`,
    iconSize: [42, 50],
    iconAnchor: [21, 48], // ponta inferior aponta para a localização
    popupAnchor: [0, -46],
  });
}

function clusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: "near-me-cluster",
    html: `<span class="near-me-cluster__dot">${count > 99 ? "99+" : count}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

/**
 * Agrupa criadores cujos marcadores ficariam sobrepostos no zoom atual
 * (grade de `CLUSTER_PX`). Sem biblioteca: usa a projeção do próprio Leaflet.
 */
function ClusteredCreators({
  items,
  onViewProfile,
}: {
  items: LocatedItem[];
  onViewProfile: (userId: number) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const groups = useMemo(() => {
    const cells = new Map<string, LocatedItem[]>();
    for (const item of items) {
      const pt = map.project([item.approx_location.lat, item.approx_location.lng], zoom);
      const key = `${Math.floor(pt.x / CLUSTER_PX)}:${Math.floor(pt.y / CLUSTER_PX)}`;
      const list = cells.get(key);
      if (list) list.push(item);
      else cells.set(key, [item]);
    }
    return [...cells.values()];
  }, [items, map, zoom]);

  return (
    <>
      {groups.map((group) => {
        if (group.length === 1) {
          const item = group[0];
          return (
            <Marker
              key={item.social_network.id}
              position={[item.approx_location.lat, item.approx_location.lng]}
              icon={avatarIcon(item)}
            >
              <Popup>
                <NearMeCreatorPopup item={item} onViewProfile={onViewProfile} />
              </Popup>
            </Marker>
          );
        }
        const lat = group.reduce((a, i) => a + i.approx_location.lat, 0) / group.length;
        const lng = group.reduce((a, i) => a + i.approx_location.lng, 0) / group.length;
        const bounds = L.latLngBounds(group.map((i) => [i.approx_location.lat, i.approx_location.lng] as [number, number]));
        // Todos na mesma célula (~1 km): aproximar não separa, então só lista no popup.
        const spread = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
        return (
          <Marker
            key={`g-${group.map((i) => i.social_network.id).join("-")}`}
            position={[lat, lng]}
            icon={clusterIcon(group.length)}
            eventHandlers={{
              click: (e) => {
                if (spread > 50 && map.getZoom() < map.getMaxZoom()) {
                  e.target.closePopup();
                  map.fitBounds(bounds, { padding: [48, 48] });
                }
              },
            }}
          >
            <Popup>
              <ClusterPopup group={group} onViewProfile={onViewProfile} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function ClusterPopup({ group, onViewProfile }: { group: LocatedItem[]; onViewProfile: (userId: number) => void }) {
  return (
    <div className="flex w-56 flex-col gap-2 py-1">
      <p className="text-sm font-semibold text-neutral-950">{group.length} criadores nesta área</p>
      <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto">
        {group.map((item) => (
          <li key={item.social_network.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-neutral-100"
              onClick={() => onViewProfile(item.user.id)}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-neutral-950">{item.user.name}</span>
                <span className="block truncate text-xs text-neutral-500">@{item.social_network.username}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-primary-600">Ver perfil</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ajusta o viewport para enquadrar o raio de busca sempre que origem/raio mudam. */
function FitToRadius({ origin }: { origin: NearMeOrigin }) {
  const map = useMap();
  useEffect(() => {
    const center = L.latLng(origin.lat, origin.lng);
    // diâmetro (m) = raio * 2; toBounds devolve um quadrado centrado.
    const bounds = center.toBounds(origin.radiusKm * 2 * 1000);
    map.fitBounds(bounds, { padding: [28, 28] });
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

        {/* Criadores (agrupados quando os marcadores se sobrepõem) */}
        <ClusteredCreators items={located} onViewProfile={onViewProfile} />
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
