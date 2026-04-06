# Fix Dump

## Problem

The current UI dump pipeline can produce a successful chunked dump that still contains incomplete HTML content.

This is a real bug for full-document dumps. It is not just a reassembly/display issue.

At the same time, some selector-scoped dumps are complete fragments and must not be judged by `</body>` or `</html>` presence.

## Confirmed Findings

### 1. Full-document dump can end mid-HTML

Confirmed example:

- `D:\MyDUserver\tmp\ui-dumps\ui-1775468971830-967561130.ndjson`

Observed facts:

- `ui_dump_start.config.htmlSelector == ""`
- HTML section metadata reported `truncated = true`
- HTML `originalLength = 3722889`
- Reassembled HTML length was `700000`
- Reassembled file ended mid-markup, with no closing `</body>` or `</html>`

Conclusion:

- The transport produced a formally complete packet sequence for the section, but the section content had already been clipped before reassembly.

### 2. Selector-scoped inventory dumps were complete fragments

Confirmed examples:

- `ui-1775485495085-994787699`
- `ui-1775484703293-50776154`
- `ui-1775469724819-748572965`

Observed facts:

- `ui_dump_start.config.htmlSelector` was set to `#industryPanel_recipeBankSubPanel_inventoryViewContainer` or `.inventory_container_view`
- `meta.truncated == false`
- `originalLength == reassembledLength`
- output had no `</body>` or `</html>`, but this is expected because the payload captured `el.outerHTML`, not the full document
- the fragment ended with balanced closing `</div>` tags

Conclusion:

- These are complete selector fragments, not broken full-page dumps.

### 3. The reassembly output hides the important state

Current reassembly output only records:

- packet count
- expected count
- missing parts
- bytes

It does not surface:

- `htmlSelector`
- whether the section is a full document or selector fragment
- `meta.truncated`
- `meta.payloadTruncated`
- `originalLength`
- whether the section is logically complete

Conclusion:

- A dump can look "complete" in `manifest.json` while still being clipped.

## Actual Root Cause Areas

### 1. HTML is clipped before chunking

In `ModUiToolbox\payload\ModUiToolbox-payload.js`:

- `collectHtml()` reads either `document.documentElement.outerHTML` or `document.querySelector(config.htmlSelector).outerHTML`
- then it does:
  - `if (html.length > config.maxHtmlChars) { html = html.slice(0, config.maxHtmlChars); truncated = true; }`

This means large full-document dumps are already incomplete before section chunking even starts.

### 2. There is a second payload clip layer in transport

In the same file:

- `sendSection()` clips payload again when `payload.length > config.maxPayloadChars`
- `sendSectionPaced()` does the same

This sets:

- `payloadTruncated = true`
- `originalPayloadLength`

but still sends a shortened section as normal data.

Conclusion:

- There are two independent silent clipping stages:
  - section collection clip (`maxHtmlChars`)
  - section transport clip (`maxPayloadChars`)

### 3. Chunking is not the failing mechanism

The chunking logic itself is simple string slicing by `chunkSize` and packet numbering.

The real bug is that the section text may already be shortened before chunking, and the reassembly path currently treats that shortened content as if it were a normal successful dump.

## Fix Direction

## Goal

Make chunked dumping transport the complete section content end-to-end, or fail explicitly. It must never silently produce an incomplete full-document dump that looks successful.

## Required Behavior

### A. Full-document dumps

For `htmlSelector == ""`:

- HTML must be transported in full through chunking
- if a hard limit is still exceeded, the dump must fail explicitly
- do not send a clipped HTML section and mark the dump as complete

### B. Selector-fragment dumps

For `htmlSelector != ""`:

- treat the result as a fragment
- absence of `</body>` and `</html>` is normal
- completeness is determined by metadata and exact byte/length matching, not by document closing tags

### C. Reassembly and diagnostics

The reassembler must expose whether a section is:

- full document or selector fragment
- complete or clipped
- clipped during collection or during transport

## Recommended Implementation Plan

### 1. Remove silent clipping for HTML dumps

Change `collectHtml()` so that for normal dump operation it returns the full HTML string and reports its true length.

Do not shorten HTML there just because it exceeds `maxHtmlChars`.

If a hard safety limit must remain, it should trigger an explicit failure state instead of returning a shortened "successful" HTML section.

### 2. Remove silent clipping in `sendSection()` for dump sections

For chunked dump sections, chunking should be the size-management mechanism.

Do not clip the payload and continue as if the section is valid.

If a true upper bound is still necessary, emit an explicit fatal/incomplete result and stop that dump.

### 3. Add explicit section completeness metadata

For each `ui_dump` section, add metadata such as:

- `sourceKind: "document" | "fragment"`
- `selector: <htmlSelector or empty>`
- `originalLength`
- `sentLength`
- `collectionTruncated`
- `transportTruncated`
- `complete`

`complete` should be false if any clipping happened anywhere.

### 4. Make dump completion honest

`ui_dump_complete` should not mean only "dispatch finished".

It should mean:

- all intended sections were sent
- no section was clipped unless the completion event explicitly marks the dump incomplete

If a section is clipped or aborted, emit either:

- `ui_dump_fatal`, or
- `ui_dump_complete` with `complete: false` and per-section failure info

The important part is that consumers must not mistake clipped output for a good dump.

### 5. Upgrade `reassemble-ui-dump.ps1`

Extend `manifest.json` to record, per section:

- `originalLength`
- `reassembledLength`
- `truncated`
- `payloadTruncated`
- `sourceKind`
- `selector`
- `complete`

Also add a top-level warning or status when:

- a section was clipped
- packet parts are missing
- a full-document HTML section lacks closing `</html>`

Do not apply the closing-tag check to selector fragments.

### 6. Add a verifier script or check mode

Add a local verification step that reads one dump and reports:

- document vs fragment
- parts present vs expected
- original vs reassembled length
- clip flags
- closure checks for full-document HTML only

This should become the standard post-dump sanity check.

## Acceptance Criteria

The task is not done until all of these are true:

1. A full-document HUD dump larger than the previous failing example reassembles to the full original length.
2. A full-document HTML dump ends with closing document tags and is not cut mid-markup.
3. A selector-fragment dump can be marked complete without `</body>` or `</html>`.
4. `manifest.json` clearly shows whether a section is clipped or complete.
5. There is no path where clipped HTML is emitted as a normal successful dump without an explicit incomplete/fatal status.

## Files To Revisit

- `D:\github\du-tobi\ModUiToolbox\payload\ModUiToolbox-payload.js`
- `D:\github\du-tobi\ModUiToolbox\tools\reassemble-ui-dump.ps1`
- `D:\github\du-tobi\DuMcpBridge\tech-doc.md`

## Short Summary

The main bug is not the chunk numbering or concatenation logic.

The main bug is silent pre-chunk clipping of large sections, combined with weak completeness reporting. The fix is to make chunked dumps carry the whole section, and to make any incomplete dump explicit instead of ambiguous.
