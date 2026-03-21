import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { Canvas, type CanvasHandle } from "./components/Canvas";
import { Sidebar, DEFAULT_SETTINGS, type SessionEntry, type Settings } from "./components/Sidebar";
import { DrawBuffer, createLuaEnvironment, type LuaExecResult } from "./emulator";
import EXAMPLE_CODE from "../examples/example1.lua?raw";
import {
  createSession,
  deleteSession,
  listSessions,
  readSessionContent,
  renameSession,
  saveSessionToLocal,
  writeSessionContent,
} from "./storage/sessionStore";

function safeLoadSettings(): Settings {
  try {
    const raw = localStorage.getItem("rs-emulator-settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function safeSaveSettings(settings: Settings): void {
  try {
    localStorage.setItem("rs-emulator-settings", JSON.stringify(settings));
  } catch {
    // ignore quota/privacy failures
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

function sortSessions(entries: SessionEntry[]): SessionEntry[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export default function App() {
  const bufferRef = useRef(new DrawBuffer());
  const envRef = useRef(createLuaEnvironment(bufferRef.current));
  const canvasRef = useRef<CanvasHandle>(null);
  const animFrameRef = useRef<number>(0);
  const statusTimerRef = useRef<number>(0);
  const persistTimerRef = useRef<number>(0);
  const autoRunTimerRef = useRef<number>(0);
  const persistedCodeRef = useRef("");
  const prevResolutionRef = useRef(DEFAULT_SETTINGS.resolution);

  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [code, setCode] = useState("");
  const [settings, setSettings] = useState<Settings>(safeLoadSettings);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [result, setResult] = useState<LuaExecResult | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [sessions, activeSessionId]
  );

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
    envRef.current = createLuaEnvironment(bufferRef.current);
  }, []);

  const stopAnimation = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
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
    const buffer = bufferRef.current;
    buffer.screen.width = settings.resolution;
    buffer.screen.height = settings.resolution;

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
        const animate = async () => {
          buffer.time = performance.now() / 1000;
          buffer.deltaTime = 1 / 60;
          buffer.screen.width = settings.resolution;
          buffer.screen.height = settings.resolution;

          const frameResult = await envRef.current.execute(codeToRun);
          setResult(frameResult);
          canvasRef.current?.render(buffer, { showGrid: settings.showGrid });

          if (buffer.requestAnimFrames > 0) {
            animFrameRef.current = requestAnimationFrame(() => {
              void animate();
            });
          } else {
            animFrameRef.current = 0;
          }
        };
        animFrameRef.current = requestAnimationFrame(() => {
          void animate();
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setResult({ success: false, error: message, logs: [], output: "", requestAnimFrames: 0 });
      showStatus(`Error: ${message.slice(0, 140)}`);
    } finally {
      setRunning(false);
    }
  }, [settings.resolution, settings.showGrid, showStatus]);

  const runCurrentCode = useCallback((nextCode?: string) => {
    stopAnimation();
    void executeCode(nextCode ?? code);
  }, [code, executeCode, stopAnimation]);

  const handleRun = useCallback(() => {
    runCurrentCode();
  }, [runCurrentCode]);

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

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) {
      return;
    }
    await flushActiveSession();
    stopAnimation();
    const nextCode = await loadSessionIntoEditor(sessionId);
    void executeCode(nextCode);
  }, [activeSessionId, executeCode, flushActiveSession, loadSessionIntoEditor, stopAnimation]);

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
      prevResolutionRef.current = settings.resolution;
      return;
    }
    if (prevResolutionRef.current === settings.resolution) {
      return;
    }
    prevResolutionRef.current = settings.resolution;
    runCurrentCode();
  }, [bootstrapped, runCurrentCode, settings.resolution]);

  useEffect(() => {
    if (result) {
      canvasRef.current?.render(bufferRef.current, { showGrid: settings.showGrid });
    }
  }, [result, settings.showGrid]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
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
      await executeCode(nextCode);
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
  }, [executeCode, loadSessionIntoEditor, stopAnimation]);

  const currentFileLabel = fileLabel(activeSession);
  const isBusy = running || saving || loadingSession;

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
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />

      <div style={styles.main}>
        <div style={styles.topBar}>
          <div style={styles.canvasContainer}>
            <Canvas
              ref={canvasRef}
              width={settings.resolution}
              height={settings.resolution}
              showGrid={settings.showGrid}
              darkBg={settings.darkBg}
              showFps={settings.showFPS}
            />
          </div>
        </div>

        <div style={styles.editorPane}>
          <div style={styles.editorHeader}>
            <div style={styles.editorTitleGroup}>
              <span style={styles.editorTitle}>RenderScript.lua</span>
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
                onClick={handleRun}
                style={{ ...styles.runBtn, opacity: isBusy ? 0.7 : 1 }}
                disabled={isBusy || !activeSession}
              >
                {loadingSession ? "Loading..." : running ? "Running..." : saving ? "Saving..." : "Run  Ctrl+Enter"}
              </button>
            </div>
          </div>
          <div style={styles.editorBody}>
            <CodeEditor value={code} onChange={setCode} onRun={handleRun} />
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
  topBar: {
    flex: "1 1 50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    overflow: "hidden",
    background: "#111122",
  },
  canvasContainer: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  editorPane: {
    flex: "1 1 50%",
    display: "flex",
    flexDirection: "column",
    borderTop: "1px solid #2a2a4a",
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
  editorBody: {
    flex: 1,
    overflow: "hidden",
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
};
