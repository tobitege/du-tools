# Panel Industry Setup Notes

Date: 2026-04-23

Construct/player used for all live bridge calls:

- `constructId=1002090`
- `playerId=10000`

## Corrections

The first write pass used unproven generic maintain quantities and did not prove product volume against each output container. That was wrong.

First corrective pass on 2026-04-23 set every producer changed by this setup pass to `maintain=1`. That prevented oversized targets but was not an operating target.

Second corrective pass on 2026-04-23 used MCP item-bank `unitVolume` metadata and live output storage capacity to set 90% fill targets:

- Formula: `floor(maxVolumeL * 0.90 / unitVolume)`
- Mobile Panel L: `unitVolume=1374.4`, medium container target `7`
- Mobile Panel M: `unitVolume=259.2`, medium container target `41`
- Mobile Panel S: `unitVolume=49.6`, XS container target `27`
- Mobile Panel XS: `unitVolume=9.6`, XS container target `140`
- Mobile Panel XL: `unitVolume=7420.8`, `XL Panels Hub` target `39`
- Glass Panel L: `unitVolume=24`, `Glass Panel L Hub` target `7200`
- Glass Panel M: `unitVolume=16`, `Glass Panel S+M Hub` target `675`
- Glass Panel S: `unitVolume=4`, `Glass Panel S+M Hub` target `2700`

## Topology Findings

Direct producer output banks:

- Mobile Panel L:
  - `Bas Mob Panel L S1` id `2290` <- `Bas Mob Panel L 1` id `2417`
  - `Unc Mob Panel L S1` id `2292` <- `Unc Mob Panel L 1` id `2625`, `Unc Mob Panel L 2` id `2624`
  - `Adv Mob Panel L S1` id `2904` <- `Adv Mob Panel L 1` id `2639`, `Adv Mob Panel L 2` id `5228`
  - `Adv Mob Panel L S2` id `6411` <- `Adv Mob Panel L 3` id `5235`, `Adv Mob Panel L 4` id `5226`
- Mobile Panel M:
  - `Bas Mob Panel M S1 FULL` id `2305` <- `Bas Mob Panel M 1` id `2244`
  - `Bas Mob Panel M S2 FULL` id `2902` <- `Bas Mob Panel M 2` id `5478`
  - `Bas Mob Panel M S3` id `7165` <- `Bas Mob Panel M 3` id `7196`
  - `Unc Mob Panel M S1` id `2300` <- `Unc Mob Panel M 1` id `2606`, `Unc Mob Panel M 2` id `2627`
  - `Adv Mob Panel M S1 FULL` id `2286` <- `Adv Mob Panel M 1` id `3217`, `Adv Mob Panel M 2` id `5616`, `Adv Mob Panel M 3` id `5603`
  - `Rare Mob Panel M S1` id `8884` <- `Rare Mob Panel M 1` id `8626`, `Rare Mob Panel M 2` id `8627`, `Rare Mob Panel M 3` id `8623`
- Mobile Panel S:
  - `Bas Mob Panel S XS1` id `2532` <- `Bas Mob Panel S 1` id `2437`, `Bas Mob Panel S 2` id `5482`
  - `Unc Mob Panel S XS1` id `2537` <- `Unc Mob Panel S 1` id `2607`
  - `Adv Mob Panel S XS1` id `6442` <- `Adv Mob Panel S 1` id `6417`
- Mobile Panel XS:
  - `Bas Mob Panel XS XS1` id `2524` <- `Bas Mob Panel XS 1` id `2438`, `Bas Mob Panel XS 2` id `5480`, `Bas Mob Panel XS 3` id `5475`
  - `Unc Mob Panel XS XS1` id `2520` <- `Unc Mob Panel XS 1` id `2628`
  - `Adv Mob Panel XS XS1` id `6379` <- `Adv Mob Panel XS 1` id `6421`
  - `Rare Mob Panel XS XS1` id `8811` <- `Rare Mob Panel XS 1` id `8628`
- Mobile Panel XL:
  - `XL Panels Hub` id `7502` <- `Bas Mob Panel XL 1` id `2436`, `Unc Mobile Panel XL 1` id `2626`, `Adv Mob Panel XL 1` id `4031`, `Adv Mob Panel XL 2` id `7365`
- Glass Panel:
  - `Glass Panel L Hub` id `4542` <- `Glass Panel L Assy 1` ids `3284`, `3285`, `3286`, `3287`, `3292`, plus renamed direct producers `3086`-`3090`
  - `Glass Panel S+M Hub` id `7296` <- `Glass Panel M Assy 1` id `4256`, `Glass Panel S Assy 1` id `4257`

Panel-named boxes classified as support/relay/storage-only, not direct Panel output banks:

- `Adv Mob Panel Support S1` id `2899`: support/input buffer for Adv Mobile Panel producers; fed by TUs `5579`, `5580`, `5581`, `5582`, `5583`, `5584`, `5585`, `5596`.
- `Bas Hydraulics Panels S1` id `7166`: support/input buffer for Unc Mobile Panel producers; fed by TU `7167`.
- `Glass Panel L Support XS1` id `4538`: support/input buffer for Glass Panel L producers; mixed inbound from glass/fixation TUs and casing printers.
- `Glass Panel L L1` id `8474`, `Glass Panel S+M S1` id `2331`, `Mobile XL Panels L1` id `7501`: hub child containers.
- `Glass Panel L M1` id `4543`: storage-only/no useful links in the index.
- `XL Panels Arms M1` id `2250`: mixed arms/chambers output bank, not a Panel producer bank.

## Writes

Renamed default-named Glass Panel L direct producers:

- `3086` -> `Glass Panel L Assy 6`
- `3087` -> `Glass Panel L Assy 7`
- `3088` -> `Glass Panel L Assy 8`
- `3089` -> `Glass Panel L Assy 9`
- `3090` -> `Glass Panel L Assy 10`

Configured maintain recipes:

- Mobile Panel L recipe `mobilepanel_1_l`, 90% target `7`: ids `2417`, `2625`, `2624`, `2639`, `5228`, `5235`, `5226`
- Mobile Panel M recipe `mobilepanel_1_m`, 90% target `41`: ids `2244`, `5478`, `7196`, `2606`, `2627`, `3217`, `5616`, `5603`, `8626`, `8627`, `8623`
- Mobile Panel S recipe `mobilepanel_1_s`, 90% target `27`: ids `2437`, `5482`, `2607`, `6417`
- Mobile Panel XS recipe `mobilepanel_1_xs`, 90% target `140`: ids `2438`, `5480`, `5475`, `2628`, `6421`, `8628`
- Mobile Panel XL recipe `mobilepanel_1_xl`, 90% target `39`: ids `2436`, `2626`, `4031`, `7365`
- Glass Panel L recipe `GlassLarge`, 90% target `7200`: ids `3284`, `3285`, `3286`, `3287`, `3292`, `3086`, `3087`, `3088`, `3089`, `3090`
- Glass Panel M recipe `GlassMedium`, 90% target `675`: id `4256`
- Glass Panel S recipe `GlassSmall`, 90% target `2700`: id `4257`

## Live Verification

Device state after write:

- Running with 90% targets: `Bas Mob Panel L 1` id `2417`; `Bas Mob Panel S 1` id `2437`; `Bas Mob Panel S 2` id `5482`; `Bas Mob Panel XS 1` id `2438`; `Bas Mob Panel XS 2` id `5480`; `Bas Mob Panel XS 3` id `5475`; `Bas Mob Panel XL 1` id `2436`; `Glass Panel M Assy 1` id `4256`; `Glass Panel S Assy 1` id `4257`
- Jammed missing ingredient with 90% targets: all configured Unc/Adv/Rare Mobile Panel producers, Bas Mobile Panel M producers, Adv Mobile Panel S/XS/XL producers, Rare Mobile Panel M/XS producers, and Glass Panel L producers.

2026-04-23 recheck after user correction:

- Queried all metalwork industries with name containing `Panel`; result count was `32`.
- All 32 named `Mob/Mobile Panel` metalworks have recipe set and 90% volume-based maintain target:
  - L target `7`
  - M target `41`
  - S target `27`
  - XS target `140`
  - XL target `39`
- `XL Panels Arms M1` was rechecked and not configured as part of this correction because the user clarified the intended scope is metalworks named like `Adv Mob Panel S 1`, not arms/chambers.

2026-04-23 XS-container target reapply:

- Reapplied S Panel target `27` to `Bas Mob Panel S 1` id `2437`, `Bas Mob Panel S 2` id `5482`, `Unc Mob Panel S 1` id `2607`, `Adv Mob Panel S 1` id `6417`.
- Reapplied XS Panel target `140` to `Bas Mob Panel XS 1` id `2438`, `Bas Mob Panel XS 2` id `5480`, `Bas Mob Panel XS 3` id `5475`, `Unc Mob Panel XS 1` id `2628`, `Adv Mob Panel XS 1` id `6421`, `Rare Mob Panel XS 1` id `8628`.
- Live readback confirmed no listed S/XS Panel metalwork remained at `1000`.

Output storage verification:

- Mobile Panel output banks checked: ids `2290`, `2305`, `2902`, `7165`, `2532`, `2524`, `2292`, `2300`, `2537`, `2520`, `2904`, `6411`, `2286`, `6442`, `6379`, `8884`, `8811`; all were empty immediately after setup.
- `XL Panels Hub` id `7502`: empty.
- `Glass Panel L Hub` id `4542`: empty.
- `Glass Panel S+M Hub` id `7296`: `GlassSmall` quantity `1002`, `GlassMedium` quantity `400`.

Support/source storage verification:

- Bas Mobile Panel sample support/source boxes: `Bas Screw XS2 FULL` id `2518` had `screw_1` `1258`; `Silumin XS10` id `1169` had `SiluminProduct` `643`; `Bas Mob Silumin Support XS1` id `2915` empty; `Silumin XS5` id `1164` had `SiluminProduct` `658`; `Silumin XS6` id `1165` had `SiluminProduct` `614`; `Silumin S1` id `761` had `SiluminProduct` `7622`; `Bas Screw S2A` id `2288` had `screw_1` `9385`.
- Unc Mobile Panel support/source boxes: `Bas Hydraulics Panels S1` id `7166` empty; `Bas Screw XS1 FULL` id `2388` had `screw_1` `1200`; `Duralumin XS2` id `1191` had `DuraluminProduct` `600`; `Unc Hydaulics S1` id `2315` had `hydraulics_2` `1200`; `Unc Screw XS1 FULL` id `2479` had `screw_2` `400`.
- Adv Mobile Panel support/source boxes: `Adv Mob Panel Support S1` id `2899` had `hydraulics_2` `1100` and `hydraulics_3` `100`; `Adv Hydraulics M1` id `2249` had `hydraulics_3` `1660`; `Al Li Alloy S2` id `5078` had `AlLiProduct` `4899`.
- Rare Mobile Panel support/source boxes: `Adv Hydaulics S2` id `8865` had `hydraulics_3` `1200`; `Adv Screw XS3` id `8861` had `screw_3` `1400`; `Rare Hydraulics M1 B S1` id `8813` had `hydraulics_4` `1000`; `SC-AL 5 XS1` id `8874` had `ScAlProduct` `500`; `Unc Hydaulics S2 FULL` id `3320` had `hydraulics_2` `1200`; `Unc Screw XS10 FULL` id `8860` had `screw_2` `400`.
- Glass Panel support/source boxes: `Glass Panel L Support XS1` id `4538` had `GlassProduct` `800`; `Bas Casing XS XS1 FULL` id `3441` had `casing_1_xs` `456`; `Bas Fixation A XS1 FULL` id `3437` had `fixation_1` `318`; `Glass S1` id `823` had `GlassProduct` `10008`.

## Blocker Classification

Overall blocker type: `source starvation` / `support sizing`, not setup.

Setup is complete for the direct Panel producer banks because every stopped/no-recipe direct producer now has a maintain recipe assigned. The remaining blocked state is live input availability:

- `Bas Hydraulics Panels S1` id `7166` is empty while Unc Mobile Panel producers depend on it.
- `Bas Mob Silumin Support XS1` id `2915` is empty and Bas Mobile Panel M producers are jammed.
- `Adv Mob Panel Support S1` id `2899` has some support stock, but Adv producers still report missing ingredients; support mix or refill pressure is insufficient.
- Glass Panel L support has glass available, but Glass Panel L producers are still missing at least one required support ingredient in the proven support path.

## Adv Mob Panel S 1 Correction

2026-04-23:

- Target machine: `Adv Mob Panel S 1` id `6417`.
- Output storage: `Adv Mob Panel S XS1` id `6442`.
- Recipe/state before feeder fix: `mobilepanel_1_s`, maintain `27`, `JAMMED_MISSING_INGREDIENT`.
- Proven direct inputs:
  - `Adv Hydaulics S1 FULL` id `2295`: `hydraulics_3` quantity `1200`
  - `Adv Screw XS2 FULL` id `6446`: `screw_3` quantity `400`
  - `Al-Li XS A1` id `2793`: `AlLiProduct` quantity `516`
  - `Bas Hydraulics Panels S1` id `7166`: empty
  - `Bas Screw XS10 FULL` id `6443`: `screw_1` quantity `1316`
  - `Unc Hydaulics S2 FULL` id `3320`: `hydraulics_2` quantity `1200`
  - `Unc Screw XS6 FULL` id `6426`: `screw_2` quantity `400`
- Blocker: `Bas Hydraulics Panels S1` id `7166` was empty because feeder `TU Bas Hydraulics Panels S1` id `7167` was stopped with no recipe.
- Source for feeder: `Bas Hydaulics S1 FULL` id `2289`, containing `hydraulics_1` quantity `1200`.
- Write: configured TU id `7167` to maintain `hydraulics_1` at `1080`.
  - `hydraulics_1` unit volume: `10 L`
  - support box capacity: `12000 L`
  - target: `floor(12000 * 0.90 / 10) = 1080`
- Verification immediately after write:
  - TU id `7167`: `RUNNING`, recipe `hydraulics_1`, maintain `1080`, batch time `500`
  - `Bas Hydraulics Panels S1` id `7166`: still empty on immediate readback
  - `Adv Mob Panel S 1` id `6417`: still `JAMMED_MISSING_INGREDIENT` on immediate readback
- Current blocker classification: `transit delay` / transfer cycle time, not setup.

## Adv Mob Panel Support S1 Correction

2026-04-23:

- Support storage: `Adv Mob Panel Support S1` id `2899`, construct `1002090`, capacity `12000 L`.
- Downstream consumers: `Adv Mob Panel L 1` id `2639`, `Adv Mob Panel L 2` id `5228`, `Adv Mob Panel L 3` id `5235`, `Adv Mob Panel L 4` id `5226`, `Adv Mob Panel M 1` id `3217`, `Adv Mob Panel M 2` id `5616`, `Adv Mob Panel M 3` id `5603`, `Adv Mob Panel XL 1` id `4031`, `Adv Mob Panel XL 2` id `7365`, `Adv Mob Panel XS 1` id `6421`.
- Confirmed bad pre-correction state:
  - `TU Unc Hydraulics` id `5580`: `hydraulics_2`, maintain `12000`, `JAMMED_OUTPUT_FULL`.
  - `TU Adv Hydraulics 2` id `5596`: `hydraulics_3`, maintain `12000`, `JAMMED_OUTPUT_FULL`.
  - Support storage id `2899`: `hydraulics_2` quantity `1100`, `hydraulics_3` quantity `100`; full at `12000 L`.
- Corrected feeder targets use 90% of the 12000 L support container split across the eight feeder paths:
  - `TU Adv Hyd AdvPanels` id `5579`: `hydraulics_3`, source `Adv Hydaulics S1 FULL` id `2295`, maintain `135`.
  - `TU Unc Hydraulics` id `5580`: `hydraulics_2`, source `Unc Hydaulics S1` id `2315`, maintain `135`.
  - `TU Bas Hydraulics` id `5581`: `hydraulics_1`, source `Bas Hydaulics S2 FULL` id `2319`, maintain `135`.
  - `TU Unc Screw` id `5582`: `screw_2`, source `Unc Screw XS2` id `2539`, maintain `1350`.
  - `TU Adv Screw` id `5583`: `screw_3`, source `Adv Screw XS1` id `2821`, maintain `1350`.
  - `TU Bas Screw` id `5584`: `screw_1`, source `Bas Screw XS3 FULL` id `2492`, maintain `1350`.
  - `TU Al-Li` id `5585`: `AlLiProduct`, source `Al-Li XS A2` id `2792`, maintain `1350`.
  - `TU Adv Hydraulics 2` id `5596`: `hydraulics_3`, source `Adv Hydraulics Main S2` id `2865`, maintain `135`.
- Removed excess `hydraulics_2` from support storage id `2899`: took `965` units after the bad `12000` target had filled the box.
- Verification after correction:
  - Support storage id `2899`: `hydraulics_2` quantity `185`, `hydraulics_3` quantity `150`, `AlLiProduct` quantity `300`, `screw_1` quantity `200`; volume `3750 L` on branch snapshot, below capacity.
  - Feeder TUs id `5579`, `5581`, `5582`, `5583`, `5584`, `5585` are `RUNNING`.
  - Feeder TUs id `5580` and `5596` are `PENDING` because their current support quantities are already above the corrected maintain targets.
  - No feeder remains configured at maintain `12000`.
- Source verification:
  - `Adv Hydaulics S1 FULL` id `2295`: `hydraulics_3` quantity `1200`.
  - `Adv Hydraulics Main S2` id `2865`: `hydraulics_3` available.
  - `Bas Hydaulics S2 FULL` id `2319`: `hydraulics_1` quantity `1200`.
  - `Unc Hydaulics S1` id `2315`: `hydraulics_2` quantity `1200`.
  - `Bas Screw XS3 FULL` id `2492`: `screw_1` quantity `1208`.
  - `Adv Screw XS1` id `2821`: `screw_3` quantity `1160`.
  - `Unc Screw XS2` id `2539`: `screw_2` quantity `400`.
  - `Al-Li XS A2` id `2792`: source is below corrected target.
- Current downstream state after correction: all listed Adv Mobile Panel consumers still report `JAMMED_MISSING_INGREDIENT`.
- Current blocker classification: `source starvation` / `transit delay`.
  - Setup blocker is cleared for this support branch because all eight feeder TUs now have recipes and bounded maintain targets.
  - The branch is no longer relay-blocked by a full support container.
  - Remaining missing ingredients depend on transfer cycle completion and limited source stock, especially `screw_2`, `screw_3`, and `AlLiProduct`.

Upstream source-box correction:

- `Unc Screw XS2` id `2539` is fed by `TU Unc Screw XS2` id `2642` from `Unc Screw S1 Source` id `2291`.
  - Source id `2291`: `screw_2` quantity `9870`.
  - Before correction, TU id `2642` was `RUNNING`, recipe `screw_2`, maintain `500`.
  - Write: configured TU id `2642` to maintain `screw_2` at `1350` for the 1500 L XS box.
- `Adv Screw XS1` id `2821` is fed by `TU Adv Screw XS1` id `2822` from `Adv Screw S1` id `2823`.
  - Source id `2823`: `screw_3` quantity `8730`.
  - TU id `2822` already had maintain `1350`; no write needed.
- `Al-Li XS A2` id `2792` is fed by `TU Al Li A2` id `2780` from `Al Li Alloy S1` id `2301`.
  - Source id `2301`: `AlLiProduct` quantity `72`, `Catalyst3` quantity `0`.
  - Before correction, TU id `2780` was recipe `AlLiProduct`, maintain `500`, `JAMMED_MISSING_INGREDIENT`.
  - Write: configured TU id `2780` to maintain `AlLiProduct` at `1350` for the 1500 L XS box.
- Verification after upstream correction:
  - `TU Unc Screw XS2` id `2642`: `RUNNING`, maintain `1350`, current `400`.
  - `TU Adv Screw XS1` id `2822`: `RUNNING`, maintain `1350`, current `1160`.
  - `TU Al Li A2` id `2780`: `JAMMED_MISSING_INGREDIENT`, maintain `1350`, current `408`; blocker is source starvation at `Al Li Alloy S1` id `2301`.
  - `TU Unc Screw` id `5582`, `TU Adv Screw` id `5583`, and `TU Al-Li` id `5585` feeding `Adv Mob Panel Support S1` are configured at maintain `1350`.
  - `Adv Mob Panel Support S1` id `2899`: `hydraulics_2` `185`, `hydraulics_3` `150`, `AlLiProduct` `500`, `screw_1` `200`.
- Updated blocker classification: `transit delay` for `screw_2`/`screw_3` transfers and `source starvation` for `AlLiProduct`.

Al-Li source trace:

- `Al Li Alloy S1` id `2301` is produced by smelters id `2661` through `2669`.
- Live smelter verification: all nine smelters are `RUNNING`, recipe `AlLiProduct`, maintain `10000`, batch time `3750`.
- `Al Li Alloy S1` id `2301` is therefore not blocked by missing setup; its current shortage is `production cycle time` / source depletion while downstream TUs pull from it.

Final live read in this correction pass:

- `Adv Mob Panel Support S1` id `2899`: `hydraulics_2` `185`, `hydraulics_3` `150`, `AlLiProduct` `500`, `screw_1` `200`, `screw_2` `200`, `screw_3` `200`.
- `TU Bas Hydraulics` id `5581` is still `RUNNING`, maintain `135`, current `0`; `hydraulics_1` has not yet arrived in the support box.
- Adv Mobile Panel consumers id `2639`, `5228`, `5235`, `5226`, `3217`, `5616`, `5603`, `4031`, `7365`, and `6421` still report `JAMMED_MISSING_INGREDIENT`.
- Final blocker classification for this pass: `transit delay` for `hydraulics_1` plus `production cycle time` / source depletion for `AlLiProduct`.
