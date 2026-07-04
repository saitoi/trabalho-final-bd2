#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "pymongo>=4.10.1",
# ]
# ///
from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path
from typing import Any

from bd2_common import mongo_collection, utc_now, write_json


INDEXES: list[tuple[str, list[tuple[str, Any]]]] = [
    ("localizacao_2dsphere", [("localizacao", "2dsphere")]),
    ("tipo_1", [("tipo", 1)]),
    ("dataHora_1", [("dataHora", 1)]),
    ("gravidade_1", [("gravidade", 1)]),
    ("bairro_1", [("bairro", 1)]),
    ("cidade_1", [("cidade", 1)]),
    ("origem_fonte_idOriginal", [("origem.fonte", 1), ("origem.idOriginal", 1)]),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria índices da coleção eventos.")
    parser.add_argument("--db", default="bd2")
    parser.add_argument("--collection", default="eventos")
    parser.add_argument("--out", default="data/processed/index_report.json")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    client, collection = mongo_collection(args.db, args.collection)
    client.admin.command("ping")

    report = {"generated_at": utc_now(), "db": args.db, "collection": args.collection, "indexes": []}
    for name, keys in INDEXES:
        start = time.perf_counter()
        created = collection.create_index(keys, name=name, background=False)
        elapsed = time.perf_counter() - start
        logging.info("Índice criado: %s em %.3fs", created, elapsed)
        report["indexes"].append({"name": created, "keys": keys, "seconds": elapsed})

    write_json(Path(args.out), report)
    client.close()


if __name__ == "__main__":
    main()
