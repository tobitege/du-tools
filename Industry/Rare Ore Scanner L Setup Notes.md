# Rare Ore Scanner L Setup Notes

Date: 2026-04-23
Construct: 1002090
Player: 10000

## Output Branch

- Output storage: `3574` `Rare Ore Scanner L` (`ContainerMedium`, 12000 L)
- Branch type: direct producer bank to storage
- Product: `Rare Ore Scanner l`
- Product item type: `3501536145` (`orescanner_4_l`)
- Product recipe: `260118744`
- Producer bank:
  - `3537` `Rare Ore Scanner L 1`
  - `3677` `Rare Ore Scanner L 2`
  - `3707` `Rare Ore Scanner L 3`
  - `3849` `Rare Ore Scanner L 4` (renamed from default `IndustryElectronics3`)
  - `3874` `Rare Ore Scanner L 5` (renamed from default `IndustryElectronics3`)

## Support Branch

- Support storage: `4084` `Rare Ore Scanner L Support S1` (`ContainerMedium`, 12000 L)
- Support consumers: producer IDs `3537`, `3677`, `3707`, `3849`, `3874`
- Feeder TUs and sources:
  - `4077` `TU Adv Connector` from `2287` `Adv Connector S1`, item `connector_3` (`2872711781`)
  - `4078` `TU Unc Connector` from `2003` `Unc Connector XS1`, item `connector_2` (`2872711778`)
  - `4080` `TU Adv Electronics` from `2294` `Adv Electronics S1`, item `electronics_3` (`1297540452`)
  - `4081` `TU Fluoropoly` from `1912` `Fluoropolymer S1`, item `FluoropolymerProduct` (`918590356`)
  - `4082` `TU Rare Electronics` from `4556` `Rare Electronics S2`, item `electronics_4` (`1297540451`)
  - `4085` `TU Unc Electronics` from `2323` `Unc Electronics S2`, item `electronics_2` (`1297540453`)

## Configured

- Renamed:
  - `3849` -> `Rare Ore Scanner L 4`
  - `3874` -> `Rare Ore Scanner L 5`
- Configured producers `3537`, `3677`, `3707`, `3849`, `3874`:
  - Mode: `maintain`
  - Recipe: `260118744`
  - Amount: `2`
- Configured support refill TUs:
  - `4077` `connector_3`, maintain `500`
  - `4078` `connector_2`, maintain `500`
  - `4080` `electronics_3`, maintain `500`
  - `4081` `FluoropolymerProduct`, maintain `2000`
  - `4082` `electronics_4`, maintain `500`
  - `4085` `electronics_2`, maintain `500`

## Live Verification

- Producer states after write: all five producers have recipe `260118744`, maintain `2`, and are temporarily `JAMMED_MISSING_INGREDIENT`.
- Refill TU states after write: all six feeder TUs are `RUNNING`.
- Output storage `3574`: empty at immediate verification.
- Support storage `4084`: `600` `FluoropolymerProduct` at immediate verification.
- Source drawdown confirmed:
  - `2287` `Adv Connector S1`: `connector_3` decreased from `10915` main-slot quantity to `10715`.
  - `2294` `Adv Electronics S1`: `electronics_3` decreased from `1861` to `1811`.
  - `1912` `Fluoropolymer S1`: `FluoropolymerProduct` decreased from `9856` to `9356`.
  - `4556` `Rare Electronics S2`: `electronics_4` decreased from `1848` to `1798`.
  - `2003` `Unc Connector XS1`: `connector_2` decreased from `1400` to `1200`.
  - `2323` `Unc Electronics S2`: `electronics_2` decreased from `2706` to `2656`.

## Blocker

- Type: transit delay
- Reason: support refill TUs are running and source stock is being pulled, but the non-fluoropolymer support items had not landed in `4084` at immediate verification. Transfer batch times are 160-200 seconds for those TUs.
