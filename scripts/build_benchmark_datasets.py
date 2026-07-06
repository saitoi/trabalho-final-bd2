#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# ///
from __future__ import annotations

import argparse
import json
import logging
import random
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from bd2_common import CANONICAL_TYPES, ensure_parent, iter_jsonl, utc_now, write_json


DEFAULT_SIZES = [1000, 50000, 100000]


def priority(event: dict[str, Any]) -> int:
    if event.get("cidade") == "Rio de Janeiro" and event.get("pais") == "Brasil":
        return 0
    if event.get("pais") == "Brasil":
        return 1
    return 2


def load_events(path: Path) -> list[dict[str, Any]]:
    events = [event for _, event in iter_jsonl(path)]
    events.sort(key=lambda e: (priority(e), e.get("tipo") or "", e.get("idEvento") or ""))
    return events


def balanced_sample(events: list[dict[str, Any]], size: int, seed: int) -> list[dict[str, Any]]:
    """Sample `size` events preserving each type's share of the full corpus.

    A flat per-type quota would flatten a deliberately organic/disproportionate type
    distribution back to near-uniform on small tiers, so quotas are proportional to
    each type's actual weight in `events`, not split evenly across CANONICAL_TYPES.
    """
    rng = random.Random(seed + size)
    by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        by_type[event.get("tipo", "Outro")].append(event)
    for bucket in by_type.values():
        rng.shuffle(bucket)

    total = len(events)
    quotas: dict[str, int] = {}
    for tipo in CANONICAL_TYPES:
        bucket_len = len(by_type.get(tipo, []))
        share = bucket_len / total if total else 0
        quotas[tipo] = min(bucket_len, round(share * size))

    types_by_bucket_size = sorted(CANONICAL_TYPES, key=lambda t: len(by_type.get(t, [])), reverse=True)
    diff = size - sum(quotas.values())
    guard = 0
    while diff != 0 and types_by_bucket_size and guard < 10 * size:
        tipo = types_by_bucket_size[guard % len(types_by_bucket_size)]
        bucket_len = len(by_type.get(tipo, []))
        if diff > 0 and quotas[tipo] < bucket_len:
            quotas[tipo] += 1
            diff -= 1
        elif diff < 0 and quotas[tipo] > 0:
            quotas[tipo] -= 1
            diff += 1
        guard += 1

    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    for tipo in CANONICAL_TYPES:
        bucket = by_type.get(tipo, [])
        for event in bucket[: quotas[tipo]]:
            selected.append(event)
            selected_ids.add(event["idEvento"])

    if len(selected) < size:
        remaining = [event for event in events if event["idEvento"] not in selected_ids]
        needed = size - len(selected)
        selected.extend(remaining[:needed])

    if len(selected) < size:
        raise RuntimeError(f"Dataset insuficiente: pediu {size}, disponível {len(selected)}")

    rng.shuffle(selected)
    return selected[:size]


def write_jsonl(path: Path, events: list[dict[str, Any]]) -> None:
    ensure_parent(path)
    with path.open("w", encoding="utf-8") as f:
        for event in events:
            f.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")))
            f.write("\n")


def write_balanced_sample(path: Path, events: list[dict[str, Any]], per_type: int = 10) -> None:
    ensure_parent(path)
    sample: list[dict[str, Any]] = []
    counts = Counter()
    for event in sorted(events, key=lambda e: (priority(e), e.get("tipo") or "", e.get("idEvento") or "")):
        tipo = event.get("tipo")
        if counts[tipo] >= per_type:
            continue
        sample.append(event)
        counts[tipo] += 1
    with path.open("w", encoding="utf-8") as f:
        json.dump(sample, f, ensure_ascii=False, indent=2)
        f.write("\n")


def describe(events: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "total": len(events),
        "by_type": dict(Counter(e.get("tipo") for e in events)),
        "by_source": dict(Counter((e.get("origem") or {}).get("fonte") for e in events)),
        "by_country": dict(Counter(e.get("pais") for e in events)),
        "rio_de_janeiro": sum(1 for e in events if e.get("cidade") == "Rio de Janeiro" and e.get("pais") == "Brasil"),
        "brasil": sum(1 for e in events if e.get("pais") == "Brasil"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera recortes determinísticos de benchmark.")
    parser.add_argument("--input", default="data/processed/events_normalized.jsonl")
    parser.add_argument("--out-dir", default="data/processed/benchmarks")
    parser.add_argument("--samples-dir", default="data/samples")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--sizes", default="1000,50000,100000", help="Lista separada por vírgula. Padrão: 1000,50000,100000")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    events = load_events(Path(args.input))
    out_dir = Path(args.out_dir)
    summary = {"generated_at": utc_now(), "input": args.input, "seed": args.seed, "datasets": {}}
    sizes = [int(part.strip()) for part in args.sizes.split(",") if part.strip()]
    if not sizes:
        sizes = DEFAULT_SIZES
    for size in sizes:
        sample = balanced_sample(events, size, args.seed)
        path = out_dir / f"events_{size}.jsonl"
        write_jsonl(path, sample)
        summary["datasets"][str(size)] = {"path": str(path), **describe(sample)}
        logging.info("Gerado %s com %s eventos", path, size)
        if size == 1000:
            write_balanced_sample(Path(args.samples_dir) / "events_balanced_sample.json", sample)
    write_json(out_dir / "summary.json", summary)


if __name__ == "__main__":
    main()
