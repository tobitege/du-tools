export const MAX_IMPORTED_FILE_SIZE_BYTES = 1024 * 1024;
const MAX_REMOTE_IMAGE_SOURCE_LENGTH = 4096;
const MAX_REMOTE_SCRIPT_SOURCE_LENGTH = 4096;
const MAX_DATA_IMAGE_SOURCE_LENGTH = 512 * 1024;
const MAX_SESSION_NAME_LENGTH = 120;
const NOVAQUARK_ASSET_HOST = "assets.prod.novaquark.com";
const GITHUB_HOST = "github.com";
const RAW_GITHUB_HOST = "raw.githubusercontent.com";
const ALLOWED_IMPORT_EXTENSIONS = new Set([".lua", ".txt"]);
const ALLOWED_IMAGE_TYPES = new Set(["png", "jpeg", "jpg"]);
const WINDOWS_RESERVED_FILE_BASENAMES = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

const WINDOWS_DRIVE_PREFIX_PATTERN = /^[A-Za-z]:/;
const URI_SCHEME_PATTERN = /^([A-Za-z][A-Za-z\d+.-]*):/;
const UNC_PREFIX_PATTERN = /^(?:\\\\|\/\/)/;

export interface AcceptedImportFile {
  safeFileName: string;
  sessionName: string;
}

export interface AcceptedGitHubLuaUrl {
  safeFileName: string;
  sessionName: string;
  remoteSourceUrl: string;
}

export type ImportFileValidationResult =
  | { ok: true; value: AcceptedImportFile }
  | { ok: false; reason: string };

export type ImportedSessionTextValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type GitHubLuaUrlValidationResult =
  | { ok: true; value: AcceptedGitHubLuaUrl }
  | { ok: false; reason: string };

function isControlCharCode(code: number): boolean {
  return (code >= 0 && code <= 31) || code === 127;
}

function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (isControlCharCode(value.charCodeAt(index))) {
      return true;
    }
  }

  return false;
}

function replaceControlChars(value: string, replacement: string): string {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    result += isControlCharCode(char.charCodeAt(0)) ? replacement : char;
  }

  return result;
}

function hasUnsafeDecodedPathSegments(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  for (const segment of segments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return true;
    }

    if (
      decoded.length === 0
      || decoded === "."
      || decoded === ".."
      || decoded.includes("/")
      || decoded.includes("\\")
      || hasControlChars(decoded)
    ) {
      return true;
    }
  }

  return false;
}

function isSuspiciousLocalPath(value: string): boolean {
  const scheme = value.match(URI_SCHEME_PATTERN)?.[1]?.toLowerCase();
  if (scheme && scheme !== "data") {
    return true;
  }

  return (
    WINDOWS_DRIVE_PREFIX_PATTERN.test(value)
    || value.startsWith("/")
    || value.startsWith("\\")
    || UNC_PREFIX_PATTERN.test(value)
  );
}

export function sessionNameFromFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "Untitled";
  }

  const withoutExtension = trimmed.replace(/\.[^.\\/]+$/, "");
  return sanitizeSessionName(withoutExtension || trimmed);
}

export function sanitizeSessionName(name: string): string {
  const cleaned = replaceControlChars(name, " ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+/, "")
    .replace(/[.\s]+$/, "");

  if (!cleaned || cleaned === "." || cleaned === "..") {
    return "Untitled";
  }

  return cleaned.slice(0, MAX_SESSION_NAME_LENGTH).trimEnd() || "Untitled";
}

export function sanitizeLuaFileStem(name: string): string {
  const sessionName = sanitizeSessionName(name);
  const collapsed = sessionName
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");

  const safeStem = collapsed || "render-script";
  const lowered = safeStem.toLowerCase();

  if (WINDOWS_RESERVED_FILE_BASENAMES.has(lowered)) {
    return `file-${safeStem}`;
  }

  return safeStem;
}

export function normalizeImportedFileName(fileName: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return null;
  }

  if (
    trimmed.length > 255
    || hasControlChars(trimmed)
    || trimmed.includes("/")
    || trimmed.includes("\\")
    || trimmed.includes(":")
  ) {
    return null;
  }

  return trimmed;
}

export function validateImportedSessionFile(file: Pick<File, "name" | "size">): ImportFileValidationResult {
  const safeFileName = normalizeImportedFileName(file.name);
  if (!safeFileName) {
    return { ok: false, reason: "unsafe file name or path" };
  }

  const lowerName = safeFileName.toLowerCase();
  const allowedExtension = [...ALLOWED_IMPORT_EXTENSIONS].some((extension) => lowerName.endsWith(extension));
  if (!allowedExtension) {
    return { ok: false, reason: "only .lua or .txt files are allowed" };
  }

  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_IMPORTED_FILE_SIZE_BYTES) {
    return { ok: false, reason: "file is too large" };
  }

  return {
    ok: true,
    value: {
      safeFileName,
      sessionName: sessionNameFromFileName(safeFileName),
    },
  };
}

export function validateImportedSessionText(content: string): ImportedSessionTextValidationResult {
  const contentSize = new TextEncoder().encode(content).length;
  if (contentSize > MAX_IMPORTED_FILE_SIZE_BYTES) {
    return { ok: false, reason: "file is too large" };
  }

  return { ok: true };
}

function normalizeGitHubHost(hostname: string): string | null {
  const lowered = hostname.toLowerCase();
  if (lowered === GITHUB_HOST || lowered === `www.${GITHUB_HOST}`) {
    return GITHUB_HOST;
  }
  if (lowered === RAW_GITHUB_HOST) {
    return RAW_GITHUB_HOST;
  }
  return null;
}

function buildAcceptedGitHubLuaUrl(pathSegments: string[], remoteSourceUrl: string): GitHubLuaUrlValidationResult {
  const rawFileName = pathSegments[pathSegments.length - 1];
  if (!rawFileName) {
    return { ok: false, reason: "GitHub URL must point to a .lua file" };
  }

  let decodedFileName: string;
  try {
    decodedFileName = decodeURIComponent(rawFileName);
  } catch {
    return { ok: false, reason: "GitHub URL contains invalid encoding" };
  }

  const safeFileName = normalizeImportedFileName(decodedFileName);
  if (!safeFileName || !safeFileName.toLowerCase().endsWith(".lua")) {
    return { ok: false, reason: "GitHub URL must point to a .lua file" };
  }

  return {
    ok: true,
    value: {
      safeFileName,
      sessionName: sessionNameFromFileName(safeFileName),
      remoteSourceUrl,
    },
  };
}

export function validateGitHubLuaUrl(url: string): GitHubLuaUrlValidationResult {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, reason: "enter a GitHub URL" };
  }

  if (
    trimmed.length > MAX_REMOTE_SCRIPT_SOURCE_LENGTH
    || hasControlChars(trimmed)
    || /\s/.test(trimmed)
  ) {
    return { ok: false, reason: "GitHub URL contains unsupported characters" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "enter a valid GitHub URL" };
  }

  const normalizedHost = normalizeGitHubHost(parsed.hostname);
  if (!normalizedHost) {
    return { ok: false, reason: "only github.com raw/blob URLs are allowed" };
  }

  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.search
    || parsed.hash
    || !parsed.pathname
    || parsed.pathname === "/"
    || parsed.pathname.includes("\\")
    || parsed.pathname.includes("//")
    || hasUnsafeDecodedPathSegments(parsed.pathname)
  ) {
    return { ok: false, reason: "GitHub URL format is not supported" };
  }

  const pathSegments = parsed.pathname.split("/").filter(Boolean);

  if (normalizedHost === RAW_GITHUB_HOST) {
    if (pathSegments.length < 4) {
      return { ok: false, reason: "GitHub raw URL is incomplete" };
    }

    return buildAcceptedGitHubLuaUrl(pathSegments, `https://${RAW_GITHUB_HOST}/${pathSegments.join("/")}`);
  }

  if (pathSegments.length < 5 || (pathSegments[2] !== "blob" && pathSegments[2] !== "raw")) {
    return { ok: false, reason: "GitHub URL must be a blob or raw file URL" };
  }

  const rawPathSegments = [pathSegments[0], pathSegments[1], ...pathSegments.slice(3)];
  if (rawPathSegments.length < 4) {
    return { ok: false, reason: "GitHub URL is missing the file path" };
  }

  return buildAcceptedGitHubLuaUrl(rawPathSegments, `https://${RAW_GITHUB_HOST}/${rawPathSegments.join("/")}`);
}

function normalizeDataImageUrl(url: string): string | null {
  if (url.length > MAX_DATA_IMAGE_SOURCE_LENGTH) {
    return null;
  }

  const match = url.match(/^data:image\/([A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return null;
  }

  const imageType = match[1]?.toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_TYPES.has(imageType)) {
    return null;
  }

  return url;
}

function normalizeNovaquarkAssetUrl(url: string): string | null {
  if (!url.startsWith(NOVAQUARK_ASSET_HOST)) {
    return null;
  }

  const rawPath = url.slice(NOVAQUARK_ASSET_HOST.length);
  if (
    !rawPath.startsWith("/")
    || rawPath.endsWith("/")
    || rawPath.includes("\\")
    || rawPath.includes("//")
    || rawPath.includes("?")
    || rawPath.includes("#")
    || hasUnsafeDecodedPathSegments(rawPath)
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(`https://${url}`);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== NOVAQUARK_ASSET_HOST
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.search
    || parsed.hash
    || !parsed.pathname
    || parsed.pathname === "/"
    || !parsed.pathname.match(/\.(png|jpe?g)$/i)
  ) {
    return null;
  }

  return parsed.toString();
}

export function normalizeImageSource(url: string): string | null {
  const trimmed = url.trim();
  if (
    !trimmed
    || hasControlChars(trimmed)
    || /\s/.test(trimmed)
    || isSuspiciousLocalPath(trimmed)
  ) {
    return null;
  }

  const dataImage = normalizeDataImageUrl(trimmed);
  if (dataImage) {
    return dataImage;
  }

  if (trimmed.length > MAX_REMOTE_IMAGE_SOURCE_LENGTH) {
    return null;
  }

  return normalizeNovaquarkAssetUrl(trimmed);
}
