import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_CONFIG_PATH = "D:\\MyDUserver\\config\\dual.yaml";
const DEFAULT_PSQL_PATH = "D:\\MyDUserver\\pgsql\\bin\\psql.exe";
const MATERIAL_RAW_SCALE = 16777216;
const MAX_FILTERED_SQL_IDS = 200;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    playerId: null,
    constructId: null,
    batchSize: 100,
    timeoutMs: 5000,
    serverPath: null,
    protocolVersion: "2024-11-05",
    ids: [],
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--player-id":
        options.playerId = Number.parseInt(argv[++index] ?? "", 10);
        break;
      case "--construct-id":
        options.constructId = Number.parseInt(argv[++index] ?? "", 10);
        break;
      case "--batch-size":
        options.batchSize = Number.parseInt(argv[++index] ?? "", 10);
        break;
      case "--timeout-ms":
        options.timeoutMs = Number.parseInt(argv[++index] ?? "", 10);
        break;
      case "--server-path":
        options.serverPath = argv[++index] ?? null;
        break;
      case "--protocol-version":
        options.protocolVersion = argv[++index] ?? options.protocolVersion;
        break;
      case "--id":
        options.ids.push(Number.parseInt(argv[++index] ?? "", 10));
        break;
      case "--verbose":
        options.verbose = true;
        break;
      default:
        fail(`Unknown helper argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.playerId) || options.playerId < 0) {
    fail("Missing or invalid --player-id.");
  }

  if (!Number.isInteger(options.constructId) || options.constructId < 0) {
    fail("Missing or invalid --construct-id.");
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 250) {
    fail("Invalid --batch-size. Expected 1..250.");
  }

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 250 || options.timeoutMs > 15000) {
    fail("Invalid --timeout-ms. Expected 250..15000.");
  }

  if (!options.serverPath) {
    fail("Missing --server-path.");
  }

  return options;
}

function getStructuredContent(toolResult, toolName) {
  if (!toolResult || typeof toolResult !== "object" || !toolResult.structuredContent) {
    throw new Error(`${toolName} did not return structuredContent.`);
  }

  return toolResult.structuredContent;
}

function writeProgress(message) {
  process.stderr.write(`${message}\n`);
}

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function resolveServerRuntime(serverPath) {
  const resolvedServerPath = path.resolve(serverPath);
  const serverFileName = path.basename(resolvedServerPath).toLowerCase();

  if (serverFileName === "run-mcp.cmd") {
    const serverDir = path.dirname(resolvedServerPath);
    return {
      serverDir,
      command: "node",
      args: ["dist/server.js"],
    };
  }

  if (serverFileName === "server.js" && path.basename(path.dirname(resolvedServerPath)).toLowerCase() === "dist") {
    const serverDir = path.dirname(path.dirname(resolvedServerPath));
    return {
      serverDir,
      command: "node",
      args: [resolvedServerPath],
    };
  }

  throw new Error(`Unsupported MCP server path: ${resolvedServerPath}`);
}

async function loadSdk(serverDir) {
  const sdkRoot = path.join(serverDir, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm", "client");
  const clientModuleUrl = pathToFileURL(path.join(sdkRoot, "index.js")).href;
  const transportModuleUrl = pathToFileURL(path.join(sdkRoot, "stdio.js")).href;

  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(clientModuleUrl),
    import(transportModuleUrl),
  ]);

  return { Client, StdioClientTransport };
}

function sanitizePipeValue(value) {
  return String(value ?? "").replaceAll("|", "/");
}

function parseSimpleYamlSections(configPath) {
  const text = fs.readFileSync(configPath, "utf8");
  const sections = {};
  let currentSection = null;

  for (const rawLine of text.split(/\r?\n/u)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) {
      continue;
    }

    if (!rawLine.startsWith(" ")) {
      const separatorIndex = rawLine.indexOf(":");
      if (separatorIndex < 0) {
        currentSection = null;
        continue;
      }

      const key = rawLine.slice(0, separatorIndex).trim();
      const remainder = rawLine.slice(separatorIndex + 1).trim();
      currentSection = key.length > 0 ? key : null;
      if (currentSection !== null) {
        sections[currentSection] = sections[currentSection] ?? {};
      }
      if (remainder.length > 0) {
        currentSection = null;
      }
      continue;
    }

    if (currentSection === null) {
      continue;
    }

    const line = rawLine.trim();
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/gu, "");
    if (key.length > 0) {
      sections[currentSection][key] = value;
    }
  }

  return sections;
}

function loadDbConfig(configPath, sectionName) {
  const sections = parseSimpleYamlSections(configPath);
  const section = sections[sectionName];
  if (!section) {
    throw new Error(`Section ${sectionName} not found in ${configPath}`);
  }

  const host = section.host;
  const port = Number.parseInt(section.port ?? "", 10);
  const database = section.database;
  const user = section.user;
  const password = section.password ?? "";
  if (!host || !Number.isInteger(port) || port <= 0 || !database || !user) {
    throw new Error(`Section ${sectionName} is missing required database keys in ${configPath}`);
  }

  return {
    host,
    port,
    database,
    user,
    password: password.length > 0 ? password : null,
  };
}

function runPsqlJsonLines(psqlPath, dbConfig, sql) {
  const environment = { ...process.env };
  if (dbConfig.password) {
    environment.PGPASSWORD = dbConfig.password;
  }

  const completed = spawnSync(
    psqlPath,
    [
      "-X",
      "-h",
      dbConfig.host,
      "-p",
      String(dbConfig.port),
      "-U",
      dbConfig.user,
      "-d",
      dbConfig.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `COPY (${sql}) TO STDOUT`,
    ],
    {
      encoding: "utf8",
      env: environment,
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  if (completed.status !== 0) {
    const errorText = (completed.stderr || completed.stdout || "psql failed").trim();
    throw new Error(errorText);
  }

  const rows = [];
  for (const rawLine of completed.stdout.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      rows.push(parsed);
    }
  }

  return rows;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asInt(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function convertRawQuantityToDisplay(rawQuantity) {
  if (!Number.isFinite(rawQuantity)) {
    return null;
  }

  if (Math.abs(rawQuantity) >= MATERIAL_RAW_SCALE) {
    return rawQuantity / MATERIAL_RAW_SCALE;
  }

  return rawQuantity;
}

function compactNumber(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (Math.abs(value - Math.round(value)) < 1e-12) {
    return Math.round(value);
  }

  return Number(value.toFixed(3));
}

function renderSqlIntegerList(values) {
  return values.map((value) => String(Math.trunc(value))).join(", ");
}

function renderSqlTextIntegerList(values) {
  return values.map((value) => `'${String(Math.trunc(value))}'`).join(", ");
}

function loadElementInfo(psqlPath, dualDbConfig, constructId, requestedLocalIds) {
  const localIdFilter = requestedLocalIds.length > 0 && requestedLocalIds.length <= MAX_FILTERED_SQL_IDS
    ? `\n      AND local_id IN (${renderSqlIntegerList(requestedLocalIds)})`
    : "";
  const sql = `
    SELECT json_build_object(
      'element_id', id,
      'local_id', local_id,
      'name', (
        SELECT convert_from(p.value, 'UTF8')
        FROM public.element_property p
        WHERE p.element_id = public.element.id
          AND p.name = 'name'
        LIMIT 1
      )
    )::text
    FROM public.element
    WHERE construct_id = ${constructId}
      AND local_id IS NOT NULL
${localIdFilter}
  `;

  const rows = runPsqlJsonLines(psqlPath, dualDbConfig, sql);
  const byElementId = new Map();
  const byLocalId = new Map();

  for (const row of rows) {
    const elementId = asInt(row.element_id);
    const localId = asInt(row.local_id);
    if (elementId === null || localId === null || localId <= 0) {
      continue;
    }

    const entry = {
      elementId,
      localId,
      name: asNonEmptyString(row.name),
    };
    byElementId.set(elementId, entry);
    byLocalId.set(localId, entry);
  }

  return { byElementId, byLocalId };
}

function loadIndustryPayloads(psqlPath, orleansDbConfig, constructId, requestedElementIds) {
  const elementIdFilter = requestedElementIds.length > 0 && requestedElementIds.length <= MAX_FILTERED_SQL_IDS
    ? `\n      AND grainidextensionstring IN (${renderSqlTextIntegerList(requestedElementIds)})`
    : "";
  const sql = `
    SELECT json_build_object(
      'element_id', grainidextensionstring,
      'payload', payloadjson
    )::text
    FROM public.storage
    WHERE graintypestring = 'IndustryUnitGrain'
      AND payloadjson->'stats'->>'parentConstruct' = '${constructId}'
${elementIdFilter}
  `;

  return runPsqlJsonLines(psqlPath, orleansDbConfig, sql);
}

function buildRuntimeRows(psqlPath, configPath, constructId, requestedLocalIds) {
  const dualDbConfig = loadDbConfig(configPath, "postgres");
  const orleansDbConfig = loadDbConfig(configPath, "orleanspostgres");
  const elementInfo = loadElementInfo(psqlPath, dualDbConfig, constructId, requestedLocalIds);
  const payloadRows = loadIndustryPayloads(
    psqlPath,
    orleansDbConfig,
    constructId,
    [...elementInfo.byElementId.keys()]
  );
  const rowsByLocalId = new Map();

  for (const row of payloadRows) {
    const payload = asRecord(row.payload) ?? {};
    const stats = asRecord(payload.stats) ?? {};
    const elementId = asInt(row.element_id) ?? asInt(stats.elementId);
    if (elementId === null) {
      continue;
    }

    const elementEntry = elementInfo.byElementId.get(elementId);
    if (!elementEntry) {
      continue;
    }

    rowsByLocalId.set(elementEntry.localId, {
      localId: elementEntry.localId,
      name: elementEntry.name,
      payload,
    });
  }

  return rowsByLocalId;
}

function buildExportEntry(requestedEntry, runtimeRow) {
  const payload = runtimeRow?.payload ?? {};
  const currentRecipe = asRecord(payload.currentRecipe) ?? {};
  const products = Array.isArray(currentRecipe.products) ? currentRecipe.products : [];
  const firstProduct = asRecord(products[0]) ?? {};
  const firstProductQuantity = asRecord(firstProduct.quantity) ?? {};
  const recipeId = asInt(payload.recipeId) ?? asInt(payload.nextRecipeId) ?? asInt(currentRecipe.id) ?? 0;
  const productItemTypeId = asInt(firstProduct.itemId);
  const rawBatchOutputQuantity = asNumber(firstProductQuantity.quantity);
  const batchOutputQuantity = compactNumber(convertRawQuantityToDisplay(rawBatchOutputQuantity));
  const batchTime = compactNumber(asNumber(currentRecipe.time));
  const maintainProductAmount = asNumber(payload.maintainProductAmount);
  const maintainQuantity = compactNumber(convertRawQuantityToDisplay(maintainProductAmount));
  const hasRecipe = recipeId > 0;
  const isMaintain = Number.isFinite(maintainProductAmount) && maintainProductAmount > 0;
  const safeName = sanitizePipeValue(runtimeRow?.name ?? requestedEntry.name ?? requestedEntry.id);
  const mode = !hasRecipe ? "Stopped" : (isMaintain ? "Maintain" : "Run");

  const exportEntry = {
    name: safeName,
    recipeId,
    ...(productItemTypeId !== null ? { productItemTypeId } : {}),
    ...(batchOutputQuantity !== null ? { batchOutputQuantity } : {}),
    ...(batchTime !== null ? { batchTime } : {}),
  };

  if (hasRecipe) {
    exportEntry.mode = mode;
  }

  if (isMaintain && maintainQuantity !== null) {
    exportEntry.maintainQuantity = maintainQuantity;
  }

  return exportEntry;
}

async function resolveRequestedIds(client, options) {
  if (options.ids.length > 0) {
    const ids = [...new Set(options.ids)];
    writeProgress(`Using ${ids.length} explicitly requested id(s).`);
    return ids.map((id) => ({ id, name: "" }));
  }

  writeProgress("Calling du_construct_describe to enumerate construct elements...");
  const describeResult = await withTimeout(
    client.callTool({
      name: "du_construct_describe",
      arguments: {
        playerId: options.playerId,
        constructId: options.constructId,
        timeoutMs: 5000,
      },
    }),
    30000,
    "du_construct_describe"
  );

  const describeStructuredContent = getStructuredContent(describeResult, "du_construct_describe");
  const industryElements = Array.isArray(describeStructuredContent?.industryElements)
    ? describeStructuredContent.industryElements
    : [];
  const orderedEntries = industryElements
    .filter((entry) => Number.isInteger(entry?.id) && entry.id > 0)
    .map((entry) => ({
      id: entry.id,
      name: typeof entry?.name === "string" ? entry.name : "",
    }));
  if (orderedEntries.length === 0) {
    throw new Error("du_construct_describe did not return any industryElements.");
  }

  writeProgress(`Resolved ${orderedEntries.length} industry element id(s) from du_construct_describe.`);
  return orderedEntries;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtime = resolveServerRuntime(options.serverPath);
  const { Client, StdioClientTransport } = await loadSdk(runtime.serverDir);

  const transport = new StdioClientTransport({
    command: runtime.command,
    args: runtime.args,
    cwd: runtime.serverDir,
    env: process.env,
    stderr: options.verbose ? "pipe" : "inherit",
  });

  if (options.verbose && transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      process.stderr.write(`[DuMcpBridge] ${chunk}`);
    });
  }

  const client = new Client(
    {
      name: "indy-export-csharp-helper",
      version: "0.1.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    writeProgress("Starting MCP client...");
    await withTimeout(client.connect(transport), 30000, "mcp_connect");
    writeProgress("MCP session initialized.");

    const requestedEntries = await resolveRequestedIds(client, options);
    writeProgress(`Loading SQL runtime data for ${requestedEntries.length} industry element(s)...`);

    const configPath = process.env.DU_EXPORT_CONFIG_PATH ?? DEFAULT_CONFIG_PATH;
    const psqlPath = process.env.DU_EXPORT_PSQL_PATH ?? DEFAULT_PSQL_PATH;
    const runtimeRowsByLocalId = buildRuntimeRows(
      psqlPath,
      configPath,
      options.constructId,
      requestedEntries.map((entry) => entry.id)
    );

    const exportTable = {};
    for (const requestedEntry of requestedEntries) {
      const runtimeRow = runtimeRowsByLocalId.get(requestedEntry.id) ?? null;
      exportTable[String(requestedEntry.id)] = buildExportEntry(requestedEntry, runtimeRow);
    }

    process.stdout.write(JSON.stringify(exportTable));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
