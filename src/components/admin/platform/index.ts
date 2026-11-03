/** Peças compartilhadas das telas do Admin da plataforma. Importe daqui: `import { AdminTable } from "@/components/admin/platform"`. */
export { AdminAlertItem, type AdminAlertLike } from "./admin-alert-item";
export {
  ADMIN_REASON_MAX,
  ADMIN_REASON_MIN,
  AdminConfirmDialog,
  typedConfirmationMatches,
  type AdminConfirmDialogProps,
  type AdminConfirmValues,
  type AdminReasonConfig,
} from "./admin-confirm-dialog";
export { AdminEmptyState } from "./admin-empty-state";
export { AdminAvatar, AdminEntityCell, adminInitials } from "./admin-entity-cell";
export { AdminErrorState } from "./admin-error-state";
export { AdminFigureCard, AdminFigureGrid, type AdminFigureCardProps } from "./admin-figure-card";
export {
  AdminFilterBar,
  AdminSegmentedControl,
  type AdminCustomFilter,
  type AdminCustomFilterContext,
  type AdminDateRangeFilter,
  type AdminFilterDef,
  type AdminFilterOption,
  type AdminPillsFilter,
  type AdminSelectFilter,
  type AdminToggleFilter,
} from "./admin-filter-bar";
export { AdminInfoPopover } from "./admin-info-popover";
export { AdminKeyValueList, type AdminKeyValueItem } from "./admin-key-value-list";
export { AdminLink, adminLinkFromContract, type AdminLinkTarget } from "./admin-link";
export { AdminPage } from "./admin-page";
export { AdminPageHeader, type AdminCrumb } from "./admin-page-header";
export { AdminPager } from "./admin-pager";
export { AdminSearchInput } from "./admin-search-input";
export { AdminSection } from "./admin-section";
export { AdminSkeleton, AdminSkeletonLines } from "./admin-skeleton";
export { AdminBadge, AdminStatusBadge, type AdminBadgeTone } from "./admin-status-badge";
export {
  ADMIN_TABLE_BREAKPOINTS,
  AdminTable,
  type AdminTableBreakpoint,
  type AdminTableColumn,
  type AdminTableProps,
  type AdminTableSort,
} from "./admin-table";
export { AdminTabPanel, AdminTabs, adminTabIds, type AdminTabItem } from "./admin-tabs";
export { AdminActionMenu, type AdminActionMenuItem, type AdminActionMenuProps } from "./admin-action-menu";
export { AdminDialog, AdminDrawer, type AdminDialogProps, type AdminDialogSize, type AdminDrawerProps } from "./admin-dialog";
export {
  AdminEntityPicker,
  adminEntityPickerSummary,
  adminEntityPickerMinCharsHint,
  type AdminEntityPickerOptionState,
  type AdminEntityPickerProps,
  type AdminEntityPickerSearch,
  type AdminEntityPickerSearchResult,
} from "./admin-entity-picker";
export { AdminListSkeleton, type AdminListSkeletonVariant } from "./admin-list-skeleton";
export { AdminLoadMore, type AdminLoadMoreNoun } from "./admin-load-more";
export { AdminNotFound } from "./admin-not-found";
export {
  ADMIN_PERIOD_CUSTOM,
  AdminPeriodSelect,
  adminPeriodRangeError,
  type AdminPeriodChange,
  type AdminPeriodCustomConfig,
  type AdminPeriodPresetOption,
  type AdminPeriodSelectProps,
  type AdminPeriodValue,
} from "./admin-period-select";
export { AdminRefreshButton, type AdminRefreshButtonProps } from "./admin-refresh-button";
export {
  AdminTimeline,
  AdminTimelineItem,
  groupTimelineByDay,
  type AdminTimelineDayGroup,
  type AdminTimelineGroup,
  type AdminTimelineTone,
  type GroupTimelineByDayOptions,
} from "./admin-timeline";
export {
  ADMIN_TOAST_DURATION,
  adminErrorMessage,
  adminToast,
  type AdminErrorToastOptions,
  type AdminToastOptions,
} from "./admin-toast";
export { AdminIconButton, AdminTooltip, type AdminIconButtonProps } from "./admin-tooltip";
