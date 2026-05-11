# Pipe Family Setup Notes

Date: 2026-04-23
Construct: POIN Factory 26-04-23 (constructId 1002090)
PlayerId: 10000

## Rules

- Medium `S*` output buffers: 12000 L
- XS consumer/support buffers: 1500 L
- Producer maintain target: `10000` for S (pipe_1, pipe_2, pipe_3 are 1L items)
- XS TU refill target: `400` for multi-item support boxes, `1350` for product-only relay boxes
- Never use `run` mode for producers — always `maintain`

## Resolved Product Metadata

- **Basic Pipe** (`pipe_1`): recipe `1552883208`, item type `1799107246`, unit volume 1.0 L
- **Uncommon Pipe** (`pipe_2`): recipe `1552883209`, item type `1799107247`, unit volume 1.0 L
- **Advanced Pipe** (`pipe_3`): recipe `1552883210`, item type `1799107244`, unit volume 1.0 L

## Bas Pipe Topology

### Bas Pipe S1 (id 2296, ContainerMedium 12000L)
- **Output**: Bas Pipe S1 (2296), currently ~10260 pipe_1
- **Producers** (10x T1 IndustryMetalwork, `maintain 10000`, recipe `pipe_1`):
  - BasPipe S1 P1 (2192) — RUNNING ✅
  - BasPipe S1 P2 (2193) — RUNNING ✅
  - BasPipe S1 P3 (2202) — need verify
  - BasPipe S1 P4 (2203) — need verify
  - BasPipe S1 P5 (2212) — need verify
  - BasPipe S1 P6 (2213) — need verify
  - BasPipe S1 P7 (2214) — need verify
  - BasPipe S1 P8 (2215) — need verify
  - BasPipe S1 P9 (2216) — need verify
  - BasPipe S1 P10 (2217) — need verify
- **Silumin Input**: `BasPipe Silumin Support XS1` (2265, ContainerSmall 1500L), fed by TU `2795` "TU BasPipe 1 Silumin" at `maintain 1200`, current 1260 ✅
- **Distribution TUs** (from Bas Pipe S1):
  - TU `2254` "TU BasHyd BasPipe 1a" → `pipe_1`, maintain 400 (→ Bas Hydraulics)
  - TU `2255` "TU BasPipe Main XS1" → `pipe_1`, maintain 1200
  - TU `2256` "TU BasPipe Main XS2" → `pipe_1`, maintain 1200
  - TU `2257` "TU BasPipe Main XS3" → `pipe_1`, maintain 1200, current 1200 ✅
  - TU `2771` "TU AdvHyd 1 BasPipe" → `pipe_1`, maintain 200, current 340 ✅
  - TU `4780` "TU BasHyd BasPipe 2a" → `pipe_1`, maintain 400
  - TU `5084` "TU Bas Pipe 4" → `pipe_1`, maintain 1200
  - TU `5465` "TU Bas Pipe 6" → `pipe_1`, maintain 1200
  - TU `5595` "TU Bas Pipe" → `pipe_1`, maintain 2400 — **JAMMED_OUTPUT_FULL** (dest: Adv Hydraulics 2 Support S1)
  - TU `8802` "TU BasPipe Main XS4" → `pipe_1`, maintain 1200

### Bas Pipe S2 (id 2304, ContainerMedium 12000L)
- **Output**: Bas Pipe S2 (2304), currently ~10355 pipe_1
- **Producers** (10x T1 IndustryMetalwork, `maintain 10000`, recipe `pipe_1`):
  - BasPipe S2 P1 (2218) — STARTED, PENDING (output already above target)
  - BasPipe S2 P2 (2219) — STARTED, PENDING
  - BasPipe S2 P3 (2220) — STARTED, PENDING
  - BasPipe S2 P4 (2221) — STARTED, PENDING
  - BasPipe S2 P5 (2222) — STARTED, PENDING
  - BasPipe S2 P6 (2223) — STARTED, PENDING
  - BasPipe S2 P7 (2224) — STARTED, PENDING
  - BasPipe S2 P8 (2225) — STARTED, PENDING
  - BasPipe S2 P9 (2226) — STARTED, PENDING
  - BasPipe S2 P10 (2227) — STARTED, PENDING
- **Silumin Input S2-A** (producers 2218-2222): `BasPipe S2 Silumin Sup XS3` (1162, ContainerSmall 1500L), silumin 600L
  - Fed by TU `1413` "TU Silumin S1 XS3" → maintain 600, current 600 ✅
  - Source: `Silumin S2` (762, ContainerMedium 12000L) — 10175 silumin ✅
  - NOTE: TU `4357` "TU Sillumin" draws from XS3 but feeds `Unc Burner Support XS3` — NOT a Bas Pipe support
  - NOTE: TU `5680` "TU Silumin AdvAntiGrav" draws from XS3 but feeds `Adv AntiGrav Core Support S1` — NOT a Bas Pipe support
- **Silumin Input S2-B** (producers 2223-2227): `BasPipe S2 Silumin Sup XS4` (1163, ContainerSmall 1500L), silumin 630L
  - Fed by TU `1414` "TU Silumin S2 XS4" → maintain 600, current 0 (already at cap)
  - Source: `Silumin S2` (762) — same bank
  - NOTE: TU `7402` "TU Silumin BasElecEng XS1" draws from XS4 but feeds `Bas Elect Eng Supply XS1` — NOT a Bas Pipe support
- **Distribution TUs** (from Bas Pipe S2):
  - TU `2396` "TU Bas Pipe 1" → pipe_1, maintain 1200
  - TU `2515` "TU Bas Pipe 2" → pipe_1, maintain 1200
  - TU `9042` "TU Bas Pipe XS12" → pipe_1, maintain 1200
  - TU `4765` "TU BasHyd BasPipe 1b" → pipe_1, maintain 400
  - TU `4767` "TU RareHyd 1 BasPipe" → pipe_1, maintain 2400, current 2510
  - TU `4779` "TU BasHyd BasPipe 2b" → pipe_1, maintain 400
  - TU `6968` "TU RareHyd 2 BasPipe" → pipe_1, maintain 2400, current 2460
  - TU `2672` "Transfer Unit Assy 3" — assembly, not pipe TU
  - TU `2673` "Transfer Unit Assy 4" — assembly, not pipe TU

## Unc Pipe Topology

### Unc Pipe S1 Source (id 2320, ContainerMedium 12000L)
- **Output**: Unc Pipe S1 Source (2320), currently 9440 pipe_2
- **Producers** (10x T1 IndustryMetalwork): confirmed running `maintain 10000`
- **Support**:
  - Duralumin + Silumin support boxes (shared with other lines)
- **Distribution TUs**:
  - TU `3220` "TU UncPipe S1 XS2" → `pipe_2`, maintain 2700 ✅
  - TU `3222` "TU UncPipe S1 S2" → `pipe_2`, maintain 2700 ✅
  - TU `2543` "TU Unc Pipe XS1" → `pipe_2`, maintain 1350 ✅ (just configured, RUNNING)
  - TU `6461` "TU Unc Pipe XS5" → `pipe_2`, maintain 1350 ✅ (just configured, RUNNING)
  - TU `7042` "TU Unc Pipe XS6" → `pipe_2`, maintain 1350 ✅ (just configured, RUNNING)
  - TU `8689` → `pipe_2`, maintain 1350, PENDING ✅

### Unc Pipe S2 (id 3221, ContainerMedium 12000L)
- **Type**: Relay only (TU-fed from S1 Source), no local producers
- Fed by TU `3222` "TU UncPipe S1 S2"

## Adv Pipe Topology

### Adv Pipe S1 (id 4461, ContainerMedium 12000L)
- **Output**: ~1000 pipe_3 items (across 7 slots), producers RUNNING ✅
- **Producers** (10x T2 IndustryMetalwork2, `maintain 10000`, recipe `pipe_3`):
  - Adv Pipe 1..10 (ids 4455-4459, 6413, 6415, 6418-6420)
- **Support**: `Adv Pipe 1 Support XS1` (4463, ContainerSmall 1500L):
  - DuraluminProduct 490, AlLiProduct 420, SiluminProduct 490 ✅
  - Fed by: TU 4462 (Silumin maintain 400), TU 4464 (Duralumin maintain 400), TU 4465 (AlLi maintain 400)

### Adv Pipe S2 (id 6169, ContainerMedium 12000L)
- **Output**: empty (just started)
- **Producers** (10x T2 IndustryMetalwork2, `maintain 10000`, recipe `pipe_3`):
  - Adv Pipe S2 P1..P10 (ids 6414, 7027-7035) — RUNNING ✅
- **Support**: `Adv Pipe 2 Support XS1` (6079, ContainerSmall 1500L):
  - DuraluminProduct 410, SiluminProduct 410, AlLiProduct 580 ✅
  - Fed by: TU 7043 (Duralumin maintain 400), TU 7044 (Silumin maintain 400), TU 7045 (AlLi maintain 400)

### Adv Pipe Distribution TUs
- TU `2991` "TU Adv Pipe XS1" → `pipe_3`, maintain 1350, PENDING ✅
- TU `8878` "TU Adv Pipe XS2" → `pipe_3`, maintain 1350, **JAMMED_MISSING_INGREDIENT** (S2 source empty, will resolve when production fills)

## Corrections Made This Session

1. **Bas Pipe S2 starvation resolved**: S2 producers (2218-2227) were PENDING with currentQuantity=0 because they had never been started. Explicitly started all 10 with `maintain 10000`.
2. **Topology correction**: S2 producers draw silumin from TWO separate XS boxes, NOT from `BasPipe Silumin Support XS1` (2265):
   - Producers 2218-2222 ← `BasPipe S2 Silumin Sup XS3` (1162) ← TU `1413` from `Silumin S2` (762)
   - Producers 2223-2227 ← `BasPipe S2 Silumin Sup XS4` (1163) ← TU `1414` from `Silumin S2` (762)
3. **S1 producer id range corrected**: Bas Pipe S1 producers are **2192, 2193, 2202, 2203, 2212-2217** (NOT 2192-2201 as previously noted; ids 2194-2201 are screw producers).
4. **Named elements**:
   - S1 producers: BasPipe S1 P1..P10
   - S2 producers: BasPipe S2 P1..P10
   - XS3: `BasPipe S2 Silumin Sup XS3`
   - XS4: `BasPipe S2 Silumin Sup XS4`
   - TU `5680` → `TU Silumin AdvAntiGrav`
   - TU `7402` → `TU Silumin BasElecEng XS1`
5. **Configured stopped TUs**:
   - TU `8878` "TU Adv Pipe XS2" → pipe_3 maintain 1350 (JAMMED_MISSING_INGREDIENT until S2 produces)
   - TU `2543` "TU Unc Pipe XS1" → pipe_2 maintain 1350 (now RUNNING)
   - TU `6461` "TU Unc Pipe XS5" → pipe_2 maintain 1350 (now RUNNING)
   - TU `7042` "TU Unc Pipe XS6" → pipe_2 maintain 1350 (now RUNNING)

## Known Issues

- TU `5595` "TU Bas Pipe" → JAMMED_OUTPUT_FULL (dest `Adv Hydraulics 2 Support S1` full) — downstream consumer issue, not Pipe family
- TU `8878` "TU Adv Pipe XS2" → JAMMED_MISSING_INGREDIENT — will self-resolve once Adv Pipe S2 production fills the output container
- TU `7402` "TU Silumin BasElecEng XS1" → STOPPED, no recipe — this is a silumin relay for electronics, NOT a Pipe family TU
- id `2672` "Transfer Unit Assy 3" and `2673` "Transfer Unit Assy 4" are Assembly-line TUs drawing from Bas Pipe S2, NOT dedicated pipe distribution TUs