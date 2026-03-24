import { promises as fs } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";

type ResolvedSourceReference = {
  kind: "project" | "du" | "manual";
  root: string;
  relativePath: string;
  absolutePath: string;
  rootIndex?: number;
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeRootKey(rootPath: string): string {
  const normalized = normalizePath(path.resolve(rootPath));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function parseDuLuaRoots(value: string | undefined, projectRoot: string = process.cwd()): string[] {
  if (!value) {
    return [];
  }

  const rawEntries = stripWrappingQuotes(value)
    .split(/[;\r\n]+/)
    .map((entry) => stripWrappingQuotes(entry))
    .filter(Boolean);

  const seen = new Set<string>();
  const resolvedRoots: string[] = [];

  for (const entry of rawEntries) {
    const resolvedRoot = path.resolve(projectRoot, entry);
    const key = normalizeRootKey(resolvedRoot);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    resolvedRoots.push(resolvedRoot);
  }

  return resolvedRoots;
}

function buildLuaModuleCandidates(moduleName: string): string[][] {
  const normalized = moduleName.replace(/\\/g, "/");
  const slashParts = normalized.split("/").filter(Boolean);
  const dotParts = normalized.split(".").filter(Boolean);
  const seen = new Set<string>();
  const candidates: string[][] = [];

  for (const parts of [slashParts, dotParts]) {
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

function isSafeModuleName(moduleName: string): boolean {
  return /^[A-Za-z0-9_./-]+$/.test(moduleName) && !moduleName.includes("..");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function createSourceRef(kind: "project" | "du", relativePath: string): string {
  return `${kind}:${normalizePath(relativePath)}`;
}

function createManualSourceRef(root: string, relativePath: string): string {
  return `manual:${encodeURIComponent(normalizePath(root))}::${normalizePath(relativePath)}`;
}

function createDuSourceRef(relativePath: string, rootIndex?: number): string {
  const normalizedPath = normalizePath(relativePath);
  return rootIndex === undefined ? `du:${normalizedPath}` : `du[${rootIndex}]:${normalizedPath}`;
}

async function resolveDuSourcePath(duLuaRoots: string[], relativePath: string, preferredRootIndex?: number): Promise<ResolvedSourceReference | null> {
  const rootIndexes = preferredRootIndex === undefined
    ? duLuaRoots.map((_, index) => index)
    : [preferredRootIndex];

  for (const rootIndex of rootIndexes) {
    const root = duLuaRoots[rootIndex];
    if (!root) {
      continue;
    }

    const absolutePath = path.join(root, relativePath);
    if (await fileExists(absolutePath)) {
      return {
        kind: "du",
        root,
        relativePath,
        absolutePath,
        rootIndex,
      };
    }
  }

  return null;
}

export async function resolveSourceReference(projectRoot: string, duLuaRoots: string[], sourceRef: string): Promise<ResolvedSourceReference | null> {
  const normalized = normalizePath(sourceRef.trim());
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("project:")) {
    const relativePath = normalized.slice("project:".length);
    if (!isSafeModuleName(relativePath)) {
      return null;
    }
    const absolutePath = path.join(projectRoot, relativePath);
    if (!(await fileExists(absolutePath))) {
      return null;
    }
    return { kind: "project", root: projectRoot, relativePath, absolutePath };
  }

  const indexedDuMatch = normalized.match(/^du\[(\d+)\]:(.+)$/);
  if (indexedDuMatch) {
    const rootIndex = Number(indexedDuMatch[1]);
    const relativePath = indexedDuMatch[2];
    if (!isSafeModuleName(relativePath)) {
      return null;
    }
    return await resolveDuSourcePath(duLuaRoots, relativePath, rootIndex);
  }

  if (normalized.startsWith("du:")) {
    const relativePath = normalized.slice("du:".length);
    if (!isSafeModuleName(relativePath)) {
      return null;
    }
    return await resolveDuSourcePath(duLuaRoots, relativePath);
  }

  const manualMatch = normalized.match(/^manual:([^:]+)::(.+)$/);
  if (manualMatch) {
    const root = path.resolve(decodeURIComponent(manualMatch[1]));
    const relativePath = manualMatch[2];
    if (!isSafeModuleName(relativePath)) {
      return null;
    }
    const absolutePath = path.join(root, relativePath);
    if (!(await fileExists(absolutePath))) {
      return null;
    }
    return { kind: "manual", root, relativePath, absolutePath };
  }

  if (normalized.includes("/")) {
    if (!isSafeModuleName(normalized)) {
      return null;
    }
    const projectPath = path.join(projectRoot, normalized);
    if (await fileExists(projectPath)) {
      return { kind: "project", root: projectRoot, relativePath: normalized, absolutePath: projectPath };
    }
    for (const [rootIndex, duLuaRoot] of duLuaRoots.entries()) {
      const duPath = path.join(duLuaRoot, normalized);
      if (await fileExists(duPath)) {
        return { kind: "du", root: duLuaRoot, relativePath: normalized, absolutePath: duPath, rootIndex };
      }
    }
  }

  const exampleRoot = path.join(projectRoot, "examples");
  const targetName = normalized.toLowerCase();

  async function findByBasename(root: string): Promise<string | null> {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        const nested = await findByBasename(entryPath);
        if (nested) {
          return nested;
        }
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase() === targetName) {
        return entryPath;
      }
    }
    return null;
  }

  if (await fileExists(exampleRoot)) {
    const foundExample = await findByBasename(exampleRoot);
    if (foundExample) {
      const relativePath = normalizePath(path.relative(projectRoot, foundExample));
      return { kind: "project", root: projectRoot, relativePath, absolutePath: foundExample };
    }
  }

  return null;
}

async function readLuaModuleFromRoot(root: string, moduleName: string): Promise<{ source: string; resolvedPath: string } | null> {
  if (!isSafeModuleName(moduleName)) {
    return null;
  }

  for (const parts of buildLuaModuleCandidates(moduleName)) {
    const filePath = path.join(root, ...parts) + ".lua";
    try {
      return {
        source: await fs.readFile(filePath, "utf8"),
        resolvedPath: normalizePath(path.relative(root, filePath)),
      };
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function readLuaModule(duLuaRoots: string[], moduleName: string): Promise<{ source: string; resolvedPath: string; rootIndex: number } | null> {
  for (const [rootIndex, root] of duLuaRoots.entries()) {
    const resolved = await readLuaModuleFromRoot(root, moduleName);
    if (resolved) {
      return { ...resolved, rootIndex };
    }
  }

  return null;
}

export async function readLuaModuleRelativeToSource(projectRoot: string, duLuaRoots: string[], sourceRef: string, moduleName: string): Promise<{ source: string; resolvedRef: string } | null> {
  if (!isSafeModuleName(moduleName)) {
    return null;
  }

  const resolvedSource = await resolveSourceReference(projectRoot, duLuaRoots, sourceRef);
  if (!resolvedSource) {
    return null;
  }

  const baseDir = path.dirname(resolvedSource.absolutePath);
  for (const parts of buildLuaModuleCandidates(moduleName)) {
    const filePath = path.join(baseDir, ...parts) + ".lua";
    try {
      const relativePath = normalizePath(path.relative(resolvedSource.root, filePath));
      return {
        source: await fs.readFile(filePath, "utf8"),
        resolvedRef: resolvedSource.kind === "du"
          ? createDuSourceRef(relativePath, resolvedSource.rootIndex)
          : resolvedSource.kind === "manual"
            ? createManualSourceRef(resolvedSource.root, relativePath)
          : createSourceRef(resolvedSource.kind, relativePath),
      };
    } catch {
      // try next candidate
    }
  }

  if (resolvedSource.kind === "project" || resolvedSource.kind === "manual") {
    const rootModule = await readLuaModuleFromRoot(resolvedSource.root, moduleName);
    if (rootModule) {
      return {
        source: rootModule.source,
        resolvedRef: resolvedSource.kind === "manual"
          ? createManualSourceRef(resolvedSource.root, rootModule.resolvedPath)
          : createSourceRef("project", rootModule.resolvedPath),
      };
    }
  }

  return null;
}

function duLuaPlugin(duLuaRoots: string[]): Plugin {
  const route = "/__du_lua";
  const projectRoot = process.cwd();

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url) {
      next();
      return;
    }

    const url = new URL(req.url, "http://localhost");

    if (url.pathname === `${route}/status`) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        configured: duLuaRoots.length > 0,
        rootPath: duLuaRoots.length > 0 ? duLuaRoots.map((root) => normalizePath(root)).join(" ; ") : null,
        searchRoots: duLuaRoots.map((root, rootIndex) => ({
          rootIndex,
          path: normalizePath(root),
        })),
      }));
      return;
    }

    if (url.pathname === `${route}/source`) {
      const sourceRef = url.searchParams.get("ref")?.trim() ?? "";
      const resolvedSource = await resolveSourceReference(projectRoot, duLuaRoots, sourceRef);
      if (!resolvedSource) {
        res.statusCode = 404;
        res.end(`Source not found: ${sourceRef}`);
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        fileName: path.basename(resolvedSource.absolutePath),
        content: await fs.readFile(resolvedSource.absolutePath, "utf8"),
      }));
      return;
    }

    if (url.pathname !== `${route}/module`) {
      next();
      return;
    }

    const moduleName = url.searchParams.get("name")?.trim() ?? "";
    const fromSource = url.searchParams.get("from")?.trim() ?? "";
    const scope = url.searchParams.get("scope")?.trim() ?? "";
    const rootIndex = url.searchParams.get("rootIndex");
    const rootPath = url.searchParams.get("rootPath")?.trim() ?? "";
    const preferredRootIndex = rootIndex !== null ? Number.parseInt(rootIndex, 10) : Number.NaN;

    if (scope === "relative") {
      const relativeSource = fromSource
        ? await readLuaModuleRelativeToSource(projectRoot, duLuaRoots, fromSource, moduleName)
        : null;
      if (!relativeSource) {
        res.statusCode = 404;
        res.end(`Relative module not found: ${moduleName}`);
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        source: relativeSource.source,
        resolvedPath: relativeSource.resolvedRef,
      }));
      return;
    }

    if (scope === "project") {
      const projectModule = await readLuaModuleFromRoot(projectRoot, moduleName);
      if (!projectModule) {
        res.statusCode = 404;
        res.end(`Project module not found: ${moduleName}`);
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        source: projectModule.source,
        resolvedPath: createSourceRef("project", projectModule.resolvedPath),
      }));
      return;
    }

    if (scope === "du") {
      if (!Number.isInteger(preferredRootIndex) || preferredRootIndex < 0 || preferredRootIndex >= duLuaRoots.length) {
        res.statusCode = 404;
        res.end(`DU root not found: ${rootIndex ?? "unknown"}`);
        return;
      }

      const source = await readLuaModuleFromRoot(duLuaRoots[preferredRootIndex], moduleName);
      if (!source) {
        res.statusCode = 404;
        res.end(`DU module not found: ${moduleName}`);
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        source: source.source,
        resolvedPath: createDuSourceRef(source.resolvedPath, preferredRootIndex),
      }));
      return;
    }

    if (scope === "manual") {
      if (!rootPath) {
        res.statusCode = 404;
        res.end("Manual root path is missing");
        return;
      }

      const manualRoot = path.resolve(rootPath);
      const source = await readLuaModuleFromRoot(manualRoot, moduleName);
      if (!source) {
        res.statusCode = 404;
        res.end(`Manual module not found: ${moduleName}`);
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        source: source.source,
        resolvedPath: createManualSourceRef(manualRoot, source.resolvedPath),
      }));
      return;
    }

    if (fromSource) {
      const relativeSource = await readLuaModuleRelativeToSource(projectRoot, duLuaRoots, fromSource, moduleName);
      if (relativeSource) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({
          source: relativeSource.source,
          resolvedPath: relativeSource.resolvedRef,
        }));
        return;
      }
    }

    const projectModule = await readLuaModuleFromRoot(projectRoot, moduleName);
    if (projectModule) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        source: projectModule.source,
        resolvedPath: createSourceRef("project", projectModule.resolvedPath),
      }));
      return;
    }

    if (duLuaRoots.length === 0) {
      res.statusCode = 404;
      res.end("DU_LUA_ROOT is not configured");
      return;
    }

    const source = await readLuaModule(duLuaRoots, moduleName);
    if (source === null) {
      res.statusCode = 404;
      res.end(`Module not found: ${moduleName}`);
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      source: source.source,
      resolvedPath: createDuSourceRef(source.resolvedPath, source.rootIndex),
    }));
  };

  return {
    name: "du-lua-plugin",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => {
  const projectRoot = process.cwd();
  const env = loadEnv(mode, projectRoot, "");
  const duLuaRoots = parseDuLuaRoots(env.DU_LUA_ROOT, projectRoot);

  return {
    plugins: [tailwindcss(), react(), duLuaPlugin(duLuaRoots)],
    resolve: {
      alias: {
        module: path.resolve(projectRoot, "src/shims/browser-module.ts"),
        url: path.resolve(projectRoot, "src/shims/browser-url.ts"),
      },
    },
    test: {
      environment: "node",
      setupFiles: "./test/setup.ts",
    },
  };
});
