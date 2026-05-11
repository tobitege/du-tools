Read: live_lua_coding\README.md DuMcpBridge\README.md 
Continue DU factory setup work through the mod + MCP bridge only. Do not use the live industry UI unless a live probe is explicitly required.

Goal:
Do the work, not just analysis. Trace, configure, verify, and document each setup pass. Work top-down from blocked consumers toward their true upstream chokepoints.

Environment:
- Current construct: "POIN Factory 26-04-23" 
- playerId: 10000 
- ingame terms: containers usually have a tier letter like "S" (12000 L) or "XS" (1500L) in their names. "TU" = transfer unit, sole purpose to transfer volumes across containers. "producers" are any industry type like 3d printer,  chemical, glass furnace, electronic, metalwork, assembly. "recipe" = item which industry is configured with (input/output, prod time etc). TU's use item Id. producers+TU have operational mode like "Run" (continuous) or "Maintain x" (mostly used).
- mcp offers access to item bank infos to find recipes and elements

Operating rules:
- Stay on the backend/mod path.
- Prefer explicit item type IDs / recipe IDs over item names whenever supported.
- Use batched MCP requests where safe, but keep write batches conservative:
  - max 10 entries per write batch unless the exact same element type and same branch are already proven safe
  - never mix industry kinds in one `du_industry_configure_batch`
- Read first, then write.
- If a command shape fails once, rebuild it in a simpler form instead of retrying the same shape.
- Treat default-named machines and missing recipes as normal. In those cases, infer topology from linked storages, container names, container sizes, and branch structure.
- Golden rule: all inputs going into a container only max volume <= 90%
- TU: if mode is maintain x, it will start new transfer already at "x - 1"! so max volume could be ~"current PLUS batch size"!
- "Parts" are small volume items, like screws, pipes, magnets, fixations, component, connector: maintain not more than 10K for S or 1000 for XS output containers.
- Never assume a named output box is a producer bank. First prove whether it is:
  - a direct producer output
  - an S-buffer fed by producers
  - an XS relay fed by TU from another box
  - a mixed downstream consumer box
- Do not stop after finding one matching branch. Audit the full sibling set for that product family so half-configured banks are not missed.
- When a product family exists in parallel shapes, track each shape separately:
  - medium producer bank -> S buffer -> TU -> XS
  - direct producer -> XS
  - shared relay / downstream support box
- Treat `found:false` runtime reads carefully: if the tool still returns a concrete state payload, use it as a verification signal, but do not invent details the backend did not return.

Core MCP tools:
- `du_industry_describe_batch`
- `du_industry_configure_batch`
- `du_industry_stop_batch`
- `du_industry_set_recipes`
- `du_industry_start_batch`
- `du_construct_index_describe_bank_from_anchor`
- `du_construct_index_related`
- `du_construct_index_trace`
- `du_construct_index_industry_supports`
- `du_construct_index_industry_support_storage`
- `du_storage_describe`
- `du_storage_move_slot`

General setup workflow:
1. Start from the (blocked) consumer bank, not from a guessed upstream line.
2. Use the named output/storage hierarchy first when machines are unnamed or unconfigured:
   - product tier tags such as `Bas`, `Unc`, `Adv`, `Rare` (basic,uncommon,advanced,rare)
   - product nicknames such as `Comp` (component), `Connect` (connector)
   - container tiers such as `S*`, `XS*` (* = number in case of multiple lines)
3. Trace actual linked input storages and output storages live.
4. For every discovered output box, classify it before configuring anything:
   - producer output
   - relay box
   - support box
   - final consumer box
5. Confirm recipe ingredients before setting support TU amounts.
6. Find all direct-input storages, not just named support buffers.
7. Size feeder maintains from real container capacity and recipe mix.
8. Prefer about <= 80% total fill, not 100% (roughly).
9. For shared boxes, account for all item types sharing that box.
10. For direct XS buffers, keep values tight and practical.
11. Configure only what is confirmed.
12. After changes, wait briefly and recheck:
   - source box
   - target box
   - consumer or producer states
13. Do not call a branch fixed until you know whether the remaining blocker is:
   - missing recipe/setup
   - wrong maintain amount
   - empty source box
   - stalled relay with correct source stock
   - long-cycle production delay after a now-correct fix

Configuration workflow:
1. Resolve product metadata once ahead of the pass:
   - recipe ID
   - item type ID
   - unit volume
2. Resolve real container capacities from storage reads, not assumptions.
3. Calculate target quantities from p90 volume and container size.
4. Apply the same sizing rule consistently across the confirmed branch shape.
5. Keep producer-bank writes homogeneous and conservative.
6. Keep TU writes homogeneous and conservative.
7. If correcting an existing branch, stop refill pressure first, then reconfigure.

Important transfer-unit behavior:
- Transfer units reject `move` without an explicit amount.
- Changing mode on an already-running TU or industry device may not actually take effect.
- If fixing an existing line:
  - FIRST soft-stop any running or `TARGET_FULL` TU that could still refill while you work.
  - If needed, also stop the affected industry devices before changing recipe/mode/amount.
  - Empty the support box except catalyst if the old fill is wrong.
  - Reconfigure.
  - Wait for refill transit.
  - Verify support storage first, then consumers.
- For refill/distribution TUs in these parts lines, default to `maintain`, not `move`, unless there is a proven one-shot transfer reason.

Maintain-target defaults:
- Smelter producer lines: use large maintain targets on the smelters themselves.
- T3/T4 smelter support lines:
  - ores/pures into support boxes: `maintain 400`
  - catalyst into direct support boxes: `maintain 10`
- Small parts like basic components / electronics:
  - higher maintain is fine on the producer machines if the output item is tiny
  - still size feeder boxes by real capacity
- If unsure on a producer machine maintain target, use `100` or a conservative line-appropriate value rather than overfilling a small box.

Catalyst rules:
- Catalysts are special.
- In direct buffers, use at most about `2 per device` for good measure.
- Never treat catalyst like a normal bulk ingredient.
- Talents can produce catalyst overflow, so overfeeding catalyst can slowly clog the box.
- If a catalyst loop exists, preserve it and avoid breaking siphon-off paths.

Distribution pattern rules:
- For deep distribution from large source to medium to small:
  - M -> S can be larger
  - S -> XS should stay tighter
- Always inspect actual consumer counts before choosing those values.
- If a source medium feeds many different outputs, do not size one relay as if it owns the whole box.
- Distinguish between:
  - direct producer XS boxes that deserve producer maintain targets
  - TU-fed XS relay boxes that deserve tighter refill targets

Verification rules:
- After producer writes, verify:
  - state/mode
  - maintain quantity
  - correct product item appearing in the output storage
- After TU writes, verify:
  - mode really is `maintain`
  - maintain quantity is correct
  - source box has stock or is truly starved
  - target box begins filling or has a clear blocker state
- Use storage snapshots to prove product identity and direction of flow.
- A non-empty box with the correct item type is stronger evidence than a guessed name match.
- If only some sibling banks are running, continue auditing; do not assume the rest match.

When a branch is blocked:
- Determine whether it is:
  - missing recipe/setup
  - wrong maintain amount
  - empty source box
  - stalled relay with correct source stock
  - long-cycle production delay after a now-correct fix
- Do not call something “fixed” until you verify which of those is true.

Documentation:
- Update the working notes after each newly confirmed feeder layer or topology finding.
- Record:
  - exact bank names
  - whether each named box is a producer, relay, or downstream consumer
  - actual support storages
  - TU ids
  - resolved recipe/item ids
  - container capacities used for sizing
  - any topology contradictions
  - any non-obvious sizing rule used
- Focus the notes on reusable workflow truth, not only one-off machine trivia.

Output style:
- Report only:
  - what was configured
  - what was verified live
  - what is still blocked
  - whether the blocker is setup, sizing, source starvation, relay blockage, or cycle time

## Part-Named Industry Setup Workflow

Given a **part name** (e.g. "Screw", "Pipe", "Connector"), find, classify, name, and configure every related producer and container branch.

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
du_construct_index_query(category="container", nameContains=<partName>, limit=50)
```

Group results by tier+size tag from the container name:
- e.g. "Bas Screw S1A FULL", "Unc Screw S2", "Adv Screw XS1"
- Parse each container name as: `{Tier} {Part} {Size}{Line} [status]`
- Sizes: `S1`, `S2A`, `XS1`, `S1B` etc. — the number/letter after the size tag distinguishes parallel lines

### Step 2 — Classify every container

For each container, `du_construct_index_related(id=<containerId>, maxDepth=1)`. Classify by inbound edges:

| Inbound edge type | Classification |
|---|---|
| `industry_output_to_storage` from metalwork/electronics/3dprinter | **Direct producer output** — owns producer bank |
| `industry_output_to_storage` from TransferUnit only | **TU-fed relay** — no local producers to name |
| Mixed (TU + producers) | **Hybrid** — name the producer subset |
| No inbound industry | **Source/storage-only** — skip |

For each **direct producer output** container, collect all unnamed/default-named industry elements of the matching family from the `related` result.

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
- For T2+ producers that already carry a descriptive name, leave them unless they are still default-named.

### Step 4 — Discover any unconfigured producers

For the collected producer IDs, `du_industry_describe_batch`. Identify:
- **No recipe set** → needs recipe assignment
- **Stopped / idle with recipe** → may need start or support fix
- **Running** → verify only, do not touch unless explicitly asked

### Step 5 — Configure unconfigured producers

For each tier, resolve the matching recipe:
```
du_industry_resolve_recipes(entries=[{id, itemName: "<tierPartItemName>"}])
```

Then configure in homogeneous batches (same element type per batch):
```
du_industry_configure_batch(entries=[{id, mode:"run", recipeId, ...}])
```

See maintain-target defaults in the session rules for sizing.

### Step 6 — Verify and document

After configuration:
- `du_industry_describe_batch` to confirm state/mode/recipe
- `du_storage_describe` on output containers to confirm product appearing
- Record in working notes: exact bank names, producer IDs, container IDs, what was configured vs already running, and any remaining blockers.
