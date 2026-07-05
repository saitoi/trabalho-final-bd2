from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from pymongo.collection import Collection

from app.database import get_events_collection
from app.models import CreateEventResponse, EventCreate, EventRead, EventSearchResponse

router = APIRouter(prefix="/events", tags=["events"])
EventsCollectionDep = Annotated[Collection, Depends(get_events_collection)]


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
    inicio: str | None,
    fim: str | None,
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if q:
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"idEvento": regex},
            {"tipo": regex},
            {"descricao": regex},
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
    if min_gravidade is not None:
        query["gravidade"] = {"$gte": min_gravidade}
    date_query = _date_boundaries(inicio, fim)
    if date_query:
        query["dataHora"] = date_query
    return query


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
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
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
        inicio=inicio,
        fim=fim,
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
    limit: Annotated[int, Query(ge=1, le=2000)] = 500,
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
) -> list[EventRead]:
    query = {
        "localizacao": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [lon, lat]},
                "$maxDistance": km * 1000,
            }
        }
    }
    results = [_strip_id(d) for d in eventos.find(query).limit(500)]
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
