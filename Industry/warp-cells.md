# Warp Cell Production Chain — Full Topology Trace

**Construct:** POIN Factory 25-08-18 (id 1002090)
**Player:** 10000
**Element count:** 7,646
**Link count:** 13,580
**Last refreshed:** 2026-04-13

## How This Trace Was Performed

The trace was done iteratively using the MCP bridge tools following the documented workflow:

1. `du_construct_index_refresh` — snapshot the full construct into the mod-side SQLite index
2. `du_construct_index_query` with `nameContains: "warp"` — find warp-related elements
3. `du_construct_index_related` with `maxDepth: 3` around the Warp Cells Hub anchor — walk the immediate graph
4. `du_construct_index_industry_supports` on WCell Support containers — try to get branch topology
5. `du_construct_index_related` iteratively on each upstream node — walk one hop at a time to resolve ambiguous branches
6. `du_construct_index_query` by `industryFamily: "smelter"` and `nameContains: "Al Fe"` — locate smelter banks
7. `du_industry_describe_batch` on key elements — attempt live runtime reads (results were STOPPED/found:false because the player was not physically at the factory construct)

**Important finding:** `du_construct_index_industry_supports` returned empty feeders for this branch. The Glass2 smelters feed the warp cell S buffers directly via item links — there is no TU-refill pattern for the Glass2 → S buffer step. This means the tool does not cover this branch topology and manual iterative walking was required.

---

## Topology Diagram

```
=== WARP CELL OUTPUT DISTRIBUTION ===
Warp Cells Hub (id 4291, ContainerHub, hub mode: none)
  ├─ Warp Cells L1 (id 1787, ContainerXL) ← direct output
  ├─ Warp Cells EXL 1 (id 6308, ContainerXXXL) ← direct output
  ├─ Warp Cells EXL 2 (id 6364, ContainerXXXL) ← direct output
  ├─ TU Warp Cells 1 (id 4062, TransferUnit) ← receives from S buffers
  └─ TU Warp Cells 2 (id 6441, TransferUnit) ← receives from S buffers

=== WARP CELL BRANCH (Glass2 bank → warp cells) ===
TU Warp Cells 1 (4062) and TU Warp Cells 2 (6441)
  └─ Warp Cells S1 (id 4061, ContainerMedium)
  └─ Warp Cells S2 (id 4060, ContainerMedium)
  └─ Warp Cells S3 (id 4135, ContainerMedium)
  └─ Warp Cells S4 (id 4172, ContainerMedium)
  └─ Warp Cells S5 (id 4195, ContainerMedium)
  └─ Warp Cells S6 (id 4224, ContainerMedium)
  └─ Warp Cells S7 (id 4443, ContainerMedium)
       Each S buffer is fed by ~9-10 Glass2 smelters, for example S1 is fed by:
         IndustryGlass2 id 2960, 2961, 2962, 2963, 2964, 2965, 2966, 2967, 2968, 2977
       Glass2 output → S buffer input (direct link, no TU in between)
            ↓
       WCell Support 1..9 (id 4142, 4143, 4144, 4171, 4193, 4194, 4266, 4274, etc.)
       Each WCell Support is a ContainerSmall (non_hub) fed by:
         TU AM Core 1..9 → Adv AM Core S1..S5
         TU QA Unit 1..9 → Adv QA Unit S1..S5

=== INTERMEDIATE MATERIALS (Electronics2 bank) ===
Adv AM Core S1 (id 3527) — ContainerMedium
Adv AM Core S2 (id 3937)
Adv AM Core S3 (id 4134)
Adv AM Core S4 (id 6620)
Adv AM Core S5 (id 6657)

Adv QA Unit S1 (id 3523)
Adv QA Unit S2 (id 4050)
Adv QA Unit S3 (id 4225)
Adv QA Unit S4 (id 6673)
Adv QA Unit S5 (id 6715)

Each S container feeds multiple Electronics2 machines (9 machines total):
  id 2126, 2127, 2129, 2130, 3253, 3254, 3255, 3256, 3257, 3258
  (IndustryElectronics2, tier 2)

Inputs to each Electronics2 machine (multiple XS containers per machine):
  - Al Fe XS (id 1158 etc.) ← from Al Fe smelter output chain
  - Cu-Ag XS (id 2755) ← from Cu-Ag smelter bank
  - CaReinfCop XS (id 1188) ← from CaCo refiner bank
  - AM Capsules XS (id 4145)
  - Adv AM Core Support S1 (id 4160) — also feeds Electronics2

=== RAW PURE MATERIALS (smelter banks) ===

**Al Fe branch:**
  Al Fe XS (id 1158) ← TU ← Al Fe pure output
  Al Fe XS1..XS10 (id 1150-1158)
  Al Fe S1..S3 (id 758, 759, 760) — main AlFe buffers
  Al Fe Support S1 (id 755), Al Fe Support XS2 (id 6629)
  Smelter Al Fe A1 (id 126, IndustrySmelter)

**Cu-Ag branch:**
  Cu-Ag XS (id 2755) ← direct from Cu-Ag smelter bank
  Cu-Ag A1..A9 (id 2702-2709, IndustrySmelter2)

**Ca-Reinforced Copper branch:**
  CaReinf Copper S1 (id 751, ContainerMedium)
  CalcReinfCop Support XS1 (id 1885)
  CaCo Refiner 1..9 (id 867-879, IndustrySmelter)

**AM Capsules / Basic Components:**
  Bas Comp Al Fe 1..4 (id 2375, 3923, 3924, 3927)
  Bas Comp XS7 (id 1974)
  Adv 3D Printer Assy 1..2 (id 3991, 3992) — IndustryAssemblyM2

=== ORE INPUTS (smelter bank roots) ===
  Aluminum Ore  →  Smelter Al Fe A1  →  Al Fe pure
  Copper Ore    →  Cu-Ag A1..A9      →  Cu-Ag pure
  Calcium+Cobalt→  CaCo Refiner 1..9 →  Ca-Reinforced Copper pure

---

## Warp Drive Assembly Branch (shares upstream with warp cells)

Warp Drive Assy 1 (id 7329, IndustryAssemblyL2) → Warp Drive Hub (id 7426)

Inputs to Warp Drive Assy 1 (from related_construct_index depth 2):
  - Adv Magnet XS3 (id 2948, ContainerSmall) ← TU AdvMagnet 3
  - Adv Ionic Chmbr L S2 (id 5191) ← Metalwork2 bank
  - Adv Reinf Frame L S4 (id 6114) ← Adv Assembly L Assy bank
  - Unc Screw XS6 (id 6426) ← TU Unc Screw XS6/XS7
  - WCell Support 9 (id 4274) ← TU AM Core 8/9, TU QA Unit 9

**Critical note:** WCell Support 9 (id 4274) is the same WCell Support branch used by the warp cell Glass2 bank. The Warp Drive Assy and the Glass2 bank share the same WCell Support TU feeders — a single upstream disruption affects both branches simultaneously.

The Adv Ionic Chamber chain (Metalwork2, id 5111-5112, 5081-5082, 5190, 5229, 5237, 6417, 7347) takes inputs from:
  - Adv Magnet XS3 (id 2948)
  - Adv AM Core S containers (3527, etc.)

---

## Key Findings

### 1. No dedicated "Warp Cell Assembler" element
The factory does not contain a machine type named "Warp Cell Assembler" or similar. The warp cell product is produced by **Glass2 smelters** (IndustryGlass2). This is the game's recipe: Glass tier 2 smelters produce warp cells from intermediate inputs.

### 2. Glass2 smelters feed S buffers directly — no TU in between
Each Warp Cells S1-S7 buffer is fed directly by ~9-10 Glass2 machines via item links. There is no transfer unit between the Glass2 output and the S buffer input. This means `du_construct_index_industry_supports` does not capture this branch (it returned `industry_support_not_found`), because that tool is designed for TU-refill patterns.

### 3. WCell Support is a shared multi-TU feeding hub
Nine named WCell Support XS containers (WCell Support 1..9) are each fed by two TUs:
- TU AM Core 1..9 (feeding from Adv AM Core S1..S5)
- TU QA Unit 1..9 (feeding from Adv QA Unit S1..S5)

This is one TU pair per WCell Support. The TUs are named "AM Core" and "QA Unit" indicating two separate input material streams.

### 4. Electronics2 is the intermediate processing layer
Nine Electronics2 machines form a bank that takes multiple XS-container inputs and feeds into the Adv AM Core / Adv QA Unit S buffers. The inputs to Electronics2 include Al Fe XS, Cu-Ag XS, CaReinfCop XS, AM Capsules, and Adv AM Core Support S.

### 5. Multiple pure smelter banks at the root
- **Smelter Al Fe A1** — produces Al Fe pure (ore → pure)
- **Cu-Ag A1..A9** — produces Cu-Ag pure (9 parallel machines)
- **CaCo Refiner 1..9** — produces Ca-Reinforced Copper pure (9 parallel machines)

### 6. Live runtime reads failed
`du_industry_describe_batch` on TU Warp Cells 1, TU Warp Cells 2, Warp Drive Assy 1, TU AM Core 8 Stopped, and TU AdvMagnet 3 all returned `state: STOPPED, found: false`. This is expected — the player (id 10000) was standing on a different core (TestCore_Thades1, id 1000310), not at the factory construct. The construct index data is static and accurate regardless of player position, but live runtime requires the player to be at the construct.

### 7. All industry elements are STOPPED
Based on the index snapshot, all named transfer units with "Stopped" in their name (e.g., "TU AM Core 8 Stopped", "TU QA Unit 9 Stopped") are consistent with the live state showing everything as STOPPED.

---

## Workflow Implications

### What the MCP tools can do for this chain
- `du_construct_index_query` — find elements by name, category, industry family
- `du_construct_index_related` — walk the graph iteratively (one anchor + maxDepth per call)
- `du_construct_index_industry_supports` — works only for TU-refill branch patterns, not for direct-link chains like Glass2 → S buffer
- `du_construct_index_nearby` — useful for dense banks when starting from one known anchor
- `du_construct_index_query` with `industryFamily: "smelter"` — locate smelter banks quickly
- `du_industry_describe_batch` — live runtime reads, only works when player is at the construct

### What the tools cannot do (no arbitrary-depth walker)
- No single call walks the full upstream chain from warp cells to ore smelters in one shot
- `du_construct_index_related` with `maxDepth: 4` was sufficient for most of this chain, but branches with >4 hops require a second iterative call using the discovered element as the new anchor
- The Glass2 smelter → S buffer step required manual inspection because `industry_supports` did not recognize the direct-link topology

### Recommended agent workflow for this chain
1. Anchor on "Warp Cells Hub" (id 4291) and walk `maxDepth: 3` to capture the full distribution tree
2. For each WCell Support XS, walk upstream via `related` with `maxDepth: 2` to reach the Electronics2 bank
3. From Electronics2 inputs, continue walking to find smelter outputs
4. To reconfigure this branch: stop Glass2 machines → stop TUs → set recipes on Glass2 → set mode/amount on TUs → start in dependency order
5. To check live state: player must be at construct 1002090 first

---

## Resolved Element IDs Reference

### Warp cell output
| Element | ID | Type |
|--------|-----|------|
| Warp Cells Hub | 4291 | ContainerHub |
| Warp Cells L1 | 1787 | ContainerXL |
| Warp Cells EXL 1 | 6308 | ContainerXXXL |
| Warp Cells EXL 2 | 6364 | ContainerXXXL |
| TU Warp Cells 1 | 4062 | TransferUnit |
| TU Warp Cells 2 | 6441 | TransferUnit |
| Warp Cells S1 | 4061 | ContainerMedium |
| Warp Cells S2 | 4060 | ContainerMedium |
| Warp Cells S3 | 4135 | ContainerMedium |
| Warp Cells S4 | 4172 | ContainerMedium |
| Warp Cells S5 | 4195 | ContainerMedium |
| Warp Cells S6 | 4224 | ContainerMedium |
| Warp Cells S7 | 4443 | ContainerMedium |

### Glass2 smelter bank (warp cell production)
| Element | ID | Type |
|--------|-----|------|
| IndustryGlass2 (bank, S1) | 2960-2968, 2977 | IndustryGlass2 (10 machines) |

### WCell Support (shared feeder buffers)
| Element | ID | Type |
|--------|-----|------|
| WCell Support 1 | 4142 | ContainerSmall |
| WCell Support 9 | 4274 | ContainerSmall |
| TU AM Core 1 | 4140 | TransferUnit |
| TU AM Core 8 Stopped | 4270 | TransferUnit |
| TU QA Unit 1 | 4141 | TransferUnit |
| TU QA Unit 9 Stopped | 4271 | TransferUnit |

### Intermediate AM Core / QA Unit containers
| Element | ID | Type |
|--------|-----|------|
| Adv AM Core S1 | 3527 | ContainerMedium |
| Adv AM Core S5 | 6657 | ContainerMedium |
| Adv QA Unit S1 | 3523 | ContainerMedium |
| Adv QA Unit S5 | 6715 | ContainerMedium |

### Electronics2 bank
| Element | ID | Type |
|--------|-----|------|
| IndustryElectronics2 (9 machines) | 2126, 2127, 2129, 2130, 3253-3258 | IndustryElectronics2 |

### Smelter bank roots
| Element | ID | Type |
|--------|-----|------|
| Smelter Al Fe A1 | 126 | IndustrySmelter |
| Cu-Ag A1..A9 | 2702-2709 | IndustrySmelter2 |
| CaCo Refiner 1 | 867 | IndustrySmelter |

### Warp Drive Assy
| Element | ID | Type |
|--------|-----|------|
| Warp Drive Assy 1 | 7329 | IndustryAssemblyL2 |
| Warp Drive Hub | 7426 | ContainerHub |
| TU AdvMagnet 3 | 5678 | TransferUnit |
