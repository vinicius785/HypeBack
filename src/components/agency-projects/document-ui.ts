/**
 * Lógica pura de Arquivos e links: rótulos de categoria, origem e ícone pela URL (nada é buscado na rede), endereço
 * normalizado e seguro, busca, filtro e agrupamento por categoria.
 */
import { FileText, Figma, HardDrive, Link as LinkIcon, Notebook, Palette, Presentation, Sheet, StickyNote, type LucideIcon } from "lucide-react";

import type { ProjectDocument, ProjectDocumentCategory } from "@/shared/services/agency-projects";
import { PROJECT_DOCUMENT_CATEGORIES } from "@/shared/services/agency-projects";

import { normalizeText } from "./project-base";


export const DOCUMENT_CATEGORY_LABEL: Record<ProjectDocumentCategory, string> = {
  briefing: "Briefing",
  planejamento: "Planejamento",
  apresentacao: "Apresentação",
  relatorio: "Relatório",
  contrato: "Contrato",
  referencia: "Referência",
  outro: "Outro",
};

// ---------------------------------------------------------------------------
// Documentos (arquivos e links)
// ---------------------------------------------------------------------------

export type DocumentSource =
  | "google_docs"
  | "google_sheets"
  | "google_slides"
  | "google_drive"
  | "figma"
  | "miro"
  | "notion"
  | "canva"
  | "link";

export const DOCUMENT_SOURCE_LABEL: Record<DocumentSource, string> = {
  google_docs: "Google Docs",
  google_sheets: "Google Sheets",
  google_slides: "Google Slides",
  google_drive: "Google Drive",
  figma: "Figma",
  miro: "Miro",
  notion: "Notion",
  canva: "Canva",
  link: "Link externo",
};

/** Ícone de cada origem (os mesmos da Plataforma VNH; nenhuma miniatura inventada). */
export const DOCUMENT_SOURCE_ICON: Record<DocumentSource, LucideIcon> = {
  google_docs: FileText,
  google_sheets: Sheet,
  google_slides: Presentation,
  google_drive: HardDrive,
  figma: Figma,
  miro: StickyNote,
  notion: Notebook,
  canva: Palette,
  link: LinkIcon,
};

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Origem do link pelo domínio (nunca falha: URL inválida ou desconhecida é "link externo"). Nada é buscado na rede. */
export function detectDocumentSource(url: string): DocumentSource {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "link";
  }
  const host = parsed.hostname.toLowerCase();
  if (hostIs(host, "docs.google.com")) {
    if (parsed.pathname.startsWith("/spreadsheets")) return "google_sheets";
    if (parsed.pathname.startsWith("/presentation")) return "google_slides";
    return "google_docs";
  }
  if (hostIs(host, "sheets.google.com")) return "google_sheets";
  if (hostIs(host, "slides.google.com")) return "google_slides";
  if (hostIs(host, "drive.google.com")) return "google_drive";
  if (hostIs(host, "figma.com")) return "figma";
  if (hostIs(host, "miro.com")) return "miro";
  if (hostIs(host, "notion.so") || hostIs(host, "notion.site")) return "notion";
  if (hostIs(host, "canva.com")) return "canva";
  return "link";
}

/**
 * Endereço pronto para enviar: aparado, com `https://` quando a pessoa não digitou o esquema. `null` quando não é uma
 * URL http/https válida ou passa de 2000 caracteres.
 */
export function normalizeDocumentUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  if (withScheme.length > 2000) return null;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // A API só aceita `http(s)://` com as duas barras (`https:exemplo.com` o banco recusa) e sem usuário/senha no endereço.
    if (!/^https?:\/\//i.test(withScheme) || url.username !== "" || url.password !== "") return null;
    if (!url.hostname.includes(".")) return null;
    return withScheme;
  } catch {
    return null;
  }
}

/** O endereço só vira link clicável se for http/https (um `javascript:` gravado por outra via nunca vira `href`). */
export function safeHttpUrl(url: string): string | undefined {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Nome sugerido para um link sem título: o domínio sem "www.". */
export function documentNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface DocumentFilters {
  query: string;
  /** `all` = todas as categorias. */
  category: "all" | ProjectDocumentCategory;
}

export const DEFAULT_DOCUMENT_FILTERS: DocumentFilters = { query: "", category: "all" };

/** Busca por nome e endereço e filtro de categoria; a ordem recebida (fixados primeiro) é mantida. */
export function filterDocuments(docs: readonly ProjectDocument[], f: DocumentFilters): ProjectDocument[] {
  const needle = normalizeText(f.query);
  return docs.filter((d) => {
    if (f.category !== "all" && d.category !== f.category) return false;
    if (needle && !normalizeText(d.name).includes(needle) && !normalizeText(d.url).includes(needle)) return false;
    return true;
  });
}

/** Fixados primeiro, mantendo a ordem relativa dentro de cada grupo. */
export function sortDocuments(docs: readonly ProjectDocument[]): ProjectDocument[] {
  return [...docs].sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

export interface DocumentGroup {
  category: ProjectDocumentCategory;
  label: string;
  items: ProjectDocument[];
}

/** Grupos por categoria na ordem do contrato, só os que têm itens; dentro de cada um, os fixados primeiro. */
export function groupDocumentsByCategory(docs: readonly ProjectDocument[]): DocumentGroup[] {
  const sorted = sortDocuments(docs);
  return PROJECT_DOCUMENT_CATEGORIES.map((category) => ({
    category,
    label: DOCUMENT_CATEGORY_LABEL[category],
    items: sorted.filter((d) => d.category === category),
  })).filter((g) => g.items.length > 0);
}
