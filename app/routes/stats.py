from fastapi import APIRouter
from app.database import eventos

router = APIRouter()


@router.get("/by-type")
def stats_by_type():
    pipeline = [
        {"$group": {"_id": "$tipo", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/by-neighborhood")
def stats_by_neighborhood():
    pipeline = [
        {"$match": {"bairro": {"$ne": None, "$exists": True}}},
        {"$group": {"_id": "$bairro", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 15},
    ]
    return list(eventos.aggregate(pipeline))


@router.get("/temporal")
def stats_temporal():
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
