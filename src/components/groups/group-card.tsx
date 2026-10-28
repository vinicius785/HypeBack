import { Link } from "@tanstack/react-router";
import { icons } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import { getUploadUrl } from "@/lib/utils/api";
import type { CommunityGroup } from "@/shared/types";

import { GroupEntryBadge } from "./group-entry-badge";

/** Resolve `icon_name` (legado) para um ícone lucide válido; fallback `Users`. */
function safeIcon(name: string | null): keyof typeof icons {
  return name && name in icons ? (name as keyof typeof icons) : "Users";
}

export function GroupCard({ group }: { group: CommunityGroup }) {
  const cover = getUploadUrl(group.cover_url);

  return (
    <Link
      to="/admin/groups/$groupId"
      params={{ groupId: group.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        {cover ? (
          <img
            src={cover}
            alt={group.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={
              group.icon_color
                ? { backgroundColor: `#${group.icon_color}1a` }
                : undefined
            }
          >
            <Icon
              name={safeIcon(group.icon_name)}
              size={32}
              color={group.icon_color ? `#${group.icon_color}` : "#a3a3a3"}
            />
          </div>
        )}

        {group.is_official && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-secondary-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <Icon name="BadgeCheck" size={12} color="#ffffff" />
            Oficial
          </span>
        )}

        {group.deleted_at && (
          <span className="absolute right-2 top-2 rounded-full bg-neutral-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Arquivado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 font-semibold text-neutral-950">
          {group.name}
        </h3>
        <p className="line-clamp-2 text-sm text-neutral-600">
          {group.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <GroupEntryBadge
            requiredLevel={group.required_level}
            requiredHypePoints={group.required_hype_points}
          />
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-neutral-500">
            <Icon name="Users" size={13} color="#737373" />
            {group.members_count}
            {typeof group.posts_count === "number" && (
              <>
                <span className="mx-1 opacity-40">·</span>
                <Icon name="FileText" size={13} color="#737373" />
                {group.posts_count}
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
