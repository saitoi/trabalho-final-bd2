#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# ///
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import random
import zipfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

from bd2_common import (
    CANONICAL_TYPES,
    append_jsonl,
    ensure_parent,
    iter_jsonl,
    parse_datetime_to_utc,
    parse_float,
    state_abbr,
    utc_now,
    valid_lat_lon,
    write_json,
)


RJ_NEIGHBORHOODS = [
    ("Centro", -22.9068, -43.1729),
    ("Tijuca", -22.9249, -43.2330),
    ("Copacabana", -22.9711, -43.1822),
    ("Botafogo", -22.9519, -43.1802),
    ("Barra da Tijuca", -23.0004, -43.3659),
    ("Jacarepaguá", -22.9666, -43.3713),
    ("Santa Cruz", -22.9196, -43.6844),
    ("Campo Grande", -22.9029, -43.5614),
    ("Madureira", -22.8726, -43.3370),
    ("Vila Isabel", -22.9168, -43.2473),
]

SYNTHETIC_DESCRIPTIONS = {
    "Alagamento": "Registro sintético acadêmico de ponto de alagamento urbano",
    "Chuva intensa": "Registro sintético acadêmico de chuva intensa",
    "Risco hidrológico": "Registro sintético acadêmico de risco hidrológico",
    "Risco geotécnico": "Registro sintético acadêmico de risco geotécnico",
    "Problema urbano": "Registro sintético acadêmico de problema urbano",
    "Transporte": "Registro sintético acadêmico de problema no transporte público",
    "Energia": "Registro sintético acadêmico de queda de energia",
    "Vazamento de água": "Registro sintético acadêmico de vazamento de água",
    "Interdição de via": "Registro sintético acadêmico de interdição de via",
    "Outro": "Registro sintético acadêmico de ocorrência urbana diversa",
}


class Writer:
    def __init__(self, out: Path, rejected: Path):
        ensure_parent(out)
        ensure_parent(rejected)
        self.out_f = out.open("w", encoding="utf-8")
        self.rej_f = rejected.open("w", encoding="utf-8")
        self.next_id = 1
        self.counts = Counter()
        self.rejected_counts = Counter()

    def close(self) -> None:
        self.out_f.close()
        self.rej_f.close()

    def reject(self, source: str, raw_path: Path, line: int | None, reason: str, raw_id: Any = None) -> None:
        self.rejected_counts[reason] += 1
        payload = {
            "fonte": source,
            "arquivoRaw": str(raw_path),
            "linhaOriginal": line,
            "idOriginal": raw_id,
            "motivo": reason,
        }
        self.rej_f.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")

    def write(self, event: dict[str, Any]) -> None:
        event["idEvento"] = f"EVT{self.next_id:06d}"
        self.next_id += 1
        self.counts[event["tipo"]] += 1
        self.out_f.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")


def canonical_event(
    *,
    tipo: str,
    descricao: str | None,
    data_hora: str,
    gravidade: int,
    status: str | None,
    bairro: str | None,
    cidade: str | None,
    estado: str | None,
    pais: str | None,
    lat: float,
    lon: float,
    reportante_tipo: str,
    reportante_id: str,
    fonte: str,
    id_original: Any,
    arquivo_raw: Path,
    linha_original: int | None,
    categoria_original: Any,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "idEvento": None,
        "tipo": tipo,
        "descricao": descricao,
        "dataHora": data_hora,
        "gravidade": max(1, min(5, int(gravidade))),
        "status": status or "Aberto",
        "bairro": bairro,
        "cidade": cidade,
        "estado": estado,
        "pais": pais,
        "localizacao": {"type": "Point", "coordinates": [lon, lat]},
        "reportante": {"tipo": reportante_tipo, "identificador": reportante_id},
        "origem": {"fonte": fonte, "idOriginal": None if id_original is None else str(id_original), "arquivoRaw": str(arquivo_raw)},
        "metadados": {
            "categoriaOriginal": None if categoria_original is None else str(categoria_original),
            "linhaOriginal": linha_original,
            "extraidoEm": utc_now(),
            **(extra or {}),
        },
    }


def normalize_fogo(raw_dir: Path, writer: Writer, max_records: int) -> None:
    files = sorted((raw_dir / "fogo_cruzado" / "occurrences").glob("*/*.jsonl"))
    files.sort(key=lambda p: (0 if "rio_de_janeiro" in str(p) else 1, str(p)))
    written = 0
    for path in files:
        if written >= max_records:
            break
        for line_no, record in iter_jsonl(path):
            if written >= max_records:
                break
            coords = valid_lat_lon(record.get("latitude"), record.get("longitude"))
            if not coords:
                writer.reject("fogo_cruzado", path, line_no, "coordenada_invalida", record.get("id"))
                continue
            data_hora = parse_datetime_to_utc(record.get("date"))
            if not data_hora:
                writer.reject("fogo_cruzado", path, line_no, "data_invalida", record.get("id"))
                continue
            victims = record.get("victims") or []
            dead = sum(1 for victim in victims if str(victim.get("situation", "")).lower() == "dead")
            wounded = sum(1 for victim in victims if str(victim.get("situation", "")).lower() == "wounded")
            severity = 5 if dead else 4 if wounded or victims else 3
            reason = ((record.get("contextInfo") or {}).get("mainReason") or {}).get("name")
            city = (record.get("city") or {}).get("name")
            state = (record.get("state") or {}).get("name")
            bairro = (record.get("neighborhood") or {}).get("name")
            lat, lon = coords
            writer.write(
                canonical_event(
                    tipo="Tiroteio",
                    descricao=f"Ocorrência de violência armada: {reason or 'sem categoria informada'}",
                    data_hora=data_hora,
                    gravidade=severity,
                    status="Aberto",
                    bairro=bairro.title() if isinstance(bairro, str) else None,
                    cidade=city,
                    estado=state_abbr(state),
                    pais="Brasil",
                    lat=lat,
                    lon=lon,
                    reportante_tipo="Fonte pública",
                    reportante_id="Fogo Cruzado",
                    fonte="fogo_cruzado",
                    id_original=record.get("id"),
                    arquivo_raw=path,
                    linha_original=line_no,
                    categoria_original=reason,
                    extra={"vitimas": len(victims), "mortos": dead, "feridos": wounded},
                )
            )
            written += 1


def normalize_inpe(raw_dir: Path, writer: Writer, max_records: int) -> None:
    files = sorted((raw_dir / "inpe_bdqueimadas" / "focos_csv_mensal_brasil" / "files").glob("*.csv"))
    written = 0
    for path in files:
        if written >= max_records:
            break
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for line_no, row in enumerate(reader, start=2):
                if written >= max_records:
                    break
                coords = valid_lat_lon(row.get("lat"), row.get("lon"))
                if not coords:
                    writer.reject("inpe_bdqueimadas", path, line_no, "coordenada_invalida", row.get("id"))
                    continue
                data_hora = parse_datetime_to_utc(row.get("data_hora_gmt"))
                if not data_hora:
                    writer.reject("inpe_bdqueimadas", path, line_no, "data_invalida", row.get("id"))
                    continue
                frp = parse_float(row.get("frp"))
                risco = parse_float(row.get("risco_fogo"))
                if frp is not None and frp >= 100:
                    severity = 5
                elif frp is not None and frp >= 50:
                    severity = 4
                elif risco is not None and risco >= 0.8:
                    severity = 4
                else:
                    severity = 3
                lat, lon = coords
                writer.write(
                    canonical_event(
                        tipo="Incêndio",
                        descricao="Foco de queimada detectado por satélite",
                        data_hora=data_hora,
                        gravidade=severity,
                        status="Aberto",
                        bairro=None,
                        cidade=(row.get("municipio") or "").title() or None,
                        estado=state_abbr(row.get("estado")),
                        pais=row.get("pais") or "Brasil",
                        lat=lat,
                        lon=lon,
                        reportante_tipo="Fonte pública",
                        reportante_id="INPE BDQueimadas",
                        fonte="inpe_bdqueimadas",
                        id_original=row.get("id"),
                        arquivo_raw=path,
                        linha_original=line_no,
                        categoria_original=row.get("bioma"),
                        extra={"satelite": row.get("satelite"), "frp": frp, "riscoFogo": risco},
                    )
                )
                written += 1


def normalize_inmet(raw_dir: Path, writer: Writer, max_records: int) -> None:
    files = sorted((raw_dir / "inmet" / "dados_historicos_anuais").glob("*.zip"))
    written = 0
    for zip_path in files:
        if written >= max_records:
            break
        with zipfile.ZipFile(zip_path) as zf:
            names = sorted(n for n in zf.namelist() if n.lower().endswith(".csv"))
            names.sort(key=lambda n: (0 if "_RJ_" in n or "RIO DE JANEIRO" in n.upper() else 1, n))
            for name in names:
                if written >= max_records:
                    break
                metadata: dict[str, str] = {}
                with zf.open(name) as raw:
                    text = raw.read().decode("latin-1", errors="replace").splitlines()
                header_idx = None
                for idx, line in enumerate(text):
                    if line.startswith("Data;"):
                        header_idx = idx
                        break
                    if ":;" in line:
                        key, value = line.split(":;", 1)
                        metadata[key.strip()] = value.strip()
                if header_idx is None:
                    continue
                lat = parse_float(metadata.get("LATITUDE"))
                lon = parse_float(metadata.get("LONGITUDE"))
                if lat is None or lon is None:
                    continue
                reader = csv.DictReader(text[header_idx:], delimiter=";")
                precip_col = next((c for c in (reader.fieldnames or []) if "PRECIPITA" in c.upper()), None)
                for row_no, row in enumerate(reader, start=header_idx + 2):
                    if written >= max_records:
                        break
                    precip = parse_float(row.get(precip_col)) if precip_col else None
                    if precip is None or precip <= 0:
                        continue
                    date_text = row.get("Data")
                    hour_text = str(row.get("Hora UTC") or "0000 UTC").replace(" UTC", "")
                    data_hora = parse_datetime_to_utc(f"{date_text} {hour_text}")
                    if not data_hora:
                        writer.reject("inmet", zip_path, row_no, "data_invalida", name)
                        continue
                    if precip >= 50:
                        tipo, severity = "Risco hidrológico", 5
                    elif precip >= 25:
                        tipo, severity = "Chuva intensa", 4
                    elif precip >= 10:
                        tipo, severity = "Chuva intensa", 3
                    else:
                        tipo, severity = "Chuva intensa", 2
                    writer.write(
                        canonical_event(
                            tipo=tipo,
                            descricao="Observação meteorológica de precipitação horária",
                            data_hora=data_hora,
                            gravidade=severity,
                            status="Aberto",
                            bairro=metadata.get("ESTACAO"),
                            cidade=(metadata.get("ESTACAO") or "").title() or None,
                            estado=metadata.get("UF"),
                            pais="Brasil",
                            lat=lat,
                            lon=lon,
                            reportante_tipo="Fonte pública",
                            reportante_id="INMET",
                            fonte="inmet",
                            id_original=f"{name}:{row_no}",
                            arquivo_raw=zip_path,
                            linha_original=row_no,
                            categoria_original="precipitacao_horaria",
                            extra={"precipitacaoMm": precip, "arquivoInterno": name},
                        )
                    )
                    written += 1


def map_nyc_type(complaint: str | None, descriptor: str | None) -> str:
    text = f"{complaint or ''} {descriptor or ''}".lower()
    if any(k in text for k in ["flood", "catch basin", "sewer", "root/sewer"]):
        return "Alagamento"
    if any(k in text for k in ["water leak", "leak", "hydrant", "water system", "water conservation", "drinking water", "water quality"]):
        return "Vazamento de água"
    if any(
        k in text
        for k in [
            "illegal parking",
            "blocked driveway",
            "street condition",
            "traffic",
            "highway",
            "street light",
            "street sign",
            "broken parking meter",
            "bus stop shelter",
        ]
    ):
        return "Interdição de via"
    if any(k in text for k in ["bus", "subway", "taxi", "ferry", "transport"]):
        return "Transporte"
    if any(k in text for k in ["electric", "power", "heat/hot water"]):
        return "Energia"
    if any(
        k in text
        for k in [
            "damaged tree",
            "dead/dying tree",
            "overgrown tree",
            "uprooted stump",
            "illegal tree damage",
            "sidewalk condition",
            "curb condition",
            "lot condition",
            "retaining wall",
            "flooring/stairs",
            "hazardous materials",
        ]
    ):
        return "Risco geotécnico"
    return "Problema urbano"


def normalize_nyc311(raw_dir: Path, writer: Writer, max_records: int) -> None:
    files = sorted((raw_dir / "nyc311").glob("*.jsonl"))
    written = 0
    for path in files:
        if written >= max_records:
            break
        for line_no, record in iter_jsonl(path):
            if written >= max_records:
                break
            coords = valid_lat_lon(record.get("latitude"), record.get("longitude"))
            if not coords:
                writer.reject("nyc311", path, line_no, "coordenada_invalida", record.get("unique_key"))
                continue
            data_hora = parse_datetime_to_utc(record.get("created_date"))
            if not data_hora:
                writer.reject("nyc311", path, line_no, "data_invalida", record.get("unique_key"))
                continue
            tipo = map_nyc_type(record.get("complaint_type"), record.get("descriptor"))
            status = "Fechado" if str(record.get("status", "")).lower() == "closed" else "Aberto"
            lat, lon = coords
            writer.write(
                canonical_event(
                    tipo=tipo,
                    descricao=record.get("descriptor") or record.get("complaint_type"),
                    data_hora=data_hora,
                    gravidade=2 if status == "Fechado" else 3,
                    status=status,
                    bairro=record.get("borough"),
                    cidade=record.get("city") or "New York",
                    estado="NY",
                    pais="Estados Unidos",
                    lat=lat,
                    lon=lon,
                    reportante_tipo="Fonte pública",
                    reportante_id=record.get("agency") or "NYC311",
                    fonte="nyc311",
                    id_original=record.get("unique_key"),
                    arquivo_raw=path,
                    linha_original=line_no,
                    categoria_original=record.get("complaint_type"),
                    extra={"fallbackInternacional": True},
                )
            )
            written += 1


def synthetic_id(tipo: str, index: int) -> str:
    digest = hashlib.sha1(f"{tipo}:{index}".encode("utf-8")).hexdigest()[:16]
    return f"SYN-{digest}"


def generate_synthetic(writer: Writer, target_total: int, min_per_type: int, seed: int) -> None:
    rng = random.Random(seed)
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    synthetic_types = [t for t in CANONICAL_TYPES if t not in {"Tiroteio", "Incêndio"}]
    index = 0
    while sum(writer.counts.values()) < target_total:
        underrepresented = [t for t in CANONICAL_TYPES if writer.counts[t] < min_per_type]
        tipo = underrepresented[index % len(underrepresented)] if underrepresented else rng.choice(synthetic_types)
        bairro, base_lat, base_lon = rng.choice(RJ_NEIGHBORHOODS)
        lat = base_lat + rng.uniform(-0.012, 0.012)
        lon = base_lon + rng.uniform(-0.012, 0.012)
        dt = start + timedelta(hours=index * 3)
        severity = rng.choices([1, 2, 3, 4, 5], weights=[1, 2, 4, 3, 1])[0]
        writer.write(
            canonical_event(
                tipo=tipo,
                descricao=SYNTHETIC_DESCRIPTIONS.get(tipo, "Registro sintético acadêmico de evento urbano"),
                data_hora=dt.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                gravidade=severity,
                status=rng.choice(["Aberto", "Em acompanhamento", "Fechado"]),
                bairro=bairro,
                cidade="Rio de Janeiro",
                estado="RJ",
                pais="Brasil",
                lat=lat,
                lon=lon,
                reportante_tipo="Sintético",
                reportante_id="Gerador acadêmico BD2",
                fonte="synthetic_rio",
                id_original=synthetic_id(tipo, index),
                arquivo_raw=Path("synthetic://rio_de_janeiro"),
                linha_original=None,
                categoria_original=tipo,
                extra={"geradoPara": "balanceamento_academico", "seed": seed},
            )
        )
        index += 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Normaliza fontes raw para o modelo canônico de eventos urbanos.")
    parser.add_argument("--raw-dir", default="data/raw")
    parser.add_argument("--out", default="data/processed/events_normalized.jsonl")
    parser.add_argument("--rejected", default="data/processed/events_rejected.jsonl")
    parser.add_argument("--summary", default="data/processed/normalization_summary.json")
    parser.add_argument("--target-total", type=int, default=100000)
    parser.add_argument("--min-per-type", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-fogo", type=int, default=70000)
    parser.add_argument("--max-inpe", type=int, default=45000)
    parser.add_argument("--max-inmet", type=int, default=20000)
    parser.add_argument("--max-nyc311", type=int, default=20000)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    writer = Writer(Path(args.out), Path(args.rejected))
    synthetic_generated = False
    try:
        raw_dir = Path(args.raw_dir)
        normalize_fogo(raw_dir, writer, args.max_fogo)
        normalize_inpe(raw_dir, writer, args.max_inpe)
        normalize_inmet(raw_dir, writer, args.max_inmet)
        normalize_nyc311(raw_dir, writer, args.max_nyc311)
        real_total = sum(writer.counts.values())
        if real_total < args.target_total:
            logging.info(
                "Dados reais abaixo da carga alvo (%s/%s). Gerando complemento sintético determinístico.",
                real_total,
                args.target_total,
            )
            generate_synthetic(writer, args.target_total, args.min_per_type, args.seed)
            synthetic_generated = True
        else:
            logging.info("Dados reais suficientes para a carga alvo (%s/%s). Sintéticos não gerados.", real_total, args.target_total)
    finally:
        writer.close()

    summary = {
        "generated_at": utc_now(),
        "output": args.out,
        "rejected": args.rejected,
        "total_events": sum(writer.counts.values()),
        "counts_by_type": dict(writer.counts),
        "rejected_by_reason": dict(writer.rejected_counts),
        "synthetic_policy": {
            "enabled": synthetic_generated,
            "source": "synthetic_rio",
            "target_total": args.target_total,
            "min_per_type": args.min_per_type,
            "seed": args.seed,
            "rule": "gerar somente se os dados reais ficarem abaixo da carga alvo",
        },
    }
    write_json(Path(args.summary), summary)
    logging.info("Normalização concluída: %s eventos", summary["total_events"])


if __name__ == "__main__":
    main()
