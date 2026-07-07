import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.collection import Collection

from app.database import get_events_collection
from app.models import (
    CreateEventResponse,
    EventCreate,
    EventFilterOptions,
    EventRead,
    EventSearchResponse,
)

router = APIRouter(prefix="/events", tags=["events"])
EventsCollectionDep = Annotated[Collection, Depends(get_events_collection)]

ALLOWED_DOCUMENT_FIELDS = {
    "descricao",
    "origem.fonte",
    "origem.idOriginal",
    "origem.arquivoRaw",
    "reportante.tipo",
    "reportante.identificador",
    "metadados.categoriaOriginal",
    "metadados.extraidoEm",
    "metadados.linhaOriginal",
}


def _strip_id(doc: dict[str, Any]) -> dict[str, Any]:
    doc.pop("_id", None)
    return doc


def _date_boundaries(inicio: str | None, fim: str | None) -> dict[str, str] | None:
    date_query: dict[str, str] = {}
    if inicio:
        date_query["$gte"] = f"{inicio}T00:00:00" if len(inicio) == 10 else inicio
    if fim:
        date_query["$lte"] = f"{fim}T23:59:59" if len(fim) == 10 else fim
    return date_query or None


def _compact_query(values: dict[str, str | None]) -> dict[str, str]:
    return {field: value for field, value in values.items() if value}


def _distinct_strings(eventos: Collection, field: str, query: dict[str, Any] | None = None) -> list[str]:
    values = [value for value in eventos.distinct(field, query or {}) if isinstance(value, str) and value.strip()]
    return sorted(values, key=str.casefold)


def _document_field_query(
    *,
    field: str | None,
    operator: str,
    value: str | None,
) -> dict[str, Any]:
    if not field and not value:
        return {}
    if not field or value is None or value == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="documentField and documentValue must be provided together",
        )
    if field not in ALLOWED_DOCUMENT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="documentField is not allowed",
        )
    if operator == "equals":
        return {field: value}
    return {field: {"$regex": re.escape(value), "$options": "i"}}


def _search_query(
    *,
    q: str | None,
    tipo: str | None,
    pais: str | None,
    estado: str | None,
    cidade: str | None,
    bairro: str | None,
    status: str | None,
    min_gravidade: int | None,
    max_gravidade: int | None,
    inicio: str | None,
    fim: str | None,
    document_field: str | None,
    document_operator: str,
    document_value: str | None,
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if q:
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"idEvento": regex},
            {"tipo": regex},
            {"cidade": regex},
            {"bairro": regex},
            {"status": regex},
            {"reportante.identificador": regex},
        ]
    for field, value in {
        "tipo": tipo,
        "pais": pais,
        "estado": estado,
        "cidade": cidade,
        "bairro": bairro,
        "status": status,
    }.items():
        if value:
            query[field] = value
    gravidade_query: dict[str, int] = {}
    if min_gravidade is not None:
        gravidade_query["$gte"] = min_gravidade
    if max_gravidade is not None:
        gravidade_query["$lte"] = max_gravidade
    if gravidade_query:
        query["gravidade"] = gravidade_query
    date_query = _date_boundaries(inicio, fim)
    if date_query:
        query["dataHora"] = date_query
    query.update(
        _document_field_query(
            field=document_field,
            operator=document_operator,
            value=document_value,
        )
    )
    return query


@router.get("/filter-options")
def filter_options(
    eventos: EventsCollectionDep,
    pais: Annotated[str | None, Query()] = None,
    estado: Annotated[str | None, Query(max_length=2)] = None,
    cidade: Annotated[str | None, Query()] = None,
) -> EventFilterOptions:
    pais_query: dict[str, Any] = {}
    estado_query = _compact_query({"pais": pais})
    cidade_query = _compact_query({"pais": pais, "estado": estado})
    bairro_query = _compact_query({"pais": pais, "estado": estado, "cidade": cidade})
    return {
        "paises": _distinct_strings(eventos, "pais", pais_query),
        "estados": _distinct_strings(eventos, "estado", estado_query),
        "cidades": _distinct_strings(eventos, "cidade", cidade_query),
        "bairros": _distinct_strings(eventos, "bairro", bairro_query),
    }


@router.get("/search")
def search_events(
    eventos: EventsCollectionDep,
    q: Annotated[str | None, Query(max_length=120)] = None,
    tipo: Annotated[str | None, Query()] = None,
    pais: Annotated[str | None, Query()] = None,
    estado: Annotated[str | None, Query(max_length=2)] = None,
    cidade: Annotated[str | None, Query()] = None,
    bairro: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    minGravidade: Annotated[int | None, Query(ge=1, le=5)] = None,
    maxGravidade: Annotated[int | None, Query(ge=1, le=5)] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
    documentField: Annotated[str | None, Query()] = None,
    documentOperator: Annotated[str, Query(pattern="^(contains|equals)$")] = "contains",
    documentValue: Annotated[str | None, Query(max_length=240)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    pageSize: Annotated[int, Query(ge=1, le=200)] = 25,
    sortBy: Annotated[str, Query()] = "dataHora",
    sortDir: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
) -> EventSearchResponse:
    sort_field = sortBy if sortBy in {"idEvento", "tipo", "dataHora", "gravidade", "cidade", "bairro", "status"} else "dataHora"
    direction = 1 if sortDir == "asc" else -1
    query = _search_query(
        q=q,
        tipo=tipo,
        pais=pais,
        estado=estado,
        cidade=cidade,
        bairro=bairro,
        status=status,
        min_gravidade=minGravidade,
        max_gravidade=maxGravidade,
        inicio=inicio,
        fim=fim,
        document_field=documentField,
        document_operator=documentOperator,
        document_value=documentValue,
    )
    total = eventos.count_documents(query)
    cursor = eventos.find(query).sort([(sort_field, direction)]).skip((page - 1) * pageSize).limit(pageSize)
    return {
        "items": [_strip_id(d) for d in cursor],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.get("/")
def list_events(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=20000)] = 500,
) -> list[EventRead]:
    query: dict[str, Any] = {}
    if tipo:
        query["tipo"] = tipo
    results = [_strip_id(d) for d in eventos.find(query).limit(limit)]
    return results


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_event(
    event: EventCreate,
    eventos: EventsCollectionDep,
) -> CreateEventResponse:
    payload = event.model_dump(mode="json")
    result = eventos.insert_one(payload)
    return {"inserted_id": str(result.inserted_id)}


@router.get("/by-period")
def events_by_period(
    eventos: EventsCollectionDep,
    inicio: Annotated[str, Query()],
    fim: Annotated[str, Query()],
    limit: Annotated[int, Query(ge=1, le=2000)] = 500,
) -> list[EventRead]:
    query = {"dataHora": {"$gte": inicio, "$lte": fim + "T23:59:59"}}
    results = [_strip_id(d) for d in eventos.find(query).limit(limit)]
    return results


@router.get("/by-location")
def events_by_location(
    eventos: EventsCollectionDep,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
    km: Annotated[float, Query(gt=0, le=100)] = 5,
    limit: Annotated[int, Query(ge=1, le=20000)] = 500,
) -> list[EventRead]:
    query = {
        "localizacao": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [lon, lat]},
                "$maxDistance": km * 1000,
            }
        }
    }
    results = [_strip_id(d) for d in eventos.find(query).limit(limit)]
    return results


@router.get("/by-severity")
def events_by_severity(
    eventos: EventsCollectionDep,
    min: Annotated[int, Query(ge=1, le=5)] = 3,
    limit: Annotated[int, Query(ge=1, le=2000)] = 500,
) -> list[EventRead]:
    results = [
        _strip_id(d)
        for d in eventos.find({"gravidade": {"$gte": min}}).limit(limit)
    ]
    return results
