export interface SessionEntry {
  id: string;
  name: string;
  updatedAt: number;
  sortIndex?: number;
  tempPath: string;
  linkedFileName: string | null;
  remoteSourceUrl: string | null;
  dirty: boolean;
}

export interface ResolutionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface ThemeOption {
  id: string;
  label: string;
  mode: "light" | "dark";
}

export interface FpsLimitOption {
  value: number;
  label: string;
}

export type LuaModuleSearchPathKind = "project" | "env" | "local" | "manual";

export interface LuaModuleSearchPathEntry {
  id: string;
  kind: LuaModuleSearchPathKind;
  label: string;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: "hd-landscape", label: "HD 16:9", width: 1280, height: 720 },
  { id: "hd-portrait", label: "HD 9:16", width: 720, height: 1280 },
  { id: "square", label: "Square 1:1", width: 1024, height: 1024 },
  { id: "fhd-landscape", label: "Full HD 16:9", width: 1920, height: 1080 },
  { id: "fhd-portrait", label: "Full HD 9:16", width: 1080, height: 1920 },
];

export function getResolutionPreset(id: string): ResolutionPreset | undefined {
  return RESOLUTION_PRESETS.find((preset) => preset.id === id);
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "business", label: "Business", mode: "dark" },
  { id: "corporate", label: "Corporate", mode: "light" },
  { id: "cupcake", label: "Cupcake", mode: "light" },
  { id: "forest", label: "Forrest", mode: "dark" },
  { id: "night", label: "Night", mode: "dark" },
  { id: "retro", label: "Retro", mode: "light" },
  { id: "synthwave", label: "Synthwave", mode: "dark" },
];

export function getThemeOption(id: string): ThemeOption | undefined {
  return THEME_OPTIONS.find((theme) => theme.id === id);
}

export const DEFAULT_MAX_FPS = 60;
export const MIN_SIDEBAR_WIDTH = 150;
export const MAX_SIDEBAR_WIDTH = 500;

export const FPS_LIMIT_OPTIONS: FpsLimitOption[] = [
  { value: 24, label: "24 FPS" },
  { value: 30, label: "30 FPS" },
  { value: 45, label: "45 FPS" },
  { value: 60, label: "60 FPS" },
  { value: 90, label: "90 FPS" },
  { value: 120, label: "120 FPS" },
];

export function normalizeMaxFps(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_FPS;
  }

  const normalized = Math.round(value);
  return FPS_LIMIT_OPTIONS.some((option) => option.value === normalized) ? normalized : DEFAULT_MAX_FPS;
}

export interface Settings {
  sidebarWidth: number;
  resolutionPreset: string;
  canvasWidth: number;
  canvasHeight: number;
  layoutOrientation: "vertical" | "horizontal";
  horizontalSplit: number;
  verticalSplit: number;
  editorFontSize: number;
  showGrid: boolean;
  showFPS: boolean;
  maxFPS: number;
  themeId: string;
  darkEditor: boolean;
  autoRun: boolean;
  luaModuleSearchPaths: LuaModuleSearchPathEntry[] | null;
}

export const DEFAULT_SETTINGS: Settings = {
  sidebarWidth: MIN_SIDEBAR_WIDTH,
  resolutionPreset: "fhd-landscape",
  canvasWidth: 1920,
  canvasHeight: 1080,
  layoutOrientation: "horizontal",
  horizontalSplit: 0.5,
  verticalSplit: 0.5,
  editorFontSize: 14,
  showGrid: false,
  showFPS: true,
  maxFPS: DEFAULT_MAX_FPS,
  themeId: "night",
  darkEditor: true,
  autoRun: false,
  luaModuleSearchPaths: null,
};
