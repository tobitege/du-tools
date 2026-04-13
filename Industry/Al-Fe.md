# Al-Fe Line

## Purpose

This document describes a general bottom-up structure for an `Al-Fe` alloy line in this factory style.
It is not the final automation workflow yet.
It is the structural plan that later workflows can use for probing, inference, and bulk configuration.

## Core Assumptions

- The factory often preserves links and names after deployment, even when recipes and production settings are missing.
- A user-facing bare `ID` means the construct-local `localId`.
- A global backend id must be stated explicitly as `elementId`.
- Exact names are valid selectors.
- If an exact name exists more than once, the workflow must stop and ask for the `localId`.
- Transfer Units are one machine type with many instances.
- Transfer Units, industry machines, and containers often include material hints in their names.

## Bottom-Up Shape

### Level 1: Distribution Containers

- The lowest visible delivery targets are usually `XS` containers.
- These are kept at a target fill level by dedicated Transfer Units.
- The target amount is variable and must not be assumed globally.

### Level 2: Distribution Transfer Units

- Each `XS` container is normally fed by exactly one Transfer Unit.
- The Transfer Unit should be treated as the active control point for downstream distribution.
- In player terms this is the `Move` or `Maintain` layer, depending on the intended behavior.
- For Transfer Units, the semantic label is `Move`, even though the underlying game mode maps onto the same internal path as `Make`.

### Level 3: Main Product Container

- Several distribution Transfer Units usually pull from one shared `S` container.
- For `Al-Fe`, this `S` container is the best practical anchor for probing the local chain.
- A user may identify it by exact name such as `AL FE S3` or by bare `localId` such as `760`.
- The main product container acts as the local output buffer for one group of smelters and the local source for downstream distribution.

### Level 4: Direct Producers

- The main `S` container is filled by multiple smelters.
- In this factory style, one `Al-Fe` output container commonly has `6` direct smelter producers.
- Those smelters are the first industry machines that need recipe configuration.
- They must be stopped before recipe changes are applied.

### Level 5: Shared Support Containers

- The smelters are not always fed directly from raw-material storage.
- Instead, they often pull from one or more intermediate support containers.
- These support containers distribute the required inputs to a whole smelter group.
- In the observed `Al-Fe` pattern, one local branch uses:
  - one `S` support container
  - one `XS` support container

### Level 6: Upstream Material Transfer Units

- The support containers are filled by upstream Transfer Units.
- These Transfer Units usually carry the material name directly in their custom name.
- For `Al-Fe`, the relevant upstream materials are typically aluminum and iron.
- These Transfer Units form the bridge between bulk raw-material storage and the support containers that feed the smelters.

### Level 7: Bulk Material Sources

- The upstream Transfer Units usually draw from named raw-material storages such as aluminum or iron containers or hubs.
- These sources may be direct containers or hubs, depending on the area of the factory.
- At this level the line is already outside the immediate `Al-Fe` production cluster and starts touching broader factory logistics.

## Typical Al-Fe Pattern

### Product Side

- `6` smelters produce `Al-Fe`.
- Their outputs go into one `S` container with `12 kL` volume.
- That `S` container fans out into up to `10` outbound links.
- A subset of those outbound links are distribution Transfer Units.
- Some outbound links can also be direct industry consumers.

### Distribution Side

- Each downstream Transfer Unit feeds one `XS` container.
- In the observed style, each `XS` container is kept at a small maintained stock level, for example `500 L`.
- One `Al-Fe` output container can therefore represent many downstream delivery edges.

### Producer Side

- The producer smelters are usually intended to run in `Maintain`.
- A typical target for the smelters is something like `10000 L`, but this is a line-specific value and must not be hardcoded as a universal rule.
- If the line is freshly deployed and unconfigured, the smelters can still be structurally identified through links even when the recipe is missing.

### Byproducts

- A machine can produce a main product plus byproducts.
- Important byproducts in this factory style include:
  - `Catalyst 3`
  - `Catalyst 4`
  - `Catalyst 5`
  - `Oxygen`
  - `Hydrogen`
  - other materials depending on the recipe family
- Catalysts are often close to a throughput material and can accumulate in regular containers.
- Excess catalyst output is commonly removed through Transfer Units rather than treated as a final stored product.

## Practical Probe Strategy

### Anchor Resolution

- Start from one exact product container name or one `localId`.
- Resolve that element deterministically.
- Do not guess between multiple same-name candidates.

### Step 1: Read the Anchor Container

- Inspect the target container.
- Record all direct inbound and outbound links.
- Separate them into:
  - direct producers
  - distribution Transfer Units
  - direct industry consumers
  - other containers

### Step 2: Walk Backward to Producers

- Inspect each direct producer.
- Verify that each machine is stopped before later configuration.
- Record recipe state, mode state, and upstream source.

### Step 3: Collapse Producers into Shared Inputs

- Group producers by their inbound support container.
- This reveals whether the local branch is fed by one or more shared support storages.

### Step 4: Walk Backward to Material Feeders

- Inspect the upstream Transfer Units that feed those support containers.
- Use exact names and link structure to infer which TU belongs to which material.
- Treat material hints in names as strong evidence, not as a replacement for link validation.

### Step 5: Walk Forward to Distribution

- Inspect the Transfer Units fed by the main product container.
- Record their downstream `XS` targets.
- Check whether any sibling Transfer Unit is already configured and can serve as a reference configuration.

## Observed Example Anchor

This observed case matches the general pattern above:

- Anchor container: `Al Fe S3`
- `localId`: `760`
- direct inbound producers: `6` smelters
- direct outbound distribution TUs: `3`
- direct outbound industry consumer: `1`

Observed producer-side grouping:

- `Smelter Al Fe C1`, `C2`, `C3` pull from `Al Fe Support S1`
- unnamed smelters `[5525]`, `[5526]`, `[5527]` pull from `Al Fe Support XS2`

Observed upstream material feeders:

- `TU Alfe 1 Alu` -> `Al Fe Support S1`
- `TU Alfe 1 Iron` -> `Al Fe Support S1`
- `TU Alfe 2 Alu` -> `Al Fe Support XS2`
- `TU Alfe 2 Iron` -> `Al Fe Support XS2`

Observed downstream distribution:

- `Al Fe S3` -> `TransferUnit [1409]` -> `Al Fe XS8`
- `Al Fe S3` -> `TransferUnit [1410]` -> `Al Fe XS9`
- `Al Fe S3` -> `TransferUnit [1712]` -> `Al Fe XS10`

## What This Structure Enables Later

- deterministic backward tracing from one named output container
- grouping of local producers that should share the same recipe
- grouping of upstream input feeders by material
- grouping of downstream Transfer Units that should share the same delivery logic
- safe bulk configuration once industry write tools exist for:
  - stop
  - set recipe
  - set mode
  - set amount
