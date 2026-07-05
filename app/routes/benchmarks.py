import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends

router = APIRouter(prefix="/benchmarks", tags=["benchmarks"])


def get_benchmark_results_path() -> Path:
    return Path("data/processed/experiments/results.json")


BenchmarkResultsPathDep = Annotated[Path, Depends(get_benchmark_results_path)]


@router.get("/results")
def benchmark_results(path: BenchmarkResultsPathDep) -> dict[str, Any]:
    if not path.exists():
        return {
            "available": False,
            "generated_at": None,
            "results": [],
            "failure": None,
        }
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        "available": True,
        "generated_at": payload.get("generated_at"),
        "results": payload.get("results", []),
        "failure": payload.get("failure"),
    }
