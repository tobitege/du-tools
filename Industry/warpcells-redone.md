# Warp Cell Factory — 7-Line Floorplan

**Construct:** POIN Factory 25-08-18 (id 1002090)
**Player:** 10000

## Purpose

Create a new floorplan for the warp cell branch only, but on an empty construct.

Scope:

- include the linked warp cell branch from shared upstream production down to warp cell output
- exclude unused planned lines
- exclude Warp Drive Assembly
- use original machine counts and mesh boxes as the sizing basis

This document is a build-oriented floorplan, not a reconstruction of the old construct's exact coordinates.

---

## Abbreviations

DO NOT REMOVE!!!

Note: the descriptions here may leave out or add potential dashes in material/parts names compared to item bank names.

- CaCo: Calcium-Reinforced Copper
- AM Core: Antimatter Core
- QA Unit: Quantum Alignment Unit
- Glass2: internal item bank key for tier 2 of glass furnace industry device
- TU: Transfer Unit: high-deployment element in factory to move items around (in varying batches and durations)
- WCell: Warp Cell
- Tiers 1 to 4: Basic (Bas), Uncommon (Unc), Advanced (Adv), Rare (more seldom)
- KL: Kilo Litres, volume; determines max amount of parts/material related to container capacity
- S1..S5: enumerated containers of size "S" = small (12 KL); could also be "XS" (extra small); 1.5 KL, "M" (medium; 96 KL) or "L" (large; 1972 KL)

## Active Counts

Only the 7 actually linked warp cell lines are kept.

| Tier | Element | Count | Notes |
|------|---------|-------|-------|
| Smelter | Smelter Al Fe A1 | 1 | Shared upstream |
| Smelter | Smelter Cu-Ag A1..A9 | 9 | Shared upstream |
| Smelter | Smelter CaCo 1..9 | 9 | Shared upstream |
| Intermediate | Electronics2 | 100 | 10 live producer banks of 10 for `Adv AM Core S1..S5` and `Adv QA Unit S1..S5` |
| Buffer | Adv AM Core S | 5 | Shared upstream buffers |
| Buffer | Adv QA Unit S | 5 | Shared upstream buffers |
| Buffer | Adv AM Core Support S1..S5 | 5 | Missing in first draft; each feeds one 10-machine Electronics2 bank |
| Buffer | Adv QA Unit Support S2..S5 | 4 | Missing in first draft; each feeds one 10-machine Electronics2 bank |
| Buffer | QA S1 direct-input XS storages | 5 | `QCores XS1`, `Bas LED XS1`, `Polycalcite XS7`, `Polycarb S6B XS1`, `Polysulfide XS9` |
| Transfer | TU AM Core 1..7 | 7 | One per active line |
| Transfer | TU QA Unit 1..7 | 7 | One per active line |
| Buffer | WCell Support XS 1..7 | 7 | One per active line |
| Production | Glass2 | 70 | 10 per active line |
| Buffer | Warp Cells S1..S7 | 7 | One per active line |
| Transfer | TU Warp Cells 1..2 | 2 | Final distribution |

Core ratio:

- 1 warp-cell line = 1 WCell Support XS + 10 Glass2 + 1 Warp Cells S
- 7 active lines = 70 Glass2 total

---

## Mesh Box Reference

Taken from `all-mesh-boxes.json`.

| Element | W (m) | H (m) | D (m) |
|---------|-------|-------|-------|
| IndustryGlass2 | 2.01 | 1.74 | 6.01 |
| IndustryElectronics2 | 1.45 | 3.71 | 1.57 |
| IndustrySmelter2 | 3.24 | 7.19 | 2.67 |
| IndustrySmelter | 3.24 | 7.19 | 2.67 |
| TransferUnit | 2.10 | 1.97 | 2.55 |
| ContainerSmall | 1.00 | 1.00 | 1.00 |
| ContainerMedium | 2.00 | 2.00 | 2.00 |

Assumed placement rule:

- machines may be stacked vertically at the same X,Z when Y is separated enough
- this document uses that only where it reduces walking distance and footprint

---

## Design Decision

Do not try to picture the whole factory as one long row.

Use two parts:

1. one compact shared upstream block
2. seven identical warp-cell line modules

That is the easiest layout to build and the easiest layout to understand.

---

## One Active Line Module

Each active line is one repeatable module:

Top view of one line module:

```text
[WCell Support XS]
        |
   feeds 10x Unc. Glass Furnaces
        |
[Warp Cells S]
```

Suggested Glass Furnaces arrangement inside one line:

- 10 Unc. Glass Furnaces as a 5 x 2 grid
- machine width uses X
- machine depth uses Y (Z is height!)

Approximate line-module footprint:

- width: about 11 m
- depth: about 13 m

Using simple spacing:

```text
One line module, top view

Y
0m   G1  G2  G3  G4  G5
6.5  G6  G7  G8  G9  G10

X:   0   2.2 4.4 6.6 8.8
```

Where:

- `G1..G10` are the 10 Glass2 machines of that line
- one `WCell Support XS` sits centered before the Glass2 pair rows
- one `Warp Cells S` sits centered after the Glass2 pair rows

This gives one compact unit instead of one huge continuous Glass2 wall.

---

## Seven-Line Arrangement

Arrange the seven line modules as `4 + 3`.

That keeps the overall footprint shorter and easier to walk than `7 in one row`.

```text
Top view, line-module layer

Row A:  L1   L2   L3   L4
Row B:  L5   L6   L7
```

Suggested spacing:

- module width: 11 m
- module depth: 13 m
- gap between modules in X: 2 m
- gap between rows in Y: 4 m walkway

Approximate full line area:

- width: about 50 m for the 4-module row
- depth: about 30 m for both rows plus walkway

This is much easier to build than the previous `81m wide` concept.

---

## Floor Strategy

Use four functional levels:

1. upstream production floor
2. support-buffer and feeder-TU floor
3. Glass2 production floor
4. output collection floor

The player only needs a few clear walkways:

- one front walkway on the upstream side
- one central walkway between the `4` and `3` line rows
- one output-side walkway near the final warp cell buffers and TUs

---

## Floor 1 — Shared Upstream Block

This floor contains the shared machines and shared upstream buffers:

- 9 AlFe smelter
- 9 Cu-Ag smelters
- 9 CaCo smelters
- 100 Electronics2 in ten 10-machine banks
- 5 Adv AM Core S
- 5 Adv QA Unit S
- 5 Adv AM Core Support S
- 4 Adv QA Unit Support S2..S5
- 5 direct XS input storages for the `Adv QA Unit S1` bank

Recommended top view:

```text
Floor 1 top view

[Smelter row: AlFe x9 | CuAg x9 | CaCo x9]

walkway

[QA/AM producer area: 10 x Electronics2 banks]

walkway

[Adv AM Core S x5 + Support S x5]   [Adv QA Unit S x5 + Support inputs]
```

Practical notes:

- keep the smelters in one long row or split them into two shorter rows if the construct shape prefers that
- do not model Electronics2 as one `3 x 3` bank; the live branch uses ten separate 10-machine banks
- keep each `Adv AM Core S*` or `Adv QA Unit S*` medium container paired with its own nearby support-input area
- the live layout places the Electronics2 banks about `3 m` west of the output/support stack and the feeder TUs about `2.5 m` east of it
- the support XS sits about `1.5 m` above its matching `Adv * S*` output container with a small `~0.5 m` Z offset

### Live-Traced Missing Feeder Network

The first draft was missing the entire support-storage layer that actually feeds the `Adv AM Core` and `Adv QA Unit` output buffers.

`Adv AM Core S1..S5` live branch:

- `Adv AM Core S1` is produced by 10 `IndustryElectronics2` and fed through `Adv AM Core Support S1` from `Al Fe XS9` and `Bas Comp XS7`.
- `Adv AM Core S2` is produced by 10 `IndustryElectronics2` and fed through `Adv AM Core Support S2` from `Al Fe XS1`, `Bas Comp XS8`, `CaReinfCop XS B XS3`, and `Cu-Ag XS6`.
- `Adv AM Core S3` is produced by 10 `IndustryElectronics2` and fed through `Adv AM Core Support S3` from `Al Fe XS9`, `Bas Comp XS4 FULL`, `CaReinfCop XS10`, and `Cu-Ag XS8`.
- `Adv AM Core S4` is produced by 10 `IndustryElectronics2` and fed through `Adv AM Core Support S4` from `Al Fe XS7`, `Bas Comp XS10`, `CaReinfCop XS B XS4`, and `Cu-Ag XS7`.
- `Adv AM Core S5` is produced by 10 `IndustryElectronics2` and fed through `Adv AM Core Support S5` from `Al Fe XS10`, `Bas Comp XS7`, `CaReinfCop XS B XS5`, and `Cu-Ag XS8`.

`Adv QA Unit S1..S5` live branch:

- `Adv QA Unit S1` is produced by 10 `IndustryElectronics2`, but its direct inputs are not gathered in one `Adv QA Unit Support` container.
- The `Adv QA Unit S1` bank pulls directly from `QCores XS1`, `Bas LED XS1`, `Polycalcite XS7`, `Polycarb S6B XS1`, and `Polysulfide XS9`.
- `QCores XS1` itself is refilled through `TU Bas QC 1`, `TU Unc QC 1`, and `TU Adv QC 1` from `Bas QCores XS1`, `Unc QCores XS1`, and `Adv QCores S1..S3`.
- `Bas LED XS1` is refilled from `Bas LED S1` and `Bas LED S2`.
- `Polycalcite XS7` is refilled from `Polycalcite XS6`.
- `Polycarb S6B XS1` is refilled from `Polycarb S6`.
- `Polysulfide XS9` is refilled from `Polysulfide S9`.
- `Adv QA Unit S2` is produced by 10 `IndustryElectronics2` and fed through `Adv QA Unit Support S2` from `Polycarb S2A`, `Polycalcite XS5`, `Bas LED S7`, and `Polysulfide XS4`.
- `Adv QA Unit S3` is produced by 10 `IndustryElectronics2` and fed through `Adv QA Unit Support S3` from `Polycarb S3B`, `Polycalcite XS3`, `Bas LED S8`, and `Polysulfide XS5`.
- `Adv QA Unit S4` is produced by 10 `IndustryElectronics2` and fed through `Adv QA Unit Support S4` from `Polycarb S4A`, `Polycalcite XS6`, `Bas LED S6`, and `Polysulfide XS5`.
- `Adv QA Unit S5` is produced by 10 `IndustryElectronics2` and fed through `Adv QA Unit Support S5` from `Polycarb S4B`, `Polycalcite XS4`, `Bas LED S7`, and `Polysulfide XS6`.

Meaning for Floor 1:

- the medium output buffers `Adv AM Core S1..S5` and `Adv QA Unit S1..S5` are only the visible top layer
- each of those output buffers needs its own local support-input storage area
- the draft also needs the feeder-source storages listed above, otherwise the AM/QA producer banks are not reconstructable from the note
- the named support buffers are still not the whole recipe input picture; some ingredients arrive through separate direct XS buffers on the producer banks

### Additional Direct Inputs Found During Setup

The live setup pass showed that the `Adv AM Core` and `Adv QA Unit` banks do not rely only on the named support buffers.

Confirmed direct-input storages:

- `Adv AM Core S1` producer bank shared inputs: `Adv AM Core Support S1`, `AM Capsules 2`, `CaReinfCop XS9`, `Cu-Ag XS9`
- `Adv AM Core S2` producer bank shared inputs: `Adv AM Core Support S2`, `AM Capsules 1`
- `Adv QA Unit S2` producer bank shared inputs: `Adv QA Unit Support S2`, `QCores XS2`
- `Adv QA Unit S1` producer bank shared inputs: `QCores XS1`, `Bas LED XS1`, `Polycalcite XS7`, `Polycarb S6B XS1`, `Polysulfide XS9`

Meaning for reconstruction:

- the named support containers cover only part of each `Electronics2` recipe
- antimatter capsules and quantum cores also need their own direct feeder buffers
- a rebuild note that models only `Adv AM Core Support S*` and `Adv QA Unit Support S*` is still incomplete

### Exact Live Recipe Mapping

The bridge-side setup pass confirmed these exact product selectors:

- `IndustryGlass2` warp-cell recipe: `WarpCellStandard`, recipe id `139723769`
- transfer-unit product for warp-cell AM feed: `Advanced Antimatter Core`, item type / recipe id `375744325`, key `antimattercore_3`
- transfer-unit product for warp-cell QA feed: `Advanced Quantum Alignment Unit`, item type / recipe id `2601646636`, key `quantumalignmentunit_3`
- `IndustryElectronics2` producer recipe for `Adv AM Core`: recipe id `787693311`, key `antimattercore_3`
- `IndustryElectronics2` producer recipe for `Adv QA Unit`: recipe id `1150226654`, key `quantumalignmentunit_3`

The live recipe contents matter for the next setup tier:

- `Warp Cell` consumes `1 x Advanced Quantum Alignment Unit` and `1 x Advanced Antimatter Core`
- `Advanced Antimatter Core` consumes `Al-Fe Alloy product x5`, `Basic Component x10`, `Basic Antimatter Capsule x3`, `Calcium Reinforced Copper product x5`, `Uncommon Antimatter Capsule x1`, `Cu-Ag Alloy product x5`, `Advanced Antimatter Capsule x1`
- `Advanced Quantum Alignment Unit` consumes `Polycarbonate plastic product x5`, `Basic LED x10`, `Basic Quantum Core x3`, `Polycalcite plastic product x5`, `Uncommon Quantum Core x1`, `Polysulfide plastic product x5`, `Advanced Quantum Core x1`

### Live Setup State

A direct mod/MCP setup pass was executed top-down without using the live industry UI.

Configured successfully:

- `70` unnamed `IndustryGlass2` machines across the 7 active warp-cell lines were set to `WarpCellStandard` and started in `run`
- `14` warp-cell feeder transfer units `TU AM Core 1..7` and `TU QA Unit 1..7` were set with explicit item-type selectors and started in `maintain 10`
- `100` `IndustryElectronics2` machines were configured and started:
  - `50` for `Advanced Antimatter Core`
  - `50` for `Advanced Quantum Alignment Unit`

Resulting live state after that pass:

- warp-cell furnaces are now `JAMMED_MISSING_INGREDIENT`
- line-feeder transfer units are now `JAMMED_MISSING_INGREDIENT` with `maintainQuantity 10`
- AM/QA `Electronics2` producers are now `JAMMED_MISSING_INGREDIENT`

That jammed state is expected and means the next missing setup layer is upstream of the AM/QA producer banks, not in the warp-cell furnaces themselves.

### Next Feeder TU Layer Confirmed And Configured

The next upstream feeder-TU layer for the AM/QA producer-bank inputs was traced and configured through the backend bridge only.

All newly configured transfer units were started in `maintain 100`.

`Adv AM Core Support S1..S5`:

- resolved transfer-unit product ids:
  - `AlFeProduct` -> `18262914`
  - `component_1` -> `794666749`
  - `CalciumReinforcedCopperProduct` -> `1034957327`
  - `CuAgProduct` -> `1673011820`
- traced support-buffer source mapping:
  - `Adv AM Core Support S1` <- `Al Fe XS9`, `Bas Comp XS7`
  - `Adv AM Core Support S2` <- `Al Fe XS1`, `Bas Comp XS8`, `CaReinfCop XS B XS3`, `Cu-Ag XS6`
  - `Adv AM Core Support S3` <- `Al Fe XS9`, `Bas Comp XS4 FULL`, `CaReinfCop XS10`, `Cu-Ag XS8`
  - `Adv AM Core Support S4` <- `Al Fe XS7`, `Bas Comp XS10`, `CaReinfCop XS B XS4`, `Cu-Ag XS7`
  - `Adv AM Core Support S5` <- `Al Fe XS10`, `Bas Comp XS7`, `CaReinfCop XS B XS5`, `Cu-Ag XS8`
- configured feeder TUs:
  - `Adv AM Core Support S1`: ids `4161`, `6659`
  - `Adv AM Core Support S2`: ids `4040`, `4039`, `4041`, `4042`
  - `Adv AM Core Support S3`: ids `4156`, `4155`, `4157`, `4158`
  - `Adv AM Core Support S4`: ids `6622`, `6623`, `6625`, `6624`
  - `Adv AM Core Support S5`: ids `6653`, `6654`, `6656`, `6655`

`AM Capsules 1..2`:

- `AM Capsules 1` and `AM Capsules 2` are produced by two separate `5 x IndustryGlass2` banks.
- those two producer banks share `AM Capsules Support 1` as their upstream support-input container.
- traced and configured `AM Capsules Support 1` feeder TUs:
  - `TU Adv Glass 1` id `4033` from `Adv Glass S3` -> `AdvancedGlassProduct` `1942154251`
  - `TU Ag-Li Reinf Glass 1` id `4034` from `Ag Li Glass S1` -> `AgLiReinforcedGlassProduct` `2301749833`
  - `TU Glass 1` id `4032` from `Glass S1`, `Glass S3` -> `GlassProduct` `3308209457`
  - `TU Bas Conn 1` id `4036` from `Bas Connect XS2` -> `connector_1` `2872711779`
  - `TU Unc Conn 1` id `4035` from `Unc Connector XS1` -> `connector_2` `2872711778`
- side result from the same branch pass:
  - `AM Capsules Support 2` was also traced and configured for the next capsule pair with ids `4108`, `4111`, `4113`, `4110`, `4112`

`Adv QA Unit Support S2..S5`:

- resolved transfer-unit product ids:
  - `PolycarbonatePlasticProduct` -> `2014531313`
  - `PolycalcitePlasticProduct` -> `4103265826`
  - `led_1` -> `1234754162`
  - `PolysulfidePlasticProduct` -> `2097691217`
- traced support-buffer source mapping:
  - `Adv QA Unit Support S2` <- `Polycarb S2A`, `Polycalcite XS5`, `Bas LED S7`, `Polysulfide XS4`
  - `Adv QA Unit Support S3` <- `Polycarb S3B`, `Polycalcite XS3`, `Bas LED S8`, `Polysulfide XS5`
  - `Adv QA Unit Support S4` <- `Polycarb S4A`, `Polycalcite XS6`, `Bas LED S6`, `Polysulfide XS5`
  - `Adv QA Unit Support S5` <- `Polycarb S4B`, `Polycalcite XS4`, `Bas LED S7`, `Polysulfide XS6`
- configured feeder TUs:
  - `Adv QA Unit Support S2`: ids `4043`, `4044`, `4046`, `4048`
  - `Adv QA Unit Support S3`: ids `4230`, `4232`, `4231`, `4233`
  - `Adv QA Unit Support S4`: ids `6675`, `6677`, `6676`, `6678`
  - `Adv QA Unit Support S5`: ids `6717`, `6719`, `6718`, `6720`

`QCores XS1..XS5`:

- every traced `QCores XS*` buffer is refilled by one `Basic`, one `Uncommon`, and one `Advanced` quantum-core TU.
- resolved transfer-unit product ids:
  - `quantumcore_1` -> `850241766`
  - `quantumcore_2` -> `850241765`
  - `quantumcore_3` -> `850241764`
- source pattern:
  - basic QC feeder TUs pull from `Bas QCores XS1`
  - uncommon QC feeder TUs pull from `Unc QCores XS1`
  - advanced QC feeder TUs pull from `Adv QCores S1`, `Adv QCores S2`, and `Adv QCores S3`
- configured feeder TUs:
  - `QCores XS1`: `TU Bas QC 1` `4052`, `TU Unc QC 1` `4053`, `TU Adv QC 1` `4054`
  - `QCores XS2`: `TU Bas QC 2` `4057`, `TU Unc QC 2` `4058`, `TU Adv QC 2` `4059`
  - `QCores XS3`: `TU Bas QC 3` `4130`, `TU Unc QC 3` `4131`, `TU Adv QC 3` `4132`
  - `QCores XS4`: `TU Bas QC 4` `6681`, `TU Unc QC 4` `6682`, `TU Adv QC 4` `6683`
  - `QCores XS5`: `TU Bas QC 5` `6713`, `TU Unc QC 5` `6712`, `TU Adv QC 5` `6711`

Immediate runtime result after the backend batch:

- `59` feeder transfer units configured successfully with `maintainQuantity 100`
- immediately `RUNNING` on the traced layer:
  - `AlFeProduct`
  - `CalciumReinforcedCopperProduct`
  - `PolycarbonatePlasticProduct`
  - `PolycalcitePlasticProduct`
- still `JAMMED_MISSING_INGREDIENT` one level further upstream:
  - `component_1`
  - `CuAgProduct`
  - `AdvancedGlassProduct`
  - `AgLiReinforcedGlassProduct`
  - `GlassProduct`
  - `connector_1`
  - `connector_2`
  - `led_1`
  - `PolysulfidePlasticProduct`
  - `quantumcore_1`
  - `quantumcore_2`
  - `quantumcore_3`

If you want the smallest walking distance, use two smelter rows instead of one:

```text
Alternative smelter arrangement

Row 1: AlFe + CuAg 1..9
Row 2: CaCo 1..9
```

That is more practical than a 67 m single strip.

---

## Floor 2 — Per-Line Support Feed

This floor fans the shared buffers out into the 7 active lines.

Elements:

- 7 TU AM Core
- 7 TU QA Unit
- 7 WCell Support XS

Recommended arrangement:

```text
Floor 2 top view

L1  [TU AM] [TU QA] [Support]
L2  [TU AM] [TU QA] [Support]
L3  [TU AM] [TU QA] [Support]
L4  [TU AM] [TU QA] [Support]

walkway

L5  [TU AM] [TU QA] [Support]
L6  [TU AM] [TU QA] [Support]
L7  [TU AM] [TU QA] [Support]
```

Meaning:

- each line gets exactly one AM Core TU and one QA Unit TU
- both TUs feed one dedicated WCell Support XS
- the 7 supports are the actual line roots

This is the right place to think in `7 lines`, not `9 planned`.

---

## Floor 3 — Glass2 Production

This floor is only the seven line modules.

```text
Floor 3 top view

Row A:
L1 = Support -> 10x Glass2
L2 = Support -> 10x Glass2
L3 = Support -> 10x Glass2
L4 = Support -> 10x Glass2

central walkway

Row B:
L5 = Support -> 10x Glass2
L6 = Support -> 10x Glass2
L7 = Support -> 10x Glass2
```

Build rule for each line:

- put the support container at the head of the module
- put the 10 Glass2 directly after it in a fixed 5 x 2 grid
- keep the seven modules identical

That gives a layout you can copy-paste mentally while building.

---

## Floor 4 — Output Collection

Each line terminates in one Warp Cells S buffer.

Elements:

- Warp Cells S1..S7
- TU Warp Cells 1..2
- final hub output

Recommended top view:

```text
Floor 4 top view

[S1] [S2] [S3] [S4]
[S5] [S6] [S7]

walkway

[TU Warp 1] [TU Warp 2] [Hub]
```

Practical notes:

- keep each Warp Cells S close to its own Glass2 module
- collect the seven S buffers toward the center before the final two TUs
- place the hub centrally, not at one far edge

---

## Suggested Vertical Stack

One simple height scheme:

| Level | Use |
| --- | --- |
| Y = 0 to 10 | Shared smelters and shared upstream buffers |
| Y = 12 to 16 | Per-line feeder TUs and WCell Support XS |
| Y = 18 to 26 | Seven Glass2 line modules |
| Y = 28 to 32 | Warp Cells S buffers and final distribution |

Exact Y values can be adjusted during placement.
The important part is the order and the repeated line structure.

---

## Practical Build Order

1. Build the shared upstream block first.
2. Place the 7 line roots: `TU AM + TU QA + WCell Support`.
3. Clone one Glass2 module shape 7 times.
4. Add one Warp Cells S per line.
5. Add the 2 final warp-cell TUs and the hub.

If one module shape feels good in-game, the rest of the layout is straightforward.

---

## Why This Layout Is Practical

Compared to the previous draft, this version is practical because:

- it uses `7` consistently everywhere
- it treats one active line as the repeatable unit
- it avoids a misleading `9 planned / 7 active` mix
- it avoids one massive continuous Glass2 wall
- it gives top-view diagrams instead of only prose
- it separates shared infrastructure from repeated per-line production

---

## Final Shape

Think of the build as this:

```text
Side concept

Floor 4:  output buffers -> final TUs -> hub
Floor 3:  seven Glass2 line modules
Floor 2:  per-line TUs + per-line WCell Support
Floor 1:  shared upstream production and shared upstream buffers
```

And from above:

```text
Top concept

shared upstream block
        ||
   seven active lines
      4 + 3 layout
        ||
    central output area
```

That is the version to build.

---

### Next Mixed Producer And Feeder Layer Confirmed And Configured

The next pass above the previously jammed AM/QA support layer is not TU-only.
It is a mixed layer of feeder TUs plus upstream producer banks.

Configured through backend batch calls only:

- `44` `TransferUnit`
- `10` `IndustryGlass`
- `5` `IndustryGlass2`
- `5` `IndustryElectronics`
- `10` `Industry3DPrinter`
- `12` `Industry3DPrinter2`
- `8` `IndustryChemical`
- `8` `IndustrySmelter2`

Total configured in this pass: `102` devices, all with `maintain 100`.

Resolved machine recipe ids used in this pass:

- `CuAgProduct` machine recipe id `1771858540`, output item id `1673011820`
- `GlassProduct` machine recipe id `2118283057`, output item id `3308209457`
- `AdvancedGlassProduct` machine recipe id `1116568176`, output item id `1942154251`
- `led_1` machine recipe id `1137501015`, output item id `1234754162`
- `led_2` machine recipe id `1137501008`, output item id `1234754161`
- `component_1` machine recipe id `1319718943`, output item id `794666749`
- `connector_1` machine recipe id `1738589935`, output item id `2872711779`
- `connector_2` machine recipe id `1738589934`, output item id `2872711778`
- `quantumcore_1` machine recipe id `1457246784`, output item id `850241766`
- `quantumcore_2` machine recipe id `1457246785`, output item id `850241765`
- `quantumcore_3` machine recipe id `1457246786`, output item id `850241764`
- `PolycarbonatePlasticProduct` machine recipe id `1645885251`, output item id `2014531313`
- `PolycalcitePlasticProduct` machine recipe id `1756458312`, output item id `4103265826`

Resolved TU-fed raw/product ids used in this pass:

- `AlFeProduct` -> `18262914`
- `CuAgProduct` -> `1673011820`
- `led_1` -> `1234754162`
- `led_2` -> `1234754161`
- `PolysulfidePlasticProduct` -> `2097691217`
- `PolycarbonatePlasticProduct` -> `2014531313`
- `PolycalcitePlasticProduct` -> `4103265826`
- `OxygenPure` -> `947806142`
- `SiliconPure` -> `2589986891`
- `CalciumPure` -> `2112763718`
- `SodiumPure` -> `3603734543`

Confirmed configured branch groups:

- `Bas Comp Al Fe 1..4` refill chain:
  - TUs `2376`, `3922`, `3925`, `3926`
- `Cu-Ag Alloy S1` distribution:
  - `8 x IndustrySmelter2` `2702`, `2703`, `2704`, `2705`, `2706`, `2709`, `2707`, `2708`
  - TUs `2735`, `2746`, `2745`, `2736`, `2744`, `2737`, `2743`, `2738`, `2742`, `6271`
- `Glass Support S1` raw feed and plain glass:
  - TUs `1481`, `1482`
  - `IndustryGlass` `133` on `GlassProduct`
- `Adv Glass Support S1` raw feed and `Adv Glass S3` producer bank:
  - TUs `929`, `930`, `931`, `932`
  - `IndustryGlass2` `571`, `563`, `564`, `558`, `567`
- `Bas LED S5` producer/output branch:
  - `IndustryGlass` `1631`, `1632`, `1637`, `1638`
  - TUs `3446`, `3788`, `6588`, `8381`, `8421`, `7286`, `9054`
- `Unc LED S2` producer/output branch:
  - `IndustryGlass` `1611`, `1622`, `1623`, `1624`, `1639`
  - TUs `3517`, `8927`, `3790`, `9055`
- `Polycarb S9` and `Polycalcite S2` producer branches:
  - `IndustryChemical` `916`, `917`
  - `IndustryChemical` `139`, `141`, `8112`, `8121`, `8123`, `8129`
  - TUs `8078`, `9053`, `6774`, `2055`, `2056`, `8560`, `9052`
- `Polysulfide S1` and `Polysulfide S4` refill/distribution:
  - TUs `6150`, `1478`, `1475`, `9051`, `6162`, `2808`
- `Bas Connect XS2` and `Unc Connector XS1` producer banks:
  - `IndustryElectronics` `1924`, `2158`, `2179`
- `Bas Comp XS7` producer bank:
  - `IndustryElectronics` `1926`, `1927`
- `Bas QCores XS1`, `Unc QCores XS1`, `Adv QCores Support 1`:
  - `Industry3DPrinter` `3053`, `4504`, `5534`, `5538`, `5535`, `5536`, `5539`, `3054`, `4508`, `5070`
  - `Industry3DPrinter2` `6693`, `6694`, `3069`, `3066`, `3059`, `5417`, `5416`, `9048`, `9049`, `9046`, `9047`, `9050`
  - TUs `9051`, `9052`, `9053`, `9054`, `9055`

Representative runtime after configuration:

- already `RUNNING` on this layer:
  - `IndustryChemical` `916`
  - `IndustryChemical` `139`
  - `IndustryElectronics` `1926`
  - `IndustryElectronics` `1924`
  - `IndustryElectronics` `2158`
  - `IndustryGlass` `133`
- still `JAMMED_MISSING_INGREDIENT` one level further upstream:
  - `IndustrySmelter2` `2702`
  - `IndustryGlass` `1631`
  - `IndustryGlass` `1611`
  - `Industry3DPrinter` `3053`
  - `Industry3DPrinter` `3054`
  - `Industry3DPrinter2` `3069`
  - TUs `9054`, `9055`, `9051`
- still settling as `PENDING` when sampled immediately after batch:
  - TUs `2376`, `1481`, `930`, `9053`, `2055`

This confirms the next remaining missing layer is above:

- `Cu-Ag`
- `Basic` / `Uncommon` LEDs
- `Basic` / `Uncommon` / `Advanced` quantum-core printer inputs
- some raw/feed branches behind `Al Fe`, `Polysulfide`, and the remaining glass support sources

---

### Continued Support And Producer Layer After Catalyst Injection

First, `1000 L` of `Catalyst4` was spawned into player inventory through the backend path.

- `Catalyst4` item type id `3729464849`

Additional backend-only configuration completed in this continuation:

- `53` `TransferUnit`
- `26` `IndustryGlass`
- `1` `IndustryGlass2`
- `17` `IndustryChemical2`

Total configured in this continuation: `97` backend config entries, all with `maintain 100` except one already-existing `CarbonPure` support TU on `Polysulf Support S2` that was left at `maintain 5000`.

Newly resolved explicit ids in this continuation:

- `CopperPure` -> `1466453887`
- `SilverPure` -> `1807690770`
- `Catalyst3` -> `3729464848`
- `CarbonPure` -> `159858782`
- `HydrogenPure` -> `1010524904`
- `SulfurPure` -> `3822811562`
- `PolysulfidePlasticProduct` machine recipe id `9524849`

Confirmed branch mappings added in this pass:

- `Cu-Ag Support XS1` raw support:
  - `2721` `TU Cat3 Cu Ag` -> `Catalyst3` `3729464848`
  - `2723` `TU Copper` -> `CopperPure` `1466453887`
  - `2724` `TU Silver` -> `SilverPure` `1807690770`
- `Glass Support XS1` / `Glass Support XS2` feeder glass:
  - `1662`, `1663`, `1664` -> `GlassProduct` `3308209457`
  - `1667` -> `AdvancedGlassProduct` `1942154251`
- `Glass Support S2` raw feed:
  - `1483` -> `SiliconPure` `2589986891`
  - `1484` -> `OxygenPure` `947806142`
- `Adv Glass Support S2` raw feed:
  - `1678` -> `SodiumPure` `3603734543`
  - `1679` -> `CalciumPure` `2112763718`
  - `1680` -> `SiliconPure` `2589986891`
  - `1681` -> `OxygenPure` `947806142`
- `Polysulf Support S1` exact TU mappings:
  - `978` links `Sulfur S1 -> Polysulf Support S1` and is configured for `SulfurPure` `3822811562`
  - `979` links `Carbon S3 -> Polysulf Support S1` and is configured for `CarbonPure` `159858782`
  - `980` links `Hydrogen S1 -> Polysulf Support S1` and is configured for `HydrogenPure` `1010524904`
  - `990` links `Polysulfide Main 1 -> Polysulf Support S1`
- `Polysulf Support S2` exact TU mappings:
  - `6182` links `Sulfur S1 -> Polysulf Support S2` and is configured for `SulfurPure` `3822811562`
  - `6183` links `Hydrogen XS3 -> Polysulf Support S2` and is configured for `HydrogenPure` `1010524904`
  - `6186` links `Carbon S4 -> Polysulf Support S2` and was already present as `CarbonPure` `159858782` with `maintain 5000`
  - `6185` links `Polysulfide Main 2 -> Polysulf Support S2`
- `Polysulfide Main 1` / `Polysulfide Main 2` producer banks:
  - `968..976` and `6134..6141` are `IndustryChemical2` and were configured for `PolysulfidePlasticProduct` recipe `9524849`
  - `6187` links `Polysulfide Main 2 -> Polysulfide Main 1`
- Plain-glass and advanced-glass producer banks activated in this pass:
  - plain glass: `132`, `133`, `134`, `1041`, `1042`, `1043`, `1044`, `1046`, `1047`, `1048`, `1049` on `GlassProduct`
  - advanced glass S2 bank: `1683`, `1688`, `1692`, `1684`, `1691`, `1685`, `1690`, `1686`, `1689`, `1687` on `AdvancedGlassProduct`

Representative verification after these batches:

- now `RUNNING`:
  - `134` `Glass 2`
  - raw-support TUs `1483`, `1484`, `1678`, `1679`, `1680`, `1681`
  - polysulf support-raw TUs `978`, `979`, `980`, `6182`, `6183`
- support storages now populated:
  - `Glass Support S2` contains `SiliconPure` and `OxygenPure`
  - `Adv Glass Support S2` contains `SodiumPure`, `CalciumPure`, `OxygenPure`, and `SiliconPure`
  - `Polysulf Support S1` contains `SulfurPure`, `CarbonPure`, and `HydrogenPure`
  - `Polysulf Support S2` contains `CarbonPure`, `HydrogenPure`, and `SulfurPure`
- still unresolved in this pass:
  - most of the newly activated plain-glass and advanced-glass producers remain `JAMMED_MISSING_INGREDIENT`
  - both polysulfide producer banks `968..976` and `6134..6141` remain `JAMMED_MISSING_INGREDIENT`
  - `990`, `6185`, and `6187` remain `JAMMED_MISSING_INGREDIENT`
  - sampled storages `Polysulfide Main 1` and `Polysulfide Main 2` are still empty

Important contradiction to carry forward:

- The construct-index related subgraph confirms:
  - `990` is linked `Polysulfide Main 1 -> Polysulf Support S1`
  - `6185` is linked `Polysulfide Main 2 -> Polysulf Support S2`
- Both TU names imply `Cat3`, but the live link topology points to finished-polysulfide source storages instead.
- That contradiction is now live-confirmed and should be treated as the next investigation point before pushing another blind polysulf layer.

Local recipe verification resolved that contradiction:

- `PolysulfidePlasticProduct` recipe `9524849` consumes:
  - `SulfurPure x100`
  - `CarbonPure x50`
  - `HydrogenPure x50`
  - `Catalyst3 x1`
- and returns:
  - `PolysulfidePlasticProduct x75`
  - `Catalyst3 x1`

That means the factory is using the main polysulfide output storages as the catalyst recirculation reservoir.

Backend fix applied after confirming that:

- corrected catalyst-loop TUs to explicit `Catalyst3` `3729464848`:
  - `990`
  - `6185`
  - `6187`
- seeded catalyst to bootstrap the loop:
  - `Polysulfide Main 1` `4726` <- `100 x Catalyst3`
  - `Polysulfide Main 2` `6170` <- `100 x Catalyst3`
  - `Polysulf Support S1` `782` <- `20 x Catalyst3`
  - `Polysulf Support S2` `6171` <- `20 x Catalyst3`

Observed result after catalyst bootstrap:

- catalyst-loop TUs `990`, `6185`, and `6187` moved to `RUNNING`
- most polysulfide producer machines moved to `RUNNING`
- representative `RUNNING` machines:
  - A bank: `970`, `971`, `972`, `973`, `974`, `975`, `976`
  - B bank: `6134`, `6141`, `6139`, `6138`, `6140`
- laggards at sample time:
  - A bank: `968`, `969`
  - B bank: `6135`, `6137`, `6136`

Important follow-on state:

- the recipe time is `3750 s`, so after a short verification window the main polysulfide buffers still mostly contained catalyst, not finished product
- `Polysulfide S2` and `Polysulfide S5` were still empty at sample time
- the remaining qcore / AQC polysulf-dependent branches are therefore blocked by production lead time rather than another unresolved feeder mapping
- by the same short-window sample:
  - `Glass S1`, `Glass S2`, and `Adv Glass S4` were filling with product
  - `Unc LED` start was visible: `1611` running and `1631` pending
  - `9054`, `9055`, and `9051` were still waiting on upstream product completion
