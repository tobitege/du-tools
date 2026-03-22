function toUrlString(value: string | URL): string {
  return value instanceof URL ? value.href : value;
}

export function pathToFileURL(path: string): URL {
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path)) {
    return new URL(path);
  }

  const normalizedPath = path.replace(/\\/g, "/");
  const prefixedPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  return new URL(`file://${prefixedPath}`);
}

export function fileURLToPath(value: string | URL): string {
  const parsed = new URL(toUrlString(value));
  if (parsed.protocol !== "file:") {
    throw new TypeError(`Expected file: URL, got ${parsed.protocol}`);
  }

  return decodeURIComponent(parsed.pathname);
}
