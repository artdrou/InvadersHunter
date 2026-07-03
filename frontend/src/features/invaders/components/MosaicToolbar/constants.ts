// Filter model comes from the leaf module @/features/map/filter (not the map
// barrel), so this cross-feature import can't form a require cycle.
import type { MapFilter, FlashStatusFilter, FlashableFilter } from "@/features/map/filter";
import { DEFAULT_FILTER } from "@/features/map/filter";
import type { SortOption, SortDir, GroupMode } from "../../utils/invader-list";

export type ToolbarState = {
  search: string;
  viewMode: "grid" | "list";
  gridCols: number;   // 2–5, only relevant in grid mode
  sortBy: SortOption;
  sortDir: SortDir;
  groupMode: GroupMode;
  filter: MapFilter;
};

export const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  search: "",
  viewMode: "grid",
  gridCols: 3,
  sortBy: "number",
  sortDir: "asc",
  groupMode: "city",
  filter: DEFAULT_FILTER,
};

export type SubSheet = "sort" | "filter" | "group";

export const GRID_COLS_MIN = 2;
export const GRID_COLS_MAX = 5;

// Sliding-panel height for the main menu = 3 rows × 56px. Every sub-sheet opens at
// one consistent, taller size; the user can drag the handle to resize from there.
export const MAIN_MENU_HEIGHT = 168;

// Sub-sheet opens at this fraction of screen height; the drag-handle can grow it
// up to DRAG_MAX_RATIO. DRAG_THRESHOLD = min |dy| (px) before the handle claims the gesture.
export const SUB_SHEET_HEIGHT_RATIO = 0.36;
export const DRAG_MAX_RATIO = 0.6;
export const DRAG_THRESHOLD = 4;

/** Spring config for the bottom sheet sliding into view. */
export const SHEET_SPRING = { damping: 22, stiffness: 220, mass: 0.8 } as const;

export const POINTS_OPTIONS = [10, 20, 30, 40, 50, 100];

// ── i18n key maps ────────────────────────────────────────────────────────────

export const STATUS_KEYS: Record<FlashStatusFilter, string> = {
  all:       "invaders.statusAll",
  flashed:   "invaders.statusFlashed",
  unflashed: "invaders.statusUnflashed",
};

export const FLASHABLE_KEYS: Record<FlashableFilter, string> = {
  any:         "invaders.condAny",
  flashable:   "invaders.condFlashable",
  unflashable: "invaders.condUnflashable",
};

export const GROUP_KEYS: Record<GroupMode, string> = {
  none:   "invaders.groupNone",
  city:   "invaders.groupCity",
  points: "invaders.groupPoints",
  year:   "invaders.groupYear",
};

export const SORT_KEYS: Record<SortOption, string> = {
  number:      "invaders.sortNumber",
  name:        "invaders.sortName",
  points:      "invaders.sortPoints",
  pose_date:   "invaders.sortPoseDate",
  flash_date:  "invaders.sortFlashDate",
  update_date: "invaders.sortUpdated",
};
