from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import RootStatus
from app.routes import benchmarks, events, nodes, stats

app = FastAPI(title="Urban Events API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(stats.router)
app.include_router(nodes.router)
app.include_router(benchmarks.router)


@app.get("/")
def root() -> RootStatus:
    return {"status": "ok", "docs": "/docs"}
