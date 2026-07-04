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

from bd2_common import mongo_client


def main() -> None:
    parser = argparse.ArgumentParser(description="Aguarda MongoDB replica set ficar disponível.")
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    deadline = time.time() + args.timeout
    last_error = None
    while time.time() < deadline:
        client = mongo_client()
        try:
            client.admin.command("ping")
            status = client.admin.command("replSetGetStatus")
            logging.info("MongoDB disponível. Replica set: %s membros", len(status.get("members", [])))
            client.close()
            return
        except Exception as exc:
            last_error = exc
            client.close()
            time.sleep(2)
    raise SystemExit(f"MongoDB não ficou disponível em {args.timeout}s: {last_error}")


if __name__ == "__main__":
    main()
