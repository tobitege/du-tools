# ItemExport2Json

CLI to export the myDU ItemBank to YAML and JSON via Orleans GameplayBank.

## Build

```bash
cd ItemExport2Json
dotnet build
```

## Run (host)

Ensure your myDU stack exposes Orleans 30000 and QUEUEING (e.g. <http://localhost:9630>), and you have a bot account.

```bash
SET QUEUEING=http://localhost:9630
SET BOT_LOGIN=bot
SET BOT_PASSWORD=secret
 dotnet run ./dual.yaml
```

Outputs:

- itembank.yaml
- itembank.json

Override filenames with env vars OUT_YAML and OUT_JSON.

Example console output:

```ps
> .\bin\Debug\net8.0\ItemExport2Json.exe      
Reading config...
could parse config file at 'dual.yaml'
Building services...
Starting services...
Services started.
Exporting ItemBank...
YAML received, length=1345956
Wrote YAML to D:\github\du-tobi\ItemExport2Json\itembank.yaml
Parsed 5575 YAML documents.
Wrote JSON to D:\github\du-tobi\ItemExport2Json\itembank.json
Export complete.
```
