export interface SessionEntry {
  id: string;
  name: string;
  updatedAt: number;
  sortIndex?: number;
  tempPath: string;
  linkedFileName: string | null;
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
  { id: "night", label: "Night", mode: "dark" },
  { id: "business", label: "Business", mode: "dark" },
  { id: "corporate", label: "Corporate", mode: "light" },
  { id: "cupcake", label: "Cupcake", mode: "light" },
  { id: "forest", label: "Forrest", mode: "dark" },
  { id: "retro", label: "Retro", mode: "light" },
  { id: "synthwave", label: "Synthwave", mode: "dark" },
];

export function getThemeOption(id: string): ThemeOption | undefined {
  return THEME_OPTIONS.find((theme) => theme.id === id);
}

export interface Settings {
  resolutionPreset: string;
  canvasWidth: number;
  canvasHeight: number;
  layoutOrientation: "vertical" | "horizontal";
  horizontalSplit: number;
  verticalSplit: number;
  editorFontSize: number;
  showGrid: boolean;
  showFPS: boolean;
  themeId: string;
  darkEditor: boolean;
  autoRun: boolean;
  duLuaRootName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  resolutionPreset: "hd-landscape",
  canvasWidth: 1280,
  canvasHeight: 720,
  layoutOrientation: "horizontal",
  horizontalSplit: 0.5,
  verticalSplit: 0.5,
  editorFontSize: 14,
  showGrid: false,
  showFPS: true,
  themeId: "night",
  darkEditor: true,
  autoRun: false,
  duLuaRootName: "",
};
