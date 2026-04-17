<#
.SYNOPSIS
Converts RecipesGroups.json into a normalized SQLite database using sqlite3 CLI.

.DESCRIPTION
Reads RecipesGroups.json, parses every recipe entry, and writes four tables
into a SQLite database using the sqlite3 command-line tool:

  item_groups        - unique groups keyed by GroupId
  items              - one row per JSON entry, keyed by NqId
  recipe_products    - one row per product per recipe
  recipe_ingredients - one row per ingredient per recipe

The output file is RecipesGroups.sqlite next to the JSON source.

.PARAMETER SourcePath
Path to RecipesGroups.json. Defaults to the file next to this script.

.PARAMETER OutputPath
Path to the SQLite database file. Defaults to RecipesGroups.sqlite
next to the source JSON.

.EXAMPLE
.\convert-recipes-to-sqlite.ps1
#>
param(
    [string]$SourcePath = (Join-Path $PSScriptRoot 'RecipesGroups.json'),
    [string]$OutputPath = (Join-Path $PSScriptRoot 'RecipesGroups.sqlite')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $SourcePath)) {
    Write-Error "Source file not found: $SourcePath"
    exit 1
}

# Find sqlite3 — prefer Android SDK path, then PATH
$sqlite3Candidates = @(
    'C:\Users\tobias\AppData\Local\Android\Sdk\platform-tools\sqlite3.exe'
)
$sqlite3 = $null
foreach ($c in $sqlite3Candidates) {
    if (Test-Path $c) { $sqlite3 = $c; break }
}
if (-not $sqlite3) {
    $cmd = Get-Command sqlite3 -ErrorAction SilentlyContinue
    if ($cmd) { $sqlite3 = $cmd.Source }
}
if (-not $sqlite3) {
    Write-Error "sqlite3 not found. Install it or add to PATH."
    exit 1
}

Write-Host "Using sqlite3: $sqlite3"

# --- Read and parse JSON ---
Write-Host "Reading $SourcePath ..."
$jsonText = [System.IO.File]::ReadAllText($SourcePath)
$entriesObj = $jsonText | ConvertFrom-Json

# --- Remove existing DB ---
if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}

# --- Build SQL script in memory ---
$sb = [System.Text.StringBuilder]::new()

[void]$sb.AppendLine("PRAGMA journal_mode = OFF;")
[void]$sb.AppendLine("PRAGMA synchronous = OFF;")
[void]$sb.AppendLine("PRAGMA page_size = 4096;")
[void]$sb.AppendLine()

# --- Create tables ---
[void]$sb.AppendLine(@"
CREATE TABLE item_groups (
    group_id  TEXT PRIMARY KEY,
    name      TEXT NOT NULL
);
CREATE INDEX idx_item_groups_name ON item_groups(name);

CREATE TABLE items (
    nq_id            INTEGER PRIMARY KEY,
    name             TEXT NOT NULL,
    recipe_id        INTEGER NOT NULL,
    group_id         TEXT    NOT NULL,
    level            INTEGER NOT NULL,
    size             TEXT,
    industry         TEXT,
    unit_mass        REAL,
    unit_volume      REAL,
    nanocraftable    INTEGER NOT NULL DEFAULT 0,
    json_key         TEXT NOT NULL,
    schema_type      TEXT,
    schema_price     REAL,
    FOREIGN KEY (group_id) REFERENCES item_groups(group_id)
);
CREATE INDEX idx_items_name        ON items(name);
CREATE INDEX idx_items_recipe_id   ON items(recipe_id);
CREATE INDEX idx_items_group_id    ON items(group_id);
CREATE INDEX idx_items_level       ON items(level);
CREATE INDEX idx_items_industry   ON items(industry);
CREATE INDEX idx_items_name_level ON items(name, level);
CREATE INDEX idx_items_group_level ON items(group_id, level);

CREATE TABLE recipe_products (
    recipe_id        INTEGER NOT NULL,
    product_type     TEXT    NOT NULL,
    product_name     TEXT    NOT NULL,
    product_quantity REAL    NOT NULL,
    PRIMARY KEY (recipe_id, product_type)
);
CREATE INDEX idx_recipe_products_type ON recipe_products(product_type);
CREATE INDEX idx_recipe_products_name ON recipe_products(product_name);

CREATE TABLE recipe_ingredients (
    recipe_id          INTEGER NOT NULL,
    ingredient_type    TEXT    NOT NULL,
    ingredient_name    TEXT    NOT NULL,
    ingredient_quantity REAL   NOT NULL,
    PRIMARY KEY (recipe_id, ingredient_type)
);
CREATE INDEX idx_recipe_ingredients_type ON recipe_ingredients(ingredient_type);
CREATE INDEX idx_recipe_ingredients_name ON recipe_ingredients(ingredient_name);

BEGIN TRANSACTION;
"@)

# --- Generate INSERT statements ---
$totalEntries = 0

function Escape-Sql([string]$v) {
    if ($null -eq $v) { return 'NULL' }
    return "'" + ($v -replace "'", "''") + "'"
}

function Get-Prop($obj, [string]$prop) {
    # Safe property access on PSCustomObject
    if ($null -eq $obj) { return $null }
    $val = $obj.PSObject.Properties[$prop]
    if ($null -eq $val) { return $null }
    return $val.Value
}

$entriesKeys = $entriesObj.PSObject.Properties.Name
foreach ($key in $entriesKeys) {
    $obj = $entriesObj.$key

    if ($null -eq (Get-Prop $obj 'NqId')) { continue }

    $nqId          = [int64](Get-Prop $obj 'NqId')
    $name          = [string](Get-Prop $obj 'Name')
    $recipeId      = [int64](Get-Prop $obj 'Id')
    $groupId       = [string](Get-Prop $obj 'GroupId')
    $groupName     = [string](Get-Prop $obj 'ParentGroupName')
    $level         = [int](Get-Prop $obj 'Level')
    $sizeRaw       = Get-Prop $obj 'Size'
    $size          = if ($null -ne $sizeRaw) { [string]$sizeRaw } else { $null }
    $industryRaw   = Get-Prop $obj 'Industry'
    $industry      = if ($null -ne $industryRaw) { [string]$industryRaw } else { $null }
    $unitMassRaw   = Get-Prop $obj 'UnitMass'
    $unitMass      = if ($null -ne $unitMassRaw) { [double]$unitMassRaw } else { 0.0 }
    $unitVolumeRaw = Get-Prop $obj 'UnitVolume'
    $unitVolume    = if ($null -ne $unitVolumeRaw) { [double]$unitVolumeRaw } else { 0.0 }
    $nanoRaw       = Get-Prop $obj 'Nanocraftable'
    $nanocraftable = if ($null -ne $nanoRaw -and [bool]$nanoRaw) { 1 } else { 0 }
    $schemaTypeRaw = Get-Prop $obj 'SchemaType'
    $schemaType    = if ($null -ne $schemaTypeRaw) { [string]$schemaTypeRaw } else { $null }
    $schemaPriceRaw = Get-Prop $obj 'SchemaPrice'
    $schemaPrice   = if ($null -ne $schemaPriceRaw) { [double]$schemaPriceRaw } else { 0.0 }

    # Group insert
    [void]$sb.AppendLine("INSERT OR IGNORE INTO item_groups (group_id, name) VALUES ($(Escape-Sql $groupId), $(Escape-Sql $groupName));")

    # Item insert
    $sizeVal        = if ($null -ne $size)          { Escape-Sql $size }       else { 'NULL' }
    $industryVal    = if ($null -ne $industry)      { Escape-Sql $industry }   else { 'NULL' }
    $schemaTypeVal  = if ($null -ne $schemaType)    { Escape-Sql $schemaType } else { 'NULL' }

    [void]$sb.AppendLine("INSERT OR IGNORE INTO items (nq_id, name, recipe_id, group_id, level, size, industry, unit_mass, unit_volume, nanocraftable, json_key, schema_type, schema_price) VALUES ($nqId, $(Escape-Sql $name), $recipeId, $(Escape-Sql $groupId), $level, $sizeVal, $industryVal, $unitMass, $unitVolume, $nanocraftable, $(Escape-Sql $key), $schemaTypeVal, $schemaPrice);")

    # Products
    $products = Get-Prop $obj 'Products'
    if ($null -ne $products) {
        foreach ($prod in $products) {
            $pType = [string](Get-Prop $prod 'Type')
            $pName = [string](Get-Prop $prod 'Name')
            $pQty  = [double](Get-Prop $prod 'Quantity')
            [void]$sb.AppendLine("INSERT OR IGNORE INTO recipe_products (recipe_id, product_type, product_name, product_quantity) VALUES ($recipeId, $(Escape-Sql $pType), $(Escape-Sql $pName), $pQty);")
        }
    }

    # Ingredients
    $ingredients = Get-Prop $obj 'Ingredients'
    if ($null -ne $ingredients) {
        foreach ($ing in $ingredients) {
            $iType = [string](Get-Prop $ing 'Type')
            $iName = [string](Get-Prop $ing 'Name')
            $iQty  = [double](Get-Prop $ing 'Quantity')
            [void]$sb.AppendLine("INSERT OR IGNORE INTO recipe_ingredients (recipe_id, ingredient_type, ingredient_name, ingredient_quantity) VALUES ($recipeId, $(Escape-Sql $iType), $(Escape-Sql $iName), $iQty);")
        }
    }

    $totalEntries++
    if (($totalEntries % 500) -eq 0) {
        [void]$sb.AppendLine("COMMIT;")
        [void]$sb.AppendLine("BEGIN TRANSACTION;")
    }
}

[void]$sb.AppendLine("COMMIT;")
[void]$sb.AppendLine()
[void]$sb.AppendLine("PRAGMA journal_mode = DELETE;")
[void]$sb.AppendLine("PRAGMA synchronous = NORMAL;")
[void]$sb.AppendLine("VACUUM;")

# --- Write SQL file and execute ---
$sqlPath = $OutputPath -replace '\.sqlite$', '.sql.tmp'
$sb.ToString() | Out-File -FilePath $sqlPath -Encoding utf8

Write-Host "Wrote SQL script ($totalEntries entries) to $sqlPath"
Write-Host "Running sqlite3 to create $OutputPath ..."

& $sqlite3 $OutputPath ".read `"$sqlPath`""

# Clean up temp SQL file
Remove-Item $sqlPath -Force -ErrorAction SilentlyContinue

Write-Host "Done. $totalEntries items inserted into $OutputPath"

# Quick stats
$dbInfo = & $sqlite3 $OutputPath "SELECT COUNT(*) FROM items;"
Write-Host "  items:             $dbInfo"
$dbInfo = & $sqlite3 $OutputPath "SELECT COUNT(DISTINCT group_id) FROM item_groups;"
Write-Host "  distinct groups:   $dbInfo"
$dbInfo = & $sqlite3 $OutputPath "SELECT COUNT(*) FROM recipe_products;"
Write-Host "  recipe_products:   $dbInfo"
$dbInfo = & $sqlite3 $OutputPath "SELECT COUNT(*) FROM recipe_ingredients;"
Write-Host "  recipe_ingredients:$dbInfo"