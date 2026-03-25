import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { CodeEditor, type CodeEditorHandle } from "./components/CodeEditor";
import { Canvas, type CanvasHandle } from "./components/Canvas";
import { Sidebar } from "./components/Sidebar";
import {
  DEFAULT_SETTINGS,
  getResolutionPreset,
  getThemeOption,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  normalizeMaxFps,
  RESOLUTION_PRESETS,
  THEME_OPTIONS,
  type LuaModuleSearchPathEntry,
  type SessionEntry,
  type Settings,
} from "./components/sidebarConfig";
import { runtimeFlags } from "./config/runtimeFlags";
import { DrawBuffer, createLuaEnvironment, type LuaExecResult } from "./emulator";
import { getAnimationDelayMs, getEffectiveMaxFps, getFrameDeltaSeconds, getRuntimeTimeSeconds, mergeMeasuredDisplayFps } from "./emulator/frameTiming";
import { moveSessionInOrder, sortSessionsByOrder, type SessionDropPlacement } from "./sessionOrdering";
import { sessionNameFromFileName, validateGitHubLuaUrl, validateImportedSessionFile } from "./security/inputGuards";
import {
  createSession,
  deleteLuaModuleSearchPathHandle,
  deleteSession,
  getDuLuaRootHandle,
  getLuaModuleSearchPathHandle,
  listSessions,
  readRemoteSessionSource,
  readSessionFromLinkedFile,
  readSessionContent,
  renameSession,
  saveSessionToLocal,
  saveSessionOrder,
  setLuaModuleSearchPathHandle,
  writeSessionContent,
} from "./storage/sessionStore";

type CanvasRotation = 0 | 90 | 180 | 270;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type DirectoryPickerSupport = {
  available: boolean;
  unavailableReason: string | null;
};

function getDirectoryPickerSupport(): DirectoryPickerSupport {
  if (typeof window === "undefined") {
    return {
      available: false,
      unavailableReason: "Local folder access is only available in the browser client.",
    };
  }

  const picker = window as Window & {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  };

  if (typeof picker.showDirectoryPicker === "function") {
    return {
      available: true,
      unavailableReason: null,
    };
  }

  if (!window.isSecureContext) {
    return {
      available: false,
      unavailableReason: "Local folder access needs a secure context. Open the emulator via https:// or http://localhost.",
    };
  }

  const isBrave = typeof navigator !== "undefined" && "brave" in navigator;
  if (isBrave) {
    return {
      available: false,
      unavailableReason: "Brave does not expose local folder access here. Add Local Folder needs showDirectoryPicker(). Use Chrome/Edge, or enable the Brave flag if your build provides it.",
    };
  }

  return {
    available: false,
    unavailableReason: "Local folder access is not exposed by this browser here.",
  };
}

function getFrameIntervalMs(maxFps: number): number {
  return 1000 / Math.max(1, maxFps);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLuaErrorLine(errorMessage: string | undefined, chunkLabel: string | null | undefined): number | null {
  if (!errorMessage) {
    return null;
  }

  const firstLine = errorMessage.split(/\r?\n/, 1)[0] ?? errorMessage;
  const normalizedLabel = chunkLabel?.replace(/^@/, "").trim();

  if (normalizedLabel) {
    const labelMatch = firstLine.match(new RegExp(`${escapeRegExp(normalizedLabel)}:(\\d+):`));
    const lineNumber = labelMatch?.[1] ? Number.parseInt(labelMatch[1], 10) : Number.NaN;
    if (Number.isInteger(lineNumber) && lineNumber > 0) {
      return lineNumber;
    }
  }

  const genericMatch = firstLine.match(/:(\d+):/);
  const genericLineNumber = genericMatch?.[1] ? Number.parseInt(genericMatch[1], 10) : Number.NaN;
  return Number.isInteger(genericLineNumber) && genericLineNumber > 0 ? genericLineNumber : null;
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.5A10.5 10.5 0 0 0 8.68 22c.52.1.7-.23.7-.5v-1.77c-2.87.62-3.47-1.22-3.47-1.22-.47-1.18-1.13-1.49-1.13-1.49-.92-.63.07-.62.07-.62 1.03.07 1.56 1.04 1.56 1.04.9 1.56 2.4 1.1 2.98.84.09-.66.35-1.11.63-1.37-2.29-.26-4.7-1.14-4.7-5.06 0-1.12.4-2.04 1.04-2.76-.11-.26-.45-1.33.1-2.77 0 0 .86-.28 2.82 1.05a9.8 9.8 0 0 1 5.12 0c1.96-1.33 2.81-1.05 2.81-1.05.56 1.44.22 2.51.12 2.77.65.72 1.04 1.64 1.04 2.76 0 3.94-2.42 4.79-4.73 5.05.37.32.7.94.7 1.89v2.8c0 .28.19.61.71.5A10.5 10.5 0 0 0 12 1.5Z"
      />
    </svg>
  );
}

function rotateCanvasBy(current: CanvasRotation, delta: 90 | -90): CanvasRotation {
  const next = (current + delta + 360) % 360;
  return next as CanvasRotation;
}

function normalizeSettings(raw: unknown): Settings {
  const value = (raw && typeof raw === "object")
    ? raw as Partial<Settings> & { resolution?: number; panelSplit?: number; darkBg?: boolean; luaModuleSearchPaths?: unknown }
    : {};
  let resolutionPreset = value.resolutionPreset ?? DEFAULT_SETTINGS.resolutionPreset;
  let canvasWidth = value.canvasWidth;
  let canvasHeight = value.canvasHeight;
  const themeId = typeof value.themeId === "string" && getThemeOption(value.themeId)
    ? value.themeId
    : DEFAULT_SETTINGS.themeId;

  if ((!canvasWidth || !canvasHeight) && typeof value.resolution === "number") {
    canvasWidth = value.resolution;
    canvasHeight = value.resolution;
    resolutionPreset = "square";
  }

  const preset = getResolutionPreset(resolutionPreset) ?? RESOLUTION_PRESETS[0];
  const resolvedWidth = typeof canvasWidth === "number" && canvasWidth > 0 ? canvasWidth : preset.width;
  const resolvedHeight = typeof canvasHeight === "number" && canvasHeight > 0 ? canvasHeight : preset.height;

  const legacySplit = typeof value.panelSplit === "number" ? value.panelSplit : DEFAULT_SETTINGS.horizontalSplit;
  const darkEditor = typeof value.darkEditor === "boolean"
    ? value.darkEditor
    : typeof value.darkBg === "boolean"
      ? value.darkBg
      : DEFAULT_SETTINGS.darkEditor;

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    sidebarWidth: clamp(typeof value.sidebarWidth === "number" ? value.sidebarWidth : DEFAULT_SETTINGS.sidebarWidth, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
    resolutionPreset,
    canvasWidth: resolvedWidth,
    canvasHeight: resolvedHeight,
    themeId,
    darkEditor,
    layoutOrientation: value.layoutOrientation === "horizontal" ? "horizontal" : "vertical",
    horizontalSplit: clamp(typeof value.horizontalSplit === "number" ? value.horizontalSplit : legacySplit, 0.25, 0.75),
    verticalSplit: clamp(typeof value.verticalSplit === "number" ? value.verticalSplit : legacySplit, 0.25, 0.75),
    editorFontSize: clamp(typeof value.editorFontSize === "number" ? value.editorFontSize : DEFAULT_SETTINGS.editorFontSize, 8, 28),
    maxFPS: normalizeMaxFps(value.maxFPS),
    luaModuleSearchPaths: normalizeLuaModuleSearchPaths(value.luaModuleSearchPaths),
  };
}

function safeLoadSettings(): Settings {
  try {
    const raw = localStorage.getItem("rs-emulator-settings");
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function safeSaveSettings(settings: Settings): void {
  try {
    localStorage.setItem("rs-emulator-settings", JSON.stringify(normalizeSettings(settings)));
  } catch {
    // ignore quota/privacy failures
  }
}

type DirectoryPermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

interface ResolvedServerModule {
  source: string;
  resolvedPath: string;
}

interface ServerSearchRoot {
  rootIndex: number;
  path: string;
}

interface DuLuaServerStatus {
  configured: boolean;
  rootPath: string | null;
  searchRoots: ServerSearchRoot[];
}

function normalizeSearchPathLabel(value: string): string {
  return value.trim().replace(/\\/g, "/");
}

function normalizeSearchPathKey(value: string): string {
  const normalized = normalizeSearchPathLabel(value);
  return /^(?:[A-Za-z]:|\\\\)/.test(normalized) ? normalized.toLowerCase() : normalized;
}

function isLuaModuleSearchPathEntry(value: unknown): value is LuaModuleSearchPathEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<LuaModuleSearchPathEntry>;
  return typeof entry.id === "string"
    && typeof entry.label === "string"
    && (entry.kind === "project" || entry.kind === "env" || entry.kind === "local" || entry.kind === "manual");
}

function normalizeLuaModuleSearchPaths(value: unknown): LuaModuleSearchPathEntry[] | null {
  if (value == null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter(isLuaModuleSearchPathEntry)
    .map((entry) => ({
      id: entry.id.trim(),
      kind: entry.kind,
      label: entry.label.trim(),
    }))
    .filter((entry) => entry.id !== "" && entry.label !== "");
}

function nextSearchPathId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createProjectSearchPathEntry(): LuaModuleSearchPathEntry {
  return { id: "project", kind: "project", label: "./" };
}

function createEnvSearchPathEntry(rootIndex: number, pathLabel: string): LuaModuleSearchPathEntry {
  return { id: `env:${rootIndex}`, kind: "env", label: pathLabel };
}

function createLocalSearchPathEntry(id: string, label: string): LuaModuleSearchPathEntry {
  return { id, kind: "local", label };
}

function createManualSearchPathEntry(id: string, label: string): LuaModuleSearchPathEntry {
  return { id, kind: "manual", label: normalizeSearchPathLabel(label) };
}

function extractEnvRootIndex(entryId: string): number | null {
  const match = entryId.match(/^env:(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function defaultLuaModuleSearchPaths(serverRoots: ServerSearchRoot[]): LuaModuleSearchPathEntry[] {
  return [createProjectSearchPathEntry(), ...serverRoots.map((root) => createEnvSearchPathEntry(root.rootIndex, root.path))];
}

function reconcileLuaModuleSearchPaths(entries: LuaModuleSearchPathEntry[] | null, serverRoots: ServerSearchRoot[]): LuaModuleSearchPathEntry[] {
  if (entries === null) {
    return defaultLuaModuleSearchPaths(serverRoots);
  }

  const envLabels = new Map(serverRoots.map((root) => [`env:${root.rootIndex}`, root.path]));
  const seen = new Set<string>();
  const result: LuaModuleSearchPathEntry[] = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue;
    }

    if (entry.kind === "project") {
      result.push(createProjectSearchPathEntry());
      seen.add(entry.id);
      continue;
    }

    if (entry.kind === "env") {
      const nextLabel = envLabels.get(entry.id);
      const rootIndex = extractEnvRootIndex(entry.id);
      if (!nextLabel || rootIndex === null) {
        continue;
      }
      result.push(createEnvSearchPathEntry(rootIndex, nextLabel));
      seen.add(entry.id);
      continue;
    }

    if (entry.kind === "local") {
      result.push(createLocalSearchPathEntry(entry.id, entry.label));
      seen.add(entry.id);
      continue;
    }

    if (entry.kind === "manual") {
      result.push(createManualSearchPathEntry(entry.id, entry.label));
      seen.add(entry.id);
    }
  }

  return result;
}

function sameLuaModuleSearchPaths(a: LuaModuleSearchPathEntry[], b: LuaModuleSearchPathEntry[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((entry, index) => {
    const other = b[index];
    return other?.id === entry.id && other.kind === entry.kind && other.label === entry.label;
  });
}

async function ensureReadableDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const permissionAware = handle as DirectoryPermissionHandle;
  const descriptor = { mode: "read" as const };

  if (permissionAware.queryPermission) {
    const current = await permissionAware.queryPermission(descriptor);
    if (current === "granted") {
      return true;
    }
  }

  if (permissionAware.requestPermission) {
    return (await permissionAware.requestPermission(descriptor)) === "granted";
  }

  return true;
}

function buildLuaModuleCandidates(moduleName: string): string[][] {
  const normalized = moduleName.replace(/\\/g, "/");
  const slashParts = normalized.split("/").filter(Boolean);
  const dotParts = normalized.split(".").filter(Boolean);
  const bases = [slashParts, dotParts];
  const seen = new Set<string>();
  const candidates: string[][] = [];

  for (const parts of bases) {
    if (parts.length === 0) {
      continue;
    }

    for (const variant of [parts, [...parts, "init"]]) {
      const key = variant.join("/");
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(variant);
      }
    }
  }

  return candidates;
}

async function readLuaModuleFromRoot(root: FileSystemDirectoryHandle, moduleName: string): Promise<string | null> {
  for (const parts of buildLuaModuleCandidates(moduleName)) {
    try {
      let current: FileSystemDirectoryHandle = root;
      for (let index = 0; index < parts.length - 1; index += 1) {
        current = await current.getDirectoryHandle(parts[index], { create: false });
      }

      const fileName = `${parts[parts.length - 1]}.lua`;
      const fileHandle = await current.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function readLuaModuleFromServer(
  moduleName: string,
  options?: { fromSource?: string | null; scope?: "relative" | "project" | "du" | "manual"; rootIndex?: number | null; rootPath?: string | null },
): Promise<ResolvedServerModule | null> {
  try {
    const params = new URLSearchParams({ name: moduleName });
    if (options?.fromSource) {
      params.set("from", options.fromSource);
    }
    if (options?.scope) {
      params.set("scope", options.scope);
    }
    if (typeof options?.rootIndex === "number") {
      params.set("rootIndex", String(options.rootIndex));
    }
    if (options?.rootPath) {
      params.set("rootPath", options.rootPath);
    }

    const response = await fetch(`/__du_lua/module?${params.toString()}`);
    if (!response.ok) {
      return null;
    }
    return await response.json() as ResolvedServerModule;
  } catch {
    return null;
  }
}

async function readDuLuaServerStatus(): Promise<DuLuaServerStatus | null> {
  try {
    const response = await fetch("/__du_lua/status");
    if (!response.ok) {
      return null;
    }
    return await response.json() as DuLuaServerStatus;
  } catch {
    return null;
  }
}

function makeUntitledName(sessions: SessionEntry[]): string {
  const used = new Set(sessions.map((session) => session.name));
  if (!used.has("Untitled")) {
    return "Untitled";
  }
  let index = 2;
  while (used.has(`Untitled ${index}`)) {
    index += 1;
  }
  return `Untitled ${index}`;
}

function hasGeneratedUntitledName(name: string): boolean {
  return /^Untitled(?: \d+)?$/.test(name.trim());
}

function fileLabel(session: SessionEntry | undefined): string {
  if (!session) {
    return "no session";
  }
  return session.linkedFileName ?? session.tempPath;
}

function sortSessions(entries: SessionEntry[]): SessionEntry[] {
  return sortSessionsByOrder(entries);
}

export default function App() {
  const bufferRef = useRef(new DrawBuffer({ imageLoadingEnabled: runtimeFlags.imageLoadingEnabled }));
  const canvasRef = useRef<CanvasHandle>(null);
  const committedBufferRef = useRef(bufferRef.current.createRenderSnapshot());
  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const githubUrlInputRef = useRef<HTMLInputElement>(null);
  const animTimerRef = useRef<number>(0);
  const statusTimerRef = useRef<number>(0);
  const persistTimerRef = useRef<number>(0);
  const autoRunTimerRef = useRef<number>(0);
  const displayRefreshRateRef = useRef<number | null>(null);
  const executionTokenRef = useRef(0);
  const sessionListRequestRef = useRef(0);
  const sessionLoadTokenRef = useRef(0);
  const persistPromiseRef = useRef<Promise<SessionEntry | null> | null>(null);
  const persistedCodeRef = useRef("");
  const prevResolutionRef = useRef({ width: DEFAULT_SETTINGS.canvasWidth, height: DEFAULT_SETTINGS.canvasHeight });
  const skipInitialAutoRunRef = useRef(true);
  const splitterDragRef = useRef(false);
  const sidebarResizeDragRef = useRef(false);
  const luaModuleSearchPathHandlesRef = useRef<Record<string, FileSystemDirectoryHandle>>({});
  const pendingLuaModuleSearchPathHandlesRef = useRef<Record<string, FileSystemDirectoryHandle>>({});
  const sessionsRef = useRef<SessionEntry[]>([]);
  const activeSessionIdRef = useRef("");
  const activeLuaModuleSearchPathsRef = useRef<LuaModuleSearchPathEntry[]>([]);
  const resolvedModulePathsRef = useRef<Record<string, string>>({});

  const resolveLuaModule = useCallback(async (moduleName: string, fromModule?: string | null) => {
    const activeSession = sessionsRef.current.find((session) => session.id === activeSessionIdRef.current);
    const fromSource = fromModule
      ? resolvedModulePathsRef.current[fromModule] ?? fromModule
      : activeSession?.linkedFileName ?? activeSession?.name ?? null;

    if ((moduleName.startsWith("./") || moduleName.startsWith("../")) && fromSource) {
      const relativeModule = await readLuaModuleFromServer(moduleName, { fromSource, scope: "relative" });
      if (relativeModule !== null) {
        resolvedModulePathsRef.current[moduleName] = relativeModule.resolvedPath;
        return relativeModule.source;
      }
    }

    for (const entry of activeLuaModuleSearchPathsRef.current) {
      if (entry.kind === "project") {
        const projectModule = await readLuaModuleFromServer(moduleName, { scope: "project" });
        if (projectModule !== null) {
          resolvedModulePathsRef.current[moduleName] = projectModule.resolvedPath;
          return projectModule.source;
        }
        continue;
      }

      if (entry.kind === "env") {
        const rootIndex = extractEnvRootIndex(entry.id);
        if (rootIndex === null) {
          continue;
        }

        const envModule = await readLuaModuleFromServer(moduleName, { scope: "du", rootIndex });
        if (envModule !== null) {
          resolvedModulePathsRef.current[moduleName] = envModule.resolvedPath;
          return envModule.source;
        }
        continue;
      }

      if (entry.kind === "manual") {
        const manualModule = await readLuaModuleFromServer(moduleName, { scope: "manual", rootPath: entry.label });
        if (manualModule !== null) {
          resolvedModulePathsRef.current[moduleName] = manualModule.resolvedPath;
          return manualModule.source;
        }
        continue;
      }

      const handle = luaModuleSearchPathHandlesRef.current[entry.id];
      if (!handle) {
        continue;
      }

      const readable = await ensureReadableDirectoryHandle(handle);
      if (!readable) {
        continue;
      }

      const localModule = await readLuaModuleFromRoot(handle, moduleName);
      if (localModule !== null) {
        resolvedModulePathsRef.current[moduleName] = `local:${entry.id}/${moduleName}`;
        return localModule;
      }
    }

    return null;
  }, []);

  const envRef = useRef(createLuaEnvironment(bufferRef.current, resolveLuaModule, runtimeFlags));

  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [code, setCode] = useState("");
  const [settings, setSettings] = useState<Settings>(safeLoadSettings);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [result, setResult] = useState<LuaExecResult | null>(null);
  const [running, setRunning] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [duLuaServerSearchRoots, setDuLuaServerSearchRoots] = useState<ServerSearchRoot[]>([]);
  const [splitterDragging, setSplitterDragging] = useState(false);
  const [editorDropActive, setEditorDropActive] = useState(false);
  const [githubImportOpen, setGithubImportOpen] = useState(false);
  const [githubImporting, setGithubImporting] = useState(false);
  const [githubUrlInput, setGithubUrlInput] = useState("");
  const [luaModuleSearchPathsOpen, setLuaModuleSearchPathsOpen] = useState(false);
  const [luaModuleSearchPathDraft, setLuaModuleSearchPathDraft] = useState<LuaModuleSearchPathEntry[]>([]);
  const [selectedAvailableSearchPathId, setSelectedAvailableSearchPathId] = useState("project");
  const [manualSearchPathInput, setManualSearchPathInput] = useState("");
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [canvasRotation, setCanvasRotation] = useState<CanvasRotation>(0);
  const settingsRef = useRef(settings);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [sessions, activeSessionId]
  );
  const directoryPickerSupport = useMemo(() => getDirectoryPickerSupport(), []);
  const activeChunkLabel = activeSession?.linkedFileName ?? activeSession?.tempPath ?? "session.lua";
  const activeTheme = getThemeOption(settings.themeId) ?? THEME_OPTIONS[0];
  const activeLuaModuleSearchPaths = useMemo(
    () => reconcileLuaModuleSearchPaths(settings.luaModuleSearchPaths, duLuaServerSearchRoots),
    [settings.luaModuleSearchPaths, duLuaServerSearchRoots],
  );
  const availableDefaultLuaModuleSearchPaths = useMemo(() => {
    const activeIds = new Set(luaModuleSearchPathDraft.map((entry) => entry.id));
    return defaultLuaModuleSearchPaths(duLuaServerSearchRoots).filter((entry) => !activeIds.has(entry.id));
  }, [duLuaServerSearchRoots, luaModuleSearchPathDraft]);
  const editorTheme = settings.darkEditor ? "vs-dark" : "vs";
  const activeErrorLine = useMemo(
    () => result && !result.success ? extractLuaErrorLine(result.error, activeChunkLabel) : null,
    [activeChunkLabel, result]
  );
  const statusIsError = Boolean(
    statusMsg
    && (statusMsg.startsWith("Error")
      || statusMsg.startsWith("Save failed")
      || statusMsg.startsWith("Reload failed")
      || statusMsg.startsWith("Import failed"))
  );
  const statusToastClassName = classNames(
    "w-auto max-w-[min(420px,calc(100%-24px))] rounded-xl px-3 py-2 font-mono text-xs shadow-lg backdrop-blur-md",
    statusIsError ? "alert alert-error" : "alert alert-success",
  );

  sessionsRef.current = sessions;
  activeSessionIdRef.current = activeSessionId;
  settingsRef.current = settings;
  activeLuaModuleSearchPathsRef.current = activeLuaModuleSearchPaths;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme.id);
  }, [activeTheme.id]);

  const commitBufferForRender = useCallback(() => {
    committedBufferRef.current = bufferRef.current.createRenderSnapshot();
    return committedBufferRef.current;
  }, []);

  const renderCommittedBuffer = useCallback((showGridOverride?: boolean) => {
    canvasRef.current?.render(committedBufferRef.current, { showGrid: showGridOverride ?? settings.showGrid });
  }, [settings.showGrid]);

  const commitAndRenderBuffer = useCallback((showGridOverride?: boolean) => {
    commitBufferForRender();
    renderCommittedBuffer(showGridOverride);
  }, [commitBufferForRender, renderCommittedBuffer]);

  const showStatus = useCallback((message: string) => {
    setStatusMsg(message);
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const applySessionUpdate = useCallback((updated: SessionEntry | null) => {
    if (!updated) {
      return;
    }
    setSessions((current) => {
      const index = current.findIndex((entry) => entry.id === updated.id);
      if (index === -1) {
        return sortSessions([...current, updated]);
      }

      const next = [...current];
      next[index] = updated;
      return next;
    });
  }, []);

  const refreshSessions = useCallback(async () => {
    const requestToken = sessionListRequestRef.current + 1;
    sessionListRequestRef.current = requestToken;
    const next = sortSessions(await listSessions());
    if (sessionListRequestRef.current !== requestToken) {
      return sessionsRef.current;
    }
    setSessions(next);
    return next;
  }, []);

  const clearAutoRunTimer = useCallback(() => {
    if (autoRunTimerRef.current) {
      clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = 0;
    }
  }, []);

  useEffect(() => {
    let frameId = 0;
    let previousTimestamp: number | null = null;
    let sampleCount = 0;
    let sampleTotalMs = 0;

    const sampleDisplayRate = (timestamp: number) => {
      if (document.visibilityState !== "visible") {
        previousTimestamp = null;
        sampleCount = 0;
        sampleTotalMs = 0;
        frameId = window.requestAnimationFrame(sampleDisplayRate);
        return;
      }

      if (previousTimestamp !== null) {
        const deltaMs = timestamp - previousTimestamp;
        if (deltaMs > 0 && deltaMs < 100) {
          sampleTotalMs += deltaMs;
          sampleCount += 1;

          if (sampleCount >= 30) {
            const measuredRefreshRate = 1000 / (sampleTotalMs / sampleCount);
            displayRefreshRateRef.current = mergeMeasuredDisplayFps(displayRefreshRateRef.current, measuredRefreshRate);
            sampleCount = 0;
            sampleTotalMs = 0;
          }
        }
      }

      previousTimestamp = timestamp;
      frameId = window.requestAnimationFrame(sampleDisplayRate);
    };

    frameId = window.requestAnimationFrame(sampleDisplayRate);
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const resetRuntime = useCallback(() => {
    clearAutoRunTimer();
    executionTokenRef.current += 1;
    resolvedModulePathsRef.current = {};
    void envRef.current.dispose();
    bufferRef.current.resetRuntimeState();
    committedBufferRef.current = bufferRef.current.createRenderSnapshot();
    envRef.current = createLuaEnvironment(bufferRef.current, resolveLuaModule, runtimeFlags);
    setResult(null);
    setRunning(false);
  }, [clearAutoRunTimer, resolveLuaModule]);

  const stopAnimation = useCallback(() => {
    clearAutoRunTimer();
    executionTokenRef.current += 1;
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = 0;
    }
    setAnimating(false);
    setRunning(false);
  }, [clearAutoRunTimer]);

  const stopExecution = useCallback(() => {
    stopAnimation();
    void envRef.current.dispose();
    envRef.current = createLuaEnvironment(bufferRef.current, resolveLuaModule, runtimeFlags);
    showStatus("Execution stopped");
  }, [resolveLuaModule, showStatus, stopAnimation]);

  const persistCodeNow = useCallback(async (sessionId: string, nextCode: string, markDirty: boolean) => {
    const persistPromise = (async () => {
      const updated = await writeSessionContent(sessionId, nextCode, { markDirty });
      persistedCodeRef.current = nextCode;
      applySessionUpdate(updated);
      return updated;
    })();

    persistPromiseRef.current = persistPromise;

    try {
      return await persistPromise;
    } finally {
      if (persistPromiseRef.current === persistPromise) {
        persistPromiseRef.current = null;
      }
    }
  }, [applySessionUpdate]);

  const flushActiveSession = useCallback(async () => {
    if (!activeSessionId) {
      return;
    }
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = 0;
    }
    if (persistPromiseRef.current) {
      await persistPromiseRef.current;
    }
    if (code === persistedCodeRef.current) {
      return;
    }
    await persistCodeNow(activeSessionId, code, true);
  }, [activeSessionId, code, persistCodeNow]);

  const loadSessionIntoEditor = useCallback(async (sessionId: string): Promise<string | null> => {
    const loadToken = sessionLoadTokenRef.current + 1;
    sessionLoadTokenRef.current = loadToken;
    setLoadingSession(true);
    resetRuntime();
    const nextCode = await readSessionContent(sessionId);
    if (sessionLoadTokenRef.current !== loadToken) {
      return null;
    }
    persistedCodeRef.current = nextCode;
    setActiveSessionId(sessionId);
    setCode(nextCode);
    setLoadingSession(false);
    return nextCode;
  }, [resetRuntime]);

  const clearActiveSession = useCallback(() => {
    sessionLoadTokenRef.current += 1;
    persistedCodeRef.current = "";
    setActiveSessionId("");
    setCode("");
    setLoadingSession(false);
  }, []);

  const executeCode = useCallback(async (codeToRun: string) => {
    const executionToken = executionTokenRef.current + 1;
    executionTokenRef.current = executionToken;
    setRunning(true);
    setStatusMsg(null);
    resolvedModulePathsRef.current = {};
    const buffer = bufferRef.current;
    const runStartedAt = performance.now();
    const getEffectiveFrameIntervalMs = () => getFrameIntervalMs(
      getEffectiveMaxFps(settingsRef.current.maxFPS, displayRefreshRateRef.current)
    );
    buffer.screen.width = settings.canvasWidth;
    buffer.screen.height = settings.canvasHeight;
    buffer.time = 0;
    buffer.deltaTime = 0;
    const executionLabel = activeChunkLabel;

    try {
      void envRef.current.dispose();
      buffer.resetRuntimeState();
      envRef.current = createLuaEnvironment(buffer, resolveLuaModule, runtimeFlags);
      buffer.screen.width = settings.canvasWidth;
      buffer.screen.height = settings.canvasHeight;

      const firstResult = await envRef.current.execute(codeToRun, { chunkLabel: executionLabel });
      if (executionTokenRef.current !== executionToken) {
        return;
      }
      setResult(firstResult);
      commitAndRenderBuffer();

      if (firstResult.success) {
        const animationInfo = firstResult.requestAnimFrames > 0 ? `, anim ${firstResult.requestAnimFrames}f` : "";
        const logInfo = firstResult.logs.length > 0 ? `, ${firstResult.logs.length} log(s)` : "";
        showStatus(`OK: ${buffer.GetRenderCost()} render cost${animationInfo}${logInfo}`);
      } else {
        showStatus(`Error: ${(firstResult.error ?? "unknown error").slice(0, 140)}`);
      }

      if (firstResult.success && firstResult.requestAnimFrames > 0) {
        setAnimating(true);
        let previousFrameStartedAt = runStartedAt;

        const scheduleNextAnimation = (requestedFrames: number, frameStartedAt: number) => {
          const delay = getAnimationDelayMs(
            performance.now(),
            frameStartedAt,
            requestedFrames,
            getEffectiveFrameIntervalMs()
          );
          animTimerRef.current = window.setTimeout(() => {
            animTimerRef.current = 0;
            void animate();
          }, delay);
        };

        const animate = async () => {
          const frameStartedAt = performance.now();
          const frameIntervalMs = getEffectiveFrameIntervalMs();
          buffer.time = getRuntimeTimeSeconds(frameStartedAt, runStartedAt);
          buffer.deltaTime = getFrameDeltaSeconds(frameStartedAt, previousFrameStartedAt, frameIntervalMs);
          previousFrameStartedAt = frameStartedAt;
          buffer.screen.width = settings.canvasWidth;
          buffer.screen.height = settings.canvasHeight;

          const frameResult = await envRef.current.execute(codeToRun, { chunkLabel: executionLabel });
          if (executionTokenRef.current !== executionToken) {
            return;
          }
          setResult(frameResult);
          commitAndRenderBuffer();

          if (frameResult.success && frameResult.requestAnimFrames > 0) {
            scheduleNextAnimation(frameResult.requestAnimFrames, frameStartedAt);
          } else {
            animTimerRef.current = 0;
            setAnimating(false);
          }
        };
        scheduleNextAnimation(firstResult.requestAnimFrames, runStartedAt);
      } else {
        setAnimating(false);
      }
    } catch (error: unknown) {
      if (executionTokenRef.current !== executionToken) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setResult({ success: false, error: message, logs: [], output: "", requestAnimFrames: 0 });
      showStatus(`Error: ${message.slice(0, 140)}`);
      setAnimating(false);
    } finally {
      if (executionTokenRef.current === executionToken) {
        setRunning(false);
      }
    }
  }, [activeChunkLabel, commitAndRenderBuffer, settings.canvasHeight, settings.canvasWidth, showStatus]);

  const runCurrentCode = useCallback((nextCode?: string) => {
    stopAnimation();
    void executeCode(nextCode ?? code);
  }, [code, executeCode, stopAnimation]);

  const handleRun = useCallback(() => {
    if (animating || running) {
      stopExecution();
      return;
    }
    runCurrentCode();
  }, [animating, runCurrentCode, running, stopExecution]);

  const handleToggleLayout = useCallback(() => {
    setSettings((current) => ({
      ...current,
      layoutOrientation: current.layoutOrientation === "vertical" ? "horizontal" : "vertical",
    }));
  }, []);

  const handleEditorFontStep = useCallback((delta: number) => {
    setSettings((current) => ({
      ...current,
      editorFontSize: clamp(current.editorFontSize + delta, 8, 28),
    }));
  }, []);

  const handleResetLayout = useCallback(() => {
    setSettings((current) => ({
      ...current,
      layoutOrientation: DEFAULT_SETTINGS.layoutOrientation,
      horizontalSplit: DEFAULT_SETTINGS.horizontalSplit,
      verticalSplit: DEFAULT_SETTINGS.verticalSplit,
      editorFontSize: DEFAULT_SETTINGS.editorFontSize,
    }));
    showStatus("Layout reset to defaults");
  }, [showStatus]);

  const handleRotateCanvasLeft = useCallback(() => {
    setCanvasRotation((current) => rotateCanvasBy(current, -90));
  }, []);

  const handleRotateCanvasRight = useCallback(() => {
    setCanvasRotation((current) => rotateCanvasBy(current, 90));
  }, []);

  const handleResetCanvasRotation = useCallback(() => {
    setCanvasRotation(0);
  }, []);

  const importFilesIntoSessions = useCallback(async (inputFiles: FileList | File[]) => {
    const files = Array.from(inputFiles);
    if (files.length === 0) {
      return;
    }

    const acceptedFiles: Array<{ file: File; safeFileName: string; sessionName: string }> = [];
    const rejectedReasons: string[] = [];

    for (const file of files) {
      const validation = validateImportedSessionFile(file);
      if (!validation.ok) {
        rejectedReasons.push(`${file.name || "(unnamed file)"}: ${validation.reason}`);
        continue;
      }

      acceptedFiles.push({
        file,
        safeFileName: validation.value.safeFileName,
        sessionName: validation.value.sessionName,
      });
    }

    if (acceptedFiles.length === 0) {
      const reason = rejectedReasons[0] ?? "no importable files";
      showStatus(`Import blocked: ${reason.slice(0, 140)}`);
      return;
    }

    try {
      await flushActiveSession();
      stopAnimation();
      resetRuntime();
      setResult(null);
      setEditorDropActive(false);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();

      const loadedFiles = await Promise.all(acceptedFiles.map(async ({ file, safeFileName, sessionName }) => ({
        file,
        safeFileName,
        sessionName,
        text: await file.text(),
      })));

      let lastCreatedId = "";
      for (const { safeFileName, sessionName, text } of loadedFiles) {
        const created = await createSession({
          name: sessionName,
          linkedFileName: safeFileName,
          initialContent: text,
        });
        lastCreatedId = created.id;
      }

      await refreshSessions();
      if (lastCreatedId) {
        const loadedCode = await loadSessionIntoEditor(lastCreatedId);
        if (loadedCode === null) {
          return;
        }
      }

      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();

      const skippedLabel = rejectedReasons.length > 0
        ? ` Skipped ${rejectedReasons.length} blocked file${rejectedReasons.length === 1 ? "" : "s"}.`
        : "";

      if (loadedFiles.length === 1) {
        showStatus(`Imported new session: ${loadedFiles[0]?.safeFileName}.${skippedLabel}`.trim());
      } else {
        showStatus(`Imported ${loadedFiles.length} files into new sessions.${skippedLabel}`.trim());
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showStatus(`Import failed: ${message.slice(0, 140)}`);
    }
  }, [flushActiveSession, loadSessionIntoEditor, refreshSessions, resetRuntime, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const handleImportFilePick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      void importFilesIntoSessions(files);
    }
    event.target.value = "";
  }, [importFilesIntoSessions]);

  const handleEditorDragEnter = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (code.trim().length !== 0) {
      return;
    }
    event.preventDefault();
    setEditorDropActive(true);
  }, [code]);

  const handleEditorDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (code.trim().length !== 0) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, [code]);

  const handleEditorDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setEditorDropActive(false);
  }, []);

  const handleEditorDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setEditorDropActive(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      void importFilesIntoSessions(files);
    }
  }, [importFilesIntoSessions]);

  const closeGitHubImport = useCallback(() => {
    setGithubImportOpen(false);
    setGithubUrlInput("");
  }, []);

  const importGitHubSession = useCallback(async (rawUrl: string) => {
    const validation = validateGitHubLuaUrl(rawUrl);
    if (!validation.ok) {
      showStatus(`Import blocked: ${validation.reason}`);
      return;
    }

    setGithubImporting(true);

    try {
      const { safeFileName, sessionName, remoteSourceUrl } = validation.value;
      const source = await readRemoteSessionSource(remoteSourceUrl, safeFileName);

      await flushActiveSession();
      stopAnimation();
      resetRuntime();
      setResult(null);
      setEditorDropActive(false);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();

      const created = await createSession({
        name: sessionName,
        linkedFileName: safeFileName,
        remoteSourceUrl,
        initialContent: source.content,
      });

      await refreshSessions();
      const loadedCode = await loadSessionIntoEditor(created.id);
      if (loadedCode === null) {
        return;
      }

      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();
      closeGitHubImport();
      showStatus(`Imported GitHub script: ${safeFileName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showStatus(`Import failed: ${message.slice(0, 140)}`);
    } finally {
      setGithubImporting(false);
    }
  }, [closeGitHubImport, flushActiveSession, loadSessionIntoEditor, refreshSessions, resetRuntime, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const handleGitHubUrlSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void importGitHubSession(githubUrlInput);
  }, [githubUrlInput, importGitHubSession]);

  const handleSplitterPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    splitterDragRef.current = true;
    setSplitterDragging(true);
    event.preventDefault();
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeSession) {
      return;
    }
    setSaving(true);
    try {
      await flushActiveSession();
      const saved = await saveSessionToLocal(activeSession.id, code, activeSession.name || "render-script");
      if (saved) {
        if (hasGeneratedUntitledName(activeSession.name)) {
          await renameSession(activeSession.id, sessionNameFromFileName(saved.fileName));
        }
        await refreshSessions();
        const modeLabel = saved.mode === "file-handle" ? "saved" : "downloaded";
        showStatus(`File ${modeLabel}: ${saved.fileName}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showStatus(`Save failed: ${message.slice(0, 140)}`);
    } finally {
      setSaving(false);
    }
  }, [activeSession, code, flushActiveSession, refreshSessions, showStatus]);

  const handleConfirmReload = useCallback(async () => {
    if (!activeSession) {
      setReloadConfirmOpen(false);
      return;
    }

    setReloadConfirmOpen(false);
    setReloading(true);

    try {
      stopAnimation();

      let nextCode: string | null = null;
      let sourceLabel = "";

      const linked = await readSessionFromLinkedFile(activeSession.id);
      if (linked) {
        nextCode = linked.content;
        sourceLabel = linked.fileName;
      }

      if (nextCode === null) {
        showStatus("Reload unavailable: no source file is attached to this session");
        return;
      }

      const updated = await writeSessionContent(activeSession.id, nextCode, { markDirty: false });
      applySessionUpdate(updated);
      const loadedCode = await loadSessionIntoEditor(activeSession.id);
      if (loadedCode === null) {
        return;
      }
      setResult(null);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();
      showStatus(`Reloaded from source: ${sourceLabel}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showStatus(`Reload failed: ${message.slice(0, 140)}`);
    } finally {
      setReloading(false);
    }
  }, [activeSession, applySessionUpdate, loadSessionIntoEditor, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const closeLuaModuleSearchPathsDialog = useCallback(() => {
    pendingLuaModuleSearchPathHandlesRef.current = {};
    setLuaModuleSearchPathDraft([]);
    setSelectedAvailableSearchPathId("project");
    setManualSearchPathInput("");
    setLuaModuleSearchPathsOpen(false);
  }, []);

  const openLuaModuleSearchPathsDialog = useCallback(() => {
    const nextDraft = activeLuaModuleSearchPaths;
    setLuaModuleSearchPathDraft(nextDraft);
    pendingLuaModuleSearchPathHandlesRef.current = {};
    setSelectedAvailableSearchPathId(availableDefaultLuaModuleSearchPaths[0]?.id ?? "project");
    setManualSearchPathInput("");
    setLuaModuleSearchPathsOpen(true);
  }, [activeLuaModuleSearchPaths, availableDefaultLuaModuleSearchPaths]);

  const moveLuaModuleSearchPathDraftEntry = useCallback((index: number, direction: -1 | 1) => {
    setLuaModuleSearchPathDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [entry] = next.splice(index, 1);
      next.splice(nextIndex, 0, entry);
      return next;
    });
  }, []);

  const handleAddDefaultLuaModuleSearchPath = useCallback(() => {
    const entry = defaultLuaModuleSearchPaths(duLuaServerSearchRoots).find((candidate) => candidate.id === selectedAvailableSearchPathId);
    if (!entry) {
      return;
    }

    setLuaModuleSearchPathDraft((current) => current.some((candidate) => candidate.id === entry.id) ? current : [...current, entry]);
    const remaining = defaultLuaModuleSearchPaths(duLuaServerSearchRoots)
      .filter((candidate) => candidate.id !== entry.id)
      .filter((candidate) => !luaModuleSearchPathDraft.some((draftEntry) => draftEntry.id === candidate.id));
    setSelectedAvailableSearchPathId(remaining[0]?.id ?? "project");
  }, [duLuaServerSearchRoots, luaModuleSearchPathDraft, selectedAvailableSearchPathId]);

  const handleAddManualLuaModuleSearchPath = useCallback(() => {
    const normalizedLabel = normalizeSearchPathLabel(manualSearchPathInput);
    if (!normalizedLabel) {
      showStatus("Enter a folder path first");
      return;
    }

    const normalizedKey = normalizeSearchPathKey(normalizedLabel);
    if (luaModuleSearchPathDraft.some((entry) => entry.kind === "manual" && normalizeSearchPathKey(entry.label) === normalizedKey)) {
      showStatus(`Manual search path already added: ${normalizedLabel}`);
      return;
    }

    const nextId = `manual:${nextSearchPathId()}`;
    setLuaModuleSearchPathDraft((current) => [...current, createManualSearchPathEntry(nextId, normalizedLabel)]);
    setManualSearchPathInput("");
    showStatus(`Manual search path added: ${normalizedLabel}`);
  }, [luaModuleSearchPathDraft, manualSearchPathInput, showStatus]);

  const handleAddLocalLuaModuleSearchPath = useCallback(async () => {
    const picker = window as Window & {
      showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    };

    if (!picker.showDirectoryPicker) {
      showStatus(directoryPickerSupport.unavailableReason ?? "Local folder access is not available here");
      return;
    }

    try {
      const handle = await picker.showDirectoryPicker({ mode: "read" });
      const readable = await ensureReadableDirectoryHandle(handle);
      if (!readable) {
        showStatus("Folder access was not granted");
        return;
      }

      const nextId = `local:${nextSearchPathId()}`;
      pendingLuaModuleSearchPathHandlesRef.current[nextId] = handle;
      setLuaModuleSearchPathDraft((current) => [...current, createLocalSearchPathEntry(nextId, handle.name)]);
      showStatus(`Local search path added: ${handle.name}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("abort")) {
        return;
      }
      showStatus(`Folder pick failed: ${message.slice(0, 140)}`);
    }
  }, [directoryPickerSupport.unavailableReason, showStatus]);

  const handleSaveLuaModuleSearchPaths = useCallback(async () => {
    const previousLocalIds = new Set(activeLuaModuleSearchPaths.filter((entry) => entry.kind === "local").map((entry) => entry.id));
    const nextLocalIds = new Set(luaModuleSearchPathDraft.filter((entry) => entry.kind === "local").map((entry) => entry.id));

    for (const localId of previousLocalIds) {
      if (!nextLocalIds.has(localId)) {
        await deleteLuaModuleSearchPathHandle(localId);
        delete luaModuleSearchPathHandlesRef.current[localId];
      }
    }

    for (const entry of luaModuleSearchPathDraft) {
      if (entry.kind !== "local") {
        continue;
      }

      const pendingHandle = pendingLuaModuleSearchPathHandlesRef.current[entry.id];
      if (pendingHandle) {
        await setLuaModuleSearchPathHandle(entry.id, pendingHandle);
        luaModuleSearchPathHandlesRef.current[entry.id] = pendingHandle;
      }
    }

    setSettings((current) => ({ ...current, luaModuleSearchPaths: luaModuleSearchPathDraft }));
    closeLuaModuleSearchPathsDialog();
    resetRuntime();
    showStatus(`Saved ${luaModuleSearchPathDraft.length} module search path${luaModuleSearchPathDraft.length === 1 ? "" : "s"}`);
  }, [activeLuaModuleSearchPaths, closeLuaModuleSearchPathsDialog, luaModuleSearchPathDraft, resetRuntime, showStatus]);

  const handleResetLuaModuleSearchPathsToDefaults = useCallback(() => {
    const nextDefaults = defaultLuaModuleSearchPaths(duLuaServerSearchRoots);
    setLuaModuleSearchPathDraft(nextDefaults);
    setSelectedAvailableSearchPathId("project");
    setManualSearchPathInput("");
  }, [duLuaServerSearchRoots]);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) {
      return;
    }
    stopAnimation();
    await flushActiveSession();
    const loadedCode = await loadSessionIntoEditor(sessionId);
    if (loadedCode === null) {
      return;
    }
    bufferRef.current.screen.width = settings.canvasWidth;
    bufferRef.current.screen.height = settings.canvasHeight;
    setResult(null);
    commitAndRenderBuffer();
    showStatus("Session loaded");
  }, [activeSessionId, flushActiveSession, loadSessionIntoEditor, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const handleNewSession = useCallback(async () => {
    await flushActiveSession();
    stopAnimation();
    const created = await createSession({ name: makeUntitledName(sessions), initialContent: "" });
    await refreshSessions();
    const loadedCode = await loadSessionIntoEditor(created.id);
    if (loadedCode === null) {
      return;
    }
    bufferRef.current.screen.width = settings.canvasWidth;
    bufferRef.current.screen.height = settings.canvasHeight;
    setResult(null);
    commitAndRenderBuffer();
    showStatus(`New temp session: ${created.name}`);
  }, [flushActiveSession, loadSessionIntoEditor, refreshSessions, sessions, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const deletingActive = sessionId === activeSessionId;
    const deletedIndex = sessionsRef.current.findIndex((session) => session.id === sessionId);
    if (!deletingActive) {
      await flushActiveSession();
    }
    stopAnimation();
    if (deletingActive) {
      resetRuntime();
      setResult(null);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();
    }
    await deleteSession(sessionId);
    const remaining = await refreshSessions();
    if (remaining.length === 0) {
      clearActiveSession();
      setResult(null);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();
      showStatus("Session deleted");
      return;
    }
    if (deletingActive) {
      const nextIndex = deletedIndex >= 0 ? Math.min(deletedIndex, remaining.length - 1) : 0;
      const next = remaining[nextIndex];
      if (!next) {
        return;
      }
      const nextCode = await loadSessionIntoEditor(next.id);
      if (nextCode === null) {
        return;
      }
      void executeCode(nextCode);
    }
  }, [activeSessionId, clearActiveSession, executeCode, flushActiveSession, loadSessionIntoEditor, refreshSessions, resetRuntime, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const handleRenameSession = useCallback(async (sessionId: string, name: string) => {
    const updated = await renameSession(sessionId, name);
    applySessionUpdate(updated);
  }, [applySessionUpdate]);

  const handleReorderSessions = useCallback(async (draggedId: string, targetId: string, placement: SessionDropPlacement) => {
    const requestToken = sessionListRequestRef.current + 1;
    sessionListRequestRef.current = requestToken;
    setSessions((current) => moveSessionInOrder(current, draggedId, targetId, placement));
    const reordered = moveSessionInOrder(sessionsRef.current, draggedId, targetId, placement);
    const persisted = await saveSessionOrder(reordered.map((session) => session.id));
    if (sessionListRequestRef.current !== requestToken) {
      return;
    }
    setSessions(persisted);
  }, []);

  const handleSidebarResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    sidebarResizeDragRef.current = true;
  }, []);

  useEffect(() => {
    safeSaveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (sidebarResizeDragRef.current) {
        setSettings((current) => ({
          ...current,
          sidebarWidth: clamp(event.clientX, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
        }));
        return;
      }

      if (!splitterDragRef.current || !workspaceRef.current) {
        return;
      }

      const rect = workspaceRef.current.getBoundingClientRect();
      const ratio = settings.layoutOrientation === "horizontal"
        ? 1 - ((event.clientX - rect.left) / rect.width)
        : (event.clientY - rect.top) / rect.height;

      setSettings((current) => ({
        ...current,
        horizontalSplit: current.layoutOrientation === "horizontal" ? clamp(ratio, 0.25, 0.75) : current.horizontalSplit,
        verticalSplit: current.layoutOrientation === "vertical" ? clamp(ratio, 0.25, 0.75) : current.verticalSplit,
      }));
    };

    const stopDragging = () => {
      sidebarResizeDragRef.current = false;
      splitterDragRef.current = false;
      setSplitterDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [settings.layoutOrientation]);

  useEffect(() => {
    if (!bootstrapped || !activeSessionId || loadingSession) {
      return;
    }
    if (code === persistedCodeRef.current) {
      return;
    }
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      void persistCodeNow(activeSessionId, code, true);
    }, 300);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [activeSessionId, bootstrapped, code, loadingSession, persistCodeNow]);

  useEffect(() => {
    if (!bootstrapped || !settings.autoRun || loadingSession || !activeSessionId) {
      return;
    }
    if (skipInitialAutoRunRef.current) {
      skipInitialAutoRunRef.current = false;
      return;
    }
    if (autoRunTimerRef.current) {
      clearTimeout(autoRunTimerRef.current);
    }
    autoRunTimerRef.current = window.setTimeout(() => {
      runCurrentCode();
    }, 500);
    return () => {
      if (autoRunTimerRef.current) {
        clearTimeout(autoRunTimerRef.current);
      }
    };
  }, [activeSessionId, bootstrapped, code, loadingSession, runCurrentCode, settings.autoRun]);

  useEffect(() => {
    if (!bootstrapped) {
      prevResolutionRef.current = { width: settings.canvasWidth, height: settings.canvasHeight };
      return;
    }
    if (
      prevResolutionRef.current.width === settings.canvasWidth
      && prevResolutionRef.current.height === settings.canvasHeight
    ) {
      return;
    }
    prevResolutionRef.current = { width: settings.canvasWidth, height: settings.canvasHeight };
    bufferRef.current.screen.width = settings.canvasWidth;
    bufferRef.current.screen.height = settings.canvasHeight;
    if (result) {
      runCurrentCode();
    } else {
      commitAndRenderBuffer();
    }
  }, [bootstrapped, result, runCurrentCode, settings.canvasHeight, settings.canvasWidth, settings.showGrid]);

  useEffect(() => {
    if (result) {
      commitAndRenderBuffer();
    }
  }, [result, settings.showGrid]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      const duLuaServerStatus = await readDuLuaServerStatus();
      if (cancelled) {
        return;
      }
      const serverRoots = duLuaServerStatus?.searchRoots ?? [];
      setDuLuaServerSearchRoots(serverRoots);

      const reconciledPaths = reconcileLuaModuleSearchPaths(settingsRef.current.luaModuleSearchPaths, serverRoots);
      const localHandles: Record<string, FileSystemDirectoryHandle> = {};
      const nextPaths: LuaModuleSearchPathEntry[] = [];

      for (const entry of reconciledPaths) {
        if (entry.kind !== "local") {
          nextPaths.push(entry);
          continue;
        }

        const handle = await getLuaModuleSearchPathHandle(entry.id);
        if (!handle) {
          continue;
        }

        localHandles[entry.id] = handle;
        nextPaths.push(entry);
      }

      const legacyDuLuaRootHandle = await getDuLuaRootHandle();
      if (cancelled) {
        return;
      }
      if (legacyDuLuaRootHandle) {
        const legacyEntryId = "local:legacy-du-root";
        if (!nextPaths.some((entry) => entry.id === legacyEntryId)) {
          localHandles[legacyEntryId] = legacyDuLuaRootHandle;
          await setLuaModuleSearchPathHandle(legacyEntryId, legacyDuLuaRootHandle);
          nextPaths.push(createLocalSearchPathEntry(legacyEntryId, legacyDuLuaRootHandle.name));
        }
      }

      luaModuleSearchPathHandlesRef.current = localHandles;
      setSettings((current) => {
        const currentPaths = reconcileLuaModuleSearchPaths(current.luaModuleSearchPaths, serverRoots);
        if (sameLuaModuleSearchPaths(currentPaths, nextPaths)) {
          return current;
        }
        return {
          ...current,
          luaModuleSearchPaths: nextPaths,
        };
      });

      const knownSessions = await listSessions();
      if (cancelled) {
        return;
      }
      sessionListRequestRef.current += 1;
      setSessions(sortSessions(knownSessions));
      const first = knownSessions[0];
      if (!first) {
        clearActiveSession();
        setLoadingSession(false);
        setBootstrapped(true);
        return;
      }
      const nextCode = await loadSessionIntoEditor(first.id);
      if (cancelled) {
        return;
      }
      if (nextCode === null) {
        return;
      }
      setBootstrapped(true);
      persistedCodeRef.current = nextCode;
      setResult(null);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      commitAndRenderBuffer();
    };
    void initialize();
    return () => {
      cancelled = true;
      executionTokenRef.current += 1;
      sessionLoadTokenRef.current += 1;
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = 0;
      }
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = 0;
      }
      if (autoRunTimerRef.current) {
        clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = 0;
      }
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = 0;
      }
    };
  }, []);

  const currentFileLabel = fileLabel(activeSession);
  const primaryFileLabel = activeSession?.name || "untitled";
  const showSecondaryFileLabel = Boolean(activeSession && currentFileLabel !== primaryFileLabel);
  const reloadSourceLabel = activeSession?.remoteSourceUrl
    ? `${activeSession.linkedFileName ?? "the current script"} on GitHub`
    : activeSession?.linkedFileName ?? "the source file";
  const canReload = Boolean(activeSession?.linkedFileName || activeSession?.remoteSourceUrl);
  const canRunToggle = !saving && !loadingSession && !!activeSession;
  const runButtonShowsStop = animating || running;
  const isHorizontalLayout = settings.layoutOrientation === "horizontal";
  const activeSplit = isHorizontalLayout ? settings.horizontalSplit : settings.verticalSplit;
  const showEmptyEditorDropzone = Boolean(activeSession) && code.trim().length === 0;
  const useCenteredSingleLineHeader = !isHorizontalLayout && !showSecondaryFileLabel;
  const editorHeaderClassName = classNames(
    "flex flex-wrap border-b border-base-300 bg-base-100 px-5 py-3",
    isHorizontalLayout
      ? "items-start justify-between gap-x-5 gap-y-3"
      : useCenteredSingleLineHeader
        ? "items-center justify-start gap-x-4 gap-y-2"
        : "items-start justify-start gap-x-4 gap-y-2"
  );
  const editorTitleBlockClassName = classNames(
    "flex min-w-0",
    isHorizontalLayout
      ? "flex-[1_1_220px] flex-col gap-1"
      : useCenteredSingleLineHeader
        ? "max-w-full flex-[0_1_auto] items-center self-stretch"
        : "max-w-full flex-[0_1_auto] flex-col gap-1"
  );
  const editorActionsClassName = classNames(
    "flex min-w-0 flex-wrap items-center justify-start",
    isHorizontalLayout ? "flex-[1_1_320px] gap-3.5" : "flex-[0_1_auto] gap-3"
  );
  const workspaceClassName = classNames("flex min-h-0 flex-1 overflow-hidden", isHorizontalLayout ? "flex-row" : "flex-col");
  const canvasPaneStyle = isHorizontalLayout
    ? { flex: `0 0 ${activeSplit * 100}%`, minWidth: 320, order: 2 }
    : { flex: `0 0 ${activeSplit * 100}%`, minHeight: 240 };
  const editorPaneClassName = classNames(
    "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
    isHorizontalLayout ? "order-0 border-r border-base-300" : "border-t border-base-300"
  );
  const splitterClassName = classNames(
    "relative shrink-0 bg-base-200",
    splitterDragging && "bg-primary",
    isHorizontalLayout
      ? "order-1 flex w-3 cursor-col-resize items-center justify-center border-l border-r border-l-base-300 border-r-base-100"
      : "flex h-3 cursor-row-resize items-center justify-center border-t border-b border-t-base-300 border-b-base-100"
  );
  const splitterGripClassName = isHorizontalLayout
    ? "h-9 w-1 rounded-full bg-primary opacity-65"
    : "h-1 w-9 rounded-full bg-primary opacity-65";
  const editorDropzoneOverlayClassName = classNames(
    "pointer-events-none absolute inset-5 flex items-center justify-center rounded-2xl",
    editorDropActive && "bg-primary/12 ring-2 ring-inset ring-primary/45"
  );

  useEffect(() => {
    bufferRef.current.onAssetsChanged = () => {
      renderCommittedBuffer();
    };
    return () => {
      bufferRef.current.onAssetsChanged = null;
    };
  }, [settings.showGrid]);

  useEffect(() => {
    if (githubImportOpen) {
      githubUrlInputRef.current?.focus();
    }
  }, [githubImportOpen]);

  useEffect(() => {
    codeEditorRef.current?.highlightErrorLine(activeErrorLine);
  }, [activeErrorLine]);

  useEffect(() => {
    codeEditorRef.current?.highlightErrorLine(null);
  }, [activeSessionId, code]);

  return (
    <div className="rs-theme-root flex h-screen w-screen overflow-hidden bg-base-300 text-base-content" data-theme={activeTheme.id}>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => { void handleSelectSession(id); }}
        onNewSession={() => { void handleNewSession(); }}
        onOpenFile={handleImportFilePick}
        onOpenGitHubImport={() => setGithubImportOpen(true)}
        onImportFiles={(files) => { void importFilesIntoSessions(files); }}
        onDeleteSession={(id) => { void handleDeleteSession(id); }}
        onRenameSession={(id, name) => { void handleRenameSession(id, name); }}
        onReorderSessions={(draggedId, targetId, placement) => { void handleReorderSessions(draggedId, targetId, placement); }}
        settings={settings}
        onSettingsChange={setSettings}
        luaModuleSearchPaths={activeLuaModuleSearchPaths}
        onOpenLuaModuleSearchPaths={openLuaModuleSearchPathsDialog}
        width={settings.sidebarWidth}
        onResizePointerDown={handleSidebarResizePointerDown}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={workspaceRef} className={workspaceClassName}>
          <div style={canvasPaneStyle} className="flex min-h-0 min-w-0 overflow-hidden bg-base-300">
            <div className="relative flex h-full w-full items-center justify-center">
              {statusMsg && !luaModuleSearchPathsOpen ? (
                <div
                  className={`pointer-events-none absolute bottom-3 left-1/2 z-3 -translate-x-1/2 ${statusToastClassName}`}
                >
                  {statusMsg}
                </div>
              ) : null}
              <Canvas
                ref={canvasRef}
                width={settings.canvasWidth}
                height={settings.canvasHeight}
                showGrid={settings.showGrid}
                showFps={settings.showFPS}
                themeMode={activeTheme.mode}
                rotationDegrees={canvasRotation}
                onRotateLeft={handleRotateCanvasLeft}
                onRotateRight={handleRotateCanvasRight}
                onResetRotation={handleResetCanvasRotation}
              />
            </div>
          </div>

          <div
            role="separator"
            aria-orientation={isHorizontalLayout ? "vertical" : "horizontal"}
            aria-label="Resize canvas and editor"
            onPointerDown={handleSplitterPointerDown}
            className={splitterClassName}
          >
            <div className={splitterGripClassName} />
          </div>

          <div className={editorPaneClassName}>
            <div className={editorHeaderClassName}>
              <div className={editorTitleBlockClassName}>
                <span className={classNames("truncate font-mono text-sm font-medium text-base-content", useCenteredSingleLineHeader && "leading-none")}>
                  {primaryFileLabel}
                  {activeSession?.dirty ? " *" : ""}
                </span>
                {showSecondaryFileLabel ? (
                  <span className="truncate font-mono text-xs text-base-content/60">
                    {currentFileLabel}
                  </span>
                ) : null}
              </div>
              <div className={editorActionsClassName}>
                <div className="flex items-center gap-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleEditorFontStep(-1)}
                    className="btn btn-ghost btn-sm btn-square"
                    title="Decrease editor font"
                  >
                    A-
                  </button>
                  <span className="badge badge-outline badge-sm min-w-11 justify-center font-mono">{settings.editorFontSize}px</span>
                  <button
                    type="button"
                    onClick={() => handleEditorFontStep(1)}
                    className="btn btn-ghost btn-sm btn-square"
                    title="Increase editor font"
                  >
                    A+
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLayout}
                  className="btn btn-ghost btn-sm btn-square"
                  title={isHorizontalLayout ? "Switch to vertical layout" : "Switch to horizontal layout"}
                >
                  {isHorizontalLayout ? "V" : "H"}
                </button>
                <button
                  type="button"
                  onClick={handleResetLayout}
                  className="btn btn-ghost btn-sm btn-square"
                  title="Reset layout split and editor font size"
                >
                  R
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave(); }}
                  className="btn btn-ghost btn-sm btn-square"
                  disabled={saving || !activeSession}
                  title="Save session to local file"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setReloadConfirmOpen(true)}
                  className="btn btn-ghost btn-sm btn-square"
                  disabled={!canReload || reloading || loadingSession}
                  title="Reload this session from its source"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  className={classNames(
                    "btn btn-sm min-w-24 gap-2",
                    runButtonShowsStop ? "btn-error" : "btn-primary"
                  )}
                  disabled={!canRunToggle}
                  title={runButtonShowsStop ? "Stop the running execution" : "Run the current script (Ctrl+Enter)"}
                >
                  {loadingSession ? "Loading..." : saving ? "Saving..." : runButtonShowsStop ? (
                    <>
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
                        </svg>
                      </span>
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                          <path d="M8 6.5v11l8.5-5.5z" fill="currentColor" />
                        </svg>
                      </span>
                      <span>Run</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div
              className="relative flex-1 overflow-hidden"
              onDragEnter={handleEditorDragEnter}
              onDragOver={handleEditorDragOver}
              onDragLeave={handleEditorDragLeave}
              onDrop={handleEditorDrop}
            >
              <input
                ref={importInputRef}
                type="file"
                multiple
                accept=".lua,.txt,text/plain"
                onChange={handleImportFileChange}
                className="hidden"
              />
              <CodeEditor ref={codeEditorRef} value={code} onChange={setCode} onRun={handleRun} fontSize={settings.editorFontSize} theme={editorTheme} />
              {showEmptyEditorDropzone ? (
                <div className={editorDropzoneOverlayClassName}>
                  <div className="pointer-events-auto flex w-[min(480px,82%)] flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-base-100/90 px-7 py-6 text-center shadow-2xl">
                    <div className="text-xl font-bold text-base-content">Drop one or more Lua files here</div>
                    <div className="max-w-96 text-sm leading-6 text-base-content/65">
                      Each imported file creates a new session named after the file. You can also paste a GitHub blob or raw URL to a single `.lua` file.
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleImportFilePick}
                        className="btn btn-primary btn-sm"
                        title="Choose one or more Lua files to import as new sessions"
                      >
                        Choose Files
                      </button>
                      <button
                        type="button"
                        onClick={() => setGithubImportOpen(true)}
                        className="btn btn-outline btn-sm gap-2"
                        title="Paste a GitHub URL to a Lua file"
                      >
                        <GitHubIcon className="h-4 w-4" />
                        <span>GitHub</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {result && !result.success ? (
          <div className="whitespace-pre-wrap border-t border-error/30 bg-error/15 px-4 py-2 font-mono text-sm text-error">{result.error}</div>
        ) : null}

        {result && result.logs.length > 0 ? (
          <div className="max-h-18 overflow-auto border-t border-success/25 bg-success/10 px-4 py-2 font-mono text-xs text-success">
            {result.logs.map((line, index) => (
              <div key={index} className="py-px">{line}</div>
            ))}
          </div>
        ) : null}
      </div>

      {luaModuleSearchPathsOpen ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <div className="text-lg font-bold text-base-content">Module Search Paths</div>
            <div className="mt-2 text-sm leading-6 text-base-content/70">
              Configure the ordered list of module search paths. The first matching module wins. Defaults from `.env.local` are visible here instead of staying implicit.
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {luaModuleSearchPathDraft.length > 0 ? luaModuleSearchPathDraft.map((entry, index) => (
                <div key={entry.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-base-300 bg-base-100 px-3 py-3">
                  <span className="badge badge-outline min-w-18 justify-center">
                    {entry.kind === "project" ? "Project" : entry.kind === "env" ? "Default" : entry.kind === "manual" ? "Manual" : "Local"}
                  </span>
                  <input
                    readOnly
                    value={entry.label}
                    className="input input-bordered input-sm min-w-[16rem] flex-1 font-mono text-[0.85rem]"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square"
                      onClick={() => moveLuaModuleSearchPathDraftEntry(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square"
                      onClick={() => moveLuaModuleSearchPathDraftEntry(index, 1)}
                      disabled={index === luaModuleSearchPathDraft.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-error"
                      onClick={() => setLuaModuleSearchPathDraft((current) => current.filter((candidate) => candidate.id !== entry.id))}
                      title="Remove path"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-base-300 px-4 py-5 text-sm text-base-content/60">
                  No search paths configured. Add a default path, a manual folder, or a local folder.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-base-300 bg-base-200/60 px-4 py-4">
              <div className="text-sm font-medium text-base-content">Add Path</div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="form-control min-w-[16rem] flex-1">
                  <span className="mb-1 text-xs text-base-content/60">Available default path</span>
                  <select
                    value={selectedAvailableSearchPathId}
                    onChange={(event) => setSelectedAvailableSearchPathId(event.target.value)}
                    className="select select-bordered select-sm"
                    disabled={availableDefaultLuaModuleSearchPaths.length === 0}
                  >
                    {availableDefaultLuaModuleSearchPaths.length > 0 ? availableDefaultLuaModuleSearchPaths.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.label}</option>
                    )) : (
                      <option value="">No more default paths available</option>
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddDefaultLuaModuleSearchPath}
                  disabled={availableDefaultLuaModuleSearchPaths.length === 0}
                >
                  Add Default
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="form-control min-w-[16rem] flex-1">
                  <span className="mb-1 text-xs text-base-content/60">Manual folder path</span>
                  <input
                    type="text"
                    value={manualSearchPathInput}
                    onChange={(event) => setManualSearchPathInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddManualLuaModuleSearchPath();
                      }
                    }}
                    className="input input-bordered input-sm"
                    placeholder="C:/MyDualUniverse/Game/data/lua"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddManualLuaModuleSearchPath}
                >
                  Add Manual Folder
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => { void handleAddLocalLuaModuleSearchPath(); }}
                  disabled={!directoryPickerSupport.available}
                  title={directoryPickerSupport.available ? "Add a local folder" : directoryPickerSupport.unavailableReason ?? "Local folder access is unavailable"}
                >
                  Add Local Folder
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleResetLuaModuleSearchPathsToDefaults}
                >
                  Reset to Defaults
                </button>
              </div>
              {!directoryPickerSupport.available ? (
                <div className="mt-3 text-xs leading-5 text-warning">
                  {directoryPickerSupport.unavailableReason}
                </div>
              ) : null}
            </div>

            <div className="modal-action items-center justify-between gap-3">
              <div className="min-h-[2.5rem] flex-1">
                {statusMsg ? (
                  <div className={`pointer-events-none ml-auto ${statusToastClassName}`}>
                    {statusMsg}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeLuaModuleSearchPathsDialog}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleSaveLuaModuleSearchPaths(); }}
                className="btn btn-primary"
              >
                Save Paths
              </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {githubImportOpen ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-base-200 text-base-content">
                <GitHubIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-lg font-bold text-base-content">Import from GitHub</div>
                <div className="text-sm text-base-content/65">Paste a GitHub blob or raw URL to a single `.lua` file.</div>
              </div>
            </div>
            <form className="mt-5 flex flex-col gap-3" onSubmit={handleGitHubUrlSubmit}>
              <label className="input input-bordered flex h-auto items-center gap-2 px-3 py-2">
                <GitHubIcon className="h-4 w-4 shrink-0 text-base-content/60" />
                <input
                  ref={githubUrlInputRef}
                  type="url"
                  value={githubUrlInput}
                  onChange={(event) => setGithubUrlInput(event.target.value)}
                  placeholder="https://github.com/user/repo/blob/main/screen.lua"
                  className="w-full bg-transparent text-sm outline-none"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={githubImporting}
                />
              </label>
              <div className="text-xs leading-5 text-base-content/55">
                Supported: `github.com/.../blob/.../*.lua` and `raw.githubusercontent.com/.../*.lua`
              </div>
              <div className="modal-action mt-1">
                <button
                  type="button"
                  onClick={closeGitHubImport}
                  className="btn btn-ghost"
                  disabled={githubImporting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={githubImporting || githubUrlInput.trim().length === 0}
                >
                  {githubImporting ? "Loading..." : "Load URL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {reloadConfirmOpen ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="text-lg font-bold text-base-content">Reload Session?</div>
            <div className="mt-3 text-sm leading-6 text-base-content/70">
              {activeSession?.dirty
                ? `This replaces the current editor content with ${reloadSourceLabel}. Unsaved changes in this session will be lost.`
                : `This reloads the current session from ${reloadSourceLabel}.`}
            </div>
            <div className="modal-action">
              <button
                type="button"
                onClick={() => setReloadConfirmOpen(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmReload(); }}
                className="btn btn-primary"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
