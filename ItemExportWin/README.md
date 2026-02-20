# ItemExportWin – User Manual

## Overview

ItemExportWin is a Windows Forms utility to export myDU game data. It connects to the myDU Orleans backend (configured via `dual.yaml`) and a Queueing service, and can export:

- Item bank: YAML (optional) and JSON
- Recipes: JSON with filtering

It also provides quick lookups for items (by name) and recipes (by ID).

## Requirements

- myDU server environment reachable from your machine
- `dual.yaml` placed next to the executable (copied to output by the project)
- Queueing service URL (defaults to `http://localhost:9630`)

## Starting the app

1. Build and run the `ItemExportWin` project.
2. Ensure `dual.yaml` and `groups.txt` are copied next to the executable (handled by the project configuration).

## Connecting

- Queueing BaseUrl: Set the base URL of the Queueing service. Default: `http://localhost:9630`.
- Click “Test Connection” to verify connectivity. The log will show counts for items and recipes.

## Output paths

- Output JSON Path: Path used as default in the Save dialog for the items/recipes JSON.
- Output YAML Path: Path used as default in the Save dialog for the item bank YAML (when enabled).
- Export YAML: If checked, the item bank YAML will be saved alongside JSON.

When exporting, the app opens Save As dialogs for each file:
    - YAML is optional (only shown if “Export YAML” is checked).
    - JSON is mandatory; canceling the dialog aborts the export.

## Export mode

Use the “Mode” dropdown (top of the Recipes group):
    - Recipes Only (default)
    - Items only
    - Items and Recipes

If “Items and Recipes” is selected, recipes are saved next to the items JSON as `<name>.recipes.json`.

## Filters

### Required properties

- The item must contain all checked properties to be included (future filtering support). Labels reflect exported names:
  - Size (from `scale`)
  - Tier (from `level`)

### Recipes filters

- Nanocraftable only: Limits to recipes craftable in Nanocrafter.
- Max time (seconds): Filters recipes with time ≤ value.
- Limit: Truncates the recipe list to the given count.

### Item filters

- Size: Individual checkboxes XS, S, M, L, XL, XXL, XXXL. All checked by default (no size filter). Uncheck to filter sizes.
- Tier: Provide optional min/max (1–5). If either bound is set, items without a tier are excluded.

### Excluded items

- Items with `parent` of `GameplayObject` or `DataItem` are excluded from item export.

## Export steps

1. Choose Mode.
2. Optionally set recipe filters (Nanocraftable, Time, Limit).
3. Optionally set item filters (Size, Tier min/max).
4. Click “Export”.
5. Choose the save locations in the dialog(s).
6. Watch the log for completion and output paths.

## Lookups

### Recipe by ID

- Enter a recipe numeric ID in “Item # Lookup”.
- Click “Lookup Id”.
- The full YAML for that recipe is displayed in the log (or “not found”).

### Item by name

- Enter an item name in “Item Name Lookup”.
- Click “Lookup Name”.
- The full YAML for that item is displayed in the log (or “not found”).

## Notes

- `groups.txt` is loaded at startup and de-duplicated for future filtering features.
- The log is read-only and shows detailed results and errors.

## Troubleshooting

- “Config file 'dual.yaml' not found”: Ensure `dual.yaml` is next to the executable or in the working directory when running from IDE.
- Connection errors: Verify Queueing BaseUrl and that the myDU services are running.
- Empty exports: Check filters (size or tier bounds) and ensure you didn’t exclude all sizes.

## Queueing authentication (ItemExportWin)

ItemExportWin can attach optional auth headers to the Queueing HTTP client based on values in `dual.yaml`.

Put these keys under the `itemexport.queueing` section:

- api_key: when set, sent as an `X-Api-Key` header
- bearer_token: when set, sent as an `Authorization: Bearer <token>` header
- basic_user / basic_pass: when set, sent as `Authorization: Basic <base64(user:pass)>`

Precedence if multiple are present:

1) bearer_token
2) basic_user/basic_pass
3) api_key

Example `dual.yaml` excerpt:

```yaml
env: local
itemexport:
  queueing:
    # Use ONE of the following credential styles
    # 1) API key header
    # api_key: "my-secret-key"

    # 2) Bearer token
    # bearer_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

    # 3) Basic auth
    # basic_user: "user"
    # basic_pass: "pass"
```

Notes:

- If no keys are set, requests are sent without auth headers.
- The Queueing URL is taken from the app UI (defaults to `http://queueing:9630`).
