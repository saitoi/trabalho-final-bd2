#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "pymongo>=4.10.1",
# ]
# ///
from __future__ import annotations

import argparse
import csv
import json
import logging
import subprocess
import time
from pathlib import Path
from typing import Any

from bd2_common import ensure_parent, mongo_collection, utc_now, write_json
from create_indexes import INDEXES


def load_jsonl(collection, path: Path, batch_size: int) -> tuple[int, float]:
    total = 0
    batch: list[dict[str, Any]] = []
    start = time.perf_counter()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            batch.append(json.loads(line))
            if len(batch) >= batch_size:
                collection.insert_many(batch, ordered=False)
                total += len(batch)
                batch.clear()
    if batch:
        collection.insert_many(batch, ordered=False)
        total += len(batch)
    return total, time.perf_counter() - start


def timed_count(collection, query: dict[str, Any]) -> tuple[int, float]:
    start = time.perf_counter()
    count = collection.count_documents(query)
    return count, time.perf_counter() - start


def timed_find_count(collection, query: dict[str, Any]) -> tuple[int, float]:
    start = time.perf_counter()
    count = sum(1 for _ in collection.find(query, {"_id": 1}))
    return count, time.perf_counter() - start


def timed_aggregate(collection, pipeline: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], float]:
    start = time.perf_counter()
    result = list(collection.aggregate(pipeline))
    return result, time.perf_counter() - start


def docker(cmd: list[str], compose_file: str) -> None:
    subprocess.run(["docker", "compose", "-f", compose_file, *cmd], check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Executa experimentos de inserção, consulta e falha de nó.")
    parser.add_argument("--bench-dir", default="dataset/processed/benchmarks")
    parser.add_argument("--out-dir", default="dataset/processed/experiments")
    parser.add_argument("--db", default="bd2")
    parser.add_argument("--collection", default="eventos")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--compose-file", default="docker/docker-compose.yml")
    parser.add_argument("--skip-failure", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    client, collection = mongo_collection(args.db, args.collection)
    client.admin.command("ping")

    results: list[dict[str, Any]] = []
    for size in [1000, 50000, 100000]:
        dataset = Path(args.bench_dir) / f"events_{size}.jsonl"
        collection.drop()
        for name, keys in INDEXES:
            collection.create_index(keys, name=name)
        inserted, insert_seconds = load_jsonl(collection, dataset, args.batch_size)
        logging.info("Dataset %s: inseridos %s em %.3fs", size, inserted, insert_seconds)
        results.append({"test": "insert", "size": size, "seconds": insert_seconds, "count": inserted})

        for label, query in [
            ("tipo_incendio", {"tipo": "Incêndio"}),
            ("periodo_2025", {"dataHora": {"$gte": "2025-01-01T00:00:00Z", "$lte": "2025-12-31T23:59:59Z"}}),
            (
                "raio_centro_rj",
                {
                    "localizacao": {
                        "$near": {
                            "$geometry": {"type": "Point", "coordinates": [-43.1729, -22.9068]},
                            "$maxDistance": 5000,
                        }
                    }
                },
            ),
        ]:
            if label == "raio_centro_rj":
                count, seconds = timed_find_count(collection, query)
            else:
                count, seconds = timed_count(collection, query)
            results.append({"test": label, "size": size, "seconds": seconds, "count": count})

    failure = {"skipped": args.skip_failure}
    if not args.skip_failure:
        before, before_seconds = timed_aggregate(collection, [{"$group": {"_id": "$tipo", "total": {"$sum": 1}}}, {"$sort": {"_id": 1}}])
        docker(["stop", "mongo2"], args.compose_file)
        time.sleep(5)
        after, after_seconds = timed_aggregate(collection, [{"$group": {"_id": "$tipo", "total": {"$sum": 1}}}, {"$sort": {"_id": 1}}])
        docker(["start", "mongo2"], args.compose_file)
        recovery_start = time.perf_counter()
        time.sleep(5)
        client.admin.command("ping")
        recovery_seconds = time.perf_counter() - recovery_start
        failure = {
            "skipped": False,
            "before_seconds": before_seconds,
            "after_seconds": after_seconds,
            "consistent": before == after,
            "before": before,
            "after": after,
            "recovery_seconds": recovery_seconds,
        }
        results.append({"test": "failure_before", "size": 100000, "seconds": before_seconds, "count": sum(x["total"] for x in before)})
        results.append({"test": "failure_after", "size": 100000, "seconds": after_seconds, "count": sum(x["total"] for x in after)})

    out_dir = Path(args.out_dir)
    ensure_parent(out_dir / "results.json")
    payload = {"generated_at": utc_now(), "results": results, "failure": failure}
    write_json(out_dir / "results.json", payload)
    with (out_dir / "results.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["test", "size", "seconds", "count"])
        writer.writeheader()
        writer.writerows(results)
    logging.info("Resultados salvos em %s", out_dir)
    client.close()


if __name__ == "__main__":
    main()
