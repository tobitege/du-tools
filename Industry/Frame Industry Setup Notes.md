# Frame Industry Setup Notes

Date: 2026-04-23

Construct/player:

- constructId: 1002090
- playerId: 10000

Scope:

- Followed `Industry/Part-Named Industry Setup Workflow.md`.
- MCP/mod bridge only.
- Part filter: `Frame`.
- Industry family: Metalwork for producers; TransferUnit for support refill and relay branches.

Discovery:

- Container discovery found 77 `Frame` containers.
- Producer discovery found 123 named `Frame` Metalwork devices.
- Transfer discovery from the broader industry result found named/support `Frame` Transfer Units.

Producer topology proof:

- `Bas Reinf Frame L 1` id 2413 outputs to `Bas Reinf Frame L S1 FULL` id 2312 and consumes `Steel Supply XS2` id 2393.
- `Adv Reinf Frame L 1` id 2657 outputs to `Adv Reinf Frame L S1` id 2303 and consumes `Adv Frames Inconel XS2 FULL` id 3658 plus `Adv Frames Steel XS2 FULL` id 5028.
- `Rare Reinf Frame L A1` id 6451 outputs to `Rare Reinf Frame L S1` id 5030 and consumes `MarSteel 3 XS2` id 3158 plus `Steel XS2` id 1171.
- `Unc Std Frame XL 1` id 2432 is a relay-style producer output branch to `XL Frames M1 FULL` id 2251 with no direct support link.

Producer writes:

- Configured 117 stopped/no-recipe named Frame Metalwork devices.
- Skipped 6 already-configured devices:
  - Advanced Reinforced Frame M: ids 3521, 2658, 3627, 2659.
  - Basic Standard Frame M: ids 5647, 5652.
- Maintain targets used:
  - xs: 500
  - s: 100
  - m: 15
  - l: 2
  - xl: 1

Transfer Unit writes:

- Support refill TUs configured:
  - id 2510 `TU Steel Supply XS2`: SteelProduct, maintain 1350.
  - id 6156 `TU Adv Frames Inconel 2`: InconelProduct, maintain 1350.
  - id 6157 `TU Adv Frames Steel 1`: SteelProduct, maintain 1350.
  - id 5890 `TU ScAl Rare Frames`: ScAlProduct, maintain 1350.
  - id 5889 `TU Silumin Rare Frames`: SiluminProduct, maintain 1350.
  - id 7354 unnamed TU: SiluminProduct, maintain 1350.
  - id 7355 unnamed TU: DuraluminProduct, maintain 1350.
  - id 5566 `TU Al-Li Frames 1`: AlLiProduct, maintain 1350.
  - id 2513 `TU Silumin Frames XS2`: SiluminProduct, maintain 1350.
  - id 6988 `TU Al-Li Frames 2`: AlLiProduct, maintain 1350.
  - id 6987 `TU Silumin Frames XS3`: SiluminProduct, maintain 1350.
- Relay TUs configured:
  - ids 5692, 7458: Advanced Reinforced Frame m, maintain 15.
  - ids 9016, 9037: Basic Standard Frame l, maintain 2.
  - ids 5887, 4839, 5814, 5835: Rare Standard Frame l, maintain 2.
  - id 8932: Uncommon Reinforced Frame m, maintain 15.

Live verification:

- All targeted producer devices now have recipes and maintain targets.
- Many Standard/Advanced/Rare lines are running.
- Support buffers verified live:
  - `Steel Supply XS2` id 2393 was empty; feeder `TU Steel Supply XS2` id 2510 was configured and later running.
  - `Adv Frames Inconel XS2 FULL` id 3658 had InconelProduct and running feeder id 3659.
  - `Adv Frames Steel XS2 FULL` id 5028 had SteelProduct and running feeder id 5029.
  - `AlLi Sil Frames Support XS1` id 2514 was refilling after configuring ids 5566 and 2513.
  - `Unc Std Frame Supply XS1` id 7353 was refilling after configuring ids 7354 and 7355.
  - `Rare Frames Support XS1` id 2913 was refilling after configuring ids 5890 and 5889.
- Source storages verified live:
  - `Steel XS8` id 1177 contained SteelProduct before refill.
  - `Inconel 2-XS3` id 5058 contained InconelProduct before refill.
  - `Steel XS4` id 1173 contained SteelProduct before refill.
  - `Al Li Alloy S1` id 2301 contained AlLiProduct before refill.
  - `Silumin XS9` id 1168 contained SiluminProduct before refill.
  - `Silumin XS10` id 1169 contained SiluminProduct before refill.
  - `Duralumin XS10` id 1199 contained DuraluminProduct before refill.
  - `Sc-Al Alloy S3/S4/S6` ids 3633, 3705, 3774 contained ScAlProduct before refill.

Remaining blockers:

- Setup: no remaining no-recipe Frame producers or checked Frame TUs.
- Support sizing: not proven as a current blocker.
- Source starvation:
  - `TU Silumin Rare Frames` id 5889 is configured but still short on SiluminProduct from `AlLi Sil Frames Support XS1` id 2514 while the support refills.
  - Relay TUs ids 9016, 9037, 5887, 4839, 5814, 5835, and 8932 are configured but missing source product at verification time.
- Relay blockage: none proven.
- Transit delay:
  - Newly configured support refill TUs were moving material; some downstream producer states may clear after transfer/cycle delay.
- Production cycle time:
  - XL and Rare lines have long batch times; running state does not imply output appears immediately.
- Output full:
  - Pre-existing Basic Standard Frame M devices ids 5647 and 5652 remain `JAMMED_OUTPUT_FULL` with recipe 461590276 and maintain 900.
