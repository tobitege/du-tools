from __future__ import annotations
# pyright: reportMissingImports=false

import atexit
import json
import math
import random
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from rich.text import Text
from textual import events
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.css.query import NoMatches
from textual.widgets import Button, Checkbox, Footer, Header, Input, Label, RichLog, Static, TabbedContent, TabPane, TextArea


class TelemetryTui(App[None]):
    BINDINGS = [
        Binding("ctrl+w", "quit", "Quit", priority=True),
        Binding("ctrl+v", "paste_clipboard", "Paste"),
        Binding("ctrl+c", "copy_clipboard", "Copy"),
        Binding("ctrl+insert", "copy_clipboard", "Copy", show=False),
        Binding("shift+insert", "paste_clipboard", "Paste", show=False),
        Binding("ctrl+x", "cut_clipboard", "Cut"),
        Binding("r", "refresh_view", "Refresh"),
        Binding("s", "start_tracking", "Start"),
        Binding("x", "stop_tracking", "Stop"),
        Binding("f7", "sidebar_narrower", "Sidebar -"),
        Binding("f8", "sidebar_wider", "Sidebar +"),
        Binding("ctrl+left", "sidebar_narrower", show=False),
        Binding("ctrl+right", "sidebar_wider", show=False),
        Binding("ctrl+up", "scroll_log_up", "Log Up"),
        Binding("ctrl+down", "scroll_log_down", "Log Down"),
        Binding("ctrl+pageup", "scroll_log_page_up", "Log PgUp"),
        Binding("ctrl+pagedown", "scroll_log_page_down", "Log PgDn"),
        Binding("ctrl+home", "scroll_log_home", "Log Top"),
        Binding("ctrl+end", "scroll_log_end", "Log End"),
    ]

    CSS = """
    Screen {
        layout: vertical;
    }

    #main {
        height: 1fr;
    }

    #left {
        width: 54;
        min-width: 36;
        border: heavy $panel;
        padding: 1;
    }

    #right {
        width: 1fr;
        border: heavy $panel;
        padding: 1;
    }

    .row {
        height: auto;
        margin-bottom: 1;
        align: left middle;
    }

    .row_text {
        width: 1fr;
        height: auto;
    }

    .lbl {
        width: 12;
        height: 3;
        content-align: left middle;
    }

    .inp {
        width: 1fr;
    }

    #db_sink {
        width: 12;
    }

    #construct_id {
        width: 17;
        min-width: 17;
        max-width: 17;
    }

    #interval_ms,
    #player_id,
    #summary_interval {
        width: 12;
        min-width: 12;
        max-width: 12;
    }

    #controls {
        height: auto;
        margin-top: 1;
        margin-bottom: 1;
    }

    #left_tabs {
        height: 1fr;
    }

    #run_state_badge {
        border: round white;
        padding: 0 1;
        margin-top: 1;
        height: 3;
    }

    #run_state_badge.active {
        border: round green;
    }

    #run_state_badge.inactive {
        border: round white;
    }

    #btn_toggle_tracking {
        width: 1fr;
    }

    #btn_fl_toggle_session,
    #btn_fl_test {
        width: 1fr;
    }

    #flightlogger_state_badge {
        border: round white;
        padding: 0 1;
        margin-top: 1;
        height: 3;
    }

    #flightlogger_state_badge.active {
        border: round green;
    }

    #flightlogger_state_badge.inactive {
        border: round white;
    }

    #rig_server_badge,
    #rig_sync_badge {
        border: none;
        padding: 0;
        margin-top: 0;
        height: 1;
    }

    .rig_btn_row {
        height: auto;
        margin-bottom: 1;
    }

    .rig_btn {
        width: 1fr;
    }

    #rig_status_box {
        border: none;
        padding: 0;
        margin-top: 0;
        height: auto;
        text-wrap: wrap;
    }

    #status_box {
        border: round white;
        padding: 1;
        margin-top: 1;
        height: 7;
    }

    #status_box.status-running {
        border: round green;
    }

    #status_box.status-inactive {
        border: round white;
    }

    #latest_box {
        border: round $panel-lighten-1;
        padding: 1;
        height: 1fr;
    }

    #process_log,
    #rig_log {
        height: 1fr;
        border: round $panel-lighten-1;
    }
    """

    def __init__(self) -> None:
        super().__init__()
        self.process: subprocess.Popen[str] | None = None
        self.rig_process: subprocess.Popen[str] | None = None
        self.sync_process: subprocess.Popen[str] | None = None
        self.output_path: Path | None = None
        self.output_append_mode = False
        self.flightlogger_session_active = False
        self.sample_count = 0
        self.tail_offset = 0
        self.last_payload: dict[str, Any] | None = None
        self._reader_thread: threading.Thread | None = None
        self._rig_reader_thread: threading.Thread | None = None
        self._sync_reader_thread: threading.Thread | None = None
        self._rig_command_thread: threading.Thread | None = None
        self._active_rig_command_proc: subprocess.Popen[str] | None = None
        self._active_rig_command_lock = threading.Lock()
        self._rig_command_cancel_event = threading.Event()
        self._rig_command_running = False
        self._active_rig_check_label = ""
        self._shutdown_lock = threading.Lock()
        self._shutdown_done = False
        self._build_warning_preview_per_code = 2

        self.repo_root = Path(__file__).resolve().parent.parent
        self.tools_root = Path(__file__).resolve().parent
        self.tests_root = self.repo_root / "tests"
        self.server_root = Path("D:/MyDUserver")
        self.stream_script = self.repo_root / "Scripts" / "stream-physics-telemetry.ps1"
        self.rig_script = self.tools_root / "lua-editor-rig.ps1"
        self.sync_script = self.tools_root / "sync-ide.ps1"
        self.default_output_dir = Path("D:/MyDUserver/tmp")
        self.default_output_filename_template = "physics-telemetry-tui-{date}-{time}.ndjson"
        self.gameplay_base_url = "http://127.0.0.1:10111"
        self.flightlogger_mod_name = "NQ.FlightLogger"
        self.flightlogger_mod_dll_path = self.server_root / "wincs" / "all" / "Mods" / "ModFlightLogger.dll"
        self.flightlogger_init_log = self.server_root / "logs" / "Grains_dev.log"
        self.flightlogger_preflight_ok_until = 0.0
        self.left_width = 54
        self.left_width_min = 36
        self.left_width_max = 90
        self.ui_state_path = Path(__file__).resolve().parent / ".telemetry_tui_state.json"
        self._load_ui_state()
        try:
            atexit.register(self._shutdown_subprocesses)
        except Exception:
            pass

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="main"):
            with Vertical(id="left"):
                with TabbedContent(id="left_tabs"):
                    with TabPane("Telemetry", id="tab_telemetry"):
                        yield Label("Telemetry Control", classes="row")
                        with Horizontal(classes="row"):
                            yield Label("Construct", classes="lbl")
                            yield Input(value="1000061", id="construct_id", classes="inp")
                        with Horizontal(classes="row"):
                            yield Label("Interval", classes="lbl")
                            yield Input(value="200", id="interval_ms", classes="inp")
                        with Horizontal(id="controls"):
                            yield Button("Start Tracking", id="btn_toggle_tracking", variant="success")
                        yield Static("Status: stopped", id="status_box")
                        yield Static("Telemetry Stream: STOPPED", id="run_state_badge")
                    with TabPane("FlightLogger", id="tab_flightlogger"):
                        yield Static("FlightLogger", classes="row row_text")
                        yield Static(
                            "Purpose: send FlightLogger mod actions and preview latest telemetry sample.",
                            classes="row row_text",
                        )
                        yield Static(
                            "Requires: myDU server online + ModFlightLogger installed and loaded on this server.",
                            classes="row row_text",
                        )
                        with Horizontal(classes="row"):
                            yield Label("Player ID", classes="lbl")
                            yield Input(value="10000", id="player_id", classes="inp")
                        with Horizontal(classes="row"):
                            yield Label("Chat summary N", classes="lbl")
                            yield Input(value="1", id="summary_interval", classes="inp")
                        yield Static("Posts a summary to chat every N telemetry samples (1 = every sample).", classes="row row_text")
                        yield Static("1) Start/Stop the FlightLogger session for this construct.", classes="row row_text")
                        yield Static("2) Send one test telemetry sample to FlightLogger.", classes="row row_text")
                        with Horizontal(classes="row"):
                            yield Button("1) Start Logging Session", id="btn_fl_toggle_session", variant="success")
                        with Horizontal(classes="row"):
                            yield Button("2) Send One Test Sample", id="btn_fl_test", variant="primary")
                        yield Static("FlightLogger Session: STOPPED", id="flightlogger_state_badge")
                    with TabPane("Settings", id="tab_settings"):
                        yield Label("Telemetry Settings", classes="row")
                        with Horizontal(classes="row"):
                            yield Label("Log path", classes="lbl")
                            yield Input(value=str(self.default_output_dir), id="output_dir", classes="inp")
                        with Horizontal(classes="row"):
                            yield Label("Filename tpl", classes="lbl")
                            yield Input(
                                value=self.default_output_filename_template,
                                id="output_filename_template",
                                classes="inp",
                            )
                        with Horizontal(classes="row"):
                            yield Label("DB sink", classes="lbl")
                            yield Checkbox(value=False, id="db_sink")
                        with Horizontal(classes="row"):
                            yield Label("DB table", classes="lbl")
                            yield Input(value="external_physics_telemetry", id="db_table", classes="inp")
                        with Horizontal(classes="row"):
                            yield Label("Gameplay", classes="lbl")
                            yield Input(value=self.gameplay_base_url, id="gameplay_url", classes="inp")
                    with TabPane("UI Rig", id="tab_ui_rig"):
                        yield Static("Lua Editor Rig Command Center", classes="row row_text")
                        yield Static("Start/stop local rig server and sync watcher, run build and tests.", classes="row row_text")
                        with Horizontal(classes="row"):
                            yield Label("Dump dir", classes="lbl")
                            yield Input(value="D:/MyDUserver/tmp/ui-dumps", id="rig_dump_dir", classes="inp")
                        with Horizontal(classes="row"):
                            yield Label("Port", classes="lbl")
                            yield Input(value="8765", id="rig_port", classes="inp")
                        with Horizontal(classes="row"):
                            yield Label("Player ID", classes="lbl")
                            yield Input(value="10000", id="rig_player_id", classes="inp")
                        with Horizontal(classes="row"):
                            yield Label("IDE Path", classes="lbl")
                            yield Input(value="cursor", id="rig_ide_path", classes="inp")
                        with Horizontal(classes="row rig_btn_row"):
                            yield Button("Start Rig Server", id="btn_rig_toggle_server", variant="success", classes="rig_btn")
                            yield Button("Start Sync Watcher", id="btn_rig_toggle_sync", variant="success", classes="rig_btn")
                        with Horizontal(classes="row rig_btn_row"):
                            yield Button("Open Browser", id="btn_rig_open_browser", variant="primary", classes="rig_btn")
                            yield Button("Build Mod", id="btn_rig_build", variant="primary", classes="rig_btn")
                        with Horizontal(classes="row rig_btn_row"):
                            yield Button("Run Sync Tests", id="btn_rig_test_sync", variant="primary", classes="rig_btn")
                            yield Button("Run Rig Test", id="btn_rig_test_rig", variant="primary", classes="rig_btn")
                        yield Static("Rig Server: STOPPED", id="rig_server_badge")
                        yield Static("Sync Watcher: STOPPED", id="rig_sync_badge")
                        yield Static("Rig: IDLE | Server: stopped | Sync: stopped", id="rig_status_box")
            with Vertical(id="right"):
                with TabbedContent(id="right_tabs"):
                    with TabPane("Latest", id="tab_latest"):
                        yield Static("No samples yet.", id="latest_box")
                    with TabPane("Telemetry Log", id="tab_log"):
                        yield RichLog(id="process_log", wrap=False, highlight=True, markup=False)
                    with TabPane("UI Rig Log", id="tab_rig_log"):
                        yield TextArea(
                            "",
                            id="rig_log",
                            read_only=True,
                            soft_wrap=True,
                            show_line_numbers=False,
                            show_cursor=False,
                            highlight_cursor_line=False,
                        )
        yield Footer()

    def on_mount(self) -> None:
        self.set_interval(0.5, self._tick)
        self._apply_left_width()
        self._update_tracking_button()
        self._update_run_state_badge()
        self._update_flightlogger_state_badge()
        self._update_rig_server_badge()
        self._update_rig_sync_badge()
        self._set_rig_status("inactive", "idle")
        self._refresh_rig_controls_state()
        self._set_status("stopped")

    def on_key(self, event: events.Key) -> None:
        if event.key == "ctrl+w":
            self.action_quit()
            event.stop()
            return

    def action_quit(self) -> None:
        self._shutdown_subprocesses()
        self.exit()

    def on_tabbed_content_tab_activated(self, event: TabbedContent.TabActivated) -> None:
        if event.tabbed_content.id != "left_tabs":
            return
        if event.pane.id != "tab_ui_rig":
            return
        try:
            right_tabs = self.query_one("#right_tabs", TabbedContent)
        except NoMatches:
            return
        right_tabs.active = "tab_rig_log"

    def action_start_tracking(self) -> None:
        self._start_tracking()

    def action_stop_tracking(self) -> None:
        self._stop_tracking()

    def action_toggle_tracking(self) -> None:
        self._toggle_tracking()

    def action_sidebar_narrower(self) -> None:
        self._set_left_width(self.left_width - 2)

    def action_sidebar_wider(self) -> None:
        self._set_left_width(self.left_width + 2)

    def action_refresh_view(self) -> None:
        self._tick()
        state = "running" if (self.process is not None and self.process.poll() is None) else "stopped"
        self._set_status(state, "Manual refresh complete.")

    def action_paste_clipboard(self) -> None:
        focused = self.focused
        if isinstance(focused, TextArea):
            self._set_status("warning", "Rig log is read-only.")
            return
        box = self._focused_input()
        if box is None:
            self._set_status("warning", "Focus an input field before paste.")
            return
        text = self._read_windows_clipboard()
        if not text:
            self._set_status("warning", "Clipboard is empty or unavailable.")
            return
        try:
            box.insert(text)
        except Exception:
            box.value = box.value + text

    def action_copy_clipboard(self) -> None:
        focused = self.focused
        if isinstance(focused, TextArea):
            text = focused.selected_text or focused.text or ""
            if not text:
                self._set_status("warning", "Nothing to copy.")
                return
            if not self._write_windows_clipboard(text):
                self._set_status("error", "Copy failed: clipboard unavailable.")
                return
            self._set_status("running", f"Copied {len(text)} chars to clipboard.")
            return

        box = self._focused_input()
        if box is None:
            self._set_status("warning", "Focus an input field before copy.")
            return
        text = box.selected_text or box.value or ""
        if not text:
            self._set_status("warning", "Nothing to copy.")
            return
        if not self._write_windows_clipboard(text):
            self._set_status("error", "Copy failed: clipboard unavailable.")
            return
        self._set_status("running", f"Copied {len(text)} chars to clipboard.")

    def action_cut_clipboard(self) -> None:
        focused = self.focused
        if isinstance(focused, TextArea):
            self._set_status("warning", "Rig log is read-only.")
            return

        box = self._focused_input()
        if box is None:
            self._set_status("warning", "Focus an input field before cut.")
            return
        selected = box.selected_text or ""
        selection = box.selection
        if selected:
            if not self._write_windows_clipboard(selected):
                self._set_status("error", "Cut failed: clipboard unavailable.")
                return
            box.delete(selection.start, selection.end)
            self._set_status("running", f"Cut {len(selected)} chars.")
            return

        text = box.value or ""
        if not text:
            self._set_status("warning", "Nothing to cut.")
            return
        if not self._write_windows_clipboard(text):
            self._set_status("error", "Cut failed: clipboard unavailable.")
            return
        box.value = ""
        self._set_status("running", f"Cut {len(text)} chars.")

    def action_scroll_log_up(self) -> None:
        self._scroll_log(-1)

    def action_scroll_log_down(self) -> None:
        self._scroll_log(1)

    def action_scroll_log_page_up(self) -> None:
        self._scroll_log(-10)

    def action_scroll_log_page_down(self) -> None:
        self._scroll_log(10)

    def action_scroll_log_home(self) -> None:
        widget = self._active_log_widget()
        if widget is None:
            return
        widget.scroll_home(animate=False)

    def action_scroll_log_end(self) -> None:
        widget = self._active_log_widget()
        if widget is None:
            return
        widget.scroll_end(animate=False)

    def action_flight_start_session(self) -> None:
        try:
            summary_interval = self._parse_uint(
                self.query_one("#summary_interval", Input).value.strip(),
                "Chat summary interval (N telemetry samples)",
            )
            self._send_flightlogger_action(4, str(summary_interval))
            self._send_flightlogger_action(2, "")
            self.flightlogger_session_active = True
            self._update_flightlogger_state_badge()
            self._set_status(
                "running",
                f"FlightLogger session started (chat summary every {summary_interval} samples).",
            )
        except Exception as exc:
            self._set_status("error", str(exc))

    def action_flight_send_test_telemetry(self) -> None:
        try:
            payload = self._build_flightlogger_test_payload()
            self._send_flightlogger_action(1000000, payload)
            self._record_flightlogger_sample(payload)
            self._set_status("running", "FlightLogger test telemetry sent.")
        except Exception as exc:
            self._set_status("error", str(exc))

    def action_flight_stop_session(self) -> None:
        try:
            self._send_flightlogger_action(3, "")
            self.flightlogger_session_active = False
            self._update_flightlogger_state_badge()
            self._set_status("running", "FlightLogger session stopped.")
        except Exception as exc:
            self._set_status("error", str(exc))

    def action_toggle_flightlogger_session(self) -> None:
        self._toggle_flightlogger_session()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn_toggle_tracking":
            self._toggle_tracking()
            return
        if event.button.id == "btn_fl_toggle_session":
            self._toggle_flightlogger_session()
            return
        if event.button.id == "btn_fl_test":
            self.action_flight_send_test_telemetry()
            return
        if event.button.id == "btn_rig_toggle_server":
            self._toggle_rig_server()
            return
        if event.button.id == "btn_rig_toggle_sync":
            self._toggle_sync_watcher()
            return
        if event.button.id == "btn_rig_open_browser":
            self._open_rig_browser()
            return
        if event.button.id == "btn_rig_build":
            self._run_build()
            return
        if event.button.id == "btn_rig_test_sync":
            self._run_sync_tests()
            return
        if event.button.id == "btn_rig_test_rig":
            self._run_rig_test()
            return

    def _set_status(self, state: str, extra: str = "") -> None:
        try:
            status = self.query_one("#status_box", Static)
            construct = self.query_one("#construct_id", Input).value.strip()
            interval = self.query_one("#interval_ms", Input).value.strip()
        except NoMatches:
            return
        status_key = "running" if self._is_tracking_active() else "inactive"
        self._apply_status_class(status, status_key)

        color = "green" if status_key == "running" else "white"
        telemetry_state = "ACTIVE" if status_key == "running" else "STOPPED"

        line = Text()
        line.append("Telemetry: ", style="bold")
        line.append(telemetry_state, style=f"bold {color}")
        line.append(f"\nConstruct: {construct}")
        line.append(f"\nInterval ms: {interval}")
        line.append(f"\nSamples: {self.sample_count}")
        if state.strip().lower() not in ("running", "stopped"):
            line.append(f"\nEvent: {state.upper()}")
        if self.output_path is not None:
            line.append(f"\nOutput: {self.output_path}")
        if extra:
            line.append(f"\n{extra}")
        status.update(line)
        self._update_tracking_button()
        self._update_run_state_badge()

    def _is_tracking_active(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def _apply_status_class(self, status: Static, status_key: str) -> None:
        status.remove_class("status-running")
        status.remove_class("status-inactive")
        status.add_class(f"status-{status_key}")

    def _update_tracking_button(self) -> None:
        try:
            button = self.query_one("#btn_toggle_tracking", Button)
        except NoMatches:
            return
        if self._is_tracking_active():
            button.label = "Stop Tracking"
            button.variant = "error"
        else:
            button.label = "Start Tracking"
            button.variant = "success"

    def _update_run_state_badge(self) -> None:
        try:
            badge = self.query_one("#run_state_badge", Static)
        except NoMatches:
            return
        badge.remove_class("active")
        badge.remove_class("inactive")
        if self._is_tracking_active():
            badge.add_class("active")
            badge.update(Text("Telemetry Stream: ACTIVE", style="bold green"))
        else:
            badge.add_class("inactive")
            badge.update(Text("Telemetry Stream: STOPPED", style="bold white"))

    def _toggle_tracking(self) -> None:
        if self._is_tracking_active():
            self._stop_tracking()
            return
        self._start_tracking()

    def _update_flightlogger_state_badge(self) -> None:
        try:
            badge = self.query_one("#flightlogger_state_badge", Static)
        except NoMatches:
            return
        badge.remove_class("active")
        badge.remove_class("inactive")
        if self.flightlogger_session_active:
            badge.add_class("active")
            badge.update(Text("FlightLogger Session: ACTIVE", style="bold green"))
        else:
            badge.add_class("inactive")
            badge.update(Text("FlightLogger Session: STOPPED", style="bold white"))
        self._update_flightlogger_toggle_button()

    def _update_flightlogger_toggle_button(self) -> None:
        try:
            button = self.query_one("#btn_fl_toggle_session", Button)
        except NoMatches:
            return
        if self.flightlogger_session_active:
            button.label = "1) Stop Logging Session"
            button.variant = "error"
        else:
            button.label = "1) Start Logging Session"
            button.variant = "success"

    def _toggle_flightlogger_session(self) -> None:
        if self.flightlogger_session_active:
            self.action_flight_stop_session()
            return
        self.action_flight_start_session()

    def _record_flightlogger_sample(self, payload_json: str) -> None:
        try:
            payload = json.loads(payload_json)
        except json.JSONDecodeError:
            return

        position_payload = payload.get("position") if isinstance(payload.get("position"), dict) else {}
        velocity_payload = payload.get("velocity") if isinstance(payload.get("velocity"), dict) else {}
        angular_payload = payload.get("angularVelocity") if isinstance(payload.get("angularVelocity"), dict) else {}
        orientation_payload = payload.get("orientation") if isinstance(payload.get("orientation"), dict) else {}

        altitude = self._coerce_number(payload.get("altitude"), 0.0)
        pos_x = self._coerce_number(position_payload.get("x"), 0.0)
        pos_y = self._coerce_number(position_payload.get("y"), 0.0)
        pos_z = self._coerce_number(position_payload.get("z"), altitude)

        vel_x = self._coerce_number(velocity_payload.get("x"), 0.0)
        vel_y = self._coerce_number(velocity_payload.get("y"), 0.0)
        vel_z = self._coerce_number(velocity_payload.get("z"), 0.0)

        ang_x = self._coerce_number(angular_payload.get("x"), 0.0)
        ang_y = self._coerce_number(angular_payload.get("y"), 0.0)
        ang_z = self._coerce_number(angular_payload.get("z"), 0.0)

        rot_x = self._coerce_number(orientation_payload.get("x"), 0.0)
        rot_y = self._coerce_number(orientation_payload.get("y"), 0.0)
        rot_z = self._coerce_number(orientation_payload.get("z"), 0.0)
        rot_w = self._coerce_number(orientation_payload.get("w"), 1.0)

        speed = self._coerce_number(payload.get("speed"), math.sqrt((vel_x * vel_x) + (vel_y * vel_y) + (vel_z * vel_z)))
        heading = self._coerce_number(payload.get("heading"), (math.degrees(math.atan2(vel_y, vel_x)) + 360.0) % 360.0)
        mass = self._coerce_number(payload.get("mass"), 0.0)

        now_utc = datetime.utcnow().strftime("%H:%M:%S")
        self.last_payload = {
            "sample_time_utc": now_utc,
            "constructSpeed": speed,
            "constructMass": mass,
            "constructHeading": heading,
            "constructPosition": {"x": pos_x, "y": pos_y, "z": pos_z},
            "worldVelocity": {"x": vel_x, "y": vel_y, "z": vel_z},
            "worldAngularVelocity": {"x": ang_x, "y": ang_y, "z": ang_z},
            "constructRotation": {"x": rot_x, "y": rot_y, "z": rot_z, "w": rot_w},
        }
        self.sample_count += 1
        self._refresh_latest_box()

    def _append_process_log(self, text: str) -> None:
        if not text:
            return
        try:
            self.query_one("#process_log", RichLog).write(self._timestamped_log_text(text))
        except NoMatches:
            return

    def _append_rig_log(self, text: str) -> None:
        if not text:
            return
        try:
            rig_log = self.query_one("#rig_log", TextArea)
        except NoMatches:
            return
        line = self._timestamped_log_text(text)
        if not line:
            return
        was_at_bottom = rig_log.scroll_y >= (rig_log.max_scroll_y - 1)
        if rig_log.text:
            last_line_index = rig_log.document.line_count - 1
            end_location = (last_line_index, len(rig_log.document.get_line(last_line_index)))
            rig_log.insert("\n" + line, location=end_location, maintain_selection_offset=True)
        else:
            rig_log.insert(line, location=(0, 0), maintain_selection_offset=True)
        if was_at_bottom:
            rig_log.scroll_end(animate=False)

    def _append_log(self, text: str) -> None:
        self._append_process_log(text)

    def _timestamped_log_text(self, text: str) -> str:
        line = str(text).strip()
        if not line:
            return ""
        return f"[{datetime.now().strftime('%H:%M:%S')}] {line}"

    def _set_rig_status(self, state: str, extra: str = "") -> None:
        try:
            status = self.query_one("#rig_status_box", Static)
        except NoMatches:
            return

        status_key = "running" if (
            self._is_proc_running(self.rig_process)
            or self._is_proc_running(self.sync_process)
            or self._rig_command_running
        ) else "inactive"

        summary = Text()
        summary.append("Rig: ", style="bold")
        summary.append("ACTIVE" if status_key == "running" else "IDLE", style=f"bold {'green' if status_key == 'running' else 'white'}")
        summary.append(f" | Server: {'running' if self._is_proc_running(self.rig_process) else 'stopped'}")
        summary.append(f" | Sync: {'running' if self._is_proc_running(self.sync_process) else 'stopped'}")
        if self._rig_command_running:
            check_label = self._active_rig_check_label or "command"
            summary.append("\nChecks running, please wait...", style="bold yellow")
            summary.append(f" ({check_label})", style="yellow")
        extra_text = str(extra).strip()
        if extra_text and (not self._rig_command_running):
            compact = re.sub(r"\s+", " ", extra_text)
            summary.append(f"\n{compact}")
        status.update(summary)

    def _is_proc_running(self, proc: subprocess.Popen[str] | None) -> bool:
        return proc is not None and proc.poll() is None

    def _set_widget_disabled(self, selector: str, disabled: bool) -> None:
        try:
            widget = self.query_one(selector)
        except NoMatches:
            return
        widget.disabled = disabled

    def _kill_process_tree(self, pid: int) -> bool:
        if pid <= 0:
            return False
        try:
            if sys.platform.startswith("win"):
                result = subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                )
                return result.returncode == 0
        except Exception:
            return False
        return False

    def _terminate_process(self, proc: subprocess.Popen[str] | None, timeout_seconds: float = 2.0) -> None:
        if proc is None:
            return
        if proc.poll() is not None:
            return
        try:
            proc.terminate()
        except Exception:
            pass
        try:
            proc.wait(timeout=timeout_seconds)
            return
        except subprocess.TimeoutExpired:
            pass
        self._kill_process_tree(proc.pid)
        try:
            proc.wait(timeout=1)
            return
        except subprocess.TimeoutExpired:
            pass
        try:
            proc.kill()
        except Exception:
            pass
        try:
            proc.wait(timeout=1)
        except Exception:
            return

    def _shutdown_subprocesses(self) -> None:
        with self._shutdown_lock:
            if self._shutdown_done:
                return
            self._shutdown_done = True

        self._rig_command_cancel_event.set()
        self._stop_active_rig_command()
        self._stop_tracking(update_ui=False)
        self._stop_sync_watcher(update_ui=False)
        self._stop_rig_server(update_ui=False)

    def _set_active_rig_command_proc(self, proc: subprocess.Popen[str] | None) -> None:
        with self._active_rig_command_lock:
            self._active_rig_command_proc = proc

    def _stop_active_rig_command(self) -> None:
        with self._active_rig_command_lock:
            proc = self._active_rig_command_proc
        self._terminate_process(proc)
        with self._active_rig_command_lock:
            if self._active_rig_command_proc is proc:
                self._active_rig_command_proc = None

    def _refresh_rig_controls_state(self) -> None:
        rig_running = self._is_proc_running(self.rig_process)
        sync_running = self._is_proc_running(self.sync_process)
        checks_running = self._rig_command_running
        rig_or_sync_running = rig_running or sync_running
        lock_rig_config = rig_or_sync_running or checks_running
        tests_blocked = rig_or_sync_running or checks_running

        for selector in ("#rig_dump_dir", "#rig_port", "#rig_player_id", "#rig_ide_path"):
            self._set_widget_disabled(selector, lock_rig_config)

        self._set_widget_disabled("#btn_rig_toggle_server", checks_running)
        self._set_widget_disabled("#btn_rig_toggle_sync", checks_running or (not rig_running and not sync_running))
        self._set_widget_disabled("#btn_rig_open_browser", checks_running or (not rig_running))
        self._set_widget_disabled("#btn_rig_build", checks_running)
        self._set_widget_disabled("#btn_rig_test_sync", tests_blocked)
        self._set_widget_disabled("#btn_rig_test_rig", tests_blocked)

    def _set_rig_command_running(self, running: bool) -> None:
        self._rig_command_running = running
        self._refresh_rig_controls_state()

    def _set_active_rig_check_label(self, label: str) -> None:
        self._active_rig_check_label = str(label).strip()

    def _can_run_rig_checks(self) -> bool:
        return (not self._rig_command_running) and (not self._is_proc_running(self.rig_process)) and (not self._is_proc_running(self.sync_process))

    def _parse_port(self, value: str, field_name: str = "Port") -> int:
        text = value.strip()
        if not text or not text.isdigit():
            raise ValueError(f"{field_name} must be numeric.")
        parsed = int(text)
        if parsed <= 0 or parsed > 65535:
            raise ValueError(f"{field_name} must be between 1 and 65535.")
        return parsed

    def _update_rig_server_badge(self) -> None:
        try:
            badge = self.query_one("#rig_server_badge", Static)
            button = self.query_one("#btn_rig_toggle_server", Button)
        except NoMatches:
            return
        badge.remove_class("active")
        badge.remove_class("inactive")
        if self._is_proc_running(self.rig_process):
            badge.add_class("active")
            badge.update(Text("Rig Server: ACTIVE", style="bold green"))
            button.label = "Stop Rig Server"
            button.variant = "error"
        else:
            badge.add_class("inactive")
            badge.update(Text("Rig Server: STOPPED", style="bold white"))
            button.label = "Start Rig Server"
            button.variant = "success"
        self._refresh_rig_controls_state()

    def _update_rig_sync_badge(self) -> None:
        try:
            badge = self.query_one("#rig_sync_badge", Static)
            button = self.query_one("#btn_rig_toggle_sync", Button)
        except NoMatches:
            return
        badge.remove_class("active")
        badge.remove_class("inactive")
        if self._is_proc_running(self.sync_process):
            badge.add_class("active")
            badge.update(Text("Sync Watcher: ACTIVE", style="bold green"))
            button.label = "Stop Sync Watcher"
            button.variant = "error"
        else:
            badge.add_class("inactive")
            badge.update(Text("Sync Watcher: STOPPED", style="bold white"))
            button.label = "Start Sync Watcher"
            button.variant = "success"
        self._refresh_rig_controls_state()

    def _toggle_rig_server(self) -> None:
        if self._rig_command_running:
            self._set_rig_status("warning", "Wait for running checks to finish before toggling rig server.")
            return
        if self._is_proc_running(self.rig_process):
            self._stop_rig_server()
            return
        self._start_rig_server()

    def _toggle_sync_watcher(self) -> None:
        if self._rig_command_running:
            self._set_rig_status("warning", "Wait for running checks to finish before toggling sync watcher.")
            return
        if self._is_proc_running(self.sync_process):
            self._stop_sync_watcher()
            return
        self._start_sync_watcher()

    def _spawn_reader(self, proc: subprocess.Popen[str], prefix: str, sink: Callable[[str], None]) -> threading.Thread:
        def _read_output() -> None:
            if proc.stdout is None:
                return
            for raw_line in proc.stdout:
                line = raw_line.rstrip()
                if not line:
                    continue
                self.call_from_thread(sink, f"[{prefix}] {line}")

        t = threading.Thread(target=_read_output, daemon=True)
        t.start()
        return t

    def _start_rig_server(self) -> None:
        if self._rig_command_running:
            self._set_rig_status("warning", "Cannot start rig server while checks are running.")
            return
        if self._is_proc_running(self.rig_process):
            self._set_rig_status("running", "Rig server already running.")
            return
        if not self.rig_script.exists():
            self._set_rig_status("error", f"Rig script missing: {self.rig_script}")
            return

        try:
            dump_dir = self.query_one("#rig_dump_dir", Input).value.strip()
            port = self._parse_port(self.query_one("#rig_port", Input).value.strip(), "Rig port")
            player_id = self._parse_uint(self.query_one("#rig_player_id", Input).value.strip(), "Rig player ID")
            if not dump_dir:
                raise ValueError("Dump dir is required.")
            Path(dump_dir).mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            self._set_rig_status("error", str(exc))
            return

        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(self.rig_script),
            "-DumpDir",
            dump_dir,
            "-Port",
            str(port),
            "-PlayerId",
            str(player_id),
        ]
        self.rig_process = subprocess.Popen(
            command,
            cwd=str(self.tools_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        self._rig_reader_thread = self._spawn_reader(self.rig_process, "RIG", self._append_rig_log)
        self._append_rig_log(f"[RIG] Started on http://localhost:{port}/ (DumpDir: {dump_dir})")
        self._update_rig_server_badge()
        self._set_rig_status("running", "Rig server started.")

    def _stop_rig_server(self, update_ui: bool = True) -> None:
        if self._is_proc_running(self.sync_process):
            self._append_rig_log("[SYNC] Stopping because rig server is stopping.")
            self._stop_sync_watcher(update_ui=False)
        proc = self.rig_process
        if proc is None:
            if update_ui:
                self._update_rig_server_badge()
                self._update_rig_sync_badge()
                self._set_rig_status("inactive", "Rig server already stopped.")
            return
        if proc.poll() is not None:
            self.rig_process = None
            if update_ui:
                self._update_rig_server_badge()
                self._update_rig_sync_badge()
                self._set_rig_status("inactive", "Rig server already stopped.")
            return
        self._terminate_process(proc)
        self.rig_process = None
        if update_ui:
            self._append_rig_log("[RIG] Stopped.")
            self._update_rig_server_badge()
            self._update_rig_sync_badge()
            self._set_rig_status("inactive", "Rig server stopped.")

    def _start_sync_watcher(self) -> None:
        if self._rig_command_running:
            self._set_rig_status("warning", "Cannot start sync watcher while checks are running.")
            return
        if self._is_proc_running(self.sync_process):
            self._set_rig_status("running", "Sync watcher already running.")
            return
        if not self._is_proc_running(self.rig_process):
            self._set_rig_status("warning", "Start rig server before starting sync watcher.")
            return
        if not self.sync_script.exists():
            self._set_rig_status("error", f"Sync script missing: {self.sync_script}")
            return

        try:
            dump_dir = self.query_one("#rig_dump_dir", Input).value.strip()
            ide_path = self.query_one("#rig_ide_path", Input).value.strip()
            if not dump_dir:
                raise ValueError("Dump dir is required.")
        except Exception as exc:
            self._set_rig_status("error", str(exc))
            return

        ndjson_source = str(Path(dump_dir) / "rig-lua-editor.ndjson")

        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(self.sync_script),
            "-DumpDir",
            dump_dir,
            "-IdePath",
            ide_path,
            "-NdjsonFile",
            ndjson_source,
        ]
        self.sync_process = subprocess.Popen(
            command,
            cwd=str(self.tools_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        self._sync_reader_thread = self._spawn_reader(self.sync_process, "SYNC", self._append_rig_log)
        self._append_rig_log("[SYNC] Started.")
        self._append_rig_log(f"[SYNC] Filters: player=auto(from packets), source={ndjson_source}")
        self._append_rig_log("[SYNC] Waiting for first lua_ide_sync packet (click IDE Sync in the browser UI).")
        self._append_rig_log("[SYNC] Note: ACK lines alone do not export to IDE; look for 'Reassembled IDE sync packet ...' entries.")
        self._update_rig_sync_badge()
        self._set_rig_status("running", "Sync watcher started.")

    def _stop_sync_watcher(self, update_ui: bool = True) -> None:
        proc = self.sync_process
        if proc is None:
            if update_ui:
                self._update_rig_sync_badge()
                self._set_rig_status("inactive", "Sync watcher already stopped.")
            return
        if proc.poll() is not None:
            self.sync_process = None
            if update_ui:
                self._update_rig_sync_badge()
                self._set_rig_status("inactive", "Sync watcher already stopped.")
            return
        self._terminate_process(proc)
        self.sync_process = None
        if update_ui:
            self._append_rig_log("[SYNC] Stopped.")
            self._update_rig_sync_badge()
            self._set_rig_status("inactive", "Sync watcher stopped.")

    def _open_rig_browser(self) -> None:
        try:
            port = self._parse_port(self.query_one("#rig_port", Input).value.strip(), "Rig port")
        except Exception as exc:
            self._set_rig_status("error", str(exc))
            return
        url = f"http://localhost:{port}/"
        webbrowser.open(url)
        self._append_rig_log(f"[RIG] Opened browser: {url}")
        self._set_rig_status("running", f"Opened browser at {url}")

    def _powershell_script_command(self, script_name: str) -> tuple[list[str], str, Path]:
        script_path = None
        for candidate in (self.tests_root / script_name, self.tools_root / script_name):
            if candidate.exists():
                script_path = candidate
                break
        if script_path is None:
            raise FileNotFoundError(f"Script missing: {self.tests_root / script_name}")
        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_path),
        ]
        return command, script_name, script_path.parent

    def _extract_build_warning_code(self, line: str) -> str | None:
        match = re.search(r"\b(?:warning|warnung)\s+([A-Z]{2,}\d{3,6})\b", line, re.IGNORECASE)
        if not match:
            return None
        return match.group(1).upper()

    def _is_build_progress_line(self, line: str) -> bool:
        lowered = line.lower()
        if re.search(r"\b(error|fehler)\b", lowered):
            return True
        progress_markers = (
            "determining projects to restore",
            "wiederherzustellende projekte",
            "all projects are up-to-date for restore",
            "alle projekte sind",
            "build succeeded",
            "build failed",
            "time elapsed",
            "verstrichene zeit",
            "error(s)",
            "fehler",
            "warning(s)",
            "warnung(en)",
            "restore completed",
            "wiederherstellung",
            "netsdk",
        )
        return any(marker in lowered for marker in progress_markers)

    def _run_command_sequence_async(self, label: str, steps: list[tuple[str, list[str], Path]]) -> None:
        if self._rig_command_running:
            self._set_rig_status("warning", "A check command is already running.")
            return

        self._rig_command_cancel_event.clear()
        self._set_active_rig_check_label(label)
        self._set_rig_command_running(True)
        self._set_rig_status("running", f"{label} started...")

        def _run() -> None:
            result_state = "running"
            result_message = f"{label} passed."
            try:
                for step_label, command, cwd in steps:
                    if self._rig_command_cancel_event.is_set():
                        result_state = "warning"
                        result_message = f"{label} cancelled."
                        break
                    self.call_from_thread(self._append_rig_log, f"[CMD] {step_label}: {' '.join(command)}")
                    compact_build_output = step_label.upper() == "BUILD"
                    warning_counts: dict[str, int] = {}
                    warning_preview_counts: dict[str, int] = {}
                    suppressed_warning_lines = 0
                    suppressed_other_lines = 0
                    proc = subprocess.Popen(
                        command,
                        cwd=str(cwd),
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        bufsize=1,
                    )
                    self._set_active_rig_command_proc(proc)
                    try:
                        if proc.stdout is not None:
                            for raw_line in proc.stdout:
                                line = raw_line.rstrip()
                                if line:
                                    if compact_build_output:
                                        lowered_line = line.lower()
                                        warning_code = self._extract_build_warning_code(line)
                                        is_warning_line = (
                                            warning_code is not None
                                            or (": warning " in lowered_line)
                                            or (": warnung " in lowered_line)
                                            or (" warning " in lowered_line)
                                            or (" warnung " in lowered_line)
                                        )
                                        if is_warning_line:
                                            warning_key = warning_code or "GENERIC"
                                            warning_counts[warning_key] = warning_counts.get(warning_key, 0) + 1
                                            shown = warning_preview_counts.get(warning_key, 0)
                                            if shown < self._build_warning_preview_per_code:
                                                warning_preview_counts[warning_key] = shown + 1
                                                self.call_from_thread(self._append_rig_log, f"[{step_label}] {line}")
                                            else:
                                                suppressed_warning_lines += 1
                                            continue
                                        if self._is_build_progress_line(line):
                                            self.call_from_thread(self._append_rig_log, f"[{step_label}] {line}")
                                        else:
                                            suppressed_other_lines += 1
                                        continue
                                    self.call_from_thread(self._append_rig_log, f"[{step_label}] {line}")
                        code = proc.wait()
                    finally:
                        self._set_active_rig_command_proc(None)
                    if compact_build_output:
                        total_warnings = sum(warning_counts.values())
                        if total_warnings > 0:
                            ordered_codes = sorted(
                                warning_counts.items(),
                                key=lambda item: (-item[1], item[0]),
                            )
                            code_summary = ", ".join(f"{code_id} x{count}" for code_id, count in ordered_codes)
                            self.call_from_thread(
                                self._append_rig_log,
                                f"[{step_label}] warning summary: {total_warnings} total ({code_summary})",
                            )
                        total_suppressed = suppressed_warning_lines + suppressed_other_lines
                        if total_suppressed > 0:
                            self.call_from_thread(
                                self._append_rig_log,
                                f"[{step_label}] compact view: suppressed {total_suppressed} noisy line(s).",
                            )
                    if self._rig_command_cancel_event.is_set():
                        result_state = "warning"
                        result_message = f"{label} cancelled."
                        break
                    if code != 0:
                        result_state = "error"
                        result_message = f"{step_label} failed (exit {code})."
                        break
            except Exception as exc:
                result_state = "error"
                result_message = f"{label} failed: {exc}"
            finally:
                self.call_from_thread(self._set_active_rig_check_label, "")
                self.call_from_thread(self._set_rig_command_running, False)
                self.call_from_thread(self._set_rig_status, result_state, result_message)

        self._rig_command_thread = threading.Thread(target=_run, daemon=True)
        self._rig_command_thread.start()

    def _run_build(self) -> None:
        steps = [("BUILD", ["dotnet", "build", "-nologo", "-v:minimal"], self.repo_root)]
        self._run_command_sequence_async("Build", steps)

    def _run_sync_tests(self) -> None:
        if not self._can_run_rig_checks():
            self._set_rig_status("warning", "Stop rig server and sync watcher before running sync tests.")
            return
        try:
            steps: list[tuple[str, list[str], Path]] = []
            for script_name in [
                "test-sync-ide.ps1",
                "test-sync-ide-replay.ps1",
                "test-sync-ide-interleaved.ps1",
                "test-sync-ide-no-player-context.ps1",
            ]:
                command, label, cwd = self._powershell_script_command(script_name)
                steps.append((label, command, cwd))
        except Exception as exc:
            self._set_rig_status("error", str(exc))
            return
        self._run_command_sequence_async("Sync tests", steps)

    def _run_rig_test(self) -> None:
        if not self._can_run_rig_checks():
            self._set_rig_status("warning", "Stop rig server and sync watcher before running rig test.")
            return
        try:
            command, label, cwd = self._powershell_script_command("test-lua-editor-rig.ps1")
        except Exception as exc:
            self._set_rig_status("error", str(exc))
            return
        self._run_command_sequence_async("Rig test", [(label, command, cwd)])

    def _run_all_checks(self) -> None:
        if not self._can_run_rig_checks():
            self._set_rig_status("warning", "Stop rig server and sync watcher before running all checks.")
            return
        try:
            steps: list[tuple[str, list[str], Path]] = [("BUILD", ["dotnet", "build", "-nologo", "-v:minimal"], self.repo_root)]
            for script_name in [
                "test-sync-ide.ps1",
                "test-sync-ide-replay.ps1",
                "test-sync-ide-interleaved.ps1",
                "test-sync-ide-no-player-context.ps1",
                "test-lua-editor-rig.ps1",
            ]:
                command, label, cwd = self._powershell_script_command(script_name)
                steps.append((label, command, cwd))
        except Exception as exc:
            self._set_rig_status("error", str(exc))
            return
        self._run_command_sequence_async("All checks", steps)

    def _scroll_log(self, delta: int) -> None:
        widget = self._active_log_widget()
        if widget is None:
            return
        widget.scroll_relative(y=delta, animate=False)

    def _active_log_widget(self) -> RichLog | TextArea | None:
        focused = self.focused
        if isinstance(focused, (RichLog, TextArea)):
            return focused

        active_tab = ""
        try:
            active_tab = self.query_one("#right_tabs", TabbedContent).active or ""
        except NoMatches:
            active_tab = ""

        selectors = ["#process_log", "#rig_log"]
        if active_tab == "tab_rig_log":
            selectors = ["#rig_log", "#process_log"]
        elif active_tab == "tab_log":
            selectors = ["#process_log", "#rig_log"]

        for selector in selectors:
            try:
                widget = self.query_one(selector)
            except NoMatches:
                continue
            if isinstance(widget, (RichLog, TextArea)):
                return widget
        return None

    def _set_left_width(self, requested: int) -> None:
        width = max(self.left_width_min, min(self.left_width_max, requested))
        if width == self.left_width:
            return
        self.left_width = width
        self._save_ui_state()
        self._apply_left_width()
        state = "running" if (self.process is not None and self.process.poll() is None) else "stopped"
        self._set_status(state, f"Sidebar width: {self.left_width}")

    def _apply_left_width(self) -> None:
        try:
            left = self.query_one("#left", Vertical)
            left.styles.width = self.left_width
            left.styles.min_width = self.left_width_min
        except NoMatches:
            return

    def _load_ui_state(self) -> None:
        try:
            if not self.ui_state_path.exists():
                return
            data = json.loads(self.ui_state_path.read_text(encoding="utf-8"))
            width = data.get("sidebar_width")
            if isinstance(width, int):
                self.left_width = max(self.left_width_min, min(self.left_width_max, width))
        except Exception:
            return

    def _save_ui_state(self) -> None:
        try:
            payload = {"sidebar_width": self.left_width}
            self.ui_state_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
        except Exception:
            return

    def _focused_input(self) -> Input | None:
        focused = self.focused
        if isinstance(focused, Input):
            return focused
        return None

    def _build_command(self) -> list[str]:
        construct_id = self.query_one("#construct_id", Input).value.strip()
        interval = self.query_one("#interval_ms", Input).value.strip()
        output_dir_value = self.query_one("#output_dir", Input).value.strip()
        filename_template = self.query_one("#output_filename_template", Input).value.strip()
        use_db_sink = self.query_one("#db_sink", Checkbox).value
        db_table = self.query_one("#db_table", Input).value.strip()

        if not construct_id.isdigit():
            raise ValueError("Construct ID must be numeric.")
        if not interval.isdigit():
            raise ValueError("Interval ms must be numeric.")
        if int(interval) < 50:
            raise ValueError("Interval ms must be >= 50.")
        if not output_dir_value:
            raise ValueError("Log path is required.")
        if not filename_template:
            raise ValueError("Filename template is required.")

        output_dir = Path(output_dir_value)
        output_dir.mkdir(parents=True, exist_ok=True)

        self.output_path = self._resolve_output_path(output_dir, filename_template)
        self.output_append_mode = self.output_path.exists()
        if not self.output_path.exists():
            self.output_path.touch()

        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(self.stream_script),
            "-ConstructId",
            construct_id,
            "-IntervalMs",
            interval,
            "-OutputPath",
            str(self.output_path),
        ]
        if use_db_sink:
            command.extend(["-WriteToDb", "-DbSinkTable", db_table])
        return command

    def _resolve_output_path(self, output_dir: Path, filename_template: str) -> Path:
        template = filename_template.strip()
        now = datetime.now()
        today = now.strftime("%Y%m%d")
        current_time = now.strftime("%H%M%S")

        if "{date}" in template:
            today_pattern = template.replace("{date}", today)
            today_glob = today_pattern.replace("{time}", "*")
            try:
                candidates = [path for path in output_dir.glob(today_glob) if path.is_file()]
            except OSError:
                candidates = []
            if candidates:
                def mtime(path: Path) -> float:
                    try:
                        return path.stat().st_mtime
                    except OSError:
                        return 0.0

                candidates.sort(key=mtime, reverse=True)
                return candidates[0]

        rendered_name = template.replace("{date}", today).replace("{time}", current_time)
        return output_dir / rendered_name

    def _send_flightlogger_action(self, action_id: int, payload: str) -> None:
        player_id = self._parse_uint(self.query_one("#player_id", Input).value.strip(), "Player ID")
        construct_id = self._parse_uint(self.query_one("#construct_id", Input).value.strip(), "Construct ID")
        gameplay_url = self.query_one("#gameplay_url", Input).value.strip()
        if not gameplay_url:
            gameplay_url = self.gameplay_base_url
        self._validate_flightlogger_ready(gameplay_url)
        url = gameplay_url.rstrip("/") + f"/Router/36008/by/{player_id}"

        action_payload = {
            "modName": self.flightlogger_mod_name,
            "actionId": action_id,
            "constructId": construct_id,
            "elementId": 0,
            "playerId": player_id,
            "payload": payload,
        }
        body = json.dumps(action_payload, ensure_ascii=True).encode("utf-8")
        req = urllib.request.Request(
            url=url,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                resp.read()
        except urllib.error.HTTPError as ex:
            body = ex.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Router HTTP {ex.code}: {body}") from ex
        except urllib.error.URLError as ex:
            raise RuntimeError(f"Router connection failed: {ex.reason}") from ex

        action_label = {
            2: "Start logging session",
            3: "Stop logging session",
            4: "Set chat summary frequency",
            1000000: "Send one test telemetry sample",
        }.get(action_id, f"Action {action_id}")
        self._append_log(
            f"FlightLogger: {action_label} (construct {construct_id}, player {player_id})."
        )

    def _validate_flightlogger_ready(self, gameplay_url: str) -> None:
        now = time.time()
        if now < self.flightlogger_preflight_ok_until:
            return
        self._ensure_server_online(gameplay_url)
        self._ensure_mod_installed_and_loaded()
        self.flightlogger_preflight_ok_until = now + 10.0

    def _ensure_server_online(self, gameplay_url: str) -> None:
        probe_url = gameplay_url.rstrip("/") + "/Router"
        req = urllib.request.Request(url=probe_url, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=2) as resp:
                resp.read(1)
        except urllib.error.HTTPError:
            # HTTP response means the server is reachable (even if route returns 404/405).
            return
        except urllib.error.URLError as ex:
            raise RuntimeError(
                f"Server offline/unreachable at {gameplay_url}. Start myDU server first."
            ) from ex

    def _ensure_mod_installed_and_loaded(self) -> None:
        if not self.flightlogger_mod_dll_path.exists():
            raise RuntimeError(
                "ModFlightLogger.dll not found. Install it at "
                f"{self.flightlogger_mod_dll_path} and restart Orleans."
            )
        if self.flightlogger_init_log.exists():
            if not self._tail_file_contains(self.flightlogger_init_log, "FlightLogger mod initialized"):
                raise RuntimeError(
                    "ModFlightLogger.dll exists but no 'FlightLogger mod initialized' found in Orleans log. "
                    "Restart Orleans/server so the mod is loaded."
                )

    def _tail_file_contains(self, file_path: Path, marker: str, max_bytes: int = 4_000_000) -> bool:
        try:
            with file_path.open("rb") as handle:
                handle.seek(0, 2)
                size = handle.tell()
                read_size = min(size, max_bytes)
                handle.seek(-read_size, 2)
                chunk = handle.read(read_size).decode("utf-8", errors="ignore")
                return marker in chunk
        except OSError:
            return False

    def _parse_uint(self, value: str, field_name: str) -> int:
        text = value.strip()
        if not text or not text.isdigit():
            raise ValueError(f"{field_name} must be numeric.")
        parsed = int(text)
        if parsed <= 0:
            raise ValueError(f"{field_name} must be > 0.")
        return parsed

    def _build_flightlogger_test_payload(self) -> str:
        payload = self.last_payload or {}
        speed = self._coerce_number(payload.get("constructSpeed"), 234.5)
        mass = self._coerce_number(payload.get("constructMass"), 54000.0)
        heading = self._coerce_number(payload.get("constructHeading"), 87.0)
        position = payload.get("constructPosition") or {}
        velocity = payload.get("worldVelocity") or {}
        angular_velocity = payload.get("worldAngularVelocity") or {}
        orientation = payload.get("constructRotation") or {}

        pos_x = self._coerce_number(position.get("x"), 0.0)
        pos_y = self._coerce_number(position.get("y"), 0.0)
        altitude = self._coerce_number(position.get("z"), 1111.2)
        vel_x = self._coerce_number(velocity.get("x"), 120.0)
        vel_y = self._coerce_number(velocity.get("y"), 15.0)
        vel_z = self._coerce_number(velocity.get("z"), -2.0)
        ang_x = self._coerce_number(angular_velocity.get("x"), 0.01)
        ang_y = self._coerce_number(angular_velocity.get("y"), 0.02)
        ang_z = self._coerce_number(angular_velocity.get("z"), 0.03)
        rot_x = self._coerce_number(orientation.get("x"), 0.0)
        rot_y = self._coerce_number(orientation.get("y"), 0.0)
        rot_z = self._coerce_number(orientation.get("z"), 0.0)
        rot_w = self._coerce_number(orientation.get("w"), 1.0)

        speed = max(0.0, self._apply_variance(speed, 0.10))
        pos_x = self._apply_variance(pos_x, 0.10)
        pos_y = self._apply_variance(pos_y, 0.10)
        altitude = self._apply_variance(altitude, 0.10)
        mass = max(0.0, self._apply_variance(mass, 0.10))
        heading = int(round(self._apply_variance(heading, 0.10))) % 360
        vel_x = self._apply_variance(vel_x, 0.10)
        vel_y = self._apply_variance(vel_y, 0.10)
        vel_z = self._apply_variance(vel_z, 0.10)
        ang_x = self._apply_variance(ang_x, 0.10)
        ang_y = self._apply_variance(ang_y, 0.10)
        ang_z = self._apply_variance(ang_z, 0.10)
        rot_x = self._apply_variance(rot_x, 0.10)
        rot_y = self._apply_variance(rot_y, 0.10)
        rot_z = self._apply_variance(rot_z, 0.10)
        rot_w = self._apply_variance(rot_w, 0.10)

        # keep quaternion normalized enough for display/debug realism
        norm = math.sqrt((rot_x * rot_x) + (rot_y * rot_y) + (rot_z * rot_z) + (rot_w * rot_w))
        if norm > 0.0:
            rot_x /= norm
            rot_y /= norm
            rot_z /= norm
            rot_w /= norm

        sample = {
            "speed": round(speed, 3),
            "altitude": round(altitude, 3),
            "heading": int(heading),
            "mass": round(mass, 3),
            "position": {
                "x": round(pos_x, 3),
                "y": round(pos_y, 3),
                "z": round(altitude, 3),
            },
            "velocity": {
                "x": round(vel_x, 3),
                "y": round(vel_y, 3),
                "z": round(vel_z, 3),
            },
            "angularVelocity": {
                "x": round(ang_x, 4),
                "y": round(ang_y, 4),
                "z": round(ang_z, 4),
            },
            "orientation": {
                "x": round(rot_x, 5),
                "y": round(rot_y, 5),
                "z": round(rot_z, 5),
                "w": round(rot_w, 5),
            },
        }
        return json.dumps(sample, ensure_ascii=True, separators=(",", ":"))

    def _apply_variance(self, value: float, variance: float) -> float:
        factor = 1.0 + random.uniform(-variance, variance)
        return value * factor

    def _coerce_number(self, value: Any, fallback: float) -> float:
        try:
            if value is None:
                return fallback
            return float(value)
        except (TypeError, ValueError):
            return fallback

    def _read_windows_clipboard(self) -> str:
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode != 0:
                return ""
            return result.stdout
        except Exception:
            return ""

    def _write_windows_clipboard(self, text: str) -> bool:
        try:
            result = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "Set-Clipboard -Value ([Console]::In.ReadToEnd())",
                ],
                input=text,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            return result.returncode == 0
        except Exception:
            return False

    def _start_tracking(self) -> None:
        if self.process is not None and self.process.poll() is None:
            self._set_status("running", "Already running.")
            return

        try:
            command = self._build_command()
        except ValueError as exc:
            self._set_status("error", str(exc))
            return

        self.sample_count = 0
        self.last_payload = None
        self.tail_offset = 0
        if self.output_path is not None and self.output_path.exists():
            self.tail_offset = self.output_path.stat().st_size

        self.process = subprocess.Popen(
            command,
            cwd=str(self.repo_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        self._set_status("running")
        construct_id = self.query_one("#construct_id", Input).value.strip()
        interval = self.query_one("#interval_ms", Input).value.strip()
        output_path = str(self.output_path) if self.output_path is not None else "(not set)"
        self._append_log(f"Telemetry started for construct {construct_id}.")
        self._append_log(f"Sampling every {interval} ms.")
        if self.output_append_mode:
            self._append_log("Appending to today's most recent log file.")
        else:
            self._append_log("Creating a new log file for today.")
        self._append_log(f"Saving samples to: {output_path}")

        self._reader_thread = threading.Thread(target=self._drain_process_output, daemon=True)
        self._reader_thread.start()

    def _drain_process_output(self) -> None:
        proc = self.process
        if proc is None or proc.stdout is None:
            return
        for line in proc.stdout:
            human_line = self._humanize_process_log_line(line.rstrip())
            if human_line:
                self.call_from_thread(self._append_log, human_line)

    def _stop_tracking(self, update_ui: bool = True) -> None:
        proc = self.process
        if proc is None:
            if update_ui:
                self._set_status("stopped")
            return
        if proc.poll() is not None:
            self.process = None
            if update_ui:
                self._set_status("stopped")
            return
        self._terminate_process(proc)
        self.process = None
        if update_ui:
            self._set_status("stopped")
            self._append_log("Telemetry stopped.")

    def _humanize_process_log_line(self, raw_line: str) -> str:
        line = raw_line.strip()
        if not line:
            return ""
        lowered = line.lower()

        if line.startswith("Streaming physics telemetry."):
            return "Telemetry collection is running."
        if line.startswith("Construct:"):
            value = line.split(":", 1)[1].strip()
            return f"Tracking construct: {value}"
        if line.startswith("Output:"):
            value = line.split(":", 1)[1].strip()
            return f"Output file: {value}"
        if line.startswith("Press Ctrl+C"):
            return "Use 'Stop Tracking' to end telemetry."
        if line.startswith("Single-instance lock:"):
            return "Safety check: only one telemetry stream can run at a time."

        sample_match = re.search(r"samples=(\d+)\s+latest_utc=([0-9:]+)", line)
        if sample_match:
            samples = sample_match.group(1)
            latest = sample_match.group(2)
            return f"Captured {samples} samples so far (latest UTC: {latest})."

        if "error" in lowered or "exception" in lowered or "failed" in lowered:
            return f"Script reported an issue: {line}"

        # Hide low-value technical lines by default.
        return ""

    def _tick(self) -> None:
        proc = self.process
        if proc is not None and proc.poll() is not None:
            self._set_status("stopped", f"Process exit code: {proc.returncode}")
            self.process = None

        if self.rig_process is not None and self.rig_process.poll() is not None:
            code = self.rig_process.returncode
            self.rig_process = None
            self._append_rig_log(f"[RIG] Exited with code {code}.")
            if self._is_proc_running(self.sync_process):
                self._append_rig_log("[SYNC] Stopping because rig server exited.")
                self._stop_sync_watcher(update_ui=False)
            self._update_rig_server_badge()
            self._update_rig_sync_badge()
            self._set_rig_status("inactive", f"Rig server exited ({code}).")

        if self.sync_process is not None and self.sync_process.poll() is not None:
            code = self.sync_process.returncode
            self.sync_process = None
            self._append_rig_log(f"[SYNC] Exited with code {code}.")
            self._update_rig_sync_badge()
            self._set_rig_status("inactive", f"Sync watcher exited ({code}).")

        if self.output_path is None or not self.output_path.exists():
            return

        try:
            with self.output_path.open("r", encoding="utf-8", errors="replace") as handle:
                handle.seek(self.tail_offset)
                chunk = handle.read()
                self.tail_offset = handle.tell()
        except OSError as exc:
            self._set_status("error", f"Read failed: {exc}")
            return

        if not chunk:
            return

        for raw_line in chunk.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            self.sample_count += 1
            try:
                self.last_payload = json.loads(line)
            except json.JSONDecodeError:
                continue

        self._refresh_latest_box()
        state = "running" if (self.process is not None and self.process.poll() is None) else "stopped"
        self._set_status(state)

    def _refresh_latest_box(self) -> None:
        try:
            widget = self.query_one("#latest_box", Static)
        except NoMatches:
            return
        if self.last_payload is None:
            widget.update("No samples yet.")
            return

        pos = self.last_payload.get("constructPosition") or {}
        rot = self.last_payload.get("constructRotation") or {}
        vel = self.last_payload.get("worldVelocity") or {}
        ang = self.last_payload.get("worldAngularVelocity") or {}
        sample_time = self.last_payload.get("sample_time_utc") or "n/a"
        speed = self.last_payload.get("constructSpeed")
        mass = self.last_payload.get("constructMass")
        heading = self.last_payload.get("constructHeading")
        if heading is None:
            heading = self.last_payload.get("heading")
        if heading is None:
            vx = self._coerce_number(vel.get("x"), 0.0) if vel.get("x") is not None else None
            vy = self._coerce_number(vel.get("y"), 0.0) if vel.get("y") is not None else None
            if vx is not None and vy is not None:
                heading = (math.degrees(math.atan2(vy, vx)) + 360.0) % 360.0

        def fmt(value: Any, decimals: int = 3) -> str:
            if value is None:
                return "n/a"
            if isinstance(value, (int, float)):
                return f"{float(value):.{decimals}f}"
            try:
                return f"{float(value):.{decimals}f}"
            except (TypeError, ValueError):
                return str(value)

        text = (
            f"Latest sample: {sample_time}\n"
            f"Speed: {fmt(speed)} m/s\n"
            f"Mass: {fmt(mass)} kg\n"
            f"Heading: {fmt(heading, 1)} deg\n"
            f"Position: x={fmt(pos.get('x'))} y={fmt(pos.get('y'))} z={fmt(pos.get('z'))}\n"
            f"Velocity: x={fmt(vel.get('x'))} y={fmt(vel.get('y'))} z={fmt(vel.get('z'))}\n"
            f"Angular Vel: x={fmt(ang.get('x'))} y={fmt(ang.get('y'))} z={fmt(ang.get('z'))}\n"
            f"Orientation: x={fmt(rot.get('x'))} y={fmt(rot.get('y'))} z={fmt(rot.get('z'))} w={fmt(rot.get('w'))}"
        )
        widget.update(text)

    def on_unmount(self) -> None:
        self._save_ui_state()
        self._shutdown_subprocesses()


def main() -> None:
    TelemetryTui().run()


if __name__ == "__main__":
    main()
