# Element Placement Notes

This note collects the backend placement behavior and the live calibration learned while testing `du_element_add` with a `ProgrammingBoard`.

## Main Points

- `du_element_add` is a raw backend placement call
- it places an element at an exact local-meter transform
- it does not reproduce the full in-game deploy/snap workflow
- if the active primary container is valid and default, the backend can source the element from that linked container

## Source Storage Behavior

The important backend distinction is:

- `PlayerInventory` can resolve through the active primary container
- `PlayerInventoryWithoutPrimary` is the raw nanopack inventory only

For build/deploy behavior this means:

- the game places elements from the active primary container when one is linked and valid
- for practical build operations, treat the active primary container as the real deploy inventory
- MCP deploy slot resolution must therefore use the active primary path, not only the raw nanopack inventory

Live test result:

- the `ProgrammingBoard` stack used for placement was in `player_primary_container`, slot `9`
- raw nanopack inventory did not contain the board
- after fixing MCP slot resolution, `du_element_add` successfully deployed directly from that primary-container slot

## Placement Coordinates

Backend placement uses construct-local meters.

The build overlay seen in-game while aiming at voxels on `TestCore_Thades1` behaved like this:

- overlay coordinates are centered around construct center
- `Z` is vertical
- values snap to `0.5 voxel`

Useful conversions:

```text
1 voxel = 0.25 m
0.5 voxel = 0.125 m
```

For the tested `Static Core Unit 256` construct, the practical conversion was:

```text
backendMeters = overlayVoxels / 4 + 128
```

This `128` is the half-size offset for that construct and should not be generalized blindly.

## Programming Board Test

Initial aimed floor point from the build overlay:

```text
X=-12.5 Y=155.5 Z=-7.5
```

Desired offset was `1 m up`, which means:

```text
Z += 4 voxels
```

Correct converted backend target:

```json
{ "x": 124.875, "y": 166.875, "z": 127.125 }
```

## Pivot / Mesh Offset Warning

Even when the converted target point is correct, the visible element body may not land where expected.

Observed with `ProgrammingBoard`:

- raw add placed it on the opposite side of the voxel floor
- after manual move, it became clear the element origin/pivot is offset from the visible board body

Practical rule:

- treat raw add as an approximate placement tool
- expect per-element pivot offsets
- keep manual move or a later `element_move` helper available for final alignment

## Linking Follow-Up

After placement, the new board was successfully linked to the static core as:

- source: `ProgrammingBoard`
- destination: `CoreUnitStatic256`
- plug type: `PLUG_CONTROL`

Observed direction and allocation behavior:

- existing `ProgrammingBoard` elements on the construct already had outbound links
- the `CoreUnitStatic256` had inbound links
- that established the correct direction as `ProgrammingBoard -> CoreUnitStatic256`
- the board source plug used was `fromPlug = 0`
- the core destination plugs `0..3` were already occupied
- probing the next destination plug indices showed that `toPlug = 4` was the first free one

Practical linking rule from this test:

1. infer direction from existing topology when possible
2. try the standard plug type first
3. if link creation fails with `LinkDestinationAlreadyOccupied`, probe the next destination plug index until one succeeds

Exact successful live link:

```text
from: ProgrammingBoard localId 70
to:   CoreUnitStatic256 localId 1
plugType: PLUG_CONTROL
fromPlug: 0
toPlug: 4
```
