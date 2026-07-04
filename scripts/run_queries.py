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
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from bd2_common import ensure_parent, mongo_collection, parse_datetime_to_utc, utc_now


def append_metric(path: Path, metric: dict[str, Any]) -> None:
    ensure_parent(path)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(metric, ensure_ascii=False, separators=(",", ":")))
        f.write("\n")


def print_summary(result: Any, limit: int) -> None:
    if isinstance(result, list):
        print(json.dumps(result[:limit], ensure_ascii=False, indent=2))
        if len(result) > limit:
            print(f"... {len(result) - limit} registros omitidos")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))


def count_and_sample(cursor, limit: int) -> dict[str, Any]:
    sample = []
    count = 0
    for doc in cursor:
        count += 1
        if len(sample) < limit:
            doc.pop("_id", None)
            sample.append(doc)
    return {"total": count, "sample": sample}


def parse_date_boundary(value: str, end: bool = False) -> str:
    parsed = parse_datetime_to_utc(value)
    if parsed:
        if end and len(value) == 10:
            dt = datetime.fromisoformat(parsed.replace("Z", "+00:00")) + timedelta(days=1) - timedelta(seconds=1)
            return dt.isoformat().replace("+00:00", "Z")
        return parsed
    raise ValueError(f"Data inválida: {value}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Executa consultas obrigatórias no MongoDB.")
    parser.add_argument("--query", required=True, choices=["insert", "tipo", "periodo", "raio", "gravidade", "stats-tipo", "stats-bairro", "stats-dia"])
    parser.add_argument("--tipo")
    parser.add_argument("--inicio")
    parser.add_argument("--fim")
    parser.add_argument("--lat", type=float)
    parser.add_argument("--lon", type=float)
    parser.add_argument("--km", type=float, default=5.0)
    parser.add_argument("--min", dest="gravidade_min", type=int, default=3)
    parser.add_argument("--evento-json", help="JSON com evento para --query insert")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--db", default="bd2")
    parser.add_argument("--collection", default="eventos")
    parser.add_argument("--metrics", default="data/processed/query_metrics.jsonl")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    client, collection = mongo_collection(args.db, args.collection)
    client.admin.command("ping")

    start = time.perf_counter()
    if args.query == "insert":
        if not args.evento_json:
            raise SystemExit("--evento-json é obrigatório para --query insert")
        event = json.loads(args.evento_json)
        inserted = collection.insert_one(event)
        result = {"inserted_id": str(inserted.inserted_id)}
    elif args.query == "tipo":
        if not args.tipo:
            raise SystemExit("--tipo é obrigatório")
        result = count_and_sample(collection.find({"tipo": args.tipo}, {"_id": 0}), args.limit)
    elif args.query == "periodo":
        if not args.inicio or not args.fim:
            raise SystemExit("--inicio e --fim são obrigatórios")
        result = count_and_sample(
            collection.find({"dataHora": {"$gte": parse_date_boundary(args.inicio), "$lte": parse_date_boundary(args.fim, end=True)}}, {"_id": 0}),
            args.limit,
        )
    elif args.query == "raio":
        if args.lat is None or args.lon is None:
            raise SystemExit("--lat e --lon são obrigatórios")
        result = count_and_sample(
            collection.find(
                {
                    "localizacao": {
                        "$near": {
                            "$geometry": {"type": "Point", "coordinates": [args.lon, args.lat]},
                            "$maxDistance": args.km * 1000,
                        }
                    }
                },
                {"_id": 0},
            ),
            args.limit,
        )
    elif args.query == "gravidade":
        result = count_and_sample(collection.find({"gravidade": {"$gte": args.gravidade_min}}, {"_id": 0}), args.limit)
    elif args.query == "stats-tipo":
        result = list(collection.aggregate([{"$group": {"_id": "$tipo", "total": {"$sum": 1}}}, {"$sort": {"total": -1}}]))
    elif args.query == "stats-bairro":
        result = list(collection.aggregate([{"$group": {"_id": "$bairro", "total": {"$sum": 1}}}, {"$sort": {"total": -1}}, {"$limit": 50}]))
    else:
        result = list(
            collection.aggregate(
                [
                    {"$group": {"_id": {"$substr": ["$dataHora", 0, 10]}, "total": {"$sum": 1}}},
                    {"$sort": {"_id": 1}},
                    {"$limit": 100},
                ]
            )
        )

    elapsed = time.perf_counter() - start
    metric = {
        "generated_at": utc_now(),
        "query": args.query,
        "seconds": elapsed,
        "result_count": result.get("total") if isinstance(result, dict) and "total" in result else len(result) if isinstance(result, list) else 1,
        "params": {k: v for k, v in vars(args).items() if k not in {"evento_json"}},
    }
    append_metric(Path(args.metrics), metric)
    print_summary(result, args.limit)
    logging.info("Consulta %s executada em %.3fs", args.query, elapsed)
    client.close()


if __name__ == "__main__":
    main()
