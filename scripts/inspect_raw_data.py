#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# ///
from __future__ import annotations

import argparse
import csv
import json
import logging
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

from bd2_common import CANONICAL_TYPES, ensure_parent, iter_jsonl, write_json


def sample_jsonl(path: Path, limit: int) -> tuple[int, list[str], list[dict[str, Any]], list[str]]:
    count = 0
    fields: set[str] = set()
    sample: list[dict[str, Any]] = []
    errors: list[str] = []
    try:
        for line_no, record in iter_jsonl(path):
            count += 1
            fields.update(record.keys())
            if len(sample) < limit:
                sample.append(record)
    except Exception as exc:
        errors.append(f"{path}:{line_no if 'line_no' in locals() else '?'}: {exc}")
    return count, sorted(fields), sample, errors


def inspect_csv(path: Path, limit: int) -> tuple[int, list[str], list[dict[str, Any]], list[str]]:
    count = 0
    sample: list[dict[str, Any]] = []
    errors: list[str] = []
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            fields = list(reader.fieldnames or [])
            for row in reader:
                count += 1
                if len(sample) < limit:
                    sample.append(row)
    except Exception as exc:
        errors.append(f"{path}: {exc}")
        fields = []
    return count, fields, sample, errors


def inspect_inmet_zip(path: Path, limit: int) -> tuple[int, list[str], list[dict[str, Any]], list[str]]:
    count = 0
    fields: set[str] = set()
    sample: list[dict[str, Any]] = []
    errors: list[str] = []
    try:
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                if not name.lower().endswith(".csv"):
                    continue
                with zf.open(name) as raw:
                    lines = raw.read(12000).decode("latin-1", errors="replace").splitlines()
                metadata = {}
                header_index = None
                for idx, line in enumerate(lines):
                    if line.startswith("Data;"):
                        header_index = idx
                        break
                    if ":;" in line:
                        key, value = line.split(":;", 1)
                        metadata[key.strip()] = value.strip()
                if header_index is None:
                    continue
                header = lines[header_index].split(";")
                fields.update(header)
                count += 1
                if len(sample) < limit:
                    sample.append({"arquivo": name, "metadata": metadata, "campos": header})
    except Exception as exc:
        errors.append(f"{path}: {exc}")
    return count, sorted(fields), sample, errors


def write_sample(path: Path, records: list[dict[str, Any]]) -> None:
    ensure_parent(path)
    with path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
        f.write("\n")


def inspect_raw(raw_dir: Path, samples_dir: Path, sample_limit: int) -> dict[str, Any]:
    report: dict[str, Any] = {"raw_dir": str(raw_dir), "sources": {}, "errors": []}

    def prefer_rio_brasil(path: Path) -> tuple[int, str]:
        text = str(path).lower()
        if "rio_de_janeiro" in text or "_rj" in text or "/rj/" in text:
            return (0, text)
        if "brasil" in text or "brazil" in text:
            return (1, text)
        return (2, text)

    source_files = {
        "fogo_cruzado": sorted((raw_dir / "fogo_cruzado" / "occurrences").glob("*/*.jsonl"), key=prefer_rio_brasil),
        "inpe_bdqueimadas": sorted((raw_dir / "inpe_bdqueimadas").glob("**/*.csv"), key=prefer_rio_brasil),
        "inmet": sorted((raw_dir / "inmet").glob("**/*.zip"), key=prefer_rio_brasil),
        "nyc311": sorted((raw_dir / "nyc311").glob("*.jsonl")),
        "ibge": sorted((raw_dir / "ibge").glob("**/*.json")),
        "osm": sorted((raw_dir / "osm").glob("**/*.json")),
        "cemaden": sorted((raw_dir / "cemaden").glob("*")),
        "portal_rio_1746": sorted((raw_dir / "portal_rio_1746").glob("*")),
    }

    for source, files in source_files.items():
        total = 0
        fields: set[str] = set()
        sample: list[dict[str, Any]] = []
        errors: list[str] = []
        file_summaries = []
        for path in files:
            if path.suffix == ".jsonl":
                count, file_fields, file_sample, file_errors = sample_jsonl(path, sample_limit)
            elif path.suffix == ".csv":
                count, file_fields, file_sample, file_errors = inspect_csv(path, sample_limit)
            elif path.suffix == ".zip":
                count, file_fields, file_sample, file_errors = inspect_inmet_zip(path, sample_limit)
            elif path.suffix == ".json":
                count, file_fields, file_sample, file_errors = 1, [], [], []
            else:
                count, file_fields, file_sample, file_errors = 0, [], [], []
            total += count
            fields.update(file_fields)
            errors.extend(file_errors)
            if len(sample) < sample_limit:
                sample.extend(file_sample[: sample_limit - len(sample)])
            file_summaries.append({"path": str(path), "records": count, "fields": file_fields[:40]})

        report["sources"][source] = {
            "present": bool(files),
            "files": file_summaries,
            "total_records_approx": total,
            "fields": sorted(fields),
            "errors": errors,
        }
        if sample:
            suffix = "csv" if source == "inpe_bdqueimadas" else "json"
            sample_path = samples_dir / f"{source}_sample.{suffix}"
            if suffix == "csv":
                ensure_parent(sample_path)
                with sample_path.open("w", encoding="utf-8", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=list(sample[0].keys()))
                    writer.writeheader()
                    writer.writerows(sample)
            else:
                write_sample(sample_path, sample)
        report["errors"].extend(errors)

    report["canonical_types"] = CANONICAL_TYPES
    report["raw_event_distribution_hint"] = dict(Counter({"Tiroteio": 1, "Incêndio": 1, "Chuva intensa": 1}))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspeciona a camada data/raw sem modificá-la.")
    parser.add_argument("--raw-dir", default="data/raw")
    parser.add_argument("--out", default="data/processed/raw_inventory.json")
    parser.add_argument("--samples-dir", default="data/samples")
    parser.add_argument("--sample-limit", type=int, default=25)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    report = inspect_raw(Path(args.raw_dir), Path(args.samples_dir), args.sample_limit)
    write_json(Path(args.out), report)
    logging.info("Inventário salvo em %s", args.out)


if __name__ == "__main__":
    main()
