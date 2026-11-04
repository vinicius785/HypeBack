import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { spreadAvatars } from "@/components/creators/avatar-layout";
import { clusterPoints } from "@/components/creators/cluster-points";
import { I } from "@/components/prototype/ui";
import { getUploadUrl } from "@/lib/utils/api";
import type { CatalogItem } from "@/shared/services/creators-catalog";

export interface NearMeOrigin {
  lat: number;
  lng: number;
  radiusKm: number;
  /** Cidade de origem ("Ribeirão Preto, São Paulo"); ausente = a localização de quem está buscando. */
  label?: string;
}

interface NearMeMapProps {
  origin: NearMeOrigin;
  items: CatalogItem[];
  /** Criador selecionado (`user.id`): ganha destaque e some dos agrupamentos. */
  selectedId: number | null;
  /** Clique num marcador (`user.id`) ou no fundo do mapa (`null`). */
  onSelect: (userId: number | null) => void;
  /** Opções de raio (km) e o tratamento da troca: controle sobre o próprio mapa. */
  radiusOptions: number[];
  onRadiusChange: (km: number) => void;
  /** Move o centro da busca para o ponto que o mapa está mostrando. */
  onMoveCenter: (lat: number, lng: number) => void;
  /** Resultados sendo atualizados: barra de progresso sobre o mapa. */
  loading?: boolean;
  /** Detalhes do criador selecionado (painel lateral no desktop, folha embaixo no celular). */
  detail?: ReactNode;
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

function avatarIcon(item: CatalogItem, size: number, selected = false): L.DivIcon {
  const photo = resolvePhoto(item);
  const initial = (item.user.name || "?").trim().charAt(0).toUpperCase();
  // As iniciais ficam como base; a foto cobre via overlay `background-image`.
  // Se a foto der 404 (arquivo ausente no backend), o overlay fica transparente
  // e as iniciais aparecem — sem ícone de imagem quebrada e sem JS inline.
  const photoLayer = photo
    ? `<span class="near-me-avatar__photo" style="background-image:url('${escapeHtml(photo)}')"></span>`
    : "";
  return L.divIcon({
    className: `near-me-avatar${selected ? " is-selected" : ""}`,
    // `--sz` é o diâmetro da foto; anel, bico e iniciais escalam a partir dele (index.css).
    html: `<span class="near-me-avatar__box" style="--sz:${size}px"><span class="near-me-avatar__ring"><span class="near-me-avatar__initials">${escapeHtml(initial)}</span>${photoLayer}</span><span class="near-me-avatar__nub"></span></span>`,
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 6], // ponta inferior aponta para a localização
    popupAnchor: [0, -(size + 4)],
  });
}

/** Agrupamento: foto de um dos criadores com a quantidade no canto. */
function clusterIcon(lead: CatalogItem, count: number, size: number): L.DivIcon {
  const photo = resolvePhoto(lead);
  const initial = (lead.user.name || "?").trim().charAt(0).toUpperCase();
  const photoLayer = photo
    ? `<span class="near-me-avatar__photo" style="background-image:url('${escapeHtml(photo)}')"></span>`
    : "";
  const box = size + 8;
  return L.divIcon({
    className: "near-me-avatar near-me-cluster",
    html: `<span class="near-me-avatar__box" style="--sz:${size}px"><span class="near-me-avatar__ring"><span class="near-me-avatar__initials">${escapeHtml(initial)}</span>${photoLayer}</span><span class="near-me-cluster__n">${count > 99 ? "99+" : count}</span></span>`,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  });
}

/** A partir deste zoom ninguém é agrupado: as fotos só se espalham (dois criadores na mesma célula de ~1 km nunca se separam). */
const CLUSTER_MAX_ZOOM = 13;

/**
 * Uma foto por criador. Em zoom aberto, fotos que se tocariam viram um agrupamento com a
 * quantidade; aproximar desfaz os grupos aos poucos. Daí em diante (e para quem está
 * selecionado) vale o espalhamento: cada foto no seu lugar, sem se cobrir.
 */
function CreatorMarkers({
  items,
  selectedId,
  onSelect,
}: {
  items: LocatedItem[];
  selectedId: number | null;
  onSelect: (userId: number | null) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  // O enquadramento do raio pode terminar (sem animação, em raios grandes) antes de o ouvinte acima existir.
  useEffect(() => setZoom(map.getZoom()), [map]);

  const markers = useMemo(() => {
    const size = avatarSize(zoom);
    const project = (item: LocatedItem) => map.project([item.approx_location.lat, item.approx_location.lng], zoom);
    const byId = new Map(items.map((i) => [i.social_network.id, i]));
    const clusterOn = zoom < CLUSTER_MAX_ZOOM;

    // Quem está selecionado nunca some dentro de um grupo.
    const pool = items.filter((i) => !clusterOn || i.user.id !== selectedId);
    const groups = clusterOn
      ? clusterPoints(
          pool.map((item) => {
            const pt = project(item);
            return { id: item.social_network.id, x: pt.x, y: pt.y };
          }),
          size + 6,
        )
      : [];

    const singles: LocatedItem[] = clusterOn ? items.filter((i) => i.user.id === selectedId) : items;
    const clusters: Array<{ key: string; position: L.LatLng; lead: LocatedItem; members: LocatedItem[] }> = [];
    for (const g of groups) {
      const members = g.ids.map((id) => byId.get(id as number)!).filter(Boolean);
      if (members.length === 1) singles.push(members[0]);
      else clusters.push({ key: `c-${members.map((m) => m.social_network.id).join("-")}`, position: map.unproject([g.x, g.y], zoom), lead: members[0], members });
    }

    const spread = spreadAvatars(
      singles.map((item) => {
        const pt = project(item);
        return { id: item.social_network.id, x: pt.x, y: pt.y };
      }),
      size + 1, // anéis encostando (sem vão): empilha mais fotos na mesma área
    );
    return {
      clusters: clusters.map((c) => ({ ...c, icon: clusterIcon(c.lead, c.members.length, size + 6) })),
      singles: singles.map((item, i) => {
        const selected = item.user.id === selectedId;
        return {
          item,
          selected,
          position: map.unproject([spread[i].x, spread[i].y], zoom),
          icon: avatarIcon(item, selected ? size + 6 : size, selected),
        };
      }),
    };
  }, [items, map, zoom, selectedId]);

  return (
    <>
      {markers.clusters.map(({ key, position, icon, members }) => (
        <Marker
          key={key}
          position={position}
          icon={icon}
          keyboard
          title={`${members.length} criadores aqui: aproxime para ver cada um`}
          eventHandlers={{
            click: () => {
              const bounds = L.latLngBounds(members.map((m) => [m.approx_location.lat, m.approx_location.lng] as [number, number]));
              // Mesma célula (coordenadas iguais): não há como separar, então só aproxima.
              if (!bounds.isValid() || bounds.getSouthWest().equals(bounds.getNorthEast())) {
                map.setView(bounds.getCenter(), Math.min(CLUSTER_MAX_ZOOM, map.getZoom() + 2));
              } else {
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: CLUSTER_MAX_ZOOM });
              }
            },
          }}
        />
      ))}
      {markers.singles.map(({ item, position, icon, selected }) => (
        <Marker
          key={item.social_network.id}
          position={position}
          icon={icon}
          zIndexOffset={selected ? 5000 : 0}
          keyboard
          title={item.user.name}
          eventHandlers={{ click: () => onSelect(item.user.id) }}
        />
      ))}
    </>
  );
}

/** Ajusta o viewport para enquadrar o raio de busca sempre que origem/raio mudam. */
function FitToRadius({ origin, nonce }: { origin: NearMeOrigin; nonce: number }) {
  const map = useMap();
  useEffect(() => {
    const center = L.latLng(origin.lat, origin.lng);
    // diâmetro (m) = raio * 2; toBounds devolve um quadrado centrado.
    const bounds = center.toBounds(origin.radiusKm * 2 * 1000);
    // O marcador sobe ~40px acima do ponto: dá a folga em cima (e tira de baixo, onde só a ponta chega),
    // sem mudar o total (56px) que decide o zoom do enquadramento.
    map.fitBounds(bounds, { paddingTopLeft: [28, 64], paddingBottomRight: [28, 12] });
  }, [map, origin.lat, origin.lng, origin.radiusKm, nonce]);
  return null;
}

/** Clique no fundo do mapa fecha o criador aberto. */
function BackgroundClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

/**
 * Avisa quando o mapa foi arrastado para longe do centro da busca: a pessoa pode
 * buscar "nesta área" sem abrir o painel de filtros.
 */
function DriftWatcher({ origin, onDrift }: { origin: NearMeOrigin; onDrift: (c: { lat: number; lng: number } | null) => void }) {
  const map = useMap();
  const check = () => {
    const o = map.latLngToContainerPoint([origin.lat, origin.lng]);
    const c = map.getSize().divideBy(2);
    if (o.distanceTo(c) > 110) {
      const ll = map.getCenter();
      onDrift({ lat: ll.lat, lng: ll.lng });
    } else onDrift(null);
  };
  useMapEvents({ moveend: check });
  // Origem nova (busca refeita): zera o aviso.
  useEffect(() => onDrift(null), [origin.lat, origin.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Zoom e "voltar ao centro", agrupados no canto (no lugar do controle padrão do Leaflet). */
function MapControls({ onRecenter }: { onRecenter: () => void }) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  return (
    <div className="nm-ctl" ref={ref}>
      <button type="button" aria-label="Aproximar" onClick={() => map.zoomIn()}>
        <I n="plus" cls="sm" />
      </button>
      <button type="button" aria-label="Afastar" onClick={() => map.zoomOut()}>
        <I n="minus" cls="sm" />
      </button>
      <button type="button" aria-label="Voltar ao centro da busca" title="Voltar ao centro da busca" onClick={onRecenter}>
        <I n="locate" cls="sm" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NearMeMap
// ---------------------------------------------------------------------------

/**
 * Mapa de exploração do catálogo de criadores.
 *
 * Tiles OSM dessaturados (filtro CSS) para os pins na cor da marca saltarem.
 * Plota a origem + o raio de busca + cada criador com `approx_location`. Como a posição é
 * privacy-snapped (~`precision_km`), cada criador ganha um halo geográfico que comunica
 * honestamente a área aproximada — sem fingir precisão.
 */
export function NearMeMap({
  origin,
  items,
  selectedId,
  onSelect,
  radiusOptions,
  onRadiusChange,
  onMoveCenter,
  loading = false,
  detail,
  heightClass = "h-80 sm:h-72",
}: NearMeMapProps) {
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

  const [drift, setDrift] = useState<{ lat: number; lng: number } | null>(null);
  const [recenter, setRecenter] = useState(0);

  const center: [number, number] = [origin.lat, origin.lng];
  const cityName = origin.label?.split(",")[0];

  return (
    <div className="near-me-map relative overflow-hidden">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        className={`${heightClass} w-full`}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToRadius origin={origin} nonce={recenter} />
        <BackgroundClick onClear={() => onSelect(null)} />
        <DriftWatcher origin={origin} onDrift={setDrift} />
        <MapControls onRecenter={() => setRecenter((n) => n + 1)} />

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
            interactive={false}
            pathOptions={{
              stroke: false,
              fillColor: colors.primary,
              fillOpacity: 0.12,
            }}
          />
        ))}

        {/* Centro da busca */}
        <Marker position={center} icon={originIcon()} zIndexOffset={1000} interactive={false} />

        <CreatorMarkers items={located} selectedId={selectedId} onSelect={onSelect} />
      </MapContainer>

      {loading && <div className="nm-loading" role="status" aria-label="Atualizando resultados" />}

      {/* Onde e quão longe: a região e o raio ficam sempre à vista */}
      <div className="nm-top">
        <div className="nm-where" title={origin.label ?? "Sua localização"}>
          <I n="locate" cls="sm" />
          <b>{cityName ?? origin.label ?? "Perto de você"}</b>
          {loading && <em>Atualizando…</em>}
        </div>
        <div className="nm-rad" role="group" aria-label="Raio de busca">
          {radiusOptions.map((v) => (
            <button key={v} type="button" aria-pressed={origin.radiusKm === v} className={origin.radiusKm === v ? "on" : ""} onClick={() => onRadiusChange(v)}>
              {v} km
            </button>
          ))}
        </div>
      </div>

      {drift && (
        <button type="button" className="nm-here" onClick={() => onMoveCenter(drift.lat, drift.lng)}>
          <I n="search" cls="sm" />
          Buscar nesta área
        </button>
      )}

      <div className="nm-legend" aria-hidden="true">
        <span>
          <i className="nm-lg-halo" /> Área aproximada (~1 km)
        </span>
      </div>

      {detail}
    </div>
  );
}
