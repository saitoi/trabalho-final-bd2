#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "python-dotenv>=1.0.1",
#   "requests>=2.32.4",
#   "tqdm>=4.68.3",
# ]
# ///
"""
Pipeline raw para fontes de eventos urbanos e contexto espacial.

Camada RAW: salva exatamente o retorno/arquivo original de cada fonte em data/raw/,
sem normalizar para o schema do trabalho. A normalização deve ficar em outro script.

Fontes incluídas:
- Fogo Cruzado API v2
- INPE BDQueimadas
- INMET Dados Históricos Anuais
- IBGE malhas/localidades
- OSM Overpass
- OSM Geofabrik opcional
- NYC 311 opcional
- Cemaden manual/semiautomático, por causa de confirmação de segurança
- Portal Rio 1746 manual/semiautomático, por causa de portal dinâmico/login/relatórios
"""

from __future__ import annotations

import argparse
import calendar
import html
import json
import logging
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin

import requests
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from tqdm import tqdm
from urllib3.util.retry import Retry


FOGO_BASE = "https://api-service.fogocruzado.org.br/api/v2"
INPE_MENSAL_BRASIL = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/mensal/Brasil/"
INMET_HISTORICOS = "https://portal.inmet.gov.br/uploads/dadoshistoricos/{year}.zip"
IBGE_LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios"
IBGE_MALHA_ESTADO = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/{uf}"
OSM_OVERPASS = "https://overpass-api.de/api/interpreter"
NYC311_ENDPOINT = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_name(value: str) -> str:
    value = value.strip().lower()
    value = value.replace("á", "a").replace("à", "a").replace("ã", "a").replace("â", "a")
    value = value.replace("é", "e").replace("ê", "e")
    value = value.replace("í", "i")
    value = value.replace("ó", "o").replace("ô", "o").replace("õ", "o")
    value = value.replace("ú", "u")
    value = value.replace("ç", "c")
    value = re.sub(r"[^a-z0-9._-]+", "_", value)
    return value.strip("_") or "unknown"


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "sim", "s", "y"}


def split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def parse_ym(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d{4})-(\d{2})", value.strip())
    if not match:
        raise ValueError(f"Valor ano-mês inválido: {value}. Use YYYY-MM.")
    year, month = int(match.group(1)), int(match.group(2))
    if not (1 <= month <= 12):
        raise ValueError(f"Mês inválido: {value}")
    return year, month


def ym_iter(start_ym: str, end_ym: str) -> Iterable[str]:
    sy, sm = parse_ym(start_ym)
    ey, em = parse_ym(end_ym)
    y, m = sy, sm
    while (y, m) <= (ey, em):
        yield f"{y:04d}{m:02d}"
        m += 1
        if m == 13:
            y += 1
            m = 1


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data: Any) -> None:
    ensure_parent(path)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


def append_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> int:
    ensure_parent(path)
    count = 0
    with path.open("a", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False))
            f.write("\n")
            count += 1
    return count


def write_text(path: Path, text: str) -> None:
    ensure_parent(path)
    path.write_text(text, encoding="utf-8")


def load_json_if_exists(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def make_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        status=5,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "POST"),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(
        {
            "User-Agent": "BDII-UFRJ-UrbanEventsRawPipeline/1.0 (+academic project)",
            "Accept": "*/*",
        }
    )
    return session


@dataclass
class Context:
    raw_dir: Path
    session: requests.Session
    force: bool
    dry_run: bool


def save_response_metadata(path: Path, response: requests.Response, extra: dict[str, Any] | None = None) -> None:
    metadata = {
        "url": response.url,
        "status_code": response.status_code,
        "headers": dict(response.headers),
        "downloaded_at": utc_now(),
    }
    if extra:
        metadata.update(extra)
    write_json(path, metadata)


def download_file(
    ctx: Context,
    url: str,
    dest: Path,
    metadata_path: Path | None = None,
    headers: dict[str, str] | None = None,
    chunk_size: int = 1024 * 1024,
) -> bool:
    if dest.exists() and not ctx.force:
        logging.info("skip existing: %s", dest)
        return True

    if ctx.dry_run:
        logging.info("[dry-run] download %s -> %s", url, dest)
        return True

    ensure_parent(dest)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    request_headers = headers or {}

    with ctx.session.get(url, headers=request_headers, stream=True, timeout=120) as response:
        if response.status_code == 404:
            logging.warning("404: %s", url)
            return False
        if response.status_code >= 400:
            logging.warning("HTTP %s: %s", response.status_code, url)
            return False

        total = int(response.headers.get("Content-Length", 0))
        with tmp.open("wb") as f, tqdm(
            total=total if total else None,
            unit="B",
            unit_scale=True,
            desc=dest.name,
        ) as progress:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    progress.update(len(chunk))

        tmp.replace(dest)

        if metadata_path:
            save_response_metadata(metadata_path, response, {"file": str(dest)})

    return True


class FogoClient:
    def __init__(self, session: requests.Session, email: str, password: str):
        self.session = session
        self.email = email
        self.password = password
        self.token: str | None = None
        self.expires_at = 0.0

    def login(self) -> None:
        response = self.session.post(
            f"{FOGO_BASE}/auth/login",
            json={"email": self.email, "password": self.password},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        data = payload["data"]
        self.token = data["accessToken"]
        self.expires_at = time.time() + int(data.get("expiresIn", 3600)) - 60

    def ensure_token(self) -> None:
        if not self.token or time.time() >= self.expires_at:
            self.login()

    def get(self, path: str, params: dict[str, Any] | None = None) -> requests.Response:
        self.ensure_token()
        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.session.get(f"{FOGO_BASE}{path}", params=params or {}, headers=headers, timeout=90)
        if response.status_code == 401:
            self.login()
            headers = {"Authorization": f"Bearer {self.token}"}
            response = self.session.get(f"{FOGO_BASE}{path}", params=params or {}, headers=headers, timeout=90)
        response.raise_for_status()
        return response


def extract_fogo_cruzado(ctx: Context) -> None:
    email = os.getenv("FOGO_CRUZADO_EMAIL")
    password = os.getenv("FOGO_CRUZADO_PASSWORD")
    if not email or not password:
        logging.warning("Fogo Cruzado ignorado: defina FOGO_CRUZADO_EMAIL e FOGO_CRUZADO_PASSWORD.")
        return

    start_date = os.getenv("FOGO_CRUZADO_START_DATE", "2016-07-01")
    end_date = os.getenv("FOGO_CRUZADO_END_DATE", datetime.now().strftime("%Y-%m-%d"))
    take = int(os.getenv("FOGO_CRUZADO_TAKE", "100"))
    wanted_states = {s.lower() for s in split_csv(os.getenv("FOGO_CRUZADO_STATES"))}

    out = ctx.raw_dir / "fogo_cruzado"
    client = FogoClient(ctx.session, email, password)

    if ctx.dry_run:
        logging.info("[dry-run] Fogo Cruzado metadata/occurrences")
        return

    states_resp = client.get("/states")
    states_payload = states_resp.json()
    write_json(out / "states" / "states_raw.json", states_payload)
    save_response_metadata(out / "metadata" / "states_response.json", states_resp)

    cities_resp = client.get("/cities")
    cities_payload = cities_resp.json()
    write_json(out / "cities" / "cities_raw.json", cities_payload)
    save_response_metadata(out / "metadata" / "cities_response.json", cities_resp)

    states = states_payload.get("data", [])
    if wanted_states:
        states = [s for s in states if s.get("name", "").strip().lower() in wanted_states]

    write_json(
        out / "metadata" / f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        {
            "source": "fogo_cruzado",
            "start_date": start_date,
            "end_date": end_date,
            "states": states,
            "take": take,
            "created_at": utc_now(),
        },
    )

    for state in states:
        state_id = state["id"]
        state_name = state["name"]
        safe_state = safe_name(state_name)
        state_out = out / "occurrences" / safe_state
        jsonl_path = state_out / f"occurrences_{safe_state}_{start_date}_{end_date}.jsonl"
        checkpoint_path = state_out / f"checkpoint_{safe_state}_{start_date}_{end_date}.json"

        if ctx.force:
            jsonl_path.unlink(missing_ok=True)
            checkpoint_path.unlink(missing_ok=True)
            shutil.rmtree(state_out / "pages", ignore_errors=True)

        checkpoint = load_json_if_exists(checkpoint_path)
        page = int(checkpoint.get("next_page", 1))
        page_count = checkpoint.get("page_count")

        while True:
            params = {
                "order": "ASC",
                "page": page,
                "take": take,
                "idState": state_id,
                "initialdate": start_date,
                "finaldate": end_date,
            }

            response = client.get("/occurrences", params=params)
            payload = response.json()
            page_meta = payload.get("pageMeta", {})
            records = payload.get("data", [])

            write_json(state_out / "pages" / f"page_{page:06d}.json", payload)
            append_jsonl(jsonl_path, records)

            checkpoint_data = {
                "source": "fogo_cruzado",
                "state": state,
                "start_date": start_date,
                "end_date": end_date,
                "last_completed_page": page,
                "next_page": page + 1,
                "page_meta": page_meta,
                "headers": dict(response.headers),
                "updated_at": utc_now(),
            }
            write_json(checkpoint_path, checkpoint_data)

            logging.info("Fogo Cruzado %s page=%s items=%s", state_name, page, len(records))

            if not page_meta.get("hasNextPage"):
                break

            page += 1
            if page_count is None and page_meta.get("pageCount"):
                page_count = page_meta["pageCount"]


def extract_inpe_queimadas(ctx: Context) -> None:
    scope = os.getenv("INPE_QUEIMADAS_SCOPE", "Brasil")
    if scope != "Brasil":
        logging.warning("Este script implementa INPE scope=Brasil por padrão. Recebido: %s", scope)

    start_ym = os.getenv("INPE_QUEIMADAS_START_YM", "2024-01")
    end_ym = os.getenv("INPE_QUEIMADAS_END_YM", datetime.now().strftime("%Y-%m"))

    out = ctx.raw_dir / "inpe_bdqueimadas" / "focos_csv_mensal_brasil"
    index_path = out / "index.html"

    if ctx.dry_run:
        logging.info("[dry-run] INPE BDQueimadas %s..%s", start_ym, end_ym)
        return

    response = ctx.session.get(INPE_MENSAL_BRASIL, timeout=60)
    if response.status_code < 400:
        write_text(index_path, response.text)
        save_response_metadata(out / "metadata" / "index_response.json", response)
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', response.text, flags=re.I)
        files = [html.unescape(h) for h in hrefs if re.match(r"focos_mensal_br_\d{6}\.(csv|zip)$", h)]
    else:
        logging.warning("Falha ao abrir índice INPE (%s). Usando URLs estimadas.", response.status_code)
        files = [f"focos_mensal_br_{ym}.csv" for ym in ym_iter(start_ym, end_ym)]

    wanted = set(ym_iter(start_ym, end_ym))
    selected = []
    for fname in files:
        match = re.search(r"focos_mensal_br_(\d{6})\.(csv|zip)$", fname)
        if match and match.group(1) in wanted:
            selected.append(fname)

    if not selected:
        selected = [f"focos_mensal_br_{ym}.csv" for ym in ym_iter(start_ym, end_ym)]

    for fname in selected:
        url = urljoin(INPE_MENSAL_BRASIL, fname)
        dest = out / "files" / fname
        meta = out / "metadata" / f"{fname}.response.json"
        ok = download_file(
            ctx,
            url,
            dest,
            metadata_path=meta,
            headers={"Referer": "https://data.inpe.br/queimadas/dados-abertos/"},
        )
        if not ok and fname.endswith(".csv"):
            zip_fname = fname.removesuffix(".csv") + ".zip"
            download_file(
                ctx,
                urljoin(INPE_MENSAL_BRASIL, zip_fname),
                out / "files" / zip_fname,
                metadata_path=out / "metadata" / f"{zip_fname}.response.json",
                headers={"Referer": "https://data.inpe.br/queimadas/dados-abertos/"},
            )

    write_json(
        out / "metadata" / "run_manifest.json",
        {
            "source": "inpe_bdqueimadas",
            "index_url": INPE_MENSAL_BRASIL,
            "start_ym": start_ym,
            "end_ym": end_ym,
            "selected_files": selected,
            "created_at": utc_now(),
        },
    )


def extract_inmet(ctx: Context) -> None:
    start_year = int(os.getenv("INMET_START_YEAR", "2024"))
    end_year = int(os.getenv("INMET_END_YEAR", str(datetime.now().year)))
    out = ctx.raw_dir / "inmet" / "dados_historicos_anuais"

    for year in range(start_year, end_year + 1):
        url = INMET_HISTORICOS.format(year=year)
        dest = out / f"{year}.zip"
        meta = out / "metadata" / f"{year}.response.json"
        download_file(ctx, url, dest, metadata_path=meta)

    write_json(
        out / "metadata" / "run_manifest.json",
        {
            "source": "inmet_dados_historicos_anuais",
            "start_year": start_year,
            "end_year": end_year,
            "created_at": utc_now(),
        },
    )


def extract_ibge(ctx: Context) -> None:
    ufs = split_csv(os.getenv("IBGE_UFS", "RJ,PE,BA,PA,SP"))
    out = ctx.raw_dir / "ibge"

    for uf in ufs:
        uf = uf.upper()

        loc_url = IBGE_LOCALIDADES.format(uf=uf)
        loc_dest = out / "localidades" / f"municipios_{uf}.json"
        download_json_url(ctx, loc_url, loc_dest)

        for name, params in {
            "malha_estado": {
                "formato": "application/vnd.geo+json",
                "qualidade": "intermediaria",
            },
            "malha_municipios": {
                "formato": "application/vnd.geo+json",
                "qualidade": "intermediaria",
                "intrarregiao": "municipio",
            },
        }.items():
            dest = out / "malhas" / uf / f"{name}_{uf}.geojson"
            download_json_url(ctx, IBGE_MALHA_ESTADO.format(uf=uf), dest, params=params)

    write_json(
        out / "metadata" / "run_manifest.json",
        {"source": "ibge", "ufs": ufs, "created_at": utc_now()},
    )


def download_json_url(
    ctx: Context,
    url: str,
    dest: Path,
    params: dict[str, Any] | None = None,
    method: str = "GET",
    data: Any | None = None,
    headers: dict[str, str] | None = None,
) -> bool:
    if dest.exists() and not ctx.force:
        logging.info("skip existing: %s", dest)
        return True

    if ctx.dry_run:
        logging.info("[dry-run] %s %s -> %s", method, url, dest)
        return True

    ensure_parent(dest)
    if method.upper() == "POST":
        response = ctx.session.post(url, data=data, params=params or {}, headers=headers or {}, timeout=240)
    else:
        response = ctx.session.get(url, params=params or {}, headers=headers or {}, timeout=240)

    if response.status_code >= 400:
        logging.warning("HTTP %s: %s", response.status_code, response.url)
        return False

    try:
        payload = response.json()
        write_json(dest, payload)
    except ValueError:
        write_text(dest, response.text)

    save_response_metadata(dest.with_suffix(dest.suffix + ".response.json"), response)
    return True


def extract_osm_overpass(ctx: Context) -> None:
    bbox = os.getenv("OSM_OVERPASS_BBOX", "-23.0830,-43.7950,-22.7390,-43.0990")
    include_highways = parse_bool(os.getenv("OSM_OVERPASS_INCLUDE_HIGHWAYS"), default=False)
    out = ctx.raw_dir / "osm" / "overpass"

    parts = [
        f'relation["boundary"="administrative"]({bbox});',
        f'node["place"~"neighbourhood|suburb|quarter|city|town"]({bbox});',
        f'way["place"~"neighbourhood|suburb|quarter|city|town"]({bbox});',
    ]
    if include_highways:
        parts.append(f'way["highway"]({bbox});')

    query = f"""
[out:json][timeout:240];
(
  {' '.join(parts)}
);
out body;
>;
out skel qt;
""".strip()

    write_text(out / "query.overpassql", query)
    download_json_url(
        ctx,
        OSM_OVERPASS,
        out / f"osm_overpass_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        method="POST",
        data={"data": query},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


def extract_osm_geofabrik(ctx: Context) -> None:
    enabled = parse_bool(os.getenv("OSM_GEOFABRIK_ENABLED"), default=False)
    if not enabled:
        logging.info("OSM Geofabrik ignorado: OSM_GEOFABRIK_ENABLED=false.")
        return

    url = os.getenv(
        "OSM_GEOFABRIK_URL",
        "https://download.geofabrik.de/south-america/brazil/sudeste-latest.osm.pbf",
    )
    out = ctx.raw_dir / "osm" / "geofabrik"
    fname = url.rstrip("/").split("/")[-1]
    download_file(ctx, url, out / fname, metadata_path=out / "metadata" / f"{fname}.response.json")


def extract_nyc311(ctx: Context) -> None:
    if not parse_bool(os.getenv("NYC311_ENABLED"), default=True):
        logging.info("NYC311 ignorado: NYC311_ENABLED=false.")
        return

    start_date = os.getenv("NYC311_START_DATE", "2024-01-01")
    end_date = os.getenv("NYC311_END_DATE", datetime.now().strftime("%Y-%m-%d"))
    total_limit = int(os.getenv("NYC311_TOTAL_LIMIT", "100000"))
    page_size = int(os.getenv("NYC311_PAGE_SIZE", "5000"))
    app_token = os.getenv("NYC311_APP_TOKEN", "")

    out = ctx.raw_dir / "nyc311"
    jsonl_path = out / f"nyc311_{start_date}_{end_date}.jsonl"
    checkpoint_path = out / f"checkpoint_{start_date}_{end_date}.json"

    if ctx.force:
        jsonl_path.unlink(missing_ok=True)
        checkpoint_path.unlink(missing_ok=True)
        shutil.rmtree(out / "pages", ignore_errors=True)

    checkpoint = load_json_if_exists(checkpoint_path)
    offset = int(checkpoint.get("next_offset", 0))
    saved = int(checkpoint.get("saved", 0))

    select_cols = ",".join(
        [
            "unique_key",
            "created_date",
            "closed_date",
            "agency",
            "agency_name",
            "complaint_type",
            "descriptor",
            "incident_zip",
            "incident_address",
            "street_name",
            "cross_street_1",
            "cross_street_2",
            "address_type",
            "city",
            "status",
            "resolution_description",
            "borough",
            "latitude",
            "longitude",
        ]
    )

    where = (
        f"created_date between '{start_date}T00:00:00' and '{end_date}T23:59:59' "
        "and latitude IS NOT NULL and longitude IS NOT NULL"
    )

    headers = {}
    if app_token:
        headers["X-App-Token"] = app_token

    while saved < total_limit:
        limit = min(page_size, total_limit - saved)
        params = {
            "$limit": limit,
            "$offset": offset,
            "$order": "created_date ASC",
            "$select": select_cols,
            "$where": where,
        }

        if ctx.dry_run:
            logging.info("[dry-run] NYC311 offset=%s limit=%s", offset, limit)
            return

        response = ctx.session.get(NYC311_ENDPOINT, params=params, headers=headers, timeout=120)
        if response.status_code >= 400:
            logging.warning("NYC311 HTTP %s: %s", response.status_code, response.text[:300])
            break

        records = response.json()
        page_number = offset // page_size + 1
        write_json(out / "pages" / f"page_{page_number:06d}.json", records)
        append_jsonl(jsonl_path, records)

        saved += len(records)
        offset += len(records)

        write_json(
            checkpoint_path,
            {
                "source": "nyc311",
                "start_date": start_date,
                "end_date": end_date,
                "saved": saved,
                "next_offset": offset,
                "last_count": len(records),
                "last_response_headers": dict(response.headers),
                "updated_at": utc_now(),
            },
        )

        logging.info("NYC311 saved=%s offset=%s", saved, offset)

        if len(records) < limit:
            break


def extract_cemaden_manual(ctx: Context) -> None:
    out = ctx.raw_dir / "cemaden"
    manual = f"""# CEMADEN - etapa manual necessária

O Mapa Interativo do CEMADEN exige seleção de UF/município/mês/ano e confirmação de segurança.
Por isso, este pipeline não tenta burlar captcha nem confirmação de segurança.

Procedimento:
1. Acesse https://mapainterativo.cemaden.gov.br/
2. Menu: Download de Dados
3. Baixe Estações Pluviométricas, Hidrológicas, Acqua ou Geotécnicas
4. Salve os arquivos em:
   {out / "manual_downloads"}

Depois, rode a pipeline novamente: ela vai catalogar tudo que estiver nessa pasta.
"""
    write_text(out / "MANUAL_DOWNLOAD.md", manual)
    (out / "manual_downloads").mkdir(parents=True, exist_ok=True)

    files = []
    for path in (out / "manual_downloads").glob("*"):
        if path.is_file():
            files.append(
                {
                    "filename": path.name,
                    "path": str(path),
                    "size_bytes": path.stat().st_size,
                    "modified_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
                }
            )

    write_json(
        out / "manual_downloads_manifest.json",
        {"source": "cemaden", "files": files, "created_at": utc_now()},
    )


def extract_portal_rio_manual(ctx: Context) -> None:
    out = ctx.raw_dir / "portal_rio_1746"
    manual = f"""# Portal Rio 1746 - etapa manual/semiautomática

O Portal 1746 tem relatórios públicos e área de usuário, mas não foi identificado endpoint estável de dados brutos equivalente a CSV/JSON de chamados.
A página é dinâmica e pode exigir interação/credenciais.

Procedimento seguro:
1. Acesse https://www.1746.rio/hc/pt-br/p/relatorios
2. Exporte relatórios disponíveis, se houver botão de download.
3. Salve CSV/XLSX/JSON em:
   {out / "manual_downloads"}

A pipeline apenas cataloga os arquivos colocados nessa pasta.
"""
    write_text(out / "MANUAL_DOWNLOAD.md", manual)
    (out / "manual_downloads").mkdir(parents=True, exist_ok=True)

    files = []
    for path in (out / "manual_downloads").glob("*"):
        if path.is_file():
            files.append(
                {
                    "filename": path.name,
                    "path": str(path),
                    "size_bytes": path.stat().st_size,
                    "modified_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
                }
            )

    write_json(
        out / "manual_downloads_manifest.json",
        {"source": "portal_rio_1746", "files": files, "created_at": utc_now()},
    )


SOURCE_FUNCS = {
    "fogo_cruzado": extract_fogo_cruzado,
    "inpe_queimadas": extract_inpe_queimadas,
    "inmet": extract_inmet,
    "ibge": extract_ibge,
    "osm_overpass": extract_osm_overpass,
    "osm_geofabrik": extract_osm_geofabrik,
    "nyc311": extract_nyc311,
    "cemaden_manual": extract_cemaden_manual,
    "portal_rio_manual": extract_portal_rio_manual,
}

DEFAULT_ALL = [
    "fogo_cruzado",
    "inpe_queimadas",
    "inmet",
    "ibge",
    "osm_overpass",
    "nyc311",
    "cemaden_manual",
    "portal_rio_manual",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env")
    parser.add_argument("--raw-dir", default=None)
    parser.add_argument("--sources", default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--log-level", default="INFO")
    return parser.parse_args()


def resolve_sources(value: str | None) -> list[str]:
    raw = value or os.getenv("SOURCES", "all")
    if raw.strip().lower() == "all":
        return DEFAULT_ALL.copy()

    sources = split_csv(raw)
    invalid = [s for s in sources if s not in SOURCE_FUNCS]
    if invalid:
        raise ValueError(f"Fontes inválidas: {invalid}. Válidas: {sorted(SOURCE_FUNCS)}")
    return sources


def main() -> int:
    args = parse_args()
    load_dotenv(args.env)

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
    )

    raw_dir = Path(args.raw_dir or os.getenv("RAW_DIR", "data/raw"))
    sources = resolve_sources(args.sources)

    ctx = Context(
        raw_dir=raw_dir,
        session=make_session(),
        force=args.force,
        dry_run=args.dry_run,
    )

    raw_dir.mkdir(parents=True, exist_ok=True)

    run = {
        "started_at": utc_now(),
        "raw_dir": str(raw_dir),
        "sources": sources,
        "force": args.force,
        "dry_run": args.dry_run,
        "status": {},
    }

    for source in sources:
        logging.info("=== extraindo %s ===", source)
        try:
            SOURCE_FUNCS[source](ctx)
            run["status"][source] = {"ok": True, "finished_at": utc_now()}
        except Exception as exc:
            logging.exception("Erro em %s", source)
            run["status"][source] = {"ok": False, "error": repr(exc), "finished_at": utc_now()}

    run["finished_at"] = utc_now()
    write_json(raw_dir / "_pipeline_run_manifest.json", run)

    failed = [src for src, status in run["status"].items() if not status["ok"]]
    if failed:
        logging.warning("Fontes com erro: %s", failed)
        return 1

    logging.info("Pipeline raw concluída em %s", raw_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
