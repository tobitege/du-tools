# Future Automation Gain Bootstrap Prompt

Use the following prompt as the starting brief for a planning-only pass focused on the workflow automation gap that emerged from the `SimpleSignS` SVG porter work.

## Bootstrap Prompt

You are working in repo `d:\github\du-tobi`, focus `rs_emulator`.

This is a planning task, not an implementation task.

Your job is to produce a concrete plan for the **automation layer** that should come next after the current SVG shape-library / porter work.

The core problem is that the current workflow produced useful reusable infrastructure, but the integration process still scales poorly and requires repeated human or AI-guided family-by-family decisions.

## What to read first

Read these files before writing the plan:

- `rs_emulator/planning/shape-porter-workflow.md`
- `rs_emulator/planning/task_plan.md`
- `rs_emulator/planning/findings.md`
- `rs_emulator/planning/progress.md`
- `rs_emulator/planning/svg-classifier-plan.md`
- `rs_emulator/lib/SvgShapeClassifier.lua`
- `rs_emulator/lib/SilverZeroRsLib.lua`
- `rs_emulator/examples/SilverZero/SimpleSignS-svg.lua`
- `rs_emulator/test/luaRuntime.test.ts`

## Current state you should assume

The current project already has:

- a working geometric classifier with kinds such as:
  - `hex_ring`
  - `polygon_ring`
  - `quad`
  - `trapezoid`
  - `triangle`
  - `closed_polygon`
  - `compound_path`
  - `outline_path`
- reusable shared porter / library helpers:
  - `drawClassifiedShape(...)`
  - `drawClassifiedFillShape(...)`
  - `drawClassifiedStrokeShape(...)`
  - `drawClassifiedPathItem(...)`
- selective porter gating through `classifiedKinds`
- a strong runtime regression harness in `luaRuntime.test.ts`

`SimpleSignS-svg.lua` is the real proving ground that exposed the workflow limitation.

Current rough state for that example:

- `154` path items total
- `56` now go through shared porter/library paths
- `98` remain as `master-artboard` `closed_polygon` items on raw-path fallback

The important lesson is:

- shared rendering primitives are no longer the main bottleneck
- the missing layer is workflow automation around **family discovery**, **porter policy**, and **before/after validation**

## What should be planned

The plan should focus on the next leverage step, not on continuing many more narrow manual integrations in `SimpleSignS`.

The target is an automation layer that reduces repeated AI-assisted iteration around:

1. inventorying repeated classified families
2. deciding which families are safe to enable
3. expressing porter choices declaratively instead of by handwritten example branching
4. verifying family expansions systematically

## Strong guidance

- Do **not** propose another long sequence of manual family-by-family `SimpleSignS` integrations as the main next step.
- Do **not** assume the classifier itself needs major expansion unless you find a hard blocker in the current code.
- Prefer workflow tooling around the existing classifier and shared porter.
- Keep the plan grounded in the actual repo state, not generic SVG-tooling advice.
- Prefer tooling that helps future examples too, not just `SimpleSignS`.
- Treat this as a productization / automation-planning task, not a cleanup-only task.

## The likely automation targets

These came out of the previous work and should be evaluated directly in the plan:

### 1. Family report tool

Something that can emit, per SVG or per example:

- counts by `kind`
- counts by `role`
- cluster or family sizes
- representative indices
- bounds summaries
- fill summaries
- likely adapter compatibility

### 2. Declarative porter policy

Some way to express example-level porter choices outside handwritten Lua branching, for example:

- allowed classified kinds
- specific family opt-ins
- fallback mode choices
- possibly board/logo/master-artboard policy separation

### 3. Before/after comparison tooling

Some helper that records and compares:

- render command counts
- per-layer command counts
- adapter coverage
- possibly image or preview diff hooks if appropriate

### 4. Batch-safe family enablement

Once reporting, policy, and comparison exist, the porter should be able to enable a whole safe family set in one step instead of one tiny slice per round.

## Deliverable you should produce

Write a plan, not code.

The plan should answer:

1. What exact automation product should be built first?
2. Why is that the highest-leverage next step?
3. What should the architecture look like?
4. Which parts belong in TypeScript tooling vs Lua runtime vs planning/config files?
5. What is the smallest useful MVP?
6. How should it be verified?
7. What risks or traps should be avoided?
8. How would this reduce the repeated AI/manual loop we just experienced?

## Expected output quality

Please produce a plan that is:

- concrete
- phased
- implementation-ready
- opinionated about scope
- explicit about what **not** to build yet

Avoid vague language like:

- “maybe”
- “could consider”
- “we might later”

If there are multiple plausible paths, compare them briefly and recommend one.

## Helpful current references

Use these as evidence and grounding:

- `rs_emulator/planning/shape-porter-workflow.md` for the workflow lessons
- `rs_emulator/planning/findings.md` for the shape-family and porter observations
- `rs_emulator/planning/progress.md` for the exact rollout history
- `rs_emulator/test/luaRuntime.test.ts` for the current verification model
- `rs_emulator/examples/SilverZero/SimpleSignS-svg.lua` for where porter policy currently leaks into example code
- `rs_emulator/lib/SilverZeroRsLib.lua` for the current shared porter surface

## Final instruction

Produce the plan as if the goal is to stop spending many more sessions manually nudging one example forward and instead build the missing automation layer that makes future porter work materially cheaper.
