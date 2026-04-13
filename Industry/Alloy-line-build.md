Yes. Based on the live Silumin line, this can be described as a repeatable alloy “unit of work”.

**Unit Shape**

One alloy unit consists of:

- `18` smelters total
- `2` smelter floors
- `9` smelters per floor
- `3` product columns
- `3` alloy output containers: `<Alloy> S1`, `S2`, `S3`
- `2` support buffers on the feeder floor:
  - `<Alloy> Support S1`
  - `<Alloy> Support XS2`
- `1` support buffer per floor
- `N` feeder TUs per support buffer, where `N = number of alloy input materials`
- optional local supply buffers on the feeder floor to extend link budget
- optional downstream TU row from each `S` container into `XS` branch buffers or direct consumers

For a 2-input alloy like Silumin, that means:

- `18` smelters
- `3` output `S` containers
- `2` support buffers
- `4` support feeder TUs total

**Observed Live Pattern**

The current Silumin unit confirms this pattern:

- `Silumin S1`, `S2`, `S3` each receive `6` smelter outputs
- `Silumin Support S1` feeds `9` smelters
- `Silumin Support XS2` feeds `9` smelters
- each support buffer is refilled by exactly `2` TUs:
  - one per alloy ingredient
- Silumin support feeders are:
  - `TU Silumin 1 Alu`
  - `TU Silumin 1 Silicon`
  - `TU Silumin 2 Alu`
  - `TU Silumin 2 Silicon`

So the deterministic topology is:

- lower floor `9` smelters share one support buffer
- upper floor `9` smelters share one support buffer
- each vertical product column has `6` smelters total:
  - `3` on lower floor
  - `3` on upper floor
- each product column outputs into one `S` container

**Build Topology**

Use this exact logical structure:

1. Create three product columns, left to right:
   - column `1` -> `<Alloy> S1`
   - column `2` -> `<Alloy> S2`
   - column `3` -> `<Alloy> S3`

2. For each column, place:
   - `3` lower-floor smelters assigned to that column
   - `3` upper-floor smelters assigned to that column

3. Link smelter outputs by column:
   - all `6` smelters of column `1` -> `<Alloy> S1`
   - all `6` smelters of column `2` -> `<Alloy> S2`
   - all `6` smelters of column `3` -> `<Alloy> S3`

4. Create two support buffers on the feeder floor:
   - floor A support -> `<Alloy> Support S1`
   - floor B support -> `<Alloy> Support XS2`

5. Link smelter inputs by floor:
   - all `9` lower-floor smelters <- `<Alloy> Support S1`
   - all `9` upper-floor smelters <- `<Alloy> Support XS2`

6. For each support buffer, place one feeder TU per input material:
   - for 2-input alloy: `2` TUs into support buffer
   - for 3-input alloy: `3` TUs into support buffer
   - for 4-input alloy: `4` TUs into support buffer

7. Feed those TUs from local supply buffers or upstream material lines on the same feeder floor.

This gives a fixed formula:

- product side: `3 x 6 = 18` smelters
- support side: `2 x input-material-count` feeder TUs

**Naming Scheme**

Use one consistent naming scheme per unit.

Product buffers:

- `<Alloy> S1`
- `<Alloy> S2`
- `<Alloy> S3`

Support buffers:

- `<Alloy> Support S1`
- `<Alloy> Support XS2`

Support feeder TUs:

- `TU <Alloy> 1 <MaterialA>`
- `TU <Alloy> 1 <MaterialB>`
- `TU <Alloy> 2 <MaterialA>`
- `TU <Alloy> 2 <MaterialB>`

Example:

- `TU Silumin 1 Alu`
- `TU Silumin 1 Silicon`
- `TU Silumin 2 Alu`
- `TU Silumin 2 Silicon`

Downstream product TUs:

- `TU <Alloy> S1 XS1`
- `TU <Alloy> S1 XS2`
- ...
- `TU <Alloy> S2 XS1`
- ...
- `TU <Alloy> S3 XS1`
- ...

Smelters:

- either numbered globally:
  - `Smelter <Alloy> 1..18`
- or by column/floor:
  - `Smelter <Alloy> S1 L1..L3`
  - `Smelter <Alloy> S1 U1..U3`
  - same for `S2`, `S3`

The second naming scheme is better because it encodes both product column and floor.

**Maintain Rules**

For this unit pattern, the stable defaults are:

- smelters:
  - recipe = target alloy
  - mode = `maintain`
  - target = `10000`

- support feeder TUs:
  - mode = `maintain`
  - target = concurrent floor demand
  - for the common `9 smelters on one floor` pure-feed pattern:
    - `900` per feeder TU is the current working rule

- large local feeder-wall TUs filling `S` buffers:
  - often `maintain 5000`

- downstream product distribution TUs from `<Alloy> S1..S3`:
  - branch-specific
  - not fixed by this unit template

**Physical Layout Rule**

The physical arrangement is:

- lower smelter floor
- feeder floor in the middle
- upper smelter floor

The feeder floor contains:

- the `3` product `S` containers
- the `2` support buffers
- the incoming material feeder TUs
- optional local supply containers
- optional downstream product TUs

The unit should preserve:

- one reachable front side
- one reachable back side
- enough center clearance to inspect and rename
- enough side clearance to add or replace TUs without rebuilding the smelter stacks

So the reproducible part is the topology and role assignment, not one exact voxel-perfect decoration.

**Minimal Reproducible Spec**

If you want the shortest exact recipe:

- Build `3` product columns.
- Put `6` smelters on each column: `3` below, `3` above.
- Place `S1/S2/S3` on the feeder floor, one per column.
- Route each column’s `6` smelter outputs into its `S` container.
- Split smelter inputs by floor:
  - lower `9` <- support buffer `1`
  - upper `9` <- support buffer `2`
- Put one feeder TU per input material into each support buffer.
- Name buffers and TUs by alloy, floor index, and material.
- Set smelters to `maintain 10000`.
- Set small support feeders to floor-concurrency targets, usually `900` for a `9`-smelter floor.

If you want, I can turn this into a compact `playtime.md` section or a build-template note with one ASCII diagram.
