# SilverZero Convert Ideas

This folder contains local copies of selected DU-Screen-Flair source files for RenderScript conversion work.

## First Step

Create a shared helper library as a `.lua` file before converting individual screens.

Suggested first library name:

- `lib/SilverZeroRsLib.lua`

Suggested responsibilities:

- screen-safe margins and scale helpers
- centered and anchored text helpers
- panel, frame, divider, and badge helpers
- color palette constants and theme helpers
- simple icon and emblem drawing helpers
- list/table row helpers for sign and hub layouts
- portrait/landscape adaptation helpers
- clipping and layer-order convenience helpers

The goal is to avoid rewriting the same layout logic for every converted screen.

## Best Static Conversion Targets

### 1. `WelcomeScreenM.html`

- strong static showcase screen
- custom message, logo/avatar, decorative sci-fi frame
- good candidate for a future RenderScript welcome-screen example

### 2. `SimpleSignS.html`

- simple reusable sign template
- low-risk conversion target
- good first sign example after the shared library exists

### 3. `SimpleSignXS.html`

- extra-small sign variant
- useful for testing scaling and compact composition

### 4. `DispenserSignS.html`

- static promotional sign layout
- good themed example for decorative signage

### 5. `ShipStatsS.html`

- compact store-style information layout
- useful for text blocks, labels, and stat alignment

### 6. `ShipFrameM.html`

- frame-heavy store sign
- useful for reusable border and card components

### 7. `HubPanelL.html`

- larger panel layout
- useful for multi-section frame and caption components

### 8. `HubPanelS.html`

- smaller hub panel layout
- useful for extracting reusable panel chrome

## Best Dynamic / PB Extraction Targets

### 9. `ContainerSignM.json`

- programming-board package that builds HTML for a scrollable container table
- good candidate for a first extracted PB-to-RenderScript table screen

### 10. `IndustrySelectorM.json`

- richer interactive screen with mouse handling and industry control
- useful reference for future cursor-input support
- better as a second-phase conversion after input fidelity improves

### 11. `ContainerHubHubM.json`

- multi-hub dashboard
- strong advanced example once table and panel helpers exist

### 12. `OreExplorerM.json`

- large and complex dynamic screen
- best treated as a late-stage conversion target

## Recommended Conversion Order

1. Build `lib/SilverZeroRsLib.lua`
2. Convert `SimpleSignS.html`
3. Convert `SimpleSignXS.html`
4. Convert `WelcomeScreenM.html`
5. Convert `ShipStatsS.html`
6. Convert `ShipFrameM.html`
7. Convert `DispenserSignS.html`
8. Convert `HubPanelS.html`
9. Convert `HubPanelL.html`
10. Extract and convert `ContainerSignM.json`
11. Extract and convert `ContainerHubHubM.json`
12. Extract and convert `IndustrySelectorM.json`
13. Extract and convert `OreExplorerM.json`

## Important Notes

- These source files are mostly DU HTML screen assets and PB JSON packages, not native RenderScript examples.
- Several conversions will need adaptation rather than one-to-one translation.
- The JSON files include programming-board logic; only parts of them are direct screen payloads.
- The shared library should reduce repeated work across signs, welcome screens, store panels, and hub layouts.
