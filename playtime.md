# Playtime Notes

## Basics

- `Escape` toggles between player view and the game options page.
- The bottom HUD shows the currently configured tools for keys `1` through `9`.
- Player view has first-person camera control; the real interaction point is the screen center crosshair.
- `Tab` toggles UI mode. In UI mode the mouse is free for HUD pages and the center crosshair is not the active interaction cue.
- If the center crosshair and contextual interact text are missing, assume UI mode until a visual check proves otherwise.
- Build mode is the third main mode on constructs: gravity-less movement inside the build box with a different `1..9` tool set.
- Avatar movement uses `W`, `A`, `S`, `D`.
- The game options `Controls` page can customize keybinds by mode.
- Use DU MCP bridge tools first; custom AHK and screenshots are support tools when needed.
- The current live scene is a freshly deployed factory with many interactable devices; names and links mostly exist, but configurations were not restored.
- Be careful moving around: the factory floor uses different voxel materials and may contain gaps.

## Current Findings

- Initial live check showed first-person in-world state with a visible crosshair.

## Industry

- Industry elements can appear configured from a link/layout point of view after blueprint deployment, while still having no restored machine configuration. Do not assume recipes or production settings survived the deploy.
- From the player view, useful top-level industry states include `ERROR`, `STOPPED`, `missing input`, `output full`, and `RUNNING`.
- `ERROR` means a serious issue on the server side and should be treated separately from normal production blocking states.
- `STOPPED` means the machine is not actively producing. For freshly deployed or otherwise inactive machines, counters such as remaining time or batches remaining may be dummy values and should not be trusted automatically.
- `missing input` means the machine is configured but blocked because required materials are not available.
- `output full` means the machine is configured but blocked because its output cannot be moved into linked storage.
- `RUNNING` means the machine is actively producing and progress counters are the most likely to be meaningful.
- Player-visible production modes are `Run`, `Move`, and `Maintain`.
- `Run` means endless production: keep running and move whatever can be moved.
- `Move` means produce only a specific amount of batches, if available.
- `Maintain` means keep output at a target liters-volume or item-count threshold.
- Factory operating style is high-availability and high-throughput, not just-in-time.
- The factory intentionally over-produces materials and parts. Do not optimize toward minimal buffers unless explicitly asked.
- Ore refining should normally be configured in `Run` mode with no planned pauses.
- Downstream transfer units are most often, but not always, configured in `Maintain` mode.
- Typical maintain targets are chosen to fit the linked buffer container rather than to exactly match one immediate batch.
- As a rule of thumb, an `XS` container may be maintained around `1500` and an `S` container around `10000` out of `12000` liters, when that fits the branch role.
- `Run` mode on transfer units is rare in this factory. It is valid gameplay-wise, but not the default because it eventually falls into `missing input` or `output full`, and past server issues made those end states undesirable operationally.
- Some transfer-unit maintain targets must be based on total concurrent alpha demand of all linked consumers.
- For shared feeder paths, maintain enough material so every linked consumer can start at the same time.
- Example: if one transfer unit feeds `6` consumers and each can consume up to `100` liters of a material per start, a maintain target around `600` is enough; there is no need to set a much larger target unless the branch role requires extra buffer.
- Batch size and cycle output matter when choosing maintain levels. Some downstream parts produce in units like `1` while others produce in larger steps such as `50`, so maintain thresholds must reflect both per-batch size and consumer concurrency.
- When live backend data is not enough to infer a correct maintain target, the agent should treat that as missing factory-domain knowledge and ask or consult stored notes instead of inventing values.
- For backend tooling, industry operations should be batch-first. Even one machine should be treated as a one-entry batch.
- For agent work, do not silently narrow a user request from "ore containers" or similar broad wording down to feeder-path containers only. If the user did not narrow scope, keep the scan broad.
- Some transfer units can get stuck in stale runtime state because of server-side issues. Typical signs are `RUNNING` with `batchesRequested: 1`, or a transfer unit stuck at `100%` in any mode while normal reconfiguration times out.
- In that stale state, a normal backend configure call may fail with `industry_activation_stop_timeout` even though the intended recovery is simple.
- Recovery rule: retry only the affected subset with `hard` stop, then reapply the intended final recipe, mode, and amount. Do not leave the machine in ad-hoc `Move` mode after recovery.
- After that forced restart, verify the final runtime state and stored target again before moving on.
- Player-assigned names are useful hints, but they can be stale or misleading after refactors or partial rebuilds. A TU named for one support line may actually feed a different container now.
- Name rule: use exact names as discovery hints only. Final targeting for setup, repair, and maintain decisions must be confirmed from links.
- For ore-to-pure refiner banks, the reliable backend workflow is:
  1. Find the full same-kind machine bank from the linked source-storage topology, not from one storage name alone.
  2. If the bank is split across multiple parallel source hubs, union the outbound machine links before configuring.
  3. Soft-stop only the machines that are actually running or otherwise need to finish their current work.
  4. Wait until they are really `STOPPED`; allow up to several minutes for `Finish & Stop` when needed.
  5. Machines that are inactive and unconfigured do not need a stop first.
  6. Send backend batch configuration in moderate groups for the same machine kind. Do not fan out into one MCP call per machine when the batch tools can cover the bank.
  7. Use the intended final mode directly. For continuously fed refiner banks this is often `Run`, not `Move` or `Maintain`.
  8. After the batch start, verify final state and recipe on the configured group before continuing with the next group.
  9. For feeder transfer units on stable production branches, prefer restoring the intended long-lived `Maintain` target rather than leaving them in ad-hoc `Move` mode after recovery.
- Hub-backed storage rule:
  1. A storage element has exactly one storage-output mode: `hub`, `non-hub`, or `none`.
  2. `hub` means its outgoing storage linkage goes to exactly one hub and to no other storage target.
  3. `non-hub` means its outgoing storage linkage does not go to a hub.
  4. A mix of hub and non-hub storage outputs is invalid and should be treated as faulty linkage, not as a normal routing option.
  5. If a branch is hub-backed, the hub is the refill/write entry point. Do not try to refill the linked child containers directly.
  6. Child containers behind a hub can appear empty or even report unusable backend storage state; that does not make them the correct refill target.
  7. For hub-backed branches, use the child containers mainly as topology or buffer indicators and use the hub for storage moves and refill operations.
- Support-query fallback rule:
  1. The generalized support query is preferred when it recognizes the branch cleanly.
  2. If a support branch is not returned there, do not assume the branch is invalid or irrelevant.
  3. Fall back to direct related-topology lookup from the named container or TU and keep tracing manually.
  4. In particular, branches with odd or degraded indexed storage state such as `none` may still be operationally real and still need repair.
- Upstream crawl rule:
  1. If a feeder TU has the right recipe and target but is `JAMMED_MISSING_INGREDIENT`, or its immediate source storage is empty, do not stop at that TU.
  2. Continue one step upstream at a time through linked refill TUs and source storages until the first dead or unconfigured refill leg is found.
  3. Fix that upstream refill leg first, then recheck the downstream TU that originally looked blocked.
  4. Treat an empty source storage as a branch-level flow problem until proven otherwise, not as proof that the downstream TU itself is still misconfigured.
- Producer-to-pure trace rule:
  1. There is no single toolbox call that walks an arbitrary number of upstream hops from one producer to ore.
  2. The normal workflow is iterative: exact anchor -> compact related subgraph -> batched live storage reads -> packaged support-branch query where applicable -> one more upstream step.
  3. Use `du_construct_index_related` for the generic “one more hop from here” step.
  4. Use `du_storage_describe` with `entries` for live stock checks on several storages from the same subgraph.
  5. Use `du_construct_index_industry_support_storage` when the current upstream node is clearly a support/refill branch and the workflow needs support topology plus live support/source contents together.
  6. Repeat until the semantic item class or branch role reaches the intended stopping point such as `pure` or `ore`.
  7. Do not describe these support tools as full arbitrary-depth graph walkers; they package one branch type well, but they do not replace iterative tracing.

## Factory Strategy Case: Unconfigured Alloy Line

- Typical starting state after deploy: links and names still exist, but machines have no recipe and must be configured again.
- A user may identify the main storage either by exact name such as `AL FE S3` or by a bare `ID` such as `760`.
- A bare user `ID` means the construct-local `id`, not a guessed global backend id.
- If a given name matches multiple elements, do not guess. Stop and ask for the construct-local `id`.
- Names are still useful because many player-assigned names already encode the intended recipe or role.

### Example Reference Point

- User points at or names a storage like `AL FE S3` or `760`.
- Expected meaning: this is one output container in an alloy production cluster that can be used as an anchor for later reasoning.

### Topology Rules

- Containers can have up to `10` input/output links.
- Industry elements can have up to `7` inputs and `1` output.
- A machine may have a main product plus byproducts.
- Relevant byproducts include catalysts `Catalyst 3` to `Catalyst 5`.
- Catalysts are close to pass-through material in many setups and often need to be removed from regular containers by transfer units because surplus accumulates there.
- Other byproducts can include `Oxygen`, `Hydrogen`, or other materials.

### Specific Factory Pattern

- In the shown alloy case, `6` smelters produce alloy `Al Fe`.
- Each smelter outputs into one `S` container with `12 kL` volume.
- Smelters are normally configured to `Maintain`, for example `10000 L`.
- Each `S` container has `10` linked transfer units.
- Each transfer unit keeps one linked `XS` container at a target fill level, for example `500 L`.
- That target is variable and must not be assumed fixed.
- For one `Al Fe` storage node this yields `30` downstream distribution links available as consumers or routing edges.

### Notes For Later Task Design

- This section does not define the workflow yet.
- It only captures the factory pattern, naming assumptions, and link topology that later workflows can rely on.
- Later tasks can use one named or numbered container as an anchor and then inspect nearby producers, consumers, and transfer units from the live links.
- For feeder walls or other dense local banks, vicinity queries around one known local anchor are a valid workflow tool.
- Good anchors are one known TU in the wall or one local feeder container in the same wall.
- Capture the whole local vicinity first, then split that vicinity into named or link-confirmed subgroups before configuring.

### Feeder-Wall Workflow

- For dense rows of local feeder TUs and containers, start from one known local anchor and use vicinity queries to capture the whole nearby bank.
- Prefer one vicinity-defined working set over repeated single-name searches when the user is clearly referring to a visible local cluster.
- After the vicinity set is captured, configure in named or otherwise unambiguous subgroups first, then verify, then continue with the next subgroup.
- Leave unnamed or ambiguous TUs for a second pass unless links make their role deterministic.
- Do not silently narrow a user-defined local cluster just because a smaller subset looks cleaner; if the user points at the full visible bank, keep the bank broad.

### Tooling Implications

- The low-level tools must support deterministic resolution by construct-local `id`, exact `name`, links, category, and machine type.
- The user-facing industry MCP surface should stay batch-oriented for reads and writes so banks can be inspected and configured in one call shape.
- Transfer units are a special case with one stable machine type but many instances in a factory.
- Higher-level workflows should first narrow to the transfer-unit type, then select the concrete instance by links, exact name, or construct-local `id`.
- Recipe inference from names is allowed only as a controlled higher-level step and must fall back to explicit user clarification when ambiguous.
- Maintain-target precedence rule:
  1. Start from the branch role, not from one global default.
  2. Large downstream `S` buffers on stable feeder branches may reasonably sit around `5000` or `10000` depending on the intended operating style for that branch.
  3. Small shared feeder paths should instead use concurrent-consumer demand when that is clearly smaller and operationally intended.
  4. If one local wall or bank already shows a stable repeated target pattern, prefer restoring that repeated local pattern over applying a broader factory-wide rule of thumb.
