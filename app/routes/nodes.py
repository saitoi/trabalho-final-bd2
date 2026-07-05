from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from pymongo import MongoClient

from app.database import get_mongo_client
from app.models import NodeStatus

router = APIRouter(prefix="/nodes", tags=["nodes"])
MongoClientDep = Annotated[MongoClient, Depends(get_mongo_client)]


@router.get("/status")
def node_status(client: MongoClientDep) -> NodeStatus:
    try:
        rs = client.admin.command("replSetGetStatus")
        members = [
            {
                "name":   m["name"],
                "state":  m["stateStr"],
                "health": m["health"],
                "uptime": m.get("uptime", 0),
            }
            for m in rs.get("members", [])
        ]
        return {"ok": True, "members": members}
    except Exception as e:
        return {"ok": False, "error": str(e), "members": []}
