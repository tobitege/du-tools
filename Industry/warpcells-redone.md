# Warp Cell Factory — Compact Redesign

## Purpose

Redesign the warp cell production branch only (Glass2 → S buffers → Warp Cells Hub output, excluding Warp Drive Assy) for an empty construct, using actual machine counts from the original factory topology trace.

---

## Actual Machine Counts (from original factory trace)

| Tier | Element | Count | Notes |
|------|---------|-------|-------|
| **Smelter** | Smelter Al Fe A1 | **1** | Single AlFe smelter feeds entire chain |
| **Smelter** | Smelter Cu-Ag A1..A9 | **9** | Parallel Cu-Ag pure bank |
| **Smelter** | Smelter CaCo 1..9 | **9** | Parallel Ca-Reinforced Copper bank |
| **Intermediate** | Electronics2 | **9** | Shared bank for AM Core and QA Unit |
| **Buffer** | Adv AM Core S | **5** | Containers feeding WCell Support TUs |
| **Buffer** | Adv QA Unit S | **5** | Containers feeding WCell Support TUs |
| **Transfer** | TU AM Core 1..9 | **9** | One per WCell Support XS |
| **Transfer** | TU QA Unit 1..9 | **9** | One per WCell Support XS |
| **Buffer** | WCell Support XS 1..9 | **9** | Shared input hub for Glass2 |
| **Production** | Glass2 | **70** | 10 per S buffer × 7 S buffers |
| **Buffer** | Warp Cells S1..S7 | **7** | Per-S-buffer output containers |
| **Transfer** | TU Warp Cells 1, 2 | **2** | Final distribution TUs |

---

## Mesh Dimensions Reference

| Element | W (m) | H (m) | D (m) | Stacking? |
|---------|--------|--------|--------|-----------|
| IndustryGlass2 | 2.01 | 1.74 | 6.01 | Can share X,Z with identical machine below/above |
| IndustryElectronics2 | 1.45 | 3.71 | 1.57 | Same |
| IndustrySmelter2 | 3.24 | 7.19 | 2.67 | Same |
| IndustrySmelter | 3.24 | 7.19 | 2.67 | Same |
| TransferUnit | 2.10 | 1.97 | 2.55 | Same |
| ContainerSmall | 1.00 | 1.00 | 1.00 | Can grid in dense arrays |
| ContainerMedium | 2.00 | 2.00 | 2.00 | Can share X,Z vertically |

**Stacking rule:** Machines at identical X,Z with different Y floors do not collide. This is how the original factory achieves dense vertical packing.

---

## Design Principle: Floor Assignments by Throughput

Since Glass2 machines are 70 units and they all need simultaneous feeds from 9 WCell Support buffers, the WCell Support and Glass2 tiers dominate the layout footprint. The smelter row is much smaller (19 machines total) and fits at ground level.

**Floor plan:** Each tier occupies a specific Y floor. Machines on the same floor share X,Z coordinates if stacked vertically, or spread along Z if the row is too wide.

---

## Proposed Layout

### Floor Y=0 — Smelter Row (ground level)

**19 smelters total**, laid out in a single row along X axis, all at Y=0.

```
Z=0 (depth row, all at Y=0)

Smelter Al Fe A1 (id 126)          X=0        — 3.24m wide
Smelter Cu-Ag A1                   X=4         — 3.24m wide
Smelter Cu-Ag A2                   X=7.5       — 3.24m wide
Smelter Cu-Ag A3                   X=11        — 3.24m wide
Smelter Cu-Ag A4                   X=14.5       — 3.24m wide
Smelter Cu-Ag A5                   X=18        — 3.24m wide
Smelter Cu-Ag A6                   X=21.5       — 3.24m wide
Smelter Cu-Ag A7                   X=25        — 3.24m wide
Smelter Cu-Ag A8                   X=28.5       — 3.24m wide
Smelter Cu-Ag A9                   X=32        — 3.24m wide
Smelter CaCo 1                     X=36        — 3.24m wide
Smelter CaCo 2                     X=39.5       — 3.24m wide
Smelter CaCo 3                     X=43        — 3.24m wide
Smelter CaCo 4                     X=46.5       — 3.24m wide
Smelter CaCo 5                     X=50        — 3.24m wide
Smelter CaCo 6                     X=53.5       — 3.24m wide
Smelter CaCo 7                     X=57        — 3.24m wide
Smelter CaCo 8                     X=60.5       — 3.24m wide
Smelter CaCo 9                     X=64        — 3.24m wide

Total width: ~67m. Depth (Z): 2.67m per machine. Total Z extent: 3m.
Player access corridor: Z=-2 to Z=0 (gap in front of machines).
```

### Floor Y=7.5 — Smelter Output XS Buffers

**4 types of XS buffers** for smelter outputs. Each smelter feeds its dedicated XS buffer sitting directly above it (same X,Z). This floor is only ~1m above the smelter row so material flows downward-output to upward-input.

```
Y=7.5

AlFe XS Buffer         (above SmelterAlFe at X=0)
CuAg XS Buffer row     (9 buffers, one per Cu-Ag smelter, at X=4,7.5,11,14.5,18,21.5,25,28.5,32)
CaCo XS Buffer row     (9 buffers, one per CaCo smelter, at X=36,39.5,43,46.5,50,53.5,57,60.5,64)

Each buffer is 1m cube. Row width matches smelter row.
This is a dense XS buffer corridor ~67m long.
```

### Floor Y=9.5 — TU Feeders to Electronics2 (Smelter → Electronics2)

**4 groups of TUs** — one group per material type, each fed by the XS buffers below.

```
Y=9.5

TU AlFe→Elec    (above AlFe XS buffer at X=0)
TU CuAg #1→Elec  (above CuAg buffer at X=4)
TU CuAg #2→Elec  (above CuAg buffer at X=7.5)
... (9 TU CuAg, one per CuAg buffer)
TU CaCo #1→Elec  (above CaCo buffer at X=36)
... (9 TU CaCo)

Each TU is ~2.1m wide. Total width: ~67m.
```

### Floor Y=14 — Electronics2 Bank (shared, 9 machines)

**9 Electronics2 machines** in a 3×3 grid. These feed into Adv AM Core S and Adv QA Unit S containers above.

```
Y=14, Z=0

Electronics2 #1    X=0
Electronics2 #2    X=2.0
Electronics2 #3    X=4.0
Electronics2 #4    X=6.0   — Z=3 row
Electronics2 #5    X=8.0
Electronics2 #6    X=10.0
Electronics2 #7    X=12.0  — Z=6 row
Electronics2 #8    X=14.0
Electronics2 #9    X=16.0

Grid: 3 columns × 3 rows. Each machine 1.45m wide, 1.57m deep.
Total footprint: 16m wide × 6m deep.
```

Each Electronics2 has 11 input plugs. They take feeds from:

- AlFe XS via TU (from the 1 AlFe smelter)
- CuAg XS via TU (from 9 CuAg smelters)
- CaCo XS via TU (from 9 CaCo smelters)
- AM Capsules via TU (from AssemblyXS2, not in this trace but part of chain)
- Adv AM Core Support XS (from another Electronics2 pass — creates a secondary loop)

### Floor Y=19 — Adv AM Core S + Adv QA Unit S Buffers

**10 containers total** (5 AM Core S + 5 QA Unit S). These sit directly above Electronics2 outputs.

```
Y=19, Z=0

Adv AM Core S1     X=0
Adv AM Core S2     X=2.5
Adv AM Core S3     X=5.0
Adv AM Core S4     X=7.5
Adv AM Core S5     X=10.0
Adv QA Unit S1     X=13.0  — second row
Adv QA Unit S2     X=15.5
Adv QA Unit S3     X=18.0
Adv QA Unit S4     X=20.5
Adv QA Unit S5     X=23.0

Each ContainerMedium is 2m cube. Grid arranged to align with Electronics2 above.
Total footprint: ~25m wide × 5m deep.
```

### Floor Y=22 — TU Feeders to WCell Support (Buffer → WCell Support)

**18 TUs total** — 9 TU AM Core + 9 TU QA Unit, one per WCell Support XS.

```
Y=22

9× TU AM Core (one above each Adv AM Core S buffer, feeding into WCell Support XS)
9× TU QA Unit (one above each Adv QA Unit S buffer, feeding into WCell Support XS)

Total: 18 TransferUnits spread in two rows.
```

### Floor Y=26 — WCell Support XS (shared input hub for Glass2)

**9 WCell Support XS containers**. These are the critical shared buffers — each receives from 1 TU AM Core and 1 TU QA Unit, then feeds multiple Glass2 machines.

```
Y=26, Z=0

WCell Support 1   X=0
WCell Support 2   X=2.0
WCell Support 3   X=4.0
WCell Support 4   X=6.0
WCell Support 5   X=8.0   — Z=3 row
WCell Support 6   X=10.0
WCell Support 7   X=12.0
WCell Support 8   X=14.0
WCell Support 9   X=16.0  — Z=6 row

Total footprint: 16m wide × 6m deep. Matches Electronics2 footprint below.
```

### Floor Y=29 — Glass2 Production Bank (warp cell production, 70 machines)

**70 Glass2 machines** — 10 per WCell Support (9 WCell Supports × 10 = 70 Glass2, + 7 S buffer outputs).

```
Y=29

Each WCell Support feeds 10 Glass2 machines arranged in a cluster above it.
For WCell Support 1 (X=0, Z=0):
  Glass2 #1-1  X=0,    Z=0,    Y=29
  Glass2 #1-2  X=2.5,  Z=0,    Y=29
  Glass2 #1-3  X=5.0,  Z=0,    Y=29
  ... (10 machines per WCell Support, arranged 5×2 or similar grid)

Across all 9 WCell Supports, the Glass2 bank spans:
  X: 0 to ~40m (4 columns of 10 machines per WCell Support × 9 WCell Supports)
  Z: 0 to ~12m (2 rows per cluster × 3 Z positions)
  Y: 29 to 36 (Glass2 is 1.74m tall, so top at ~37)

Actually: Glass2 mesh is 2.01m wide × 6.01m deep × 1.74m tall.
Arranging 10 Glass2 per WCell Support in a 5-wide × 2-deep grid:
  Width per cluster: 5 × 2.01m + gaps = ~11m
  Depth per cluster: 2 × 6.01m + gap = ~13m

9 clusters side by side:
  Total X extent: 9 × 11m = ~99m
  Total Z extent: ~13m
```

**Wait — that's enormous. Let me recalculate Glass2 footprint properly.**

Glass2: 2.01m wide × 6.01m deep. 10 Glass2 per WCell Support.
If we arrange each cluster as 5 wide × 2 deep:
- Width: 5 × 2.01 = 10.05m ≈ 10.5m (with small gaps)
- Depth: 2 × 6.01 = 12.02m ≈ 12.5m

9 clusters × 10.5m wide = 94.5m X extent. That's very wide.

**Alternative: Stack Glass2 vertically (same X,Z, different Y).**
Glass2 is 1.74m tall. If we stack 10 Glass2 in a single column at the same X,Z:
- Height: 10 × 1.74m = 17.4m (plus clearance)
- Footprint: just 2.01m × 6.01m per WCell Support cluster

But can Glass2 stack on itself in the same X,Z? In the original factory, multiple Glass2 machines share the same horizontal footprint but are at the same Y level — they're stacked in the Z dimension (side by side in depth), not vertically. The mesh data shows Glass2 is only 1.74m tall, so vertical stacking would require significant height but keep the footprint compact.

**Revised Glass2 arrangement:**
10 Glass2 per WCell Support, stacked in Z (side by side, not on top of each other), all at the same Y:

For WCell Support 1 (at X=0, Z=0):
```
Glass2 cluster, Y=29, Z spread:
  Glass2 #1-1:  X=0,    Z=0
  Glass2 #1-2:  X=2.2,  Z=0
  Glass2 #1-3:  X=4.4,  Z=0
  Glass2 #1-4:  X=6.6,  Z=0
  Glass2 #1-5:  X=8.8,  Z=0
  Glass2 #1-6:  X=0,    Z=6.5
  Glass2 #1-7:  X=2.2,  Z=6.5
  Glass2 #1-8:  X=4.4,  Z=6.5
  Glass2 #1-9:  X=6.6,  Z=6.5
  Glass2 #1-10: X=8.8,  Z=6.5

Cluster footprint: 9m wide × 7m deep.
```

9 clusters × 9m wide = 81m X extent. Still wide, but workable in a large construct.

### Floor Y=37 — Warp Cells S Buffers + Glass2 Output Collection

**7 Warp Cell S buffers** — one per S buffer zone, receiving direct output from 10 Glass2 each.

```
Y=37, Z=0

Each Glass2 cluster's 10 machines output into one ContainerMedium S buffer.
7 S buffers arranged in a row at Z=0, X spacing matching cluster positions.
```

### Floor Y=40 — TU Warp Cells Distribution + Hub

**2 TU Warp Cells** feeding into the Warp Cells Hub output.

```
Y=40

TU Warp Cells 1    X=0
TU Warp Cells 2    X=3
Warp Cells Hub     X=6  (final output, ContainerHub)
```

---

## Summary Footprint

| Floor | Y range | Main elements | Footprint |
|-------|---------|---------------|-----------|
| Smelter | 0–7.5 | 19 smelters | 67m × 3m |
| XS Buffers | 7.5–9.5 | Smelter output buffers | 67m × 3m |
| TU Smelter→Elec | 9.5–12 | Smelter TUs | 67m × 3m |
| Electronics2 | 14–18 | 9 Electronics2 | 16m × 6m |
| AM Core / QA S | 19–21 | 10 buffers | 25m × 5m |
| TU → WCell | 22–25 | 18 TUs | 20m × 5m |
| WCell Support | 26–28 | 9 WCell Support XS | 16m × 6m |
| Glass2 | 29–37 | 70 Glass2 | **81m × 13m** |
| S Buffers | 37–40 | 7 Warp Cell S buffers | 81m × 3m |
| Distribution | 40–43 | 2 TU + Hub | 10m × 3m |

**Overall footprint: ~81m wide × 13m deep × 43m tall**

The Glass2 bank dominates the width. A possible optimization: put the Glass2 bank on a second platform/area connected by a bridge, since it's physically separate from the smelter/refinement rows.

---

## Alternative: Split Layout (Smelter + Refinement vs. Glass2 Production)

Given the massive Glass2 footprint (81m × 13m), the most practical redesign splits the factory into two connected areas:

**Area A — Smelter & Refinement (left side, ~20m × 13m):**
- Y=0: Smelter row (19 machines, 67m wide but only 3m deep)
- Y=8: XS buffers
- Y=10: TUs
- Y=14: Electronics2
- Y=19: AM Core / QA S buffers
- Y=22: TUs to WCell
- Y=26: WCell Support

**Area B — Glass2 Production (right side, ~81m × 13m):**
- Y=0: Align with Area A at same Y=29
- Y=29–37: 70 Glass2 in 9 clusters of 10
- Y=37: S buffers + TUs + Hub

A 3m-wide bridge at Y=29 connects Area A to Area B for player access.

---

## Key Observations for Layout

1. **Smelter row is narrow but wide** — 67m × 3m footprint for 19 smelters. Could be split into 2 rows of 10 if needed.
2. **Electronics2 bank is compact** — only 9 machines in a 16m × 6m area.
3. **Glass2 bank dominates** — 70 machines spanning ~81m wide is the biggest challenge. This is inherent to the 10:1 ratio of Glass2 to upstream elements.
4. **The 1 AlFe smelter is the throughput bottleneck** — the entire chain of 70 Glass2 runs on output from a single Smelter Al Fe A1. This is either intentional game balancing or the AlFe recipe is extremely fast.
5. **WCell Support is the consolidation point** — 9 WCell Support XS containers each aggregate TU AM Core + TU QA Unit feeds before distributing to 10 Glass2 machines each. This 1-to-10 fan-out is the structural key to the layout.
