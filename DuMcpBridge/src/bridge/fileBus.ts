import { promises as fs } from "node:fs";
import { dirname, extname, join } from "node:path";

export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const json = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(tempPath, json, "utf8");
  await fs.rename(tempPath, filePath);
}

export async function appendNdjson(filePath: string, record: unknown): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readJsonFileIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(stripUtf8Bom(raw)) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export async function readTextFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function listFilesByMtime(directory: string, fileExtension?: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .filter((entry) => !fileExtension || extname(entry.name).toLowerCase() === fileExtension)
        .map(async (entry) => {
          const fullPath = join(directory, entry.name);
          const stats = await fs.stat(fullPath);
          return {
            fullPath,
            mtimeMs: stats.mtimeMs
          };
        })
    );

    files.sort((left, right) => left.mtimeMs - right.mtimeMs);
    return files.map((entry) => entry.fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function readNdjsonRecords<T>(directory: string, limit = 100): Promise<T[]> {
  const files = await listFilesByMtime(directory, ".ndjson");
  const records: T[] = [];

  for (const filePath of files) {
    const raw = await readTextFileIfExists(filePath);
    if (!raw) {
      continue;
    }

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        records.push(JSON.parse(trimmed) as T);
      } catch {
        continue;
      }
    }
  }

  return records.slice(-limit);
}

export async function tailTextFileLines(filePath: string, limit: number): Promise<string[]> {
  const raw = await readTextFileIfExists(filePath);
  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-limit);
}

export async function statFileIfExists(filePath: string): Promise<{ mtimeUtc: string } | null> {
  try {
    const stats = await fs.stat(filePath);
    return {
      mtimeUtc: stats.mtime.toISOString()
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
