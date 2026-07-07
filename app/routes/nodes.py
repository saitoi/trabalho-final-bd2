import subprocess
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pymongo import MongoClient
from pymongo.read_preferences import ReadPreference

from app.database import get_mongo_client
from app.models import NodeActionResponse, NodeStatus

router = APIRouter(prefix="/nodes", tags=["nodes"])
MongoClientDep = Annotated[MongoClient, Depends(get_mongo_client)]

CONTAINERS = {
    "mongo1": "bd2-mongo1",
    "mongo2": "bd2-mongo2",
    "mongo3": "bd2-mongo3",
    "27017": "bd2-mongo1",
    "27018": "bd2-mongo2",
    "27019": "bd2-mongo3",
}


@router.get("/status")
def node_status(client: MongoClientDep) -> NodeStatus:
    try:
        rs = client.admin.command("replSetGetStatus", read_preference=ReadPreference.NEAREST)
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


@router.post("/{name}/stop")
def stop_node(name: str) -> NodeActionResponse:
    return _docker_action(name, "stop")


@router.post("/{name}/start")
def start_node(name: str) -> NodeActionResponse:
    return _docker_action(name, "start")


def _docker_action(name: str, action: str) -> NodeActionResponse:
    container = CONTAINERS.get(name)
    if not container:
        raise HTTPException(status_code=404, detail=f"No desconhecido: {name}")
    try:
        subprocess.run(
            ["docker", action, container],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=e.stderr.strip() or str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail="Docker CLI nao encontrado no servidor") from e
    return {"ok": True, "name": name, "action": action}
