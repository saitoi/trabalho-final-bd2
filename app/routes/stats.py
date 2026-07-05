from typing import Annotated, Any

from fastapi import APIRouter
from fastapi import Depends
from pymongo.collection import Collection

from app.database import get_events_collection

router = APIRouter(prefix="/stats", tags=["stats"])
EventsCollectionDep = Annotated[Collection, Depends(get_events_collection)]


def _count_by(field: str, limit: int | None = None) -> list[dict[str, Any]]:
    pipeline: list[dict[str, Any]] = [
        {"$match": {field: {"$nin": [None, ""]}}},
        {"$group": {"_id": f"${field}", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    if limit:
        pipeline.append({"$limit": limit})
    return pipeline


@router.get("/by-type")
def stats_by_type(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    pipeline = [
        {"$group": {"_id": "$tipo", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/summary")
def stats_summary(eventos: EventsCollectionDep) -> dict[str, Any]:
    pipeline = [
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
def stats_by_neighborhood(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    pipeline = [
        {"$match": {"bairro": {"$nin": [None, ""], "$exists": True}}},
        {"$group": {"_id": "$bairro", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 15},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/by-severity")
def stats_by_severity(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    pipeline = [
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
def stats_by_reporter(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    return list(eventos.aggregate(_count_by("reportante.identificador")))


@router.get("/temporal")
def stats_temporal(eventos: EventsCollectionDep) -> list[dict[str, Any]]:
    pipeline = [
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
