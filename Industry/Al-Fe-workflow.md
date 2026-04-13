# Al-Fe Reconfiguration Workflow

## Goal

Rebuild an unconfigured `Al-Fe` production branch from one known product container without using the live industry UI as the execution path.

The purpose of this workflow is:

- discover the local production chain from one anchor container
- identify the exact smelters and Transfer Units that belong to that branch
- infer the intended `Al-Fe` role from names and links
- stop the relevant industry units
- assign recipe and mode directly through backend tools

## Input Rules

- The user gives either:
  - an exact container name such as `AL FE S3`
  - or a bare construct-local `ID` such as `760`
- A bare `ID` always means `localId`
- If the exact name is not unique, the workflow must stop and ask for the `localId`

## Preconditions

- The branch exists physically and still has its item links after deployment
- Industry machines may be fully unconfigured
- Transfer Units, industry machines, and containers often contain material hints in their names
- Industry must be stopped before recipe changes are applied

## Step 1: Build the Link Plan

### 1. Resolve the Anchor Container

- Resolve the user input deterministically to one container
- Reject ambiguity
- Store:
  - `elementId`
  - `localId`
  - exact label
  - direct inbound count
  - direct outbound count

### 2. Inspect the Anchor Container

- Read all direct inbound and outbound item links
- Split outbound peers into:
  - Transfer Units
  - direct industry consumers
  - other containers
- Split inbound peers into:
  - direct industry producers
  - unexpected non-industry sources

### 3. Walk Backward to Direct Producers

- Inspect each direct producer
- Verify:
  - machine type
  - current state
  - recipe id
  - next recipe id
  - current mode-related counters
  - direct input source
- If a direct producer is not stopped, mark it for explicit stop before any recipe change

### 4. Group Producers by Shared Input Containers

- For each direct producer, inspect its direct inbound storage
- Group producers by that inbound storage
- This reveals the local producer subgroups behind the anchor container

For an `Al-Fe` branch this commonly yields:

- one `S` support container feeding named smelters
- one `XS` support container feeding unnamed or alternate smelters

### 5. Walk Backward to Material Feeders

- Inspect the upstream Transfer Units that feed the support containers
- Record:
  - TU id
  - exact name
  - upstream source storage
  - downstream support storage
  - current recipe and mode state
- Use material hints in the TU names as controlled inference only after links confirm the role

### 6. Walk Forward to Distribution

- Inspect every direct outbound TU from the anchor container
- Record:
  - TU id
  - downstream `XS` target
  - current recipe
  - current mode
  - current requested amount
- Inspect any direct non-TU industry consumers separately

### 7. Produce the Branch Plan

- The final plan for one anchor container must contain:
  - anchor product container
  - direct producer smelters
  - grouped support containers
  - upstream raw-material feeder TUs
  - downstream distribution TUs
  - direct non-TU consumers
  - already configured siblings that can act as reference units

## Step 2: Infer Intended Configuration

### Smelter Recipe Inference

- The anchor container name is the strongest local product hint
- All smelters directly outputting into that anchor container are candidates for the same product recipe
- If smelter names also contain `Al Fe`, that strengthens the inference
- If one sibling smelter in the same subgroup is already configured correctly, it can act as the preferred reference

### Transfer Unit Recipe Inference

- Every downstream TU from the anchor product container is a candidate for the same product recipe as the anchor
- Every upstream TU feeding a support container is a candidate for the material named in the TU or source-container label
- Existing configured siblings are preferred as reference configuration sources

### Ambiguity Handling

- If the product or material inference remains ambiguous after exact names, links, and local siblings are checked, stop and require explicit user confirmation

## Step 3: Safe Reconfiguration Order

### 1. Stop Relevant Industry

- Stop all targeted smelters
- Stop all targeted Transfer Units
- Prefer soft stop where a machine is active
- Use hard stop only when explicitly intended

### 2. Apply Recipes

- Set the `Al-Fe` recipe on the targeted smelters
- Set the `Al-Fe` product recipe on the downstream distribution TUs
- Set material recipes on the upstream feeder TUs

### 3. Apply Modes

- Smelters usually go to `Maintain`
- Downstream Transfer Units usually go to `Move` or `Maintain` depending on the branch pattern
- Upstream feeder TUs should be configured according to the support strategy for that subgroup

### 4. Apply Amounts

- Smelter maintain amount is line-specific, for example `10000 L`
- Downstream TU amount is branch-specific, for example `500 L` in each `XS`
- Amounts should be copied from a valid sibling when possible instead of hardcoding defaults

### 5. Start in Dependency Order

- Start upstream feeder TUs first if needed
- Start smelters after inputs are ready
- Start downstream TUs after product flow is available or leave them stopped if the branch is only being staged

## Step 4: Verification

- Re-read all targeted units after mutation
- Confirm:
  - recipe id is set
  - machine is in the intended mode
  - amount field is set as intended
  - state is no longer unconfigured
- Record any branch outliers:
  - missing input
  - output full
  - no output container
  - configured sibling mismatch

## Observed Al-Fe Example

Anchor:

- `Al Fe S3`
- `localId 760`

Direct producers:

- `Smelter Al Fe C1`
- `Smelter Al Fe C2`
- `Smelter Al Fe C3`
- `IndustrySmelter [5525]`
- `IndustrySmelter [5526]`
- `IndustrySmelter [5527]`

Shared input containers:

- `Al Fe Support S1`
- `Al Fe Support XS2`

Upstream feeder TUs:

- `TU Alfe 1 Alu`
- `TU Alfe 1 Iron`
- `TU Alfe 2 Alu`
- `TU Alfe 2 Iron`

Downstream distribution:

- `TransferUnit [1409]` -> `Al Fe XS8`
- `TransferUnit [1410]` -> `Al Fe XS9`
- `TransferUnit [1712]` -> `Al Fe XS10`

## Required Backend Tool Primitives

The execution path for this workflow should not depend on the visible industry panel.

Required low-level write tools:

- resolve one industry element deterministically
- resolve one recipe deterministically for a product and machine type
- stop one industry unit softly
- stop one industry unit hard
- set one recipe directly on one industry unit
- set one mode directly on one industry unit
- start one industry unit directly
- optionally copy recipe or mode from one reference unit to another
