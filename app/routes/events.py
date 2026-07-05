from fastapi import APIRouter, Request, Query
from typing import Optional
from app.database import eventos

router = APIRouter()


def _strip_id(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("/")
def list_events(
    tipo:  Optional[str] = None,
    limit: int = Query(default=500, le=2000),
):
    query = {}
    if tipo:
        query["tipo"] = tipo
    results = [_strip_id(d) for d in eventos.find(query).limit(limit)]
    return results


@router.post("/")
async def create_event(request: Request):
    payload = await request.json()
    result = eventos.insert_one(payload)
    return {"inserted_id": str(result.inserted_id)}


@router.get("/by-period")
def events_by_period(
    inicio: str,
    fim:    str,
    limit:  int = Query(default=500, le=2000),
):
    query = {"dataHora": {"$gte": inicio, "$lte": fim + "T23:59:59"}}
    results = [_strip_id(d) for d in eventos.find(query).limit(limit)]
    return results


@router.get("/by-location")
def events_by_location(
    lat: float,
    lon: float,
    km:  float = 5,
):
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
    min:   int = Query(default=3, ge=1, le=5),
    limit: int = Query(default=500, le=2000),
):
    results = [
        _strip_id(d)
        for d in eventos.find({"gravidade": {"$gte": min}}).limit(limit)
    ]
    return results
