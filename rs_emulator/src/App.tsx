import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { Canvas, type CanvasHandle } from "./components/Canvas";
import { Sidebar, DEFAULT_SETTINGS, getResolutionPreset, RESOLUTION_PRESETS, type SessionEntry, type Settings } from "./components/Sidebar";
import { DrawBuffer, createLuaEnvironment, type LuaExecResult } from "./emulator";
import EXAMPLE_CODE from "../examples/example1.lua?raw";
import {
  clearDuLuaRootHandle,
  createSession,
  deleteSession,
  getDuLuaRootHandle,
  listSessions,
  readSessionFromLinkedFile,
  readSessionContent,
  renameSession,
  saveSessionToLocal,
  setDuLuaRootHandle,
  writeSessionContent,
} from "./storage/sessionStore";

const DEFAULT_MAX_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / DEFAULT_MAX_FPS;
const BUNDLED_LUA_FILES = import.meta.glob("../examples/**/*.lua", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
const BUNDLED_LUA_LOADERS = Object.fromEntries(
  Object.entries(BUNDLED_LUA_FILES).map(([filePath, loader]) => [normalizeBundledLuaPath(filePath), loader])
) as Record<string, () => Promise<string>>;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "").toLowerCase();
}

function normalizeBundledLuaPath(filePath: string): string {
  return normalizePath(filePath.replace(/^\.\.\/examples\//, ""));
}

function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

function joinPath(left: string, right: string): string {
  if (!left) {
    return normalizePath(right);
  }
  return normalizePath(`${left}/${right}`);
}

function normalizeSettings(raw: unknown): Settings {
  const value = (raw && typeof raw === "object") ? raw as Partial<Settings> & { resolution?: number; panelSplit?: number } : {};
  let resolutionPreset = value.resolutionPreset ?? DEFAULT_SETTINGS.resolutionPreset;
  let canvasWidth = value.canvasWidth;
  let canvasHeight = value.canvasHeight;

  if ((!canvasWidth || !canvasHeight) && typeof value.resolution === "number") {
    canvasWidth = value.resolution;
    canvasHeight = value.resolution;
    resolutionPreset = "square";
  }

  const preset = getResolutionPreset(resolutionPreset) ?? RESOLUTION_PRESETS[0];
  const resolvedWidth = typeof canvasWidth === "number" && canvasWidth > 0 ? canvasWidth : preset.width;
  const resolvedHeight = typeof canvasHeight === "number" && canvasHeight > 0 ? canvasHeight : preset.height;

  const legacySplit = typeof value.panelSplit === "number" ? value.panelSplit : DEFAULT_SETTINGS.horizontalSplit;

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    resolutionPreset,
    canvasWidth: resolvedWidth,
    canvasHeight: resolvedHeight,
    layoutOrientation: value.layoutOrientation === "horizontal" ? "horizontal" : "vertical",
    horizontalSplit: clamp(typeof value.horizontalSplit === "number" ? value.horizontalSplit : legacySplit, 0.25, 0.75),
    verticalSplit: clamp(typeof value.verticalSplit === "number" ? value.verticalSplit : legacySplit, 0.25, 0.75),
    editorFontSize: clamp(typeof value.editorFontSize === "number" ? value.editorFontSize : DEFAULT_SETTINGS.editorFontSize, 12, 28),
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

async function readLuaModuleFromServer(moduleName: string): Promise<string | null> {
  try {
    const response = await fetch(`/__du_lua/module?name=${encodeURIComponent(moduleName)}`);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

async function readDuLuaServerStatus(): Promise<{ configured: boolean; rootPath: string | null } | null> {
  try {
    const response = await fetch("/__du_lua/status");
    if (!response.ok) {
      return null;
    }
    return await response.json() as { configured: boolean; rootPath: string | null };
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

function fileLabel(session: SessionEntry | undefined): string {
  if (!session) {
    return "no session";
  }
  return session.linkedFileName ?? session.tempPath;
}

function buildLocalModuleCandidates(moduleName: string): string[] {
  const normalized = moduleName.replace(/\\/g, "/").trim();
  if (!normalized) {
    return [];
  }

  const dotPath = normalized.split(".").filter(Boolean).join("/");
  const candidates = new Set<string>();
  const variants = [normalized, dotPath].filter(Boolean);

  for (const variant of variants) {
    candidates.add(variant);
    if (!variant.endsWith(".lua")) {
      candidates.add(`${variant}.lua`);
      candidates.add(`${variant}/init.lua`);
    }
    const slashIndex = variant.lastIndexOf("/");
    if (slashIndex >= 0) {
      const base = variant.slice(slashIndex + 1);
      if (base) {
        candidates.add(base);
        if (!base.endsWith(".lua")) {
          candidates.add(`${base}.lua`);
          candidates.add(`${base}/init.lua`);
        }
      }
    }
  }

  return [...candidates].map((value) => normalizePath(value));
}

function findBundledLuaPathByLabel(label: string): string | null {
  const normalized = normalizePath(label);
  if (!normalized) {
    return null;
  }

  if (BUNDLED_LUA_LOADERS[normalized]) {
    return normalized;
  }

  const slashIndex = normalized.lastIndexOf("/");
  const suffix = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  for (const bundledPath of Object.keys(BUNDLED_LUA_LOADERS)) {
    if (bundledPath === normalized || bundledPath.endsWith(`/${suffix}`)) {
      return bundledPath;
    }
  }

  return null;
}

function findBundledLuaPathForSession(session: SessionEntry | undefined): string | null {
  if (!session) {
    return null;
  }

  return findBundledLuaPathByLabel(session.linkedFileName ?? "")
    ?? findBundledLuaPathByLabel(session.name);
}

function findBundledModulePath(moduleName: string, fromPath?: string | null): string | null {
  const candidates = buildLocalModuleCandidates(moduleName);

  if (fromPath) {
    const baseDir = dirname(fromPath);
    for (const candidate of candidates) {
      const relativePath = joinPath(baseDir, candidate);
      if (BUNDLED_LUA_LOADERS[relativePath]) {
        return relativePath;
      }
    }
  }

  for (const candidate of candidates) {
    if (BUNDLED_LUA_LOADERS[candidate]) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    for (const bundledPath of Object.keys(BUNDLED_LUA_LOADERS)) {
      if (bundledPath.endsWith(`/${candidate}`)) {
        return bundledPath;
      }
    }
  }

  return null;
}

function sortSessions(entries: SessionEntry[]): SessionEntry[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export default function App() {
  const bufferRef = useRef(new DrawBuffer());
  const canvasRef = useRef<CanvasHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number>(0);
  const animTimerRef = useRef<number>(0);
  const statusTimerRef = useRef<number>(0);
  const persistTimerRef = useRef<number>(0);
  const autoRunTimerRef = useRef<number>(0);
  const persistedCodeRef = useRef("");
  const prevResolutionRef = useRef({ width: DEFAULT_SETTINGS.canvasWidth, height: DEFAULT_SETTINGS.canvasHeight });
  const skipInitialAutoRunRef = useRef(true);
  const splitterDragRef = useRef(false);
  const duLuaRootHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const sessionsRef = useRef<SessionEntry[]>([]);
  const activeSessionIdRef = useRef("");
  const resolvedModulePathsRef = useRef<Record<string, string>>({});

  const resolveLuaModule = useCallback(async (moduleName: string, fromModule?: string | null) => {
    const activeSession = sessionsRef.current.find((session) => session.id === activeSessionIdRef.current);
    const fromPath = fromModule
      ? resolvedModulePathsRef.current[fromModule] ?? null
      : findBundledLuaPathForSession(activeSession);

    const bundledRelativePath = findBundledModulePath(moduleName, fromPath);
    if (bundledRelativePath) {
      resolvedModulePathsRef.current[moduleName] = bundledRelativePath;
      return BUNDLED_LUA_LOADERS[bundledRelativePath]();
    }

    const serverModule = await readLuaModuleFromServer(moduleName);
    if (serverModule !== null) {
      return serverModule;
    }

    const root = duLuaRootHandleRef.current;
    if (!root) {
      return null;
    }

    const readable = await ensureReadableDirectoryHandle(root);
    if (!readable) {
      return null;
    }

    return readLuaModuleFromRoot(root, moduleName);
  }, []);

  const envRef = useRef(createLuaEnvironment(bufferRef.current, resolveLuaModule));

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
  const [duLuaServerRootPath, setDuLuaServerRootPath] = useState<string | null>(null);
  const [splitterDragging, setSplitterDragging] = useState(false);
  const [editorDropActive, setEditorDropActive] = useState(false);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
  const [reloading, setReloading] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [sessions, activeSessionId]
  );

  sessionsRef.current = sessions;
  activeSessionIdRef.current = activeSessionId;

  const duLuaRootStatus = duLuaServerRootPath
    ? duLuaServerRootPath
    : settings.duLuaRootName
      ? settings.duLuaRootName
      : "No DU Lua include path configured.";

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
    setSessions((current) => sortSessions([updated, ...current.filter((entry) => entry.id !== updated.id)]));
  }, []);

  const refreshSessions = useCallback(async () => {
    const next = await listSessions();
    setSessions(sortSessions(next));
    return next;
  }, []);

  const resetRuntime = useCallback(() => {
    resolvedModulePathsRef.current = {};
    bufferRef.current.resetRuntimeState();
    envRef.current = createLuaEnvironment(bufferRef.current, resolveLuaModule);
  }, [resolveLuaModule]);

  const stopAnimation = useCallback(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = 0;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    setAnimating(false);
  }, []);

  const persistCodeNow = useCallback(async (sessionId: string, nextCode: string, markDirty: boolean) => {
    const updated = await writeSessionContent(sessionId, nextCode, { markDirty });
    persistedCodeRef.current = nextCode;
    applySessionUpdate(updated);
    return updated;
  }, [applySessionUpdate]);

  const flushActiveSession = useCallback(async () => {
    if (!activeSessionId) {
      return;
    }
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = 0;
    }
    if (code === persistedCodeRef.current) {
      return;
    }
    await persistCodeNow(activeSessionId, code, true);
  }, [activeSessionId, code, persistCodeNow]);

  const loadSessionIntoEditor = useCallback(async (sessionId: string) => {
    setLoadingSession(true);
    resetRuntime();
    const nextCode = await readSessionContent(sessionId);
    persistedCodeRef.current = nextCode;
    setActiveSessionId(sessionId);
    setCode(nextCode);
    setLoadingSession(false);
    return nextCode;
  }, [resetRuntime]);

  const executeCode = useCallback(async (codeToRun: string) => {
    setRunning(true);
    setStatusMsg(null);
    resolvedModulePathsRef.current = {};
    const buffer = bufferRef.current;
    buffer.screen.width = settings.canvasWidth;
    buffer.screen.height = settings.canvasHeight;

    try {
      const firstResult = await envRef.current.execute(codeToRun);
      setResult(firstResult);
      canvasRef.current?.render(buffer, { showGrid: settings.showGrid });

      if (firstResult.success) {
        const animationInfo = firstResult.requestAnimFrames > 0 ? `, anim ${firstResult.requestAnimFrames}f` : "";
        const logInfo = firstResult.logs.length > 0 ? `, ${firstResult.logs.length} log(s)` : "";
        showStatus(`OK: ${buffer.commands.length} draw call(s)${animationInfo}${logInfo}`);
      } else {
        showStatus(`Error: ${(firstResult.error ?? "unknown error").slice(0, 140)}`);
      }

      if (firstResult.requestAnimFrames > 0) {
        setAnimating(true);
        let lastFrameStartedAt = performance.now();

        const animate = async () => {
          lastFrameStartedAt = performance.now();
          buffer.time = performance.now() / 1000;
          buffer.deltaTime = 1 / 60;
          buffer.screen.width = settings.canvasWidth;
          buffer.screen.height = settings.canvasHeight;

          const frameResult = await envRef.current.execute(codeToRun);
          setResult(frameResult);
          canvasRef.current?.render(buffer, { showGrid: settings.showGrid });

          if (buffer.requestAnimFrames > 0) {
            const elapsedSinceFrameStart = performance.now() - lastFrameStartedAt;
            const delay = Math.max(0, FRAME_INTERVAL_MS - elapsedSinceFrameStart);
            animTimerRef.current = window.setTimeout(() => {
              animTimerRef.current = 0;
              animFrameRef.current = requestAnimationFrame(() => {
                void animate();
              });
            }, delay);
          } else {
            animFrameRef.current = 0;
            animTimerRef.current = 0;
            setAnimating(false);
          }
        };
        animTimerRef.current = window.setTimeout(() => {
          animTimerRef.current = 0;
          animFrameRef.current = requestAnimationFrame(() => {
            void animate();
          });
        }, FRAME_INTERVAL_MS);
      } else {
        setAnimating(false);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setResult({ success: false, error: message, logs: [], output: "", requestAnimFrames: 0 });
      showStatus(`Error: ${message.slice(0, 140)}`);
      setAnimating(false);
    } finally {
      setRunning(false);
    }
  }, [settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus]);

  const runCurrentCode = useCallback((nextCode?: string) => {
    stopAnimation();
    void executeCode(nextCode ?? code);
  }, [code, executeCode, stopAnimation]);

  const handleRun = useCallback(() => {
    if (animating) {
      stopAnimation();
      showStatus("Animation stopped");
      return;
    }
    runCurrentCode();
  }, [animating, runCurrentCode, showStatus, stopAnimation]);

  const handleToggleLayout = useCallback(() => {
    setSettings((current) => ({
      ...current,
      layoutOrientation: current.layoutOrientation === "vertical" ? "horizontal" : "vertical",
    }));
  }, []);

  const handleEditorFontStep = useCallback((delta: number) => {
    setSettings((current) => ({
      ...current,
      editorFontSize: clamp(current.editorFontSize + delta, 12, 28),
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

  const importFilesIntoSessions = useCallback(async (inputFiles: FileList | File[]) => {
    const files = Array.from(inputFiles);
    if (files.length === 0) {
      return;
    }

    try {
      const loadedFiles = await Promise.all(files.map(async (file) => ({
        file,
        text: await file.text(),
      })));

      await flushActiveSession();
      stopAnimation();
      setResult(null);
      setEditorDropActive(false);

      let lastCreatedId = "";
      for (const { file, text } of loadedFiles) {
        const created = await createSession({
          name: file.name,
          linkedFileName: file.name,
          initialContent: text,
        });
        lastCreatedId = created.id;
      }

      await refreshSessions();
      if (lastCreatedId) {
        await loadSessionIntoEditor(lastCreatedId);
      }

      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });

      if (loadedFiles.length === 1) {
        showStatus(`Imported new session: ${loadedFiles[0]?.file.name}`);
      } else {
        showStatus(`Imported ${loadedFiles.length} files into new sessions`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showStatus(`Import failed: ${message.slice(0, 140)}`);
    }
  }, [flushActiveSession, loadSessionIntoEditor, refreshSessions, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

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

      const bundledPath = findBundledLuaPathForSession(activeSession);
      let nextCode: string | null = null;
      let sourceLabel = "";

      if (bundledPath) {
        nextCode = await BUNDLED_LUA_LOADERS[bundledPath]();
        sourceLabel = bundledPath;
      } else {
        const linked = await readSessionFromLinkedFile(activeSession.id);
        if (linked) {
          nextCode = linked.content;
          sourceLabel = linked.fileName;
        }
      }

      if (nextCode === null) {
        showStatus("Reload unavailable: no source file is attached to this session");
        return;
      }

      const updated = await writeSessionContent(activeSession.id, nextCode, { markDirty: false });
      applySessionUpdate(updated);
      await loadSessionIntoEditor(activeSession.id);
      setResult(null);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });
      showStatus(`Reloaded from source: ${sourceLabel}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      showStatus(`Reload failed: ${message.slice(0, 140)}`);
    } finally {
      setReloading(false);
    }
  }, [activeSession, applySessionUpdate, loadSessionIntoEditor, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const handlePickDuLuaRoot = useCallback(async () => {
    const picker = window as Window & {
      showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    };

    if (!picker.showDirectoryPicker) {
      showStatus("Folder picker is not available in this browser");
      return;
    }

    try {
      const handle = await picker.showDirectoryPicker({ mode: "read" });
      const readable = await ensureReadableDirectoryHandle(handle);
      if (!readable) {
        showStatus("Folder access was not granted");
        return;
      }

      duLuaRootHandleRef.current = handle;
      await setDuLuaRootHandle(handle);
      setSettings((current) => ({ ...current, duLuaRootName: handle.name }));
      resetRuntime();
      showStatus(`DU include folder set: ${handle.name}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("abort")) {
        return;
      }
      showStatus(`Folder pick failed: ${message.slice(0, 140)}`);
    }
  }, [resetRuntime, showStatus]);

  const handleClearDuLuaRoot = useCallback(async () => {
    duLuaRootHandleRef.current = null;
    await clearDuLuaRootHandle();
    setSettings((current) => ({ ...current, duLuaRootName: "" }));
    resetRuntime();
    showStatus("DU include folder cleared");
  }, [resetRuntime, showStatus]);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) {
      return;
    }
    await flushActiveSession();
    stopAnimation();
    await loadSessionIntoEditor(sessionId);
    bufferRef.current.screen.width = settings.canvasWidth;
    bufferRef.current.screen.height = settings.canvasHeight;
    setResult(null);
    canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });
    showStatus("Session loaded");
  }, [activeSessionId, flushActiveSession, loadSessionIntoEditor, settings.canvasHeight, settings.canvasWidth, settings.showGrid, showStatus, stopAnimation]);

  const handleNewSession = useCallback(async () => {
    await flushActiveSession();
    stopAnimation();
    const created = await createSession({ name: makeUntitledName(sessions), initialContent: "" });
    await refreshSessions();
    await loadSessionIntoEditor(created.id);
    setResult(null);
    showStatus(`New temp session: ${created.name}`);
  }, [flushActiveSession, loadSessionIntoEditor, refreshSessions, sessions, showStatus, stopAnimation]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const deletingActive = sessionId === activeSessionId;
    if (!deletingActive) {
      await flushActiveSession();
    }
    stopAnimation();
    await deleteSession(sessionId);
    const remaining = await refreshSessions();
    if (remaining.length === 0) {
      const replacement = await createSession({ name: "Untitled", initialContent: "" });
      const nextSessions = await refreshSessions();
      await loadSessionIntoEditor(replacement.id);
      setResult(null);
      showStatus("Session deleted; created a new temp session");
      if (!nextSessions.length) {
        return;
      }
      return;
    }
    if (deletingActive) {
      const next = remaining[0];
      const nextCode = await loadSessionIntoEditor(next.id);
      void executeCode(nextCode);
    }
  }, [activeSessionId, executeCode, flushActiveSession, loadSessionIntoEditor, refreshSessions, showStatus, stopAnimation]);

  const handleRenameSession = useCallback(async (sessionId: string, name: string) => {
    const updated = await renameSession(sessionId, name);
    applySessionUpdate(updated);
  }, [applySessionUpdate]);

  useEffect(() => {
    safeSaveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
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
      canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });
    }
  }, [bootstrapped, result, runCurrentCode, settings.canvasHeight, settings.canvasWidth, settings.showGrid]);

  useEffect(() => {
    if (result) {
      canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });
    }
  }, [result, settings.showGrid]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      const duLuaServerStatus = await readDuLuaServerStatus();
      if (duLuaServerStatus?.configured) {
        setDuLuaServerRootPath(duLuaServerStatus.rootPath);
      }

      const duLuaRootHandle = await getDuLuaRootHandle();
      if (duLuaRootHandle) {
        duLuaRootHandleRef.current = duLuaRootHandle;
        setSettings((current) => ({
          ...current,
          duLuaRootName: current.duLuaRootName || duLuaRootHandle.name,
        }));
      }

      let knownSessions = await listSessions();
      if (knownSessions.length === 0) {
        await createSession({ name: "Example 1", initialContent: EXAMPLE_CODE });
        knownSessions = await listSessions();
      }
      if (cancelled) {
        return;
      }
      setSessions(sortSessions(knownSessions));
      const first = knownSessions[0];
      if (!first) {
        setLoadingSession(false);
        setBootstrapped(true);
        return;
      }
      const nextCode = await loadSessionIntoEditor(first.id);
      if (cancelled) {
        return;
      }
      setBootstrapped(true);
      persistedCodeRef.current = nextCode;
      setResult(null);
      bufferRef.current.screen.width = settings.canvasWidth;
      bufferRef.current.screen.height = settings.canvasHeight;
      canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });
    };
    void initialize();
    return () => {
      cancelled = true;
      stopAnimation();
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
      if (autoRunTimerRef.current) {
        clearTimeout(autoRunTimerRef.current);
      }
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, [loadSessionIntoEditor, stopAnimation]);

  const currentFileLabel = fileLabel(activeSession);
  const reloadSourceLabel = activeSession ? (findBundledLuaPathForSession(activeSession) ?? activeSession.linkedFileName ?? "the source file") : "the source file";
  const canReload = Boolean(activeSession && (findBundledLuaPathForSession(activeSession) || activeSession.linkedFileName));
  const canRunToggle = !saving && !loadingSession && !!activeSession;
  const isHorizontalLayout = settings.layoutOrientation === "horizontal";
  const activeSplit = isHorizontalLayout ? settings.horizontalSplit : settings.verticalSplit;
  const showEmptyEditorDropzone = Boolean(activeSession) && code.trim().length === 0;
  const canvasPaneStyle = isHorizontalLayout
    ? { ...styles.canvasPane, flex: `0 0 ${activeSplit * 100}%`, minWidth: 320, order: 2 }
    : { ...styles.canvasPane, flex: `0 0 ${activeSplit * 100}%`, minHeight: 240 };
  const editorPaneStyle = isHorizontalLayout
    ? { ...styles.editorPane, borderTop: "none", borderLeft: "none", borderRight: "1px solid #2a2a4a", order: 0 }
    : styles.editorPane;
  const workspaceStyle = isHorizontalLayout
    ? { ...styles.workspace, flexDirection: "row" as const }
    : styles.workspace;
  const splitterStyle = isHorizontalLayout
    ? {
        ...styles.splitter,
        width: 12,
        order: 1,
        cursor: "col-resize",
        borderLeft: "1px solid #2a2a4a",
        borderRight: "1px solid #151528",
      }
    : {
        ...styles.splitter,
        height: 12,
        cursor: "row-resize",
        borderTop: "1px solid #2a2a4a",
        borderBottom: "1px solid #151528",
      };

  useEffect(() => {
    bufferRef.current.onAssetsChanged = () => {
      canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });
    };
    return () => {
      bufferRef.current.onAssetsChanged = null;
    };
  }, [settings.showGrid]);

  return (
    <div style={styles.root}>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => { void handleSelectSession(id); }}
        onNewSession={() => { void handleNewSession(); }}
        onDeleteSession={(id) => { void handleDeleteSession(id); }}
        onRenameSession={(id, name) => { void handleRenameSession(id, name); }}
        settings={settings}
        onSettingsChange={setSettings}
        duLuaRootStatus={duLuaRootStatus}
        onPickDuLuaRoot={() => { void handlePickDuLuaRoot(); }}
        onClearDuLuaRoot={() => { void handleClearDuLuaRoot(); }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />

      <div style={styles.main}>
        <div ref={workspaceRef} style={workspaceStyle}>
          <div style={canvasPaneStyle}>
            <div style={styles.canvasContainer}>
              <Canvas
                ref={canvasRef}
                width={settings.canvasWidth}
                height={settings.canvasHeight}
                showGrid={settings.showGrid}
                darkBg={settings.darkBg}
                showFps={settings.showFPS}
              />
            </div>
          </div>

          <div
            role="separator"
            aria-orientation={isHorizontalLayout ? "vertical" : "horizontal"}
            aria-label="Resize canvas and editor"
            onPointerDown={handleSplitterPointerDown}
            style={{
              ...splitterStyle,
              ...(splitterDragging ? styles.splitterActive : {}),
            }}
          >
            <div style={isHorizontalLayout ? styles.splitterGripVertical : styles.splitterGripHorizontal} />
          </div>

          <div style={editorPaneStyle}>
            <div style={styles.editorHeader}>
              <div style={styles.editorTitleGroup}>
                <span style={styles.editorTitle}>{activeSession?.name || "RenderScript.lua"}</span>
                <span style={styles.fileLabel}>
                  {currentFileLabel}
                  {activeSession?.dirty ? " *" : ""}
                </span>
              </div>
              <div style={styles.editorActions}>
                {statusMsg ? (
                  <span
                    style={{
                      ...styles.statusMsg,
                      color: statusMsg.startsWith("Error") || statusMsg.startsWith("Save failed") ? "#f88" : "#8f8",
                    }}
                  >
                    {statusMsg}
                  </span>
                ) : null}
                <div style={styles.editorFontControls}>
                  <button
                    type="button"
                    onClick={() => handleEditorFontStep(-1)}
                    style={styles.iconBtn}
                    title="Decrease editor font"
                  >
                    A-
                  </button>
                  <span style={styles.editorFontLabel}>{settings.editorFontSize}px</span>
                  <button
                    type="button"
                    onClick={() => handleEditorFontStep(1)}
                    style={styles.iconBtn}
                    title="Increase editor font"
                  >
                    A+
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLayout}
                  style={styles.iconBtn}
                  title={isHorizontalLayout ? "Switch to vertical layout" : "Switch to horizontal layout"}
                >
                  {isHorizontalLayout ? "V" : "H"}
                </button>
                <button
                  type="button"
                  onClick={handleResetLayout}
                  style={styles.iconBtn}
                  title="Reset layout split and editor font size"
                >
                  R
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave(); }}
                  style={{ ...styles.iconBtn, opacity: saving ? 0.6 : 1 }}
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
                  style={{ ...styles.iconBtn, opacity: (canReload && !reloading) ? 1 : 0.55 }}
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
                  style={{
                    ...styles.runBtn,
                    ...(animating ? styles.stopBtn : {}),
                    opacity: (!canRunToggle && !animating) ? 0.7 : 1,
                  }}
                  disabled={!canRunToggle}
                  title={animating ? "Stop the running animation" : "Run the current script"}
                >
                  {loadingSession ? "Loading..." : saving ? "Saving..." : running ? "Running..." : animating ? "Stop" : "Run  Ctrl+Enter"}
                </button>
              </div>
            </div>
            <div
              style={styles.editorBody}
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
                style={styles.hiddenInput}
              />
              <CodeEditor value={code} onChange={setCode} onRun={handleRun} fontSize={settings.editorFontSize} />
              {showEmptyEditorDropzone ? (
                <div style={{
                  ...styles.editorDropzoneOverlay,
                  ...(editorDropActive ? styles.editorDropzoneOverlayActive : {}),
                }}>
                  <div style={styles.editorDropzoneCard}>
                    <div style={styles.editorDropzoneTitle}>Drop Lua files here</div>
                    <div style={styles.editorDropzoneText}>Each imported file creates a new session named after the file.</div>
                    <button
                      type="button"
                      onClick={handleImportFilePick}
                      style={styles.dropzoneButton}
                      title="Choose one or more Lua files to import as new sessions"
                    >
                      Choose Files
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {result && !result.success ? (
          <div style={styles.errorBar}>{result.error}</div>
        ) : null}

        {result && result.logs.length > 0 ? (
          <div style={styles.logBar}>
            {result.logs.map((line, index) => (
              <div key={index} style={styles.logLine}>{line}</div>
            ))}
          </div>
        ) : null}
      </div>

      {reloadConfirmOpen ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalTitle}>Reload Session?</div>
            <div style={styles.modalText}>
              {activeSession?.dirty
                ? `This replaces the current editor content with ${reloadSourceLabel}. Unsaved changes in this session will be lost.`
                : `This reloads the current session from ${reloadSourceLabel}.`}
            </div>
            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setReloadConfirmOpen(false)}
                style={styles.modalSecondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmReload(); }}
                style={styles.modalPrimaryButton}
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

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: "#0d0d1a",
    color: "#e0e0e0",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  workspace: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  canvasPane: {
    display: "flex",
    minHeight: 0,
    minWidth: 0,
    padding: 16,
    background: "#111122",
    overflow: "hidden",
  },
  canvasContainer: {
    position: "relative",
    display: "flex",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  splitter: {
    flexShrink: 0,
    background: "linear-gradient(180deg, #181a2b 0%, #232845 100%)",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  splitterActive: {
    background: "linear-gradient(180deg, #2b3562 0%, #3a4b85 100%)",
  },
  splitterGripVertical: {
    width: 4,
    height: 36,
    borderRadius: 999,
    background: "rgba(151, 163, 255, 0.55)",
    boxShadow: "0 0 0 1px rgba(12, 14, 26, 0.35)",
  },
  splitterGripHorizontal: {
    width: 36,
    height: 4,
    borderRadius: 999,
    background: "rgba(151, 163, 255, 0.55)",
    boxShadow: "0 0 0 1px rgba(12, 14, 26, 0.35)",
  },
  editorPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderTop: "1px solid #2a2a4a",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    background: "#1a1a2e",
    borderBottom: "1px solid #2a2a4a",
    gap: 16,
  },
  editorTitleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  editorTitle: {
    fontSize: 13,
    color: "#ddd",
    fontFamily: "monospace",
  },
  fileLabel: {
    fontSize: 11,
    color: "#7f84ab",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: 380,
  },
  editorActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  editorFontControls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  editorFontLabel: {
    minWidth: 38,
    textAlign: "center" as const,
    fontSize: 11,
    color: "#9ea5d6",
    fontFamily: "monospace",
  },
  statusMsg: {
    fontSize: 12,
    fontFamily: "monospace",
    maxWidth: 360,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  iconBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid #444a72",
    background: "#242845",
    color: "#d7daf7",
    cursor: "pointer",
  },
  runBtn: {
    background: "#6c6cf0",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    minWidth: 124,
  },
  stopBtn: {
    background: "#c14f5f",
  },
  editorBody: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  hiddenInput: {
    display: "none",
  },
  editorDropzoneOverlay: {
    position: "absolute",
    inset: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  editorDropzoneOverlayActive: {
    background: "rgba(77, 96, 190, 0.12)",
    boxShadow: "inset 0 0 0 2px rgba(125, 145, 255, 0.45)",
    borderRadius: 14,
  },
  editorDropzoneCard: {
    width: "min(420px, 78%)",
    padding: "24px 28px",
    borderRadius: 16,
    background: "rgba(19, 22, 40, 0.92)",
    border: "1px dashed rgba(125, 145, 255, 0.55)",
    boxShadow: "0 24px 48px rgba(0, 0, 0, 0.35)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    textAlign: "center" as const,
    pointerEvents: "auto",
  },
  editorDropzoneTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#eef1ff",
  },
  editorDropzoneText: {
    fontSize: 13,
    color: "#a8afd8",
    lineHeight: 1.5,
    maxWidth: 320,
  },
  dropzoneButton: {
    marginTop: 6,
    border: "1px solid #6674d9",
    background: "#4b5cc7",
    color: "#fff",
    padding: "9px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBar: {
    background: "#3a1111",
    color: "#f88",
    padding: "8px 16px",
    fontSize: 13,
    fontFamily: "monospace",
    borderTop: "1px solid #5a2222",
    maxHeight: 80,
    overflow: "auto",
  },
  logBar: {
    background: "#111a11",
    color: "#8f8",
    padding: "8px 16px",
    fontSize: 12,
    fontFamily: "monospace",
    borderTop: "1px solid #223a22",
    maxHeight: 72,
    overflow: "auto",
  },
  logLine: {
    padding: "1px 0",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(8, 10, 20, 0.62)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 1000,
  },
  modalCard: {
    width: "min(420px, calc(100vw - 32px))",
    background: "#161a30",
    border: "1px solid #404975",
    borderRadius: 14,
    boxShadow: "0 28px 70px rgba(0, 0, 0, 0.45)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#eef1ff",
  },
  modalText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "#b7beda",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalSecondaryButton: {
    border: "1px solid #48527c",
    background: "#232845",
    color: "#e3e7ff",
    padding: "9px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  modalPrimaryButton: {
    border: "1px solid #6674d9",
    background: "#4b5cc7",
    color: "#fff",
    padding: "9px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
