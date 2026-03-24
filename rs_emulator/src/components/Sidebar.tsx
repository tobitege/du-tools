import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  FPS_LIMIT_OPTIONS,
  getResolutionPreset,
  getThemeOption,
  RESOLUTION_PRESETS,
  THEME_OPTIONS,
  type LuaModuleSearchPathEntry,
  type SessionEntry,
  type Settings,
} from "./sidebarConfig";
import type { SessionDropPlacement } from "../sessionOrdering";

interface SidebarProps {
  sessions: SessionEntry[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onOpenFile: () => void;
  onOpenGitHubImport: () => void;
  onImportFiles: (files: FileList | File[]) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onReorderSessions: (draggedId: string, targetId: string, placement: SessionDropPlacement) => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  luaModuleSearchPaths: LuaModuleSearchPathEntry[];
  onOpenLuaModuleSearchPaths: () => void;
  width: number;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="2" width="13" height="12" rx="2" stroke="currentColor" fill="none" strokeWidth="1.25" />
      <path d="M5.5 2.75V13.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path
        d={collapsed ? "M9.5 5.25L11.75 8L9.5 10.75" : "M11.75 5.25L9.5 8L11.75 10.75"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3.25" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="12.75" r="1.2" fill="currentColor" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 1.75H8.75L12.5 5.5V13a1.25 1.25 0 0 1-1.25 1.25h-7.25A1.25 1.25 0 0 1 2.75 13V3A1.25 1.25 0 0 1 4 1.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M8.5 2V5.75H12.25" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M5.25 8.5H10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M5.25 10.75H9.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.5A10.5 10.5 0 0 0 8.68 22c.52.1.7-.23.7-.5v-1.77c-2.87.62-3.47-1.22-3.47-1.22-.47-1.18-1.13-1.49-1.13-1.49-.92-.63.07-.62.07-.62 1.03.07 1.56 1.04 1.56 1.04.9 1.56 2.4 1.1 2.98.84.09-.66.35-1.11.63-1.37-2.29-.26-4.7-1.14-4.7-5.06 0-1.12.4-2.04 1.04-2.76-.11-.26-.45-1.33.1-2.77 0 0 .86-.28 2.82 1.05a9.8 9.8 0 0 1 5.12 0c1.96-1.33 2.81-1.05 2.81-1.05.56 1.44.22 2.51.12 2.77.65.72 1.04 1.64 1.04 2.76 0 3.94-2.42 4.79-4.73 5.05.37.32.7.94.7 1.89v2.8c0 .28.19.61.71.5A10.5 10.5 0 0 0 12 1.5Z"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 2.2L9.1 2.45L9.45 3.45C9.78 3.58 10.08 3.75 10.35 3.98L11.38 3.65L12.18 4.45L11.86 5.47C12.09 5.75 12.26 6.05 12.39 6.38L13.4 6.73V7.87L12.39 8.22C12.26 8.55 12.09 8.85 11.86 9.13L12.18 10.15L11.38 10.95L10.35 10.62C10.08 10.85 9.78 11.02 9.45 11.15L9.1 12.15L8 12.4L6.9 12.15L6.55 11.15C6.22 11.02 5.92 10.85 5.65 10.62L4.62 10.95L3.82 10.15L4.14 9.13C3.91 8.85 3.74 8.55 3.61 8.22L2.6 7.87V6.73L3.61 6.38C3.74 6.05 3.91 5.75 4.14 5.47L3.82 4.45L4.62 3.65L5.65 3.98C5.92 3.75 6.22 3.58 6.55 3.45L6.9 2.45L8 2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle
        cx="8"
        cy="7.3"
        r="2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sessionLocationLabel(session: SessionEntry): string {
  if (session.linkedFileName) {
    return session.linkedFileName;
  }
  return session.tempPath;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onOpenFile,
  onOpenGitHubImport,
  onImportFiles,
  onDeleteSession,
  onRenameSession,
  onReorderSessions,
  settings,
  onSettingsChange,
  luaModuleSearchPaths,
  onOpenLuaModuleSearchPaths,
  width,
  onResizePointerDown,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [section, setSection] = useState<"sessions" | "settings">("sessions");
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: SessionDropPlacement } | null>(null);
  const [sidebarDropActive, setSidebarDropActive] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const activeTheme = getThemeOption(settings.themeId);
  const compactSelectWidthClass = "w-32 min-w-32 max-w-32 flex-none [field-sizing:fixed]";
  const settingsControlRowClass = "grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-4 border-b border-base-300 py-2";
  const sidebarDropStyle = sidebarDropActive
    ? {
        background: "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 18%, var(--color-base-100) 82%) 0%, color-mix(in srgb, var(--color-primary) 12%, var(--color-base-200) 88%) 100%)",
        boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 42%, transparent), 0 16px 28px color-mix(in srgb, var(--color-primary) 16%, transparent)",
      }
    : {
        background: "linear-gradient(180deg, color-mix(in srgb, var(--color-base-100) 94%, white 6%) 0%, color-mix(in srgb, var(--color-base-200) 90%, black 10%) 100%)",
        boxShadow: "0 12px 24px color-mix(in srgb, black 14%, transparent), inset 0 0 0 1px color-mix(in srgb, white 8%, transparent)",
      };

  const hasFileDrag = (event: ReactDragEvent<HTMLElement>) => event.dataTransfer.types.includes("Files");

  const clearDragState = () => {
    setDraggingSessionId(null);
    setDropTarget(null);
  };

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (openMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpenMenuId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const updateDropTarget = (event: ReactDragEvent<HTMLDivElement>, sessionId: string) => {
    if (!draggingSessionId || draggingSessionId === sessionId) {
      setDropTarget(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropTarget({
      id: sessionId,
      placement: event.clientY >= midpoint ? "after" : "before",
    });
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-10 min-w-10 flex-col items-center justify-between border-r border-base-300 bg-base-200 pt-3 pb-3">
        <button
          type="button"
          onClick={onToggle}
          className="btn btn-ghost btn-sm btn-square"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <SidebarToggleIcon collapsed />
        </button>
        <button
          type="button"
          onClick={() => {
            setSection("settings");
            onToggle();
          }}
          className="btn btn-ghost btn-sm btn-square"
          title="Open settings"
          aria-label="Open settings"
        >
          <SettingsIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col border-r border-base-300 bg-base-200 text-base-content" style={{ width, minWidth: width }}>
      <div className="flex items-center border-b border-base-300 pr-3 pt-3 pb-5">
        <div className="flex w-10 shrink-0 justify-center border-r border-transparent">
          <button
            type="button"
            onClick={onToggle}
            className="btn btn-ghost btn-sm btn-square"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <SidebarToggleIcon collapsed={false} />
          </button>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 truncate text-[1.05rem] font-semibold tracking-wide text-base-content">RScript Emulator</span>
        </div>
      </div>

      <div className="tabs tabs-border bg-base-200 px-5 pt-4">
        <button
          className={classNames("tab flex-1 text-sm", section === "sessions" && "tab-active")}
          onClick={() => setSection("sessions")}
          title="Show session history"
        >
          History
        </button>
        <button
          className={classNames("tab flex-1 text-sm", section === "settings" && "tab-active")}
          onClick={() => setSection("settings")}
          title="Show emulator settings"
        >
          Settings
        </button>
      </div>

      {section === "sessions" && (
        <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
          <div className="mb-5 flex flex-col gap-2.5">
            <button type="button" onClick={onNewSession} className="btn btn-outline btn-md w-full justify-start px-4 normal-case" title="Create a new temporary session">
              + New Session
            </button>
            <button type="button" onClick={onOpenFile} className="btn btn-outline btn-md w-full justify-start gap-2 px-4 normal-case" title="Pick a Lua file and import it as a new session">
              <FileIcon />
              <span>Open File</span>
            </button>
            <button type="button" onClick={onOpenGitHubImport} className="btn btn-outline btn-md w-full justify-start gap-2 px-4 normal-case" title="Paste a GitHub URL to import a Lua file as a new session">
              <GitHubIcon />
              <span>GitHub URL</span>
            </button>
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-0.5 pt-0.5"
          >
            {sessions.map((s) => (
              <div
                key={s.id}
                className={classNames(
                  "group relative w-full self-stretch cursor-pointer overflow-hidden rounded-[0.8rem] border border-base-300 bg-base-100 transition-[border-color,opacity] duration-300 ease-out hover:border-primary/35",
                  s.id === activeSessionId && "border-primary bg-base-100 ring-2 ring-primary/20",
                  draggingSessionId === s.id && "opacity-60"
                )}
                style={{
                  background: s.id === activeSessionId
                    ? "linear-gradient(180deg, color-mix(in srgb, var(--color-base-100) 95%, var(--color-primary) 5%) 0%, color-mix(in srgb, var(--color-base-100) 98%, black 2%) 100%)"
                    : "linear-gradient(180deg, color-mix(in srgb, var(--color-base-100) 97%, white 3%) 0%, color-mix(in srgb, var(--color-base-100) 98%, black 2%) 100%)",
                  boxShadow: dropTarget?.id === s.id
                    ? dropTarget.placement === "before"
                      ? "inset 0 2px 0 var(--color-primary), 0 18px 34px color-mix(in srgb, var(--color-primary) 20%, transparent), inset 0 1px 0 color-mix(in srgb, white 12%, transparent)"
                      : "inset 0 -2px 0 var(--color-primary), 0 18px 34px color-mix(in srgb, var(--color-primary) 20%, transparent), inset 0 1px 0 color-mix(in srgb, white 12%, transparent)"
                    : s.id === activeSessionId
                      ? "0 16px 32px color-mix(in srgb, black 22%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-primary) 26%, transparent), inset 0 1px 0 color-mix(in srgb, white 18%, transparent)"
                      : "0 12px 24px color-mix(in srgb, black 18%, transparent), inset 0 1px 0 color-mix(in srgb, white 10%, transparent)",
                  borderColor: dropTarget?.id === s.id ? "var(--color-primary)" : undefined,
                }}
                draggable={renamingId !== s.id}
                onDragStart={(event) => {
                  setDraggingSessionId(s.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", s.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  updateDropTarget(event, s.id);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    return;
                  }
                  if (dropTarget?.id === s.id) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedId = draggingSessionId ?? event.dataTransfer.getData("text/plain");
                  if (!draggedId || draggedId === s.id) {
                    clearDragState();
                    return;
                  }
                  const placement = dropTarget?.id === s.id ? dropTarget.placement : "before";
                  onReorderSessions(draggedId, s.id, placement);
                  clearDragState();
                }}
                onDragEnd={clearDragState}
                onClick={() => {
                  setOpenMenuId(null);
                  onSelectSession(s.id);
                }}
              >
                {renamingId === s.id ? (
                  <div className="p-3">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameSession(s.id, renameValue);
                          setRenamingId(null);
                        }
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => {
                        onRenameSession(s.id, renameValue);
                        setRenamingId(null);
                      }}
                      className="input input-bordered input-sm w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <>
                    <div className="relative z-10 flex flex-col gap-1.5 px-3.5 py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 break-words text-[1.02rem] font-semibold leading-[1.2] text-base-content">
                          {s.name}
                          {s.dirty ? <span className="text-warning"> *</span> : null}
                        </div>
                        <div
                          ref={openMenuId === s.id ? openMenuRef : null}
                          className="relative shrink-0 -mr-1.5"
                          onClick={(event) => event.stopPropagation()}
                          onMouseLeave={() => {
                            if (openMenuId === s.id) {
                              setOpenMenuId(null);
                            }
                          }}
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setOpenMenuId(null);
                            }
                          }}
                        >
                          {openMenuId === s.id ? (
                            <div
                              className="flex items-center gap-0.5 rounded-full border border-base-300 bg-base-100/96 p-0.5 shadow-[0_12px_24px_color-mix(in_srgb,var(--color-base-content)_16%,transparent)] backdrop-blur"
                              role="menu"
                              aria-label={`Actions for ${s.name}`}
                            >
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square text-error"
                                role="menuitem"
                                title="Delete"
                                aria-label="Delete"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                  onDeleteSession(s.id);
                                }}
                              >
                                {"\u2715"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-square"
                                role="menuitem"
                                title="Rename"
                                aria-label="Rename"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                  setRenamingId(s.id);
                                  setRenameValue(s.name);
                                }}
                              >
                                {"\u270E"}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={classNames(
                                "btn btn-ghost btn-xs btn-square transition-opacity duration-150 ease-out",
                                "opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
                              )}
                              title="Session actions"
                              aria-label="Session actions"
                              aria-haspopup="menu"
                              aria-expanded={false}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(s.id);
                              }}
                            >
                              <KebabIcon />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="truncate text-[0.92rem] leading-[1.2] text-base-content/62">{sessionLocationLabel(s)}</div>
                      <div className="text-[0.88rem] leading-[1.15] text-base-content/46">{formatTime(s.updatedAt)}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="py-8 text-center text-sm italic text-base-content/50">No sessions yet</div>
            )}
          </div>
          <div className="mt-4 shrink-0">
            <div
              className="group flex min-h-[92px] w-full cursor-pointer items-center gap-3 rounded-[0.8rem] border border-dashed border-base-300/90 px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:border-primary/45 hover:bg-base-100/70"
              style={sidebarDropStyle}
              onClick={onOpenFile}
              onDragOver={(event) => {
                if (!hasFileDrag(event)) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setSidebarDropActive(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                setSidebarDropActive(false);
              }}
              onDrop={(event) => {
                if (!hasFileDrag(event)) {
                  return;
                }
                event.preventDefault();
                setSidebarDropActive(false);
                const files = event.dataTransfer.files;
                if (files && files.length > 0) {
                  onImportFiles(files);
                }
              }}
            >
              <div
                className={classNames(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-base-300 bg-base-100/88 text-base-content/72 transition-colors duration-200",
                  sidebarDropActive && "border-primary/45 text-primary"
                )}
              >
                <FileIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.98rem] font-semibold leading-[1.2] text-base-content">Drop Lua Files</div>
                <div className="mt-1 text-[0.9rem] leading-5 text-base-content/62">Drop one or more files here, or click to open the picker.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === "settings" && (
        <div className="flex-1 overflow-auto px-5 py-3 text-[0.9rem]">
          <label className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-base-300 py-2">
            <span className="min-w-0 flex-[0_1_auto] text-[0.9rem] font-medium leading-5">Resolution</span>
            <select
              value={settings.resolutionPreset}
              onChange={(e) => {
                const preset = getResolutionPreset(e.target.value);
                if (!preset) {
                  return;
                }
                onSettingsChange({
                  ...settings,
                  resolutionPreset: preset.id,
                  canvasWidth: preset.width,
                  canvasHeight: preset.height,
                });
              }}
              className="select select-bordered select-sm min-w-0 max-w-full flex-[1_1_11.5rem] text-[0.9rem]"
            >
              {RESOLUTION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label} - {preset.width} x {preset.height}</option>
              ))}
            </select>
          </label>
          <div className="py-1 pb-2.5 text-right text-[0.77rem] leading-4 text-base-content/55">{settings.canvasWidth} x {settings.canvasHeight}</div>
          <label className={settingsControlRowClass}>
            <span className="text-[0.9rem] font-medium leading-5">Theme</span>
            <select
              value={settings.themeId}
              onChange={(e) => onSettingsChange({ ...settings, themeId: e.target.value })}
              className={`select select-bordered select-sm text-[0.9rem] ${compactSelectWidthClass}`}
            >
              {THEME_OPTIONS.map((theme) => (
                <option key={theme.id} value={theme.id}>{theme.label}</option>
              ))}
            </select>
          </label>
          <div className="py-1 pb-2.5 text-right text-[0.77rem] leading-4 text-base-content/55">
            {activeTheme ? `${activeTheme.label} (${activeTheme.mode})` : settings.themeId}
          </div>
          <label className={settingsControlRowClass}>
            <span className="text-[0.9rem] font-medium leading-5">Canvas / Editor</span>
            <select
              value={settings.layoutOrientation}
              onChange={(e) => onSettingsChange({
                ...settings,
                layoutOrientation: e.target.value === "horizontal" ? "horizontal" : "vertical",
              })}
              className={`select select-bordered select-sm text-[0.9rem] ${compactSelectWidthClass}`}
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </label>
          <label className={settingsControlRowClass}>
            <span className="text-[0.9rem] font-medium leading-5">Max FPS</span>
            <select
              value={String(settings.maxFPS)}
              onChange={(e) => onSettingsChange({ ...settings, maxFPS: Number.parseInt(e.target.value, 10) })}
              className={`select select-bordered select-sm text-[0.9rem] ${compactSelectWidthClass}`}
            >
              {FPS_LIMIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className={settingsControlRowClass}>
            <span className="text-[0.9rem] font-medium leading-5">Show Grid</span>
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) => onSettingsChange({ ...settings, showGrid: e.target.checked })}
              className="toggle toggle-sm justify-self-end"
            />
          </label>
          <label className={settingsControlRowClass}>
            <span className="text-[0.9rem] font-medium leading-5">Show FPS</span>
            <input
              type="checkbox"
              checked={settings.showFPS}
              onChange={(e) => onSettingsChange({ ...settings, showFPS: e.target.checked })}
              className="toggle toggle-sm justify-self-end"
            />
          </label>
          <label className={settingsControlRowClass}>
            <span className="text-[0.9rem] font-medium leading-5">Dark Editor</span>
            <input
              type="checkbox"
              checked={settings.darkEditor}
              onChange={(e) => onSettingsChange({ ...settings, darkEditor: e.target.checked })}
              className="toggle toggle-sm justify-self-end"
            />
          </label>
          <label className={settingsControlRowClass}>
            <span className="text-[0.9rem] font-medium leading-5">Auto-run on change</span>
            <input
              type="checkbox"
              checked={settings.autoRun}
              onChange={(e) => onSettingsChange({ ...settings, autoRun: e.target.checked })}
              className="toggle toggle-sm justify-self-end"
            />
          </label>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 border-b border-base-300 py-2">
            <div className="flex min-w-0 flex-[1_1_100%] flex-col gap-1">
              <span className="text-[0.9rem] font-medium leading-5">Module Search Paths</span>
              <span className="text-[0.77rem] leading-4 text-base-content/60">Ordered list. First matching module wins.</span>
              <div className="mt-1 flex flex-col gap-1.5">
                {luaModuleSearchPaths.length > 0 ? luaModuleSearchPaths.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 text-[0.77rem] leading-4 text-base-content/60 [overflow-wrap:anywhere]">
                    <span className="badge badge-outline badge-xs min-w-14 justify-center">
                      {entry.kind === "project" ? "Project" : entry.kind === "env" ? "Default" : entry.kind === "manual" ? "Manual" : "Local"}
                    </span>
                    <span>{entry.label}</span>
                  </div>
                )) : (
                  <span className="text-[0.77rem] leading-4 text-base-content/60">No module search paths configured.</span>
                )}
              </div>
            </div>
            <div className="flex w-full flex-wrap justify-end gap-1.5">
              <button type="button" className="btn btn-outline btn-xs" onClick={onOpenLuaModuleSearchPaths} title="Edit the ordered Lua module search paths">
                Edit Paths
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onResizePointerDown}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none"
        title="Drag to resize sidebar"
      />
    </div>
  );
}
