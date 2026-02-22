# logmgr

Terminal UI for browsing and tailing myDU server log files. Built with Rust, Ratatui, and Crossterm.

## What it does

Scans the myDU server install directory for known log sources (Orleans, stack services, Kafka, Nginx, MongoDB, PostgreSQL, RabbitMQ, Redis, flight logs, crash dumps) and presents them in a three-pane TUI:

- **Sources pane**: lists discovered log directories with file count, total size, and newest file timestamp.
- **Files pane**: lists individual log files for the selected source, sorted by modification time (newest first).
- **Preview pane**: displays the tail of a selected file, or a live-follow stream from active files.

>NOTE
The tool expects to find the myDU server directory at `D:\MyDUserver` (hardcoded root in source).
Adapt the path accordingly before compilation!

## Features

- Source discovery across known server log paths plus auto-detected `*log*` directories.
- Tail preview loader for individual files (bounded to 300 lines / 768 KB).
- Live multi-file follow mode: tracks recently-written files in a source, polls for new content, detects file truncation and rotation.
- Bounded live buffer (4000 lines max) to keep memory stable.

## Keyboard controls

| Key | Action |
| --- | ------ |
| `q` / `Ctrl+C` | Quit |
| `Tab` / `Shift+Tab` | Switch pane |
| Arrow keys / `j` `k` | Navigate within pane |
| `Enter` | Load file tail preview |
| `r` | Rescan sources |
| `f` | Toggle live follow mode |
| `PgUp` / `PgDn` | Scroll preview |
| `Home` / `End` | Jump to top / bottom |

## Build

```bash
cd logmgr
cargo build --release
```

## Run

```bash
cd logmgr
cargo run --release
```

## Technical details

- Rust edition 2024
- Dependencies: `ratatui 0.29`, `crossterm 0.28`, `walkdir 2.5`, `chrono 0.4`, `anyhow 1.0`
