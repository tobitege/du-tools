# Shape Porter Workflow Review

## Why this document exists

This file describes the actual process that was used to move `SimpleSignS-svg.lua` from ad-hoc SVG path patches toward shared classifier-driven porter logic.

It is not a design paper for the ideal system.

It is a record of what really happened:

- what work was repeated
- what reusable automation came out of it
- what stayed manual
- where the time went
- why the current approach does not scale well enough on its own

## Short conclusion

The work was not wasted, but the current workflow is not efficient enough to treat as the long-term porting method.

What we have now is:

- a useful automation substrate
- a safer shared porter path
- a stronger test harness

What we do **not** have yet is:

- a low-touch SVG-to-RenderScript conversion pipeline
- a workflow that scales cleanly without repeated human or AI-guided family-by-family integration

In plain terms:

- the project produced reusable building blocks
- the example integration process is still too manual

## What was the original road

The practical working loop became:

1. classify real SVG items from `SimpleSignS`
2. inspect which real geometric families show up
3. pick one family that looks safe
4. add or extend a shared library adapter
5. route one real example family through the shared porter
6. refresh runtime assertions
7. repeat

This worked for correctness and safety, but it was slow.

## What reusable automation did come out of it

### 1. Real geometric classification

The classifier can now detect reusable shape kinds such as:

- `hex_ring`
- `polygon_ring`
- `quad`
- `trapezoid`
- `triangle`
- `closed_polygon`
- `compound_path`
- `outline_path`

It also assigns some role hints in other SVG contexts, but the important point here is that the porter can now consume geometric shape kinds instead of only raw path strings.

### 2. Shared library adapters

`SilverZeroRsLib.lua` now has reusable drawing paths for classified geometry instead of example-only hacks.

Important adapters:

- `drawClassifiedShape(...)`
- `drawClassifiedFillShape(...)`
- `drawClassifiedStrokeShape(...)`
- `drawClassifiedPathItem(...)`

These are real reusable outputs of the effort.

### 3. Safer porter expansion

The later introduction of a `classifiedKinds` filter on `drawClassifiedPathItem(...)` changed the workflow from:

- "switch a whole branch to classifier-first and hope"

to:

- "enable one known-safe family at a time through a shared gate"

That was a meaningful improvement in process safety.

### 4. Runtime regression protection

`luaRuntime.test.ts` now acts as a practical harness for:

- direct classifier checks
- direct adapter checks
- end-to-end runtime baselines
- example-specific regression guards

Without these tests, the current migration path would have been much harder to control.

## What stayed manual

The expensive part was not the low-level drawing code itself.

The expensive part was the repeated human-guided selection and validation loop:

1. identify which real family is worth trying next
2. decide whether it belongs in shared logic
3. decide whether it is safe to enable broadly or only narrowly
4. inspect regressions when counts or output shift
5. update runtime expectations
6. decide what remains too risky to enable

That loop still required active judgment nearly every iteration.

## Why it took so long

Several things made this road slow.

### 1. `SimpleSignS` was used as both target and research lab

The example was not just being ported.

It also became the proving ground for:

- shape classification
- library adapter design
- porter control rules
- regression strategy

That means one example carried too much architecture work.

### 2. The missing layer was not rendering, but selection

By the middle of the work, the project already had enough code to draw several families.

What it still lacked was automation for:

- inventorying repeated families
- suggesting safe groups to enable
- declaring porter policy outside handwritten example logic
- validating family expansions cheaply

So the bottleneck moved from "how do we draw this shape" to "how do we know what to turn on next."

### 3. End-to-end safety forced small slices

Small slices were the right call technically, because broad flips caused visible regressions before.

But that same safety discipline also meant:

- many iterations
- many test updates
- many narrow decisions

So the process was safe, but not fast.

### 4. The example still has a large raw-path remainder

Current rough state in `SimpleSignS-svg.lua`:

- `154` path items total
- `56` now run through shared porter/library paths
- `98` remain as `master-artboard` `closed_polygon` items on raw-path fallback

That remaining block is exactly the part where the workflow stopped scaling well.

## What this process is good at

This workflow is good for:

- proving shared adapters against real SVG data
- hardening a classifier with real examples
- migrating risky examples in controlled slices
- building a reliable regression harness

It is a good research-and-hardening workflow.

## What this process is bad at

This workflow is bad for:

- fast bulk conversion
- low-touch onboarding of many SVG examples
- turning one successful example into a repeatable pipeline without more tooling

If repeated unchanged, it will continue to depend heavily on AI or expert-guided iteration.

## What was learned

### 1. Shared library work was the right priority

When improvements landed in shared porter or library code first, they stayed useful.

When behavior lived only in the example, it became fragile quickly.

### 2. Broad classifier-first rollouts were too coarse

The stable process improvement came from selective porter gating, not from enabling large branches wholesale.

### 3. The next missing product is not another adapter

The next missing product is process automation around family discovery and porter policy.

That is the real leverage gap now.

## What should exist next

If the goal is to reduce repeated AI-assisted iteration, the next step should not be "continue family-by-family on `SimpleSignS` for many more rounds."

It should be tooling for the workflow itself.

Recommended next pieces:

### 1. Family report tool

Produce a report per SVG or per example with:

- counts by `kind`
- counts by `role`
- cluster/family sizes
- representative item indices
- bounds and fill summaries
- likely adapter compatibility

This removes the need to rediscover the same inventory manually.

### 2. Declarative porter policy

Move example decisions such as:

- allowed classified kinds
- family opt-ins
- fallback mode choices

into a small declarative config instead of handwritten Lua branching.

That would make the porter easier to widen without custom code edits each time.

### 3. Before/after comparison tooling

Add a lightweight verification helper that records:

- render command counts
- per-layer command counts
- optional preview output or image diff hooks

so a family expansion can be evaluated systematically rather than by re-deriving expectations manually.

### 4. Batch-safe family enablement

Once the above exists, the porter could safely turn on a whole set of compatible families at once, instead of one tiny slice per round.

## Recommendation

Treat the current work as a useful prototype phase, not as the final operating model.

The correct interpretation is not:

- "nothing useful came out of this"

The correct interpretation is:

- "useful reusable primitives came out of this, but the integration workflow itself still needs productization"

If work continues on this area, the best return now is to build workflow automation around:

- family discovery
- porter policy
- regression comparison

rather than continuing to spend many more iterations manually walking one example through the remaining `closed_polygon` block.

## Current status snapshot

As of this document:

- classifier work remains intentionally unchanged in the latest porter steps
- shared porter coverage in `SimpleSignS-svg.lua` includes:
  - logo path through shared helpers
  - board path through shared helpers
  - `master-artboard` `polygon_ring`
  - `master-artboard` `quad`
  - `master-artboard` `trapezoid`
- the main unresolved remainder is the `master-artboard` `closed_polygon` set

## Bottom line

This road produced real infrastructure, but it also exposed that the current method is still too manual.

That is the main lesson worth preserving.
