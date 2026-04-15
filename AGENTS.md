# DU Factory Session Rules

These rules are repo-local and mandatory for any agent working in this repository.

## Priority

1. User instruction
2. This file
3. General defaults

If two rules conflict, follow the higher-priority rule.

## Hard Scope

- This repository contains both gameplay workflow files and implementation files for the mod/tooling.
- When the user asks to operate a factory, trace industry, configure lines, verify production, or continue setup work, the task is a gameplay-operations task, not a mod-internals research task.
- In gameplay-operations tasks, stay on the backend/mod bridge path only unless the user explicitly broadens scope.

## Absolute Do-Not-Read Rules For Gameplay-Operations Tasks

Unless the user explicitly authorizes mod-internal data access for the current turn, do not read, grep, parse, tail, or inspect:

- `ModUiToolbox/industry-data/**`
- `ItemExport2Json/**`
- any generated item bank, recipe dump, YAML export, JSON export, SQLite export, or cache file used by the mod/tooling
- bridge event archives or runtime logs for recipe or item metadata lookup

This is a hard boundary. Shared workspace access does not count as permission.

If metadata is needed, use only:

- MCP bridge responses
- user-provided documents
- workflow notes already written for the factory task

If that is still insufficient, stop and say exactly what metadata is missing.

## Required Start Sequence For Factory Tasks

Before any write:

1. Read the user-named notes/doc first.
2. Build the family filter from that doc before touching MCP.
3. Resolve and pin the exact `constructId`: use 1002090 !!!
4. Include that `constructId` on every subsequent MCP call for the pass.
5. player Id is 10000

Do not rely on current-player construct context after the first successful factory-specific read.

## Topology Proof Rules

Before sizing or configuring a branch:

- Start from the blocked consumer or user-requested family.
- Prove whether each named box is:
  - producer output
  - support box
  - relay box
  - final consumer box
- Prove which ingredients are supplied through support boxes and which are direct machine inputs.
- Do not assume one support box owns the full recipe.
- Do not reuse a sizing rule from another branch until the topology match is proven.

If any ingredient path is still ambiguous, do not write the branch yet.

## Write Discipline

- Read first, then write.
- Keep write batches conservative.
- Never mix industry kinds in one configure batch.
- Do not touch already-running lines unless the user explicitly asked for correction work on that line.
- If correcting an existing branch, stop refill pressure first, then rewrite.

## Verification Discipline

After each write pass:

- Verify support storages.
- Verify source storages.
- Verify device states.
- Verify output storage.
- Classify the blocker as one of:
  - setup
  - support sizing
  - source starvation
  - relay blockage
  - transit delay
  - production cycle time

Do not call a branch fixed before that classification is explicit.

## Tool Failure Rules

- If one MCP command shape fails once, do not retry the same shape.
- Rebuild it in a simpler shape immediately.
- If construct context may have drifted, stop and re-pin `constructId` before further reads.

## Token Discipline

For gameplay-operations tasks:

- Do not read large local JSON, YAML, or dump files.
- Do not grep broad patterns across generated data files.
- Do not pull large graph outputs unless smaller MCP reads failed to answer the exact question.
- Prefer the narrowest MCP read that can prove the next decision.
- Prefer exact ids and exact names over broad searches.
- Keep commentary short and decision-oriented.

## Notes Discipline

Update working notes after each confirmed topology finding or write pass.

Notes must record:

- exact bank names
- exact support storages
- exact TU ids
- exact construct id used
- what was configured
- what was verified live
- what is still blocked
- blocker type

Do not record guessed metadata as fact.

## Red-Line Rule

If the user says to stay on MCP/mod bridge only, then reading mod-internal recipe or item data files is a rule violation.

If there is any temptation to do that because it is faster, do not do it.
