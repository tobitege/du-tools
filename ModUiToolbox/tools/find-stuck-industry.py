from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


DEFAULT_BRIDGE_DIR = Path(r"D:\MyDUserver\tmp\ui-dumps\mcp-bridge")
DEFAULT_TIMEOUT_MS = 15_000
DEFAULT_POLL_MS = 1_000
DEFAULT_STUCK_SECONDS = 10.0
DEFAULT_END_OF_CYCLE_MS = 1_000
DEFAULT_BATCH_SIZE = 50


@dataclass(frozen=True)
class IndustryElement:
    local_id: int
    label: str
    type_name: str
    industry_family: str | None


@dataclass
class RuntimeSample:
    element: IndustryElement
    available: bool
    state: str | None
    recipe_id: int | None
    units_produced: int | None
    batches_remaining: int | None
    remaining_time: int | None
    current_quantity: float | None
    maintain_quantity: float | None
    current_product_amount: int | None
    maintain_product_amount: int | None

    @property
    def monitor_key(self) -> tuple[Any, ...]:
        return (
            self.state,
            self.recipe_id,
            self.units_produced,
            self.batches_remaining,
            self.remaining_time,
            self.current_product_amount,
            self.maintain_product_amount,
            self.current_quantity,
            self.maintain_quantity,
        )


@dataclass
class CandidateState:
    first_seen_monotonic: float
    last_seen_monotonic: float
    sample: RuntimeSample
    reported: bool = False


class BridgeClient:
    def __init__(self, bridge_dir: Path) -> None:
        self.bridge_dir = bridge_dir
        self.commands_dir = bridge_dir / "commands"
        self.events_dir = bridge_dir / "events"

    def ensure_paths(self) -> None:
        if not self.commands_dir.is_dir():
            raise RuntimeError(f"Commands dir not found: {self.commands_dir}")
        if not self.events_dir.is_dir():
            raise RuntimeError(f"Events dir not found: {self.events_dir}")

    def enqueue_toolbox_ops(self, player_id: int, method: str, probe_args: list[Any]) -> tuple[str, datetime]:
        command_id = str(uuid4())
        created_at = datetime.now(timezone.utc)
        created_at_utc = created_at.isoformat().replace("+00:00", "Z")
        file_name = f"{created_at_utc.replace(':', '-')}-{command_id}.json"
        command_path = self.commands_dir / file_name
        command = {
            "commandId": command_id,
            "createdAtUtc": created_at_utc,
            "playerId": player_id,
            "target": {
                "kind": "toolbox_ops",
                "boardId": None,
            },
            "action": "probe_call",
            "payload": {
                "probeMethod": method,
                "probeArgs": probe_args,
            },
        }
        command_path.write_text(json.dumps(command, ensure_ascii=True, indent=2), encoding="utf-8")
        return command_id, created_at

    def wait_for_toolbox_result(self, command_id: str, created_at: datetime, timeout_ms: int) -> dict[str, Any]:
        deadline = time.monotonic() + (max(timeout_ms, 250) / 1000.0)
        while time.monotonic() <= deadline:
            event = self._find_toolbox_event(command_id, created_at)
            if event is not None:
                payload = event.get("payload")
                if isinstance(payload, dict):
                    payload_json = payload.get("payloadJson")
                    if isinstance(payload_json, str) and payload_json.strip():
                        try:
                            return json.loads(payload_json)
                        except json.JSONDecodeError as exc:
                            raise RuntimeError(f"Invalid payloadJson for {command_id}: {exc}") from exc
                    return payload
                raise RuntimeError(f"toolbox_ops_result for {command_id} had no usable payload")
            time.sleep(0.2)
        raise TimeoutError(f"No toolbox_ops_result for {command_id} within {timeout_ms}ms")

    def toolbox_ops(self, player_id: int, method: str, probe_args: list[Any], timeout_ms: int) -> dict[str, Any]:
        command_id, created_at = self.enqueue_toolbox_ops(player_id, method, probe_args)
        return self.wait_for_toolbox_result(command_id, created_at, timeout_ms)

    def _find_toolbox_event(self, command_id: str, created_at: datetime) -> dict[str, Any] | None:
        date_key = created_at.strftime("%Y%m%d")
        candidates = sorted(
            self.events_dir.glob(f"bridge-events-{date_key}*.ndjson"),
            key=lambda path: path.stat().st_mtime if path.exists() else 0.0,
            reverse=True,
        )
        for event_path in candidates:
            try:
                with event_path.open("r", encoding="utf-8") as handle:
                    for raw_line in handle:
                        line = raw_line.strip()
                        if not line:
                            continue
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        if event.get("type") != "toolbox_ops_result":
                            continue
                        payload = event.get("payload")
                        if not isinstance(payload, dict):
                            continue
                        if payload.get("commandId") == command_id:
                            return event
            except OSError:
                continue
        return None


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(float(text))
        except ValueError:
            return None
    return None


def as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip().replace(",", "")
        if not text:
            return None
        try:
            return float(text)
        except ValueError:
            return None
    return None


def as_text(value: Any) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def require_success(payload: dict[str, Any], method: str) -> dict[str, Any]:
    if payload.get("success") is True:
        return payload
    error = as_text(payload.get("error")) or f"{method} failed"
    raise RuntimeError(error)


def refresh_construct_index(client: BridgeClient, player_id: int, construct_id: int, timeout_ms: int) -> None:
    payload = client.toolbox_ops(player_id, "refresh_construct_index", [{"constructId": construct_id}], timeout_ms)
    require_success(payload, "refresh_construct_index")


def query_industry_elements(
    client: BridgeClient,
    player_id: int,
    construct_id: int,
    timeout_ms: int,
    limit: int,
    exclude_transfer: bool,
) -> list[IndustryElement]:
    payload = client.toolbox_ops(
        player_id,
        "query_construct_index",
        [{
            "constructId": construct_id,
            "category": "industry",
            "limit": limit,
        }],
        timeout_ms,
    )
    require_success(payload, "query_construct_index")
    results = as_list(payload.get("results"))
    elements: list[IndustryElement] = []
    for row in results:
        item = as_dict(row)
        local_id = as_int(item.get("id"))
        if local_id is None:
            continue
        family = as_text(item.get("industryFamily"))
        if exclude_transfer and family == "transfer":
            continue
        label = (
            as_text(item.get("label"))
            or as_text(item.get("name"))
            or as_text(item.get("typeName"))
            or f"Industry {local_id}"
        )
        type_name = as_text(item.get("typeName")) or "unknown"
        elements.append(
            IndustryElement(
                local_id=local_id,
                label=label,
                type_name=type_name,
                industry_family=family,
            )
        )
    return elements


def check_runtime_availability(client: BridgeClient, player_id: int, construct_id: int, timeout_ms: int) -> dict[str, Any]:
    payload = client.toolbox_ops(
        player_id,
        "construct_runtime_availability",
        [{"constructId": construct_id}],
        timeout_ms,
    )
    return require_success(payload, "construct_runtime_availability")


def describe_industry_batch(
    client: BridgeClient,
    player_id: int,
    construct_id: int,
    entries: list[IndustryElement],
    timeout_ms: int,
) -> list[RuntimeSample]:
    payload = client.toolbox_ops(
        player_id,
        "describe_industry_batch",
        [
            {"constructId": construct_id},
            [{"localId": entry.local_id} for entry in entries],
        ],
        timeout_ms,
    )
    error = as_text(payload.get("error"))
    if payload.get("success") is not True and error != "industry_batch_contains_failures":
        require_success(payload, "describe_industry_batch")
    samples: list[RuntimeSample] = []
    by_id = {entry.local_id: entry for entry in entries}
    for raw_result in as_list(payload.get("results")):
        result = as_dict(raw_result)
        if result.get("success") is not True:
            continue
        target = as_dict(result.get("target"))
        target_element = as_dict(target.get("element"))
        state = as_dict(result.get("state"))
        local_id = (
            as_int(target_element.get("localId"))
            or as_int(target_element.get("id"))
            or as_int(target.get("localId"))
            or as_int(target.get("id"))
        )
        if local_id is None:
            continue
        element = by_id.get(local_id)
        if element is None:
            continue
        samples.append(
            RuntimeSample(
                element=element,
                available=state.get("available") is True,
                state=as_text(state.get("state")),
                recipe_id=as_int(state.get("recipeId")),
                units_produced=as_int(state.get("unitsProduced")),
                batches_remaining=as_int(state.get("batchesRemaining")),
                remaining_time=as_int(state.get("remainingTime")),
                current_quantity=as_float(state.get("currentQuantity")),
                maintain_quantity=as_float(state.get("maintainQuantity")),
                current_product_amount=as_int(state.get("currentProductAmount")),
                maintain_product_amount=as_int(state.get("maintainProductAmount")),
            )
        )
    return samples


def should_ignore_target_full(sample: RuntimeSample) -> bool:
    if sample.maintain_quantity is not None and sample.current_quantity is not None:
        if sample.maintain_quantity > 0 and sample.current_quantity >= sample.maintain_quantity:
            return True
    if sample.maintain_product_amount is not None and sample.current_product_amount is not None:
        if sample.maintain_product_amount > 0 and sample.current_product_amount >= sample.maintain_product_amount:
            return True
    return False


def looks_like_end_of_cycle(sample: RuntimeSample, end_of_cycle_ms: int) -> bool:
    if sample.state == "PENDING":
        return True
    if sample.remaining_time is not None and sample.remaining_time <= end_of_cycle_ms:
        return True
    return False


def format_quantity(value: float | None) -> str:
    if value is None:
        return "-"
    if value.is_integer():
        return str(int(value))
    return f"{value:.2f}"


def print_detection(sample: RuntimeSample, duration_s: float) -> None:
    parts = [
        f"[{datetime.now().strftime('%H:%M:%S')}] STUCK",
        f"id={sample.element.local_id}",
        f'label=\"{sample.element.label}\"',
        f"family={sample.element.industry_family or '-'}",
        f"state={sample.state or '-'}",
        f"duration={duration_s:.1f}s",
        f"remainingTime={sample.remaining_time if sample.remaining_time is not None else '-'}",
        f"unitsProduced={sample.units_produced if sample.units_produced is not None else '-'}",
        f"current={format_quantity(sample.current_quantity)}",
        f"maintain={format_quantity(sample.maintain_quantity)}",
    ]
    print(" | ".join(parts), flush=True)


def monitor(args: argparse.Namespace) -> int:
    client = BridgeClient(args.bridge_dir)
    client.ensure_paths()

    availability = check_runtime_availability(client, args.player_id, args.construct_id, args.timeout_ms)
    availability_info = as_dict(availability.get("availability"))
    if availability_info.get("liveIndustryReadsExpected") is not True:
        reason = as_text(availability_info.get("reason")) or "unknown"
        current_construct = as_dict(availability.get("currentConstruct"))
        current_construct_id = as_int(current_construct.get("constructId"))
        print(
            f"Note: construct_runtime_availability says liveIndustryReadsExpected=false "
            f"(reason={reason}, currentConstruct={current_construct_id or '-'}). "
            f"Continuing anyway with explicit constructId={args.construct_id}.",
            flush=True,
        )

    refresh_construct_index(client, args.player_id, args.construct_id, args.timeout_ms)
    elements = query_industry_elements(
        client,
        args.player_id,
        args.construct_id,
        args.timeout_ms,
        args.limit,
        args.exclude_transfer,
    )
    if not elements:
        print("No industry elements found.", flush=True)
        return 0

    print(
        f"Monitoring {len(elements)} industry elements on construct {args.construct_id} "
        f"(poll={args.poll_ms}ms, stuck>{args.stuck_seconds:.1f}s).",
        flush=True,
    )

    candidates: dict[int, CandidateState] = {}

    while True:
        cycle_started = time.monotonic()
        seen_ids: set[int] = set()

        for offset in range(0, len(elements), args.batch_size):
            batch = elements[offset:offset + args.batch_size]
            samples = describe_industry_batch(
                client,
                args.player_id,
                args.construct_id,
                batch,
                args.timeout_ms,
            )
            now = time.monotonic()

            for sample in samples:
                seen_ids.add(sample.element.local_id)
                existing = candidates.get(sample.element.local_id)

                if not sample.available or should_ignore_target_full(sample) or not looks_like_end_of_cycle(sample, args.end_of_cycle_ms):
                    if existing is not None:
                        candidates.pop(sample.element.local_id, None)
                    continue

                if existing is not None and existing.sample.monitor_key == sample.monitor_key:
                    existing.last_seen_monotonic = now
                    existing.sample = sample
                    duration = existing.last_seen_monotonic - existing.first_seen_monotonic
                    if duration >= args.stuck_seconds and not existing.reported:
                        print_detection(sample, duration)
                        existing.reported = True
                else:
                    candidates[sample.element.local_id] = CandidateState(
                        first_seen_monotonic=now,
                        last_seen_monotonic=now,
                        sample=sample,
                    )

        stale_ids = [local_id for local_id in candidates if local_id not in seen_ids]
        for local_id in stale_ids:
            candidates.pop(local_id, None)

        elapsed = time.monotonic() - cycle_started
        sleep_seconds = max(0.0, (args.poll_ms / 1000.0) - elapsed)
        time.sleep(sleep_seconds)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Watch industry runtime through the bridge file bus and report elements that stop changing "
            "near end-of-cycle for longer than the configured threshold."
        )
    )
    parser.add_argument("--player-id", type=int, default=10000, help="Requester player ID.")
    parser.add_argument("--construct-id", type=int, required=True, help="Construct ID to monitor.")
    parser.add_argument("--bridge-dir", type=Path, default=DEFAULT_BRIDGE_DIR, help="mcp-bridge directory.")
    parser.add_argument("--timeout-ms", type=int, default=DEFAULT_TIMEOUT_MS, help="Per bridge command timeout.")
    parser.add_argument("--poll-ms", type=int, default=DEFAULT_POLL_MS, help="Polling interval.")
    parser.add_argument("--stuck-seconds", type=float, default=DEFAULT_STUCK_SECONDS, help="Seconds with unchanged end-of-cycle state before reporting.")
    parser.add_argument("--end-of-cycle-ms", type=int, default=DEFAULT_END_OF_CYCLE_MS, help="Treat RUNNING samples at or below this remainingTime as end-of-cycle.")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Industry batch size per runtime read.")
    parser.add_argument("--limit", type=int, default=500, help="Maximum industry elements fetched from the construct index.")
    parser.add_argument("--exclude-transfer", action="store_true", help="Skip transfer units.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return monitor(args)
    except KeyboardInterrupt:
        print("\nStopped.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
