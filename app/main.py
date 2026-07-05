from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import events, stats, nodes

app = FastAPI(title="Urban Events API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router, prefix="/events", tags=["events"])
app.include_router(stats.router,  prefix="/stats",  tags=["stats"])
app.include_router(nodes.router,  prefix="/nodes",  tags=["nodes"])


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}
