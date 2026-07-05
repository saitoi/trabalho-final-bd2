from fastapi import APIRouter
from app.database import client

router = APIRouter()


@router.get("/status")
def node_status():
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
