import { reindexSessions, sortSessionsByOrder } from "../sessionOrdering";

export interface SessionEntry {
  id: string;
  name: string;
  updatedAt: number;
  sortIndex?: number;
  tempPath: string;
  linkedFileName: string | null;
  lastSavedAt: number | null;
  dirty: boolean;
}

interface SessionContentRecord {
  id: string;
  content: string;
}

interface SaveSessionResult {
  fileName: string;
  mode: "file-handle" | "download";
}

export interface SessionSourceResult {
  fileName: string;
  content: string;
}

const DB_NAME = "rs-emulator";
const DB_VERSION = 1;
const META_STORE = "session-meta";
const CONTENT_STORE = "session-content";
const HANDLE_STORE = "session-handles";
const TEMP_DIR = "rs-sessions";
const DU_LUA_ROOT_HANDLE_KEY = "du-lua-root-handle";

let dbPromise: Promise<IDBDatabase> | null = null;

function nextId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTempPath(id: string): string {
  return `${TEMP_DIR}/${id}.lua`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          db.createObjectStore(CONTENT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(HANDLE_STORE)) {
          db.createObjectStore(HANDLE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    });
  }
  return dbPromise;
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await action(store);
  await transactionDone(tx);
  return result;
}

function hasOpfs(): boolean {
  const storage = (navigator as Navigator & { storage?: { getDirectory?: () => Promise<FileSystemDirectoryHandle> } }).storage;
  return Boolean(storage && typeof storage.getDirectory === "function");
}

async function getTempDirectory(create = true): Promise<FileSystemDirectoryHandle | null> {
  if (!hasOpfs()) {
    return null;
  }
  const storage = (navigator as Navigator & { storage: { getDirectory: () => Promise<FileSystemDirectoryHandle> } }).storage;
  const root = await storage.getDirectory();
  return root.getDirectoryHandle(TEMP_DIR, { create });
}

function splitTempPath(tempPath: string): string {
  const parts = tempPath.split("/");
  return parts[parts.length - 1] ?? tempPath;
}

async function readTempContent(tempPath: string): Promise<string | null> {
  const dir = await getTempDirectory(false);
  if (!dir) {
    return null;
  }
  try {
    const fileHandle = await dir.getFileHandle(splitTempPath(tempPath), { create: false });
    const file = await fileHandle.getFile();
    return file.text();
  } catch {
    return null;
  }
}

async function writeTempContent(tempPath: string, content: string): Promise<boolean> {
  const dir = await getTempDirectory(true);
  if (!dir) {
    return false;
  }
  const fileHandle = await dir.getFileHandle(splitTempPath(tempPath), { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}

async function deleteTempContent(tempPath: string): Promise<void> {
  const dir = await getTempDirectory(false);
  if (!dir) {
    return;
  }
  try {
    await dir.removeEntry(splitTempPath(tempPath));
  } catch {
    // ignore missing temp files
  }
}

async function readFallbackContent(id: string): Promise<string> {
  return withStore(CONTENT_STORE, "readonly", async (store) => {
    const record = await requestToPromise(store.get(id)) as SessionContentRecord | undefined;
    return record?.content ?? "";
  });
}

async function writeFallbackContent(id: string, content: string): Promise<void> {
  await withStore(CONTENT_STORE, "readwrite", async (store) => {
    store.put({ id, content } satisfies SessionContentRecord);
    return undefined;
  });
}

async function deleteFallbackContent(id: string): Promise<void> {
  await withStore(CONTENT_STORE, "readwrite", async (store) => {
    store.delete(id);
    return undefined;
  });
}

function normalizeSession(meta: SessionEntry): SessionEntry {
  return {
    ...meta,
    sortIndex: typeof meta.sortIndex === "number" ? meta.sortIndex : undefined,
    linkedFileName: meta.linkedFileName ?? null,
    lastSavedAt: meta.lastSavedAt ?? null,
    dirty: Boolean(meta.dirty),
  };
}

export async function listSessions(): Promise<SessionEntry[]> {
  const entries = await withStore(META_STORE, "readwrite", async (store) => {
    const result = await requestToPromise(store.getAll()) as SessionEntry[];
    const normalized = result.map(normalizeSession);
    const reindexed = reindexSessions(normalized);

    for (const entry of reindexed) {
      const current = normalized.find((item) => item.id === entry.id);
      if (!current || current.sortIndex !== entry.sortIndex) {
        store.put(entry);
      }
    }

    return reindexed;
  });
  return entries;
}

export async function getSession(id: string): Promise<SessionEntry | null> {
  const entry = await withStore(META_STORE, "readonly", async (store) => {
    const result = await requestToPromise(store.get(id)) as SessionEntry | undefined;
    return result ? normalizeSession(result) : null;
  });
  return entry;
}

export async function createSession(options?: { name?: string; linkedFileName?: string | null; initialContent?: string }): Promise<SessionEntry> {
  const id = nextId();
  const updatedAt = Date.now();
  const existing = await listSessions();
  const topSortIndex = existing.length > 0
    ? Math.min(...existing.map((session) => session.sortIndex ?? 0)) - 1
    : 0;
  const session: SessionEntry = {
    id,
    name: options?.name?.trim() || "Untitled",
    updatedAt,
    sortIndex: topSortIndex,
    tempPath: defaultTempPath(id),
    linkedFileName: options?.linkedFileName?.trim() || null,
    lastSavedAt: null,
    dirty: false,
  };
  await withStore(META_STORE, "readwrite", async (store) => {
    store.put(session);
    return undefined;
  });
  await writeSessionContent(id, options?.initialContent ?? "", { markDirty: false, updatedAt });
  return session;
}

export async function updateSessionMeta(id: string, patch: Partial<SessionEntry>): Promise<SessionEntry | null> {
  const current = await getSession(id);
  if (!current) {
    return null;
  }
  const next = normalizeSession({ ...current, ...patch, id: current.id, tempPath: current.tempPath });
  await withStore(META_STORE, "readwrite", async (store) => {
    store.put(next);
    return undefined;
  });
  return next;
}

export async function renameSession(id: string, name: string): Promise<SessionEntry | null> {
  return updateSessionMeta(id, { name: name.trim() || "Untitled" });
}

export async function readSessionContent(id: string): Promise<string> {
  const meta = await getSession(id);
  if (!meta) {
    return "";
  }
  const opfsContent = await readTempContent(meta.tempPath);
  if (opfsContent !== null) {
    return opfsContent;
  }
  return readFallbackContent(id);
}

export async function writeSessionContent(id: string, content: string, options?: { markDirty?: boolean; updatedAt?: number }): Promise<SessionEntry | null> {
  const meta = await getSession(id);
  if (!meta) {
    return null;
  }
  const updatedAt = options?.updatedAt ?? Date.now();
  const wroteToOpfs = await writeTempContent(meta.tempPath, content);
  if (!wroteToOpfs) {
    await writeFallbackContent(id, content);
  } else {
    await deleteFallbackContent(id);
  }
  return updateSessionMeta(id, {
    updatedAt,
    dirty: options?.markDirty ?? true,
  });
}

export async function deleteSession(id: string): Promise<void> {
  const meta = await getSession(id);
  if (meta) {
    await deleteTempContent(meta.tempPath);
  }
  await deleteFallbackContent(id);
  const db = await openDb();
  const tx = db.transaction([META_STORE, HANDLE_STORE], "readwrite");
  tx.objectStore(META_STORE).delete(id);
  tx.objectStore(HANDLE_STORE).delete(id);
  await transactionDone(tx);
}

export async function saveSessionOrder(orderedIds: string[]): Promise<SessionEntry[]> {
  return withStore(META_STORE, "readwrite", async (store) => {
    const current = sortSessionsByOrder((await requestToPromise(store.getAll()) as SessionEntry[]).map(normalizeSession));
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    const ordered: SessionEntry[] = [];

    for (const id of orderedIds) {
      const entry = byId.get(id);
      if (!entry) {
        continue;
      }
      ordered.push(entry);
      byId.delete(id);
    }

    ordered.push(...current.filter((entry) => byId.has(entry.id)));

    const reindexed = ordered.map((entry, index) => ({
      ...entry,
      sortIndex: index,
    }));

    for (const entry of reindexed) {
      store.put(entry);
    }

    return reindexed;
  });
}

async function getLinkedHandle(id: string): Promise<FileSystemFileHandle | null> {
  return withStore(HANDLE_STORE, "readonly", async (store) => {
    const handle = await requestToPromise(store.get(id)) as FileSystemFileHandle | undefined;
    return handle ?? null;
  });
}

async function setLinkedHandle(id: string, handle: FileSystemFileHandle): Promise<void> {
  await withStore(HANDLE_STORE, "readwrite", async (store) => {
    store.put(handle, id);
    return undefined;
  });
}

export async function getDuLuaRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  return withStore(HANDLE_STORE, "readonly", async (store) => {
    const handle = await requestToPromise(store.get(DU_LUA_ROOT_HANDLE_KEY)) as FileSystemDirectoryHandle | undefined;
    return handle ?? null;
  });
}

export async function setDuLuaRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore(HANDLE_STORE, "readwrite", async (store) => {
    store.put(handle, DU_LUA_ROOT_HANDLE_KEY);
    return undefined;
  });
}

function supportsFilePicker(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

async function ensureWritableHandle(handle: FileSystemFileHandle): Promise<boolean> {
  const permissionAware = handle as FileSystemFileHandle & {
    queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  };
  const descriptor = { mode: "readwrite" as const };
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

async function ensureReadableHandle(handle: FileSystemFileHandle): Promise<boolean> {
  const permissionAware = handle as FileSystemFileHandle & {
    queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  };
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

function triggerDownload(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readSessionFromProjectSource(sourceRef: string): Promise<SessionSourceResult | null> {
  try {
    const response = await fetch(`/__du_lua/source?ref=${encodeURIComponent(sourceRef)}`);
    if (!response.ok) {
      return null;
    }
    return await response.json() as SessionSourceResult;
  } catch {
    return null;
  }
}

export async function saveSessionToLocal(id: string, content: string, suggestedName: string): Promise<SaveSessionResult | null> {
  const meta = await getSession(id);
  if (!meta) {
    return null;
  }

  const sanitized = suggestedName.trim().replace(/[^A-Za-z0-9._-]+/g, "_") || "render-script";
  let handle = await getLinkedHandle(id);

  if (!handle && supportsFilePicker()) {
    const picker = window as Window & {
      showSaveFilePicker?: (options?: {
        suggestedName?: string;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    handle = await picker.showSaveFilePicker?.({
      suggestedName: sanitized.endsWith(".lua") ? sanitized : `${sanitized}.lua`,
      types: [{ description: "Lua files", accept: { "text/plain": [".lua"] } }],
    }) ?? null;
    if (handle) {
      await setLinkedHandle(id, handle);
    }
  }

  if (handle) {
    const writableAllowed = await ensureWritableHandle(handle);
    if (writableAllowed) {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      await updateSessionMeta(id, {
        linkedFileName: handle.name,
        lastSavedAt: Date.now(),
        dirty: false,
      });
      return { fileName: handle.name, mode: "file-handle" };
    }
  }

  const fallbackName = sanitized.endsWith(".lua") ? sanitized : `${sanitized}.lua`;
  triggerDownload(fallbackName, content);
  await updateSessionMeta(id, {
    linkedFileName: meta.linkedFileName ?? fallbackName,
    lastSavedAt: Date.now(),
    dirty: false,
  });
  return { fileName: fallbackName, mode: "download" };
}

export async function readSessionFromLinkedFile(id: string): Promise<SessionSourceResult | null> {
  const meta = await getSession(id);
  if (!meta) {
    return null;
  }

  const handle = await getLinkedHandle(id);
  if (!handle) {
    return meta.linkedFileName ? readSessionFromProjectSource(meta.linkedFileName) : null;
  }

  const readable = await ensureReadableHandle(handle);
  if (!readable) {
    throw new Error("Read permission was not granted");
  }

  const file = await handle.getFile();
  return {
    fileName: file.name,
    content: await file.text(),
  };
}
