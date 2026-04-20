# indy-export-csharp

Small C# wrapper that exports one construct's industry setup as a Lua table.

It uses two data sources:

- `DuMcpBridge` / `du_construct_describe` for fast industry element discovery on the target construct
- direct PostgreSQL reads for the actual export values such as `recipeId`, `batchTime`, `batchOutputQuantity`, and maintain targets

The final Lua file is written by the C# app. The Node helper only produces JSON for the C# app to consume.

## Output

The exporter writes a Lua table keyed by construct-local industry id.

Configured industry rows look like this:

```lua
[126] = {
    name = "Smelter Al Fe A1",
    recipeId = 553755522,
    productItemTypeId = 18262914,
    batchOutputQuantity = 86.25,
    batchTime = 112.5,
    mode = "Maintain",
    maintainQuantity = 10000,
}
```

If `recipeId` is `0`, only the minimal row is written:

```lua
[29] = {
    name = "IndustryHoneycomber",
    recipeId = 0,
}
```

## Requirements

- built `DuMcpBridge`
- working `DuMcpBridge\run-mcp.cmd`
- access to the myDU PostgreSQL databases
- default config paths expected by the helper:
  - `D:\MyDUserver\config\dual.yaml`
  - `D:\MyDUserver\pgsql\bin\psql.exe`

Optional overrides:

- `DU_EXPORT_CONFIG_PATH`
- `DU_EXPORT_PSQL_PATH`

## Run

From this folder:

```powershell
dotnet run --project . -- --player-id 10000 --construct-id 1002090 --server-path D:\github\du-tobi\DuMcpBridge\run-mcp.cmd
```

Default output:

```text
.\industry-batch-export-1002090.lua
```

Useful options:

- `--output <path>` write to a specific Lua file
- `--id <id[,id2,...]>` export only selected local industry ids
- `--timeout-ms <n>` MCP timeout for construct discovery
- `--verbose` forward bridge stderr while running

## Notes

- Full-construct export discovers all industry ids through `du_construct_describe.industryElements`.
- SQL is used for runtime/export values because it is much faster than live per-element bridge reads on large constructs.
- `mode` is only exported when a recipe exists.
