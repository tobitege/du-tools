## Part-Named Industry Setup Workflow

Given a **part name** (e.g. "Screw", "Pipe", "Connector"), find, classify, name, and configure every related producer and container branch.

### Required Context

- Use `constructId=1002090` and `playerId=10000` on every MCP call.
- Stay on the MCP/mod bridge path.
- Read the current working notes first when they are relevant or user-named.
- Treat `du_construct_runtime_availability` as a warning signal. If it says live reads are not expected, try one narrow `du_industry_describe_batch` or `du_storage_describe` before deciding live verification is unavailable.
- Do not configure a branch until its role is proven from links, not just names.

### Tier Abbreviations
| Tag | Meaning |
|---|---|
| `Bas` | Basic (T1) |
| `Unc` | Uncommon (T2) |
| `Adv` | Advanced (T3) |
| `Rare` | Rare (T4) |

### Container Size Abbreviations
| Tag | Capacity | Type name |
|---|---|---|
| `XS` | 1,500 L | ContainerSmall |
| `S` | 12,000 L | ContainerMedium |
| `M` | ~64,000 L | ContainerHub or large |
| `L`, `XL` | larger hubs |

### Step 1 — Discover all named containers

```
du_construct_index_query(constructId=1002090, playerId=10000, category="container", nameContains=<partName>, limit=50)
```

Group results by tier+size tag from the container name:
- e.g. "Bas Screw S1A FULL", "Unc Screw S2", "Adv Screw XS1"
- Parse each container name as: `{Tier} {Part} {Size}{Line} [status]`
- Sizes: `S1`, `S2A`, `XS1`, `S1B` etc. — the number/letter after the size tag distinguishes parallel lines
- Keep `Support`, `Supply`, `Main`, and `Source` containers in the candidate set, but classify them before treating them as output banks.
- A container matching `<partName>` may be a producer output, a relay target, a support/input box, or a final consumer box.

### Step 2 — Classify every container

For each container, start with `du_construct_index_related(id=<containerId>, maxDepth=1)`.
For producer-looking output buffers, also use:

```
du_construct_index_describe_industry_branch(id=<containerId>, limit=5)
```

Classify by proven links:

| Link pattern | Classification |
|---|---|
| `industry_output_to_storage` from metalwork/electronics/3dprinter/etc. | **Direct producer output** — owns producer bank |
| `industry_output_to_storage` from TransferUnit only | **TU-fed relay** — no local producers to name |
| Mixed TransferUnit + producers feeding the same storage | **Hybrid** — name/configure only the proven producer subset |
| Storage feeds producers through `storage_to_industry_input` | **Support/input buffer** — verify source TU and contents; do not name as an output bank |
| Storage feeds only downstream consumers/TUs | **Final or relay consumer box** — verify routing; do not name producers |
| No inbound industry and no useful outbound branch | **Source/storage-only** — skip unless it is a proven feeder source |

For each **direct producer output** container, collect all direct producer elements of the matching family from the `related` result.
For each producer, separately prove:

- output storage
- direct support/input storage
- feeder TU for each support storage
- source storage behind the feeder TU

### Step 3 — Name unnamed producers

Naming pattern:

```
{Tier} {Part} {ContainerLineSuffix}-{index}
```

Examples from container → producer names:

- Container `Unc Screw S1 Source` → `Unc Screw S1-1` .. `Unc Screw S1-8`
- Container `Bas Screw S1A FULL` → `Bas Screw S1A-1` .. `Bas Screw S1A-10`
- Container `Bas Screw S2A` → `Bas Screw S2A-1` .. `Bas Screw S2A-10`
- Container `Adv Screw S1` → already named `Adv Screw 1`..`10` → no rename

Rules:

- Skip already-named producers whose names match the expected pattern.
- Strip trailing `FULL` / `Source` / `Supply` from the container name when building the producer prefix.
- Use the container's full line identifier after the size tag (e.g. `S1A`, `S2A`, `S1`) as the producer prefix suffix.
- For T2+ producers that already carry a descriptive name, leave them unless they are still default-named. Existing names like `Adv <Part> 1`..`Adv <Part> 10` are acceptable even if they do not include `S1`.
- After `du_construct_rename_elements`, run `du_construct_index_refresh` before verifying names through index reads. Immediate index reads can still show stale names.

### Step 4 — Discover any unconfigured producers

For the collected producer IDs, `du_industry_describe_batch`. Identify:

- **No recipe set** → needs recipe assignment
- **Stopped / idle with recipe** → may need start or support fix
- **Running** → verify only, do not touch unless explicitly asked
- **Pending with current quantity at or above maintain target** → normal output-above-target state, not a setup blocker

### Step 5 — Configure unconfigured producers

For each tier, resolve the matching recipe:

```
du_industry_resolve_recipes(entries=[{id, itemName: "<tierPartItemName>"}])
```

Then configure in homogeneous batches (same element type per batch):

```
du_industry_configure_batch(entries=[{id, mode:"maintain", recipeId, amount:<target>, ...}])
```

For small part producer output buffers, prefer `maintain` rather than `run`.
Use the branch-specific target from notes when available; otherwise a common S-buffer target is `10000` for 1 L parts in a 12000 L container.
Never mix industry kinds in one configure batch.

### Required target volume checks

Before any `maintain` write, prove the target fits the actual output or support storage.

For a single-product output container:

```
targetQuantity * productUnitVolumeL <= storageMaxVolumeL * 0.90
```

If the item volume is unknown, do not write the target. Resolve the item volume through the MCP bridge or stop and record the missing metadata.

For shared support/input containers fed by multiple TUs:

1. Prove every feeder TU, product item, source storage, and downstream consumer linked to the support box.
2. Compute the usable support volume:

```
usableVolumeL = storageMaxVolumeL * 0.90
```

3. Allocate that usable volume across the required support products before configuring any feeder TU.
4. For each product:

```
targetQuantity = floor(allocatedVolumeL / productUnitVolumeL)
```

5. Verify the sum of all configured item targets fits:

```
sum(targetQuantity_i * productUnitVolumeL_i) <= usableVolumeL
```

Do not set each feeder TU to the full container target. A shared 12000 L support box with eight feeder products cannot safely use `12000`, `10000`, or `1080` as the target for each feeder unless the summed volume check proves it fits.

Before writing refill pressure into a support box, read the support storage contents. If the storage is already full or dominated by one ingredient, stop or remove/rebalance excess before starting additional feeder TUs.

For XS containers, treat `1500 L` as the capacity unless live storage read proves a different value. A 90% target is `1350 L` of product volume, not a fixed item quantity.

### Step 6 — Verify and document

After configuration:

- `du_industry_describe_batch` to confirm state/mode/recipe
- `du_storage_describe` on output containers to confirm product appearing
- `du_storage_describe` on support/input containers
- `du_storage_describe` on feeder source containers
- `du_industry_describe_batch` on feeder TUs when support refill is involved
- `du_construct_index_refresh` after any rename before index-based verification

Record in working notes:

- exact construct id and player id used
- exact output container name/id
- exact producer IDs and names
- exact support storage names/ids
- exact feeder TU IDs and source storage IDs
- what was renamed/configured vs already valid
- live output/support/source quantities
- final blocker type: setup, support sizing, source starvation, relay blockage, transit delay, production cycle time, or no blocker
