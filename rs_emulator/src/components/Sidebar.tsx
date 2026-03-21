import { useState } from "react";

export interface SessionEntry {
  id: string;
  name: string;
  updatedAt: number;
  tempPath: string;
  linkedFileName: string | null;
  dirty: boolean;
}

interface SidebarProps {
  sessions: SessionEntry[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export interface Settings {
  resolution: number;
  showGrid: boolean;
  showFPS: boolean;
  darkBg: boolean;
  autoRun: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  resolution: 1024,
  showGrid: false,
  showFPS: true,
  darkBg: true,
  autoRun: false,
};

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
  onDeleteSession,
  onRenameSession,
  settings,
  onSettingsChange,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [section, setSection] = useState<"sessions" | "settings">("sessions");

  if (collapsed) {
    return (
      <div style={styles.collapsed}>
        <button onClick={onToggle} style={styles.expandBtn} title="Expand sidebar">
          {"\u2630"}
        </button>
      </div>
    );
  }

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <span style={styles.logo}>{"\u25A0"} RS Emulator</span>
        <button onClick={onToggle} style={styles.collapseBtn} title="Collapse">{"\u2715"}</button>
      </div>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(section === "sessions" ? styles.tabActive : {}) }}
          onClick={() => setSection("sessions")}
        >
          History
        </button>
        <button
          style={{ ...styles.tab, ...(section === "settings" ? styles.tabActive : {}) }}
          onClick={() => setSection("settings")}
        >
          Settings
        </button>
      </div>

      {section === "sessions" && (
        <div style={styles.section}>
          <button onClick={onNewSession} style={styles.newBtn}>
            + New Session
          </button>
          <div style={styles.sessionList}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  ...styles.sessionItem,
                  ...(s.id === activeSessionId ? styles.sessionActive : {}),
                }}
                onClick={() => onSelectSession(s.id)}
              >
                {renamingId === s.id ? (
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
                    style={styles.renameInput}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div style={styles.sessionName}>
                      {s.name}
                      {s.dirty ? <span style={styles.dirtyDot}> *</span> : null}
                    </div>
                    <div style={styles.sessionMeta}>{sessionLocationLabel(s)}</div>
                    <div style={styles.sessionTime}>{formatTime(s.updatedAt)}</div>
                    <div style={styles.sessionActions}>
                      <button
                        style={styles.actionBtn}
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(s.id);
                          setRenameValue(s.name);
                        }}
                      >
                        {"\u270E"}
                      </button>
                      <button
                        style={{ ...styles.actionBtn, color: "#f44" }}
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.id);
                        }}
                      >
                        {"\u2715"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <div style={styles.empty}>No sessions yet</div>
            )}
          </div>
        </div>
      )}

      {section === "settings" && (
        <div style={styles.section}>
          <label style={styles.settingRow}>
            <span>Resolution</span>
            <select
              value={settings.resolution}
              onChange={(e) => onSettingsChange({ ...settings, resolution: Number(e.target.value) })}
              style={styles.select}
            >
              {[256, 512, 1024, 2048].map((r) => (
                <option key={r} value={r}>{r} x {r}</option>
              ))}
            </select>
          </label>
          <label style={styles.settingRow}>
            <span>Show Grid</span>
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) => onSettingsChange({ ...settings, showGrid: e.target.checked })}
            />
          </label>
          <label style={styles.settingRow}>
            <span>Show FPS</span>
            <input
              type="checkbox"
              checked={settings.showFPS}
              onChange={(e) => onSettingsChange({ ...settings, showFPS: e.target.checked })}
            />
          </label>
          <label style={styles.settingRow}>
            <span>Dark Background</span>
            <input
              type="checkbox"
              checked={settings.darkBg}
              onChange={(e) => onSettingsChange({ ...settings, darkBg: e.target.checked })}
            />
          </label>
          <label style={styles.settingRow}>
            <span>Auto-run on change</span>
            <input
              type="checkbox"
              checked={settings.autoRun}
              onChange={(e) => onSettingsChange({ ...settings, autoRun: e.target.checked })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 280,
    minWidth: 280,
    height: "100%",
    background: "#1a1a2e",
    borderRight: "1px solid #2a2a4a",
    display: "flex",
    flexDirection: "column",
    color: "#ccc",
    fontFamily: "system-ui, sans-serif",
    fontSize: 13,
  },
  collapsed: {
    width: 40,
    minWidth: 40,
    height: "100%",
    background: "#1a1a2e",
    borderRight: "1px solid #2a2a4a",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 12,
  },
  expandBtn: {
    background: "none",
    border: "none",
    color: "#aaa",
    fontSize: 20,
    cursor: "pointer",
    padding: 4,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #2a2a4a",
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    color: "#e0e0ff",
    letterSpacing: 0.5,
  },
  collapseBtn: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 16,
    cursor: "pointer",
    padding: 4,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #2a2a4a",
  },
  tab: {
    flex: 1,
    padding: "10px 0",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#888",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  tabActive: {
    color: "#e0e0ff",
    borderBottomColor: "#6c6cf0",
  },
  section: {
    flex: 1,
    overflow: "auto",
    padding: 12,
  },
  newBtn: {
    width: "100%",
    padding: "8px 12px",
    background: "#2a2a4a",
    border: "1px dashed #4a4a6a",
    color: "#aaa",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    marginBottom: 12,
  },
  sessionList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  sessionItem: {
    padding: "8px 10px",
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    position: "relative",
    transition: "background 0.15s",
  },
  sessionActive: {
    background: "#2a2a5a",
  },
  sessionName: {
    fontWeight: 500,
    color: "#ddd",
    fontSize: 13,
  },
  dirtyDot: {
    color: "#f6c15c",
  },
  sessionMeta: {
    fontSize: 11,
    color: "#8e8eb0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: 220,
  },
  sessionTime: {
    fontSize: 11,
    color: "#777",
  },
  sessionActions: {
    position: "absolute",
    right: 8,
    top: 8,
    display: "flex",
    gap: 4,
    opacity: 1,
  },
  actionBtn: {
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 4px",
  },
  renameInput: {
    background: "#111",
    border: "1px solid #6c6cf0",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  empty: {
    color: "#555",
    textAlign: "center" as const,
    padding: "20px 0",
    fontStyle: "italic",
  },
  settingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #2a2a3a",
    cursor: "pointer",
  },
  select: {
    background: "#111",
    border: "1px solid #3a3a5a",
    color: "#ccc",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
  },
};
