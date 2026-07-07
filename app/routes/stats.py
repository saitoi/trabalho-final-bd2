from typing import Annotated, Any

from fastapi import APIRouter
from fastapi import Depends, Query
from pymongo.collection import Collection

from app.database import get_events_collection
from app.routes.events import _date_boundaries

router = APIRouter(prefix="/stats", tags=["stats"])
EventsCollectionDep = Annotated[Collection, Depends(get_events_collection)]

WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]


def _stats_match(tipo: str | None, inicio: str | None, fim: str | None) -> dict[str, Any]:
    match: dict[str, Any] = {}
    if tipo:
        tipos = [value for value in tipo.split(",") if value]
        if len(tipos) == 1:
            match["tipo"] = tipos[0]
        elif tipos:
            match["tipo"] = {"$in": tipos}
    date_query = _date_boundaries(inicio, fim)
    if date_query:
        match["dataHora"] = date_query
    return match


def _count_by(field: str, limit: int | None = None, match: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    base_match: dict[str, Any] = {field: {"$nin": [None, ""]}}
    base_match.update(match or {})
    pipeline: list[dict[str, Any]] = [
        {"$match": base_match},
        {"$group": {"_id": f"${field}", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    if limit:
        pipeline.append({"$limit": limit})
    return pipeline


@router.get("/by-type")
def stats_by_type(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
) -> list[dict[str, Any]]:
    match = _stats_match(tipo, inicio, fim)
    pipeline: list[dict[str, Any]] = []
    if match:
        pipeline.append({"$match": match})
    pipeline += [
        {"$group": {"_id": "$tipo", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/summary")
def stats_summary(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    match = _stats_match(tipo, inicio, fim)
    pipeline: list[dict[str, Any]] = []
    if match:
        pipeline.append({"$match": match})
    pipeline += [
        {
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "critical": {"$sum": {"$cond": [{"$gte": ["$gravidade", 5]}, 1, 0]}},
                "open": {"$sum": {"$cond": [{"$eq": ["$status", "Aberto"]}, 1, 0]}},
                "avgSeverity": {"$avg": "$gravidade"},
                "citiesSet": {"$addToSet": "$cidade"},
                "neighborhoodsSet": {"$addToSet": "$bairro"},
                "brazil": {"$sum": {"$cond": [{"$eq": ["$pais", "Brasil"]}, 1, 0]}},
                "rioState": {"$sum": {"$cond": [{"$eq": ["$estado", "RJ"]}, 1, 0]}},
                "international": {"$sum": {"$cond": [{"$ne": ["$pais", "Brasil"]}, 1, 0]}},
                "minDate": {"$min": "$dataHora"},
                "maxDate": {"$max": "$dataHora"},
                "victims": {"$sum": {"$ifNull": ["$metadados.vitimas", 0]}},
                "dead": {"$sum": {"$ifNull": ["$metadados.mortos", 0]}},
                "wounded": {"$sum": {"$ifNull": ["$metadados.feridos", 0]}},
                "maxFirePower": {"$max": "$metadados.frp"},
                "avgFireRisk": {"$avg": "$metadados.riscoFogo"},
                "maxRainMm": {"$max": "$metadados.precipitacaoMm"},
                "avgRainMm": {"$avg": "$metadados.precipitacaoMm"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "total": 1,
                "critical": 1,
                "open": 1,
                "avgSeverity": 1,
                "cities": {
                    "$size": {
                        "$setDifference": ["$citiesSet", [None, ""]]
                    }
                },
                "neighborhoods": {
                    "$size": {
                        "$setDifference": ["$neighborhoodsSet", [None, ""]]
                    }
                },
                "brazil": 1,
                "rioState": 1,
                "international": 1,
                "minDate": 1,
                "maxDate": 1,
                "victims": 1,
                "dead": 1,
                "wounded": 1,
                "maxFirePower": 1,
                "avgFireRisk": 1,
                "maxRainMm": 1,
                "avgRainMm": 1,
            }
        },
    ]
    docs = list(eventos.aggregate(pipeline))
    raw = docs[0] if docs else {}
    return {
        "total": raw.get("total", 0),
        "critical": raw.get("critical", 0),
        "open": raw.get("open", 0),
        "avgSeverity": raw.get("avgSeverity"),
        "cities": raw.get("cities", 0),
        "neighborhoods": raw.get("neighborhoods", 0),
        "brazil": raw.get("brazil", 0),
        "rioState": raw.get("rioState", 0),
        "international": raw.get("international", 0),
        "coverage": {
            "cities": raw.get("cities", 0),
            "neighborhoods": raw.get("neighborhoods", 0),
            "brazil": raw.get("brazil", 0),
            "rioState": raw.get("rioState", 0),
            "international": raw.get("international", 0),
        },
        "dateRange": {"min": raw.get("minDate"), "max": raw.get("maxDate")},
        "metadata": {
            "victims": raw.get("victims", 0),
            "dead": raw.get("dead", 0),
            "wounded": raw.get("wounded", 0),
            "maxFirePower": raw.get("maxFirePower"),
            "avgFireRisk": raw.get("avgFireRisk"),
            "maxRainMm": raw.get("maxRainMm"),
            "avgRainMm": raw.get("avgRainMm"),
        },
    }


@router.get("/by-neighborhood")
def stats_by_neighborhood(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
) -> list[dict[str, Any]]:
    match: dict[str, Any] = {"bairro": {"$nin": [None, ""], "$exists": True}}
    match.update(_stats_match(tipo, inicio, fim))
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$bairro", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 15},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/by-neighborhood-type")
def stats_by_neighborhood_type(
    eventos: EventsCollectionDep,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
    top: Annotated[int, Query(ge=1, le=50)] = 12,
) -> dict[str, Any]:
    base_match: dict[str, Any] = {"bairro": {"$nin": [None, ""], "$exists": True}}
    base_match.update(_stats_match(None, inicio, fim))

    top_bairros = [
        doc["_id"]
        for doc in eventos.aggregate(
            [
                {"$match": base_match},
                {"$group": {"_id": "$bairro", "total": {"$sum": 1}}},
                {"$sort": {"total": -1}},
                {"$limit": top},
            ]
        )
    ]
    if not top_bairros:
        return {"rows": [], "tipos": []}

    breakdown_match = dict(base_match)
    breakdown_match["bairro"] = {"$in": top_bairros}
    breakdown = list(
        eventos.aggregate(
            [
                {"$match": breakdown_match},
                {"$group": {"_id": {"bairro": "$bairro", "tipo": "$tipo"}, "total": {"$sum": 1}}},
            ]
        )
    )

    tipos = sorted({doc["_id"]["tipo"] for doc in breakdown if doc["_id"]["tipo"]})
    rows_by_bairro = {bairro: {"bairro": bairro} for bairro in top_bairros}
    for doc in breakdown:
        bairro = doc["_id"]["bairro"]
        tipo_value = doc["_id"]["tipo"]
        if bairro in rows_by_bairro and tipo_value:
            rows_by_bairro[bairro][tipo_value] = doc["total"]

    rows = [rows_by_bairro[bairro] for bairro in top_bairros]
    return {"rows": rows, "tipos": tipos}


@router.get("/by-weekday")
def stats_by_weekday(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
) -> list[dict[str, Any]]:
    match = _stats_match(tipo, inicio, fim)
    pipeline: list[dict[str, Any]] = []
    if match:
        pipeline.append({"$match": match})
    pipeline += [
        {
            "$addFields": {
                "_dow": {"$dayOfWeek": {"$dateFromString": {"dateString": "$dataHora"}}}
            }
        },
        {"$group": {"_id": "$_dow", "total": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    counts = {doc["_id"]: doc["total"] for doc in eventos.aggregate(pipeline)}
    return [
        {"_id": index + 1, "label": WEEKDAY_LABELS[index], "total": counts.get(index + 1, 0)}
        for index in range(7)
    ]


@router.get("/by-severity")
def stats_by_severity(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
) -> list[dict[str, Any]]:
    match = _stats_match(tipo, inicio, fim)
    pipeline: list[dict[str, Any]] = []
    if match:
        pipeline.append({"$match": match})
    pipeline += [
        {"$group": {"_id": "$gravidade", "total": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/by-country")
def stats_by_country(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    return list(eventos.aggregate(_count_by("pais")))


@router.get("/by-state")
def stats_by_state(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    return list(eventos.aggregate(_count_by("estado", 30)))


@router.get("/by-city")
def stats_by_city(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    return list(eventos.aggregate(_count_by("cidade", 30)))


@router.get("/by-reporter")
def stats_by_reporter(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
) -> list[dict[str, Any]]:
    match = _stats_match(tipo, inicio, fim)
    return list(eventos.aggregate(_count_by("reportante.identificador", match=match)))


@router.get("/temporal")
def stats_temporal(
    eventos: EventsCollectionDep,
    tipo: Annotated[str | None, Query()] = None,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
) -> list[dict[str, Any]]:
    match = _stats_match(tipo, inicio, fim)
    pipeline: list[dict[str, Any]] = []
    if match:
        pipeline.append({"$match": match})
    pipeline += [
        {
            "$group": {
                "_id": {"$substr": ["$dataHora", 0, 10]},
                "total": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
        {"$limit": 180},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/temporal-by-type")
def stats_temporal_by_type(
    eventos: EventsCollectionDep,
    inicio: Annotated[str | None, Query()] = None,
    fim: Annotated[str | None, Query()] = None,
    top: Annotated[int, Query(ge=1, le=10)] = 4,
) -> dict[str, Any]:
    base_match = _stats_match(None, inicio, fim)

    top_tipos = [
        doc["_id"]
        for doc in eventos.aggregate(
            [
                *([{"$match": base_match}] if base_match else []),
                {"$match": {"tipo": {"$nin": [None, ""]}}},
                {"$group": {"_id": "$tipo", "total": {"$sum": 1}}},
                {"$sort": {"total": -1}},
                {"$limit": top},
            ]
        )
    ]
    if not top_tipos:
        return {"rows": [], "tipos": []}

    breakdown_match = dict(base_match)
    breakdown_match["tipo"] = {"$in": top_tipos}
    breakdown = list(
        eventos.aggregate(
            [
                {"$match": breakdown_match},
                {
                    "$group": {
                        "_id": {"data": {"$substr": ["$dataHora", 0, 10]}, "tipo": "$tipo"},
                        "total": {"$sum": 1},
                    }
                },
                {"$sort": {"_id.data": 1}},
                {"$limit": 180 * len(top_tipos)},
            ]
        )
    )

    rows_by_date: dict[str, dict[str, Any]] = {}
    for doc in breakdown:
        data = doc["_id"]["data"]
        tipo_value = doc["_id"]["tipo"]
        row = rows_by_date.setdefault(data, {"data": data})
        row[tipo_value] = doc["total"]

    rows = [rows_by_date[data] for data in sorted(rows_by_date)]
    return {"rows": rows, "tipos": top_tipos}
