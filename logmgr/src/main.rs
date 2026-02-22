use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime};

use anyhow::Result;
use chrono::{DateTime, Local};
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use crossterm::execute;
use crossterm::terminal::{
    EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode,
};
use ratatui::backend::CrosstermBackend;
use ratatui::prelude::*;
use ratatui::widgets::*;
use walkdir::WalkDir;

const TAIL_LINE_LIMIT: usize = 300;
const TAIL_BYTE_LIMIT: u64 = 768 * 1024;
const LIVE_POLL_INTERVAL: Duration = Duration::from_millis(800);
const LIVE_RESCAN_INTERVAL: Duration = Duration::from_secs(3);
const LIVE_RECENT_WINDOW: Duration = Duration::from_secs(20 * 60);
const LIVE_ACTIVE_FILE_LIMIT: usize = 12;
const LIVE_MAX_BUFFER_LINES: usize = 4_000;
const LIVE_READ_BYTE_LIMIT: u64 = 256 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FocusPane {
    Sources,
    Files,
    Preview,
}

impl FocusPane {
    fn next(self) -> Self {
        match self {
            Self::Sources => Self::Files,
            Self::Files => Self::Preview,
            Self::Preview => Self::Sources,
        }
    }

    fn prev(self) -> Self {
        match self {
            Self::Sources => Self::Preview,
            Self::Files => Self::Sources,
            Self::Preview => Self::Files,
        }
    }
}

#[derive(Debug, Clone)]
struct SourceSummary {
    name: String,
    path: PathBuf,
    file_count: usize,
    total_bytes: u64,
    newest: Option<SystemTime>,
}

#[derive(Debug, Clone)]
struct FileEntry {
    source_name: String,
    full_path: PathBuf,
    display_name: String,
    size: u64,
    modified: Option<SystemTime>,
}

#[derive(Debug)]
struct App {
    root: PathBuf,
    focus: FocusPane,
    sources: Vec<SourceSummary>,
    files: Vec<FileEntry>,
    preview_lines: Vec<String>,
    preview_scroll: usize,
    source_state: ListState,
    file_state: ListState,
    status: String,
    live_follow_enabled: bool,
    live_follow_source_name: Option<String>,
    live_follow_source_path: Option<PathBuf>,
    live_follow_files: Vec<PathBuf>,
    live_follow_offsets: HashMap<PathBuf, u64>,
    last_live_poll: Instant,
    last_live_rescan: Instant,
    should_quit: bool,
}

impl App {
    fn new(root: PathBuf) -> Self {
        let now = Instant::now();
        let mut app = Self {
            root,
            focus: FocusPane::Sources,
            sources: Vec::new(),
            files: Vec::new(),
            preview_lines: vec!["Select a file and press Enter to load tail preview.".to_string()],
            preview_scroll: 0,
            source_state: ListState::default(),
            file_state: ListState::default(),
            status: "Starting scan...".to_string(),
            live_follow_enabled: false,
            live_follow_source_name: None,
            live_follow_source_path: None,
            live_follow_files: Vec::new(),
            live_follow_offsets: HashMap::new(),
            last_live_poll: now,
            last_live_rescan: now,
            should_quit: false,
        };
        app.rescan();
        app
    }

    fn selected_source_idx(&self) -> Option<usize> {
        self.source_state.selected()
    }

    fn selected_file_idx(&self) -> Option<usize> {
        self.file_state.selected()
    }

    fn selected_source(&self) -> Option<&SourceSummary> {
        self.selected_source_idx()
            .and_then(|idx| self.sources.get(idx))
    }

    fn selected_file(&self) -> Option<&FileEntry> {
        self.selected_file_idx().and_then(|idx| self.files.get(idx))
    }

    fn rescan(&mut self) {
        self.sources = discover_sources(&self.root);
        if self.sources.is_empty() {
            self.source_state.select(None);
            self.files.clear();
            self.file_state.select(None);
            self.preview_lines = vec!["No log sources found.".to_string()];
            self.preview_scroll = 0;
            self.status = "No sources were detected from known paths.".to_string();
            self.stop_live_follow();
            return;
        }

        let selected = self
            .source_state
            .selected()
            .filter(|idx| *idx < self.sources.len())
            .unwrap_or(0);
        self.source_state.select(Some(selected));
        self.refresh_files_for_selected_source();
        self.status = format!("Rescan complete. {} source(s) loaded.", self.sources.len());
        if self.live_follow_enabled {
            self.start_live_follow_for_selected_source();
        }
    }

    fn refresh_files_for_selected_source(&mut self) {
        let Some(source) = self.selected_source().cloned() else {
            self.files.clear();
            self.file_state.select(None);
            self.preview_lines = vec!["No source selected.".to_string()];
            self.preview_scroll = 0;
            return;
        };

        self.files = list_files_for_source(&source);
        if self.files.is_empty() {
            self.file_state.select(None);
            self.preview_lines = vec!["This source has no files.".to_string()];
            self.preview_scroll = 0;
            self.status = format!("{} has no files.", source.name);
            return;
        }

        let selected = self
            .file_state
            .selected()
            .filter(|idx| *idx < self.files.len())
            .unwrap_or(0);
        self.file_state.select(Some(selected));
        if !self.live_follow_enabled {
            self.preview_lines = vec![format!(
                "Source '{}' selected. Pick a file and press Enter to load preview.",
                source.name
            )];
            self.preview_scroll = 0;
        }
        self.status = format!("Loaded {} file(s) from {}.", self.files.len(), source.name);
    }

    fn load_preview_for_selected_file(&mut self) {
        let Some(file) = self.selected_file().cloned() else {
            self.preview_lines = vec!["No file selected.".to_string()];
            self.preview_scroll = 0;
            return;
        };

        match read_tail_lines(&file.full_path, TAIL_LINE_LIMIT, TAIL_BYTE_LIMIT) {
            Ok(lines) => {
                self.preview_lines = if lines.is_empty() {
                    vec!["File is empty.".to_string()]
                } else {
                    lines
                };
                self.preview_scroll = 0;
                self.status = format!(
                    "Loaded preview: {} ({}).",
                    file.display_name,
                    format_bytes(file.size)
                );
            }
            Err(err) => {
                self.preview_lines = vec![format!(
                    "Failed to read {}: {}",
                    file.full_path.display(),
                    err
                )];
                self.preview_scroll = 0;
                self.status = format!("Preview failed for {}.", file.display_name);
            }
        }
    }

    fn toggle_live_follow(&mut self) {
        if self.live_follow_enabled {
            self.stop_live_follow();
            self.status = "Live follow stopped.".to_string();
        } else {
            self.start_live_follow_for_selected_source();
        }
    }

    fn start_live_follow_for_selected_source(&mut self) {
        let Some(source) = self.selected_source().cloned() else {
            self.status = "Cannot start live follow without a selected source.".to_string();
            return;
        };

        self.live_follow_enabled = true;
        self.live_follow_source_name = Some(source.name.clone());
        self.live_follow_source_path = Some(source.path.clone());
        self.live_follow_files.clear();
        self.live_follow_offsets.clear();
        self.preview_lines.clear();
        self.preview_scroll = 0;
        self.last_live_poll = Instant::now();
        self.last_live_rescan = Instant::now();

        self.refresh_live_follow_files(true);
        self.append_preview_line(format!("LIVE START: source={}", source.name));
        self.status = format!(
            "Live follow started for {} ({} active files).",
            source.name,
            self.live_follow_files.len()
        );
    }

    fn stop_live_follow(&mut self) {
        self.live_follow_enabled = false;
        self.live_follow_source_name = None;
        self.live_follow_source_path = None;
        self.live_follow_files.clear();
        self.live_follow_offsets.clear();
    }

    fn refresh_live_follow_files(&mut self, seed_from_end: bool) {
        let Some(source_name) = self.live_follow_source_name.clone() else {
            return;
        };
        let Some(source_path) = self.live_follow_source_path.clone() else {
            return;
        };

        let candidates = collect_follow_candidates(&source_name, &source_path);
        let active =
            pick_active_follow_files(candidates, LIVE_RECENT_WINDOW, LIVE_ACTIVE_FILE_LIMIT);
        let active_set: HashSet<PathBuf> = active.iter().cloned().collect();
        self.live_follow_offsets
            .retain(|path, _| active_set.contains(path));

        for path in &active {
            if self.live_follow_offsets.contains_key(path) {
                continue;
            }
            let offset = if seed_from_end {
                std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0)
            } else {
                0
            };
            self.live_follow_offsets.insert(path.clone(), offset);
            if !seed_from_end {
                self.append_preview_line(format!("LIVE FILE+ {}", short_file_name(path)));
            }
        }

        self.live_follow_files = active;
    }

    fn maybe_tick_live_follow(&mut self) {
        if !self.live_follow_enabled {
            return;
        }

        let now = Instant::now();
        if now.duration_since(self.last_live_poll) < LIVE_POLL_INTERVAL {
            return;
        }
        self.last_live_poll = now;

        if now.duration_since(self.last_live_rescan) >= LIVE_RESCAN_INTERVAL {
            self.refresh_live_follow_files(false);
            self.last_live_rescan = now;
        }

        let mut total_new_lines = 0usize;
        let files = self.live_follow_files.clone();
        for path in files {
            let mut offset = *self.live_follow_offsets.get(&path).unwrap_or(&0);
            match read_new_lines_since(&path, &mut offset, LIVE_READ_BYTE_LIMIT) {
                Ok(update) => {
                    self.live_follow_offsets.insert(path.clone(), offset);
                    if update.truncated {
                        self.append_preview_line(format!(
                            "LIVE ROTATE {} (file truncated/replaced)",
                            short_file_name(&path)
                        ));
                    }
                    if update.skipped_head {
                        self.append_preview_line(format!(
                            "LIVE SKIP {} (large burst, showing recent tail)",
                            short_file_name(&path)
                        ));
                    }
                    if !update.lines.is_empty() {
                        total_new_lines += update.lines.len();
                        for line in update.lines {
                            self.append_preview_line(format!(
                                "[{}] {}",
                                short_file_name(&path),
                                line
                            ));
                        }
                    }
                }
                Err(err) => {
                    self.append_preview_line(format!(
                        "LIVE WARN {} ({})",
                        short_file_name(&path),
                        err
                    ));
                }
            }
        }

        if total_new_lines > 0 {
            self.status = format!(
                "Live follow: +{} line(s) from {} file(s).",
                total_new_lines,
                self.live_follow_files.len()
            );
            self.preview_scroll = self.preview_lines.len().saturating_sub(1);
        }
    }

    fn append_preview_line(&mut self, line: String) {
        self.preview_lines.push(line);
        if self.preview_lines.len() > LIVE_MAX_BUFFER_LINES {
            let remove = self.preview_lines.len() - LIVE_MAX_BUFFER_LINES;
            self.preview_lines.drain(0..remove);
        }
        self.preview_scroll = self.preview_lines.len().saturating_sub(1);
    }

    fn live_follow_label(&self) -> String {
        if self.live_follow_enabled {
            let name = self.live_follow_source_name.as_deref().unwrap_or("unknown");
            format!("LIVE on {} ({} files)", name, self.live_follow_files.len())
        } else {
            "LIVE off".to_string()
        }
    }

    fn move_source_selection(&mut self, delta: i32) {
        if self.sources.is_empty() {
            return;
        }
        let current = self.source_state.selected().unwrap_or(0) as i32;
        let max = (self.sources.len().saturating_sub(1)) as i32;
        let next = (current + delta).clamp(0, max) as usize;
        if Some(next) != self.source_state.selected() {
            self.source_state.select(Some(next));
            self.refresh_files_for_selected_source();
            if self.live_follow_enabled {
                self.start_live_follow_for_selected_source();
            }
        }
    }

    fn move_file_selection(&mut self, delta: i32) {
        if self.files.is_empty() {
            return;
        }
        let current = self.file_state.selected().unwrap_or(0) as i32;
        let max = (self.files.len().saturating_sub(1)) as i32;
        let next = (current + delta).clamp(0, max) as usize;
        if Some(next) != self.file_state.selected() {
            self.file_state.select(Some(next));
            if let Some(file) = self.selected_file().cloned() {
                self.status = format!(
                    "Selected {} ({})",
                    file.display_name,
                    format_bytes(file.size)
                );
                if !self.live_follow_enabled {
                    self.preview_lines = vec![format!(
                        "File '{}' selected. Press Enter to load preview.",
                        file.display_name
                    )];
                    self.preview_scroll = 0;
                }
            }
        }
    }

    fn scroll_preview(&mut self, delta: i32) {
        if self.preview_lines.is_empty() {
            return;
        }
        let max = (self.preview_lines.len().saturating_sub(1)) as i32;
        let current = self.preview_scroll as i32;
        self.preview_scroll = (current + delta).clamp(0, max) as usize;
    }

    fn scroll_preview_to_top(&mut self) {
        self.preview_scroll = 0;
    }

    fn scroll_preview_to_bottom(&mut self) {
        self.preview_scroll = self.preview_lines.len().saturating_sub(1);
    }

    fn on_key(&mut self, key: KeyEvent) {
        if key.kind != KeyEventKind::Press {
            return;
        }

        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            self.should_quit = true;
            return;
        }

        match key.code {
            KeyCode::Char('q') => {
                self.should_quit = true;
            }
            KeyCode::Tab => {
                self.focus = self.focus.next();
            }
            KeyCode::BackTab => {
                self.focus = self.focus.prev();
            }
            KeyCode::Char('r') => {
                self.rescan();
            }
            KeyCode::Char('f') => {
                self.toggle_live_follow();
            }
            _ => match self.focus {
                FocusPane::Sources => self.handle_sources_key(key.code),
                FocusPane::Files => self.handle_files_key(key.code),
                FocusPane::Preview => self.handle_preview_key(key.code),
            },
        }
    }

    fn handle_sources_key(&mut self, code: KeyCode) {
        match code {
            KeyCode::Up | KeyCode::Char('k') => self.move_source_selection(-1),
            KeyCode::Down | KeyCode::Char('j') => self.move_source_selection(1),
            KeyCode::Home | KeyCode::Char('g') => self.move_source_selection(-10_000),
            KeyCode::End | KeyCode::Char('G') => self.move_source_selection(10_000),
            KeyCode::Enter => self.refresh_files_for_selected_source(),
            KeyCode::Right | KeyCode::Char('l') => self.focus = FocusPane::Files,
            _ => {}
        }
    }

    fn handle_files_key(&mut self, code: KeyCode) {
        match code {
            KeyCode::Up | KeyCode::Char('k') => self.move_file_selection(-1),
            KeyCode::Down | KeyCode::Char('j') => self.move_file_selection(1),
            KeyCode::PageUp => self.move_file_selection(-15),
            KeyCode::PageDown => self.move_file_selection(15),
            KeyCode::Home | KeyCode::Char('g') => self.move_file_selection(-10_000),
            KeyCode::End | KeyCode::Char('G') => self.move_file_selection(10_000),
            KeyCode::Enter => self.load_preview_for_selected_file(),
            KeyCode::Left | KeyCode::Char('h') => self.focus = FocusPane::Sources,
            KeyCode::Right | KeyCode::Char('l') => self.focus = FocusPane::Preview,
            _ => {}
        }
    }

    fn handle_preview_key(&mut self, code: KeyCode) {
        match code {
            KeyCode::Up | KeyCode::Char('k') => self.scroll_preview(-1),
            KeyCode::Down | KeyCode::Char('j') => self.scroll_preview(1),
            KeyCode::PageUp => self.scroll_preview(-20),
            KeyCode::PageDown => self.scroll_preview(20),
            KeyCode::Home | KeyCode::Char('g') => self.scroll_preview_to_top(),
            KeyCode::End | KeyCode::Char('G') => self.scroll_preview_to_bottom(),
            KeyCode::Left | KeyCode::Char('h') => self.focus = FocusPane::Files,
            _ => {}
        }
    }
}

fn discover_sources(root: &Path) -> Vec<SourceSummary> {
    let candidates: Vec<(String, PathBuf)> = vec![
        ("logs".to_string(), root.join("logs")),
        ("stacklogs".to_string(), root.join("stacklogs")),
        ("flight-logs".to_string(), root.join("flight-logs")),
        ("kafka".to_string(), root.join("kafka_2.13-3.8.0\\logs")),
        ("nginx".to_string(), root.join("nginx-1.27.1\\logs")),
        (
            "mongo".to_string(),
            root.join("mongodb-win32-x86_64-windows-7.0.14\\log"),
        ),
        ("postgres".to_string(), root.join("pgsql\\data\\log")),
        (
            "rabbitmq".to_string(),
            root.join("rabbitmq_server-3.13.7\\var\\log"),
        ),
        ("redis".to_string(), root.join("redis")),
        ("wincs".to_string(), root.join("wincs")),
        ("wingo".to_string(), root.join("wingo")),
    ];

    let mut sources = Vec::new();
    for (display_name, path) in candidates {
        if !path.exists() || !path.is_dir() {
            continue;
        }

        let mut file_count = 0usize;
        let mut total_bytes = 0u64;
        let mut newest: Option<SystemTime> = None;

        for entry in WalkDir::new(&path)
            .follow_links(false)
            .into_iter()
            .filter_map(|entry| entry.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            if !is_log_candidate(entry.path()) {
                continue;
            }

            let Ok(meta) = entry.metadata() else {
                continue;
            };
            file_count += 1;
            total_bytes = total_bytes.saturating_add(meta.len());
            if let Ok(modified) = meta.modified() {
                newest = match newest {
                    Some(current) if current >= modified => Some(current),
                    _ => Some(modified),
                };
            }
        }

        sources.push(SourceSummary {
            name: display_name,
            path,
            file_count,
            total_bytes,
            newest,
        });
    }

    if let Ok(meta) = std::fs::metadata(root.join("erl_crash.dump")) {
        sources.push(SourceSummary {
            name: "crash-dump".to_string(),
            path: root.to_path_buf(),
            file_count: 1,
            total_bytes: meta.len(),
            newest: meta.modified().ok(),
        });
    }

    sources.sort_by(|a, b| {
        b.total_bytes
            .cmp(&a.total_bytes)
            .then_with(|| b.file_count.cmp(&a.file_count))
            .then_with(|| a.name.cmp(&b.name))
    });
    sources
}

fn list_files_for_source(source: &SourceSummary) -> Vec<FileEntry> {
    if source.name == "crash-dump" {
        let path = source.path.join("erl_crash.dump");
        if path.exists()
            && let Ok(meta) = std::fs::metadata(&path)
        {
            return vec![FileEntry {
                source_name: source.name.clone(),
                full_path: path,
                display_name: "erl_crash.dump".to_string(),
                size: meta.len(),
                modified: meta.modified().ok(),
            }];
        }
        return Vec::new();
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(&source.path)
        .follow_links(false)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        if !is_log_candidate(entry.path()) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        let full_path = entry.path().to_path_buf();
        let display_name = full_path
            .strip_prefix(&source.path)
            .ok()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|| full_path.display().to_string());
        files.push(FileEntry {
            source_name: source.name.clone(),
            full_path,
            display_name,
            size: meta.len(),
            modified: meta.modified().ok(),
        });
    }

    files.sort_by(|a, b| {
        compare_mtime_desc(a.modified, b.modified)
            .then_with(|| b.size.cmp(&a.size))
            .then_with(|| a.display_name.cmp(&b.display_name))
    });
    files
}

fn compare_mtime_desc(a: Option<SystemTime>, b: Option<SystemTime>) -> Ordering {
    match (a, b) {
        (Some(left), Some(right)) => right.cmp(&left),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

#[derive(Debug, Clone)]
struct FollowCandidate {
    path: PathBuf,
    modified: Option<SystemTime>,
}

#[derive(Debug, Default)]
struct FollowUpdate {
    lines: Vec<String>,
    truncated: bool,
    skipped_head: bool,
}

fn collect_follow_candidates(source_name: &str, source_path: &Path) -> Vec<FollowCandidate> {
    if source_name == "crash-dump" {
        let dump_path = source_path.join("erl_crash.dump");
        if let Ok(meta) = std::fs::metadata(&dump_path) {
            return vec![FollowCandidate {
                path: dump_path,
                modified: meta.modified().ok(),
            }];
        }
        return Vec::new();
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(source_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        if !is_log_candidate(entry.path()) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        files.push(FollowCandidate {
            path: entry.path().to_path_buf(),
            modified: meta.modified().ok(),
        });
    }
    files
}

fn pick_active_follow_files(
    mut candidates: Vec<FollowCandidate>,
    recent_window: Duration,
    limit: usize,
) -> Vec<PathBuf> {
    candidates.sort_by(|a, b| {
        compare_mtime_desc(a.modified, b.modified).then_with(|| a.path.cmp(&b.path))
    });

    let now = SystemTime::now();
    let mut recent: Vec<PathBuf> = candidates
        .iter()
        .filter_map(|item| {
            let modified = item.modified?;
            let age = now.duration_since(modified).ok()?;
            if age <= recent_window {
                Some(item.path.clone())
            } else {
                None
            }
        })
        .take(limit)
        .collect();

    if recent.is_empty() {
        recent = candidates
            .into_iter()
            .take(limit)
            .map(|item| item.path)
            .collect();
    }

    recent
}

fn read_new_lines_since(path: &Path, offset: &mut u64, max_bytes: u64) -> io::Result<FollowUpdate> {
    let mut file = File::open(path)?;
    let len = file.metadata()?.len();
    let mut update = FollowUpdate::default();
    if len < *offset {
        *offset = 0;
        update.truncated = true;
    }

    let mut start = *offset;
    if len.saturating_sub(start) > max_bytes {
        start = len.saturating_sub(max_bytes);
        update.skipped_head = true;
    }

    file.seek(SeekFrom::Start(start))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    *offset = len;

    if bytes.is_empty() {
        return Ok(update);
    }

    let mut text = String::from_utf8_lossy(&bytes).replace('\r', "");
    if start > 0
        && let Some(newline_pos) = text.find('\n')
    {
        text = text[(newline_pos + 1)..].to_string();
    }
    update.lines = text.lines().map(ToOwned::to_owned).collect();
    Ok(update)
}

fn short_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("?")
        .to_string()
}

fn is_log_candidate(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_lowercase())
        .unwrap_or_default();

    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase());

    if matches!(
        ext.as_deref(),
        Some("log" | "json" | "ndjson" | "out" | "err" | "pid" | "trace")
    ) {
        return true;
    }

    if ext.is_none()
        && (file_name.contains("log")
            || file_name.contains("stderr")
            || file_name.contains("stdout"))
    {
        return true;
    }

    false
}

fn read_tail_lines(path: &Path, max_lines: usize, max_bytes: u64) -> io::Result<Vec<String>> {
    let mut file = File::open(path)?;
    let size = file.metadata()?.len();
    let start = size.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;

    let mut text = String::from_utf8_lossy(&bytes).replace('\r', "");
    if start > 0
        && let Some(newline_pos) = text.find('\n')
    {
        text = text[(newline_pos + 1)..].to_string();
    }

    let mut lines: Vec<String> = text.lines().map(ToOwned::to_owned).collect();
    if lines.len() > max_lines {
        let keep_start = lines.len().saturating_sub(max_lines);
        lines = lines.split_off(keep_start);
    }
    Ok(lines)
}

fn format_bytes(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let b = bytes as f64;

    if b >= GB {
        format!("{:.2} GB", b / GB)
    } else if b >= MB {
        format!("{:.2} MB", b / MB)
    } else if b >= KB {
        format!("{:.2} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

fn format_time(time: Option<SystemTime>) -> String {
    match time {
        Some(ts) => {
            let dt: DateTime<Local> = DateTime::<Local>::from(ts);
            dt.format("%Y-%m-%d %H:%M:%S").to_string()
        }
        None => "-".to_string(),
    }
}

fn run_app(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>, app: &mut App) -> Result<()> {
    while !app.should_quit {
        app.maybe_tick_live_follow();
        terminal.draw(|frame| render(frame, app))?;
        if event::poll(std::time::Duration::from_millis(250))?
            && let Event::Key(key) = event::read()?
        {
            app.on_key(key);
        }
    }
    Ok(())
}

fn render(frame: &mut Frame, app: &mut App) {
    let outer = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(8),
            Constraint::Length(3),
        ])
        .split(frame.area());

    let header = Paragraph::new(vec![
        Line::from(vec![
            "Log Management TUI ".into(),
            format!("| root: {}", app.root.display()).yellow(),
        ]),
        Line::from(vec![
            app.live_follow_label().green(),
            " | ".into(),
            app.status.clone().into(),
        ]),
    ])
    .block(Block::default().borders(Borders::ALL).title("Overview"));
    frame.render_widget(header, outer[0]);

    let body = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(28),
            Constraint::Percentage(34),
            Constraint::Percentage(38),
        ])
        .split(outer[1]);

    render_sources(frame, app, body[0]);
    render_files(frame, app, body[1]);
    render_preview(frame, app, body[2]);

    let footer = Paragraph::new(
        "q quit | f live follow on/off | Tab cycle pane | r rescan | Enter load preview | arrows/jk navigate | PgUp/PgDn scroll",
    )
        .block(Block::default().borders(Borders::ALL).title("Keys"));
    frame.render_widget(footer, outer[2]);
}

fn render_sources(frame: &mut Frame, app: &mut App, area: Rect) {
    let focused = app.focus == FocusPane::Sources;
    let title = if focused {
        "Sources (focused)"
    } else {
        "Sources"
    };

    let items: Vec<ListItem> = app
        .sources
        .iter()
        .map(|source| {
            let line1 = Line::from(vec![
                source.name.clone().bold(),
                "  ".into(),
                format_bytes(source.total_bytes).cyan(),
            ]);
            let line2 = Line::from(format!(
                "{} files | newest {}",
                source.file_count,
                format_time(source.newest)
            ));
            ListItem::new(vec![line1, line2])
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title(title))
        .highlight_style(Style::default().bg(Color::Blue).fg(Color::White))
        .highlight_symbol(">> ");

    frame.render_stateful_widget(list, area, &mut app.source_state);
}

fn render_files(frame: &mut Frame, app: &mut App, area: Rect) {
    let focused = app.focus == FocusPane::Files;
    let title = if focused { "Files (focused)" } else { "Files" };

    let items: Vec<ListItem> = app
        .files
        .iter()
        .map(|file| {
            let line1 = Line::from(vec![
                file.display_name.clone().into(),
                "  ".into(),
                format_bytes(file.size).green(),
            ]);
            let line2 = Line::from(format!(
                "{} | {}",
                file.source_name,
                format_time(file.modified)
            ));
            ListItem::new(vec![line1, line2])
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title(title))
        .highlight_style(Style::default().bg(Color::DarkGray).fg(Color::Yellow))
        .highlight_symbol(">> ");

    frame.render_stateful_widget(list, area, &mut app.file_state);
}

fn render_preview(frame: &mut Frame, app: &mut App, area: Rect) {
    let focused = app.focus == FocusPane::Preview;
    let mut title = if focused {
        "Preview (focused)".to_string()
    } else {
        "Preview".to_string()
    };
    if app.live_follow_enabled {
        title = format!("{} | LIVE", title);
    }
    if let Some(file) = app.selected_file() {
        title = format!(
            "{} | {} | {}",
            title,
            file.full_path.display(),
            format_bytes(file.size)
        );
    }

    let text = Text::from(
        app.preview_lines
            .iter()
            .map(|line| Line::from(line.clone()))
            .collect::<Vec<_>>(),
    );
    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title(title))
        .scroll((app.preview_scroll as u16, 0))
        .wrap(Wrap { trim: false });
    frame.render_widget(paragraph, area);
}

fn main() -> Result<()> {
    let root = std::env::current_dir()?;
    let mut app = App::new(root);

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let run_result = run_app(&mut terminal, &mut app);

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    run_result
}
