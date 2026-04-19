# Warp Cell Production Chain — Full Topology Trace

**Construct:** POIN Factory 25-08-18 (id 1002090)
**Player:** 10000
**Element count:** 7,646
**Link count:** 13,580
**Last refreshed:** 2026-04-13

## Abbreviations

DO NOT REMOVE!!!

Note: the descriptions here may leave out or potentially add dashes in material/parts names compared to item bank names.

- CaCo: Calcium-Reinforced Copper
- AM Core: Antimatter Core
- QA Unit: Quantum Alignment Unit
- Glass2: internal item bank key for tier 2 of glass furnace industry device
- TU: Transfer Unit: high-deployment element in factory to move items around (in varying batches and durations)
- WCell: Warp Cell
- Tiers 1 to 4: Basic (Bas), Uncommon (Unc), Advanced (Adv), Rare (more seldom)
- KL: Kilo Litres, volume; determines max amount of parts/material related to container capacity
- S1..S5: enumerated containers of size "S" = small (12 KL); could also be "XS" (extra small); 1.5 KL, "M" (medium; 96 KL) or "L" (large; 1972 KL)

## How This Trace Was Performed

The trace was done iteratively using the MCP bridge tools following the documented workflow:

1. `du_construct_index_refresh` — snapshot the full construct into the mod-side SQLite index
2. `du_construct_index_query` with `nameContains: "warp"` — find warp-related elements
3. `du_construct_index_related` with `maxDepth: 3` around the Warp Cells Hub anchor — walk the immediate graph
4. `du_construct_index_industry_supports` on WCell Support containers — try to get branch topology
5. `du_construct_index_related` iteratively on each upstream node — walk one hop at a time to resolve ambiguous branches
6. `du_construct_index_query` by `industryFamily: "smelter"` and `nameContains: "Al Fe"` — locate smelter banks
7. `du_industry_describe_batch` on key elements — attempt live runtime reads

---

## Topology Diagram

```text
=== WARP CELL OUTPUT DISTRIBUTION ===
Warp Cells Hub (id 4291, ContainerHub, hub mode: none)
  ├─ Warp Cells L1 (id 1787, ContainerXL) ← direct output
  ├─ Warp Cells EXL 1 (id 6308, ContainerXXXL) ← direct output
  ├─ Warp Cells EXL 2 (id 6364, ContainerXXXL) ← direct output
  ├─ TU Warp Cells 1 (id 4062, TransferUnit) ← receives from S buffers
  └─ TU Warp Cells 2 (id 6441, TransferUnit) ← receives from S buffers

=== WARP CELL BRANCH (support → Glass2 bank → warp cells) ===
Shared intermediate feed into the support TUs:
  Adv AM Core S1..S5 (id 3527, 3937, 4134, 6620, 6657)
    └─ feed the TU AM Core line
  Adv QA Unit S1..S5 (id 3523, 4050, 4225, 6673, 6715)
    └─ feed the TU QA Unit line

Exact support-to-Glass2 topology for the warp cell bank:
  WCell Support 1 (id 4142)
    ← TU AM Core 1 (id 4140)
    ← TU QA Unit 1 (id 4141)
    → IndustryGlass2 id 2960, 2961, 2962, 2963, 2964, 2965, 2966, 2967, 2968, 2977
    → Warp Cells S1 (id 4061) via Glass2 output

  WCell Support 2 (id 4143)
    ← TU AM Core 2 (id 4138)
    ← TU QA Unit 2 (id 4139)
    → IndustryGlass2 id 4010, 4011, 4012, 4013, 4014, 4015, 4016, 4017, 4018, 4019
    → Warp Cells S2 (id 4060) via Glass2 output

  WCell Support 3 (id 4144)
    ← TU AM Core 3 (id 4136)
    ← TU QA Unit 3 (id 4137)
    → IndustryGlass2 id 4114, 4115, 4116, 4117, 4118, 4119, 4120, 4146, 4147, 4148
    → Warp Cells S3 (id 4135) via Glass2 output

  WCell Support 4 (id 4171)
    ← TU AM Core 4 (id 4170)
    ← TU QA Unit 4 (id 4169)
    → IndustryGlass2 id 4163, 4164, 4165, 4166, 4167, 4168, 4179, 4180, 4181, 4197
    → Warp Cells S4 (id 4172) via Glass2 output

  WCell Support 5 (id 4193)
    ← TU AM Core 5 (id 4190)
    ← TU QA Unit 5 (id 4189)
    → IndustryGlass2 id 4182, 4183, 4184, 4185, 4186, 4187, 4188, 4196, 4198, 4199
    → Warp Cells S5 (id 4195) via Glass2 output

  WCell Support 6 (id 4194)
    ← TU AM Core 6 (id 4192)
    ← TU QA Unit 6 (id 4191)
    → IndustryGlass2 id 4212, 4213, 4214, 4215, 4216, 4217, 4218, 4219, 4236, 4237
    → Warp Cells S6 (id 4224) via Glass2 output

  WCell Support 7 (id 4266)
    ← TU AM Core 7 (id 4268)
    ← TU QA Unit 7 (id 4267)
    → IndustryGlass2 id 4238, 4239, 4240, 4241, 4242, 4243, 4480, 4481, 4494, 4921
    → Warp Cells S7 (id 4443) via Glass2 output

Special/non-bank support nodes:
  WCell Support 8 (id 4273) — disconnected in the 2026-04-13 construct index snapshot
  WCell Support 9 (id 4274) — not part of the seven-bank warp cell production flow
    ← TU QA Unit 9 Stopped (id 4271)
    ← TU AM Core 8 Stopped (id 4270)
    ← TU AM Core 9 Stopped (id 4272)
    → Warp Drive Assy 1 (id 7329) only

Important ordering:
  WCell Support feeds Glass2 machine inputs.
  Glass2 machines feed Warp Cells S1..S7 directly.
  There is no TU between Glass2 output and the Warp Cells S buffers.

=== INTERMEDIATE MATERIALS (Electronics2 bank) ===
Advanced Antimatter Core (`Adv AM Core`) work units (container-centered):
  Treat each `Adv AM Core S#` container as one work unit:
    `direct producers -> Adv AM Core S# -> downstream TUs / consumers`
  In the refreshed construct snapshot, the direct producers linked to these five containers are `IndustryElectronics2`.
  If a `3D Printer M` branch contributes to this family, that contribution is upstream of these direct producer links, not the immediate producer attached to `Adv AM Core S#`.

  Work unit: Adv AM Core S1 (id 3527)
    upstream producers:
      IndustryElectronics2 id 2126, 2127, 2129, 2130, 3253, 3254, 3255, 3256, 3257, 3258
    downstream devices:
      TU AM Core 1 (4140) → WCell Support 1
      TU AM Core 2 (4138) → WCell Support 2
      TU AM Core 3 (4136) → WCell Support 3
      TU AM Core 4 (4170) → WCell Support 4
      TU AM Core 5 (4190) → WCell Support 5
      TU AM Core 6 (4192) → WCell Support 6
      TU AM Core 7 (4268) → WCell Support 7
      TU AM Core 8 Stopped (4270) → WCell Support 9

  Work unit: Adv AM Core S2 (id 3937)
    upstream producers:
      IndustryElectronics2 id 3553, 3554, 3555, 3556, 3557, 3558, 4021, 4022, 4023, 4024
    downstream devices:
      TU AM Core 1 (4140) → WCell Support 1
      TU AM Core 2 (4138) → WCell Support 2
      TU AM Core 3 (4136) → WCell Support 3
      TU AM Core 4 (4170) → WCell Support 4
      TU AM Core 5 (4190) → WCell Support 5
      TU AM Core 6 (4192) → WCell Support 6
      TU AM Core 7 (4268) → WCell Support 7
      TU AM Core 8 Stopped (4270) → WCell Support 9

  Work unit: Adv AM Core S3 (id 4134)
    upstream producers:
      IndustryElectronics2 id 4025, 4026, 4067, 4068, 4069, 4200, 4201, 4202, 4203, 4204
    downstream devices:
      TU AM Core 1 (4140) → WCell Support 1
      TU AM Core 2 (4138) → WCell Support 2
      TU AM Core 3 (4136) → WCell Support 3
      TU AM Core 4 (4170) → WCell Support 4
      TU AM Core 5 (4190) → WCell Support 5
      TU AM Core 8 Stopped (4270) → WCell Support 9
      Maintenance Unit XL Assy 1 (5555)

  Work unit: Adv AM Core S4 (id 6620)
    upstream producers:
      IndustryElectronics2 id 4517, 4518, 4519, 4520, 4521, 4523, 4904, 4905, 4909, 4910
    downstream devices:
      TU AM Core 1 (4140) → WCell Support 1
      TU AM Core 2 (4138) → WCell Support 2
      TU AM Core 3 (4136) → WCell Support 3
      TU AM Core 4 (4170) → WCell Support 4
      TU AM Core 5 (4190) → WCell Support 5
      TU AM Core 6 (4192) → WCell Support 6
      TU AM Core 7 (4268) → WCell Support 7
      TU AM Core 8 Stopped (4270) → WCell Support 9
      Maintenance Unit XL Assy 1 (5555)

  Work unit: Adv AM Core S5 (id 6657)
    upstream producers:
      IndustryElectronics2 id 4223, 4522, 4906, 4907, 4908, 6651, 6652, 6667, 6668, 6669
    downstream devices:
      TU AM Core 1 (4140) → WCell Support 1
      TU AM Core 2 (4138) → WCell Support 2
      TU AM Core 3 (4136) → WCell Support 3
      TU AM Core 4 (4170) → WCell Support 4
      TU AM Core 5 (4190) → WCell Support 5
      TU AM Core 6 (4192) → WCell Support 6
      TU AM Core 7 (4268) → WCell Support 7
      TU AM Core 8 Stopped (4270) → WCell Support 9
      Maintenance Unit XL Assy 1 (5555)

  Important pattern:
    These are five separate AM Core work units, but they feed a mostly shared downstream TU wall rather than one TU per S-container.
    `TU AM Core 9 Stopped (4272)` is not directly linked to `Adv AM Core S1..S5` in the refreshed snapshot.

Advanced Quantum Alignment Unit (`Adv QA Unit`) work units:
  - Adv QA Unit S1 (id 3523)
  - Adv QA Unit S2 (id 4050)
  - Adv QA Unit S3 (id 4225)
  - Adv QA Unit S4 (id 6673)
  - Adv QA Unit S5 (id 6715)

  Upstream producer bank for `Adv QA Unit S1`:
    IndustryElectronics2 id 2115, 2116, 2117, 2118, 2119, 2120, 2121, 2122, 2123, 2124

  Downstream outputs from the `Adv QA Unit` bank:
    TU QA Unit 1 (4141) → WCell Support 1
    TU QA Unit 2 (4139) → WCell Support 2
    TU QA Unit 3 (4137) → WCell Support 3
    TU QA Unit 4 (4169) → WCell Support 4
    TU QA Unit 5 (4189) → WCell Support 5
    TU QA Unit 6 (4191) → WCell Support 6
    TU QA Unit 7 (4267) → WCell Support 7
    TU QA Unit 8 Stopped (4269) → Adv QA Unit 512 (id 8994), not to a WCell Support box
    TU QA Unit 9 Stopped (4271) → WCell Support 9, but no upstream QA Unit S links were present in the snapshot

  Other downstream outputs from `Adv QA Unit S1`:
    Adv Optim Cnt L Assy 2 (id 4442)
    Adv Optim Cnt L Assy 5 (id 5545)
    unnamed TransferUnit (id 7309) → Adv QAU4Containers S1 (id 7308)

  Shared-input pattern at `WCell Support 1`:
    `WCell Support 1` shows TU QA Unit 1 drawing from all five `Adv QA Unit S1..S5`.

  `Adv QA Unit S1` input work unit at `IndustryElectronics2 2115`:
    IndustryElectronics2 2115
      ← Quantum Cores XS1 (id 4055)
      ← Polysulfide XS9 (id 1902)
      ← Polycalcite XS7 (id 3832)
      ← Polycarb S6B XS1 (id 3524)
      ← Bas LED XS1 (id 3526)
      → Adv QA Unit S1 (id 3523)

  Quantum Core aggregation work unit feeding the `Advanced Quantum Alignment Unit` producers:
    Quantum Cores XS1 (id 4055)
      upstream TUs:
        TU Bas QC 1 (id 4052)
        TU Unc QC 1 (id 4053)
        TU Adv QC 1 (id 4054)
      downstream `IndustryElectronics2` producers:
        id 2115, 2116, 2117, 2118, 2119, 2120, 2121, 2122, 2123, 2124

  Relay work units for the `Adv QA Unit S1` input path:
    Polysulfide XS9 (id 1902)
      ← TU Polysulf 9B (id 6155)
    TU Polysulf 9B
      ← Polysulfide S9 (id 802)
      → Polysulfide XS9

    Polycalcite XS7 (id 3832)
      ← TU Polycalcite (id 3831)
    TU Polycalcite
      ← Polycalcite XS6 (id 2072)
      → Polycalcite XS7

    Polycarb S6B XS1 (id 3524)
      ← unnamed TransferUnit (id 2044)
    unnamed TransferUnit (id 2044)
      ← Polycarb S6 (id 743)
      → Polycarb S6B XS1

    Bas LED XS1 (id 3526)
      ← unnamed TransferUnit (id 3525)
    unnamed TransferUnit (id 3525)
      ← Bas LED S1 (id 1508)
      ← Bas LED S2 (id 1498)
      → Bas LED XS1

  Full printer-backed Quantum Core work units:
    These printer-backed Quantum Core buffers should not be read as isolated single-tier units.
    In practice, the Quantum Core buffer family usually participates in a four-tier Quantum Core Unit set:
      Basic + Uncommon + Advanced + Rare.
    The concrete entries below are tier-specific work-unit anchors inside that broader multi-tier Quantum Core supply path.

    Basic-tier Quantum Core work unit anchor:
      Bas Quantum Cores XS1 (id 6680)
        upstream printer producers:
          Industry3DPrinter id 3053 (`Bas QC Cells 1`)
          Industry3DPrinter id 4504 (`Bas QC Cells 2`)
          Industry3DPrinter id 5534
          Industry3DPrinter id 5538
          Industry3DPrinter2 id 6693
          Industry3DPrinter2 id 6694
        downstream transfer units:
          TU Bas QC 1 (id 4052)
          TU Bas QC 2 (id 4057)
          TU Bas QC 3 (id 4130)
          TU Bas QC 4 (id 6681)
          TU Bas QC 5 (id 6713)
          TU Bas QC 6 (id 9057)
          TU AQB Bas QC (id 7289)

    Uncommon-tier Quantum Core work unit anchor:
      Unc Quantum Cores XS1 (id 6679)
        upstream printer producers:
          Industry3DPrinter id 3054 (`Unc QC Cells 1`)
          Industry3DPrinter id 4508 (`Unc QC Cells 2`)
          Industry3DPrinter id 5070 (`Unc QC Cells 3`)
          Industry3DPrinter id 5535
          Industry3DPrinter id 5536
          Industry3DPrinter id 5539
        downstream transfer units:
          TU Unc QC 1 (id 4053)
          TU Unc QC 2 (id 4058)
          TU Unc QC 3 (id 4131)
          TU Unc QC 4 (id 6682)
          TU Unc QC 5 (id 6712)
          TU Unc QC 6 (id 9058)
          TU AQB Unc QC (id 7288)

    Advanced-tier Quantum Core work unit anchors:
      Adv Quantum Cores S1 (id 4051)
        upstream printer producers:
          Industry3DPrinter2 id 3059 (`Adv QC Cells A3`)
          Industry3DPrinter2 id 3066 (`Adv QC Cells A2`)
          Industry3DPrinter2 id 3069 (`Adv QC Cells A1`)
          Industry3DPrinter2 id 5416 (`Adv QC Cells A5`)
          Industry3DPrinter2 id 5417 (`Adv QC Cells A4`)
          Industry3DPrinter2 id 9046 (`Adv QC Cells B3`)
          Industry3DPrinter2 id 9047 (`Adv QC Cells B4`)
          Industry3DPrinter2 id 9048 (`Adv QC Cells B1`)
          Industry3DPrinter2 id 9049 (`Adv QC Cells B2`)
          Industry3DPrinter2 id 9050 (`Adv QC Cells B5`)
        downstream transfer units:
          TU Adv QC 1 (id 4054)
          TU Adv QC 2 (id 4059)
          TU Adv QC 3 (id 4132)
          TU Adv QC 4 (id 6683)
          TU Adv QC 5 (id 6711)
          TU Adv QC 6 (id 9059)
          TU AQB Adv QC (id 7290)

      Adv Quantum Cores S2 (id 6590)
        upstream printer producers:
          Industry3DPrinter2 id 6570, 6571, 6572, 6573, 6574, 6575, 6576, 6577, 6578
        downstream transfer units:
          TU Adv QC 1 (id 4054)
          TU Adv QC 2 (id 4059)
          TU Adv QC 3 (id 4132)
          TU Adv QC 4 (id 6683)
          TU Adv QC 5 (id 6711)

      Adv Quantum Cores S3 (id 6616)
        upstream printer producers:
          Industry3DPrinter2 id 6601, 6602, 6603, 6604, 6605, 6606, 6607, 6608, 6609
        downstream transfer units:
          TU Adv QC 1 (id 4054)
          TU Adv QC 2 (id 4059)
          TU Adv QC 3 (id 4132)
          TU Adv QC 4 (id 6683)
          TU Adv QC 5 (id 6711)

Support containers that also feed the Electronics2 bank:
  - Adv AM Core Support S1 (id 4160)
  - Adv AM Core Support S2 (id 4038)
  - Adv AM Core Support S3 (id 4159)
  - Adv AM Core Support S4 (id 6621)
  - Adv AM Core Support S5 (id 6658)
  - Adv QA Unit Support S2 (id 4049)
  - Adv QA Unit Support S3 (id 4234)
  - Adv QA Unit Support S4 (id 6674)
  - Adv QA Unit Support S5 (id 6716)

Known Electronics2 inputs mentioned elsewhere in this branch:
  - Al Fe XS (id 1158 etc.) ← from Al Fe smelter output chain
  - Cu-Ag XS (id 2755) ← from Cu-Ag smelter bank
  - CaReinfCop XS (id 1188) ← from CaCo refiner bank
  - AM Capsules XS (id 4145)
  - Quantum Cores XS (id 4055) ← from the Bas/Unc/Adv QC relay TUs
  - Polysulfide XS (id 1902) ← from TU Polysulf 9B
  - Polycalcite XS (id 3832) ← from TU Polycalcite
  - Polycarb S6B XS (id 3524) ← from unnamed TransferUnit 2044
  - Bas LED XS (id 3526) ← from unnamed TransferUnit 3525

Upstream slice for `IndustryGlass2 2960`:
  IndustryGlass2 2960
    ← WCell Support 1 (id 4142)
    → Warp Cells S1 (id 4061)

  WCell Support 1
    ← TU AM Core 1 (id 4140)
    ← TU QA Unit 1 (id 4141)

  TU AM Core 1
    ← Adv AM Core S1..S5 (id 3527, 3937, 4134, 6620, 6657)

  Source buffer in the `Adv AM Core` bank:
    Adv AM Core S1 (id 3527)
      ← IndustryElectronics2 id 2126, 2127, 2129, 2130, 3253, 3254, 3255, 3256, 3257, 3258

  `IndustryElectronics2 2126` input work unit:
    IndustryElectronics2 2126
      ← Adv AM Core Support S1 (id 4160)
      ← AM Capsules 2 (id 4145)
      ← CaReinfCop XS9 (id 1188)
      ← Cu-Ag XS9 (id 2755)
      → Adv AM Core S1

  Immediate upstream relay work units from `IndustryElectronics2 2126`:
    Adv AM Core Support S1 (id 4160)
      ← TransferUnit 4161
      ← TransferUnit 6659

    TransferUnit 4161
      ← Al Fe XS9 (id 1158)
      → Adv AM Core Support S1

    TransferUnit 6659
      ← Bas Comp XS7 (id 1974)
      → Adv AM Core Support S1

    AM Capsules 2 (id 4145)
      ← IndustryGlass2 id 2969, 2970, 2971, 2974, 2981

    AM Capsules Support 1 (id 4037)
      ← TU Glass 1 (id 4032)
      ← TU Adv Glass 1 (id 4033)
      ← TU Ag-Li Reinf Glass 1 (id 4034)
      ← TU Unc Conn 1 (id 4035)
      ← TU Bas Conn 1 (id 4036)

    TU Glass 1 (id 4032)
      ← Glass S1 (id 823)
      ← Glass S3 (id 843)
      → AM Capsules Support 1

    TU Adv Glass 1 (id 4033)
      ← Adv Glass S3 (id 844)
      → AM Capsules Support 1

    TU Ag-Li Reinf Glass 1 (id 4034)
      ← Ag Li Glass S1 (id 1495)
      → AM Capsules Support 1

    TU Unc Conn 1 (id 4035)
      ← Unc Connector XS1 (id 2003)
      → AM Capsules Support 1

    TU Bas Conn 1 (id 4036)
      ← Bas Connect XS2 (id 1981)
      → AM Capsules Support 1

    CaReinfCop XS9 (id 1188)
      ← TU CaReinf Copper S3 XS8 (id 1462)

    Cu-Ag XS9 (id 2755)
      ← TU CuAg XS9 (id 2742)

Printer-layer position in the `Adv AM Core` path:
  `3D Printer M` machines do not appear as direct producers of the `Adv AM Core S#` work unit in this slice.
  `IndustryElectronics2 2126` is the direct producer in this slice.
  Any `3D Printer M` participation for this family is upstream of the ingredient and support paths listed above.

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

  AM Capsules support work unit proven in the `Adv AM Core` upstream slice:
    AM Capsules Support 1 (id 4037)
      ← TU Glass 1 (id 4032) from Glass S1 (id 823), Glass S3 (id 843)
      ← TU Adv Glass 1 (id 4033) from Adv Glass S3 (id 844)
      ← TU Ag-Li Reinf Glass 1 (id 4034) from Ag Li Glass S1 (id 1495)
      ← TU Unc Conn 1 (id 4035) from Unc Connector XS1 (id 2003)
      ← TU Bas Conn 1 (id 4036) from Bas Connect XS2 (id 1981)
      → IndustryGlass2 id 2969, 2970, 2971, 2974, 2981
      → AM Capsules 2 (id 4145)

  Basic-components relay work unit feeding `Adv AM Core Support S1`:
    Bas Comp XS7 (id 1974)
      → unnamed TransferUnit 6659
      → Adv AM Core Support S1 (id 4160)

=== ORE INPUTS (smelter bank roots) ===
  Aluminum Ore  →  Smelter Al Fe A1  →  Al Fe pure
  Copper Ore    →  Cu-Ag A1..A9      →  Cu-Ag pure
  Calcium+Cobalt→  CaCo Refiner 1..9 →  Ca-Reinforced Copper pure

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
