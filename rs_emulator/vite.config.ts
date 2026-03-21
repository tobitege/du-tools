import { promises as fs } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";

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

async function readLuaModule(root: string, moduleName: string): Promise<string | null> {
  if (!isSafeModuleName(moduleName)) {
    return null;
  }

  for (const parts of buildLuaModuleCandidates(moduleName)) {
    const filePath = path.join(root, ...parts) + ".lua";
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      // try next candidate
    }
  }

  return null;
}

function duLuaPlugin(duLuaRoot: string | undefined): Plugin {
  const route = "/__du_lua";

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url) {
      next();
      return;
    }

    const url = new URL(req.url, "http://localhost");

    if (url.pathname === `${route}/status`) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        configured: Boolean(duLuaRoot),
        rootPath: duLuaRoot ?? null,
      }));
      return;
    }

    if (url.pathname !== `${route}/module`) {
      next();
      return;
    }

    const moduleName = url.searchParams.get("name")?.trim() ?? "";
    if (!duLuaRoot) {
      res.statusCode = 404;
      res.end("DU_LUA_ROOT is not configured");
      return;
    }

    const source = await readLuaModule(duLuaRoot, moduleName);
    if (source === null) {
      res.statusCode = 404;
      res.end(`Module not found: ${moduleName}`);
      return;
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(source);
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
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), duLuaPlugin(env.DU_LUA_ROOT)],
    test: {
      environment: "node",
      setupFiles: "./test/setup.ts",
    },
  };
});
