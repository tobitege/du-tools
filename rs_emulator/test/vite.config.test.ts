import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseDuLuaRoots, readLuaModule, readLuaModuleRelativeToSource, resolveSourceReference } from "../vite.config";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rs-emulator-vite-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("DU_LUA_ROOT resolution", () => {
  it("parses semicolon-separated roots and resolves relative entries against the project root", () => {
    const projectRoot = path.join("D:", "github", "du-tobi", "rs_emulator");
    const absoluteRoot = path.join("E:", "dual-universe", "Game", "data", "lua");

    expect(parseDuLuaRoots(` "./examples/du-mocks" ; ${absoluteRoot} `, projectRoot)).toEqual([
      path.resolve(projectRoot, "./examples/du-mocks"),
      path.resolve(projectRoot, absoluteRoot),
    ]);
  });

  it("falls back to later DU roots when the first root does not contain the module", async () => {
    const firstRoot = await makeTempDir();
    const secondRoot = await makeTempDir();

    await fs.writeFile(path.join(secondRoot, "RenderScript.lua"), "-- from second root", "utf8");

    const resolved = await readLuaModule([firstRoot, secondRoot], "RenderScript");

    expect(resolved).not.toBeNull();
    expect(resolved?.rootIndex).toBe(1);
    expect(resolved?.resolvedPath).toBe("RenderScript.lua");
    expect(resolved?.source).toContain("second root");
  });

  it("keeps relative requires on the DU root that supplied the source file", async () => {
    const projectRoot = await makeTempDir();
    const firstRoot = await makeTempDir();
    const secondRoot = await makeTempDir();

    await fs.mkdir(path.join(firstRoot, "pkg"), { recursive: true });
    await fs.mkdir(path.join(secondRoot, "pkg"), { recursive: true });
    await fs.writeFile(path.join(secondRoot, "pkg", "main.lua"), "-- source", "utf8");
    await fs.writeFile(path.join(firstRoot, "pkg", "helper.lua"), "return 'wrong root'", "utf8");
    await fs.writeFile(path.join(secondRoot, "pkg", "helper.lua"), "return 'correct root'", "utf8");

    const relative = await readLuaModuleRelativeToSource(projectRoot, [firstRoot, secondRoot], "du[1]:pkg/main.lua", "helper");

    expect(relative).not.toBeNull();
    expect(relative?.resolvedRef).toBe("du[1]:pkg/helper.lua");
    expect(relative?.source).toContain("correct root");
  });

  it("resolves legacy du: references across all configured roots", async () => {
    const projectRoot = await makeTempDir();
    const firstRoot = await makeTempDir();
    const secondRoot = await makeTempDir();

    await fs.writeFile(path.join(secondRoot, "RenderScript.lua"), "-- legacy lookup", "utf8");

    const resolved = await resolveSourceReference(projectRoot, [firstRoot, secondRoot], "du:RenderScript.lua");

    expect(resolved).not.toBeNull();
    expect(resolved?.kind).toBe("du");
    expect(resolved?.rootIndex).toBe(1);
    expect(resolved?.absolutePath).toBe(path.join(secondRoot, "RenderScript.lua"));
  });

  it("resolves example files by basename for project-backed reloads", async () => {
    const projectRoot = await makeTempDir();
    const exampleDir = path.join(projectRoot, "examples");

    await fs.mkdir(exampleDir, { recursive: true });
    await fs.writeFile(path.join(exampleDir, "Locura-Atom.lua"), "-- atom example", "utf8");

    const resolved = await resolveSourceReference(projectRoot, [], "Locura-Atom.lua");

    expect(resolved).not.toBeNull();
    expect(resolved?.kind).toBe("project");
    expect(resolved?.relativePath).toBe("examples/Locura-Atom.lua");
  });
});
