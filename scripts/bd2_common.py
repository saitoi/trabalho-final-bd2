from __future__ import annotations

import json
import os
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


CANONICAL_TYPES = [
    "Tiroteio",
    "Incêndio",
    "Alagamento",
    "Chuva intensa",
    "Risco hidrológico",
    "Risco geotécnico",
    "Problema urbano",
    "Transporte",
    "Energia",
    "Vazamento de água",
    "Interdição de via",
    "Outro",
]

# AJUSTE LOCAL — Docker Desktop no Windows resolve host.docker.internal para o IP da
# rede WiFi, não para 127.0.0.1. directConnection=true conecta direto ao PRIMARY sem
# descoberta de topologia. Original (Linux/produção) está comentado abaixo.
# DEFAULT_MONGO_URI = "mongodb://host.docker.internal:27017,host.docker.internal:27018,host.docker.internal:27019/bd2?replicaSet=rs0"
DEFAULT_MONGO_URI = "mongodb://localhost:27017/bd2?directConnection=true"

STATE_ABBR = {
    "ACRE": "AC",
    "ALAGOAS": "AL",
    "AMAPÁ": "AP",
    "AMAPA": "AP",
    "AMAZONAS": "AM",
    "BAHIA": "BA",
    "CEARÁ": "CE",
    "CEARA": "CE",
    "DISTRITO FEDERAL": "DF",
    "ESPÍRITO SANTO": "ES",
    "ESPIRITO SANTO": "ES",
    "GOIÁS": "GO",
    "GOIAS": "GO",
    "MARANHÃO": "MA",
    "MARANHAO": "MA",
    "MATO GROSSO": "MT",
    "MATO GROSSO DO SUL": "MS",
    "MINAS GERAIS": "MG",
    "PARÁ": "PA",
    "PARA": "PA",
    "PARAÍBA": "PB",
    "PARAIBA": "PB",
    "PARANÁ": "PR",
    "PARANA": "PR",
    "PERNAMBUCO": "PE",
    "PIAUÍ": "PI",
    "PIAUI": "PI",
    "RIO DE JANEIRO": "RJ",
    "RIO GRANDE DO NORTE": "RN",
    "RIO GRANDE DO SUL": "RS",
    "RONDÔNIA": "RO",
    "RONDONIA": "RO",
    "RORAIMA": "RR",
    "SANTA CATARINA": "SC",
    "SÃO PAULO": "SP",
    "SAO PAULO": "SP",
    "SERGIPE": "SE",
    "TOCANTINS": "TO",
}


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_json(path: Path, data: Any) -> None:
    ensure_parent(path)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def iter_jsonl(path: Path) -> Iterable[tuple[int, dict[str, Any]]]:
    with path.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            yield line_no, json.loads(line)


def append_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> int:
    ensure_parent(path)
    count = 0
    with path.open("a", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
            f.write("\n")
            count += 1
    return count


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        result = float(value)
    else:
        text = str(value).strip().replace(",", ".")
        if not text:
            return None
        try:
            result = float(text)
        except ValueError:
            return None
    return result


def valid_lat_lon(lat: Any, lon: Any) -> tuple[float, float] | None:
    lat_f = parse_float(lat)
    lon_f = parse_float(lon)
    if lat_f is None or lon_f is None:
        return None
    if not (-90 <= lat_f <= 90 and -180 <= lon_f <= 180):
        return None
    return lat_f, lon_f


def parse_datetime_to_utc(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    variants = [text]
    if text.endswith("Z"):
        variants.append(text[:-1] + "+00:00")
    if " " in text and "T" not in text:
        variants.append(text.replace(" ", "T"))
    for candidate in variants:
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            dt = dt.astimezone(timezone.utc).replace(microsecond=0)
            return dt.isoformat().replace("+00:00", "Z")
        except ValueError:
            continue
    for fmt in ("%Y/%m/%d %H:%M", "%Y/%m/%d %H%M", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat().replace("+00:00", "Z")
        except ValueError:
            continue
    return None


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.strip().lower()


def state_abbr(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if len(text) == 2:
        return text.upper()
    return STATE_ABBR.get(text.upper(), text.upper() or None)


def mongo_client():
    from pymongo import MongoClient

    return MongoClient(os.getenv("MONGO_URI", DEFAULT_MONGO_URI), serverSelectionTimeoutMS=10000)


def mongo_collection(db_name: str = "bd2", collection_name: str = "eventos"):
    client = mongo_client()
    db = client[db_name]
    return client, db[collection_name]
