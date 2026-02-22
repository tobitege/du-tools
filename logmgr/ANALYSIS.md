# Log Management TUI Analysis

Generated: 2026-02-21 22:59 local time
Workspace root: `D:\MyDUserver`

## Current Log Footprint

- `logs`: 22 files, ~1.72 GB
- `stacklogs`: 4,508 files, ~0.174 GB
- Additional notable log storage:
- `wincs`: ~246.7 MB
- `wingo`: ~149.5 MB
- `kafka_2.13-3.8.0\logs`: ~89.0 MB

Largest files observed:

- `logs\Grains.json`: ~1,097 MB
- `logs\Grains_dev.log`: ~278 MB
- `logs\DualNode.json`: ~164 MB
- `logs\DualNode.log`: ~93 MB

## Format Characteristics

- `logs\*.json`: stream of concatenated pretty-printed JSON objects (not a single array)
- `logs\*.log`: plain text with service-specific layouts
- `logs\physics-telemetry-*.ndjson`: true line-delimited JSON
- `stacklogs\*.log`: mixed source formats (Kafka, Mongo JSON, Postgres style, app logs)

## Operational Characteristics

- Continuous write activity was observed in both `logs` and `stacklogs`
- `stacklogs` has high file churn due to frequent rotations
- `logs` contains fewer files but includes very large hot files

## Product Requirements Derived From Reality

- High-performance tailing for very large files
- Efficient navigation/search across many rotated files
- Multi-parser support:
- Plain text
- Bracketed timestamp lines
- NDJSON
- Multi-line concatenated JSON streams
- Read-only by default; destructive actions confirmation-gated

## Implemented In This Iteration

- New Rust project: `logmgr`
- Ratatui + Crossterm multi-pane TUI
- Source discovery across known log directories + auto-detected `*log*` dirs
- Source summary (size/file count/newest)
- File listing by source (sorted by mtime desc, then size)
- Tail preview loader for selected files (bounded bytes + bounded lines)
- Keyboard navigation:
- `q` quit
- `Tab` / `Shift+Tab` pane switching
- Arrow keys / `j` `k` movement
- `Enter` load file tail preview
- `r` rescan
- `PgUp` / `PgDn` preview scroll
- Live multi-file follow mode (toggle with `f`)
- Rotation/truncation-aware incremental reads
- Active-file tracking from recent writes with periodic rescan
- Bounded live buffer to keep memory stable

## Recommended Next Phases

1. Structured parsing and normalization layer
- Auto-detect parser per file/line
- Normalize to a common event model (`timestamp`, `level`, `source`, `message`, `raw`)

2. Query engine and filters
- Global text search (regex + plain)
- Time-range filters
- Severity/source filters

3. Live mode
- Follow multiple active files
- Rotation-aware tailing
- Rate indicators and dropped-line counters

4. Safe management actions
- Candidate cleanup view (oldest/largest/low-value)
- Archive/compress/delete workflows with explicit confirmation prompts

5. Performance hardening
- Background indexing cache
- Incremental scan updates
- Memory bounds for previews and search buffers
