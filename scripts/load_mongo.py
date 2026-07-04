#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "pymongo>=4.10.1",
# ]
# ///
from __future__ import annotations

import argparse
import json
import logging
import time
from pathlib import Path
from typing import Any

from bd2_common import ensure_parent, mongo_collection, utc_now


def iter_dataset(path: Path):
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def append_metric(path: Path, metric: dict[str, Any]) -> None:
    ensure_parent(path)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(metric, ensure_ascii=False, separators=(",", ":")))
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Carrega JSONL normalizado no MongoDB.")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--drop", action="store_true")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--db", default="bd2")
    parser.add_argument("--collection", default="eventos")
    parser.add_argument("--metrics", default="data/processed/load_results.jsonl")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    client, collection = mongo_collection(args.db, args.collection)
    client.admin.command("ping")

    if args.drop:
        logging.info("Limpando coleção %s.%s", args.db, args.collection)
        collection.drop()

    total = 0
    batch: list[dict[str, Any]] = []
    start = time.perf_counter()
    for event in iter_dataset(Path(args.dataset)):
        batch.append(event)
        if len(batch) >= args.batch_size:
            collection.insert_many(batch, ordered=False)
            total += len(batch)
            batch.clear()
    if batch:
        collection.insert_many(batch, ordered=False)
        total += len(batch)

    elapsed = time.perf_counter() - start
    metric = {
        "generated_at": utc_now(),
        "dataset": args.dataset,
        "db": args.db,
        "collection": args.collection,
        "drop": args.drop,
        "batch_size": args.batch_size,
        "inserted": total,
        "seconds": elapsed,
        "records_per_second": total / elapsed if elapsed else None,
    }
    append_metric(Path(args.metrics), metric)
    logging.info("Inseridos %s registros em %.3fs", total, elapsed)
    client.close()


if __name__ == "__main__":
    main()
